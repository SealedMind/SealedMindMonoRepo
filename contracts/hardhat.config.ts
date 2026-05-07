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
  etherscan: {
    apiKey: {
      og_testnet: process.env.OG_CHAINSCAN_API_KEY ?? "no-api-key-needed",
      og_mainnet: process.env.OG_CHAINSCAN_API_KEY ?? "no-api-key-needed",
    },
    customChains: [
      {
        network: "og_testnet",
        chainId: 16602,
        urls: {
          apiURL: "https://chainscan-galileo.0g.ai/open/api",
          browserURL: "https://chainscan-galileo.0g.ai",
        },
      },
      {
        network: "og_mainnet",
        chainId: 16661,
        urls: {
          apiURL: "https://chainscan.0g.ai/open/api",
          browserURL: "https://chainscan.0g.ai",
        },
      },
    ],
  },
};

export default config;
