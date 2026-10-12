import type { View } from "../App";
import { Sparkle, MagnifyingGlass } from "@phosphor-icons/react";

interface NavProps {
  view: View;
  onNavigate: (view: View) => void;
  onOpenCommandBar?: () => void;
}

export function Nav({ view, onNavigate, onOpenCommandBar }: NavProps) {
  const crumb =
    view === "home"
      ? "Smart Legal Assistant"
      : view === "agent"
      ? "AI Legal Studio"
      : "Case Research Desk";

  return (
    <header className="workbench-nav">
      <div className="workbench-nav-left">
        <a
          href="#home"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("home");
          }}
          title="CaseFile AI"
        >
          <span className="brand-mark" aria-hidden>
            CF
          </span>
          <span className="brand-text">
            CaseFile <span className="brand-ai">AI</span>
          </span>
        </a>
        <span className="workbench-divider" aria-hidden>/</span>
        <span className="workbench-crumb">{crumb}</span>
      </div>

      <div className="workbench-nav-center">
        <div className="segmented-control" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === "home"}
            className={`seg-btn ${view === "home" ? "active" : ""}`}
            onClick={() => onNavigate("home")}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "agent"}
            className={`seg-btn ${view === "agent" ? "active" : ""}`}
            onClick={() => onNavigate("agent")}
          >
            <Sparkle size={13} weight={view === "agent" ? "fill" : "regular"} />
            AI Legal Studio
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "research"}
            className={`seg-btn ${view === "research" ? "active" : ""}`}
            onClick={() => onNavigate("research")}
          >
            Case Search
          </button>
        </div>
      </div>

      <div className="workbench-nav-right">
        {onOpenCommandBar && (
          <button
            type="button"
            className="nav-cmd-k-trigger"
            onClick={onOpenCommandBar}
            title="Quick actions and search (Press Cmd+K or Ctrl+K)"
          >
            <MagnifyingGlass size={13} />
            <span>Quick Actions</span>
            <kbd>⌘K</kbd>
          </button>
        )}
        <div className="engine-status">
          <span className="engine-dot" />
          <span className="engine-label">Real Court Records Live</span>
        </div>
      </div>
    </header>
  );
}
