#!/usr/bin/env node
import { Command } from "commander";
import { recall } from "./commands/recall.js";
import { remember } from "./commands/remember.js";
import { grant } from "./commands/grant.js";

const program = new Command()
  .name("sealedmind")
  .description("CLI bridge between OpenClaw and SealedMind encrypted memory");

program
  .command("recall")
  .description("Recall memories from the user's Mind via TEE synthesis")
  .requiredOption("--mind <id>", "Mind ID")
  .requiredOption("--query <text>", "Natural-language query")
  .option("--shard <name>", "Restrict to a specific shard")
  .option("--top-k <n>", "Number of memories to retrieve (default 5)")
  .action(recall);

program
  .command("remember")
  .description("Seal a new fact into the user's Mind via TEE")
  .requiredOption("--mind <id>", "Mind ID")
  .requiredOption("--content <text>", "Fact or information to seal")
  .option("--shard <name>", "Target shard (e.g. personal, health, work)")
  .action(remember);

program
  .command("grant")
  .description("Grant a shard capability to another wallet address")
  .requiredOption("--mind <id>", "Mind ID")
  .requiredOption("--shard <name>", "Shard to share (e.g. health)")
  .requiredOption("--to <addr>", "Grantee wallet address")
  .requiredOption("--expiry-days <n>", "Capability lifetime in days")
  .option("--read-only", "Grant read-only access (default: false)")
  .action(grant);

program.parseAsync().catch((err) => {
  process.stderr.write(`error: ${err?.message ?? err}\n`);
  process.exit(1);
});
