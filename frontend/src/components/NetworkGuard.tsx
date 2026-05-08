import { useEffect, useState } from "react";
import { useAccount, useChainId } from "wagmi";

/**
 * NetworkGuard — soft banner shown when the connected wallet is on a
 * chain we don't support. One-click `wallet_addEthereumChain` adds 0G
 * Galileo Testnet to the user's wallet (MetaMask / Rabby / etc.) and
 * switches to it. Same for mainnet.
 *
 * No-op when:
 *   - no wallet connected
 *   - wallet is on 16602 (testnet) or 16661 (mainnet)
 */

const SUPPORTED = new Set([16602, 16661]);

const TESTNET_CHAIN = {
  chainId: "0x40DA",        // 16602 hex
  chainName: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: ["https://evmrpc-testnet.0g.ai"],
  blockExplorerUrls: ["https://chainscan-galileo.0g.ai"],
};

const MAINNET_CHAIN = {
  chainId: "0x4115",        // 16661 hex
  chainName: "0G Mainnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: ["https://evmrpc.0g.ai"],
  blockExplorerUrls: ["https://chainscan.0g.ai"],
};

export default function NetworkGuard() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setError(null);
    setDismissed(false);
  }, [chainId]);

  if (!isConnected) return null;
  if (SUPPORTED.has(chainId)) return null;
  if (dismissed) return null;

  async function addAndSwitch(target: typeof TESTNET_CHAIN) {
    setBusy(true);
    setError(null);
    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error("No injected wallet detected");

      // Try to switch first; if the chain isn't added, MetaMask returns
      // 4902 ("unrecognized chain"), then we fall back to adding it.
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: target.chainId }],
        });
      } catch (switchErr: any) {
        if (switchErr?.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [target],
          });
        } else {
          throw switchErr;
        }
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-20 mx-auto max-w-[1440px] px-8 mt-4">
      <div className="terminal-frame hairline-rune p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="inline-block w-2 h-2 rounded-full bg-rune anim-pulse-seal flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-rune-deep">
              Wrong network — chain {chainId}
            </div>
            <div className="text-vellum text-[13px] mt-1 leading-[1.5]">
              Switch to <strong>0G</strong> to use SealedMind. Your wallet doesn't have it added yet — one click below.
            </div>
            {error && (
              <div className="font-mono text-[11px] text-crimson mt-2">
                {error}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => addAndSwitch(TESTNET_CHAIN)}
            disabled={busy}
            className={`btn-seal ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {busy ? "…" : "Add 0G Testnet"}
          </button>
          <button
            onClick={() => addAndSwitch(MAINNET_CHAIN)}
            disabled={busy}
            className="btn-ghost"
          >
            Mainnet
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="font-mono text-[10px] text-vellum-mute hover:text-vellum-dim px-2"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
