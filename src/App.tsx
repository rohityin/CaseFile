import { useState, useEffect, lazy, Suspense } from "react";
import { Nav } from "./components/Nav";
import { Landing } from "./components/Landing";
import { Footer } from "./components/Footer";
import { CommandPalette } from "./components/CommandPalette";

const AgentStudio = lazy(() =>
  import("./components/AgentStudio").then((m) => ({ default: m.AgentStudio }))
);
const Research = lazy(() =>
  import("./components/Research").then((m) => ({ default: m.Research }))
);

export type View = "home" | "agent" | "research";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [seedQuery, setSeedQuery] = useState("IT laws for cyber crime");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentCourt, setAgentCourt] = useState("");
  const [agentTab, setAgentTab] = useState<
    "matrix" | "graph" | "split" | "timeline" | "memo" | "citations" | "reader"
  >("matrix");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function scrollTop() {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
  }

  function startResearch(query: string) {
    setSeedQuery(query);
    setView("research");
    scrollTop();
  }

  function startAgent(prompt?: string, court?: string) {
    if (prompt) setAgentPrompt(prompt);
    if (court) setAgentCourt(court);
    setView("agent");
    scrollTop();
  }

  function navigate(next: View) {
    setView(next);
    scrollTop();
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav
        view={view}
        onNavigate={navigate}
        onOpenCommandBar={() => setCommandPaletteOpen(true)}
      />
      <main id="main" className="page-main">
        <Suspense fallback={<div className="suspense-fallback">Loading…</div>}>
        {view === "home" && (
          <Landing
            onStartResearch={startResearch}
            onStartAgent={(prompt, court) => startAgent(prompt, court)}
          />
        )}
        {view === "agent" && (
          <AgentStudio
            initialPrompt={agentPrompt}
            initialCourt={agentCourt}
            externalTab={agentTab}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          />
        )}
        {view === "research" && (
          <Research
            initialQuery={seedQuery}
            onStartAgent={(prompt, court) => startAgent(prompt, court)}
          />
        )}
        </Suspense>
      </main>
      {view === "home" && <Footer />}

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigateView={(v) => {
          setView(v);
          scrollTop();
        }}
        onNavigateTab={(tab) => {
          setAgentTab(tab);
          setView("agent");
          scrollTop();
        }}
        onSelectPreset={(prompt, court) => {
          startAgent(prompt, court);
        }}
      />
    </div>
  );
}
