import { Link } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import BackgroundField from "./BackgroundField";
import MindSeal from "./MindSeal";

interface Props {
  children: React.ReactNode;
}

export default function Layout({ children }: Props) {
  return (
    <div className="relative min-h-screen text-vellum">
      <BackgroundField />

      {/* Top chrome */}
      <header className="relative z-10">
        <div className="mx-auto max-w-[1440px] px-8 py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <MindSeal size={40} />
            <div className="flex flex-col leading-none">
              <span className="font-display text-[20px] tracking-tight text-vellum">
                SealedMind
              </span>
              <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute mt-1">
                v0.1 · Galileo Testnet
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-10 font-mono text-[11px] tracking-[0.18em] uppercase text-vellum-dim">
            <Link to="/dashboard" className="hover:text-seal transition-colors">
              Dashboard
            </Link>
            <a href="https://github.com/SealedMind/SealedMindMonoRepo" target="_blank" rel="noreferrer" className="hover:text-seal transition-colors">
              Source
            </a>
            <a href="https://chainscan-galileo.0g.ai" target="_blank" rel="noreferrer" className="hover:text-seal transition-colors">
              Explorer
            </a>
          </nav>

          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
        </div>

        {/* hairline */}
        <div className="h-px bg-gradient-to-r from-transparent via-vellum/10 to-transparent" />
      </header>

      <main className="relative z-10">{children}</main>

      <footer className="relative z-10 mt-32 border-t border-vellum/5">
        <div className="mx-auto max-w-[1440px] px-8 py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <MindSeal size={28} />
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute">
              <div>SealedMind / Phase 6 · Frontend dApp</div>
              <div className="mt-1">Encrypted memory · TEE attested · iNFT-owned</div>
            </div>
          </div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute">
            ⬡ 0G Galileo · Chain 16602
          </div>
        </div>
      </footer>
    </div>
  );
}
