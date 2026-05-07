"""SealedMind — Python SDK for the encrypted, capability-gated AI memory layer on 0G.

Quickstart:

    from sealedmind import SealedMind

    client = SealedMind(api_key="sm_...")
    mind = await client.create_mind("my-agent")
    await client.remember(mind.id, content="user prefers vegetarian meals")
    result = await client.recall(mind.id, query="what does the user prefer to eat?")
    print(result.answer)

For 0G Memory users — install the addon instead:

    pip install evermemos-sealedmind
"""
from .client import SealedMind, SealedMindError
from .types import (
    Attestation,
    CapabilityGrant,
    Memory,
    Mind,
    RecallResult,
    RememberResult,
)

__version__ = "0.1.0"

__all__ = [
    "__version__",
    "SealedMind",
    "SealedMindError",
    "Mind",
    "Memory",
    "RememberResult",
    "RecallResult",
    "CapabilityGrant",
    "Attestation",
]
