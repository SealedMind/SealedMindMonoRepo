#!/usr/bin/env node
import { Command } from "commander";
import { recall } from "./commands/recall.js";
import { remember } from "./commands/remember.js";
import { grant } from "./commands/grant.js";
import { login } from "./commands/login.js";

const program = new Command()
  .name("sealedmind")
  .description("CLI for SealedMind encrypted memory — remember, recall, and share via TEE");

program
  .command("login")
  .description("Authenticate with a private key — saves credentials to ~/.sealedmind/config.json")
  .option("--private-key <key>", "Wallet private key (or set PRIVATE_KEY env var)")
  .option("--host <url>", "SealedMind API URL", "http://localhost:4000")
  .action(login);

program
  .command("remember")
  .description("Seal a new fact into the user's Mind via TEE")
  .option("--mind <id>", "Mind ID (defaults to wallet address from login)")
  .requiredOption("--content <text>", "Fact or information to seal")
  .option("--shard <name>", "Target shard (e.g. personal, health, work)")
  .action(remember);

program
  .command("recall")
  .description("Recall memories from the user's Mind via TEE synthesis")
  .option("--mind <id>", "Mind ID (defaults to wallet address from login)")
  .requiredOption("--query <text>", "Natural-language query")
  .option("--shard <name>", "Restrict to a specific shard")
  .option("--top-k <n>", "Number of memories to retrieve (default 5)")
  .action(recall);

program
  .command("grant")
  .description("Grant a shard capability to another wallet address")
  .option("--mind <id>", "Mind ID (defaults to wallet address from login)")
  .requiredOption("--shard <name>", "Shard to share (e.g. health)")
  .requiredOption("--to <addr>", "Grantee wallet address")
  .requiredOption("--expiry-days <n>", "Capability lifetime in days")
  .option("--read-only", "Grant read-only access")
  .action(grant);

program.parseAsync().catch((err) => {
  process.stderr.write(`error: ${err?.message ?? err}\n`);
  process.exit(1);
});
