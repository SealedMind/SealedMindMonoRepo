import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import MindSeal from "../components/MindSeal";
import type { CapabilityGrant } from "@sealedmind/sdk";

export default function Sharing() {
  const { id } = useParams();
  const { isAuthenticated, client } = useAuth();
  const [caps, setCaps] = useState<CapabilityGrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    shardName: "general",
    grantee: "",
    readOnly: true,
    expiry: "",
  });

  const refresh = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await client.listCapabilities(id);
      setCaps(res.capabilities || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && id) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, id]);

  const grant = async () => {
    if (!id || !form.grantee.trim()) return;
    await client.grantCapability(id, form.shardName, form.grantee.trim(), {
      readOnly: form.readOnly,
      expiry: form.expiry ? Math.floor(new Date(form.expiry).getTime() / 1000) : undefined,
    });
    setForm({ shardName: "general", grantee: "", readOnly: true, expiry: "" });
    setShowForm(false);
    refresh();
  };

  const revoke = async (capId: string) => {
    if (!id) return;
    await client.revokeCapability(id, capId);
    refresh();
  };

  if (!isAuthenticated || !id) {
    return (
      <div className="mx-auto max-w-[1440px] px-8 py-32">
        <p className="font-mono text-[12px] text-vellum-mute uppercase tracking-[0.22em]">
          ▸ Authenticate from the{" "}
          <Link to="/dashboard" className="text-seal underline">
            dashboard
          </Link>{" "}
          first.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-8 py-12">
      {/* Header */}
      <div className="grid grid-cols-12 gap-8 items-end mb-16">
        <div className="col-span-12 lg:col-span-8">
          <div className="eyebrow flex items-center gap-3">
            <span className="inline-block w-8 h-px bg-rune" />
            Mind · {id} · Capability ledger
          </div>
          <h1 className="font-display mt-6 text-[80px] leading-[0.85] tracking-[-0.03em] text-vellum">
            Sharing<br />
            <span className="font-display-italic text-rune">manifest.</span>
          </h1>
          <p className="mt-6 text-vellum-dim text-[16px] max-w-[560px] leading-[1.7]">
            Grant other agents and humans scoped, time-bound, read-only access
            to specific shards of this Mind. Every capability is on chain. Every
            access is logged. Revocation is immediate.
          </p>
        </div>
        <div className="col-span-12 lg:col-span-4 flex justify-end gap-3">
          <Link
            to={`/mind/${id}/chat`}
            className="font-mono text-[10px] tracking-[0.22em] uppercase px-5 py-3 border border-vellum/15 hover:border-seal hover:text-seal transition-colors"
          >
            ← Console
          </Link>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="btn-seal"
            style={{ background: "#c084fc" }}
          >
            {showForm ? "Cancel" : "+ Grant"}
          </button>
        </div>
      </div>

      {/* Grant form */}
      {showForm && (
        <div className="hairline-rune bg-ink-2/60 grain p-8 mb-12 fade-up">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-rune mb-6">
            ⬡ Forge new capability
          </div>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-3">
              <label className="font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute">
                Shard
              </label>
              <input
                value={form.shardName}
                onChange={(e) => setForm({ ...form, shardName: e.target.value })}
                className="mt-2 w-full bg-ink border border-vellum/10 px-3 py-2 font-mono text-[12px] text-vellum focus:border-rune focus:outline-none"
              />
            </div>
            <div className="col-span-12 md:col-span-5">
              <label className="font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute">
                Grantee address
              </label>
              <input
                value={form.grantee}
                onChange={(e) => setForm({ ...form, grantee: e.target.value })}
                placeholder="0x…"
                className="mt-2 w-full bg-ink border border-vellum/10 px-3 py-2 font-mono text-[12px] text-vellum focus:border-rune focus:outline-none"
              />
            </div>
            <div className="col-span-6 md:col-span-2">
              <label className="font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute">
                Expires
              </label>
              <input
                type="date"
                value={form.expiry}
                onChange={(e) => setForm({ ...form, expiry: e.target.value })}
                className="mt-2 w-full bg-ink border border-vellum/10 px-3 py-2 font-mono text-[12px] text-vellum focus:border-rune focus:outline-none"
              />
            </div>
            <div className="col-span-6 md:col-span-2 flex items-end">
              <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-vellum-dim cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.readOnly}
                  onChange={(e) => setForm({ ...form, readOnly: e.target.checked })}
                  className="accent-rune"
                />
                Read-only
              </label>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={grant}
              disabled={!form.grantee.trim()}
              className="btn-seal disabled:opacity-30"
              style={{ background: "#c084fc" }}
            >
              Seal capability →
            </button>
          </div>
        </div>
      )}

      {/* Ledger */}
      {loading ? (
        <div className="font-mono text-[11px] text-vellum-mute uppercase tracking-[0.22em]">
          ▸ Loading manifest…
        </div>
      ) : caps.length === 0 ? (
        <div className="hairline bg-ink-2/30 grain p-20 text-center">
          <div className="flex justify-center mb-8">
            <MindSeal size={140} variant="rune" active={false} />
          </div>
          <div className="font-display text-[42px] text-vellum">No capabilities granted.</div>
          <p className="font-display-italic text-rune text-[20px] mt-3">
            This Mind shares with no one.
          </p>
        </div>
      ) : (
        <div className="hairline bg-ink-2/30 overflow-hidden">
          {/* Table head */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-vellum/10 bg-ink-3 font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute">
            <div className="col-span-1">#</div>
            <div className="col-span-2">Shard</div>
            <div className="col-span-3">Grantee</div>
            <div className="col-span-2">Mode</div>
            <div className="col-span-2">Expires</div>
            <div className="col-span-2 text-right">Action</div>
          </div>
          {caps.map((cap, i) => (
            <div
              key={cap.capId}
              className={`grid grid-cols-12 gap-4 px-6 py-5 items-center font-mono text-[12px] border-b border-vellum/5 last:border-b-0 transition-colors ${
                cap.revoked ? "opacity-40" : "hover:bg-ink-3/40"
              }`}
            >
              <div className="col-span-1 text-vellum-mute">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="col-span-2">
                <span className="px-2 py-1 hairline-rune text-rune text-[10px] uppercase tracking-[0.15em]">
                  {cap.shardName}
                </span>
              </div>
              <div className="col-span-3 text-vellum">
                {cap.grantee.slice(0, 8)}…{cap.grantee.slice(-6)}
              </div>
              <div className="col-span-2 text-vellum-dim">
                {cap.readOnly ? "read · only" : "read · write"}
              </div>
              <div className="col-span-2 text-vellum-dim">
                {cap.expiry
                  ? new Date(cap.expiry * 1000).toLocaleDateString()
                  : "never"}
              </div>
              <div className="col-span-2 text-right">
                {cap.revoked ? (
                  <span className="text-crimson text-[10px] tracking-[0.18em] uppercase">
                    Revoked
                  </span>
                ) : (
                  <button
                    onClick={() => revoke(cap.capId)}
                    className="text-[10px] tracking-[0.18em] uppercase text-vellum-mute hover:text-crimson transition-colors"
                  >
                    Revoke ⨯
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer note */}
      <div className="mt-12 flex items-start gap-4 font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute">
        <span className="inline-block w-8 h-px bg-rune mt-3" />
        <div>
          Each capability lives on the CapabilityRegistry contract.
          <br />
          Revocation is final and immediate. Audit log is permanent.
        </div>
      </div>
    </div>
  );
}
