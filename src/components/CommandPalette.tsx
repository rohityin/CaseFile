import { useState, useEffect, useMemo, useRef } from "react";
import {
  MagnifyingGlass,
  Sparkle,
  Scales,
  FileText,
  ShieldCheck,
  GitBranch,
  Clock,
  Printer,
  ArrowRight,
  House,
  Books,
} from "@phosphor-icons/react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateView?: (view: "home" | "agent" | "research") => void;
  onNavigateTab?: (tab: "matrix" | "graph" | "split" | "timeline" | "memo" | "citations" | "reader") => void;
  onSelectPreset?: (prompt: string, court?: string) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNavigateView,
  onNavigateTab,
  onSelectPreset,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const COMMANDS = useMemo(() => [
    {
      category: "Pages & Tools",
      items: [
        {
          id: "nav-home",
          title: "Overview Page",
          sub: "See how CaseFile works, try a quick search, and explore sample results",
          icon: <House size={16} color="var(--accent)" />,
          action: () => {
            onNavigateView?.("home");
            onClose();
          },
        },
        {
          id: "nav-agent",
          title: "AI Legal Studio",
          sub: "Ask any legal question to research cases, see both sides, and draft a memo",
          icon: <Sparkle size={16} color="var(--accent)" />,
          action: () => {
            onNavigateView?.("agent");
            onClose();
          },
        },
        {
          id: "nav-research",
          title: "Case Search Desk",
          sub: "Search real court records, read full decisions, and generate AI summaries",
          icon: <Books size={16} color="var(--warn)" />,
          action: () => {
            onNavigateView?.("research");
            onClose();
          },
        },
      ],
    },
    {
      category: "Document & Map Views",
      items: [
        {
          id: "tab-matrix",
          title: "Case Comparison Table",
          sub: "Compare cases that help you against cases the other side will use",
          icon: <Scales size={16} color="var(--accent)" />,
          action: () => {
            onNavigateTab?.("matrix");
            onClose();
          },
        },
        {
          id: "tab-graph",
          title: "Case Network Map",
          sub: "Explore an interactive visual map connecting related court cases",
          icon: <Sparkle size={16} color="var(--accent)" />,
          action: () => {
            onNavigateTab?.("graph");
            onClose();
          },
        },
        {
          id: "tab-split",
          title: "Court Disagreements",
          sub: "See where different federal appeals courts disagree on the law",
          icon: <GitBranch size={16} color="#c4a35a" />,
          action: () => {
            onNavigateTab?.("split");
            onClose();
          },
        },
        {
          id: "tab-timeline",
          title: "50-Year Legal Timeline",
          sub: "Follow how this legal rule changed from 1974 to today",
          icon: <Clock size={16} color="#6aab8a" />,
          action: () => {
            onNavigateTab?.("timeline");
            onClose();
          },
        },
        {
          id: "tab-memo",
          title: "Legal Memo (IRAC Format)",
          sub: "Read a complete legal brief with the question, rule, facts, and answers",
          icon: <FileText size={16} color="var(--text)" />,
          action: () => {
            onNavigateTab?.("memo");
            onClose();
          },
        },
        {
          id: "tab-citations",
          title: "Fact-Checked Sources",
          sub: "Check every case citation against official court records to ensure it is real",
          icon: <ShieldCheck size={16} color="#72ba97" />,
          action: () => {
            onNavigateTab?.("citations");
            onClose();
          },
        },
        {
          id: "tab-reader",
          title: "Full Decision Reader",
          sub: "Read the complete text of the decision written by the judge",
          icon: <Books size={16} color="var(--accent)" />,
          action: () => {
            onNavigateTab?.("reader");
            onClose();
          },
        },
      ],
    },
    {
      category: "Sample Legal Questions",
      items: [
        {
          id: "preset-dtsa",
          title: "Trade Secrets & Reverse Engineering",
          sub: "Find 9th Circuit rulings protecting engineers who legally take products apart",
          icon: <Sparkle size={16} color="var(--accent)" />,
          action: () => {
            onSelectPreset?.(
              "We represent a startup accused of stealing trade secrets under the Defend Trade Secrets Act. The founder legally took apart public software code to see how it works. Find key 9th Circuit rulings that protect reverse engineering, analyze what the other side might argue, and draft our defense brief.",
              "ca9"
            );
            onClose();
          },
        },
        {
          id: "preset-geofence",
          title: "Fourth Amendment & Phone Location Searches",
          sub: "Challenge broad police warrants that collect location data from all nearby phones",
          icon: <Sparkle size={16} color="var(--accent)" />,
          action: () => {
            onSelectPreset?.(
              "Challenge a criminal conviction based on a Google location search warrant. Find cases that help our defense showing that searching every phone in an area violates the Fourth Amendment under Carpenter v. United States.",
              "scotus"
            );
            onClose();
          },
        },
        {
          id: "preset-ai",
          title: "AI Training & Copyright Fair Use",
          sub: "Check if training AI on published work counts as fair use under copyright law",
          icon: <Sparkle size={16} color="var(--accent)" />,
          action: () => {
            onSelectPreset?.(
              "Defend an AI company against copyright claims. Evaluate whether training on public text counts as fair use under Google and Warhol court decisions.",
              "ca2"
            );
            onClose();
          },
        },
      ],
    },
    {
      category: "Quick Actions",
      items: [
        {
          id: "act-print",
          title: "Print / Save as PDF",
          sub: "Print or save the legal memo formatted for court",
          icon: <Printer size={16} color="var(--text-soft)" />,
          action: () => {
            window.print();
            onClose();
          },
        },
      ],
    },
  ], [onNavigateView, onNavigateTab, onSelectPreset, onClose]);

  const filtered = useMemo(() => {
    return COMMANDS.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.sub.toLowerCase().includes(query.toLowerCase())
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [COMMANDS, query]);

  // Flattened array for keyboard navigation
  const flatItems = useMemo(() => {
    return filtered.flatMap((cat) => cat.items);
  }, [filtered]);

  // Reset selected index when query changes is handled in onChange

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === "Escape" && isOpen) {
        onClose();
      } else if (isOpen && flatItems.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % flatItems.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
        } else if (e.key === "Enter") {
          e.preventDefault();
          const target = flatItems[selectedIndex];
          if (target) target.action();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, flatItems, selectedIndex]);

  // Keep selected item in view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(".palette-item.is-selected");
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Focus restore on close + trap-lite: keep Tab cycling inside the dialog
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    function onTrapKey(e: KeyboardEvent) {
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusables = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onTrapKey);
    return () => {
      window.removeEventListener("keydown", onTrapKey);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  let currentIndex = 0;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div
        ref={modalRef}
        className="command-palette-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Quick command menu"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="palette-input-row">
          <MagnifyingGlass size={18} className="palette-search-icon" />
          <input
            autoFocus
            type="text"
            className="palette-input"
            aria-label="Search quick commands"
            placeholder="Type a command, pick a view, or search a legal topic..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <span className="palette-esc-badge" onClick={onClose}>
            ESC
          </span>
        </div>

        <div className="palette-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="palette-empty">No commands match "{query}"</div>
          ) : (
            filtered.map((cat) => (
              <div key={cat.category} className="palette-group">
                <div className="palette-group-label">{cat.category}</div>
                {cat.items.map((item) => {
                  const isSelected = flatItems[selectedIndex]?.id === item.id;
                  currentIndex++;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`palette-item ${isSelected ? "is-selected" : ""}`}
                      onClick={item.action}
                      onMouseEnter={() => {
                        const idx = flatItems.findIndex((fi) => fi.id === item.id);
                        if (idx >= 0) setSelectedIndex(idx);
                      }}
                    >
                      <span className="item-icon-box">{item.icon}</span>
                      <div className="item-copy">
                        <div className="item-title">{item.title}</div>
                        <div className="item-sub">{item.sub}</div>
                      </div>
                      <ArrowRight size={14} className="item-arrow" />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="palette-footer">
          <span>Move: <kbd>↑</kbd> <kbd>↓</kbd></span>
          <span>Select: <kbd>↵</kbd></span>
          <span>Close: <kbd>Esc</kbd></span>
        </div>
      </div>
    </div>
  );
}
