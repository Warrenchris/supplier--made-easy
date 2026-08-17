import SourcingBoard from "./components/SourcingBoard";
import { Package, ShieldCheck, Layers, GitBranch, Github } from "lucide-react";

export default function App() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0f1117" }}>
      {/* Navigation Header */}
      <header style={{ borderBottom: "1px solid #2b303d", background: "#181b24", padding: "16px 32px" }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "linear-gradient(135deg, #2dd4bf 0%, #3b82f6 100%)", borderRadius: "10px", padding: "8px", display: "flex", color: "#0f1117" }}>
              <Package size={22} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "#f0f3f8", letterSpacing: "-0.01em" }}>
                Supplier Made Easy
              </div>
              <div style={{ fontSize: "11px", color: "#949eb2", fontFamily: "'IBM Plex Mono', monospace" }}>
                v1.0.0 · Smart Procurement Sourcing Engine
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <a
              href="https://github.com/Warrenchris/supplier--made-easy"
              target="_blank"
              rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: "8px", color: "#949eb2", textDecoration: "none", fontSize: "13px" }}
            >
              <Github size={16} /> GitHub Repo
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: "24px 16px" }}>
        <SourcingBoard />
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #2b303d", padding: "20px 32px", background: "#181b24", color: "#949eb2", fontSize: "13px" }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <strong>Supplier Made Easy</strong> — Built for procurement & sourcing managers.
          </div>
          <div style={{ fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace" }}>
            Clean Code · Instant Excel & CSV Parsing · Client-side Privacy
          </div>
        </div>
      </footer>
    </div>
  );
}
