import { useEffect, useState, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { client, loadSession, saveSession, clearSession } from "./sealedmind";

/**
 * useAuth — wires wagmi signing to SealedMind SIWE login.
 *
 * The SDK accepts an ethers Signer for `client.login()`, but with wagmi/viem
 * we bypass that and call the auth endpoints directly, then `setSession()`.
 */
export function useAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [session, setSession] = useState(() => loadSession());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-clear session if wallet disconnects or address changes
  useEffect(() => {
    if (!isConnected && session) {
      clearSession();
      setSession(null);
    }
    if (isConnected && address && session && session.address.toLowerCase() !== address.toLowerCase()) {
      clearSession();
      setSession(null);
    }
  }, [isConnected, address, session]);

  const login = useCallback(async () => {
    if (!address) throw new Error("Wallet not connected");
    setLoading(true);
    setError(null);
    try {
      // 1. Get nonce from API
      const nonceRes = await fetch("/v1/auth/nonce");
      const { nonce } = await nonceRes.json();

      // 2. Build SIWE message
      const siwe = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to SealedMind. Your AI memory remains sealed.",
        uri: window.location.origin,
        version: "1",
        chainId: 16602,
        nonce,
      });
      const message = siwe.prepareMessage();

      // 3. Sign with wagmi
      const signature = await signMessageAsync({ message });

      // 4. POST to backend
      const loginRes = await fetch("/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });

      if (!loginRes.ok) {
        const body = await loginRes.json().catch(() => ({}));
        throw new Error(body.error || "Login failed");
      }

      const newSession = await loginRes.json();
      saveSession(newSession);
      setSession(newSession);
      return newSession;
    } catch (err: any) {
      setError(err.message || "Login failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address, signMessageAsync]);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  return {
    session,
    address,
    isConnected,
    isAuthenticated: session !== null,
    loading,
    error,
    login,
    logout,
    client,
  };
}
