"""MemoryAgent — a LangGraph agent that uses evermemos-sealedmind for memory.

Graph:

    START → call_llm → has_tool_call?
                          │
                       yes ┘────► run_tool ──┐
                          │                   │
                       no │                   ▼
                          ▼              loop back to call_llm
                         END

The state graph is intentionally minimal so the demo recording stays
legible — the audience can see "agent thinks → calls tool → gets result
→ thinks again → final answer" in three terminal frames.

Each agent owns:
  * an LLM backend (Claude or SealedInference)
  * a `ToolContext` shared by all tool invocations
  * a list of allowed tool names
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from typing import Any, Callable

from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict

from .llm import ChatResult, ToolCall
from .tools import ToolContext, execute_tool, tool_schemas_for


class AgentState(TypedDict, total=False):
    system: str
    messages: list[dict[str, Any]]
    last_result: ChatResult
    iter: int


@dataclass
class MemoryAgent:
    name: str
    persona: str
    llm: Any  # ClaudeBackend or SealedInferenceBackend
    tool_ctx: ToolContext
    allowed_tools: list[str] = field(default_factory=list)
    max_iterations: int = 6

    def __post_init__(self) -> None:
        self._graph = self._build_graph()

    # ---------------------------------------------------- graph wiring

    def _build_graph(self):
        g = StateGraph(AgentState)
        g.add_node("call_llm", self._call_llm)
        g.add_node("run_tools", self._run_tools)
        g.add_edge(START, "call_llm")
        g.add_conditional_edges(
            "call_llm", self._needs_tool, {"tool": "run_tools", "done": END}
        )
        g.add_edge("run_tools", "call_llm")
        return g.compile()

    @staticmethod
    def _needs_tool(state: AgentState) -> str:
        result = state.get("last_result")
        if result and result.tool_calls and state.get("iter", 0) < 6:
            return "tool"
        return "done"

    def _call_llm(self, state: AgentState) -> AgentState:
        result = self.llm.chat(
            system=state["system"],
            messages=state["messages"],
            tools=tool_schemas_for(self.allowed_tools),
        )
        # Append assistant response to messages so future turns see it
        new_messages = state["messages"][:]
        if result.tool_calls or result.text:
            content_blocks: list[dict[str, Any]] = []
            if result.text:
                content_blocks.append({"type": "text", "text": result.text})
            for tc in result.tool_calls:
                content_blocks.append({
                    "type": "tool_use",
                    "id": tc.call_id or f"tool-{state.get('iter', 0)}",
                    "name": tc.name,
                    "input": tc.args,
                })
            new_messages.append({"role": "assistant", "content": content_blocks})

        return {
            "system": state["system"],
            "messages": new_messages,
            "last_result": result,
            "iter": state.get("iter", 0) + 1,
        }

    def _run_tools(self, state: AgentState) -> AgentState:
        result = state["last_result"]
        new_messages = state["messages"][:]
        tool_results: list[dict[str, Any]] = []
        for tc in result.tool_calls:
            self.tool_ctx.on_event("tool_call", {
                "agent": self.name, "tool": tc.name, "args": tc.args,
            })
            output = asyncio.run(execute_tool(self.tool_ctx, tc.name, tc.args))
            self.tool_ctx.on_event("tool_result", {
                "agent": self.name, "tool": tc.name, "result": output,
            })
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tc.call_id or "tool-0",
                "content": json.dumps(output),
            })
        new_messages.append({"role": "user", "content": tool_results})
        return {
            "system": state["system"],
            "messages": new_messages,
            "iter": state.get("iter", 0),
        }

    # ----------------------------------------------------------- public

    def chat(self, user_message: str) -> ChatResult:
        initial_message = {"role": "user", "content": user_message}
        # System prompt is fixed for the agent's lifetime
        initial: AgentState = {
            "system": self.persona,
            "messages": [initial_message],
            "iter": 0,
        }
        final = self._graph.invoke(initial)
        return final["last_result"]


__all__ = ["MemoryAgent", "AgentState"]
