import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    og_testnet: {
      url: process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai",
      chainId: Number(process.env.OG_CHAIN_ID ?? 16602),
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    og_mainnet: {
      url: "https://evmrpc.0g.ai",
      chainId: 16661,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};

export default config;
