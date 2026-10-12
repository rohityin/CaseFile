import { useState, useEffect, useRef } from "react";
import {
  Sparkle,
  PaperPlaneTilt,
  CircleNotch,
  Pause,
  Play,
  FileText,
  ShieldCheck,
  ShieldWarning,
  Scales,
  ArrowSquareOut,
  Copy,
  Printer,
  DownloadSimple,
  X,
  Plus,
  Trash,
  CheckCircle,
  Books,
  GitBranch,
  Clock,
  Lightning,
  CirclesThreePlus,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { PrecedentGraph } from "./PrecedentGraph";
import { CircuitSplitVisualizer } from "./CircuitSplitVisualizer";
import { DoctrineTimeline } from "./DoctrineTimeline";
import { CommandPalette } from "./CommandPalette";
import {
  streamAgentChat,
  downloadJson,
  slugifyQuery,
} from "../lib/api";
import type {
  AgentChatMessage,
  AgentThought,
  AgentAction,
  AgentObservation,
  AdversarialMatrix,
  VerifiedCitation,
  IracMemo,
  CaseRecord,
} from "../lib/api";

const PRESET_TOPICS = [
  {
    tag: "Tech Law",
    title: "Trade Secrets & Reverse Engineering",
    prompt:
      "We represent a startup accused of stealing trade secrets under the Defend Trade Secrets Act. The founder legally took apart public software code to see how it works. Find key 9th Circuit rulings that protect reverse engineering, analyze what the other side might argue, and draft our defense brief.",
    court: "ca9",
  },
  {
    tag: "Digital Rights",
    title: "Fourth Amendment & Phone Searches",
    prompt:
      "Look at whether police can search all phones in an area under the Fourth Amendment. Find recent appeals court rulings striking down overly broad digital search warrants, and show how our case is different from cases where police won.",
    court: "ca4",
  },
  {
    tag: "AI Safety",
    title: "AI Training & Copyright Fair Use",
    prompt:
      "Check if collecting public code to train AI counts as Fair Use under copyright law (17 U.S.C. § 107). Find strong past court decisions on fair use (like Google v. Oracle) and explain the risks if the AI hurts sales of the original work.",
    court: "ca2",
  },
  {
    tag: "Tenant Rights",
    title: "Rent Fixing & Tenant Rights",
    prompt:
      "Review tenant claims against landlords who team up to raise rents using pricing software. Find recent court rulings on illegal price-fixing by software and legal protections for tenants.",
    court: "cal",
  },
];

interface SessionData {
  id: string;
  title: string;
  timestamp: string;
  messages: AgentChatMessage[];
  thoughts: AgentThought[];
  actions: AgentAction[];
  observations: AgentObservation[];
  matrix: AdversarialMatrix;
  citations: VerifiedCitation[];
  memo: IracMemo | null;
  cases: CaseRecord[];
}

const SESSIONS_STORAGE_KEY = "casefile:agent_sessions";

interface AgentStudioProps {
  initialPrompt?: string;
  initialCourt?: string;
  externalTab?: "matrix" | "graph" | "split" | "timeline" | "memo" | "citations" | "reader";
  onOpenCommandPalette?: () => void;
}

export function AgentStudio({
  initialPrompt,
  initialCourt,
  externalTab,
  onOpenCommandPalette,
}: AgentStudioProps = {}) {
  // Session State
  const [sessions, setSessions] = useState<SessionData[]>(() => {
    try {
      const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: "session-1",
        title: "Reverse Engineering Defense (Trade Secrets)",
        timestamp: new Date().toLocaleDateString(),
        messages: [],
        thoughts: [],
        actions: [],
        observations: [],
        matrix: { favorable: [], adverse: [] },
        citations: [],
        memo: null,
        cases: [],
      },
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>("session-1");
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // Active Execution State
  const [inputPrompt, setInputPrompt] = useState(initialPrompt || "");
  const [selectedCourt, setSelectedCourt] = useState(initialCourt || "");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string>("Ready");
  const [activeCanvasTab, setActiveCanvasTab] = useState<
    "matrix" | "graph" | "split" | "timeline" | "memo" | "citations" | "reader"
  >(externalTab || "matrix");
  const [readerCase, setReaderCase] = useState<CaseRecord | null>(null);

  useEffect(() => {
    if (initialPrompt?.trim()) {
      setInputPrompt(initialPrompt);
      if (initialCourt) setSelectedCourt(initialCourt);
    }
  }, [initialPrompt, initialCourt]);

  useEffect(() => {
    if (externalTab) {
      setActiveCanvasTab(externalTab);
    }
  }, [externalTab]);
  const [memoAnnotations, setMemoAnnotations] = useState<
    Record<string, { type: "oral" | "distinguish" | "statute"; text: string }>
  >({});

  const handleGenerateAnnotation = (sectionKey: string, type: "oral" | "distinguish" | "statute") => {
    let text = "";
    if (type === "oral") {
      text = `ORAL ARGUMENT TALKING POINT (15 SECONDS): "Your Honors, under Ninth Circuit court rulings like Chicago Lock, anyone who buys a product legally has the right to take it apart to see how it works. The other side cannot turn healthy business competition into stolen secrets when our team acted honestly and bought the item fair and square."`;
    } else if (type === "distinguish") {
      text = `HOW THIS DIFFERS FROM OPPOSING CASES: Cases against us like Comet Technologies (2026) do not apply here. In that case, the company signed a strict agreement promising never to inspect the secret prototype. In our case, we bought the product normally from open sellers without signing any special restriction.`;
    } else {
      text = `WRITTEN LAW: 18 U.S.C. § 1836(b)(3)(B) clearly stops courts from blocking someone from taking a new job, and it protects anyone who figures out the information on their own.`;
    }
    setMemoAnnotations((prev) => ({
      ...prev,
      [sectionKey]: { type, text },
    }));
  };

  const [copySuccess, setCopySuccess] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global Cmd+K / Ctrl+K listener for legal command palette (if not handled by parent)
  useEffect(() => {
    if (onOpenCommandPalette) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenCommandPalette]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatStreamRef = useRef<HTMLDivElement>(null);

  // Sync sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    } catch {
      // ignore
    }
  }, [sessions]);

  // Scroll chat to bottom strictly within the chatStream container (prevents window scrolling)
  useEffect(() => {
    if (chatStreamRef.current) {
      chatStreamRef.current.scrollTo({
        top: chatStreamRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [activeSession.messages, activeSession.thoughts, activeSession.actions]);

  // Helper to update active session
  function updateActiveSession(updater: (prev: SessionData) => SessionData) {
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? updater(s) : s))
    );
  }

  // Create new research thread
  function handleNewSession() {
    const newId = `session-${Date.now()}`;
    const newSession: SessionData = {
      id: newId,
      title: `Research Session ${sessions.length + 1}`,
      timestamp: new Date().toLocaleDateString(),
      messages: [],
      thoughts: [],
      actions: [],
      observations: [],
      matrix: { favorable: [], adverse: [] },
      citations: [],
      memo: null,
      cases: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
  }

  function handleDeleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (sessions.length <= 1) return;
    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);
    if (activeSessionId === id) {
      setActiveSessionId(remaining[0].id);
    }
  }

  // Handle running the agent
  async function handleSend(promptText = inputPrompt) {
    const trimmed = promptText.trim();
    if (!trimmed || running) return;

    setInputPrompt("");
    setRunning(true);
    setPaused(false);
    setCurrentPhase("Starting legal research...");

    const userMessage: AgentChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Auto-title session if it's the first message
    updateActiveSession((prev) => ({
      ...prev,
      title: prev.messages.length === 0 ? trimmed.slice(0, 36) + "..." : prev.title,
      messages: [...prev.messages, userMessage],
    }));

    const ac = new AbortController();
    abortControllerRef.current = ac;

    try {
      const messagesPayload = [...activeSession.messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      await streamAgentChat({
        messages: messagesPayload,
        court: selectedCourt,
        signal: ac.signal,
        onEvent: (event) => {
          if (event.type === "start") {
            setCurrentPhase("Checking court records on CourtListener...");
          } else if (event.type === "thought") {
            const thought = event.data;
            setCurrentPhase(thought.title);
            updateActiveSession((prev) => ({
              ...prev,
              thoughts: [...prev.thoughts, { ...thought, id: `thought-${Date.now()}-${Math.random()}` }],
            }));
          } else if (event.type === "action") {
            const action = event.data;
            setCurrentPhase(`Searching: ${action.tool}`);
            updateActiveSession((prev) => ({
              ...prev,
              actions: [...prev.actions, { ...action, id: `action-${Date.now()}-${Math.random()}` }],
            }));
          } else if (event.type === "observation") {
            const obs = event.data;
            updateActiveSession((prev) => ({
              ...prev,
              observations: [...prev.observations, { ...obs, id: `obs-${Date.now()}-${Math.random()}` }],
            }));
          } else if (event.type === "matrix_update") {
            updateActiveSession((prev) => ({
              ...prev,
              matrix: event.data.matrix,
            }));
            setActiveCanvasTab("matrix");
          } else if (event.type === "citations_verified") {
            updateActiveSession((prev) => ({
              ...prev,
              citations: event.data.citations,
            }));
          } else if (event.type === "memo_ready") {
            updateActiveSession((prev) => ({
              ...prev,
              memo: event.data.memo,
            }));
            setActiveCanvasTab("memo");
          } else if (event.type === "message") {
            const assistantMessage: AgentChatMessage = {
              id: `msg-${Date.now()}`,
              role: "assistant",
              content: event.data.content,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              casesCount: event.data.casesCount,
            };
            updateActiveSession((prev) => ({
              ...prev,
              messages: [...prev.messages, assistantMessage],
            }));
          } else if (event.type === "completed") {
            setCurrentPhase("Research finished");
            updateActiveSession((prev) => ({
              ...prev,
              cases: event.data.cases || prev.cases,
              matrix: event.data.matrix || prev.matrix,
              citations: event.data.citations || prev.citations,
              memo: event.data.memo || prev.memo,
            }));
          } else if (event.type === "error") {
            setCurrentPhase("Something went wrong");
            const errorMessage: AgentChatMessage = {
              id: `msg-${Date.now()}`,
              role: "system",
              content: `⚠️ Something went wrong: ${event.data.message}`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            updateActiveSession((prev) => ({
              ...prev,
              messages: [...prev.messages, errorMessage],
            }));
          }
        },
      });
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        const errStr = (err as Error).message || "Connection terminated.";
        setCurrentPhase("Connection lost");
        updateActiveSession((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: `msg-${Date.now()}`,
              role: "system",
              content: `⚠️ Connection lost: ${errStr}`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ],
        }));
      }
    } finally {
      setRunning(false);
      setCurrentPhase("Ready for your next question");
    }
  }

  function handlePauseResume() {
    if (paused) {
      setPaused(false);
      setCurrentPhase("Resumed research");
    } else {
      setPaused(true);
      setCurrentPhase("Paused");
    }
  }

  function handleStop() {
    abortControllerRef.current?.abort();
    setRunning(false);
    setCurrentPhase("Research stopped");
  }

  function copyMemoMarkdown() {
    if (!activeSession.memo) return;
    const m = activeSession.memo;
    const text = `# ${m.title}\n\n## Quick Overview (Executive Summary)\n${m.executiveSummary}\n\n## The Legal Question\n${m.issue}\n\n## The Main Rules of Law\n${m.rule}\n\n## Applying the Law to Your Facts\n${m.application}\n\n## Answers to the Other Side's Arguments\n${m.counterArguments}\n\n## Final Conclusion & Next Steps\n${m.conclusion}`;
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }

  function handlePrintMemo() {
    window.print();
  }

  function handleDownloadJson() {
    const payload = {
      sessionId: activeSession.id,
      title: activeSession.title,
      exportedAt: new Date().toISOString(),
      messages: activeSession.messages,
      adversarialMatrix: activeSession.matrix,
      citations: activeSession.citations,
      iracMemo: activeSession.memo,
      cases: activeSession.cases,
    };
    downloadJson(`casefile-ai-${slugifyQuery(activeSession.title)}.json`, payload);
  }

  return (
    <div className="agent-studio">
      {/* Fallback Command Palette if not provided by root */}
      {!onOpenCommandPalette && (
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onNavigateTab={(tab) => setActiveCanvasTab(tab)}
          onSelectPreset={(prompt, court) => {
            setInputPrompt(prompt);
            if (court) setSelectedCourt(court);
            void handleSend(prompt);
          }}
        />
      )}

      {/* Main Split-Screen Container */}
      <div className="studio-split">
        {/* LEFT PANEL: Conversational Agent & Thought Stream */}
        <section className="studio-left" aria-label="Agent Conversation & Cognitive Stream">
          {/* Top Session Bar */}
          <div className="studio-bar">
            <div className="session-selector">
              <button
                type="button"
                className="btn btn-secondary btn-sm new-session-btn"
                onClick={handleNewSession}
                title="Start new research scenario"
              >
                <Plus size={14} /> New Session
              </button>
              <div className="session-chips" role="tablist">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    role="tab"
                    tabIndex={0}
                    aria-selected={s.id === activeSessionId}
                    className={`session-chip ${s.id === activeSessionId ? "active" : ""}`}
                    onClick={() => setActiveSessionId(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveSessionId(s.id);
                      }
                    }}
                  >
                    <span className="session-title">{s.title}</span>
                    {sessions.length > 1 && (
                      <button
                        type="button"
                        className="session-delete"
                        aria-label={`Delete session ${s.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(s.id, e);
                        }}
                        title="Delete session"
                      >
                        <Trash size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bar-actions-right">
              <button
                type="button"
                className="btn btn-secondary btn-sm command-trigger-btn"
                onClick={onOpenCommandPalette || (() => setCommandPaletteOpen(true))}
                title="Open Quick Actions (Cmd+K / Ctrl+K)"
              >
                <MagnifyingGlass size={13} />
                <span className="btn-label-desktop">Commands</span>
                <kbd className="cmd-k-kbd">⌘K</kbd>
              </button>
            </div>
          </div>

          {/* Preset Quick Starters */}
          {activeSession.messages.length === 0 && (
            <div className="presets-wrapper">
              <div className="presets-label">
                <Sparkle size={14} weight="fill" /> Recommended Legal Research Scenarios
              </div>
              <div className="preset-grid">
                {PRESET_TOPICS.map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    className="preset-card"
                    onClick={() => {
                      setSelectedCourt(preset.court);
                      void handleSend(preset.prompt);
                    }}
                  >
                    <span className="preset-tag">{preset.tag}</span>
                    <span className="preset-title">{preset.title}</span>
                    <span className="preset-snippet">{preset.prompt.slice(0, 110)}...</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Conversation & ReAct Cognitive Stream */}
          <div className="chat-stream" ref={chatStreamRef}>
            {activeSession.messages.map((msg) => (
              <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                <div className="bubble-header">
                  <span className="bubble-author">
                    {msg.role === "user" ? "You" : "CaseFile Assistant"}
                  </span>
                  <span className="bubble-time">{msg.timestamp}</span>
                </div>
                <div className="bubble-content">{msg.content}</div>
                {msg.casesCount !== undefined && msg.casesCount > 0 && (
                  <div className="bubble-meta">
                    <span className="chip ok">
                      <CheckCircle size={12} /> {msg.casesCount} Court Decisions Read
                    </span>
                  </div>
                )}
              </div>
            ))}

            {/* Live ReAct Monologue (When running or when thoughts exist) */}
            {(running || activeSession.thoughts.length > 0) && (
              <div className="cognitive-terminal">
                <div className="terminal-header">
                  <div className="terminal-indicator">
                    <span className={`pulse-dot ${running ? "live" : ""}`} />
                    <span className="terminal-status">{currentPhase}</span>
                  </div>
                  {running && (
                    <div className="terminal-controls">
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={handlePauseResume}
                        title={paused ? "Resume Agent" : "Pause Agent"}
                      >
                        {paused ? <Play size={14} /> : <Pause size={14} />}
                      </button>
                      <button
                        type="button"
                        className="btn-icon danger"
                        onClick={handleStop}
                        title="Stop Execution"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="terminal-body">
                  {activeSession.thoughts.map((th) => (
                    <div key={th.id} className={`thought-node ${th.phase}`}>
                      <div className="thought-title">
                        <Sparkle size={13} weight="fill" /> {th.title}
                      </div>
                      <div className="thought-detail">{th.detail}</div>
                    </div>
                  ))}

                  {activeSession.actions.map((act) => (
                    <div key={act.id} className="action-node">
                      <span className="action-tool-badge">{act.tool}</span>
                      <span className="action-query">"{act.query}"</span>
                      {act.court && <span className="action-court-badge">{act.court}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Interactive Chat Input & Steering Bar */}
          <div className="studio-input-bar">
            {running && (
              <div className="steering-banner">
                <span>Researching live court records on CourtListener...</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleStop}
                >
                  Stop Research
                </button>
              </div>
            )}

            <form
              className="input-form"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
            >
              <div className="form-row">
                <label htmlFor="agent-prompt" className="sr-only">
                  Ask a legal question or give instructions
                </label>
                <textarea
                  id="agent-prompt"
                  aria-label="Ask a legal question or give instructions"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Ask any legal question, describe your situation, or give next steps..."
                  rows={2}
                  disabled={running}
                />
                <button
                  type="submit"
                  className="btn btn-primary submit-btn"
                  disabled={running || !inputPrompt.trim()}
                >
                  {running ? <CircleNotch size={18} className="spin" /> : <PaperPlaneTilt size={18} />}
                </button>
              </div>

              <div className="input-toolbar">
                <div className="circuit-chips">
                  <span className="circuit-label">Court:</span>
                  {[
                    { label: "All Courts", val: "" },
                    { label: "Supreme Court", val: "scotus" },
                    { label: "9th Circuit", val: "ca9" },
                    { label: "2nd Circuit", val: "ca2" },
                    { label: "California", val: "cal" },
                  ].map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      className={`chip ${selectedCourt === c.val ? "ok" : ""}`}
                      aria-pressed={selectedCourt === c.val}
                      onClick={() => setSelectedCourt(c.val)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="input-hints">
                  <span>Press Shift + Enter for a new line</span>
                </div>
              </div>
            </form>
          </div>
        </section>

        {/* RIGHT PANEL: Dynamic Artifact Canvas */}
        <section className="studio-right" aria-label="Dynamic Legal Artifact Canvas">
          {/* Canvas Navigation Tabs & Export Actions */}
          <div className="canvas-header">
            <div className="canvas-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeCanvasTab === "matrix"}
                className={`canvas-tab ${activeCanvasTab === "matrix" ? "active" : ""}`}
                onClick={() => setActiveCanvasTab("matrix")}
                title="See helpful cases compared against opposing cases"
              >
                <Scales size={15} /> Case Table
                <span className="tab-count">
                  {activeSession.matrix.favorable.length + activeSession.matrix.adverse.length}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeCanvasTab === "graph"}
                className={`canvas-tab ${activeCanvasTab === "graph" ? "active" : ""}`}
                onClick={() => setActiveCanvasTab("graph")}
                title="Visual map connecting related court cases"
              >
                <CirclesThreePlus size={15} weight="bold" /> Case Map
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeCanvasTab === "split"}
                className={`canvas-tab ${activeCanvasTab === "split" ? "active" : ""}`}
                onClick={() => setActiveCanvasTab("split")}
                title="Compare how different federal appeals courts rule"
              >
                <GitBranch size={15} /> Court Disagreements
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeCanvasTab === "timeline"}
                className={`canvas-tab ${activeCanvasTab === "timeline" ? "active" : ""}`}
                onClick={() => setActiveCanvasTab("timeline")}
                title="50-year history of how this legal rule developed"
              >
                <Clock size={15} /> Legal Timeline
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeCanvasTab === "memo"}
                className={`canvas-tab ${activeCanvasTab === "memo" ? "active" : ""}`}
                onClick={() => setActiveCanvasTab("memo")}
                title="Formal legal memo formatted with Issue, Rule, Facts, and Answer"
              >
                <FileText size={15} /> Legal Memo (IRAC)
                {activeSession.memo && <span className="tab-badge">Ready</span>}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeCanvasTab === "citations"}
                className={`canvas-tab ${activeCanvasTab === "citations" ? "active" : ""}`}
                onClick={() => setActiveCanvasTab("citations")}
                title="Official check against real court records"
              >
                <ShieldCheck size={15} /> Verified Sources
                <span className="tab-count">{activeSession.citations.length}</span>
              </button>

              {(readerCase || activeSession.cases.length > 0) && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCanvasTab === "reader"}
                  className={`canvas-tab ${activeCanvasTab === "reader" ? "active" : ""}`}
                  onClick={() => {
                    if (!readerCase && activeSession.cases.length > 0) {
                      setReaderCase(activeSession.cases[0]);
                    }
                    setActiveCanvasTab("reader");
                  }}
                  title="Read the actual words written by the judge"
                >
                  <Books size={15} /> Full Decision
                </button>
              )}
            </div>

            <div className="canvas-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm canvas-action-btn"
                onClick={copyMemoMarkdown}
                disabled={!activeSession.memo}
                title="Copy Memorandum as Text"
              >
                <Copy size={14} />
                <span className="action-btn-label">{copySuccess ? "Copied" : "Copy Text"}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm canvas-action-btn"
                onClick={handlePrintMemo}
                disabled={!activeSession.memo}
                title="Print Formatted Legal Brief"
              >
                <Printer size={14} />
                <span className="action-btn-label">Print / PDF</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm canvas-action-btn"
                onClick={handleDownloadJson}
                disabled={activeSession.messages.length === 0}
                title="Download JSON Research Data"
              >
                <DownloadSimple size={14} />
                <span className="action-btn-label">Export Data</span>
              </button>
            </div>
          </div>

          {/* Canvas Content Area */}
          <div className="canvas-viewport">
            {/* TAB 1: Adversarial Matrix */}
            {activeCanvasTab === "matrix" && (
              <div className="matrix-view">
                <div className="matrix-columns">
                  {/* Favorable Precedents Column */}
                  <div className="matrix-column favorable">
                    <div className="column-head">
                      <h3>
                        <CheckCircle size={16} color="var(--accent)" weight="bold" /> Cases That Support You
                      </h3>
                      <span className="count-tag">
                        {activeSession.matrix.favorable.length} helpful cases
                      </span>
                    </div>
                    {activeSession.matrix.favorable.length === 0 ? (
                      <div className="matrix-empty">
                        <Scales size={32} />
                        <p>No supporting cases yet. Ask a legal question to start researching.</p>
                      </div>
                    ) : (
                      <div className="matrix-cards">
                        {activeSession.matrix.favorable.map((item) => (
                          <div key={item.id} className="case-card favorable-card">
                            <div className="card-top">
                              <h4 className="case-name">{item.title}</h4>
                              <span className="citation-badge">{item.citation}</span>
                            </div>
                            <div className="card-section">
                              <div className="section-label">What The Judge Ruled (Why It Helps):</div>
                              <div className="section-text">{item.holding}</div>
                            </div>
                            <div className="card-section">
                              <div className="section-label">How To Use This In Your Argument:</div>
                              <div className="section-strategy">{item.strategicValue}</div>
                            </div>
                            {item.link && (
                              <div className="card-footer">
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="courtlistener-link"
                                >
                                  View Court Record <ArrowSquareOut size={12} />
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Adverse Precedents Column */}
                  <div className="matrix-column adverse">
                    <div className="column-head">
                      <h3>
                        <ShieldWarning size={16} color="var(--warn)" weight="bold" /> Opposing Cases (The Other Side)
                      </h3>
                      <span className="count-tag">
                        {activeSession.matrix.adverse.length} opposing cases
                      </span>
                    </div>
                    {activeSession.matrix.adverse.length === 0 ? (
                      <div className="matrix-empty">
                        <ShieldWarning size={32} />
                        <p>Arguments the other side might make will show up here as the assistant researches.</p>
                      </div>
                    ) : (
                      <div className="matrix-cards">
                        {activeSession.matrix.adverse.map((item) => (
                          <div key={item.id} className="case-card adverse-card">
                            <div className="card-top">
                              <h4 className="case-name">{item.title}</h4>
                              <span className="citation-badge">{item.citation}</span>
                            </div>
                            <div className="card-section">
                              <div className="section-label">What The Other Side Will Claim:</div>
                              <div className="section-text">{item.opposingArgument}</div>
                            </div>
                            <div className="card-section highlight-distinguish">
                              <div className="section-label">How To Answer Their Argument:</div>
                              <div className="section-strategy">{item.distinguishingStrategy}</div>
                            </div>
                            {item.link && (
                              <div className="card-footer">
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="courtlistener-link"
                                >
                                  View Court Record <ArrowSquareOut size={12} />
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Precedent Network Graph */}
            {activeCanvasTab === "graph" && (
              <PrecedentGraph
                favorable={activeSession.matrix.favorable}
                adverse={activeSession.matrix.adverse}
                citations={activeSession.citations}
                onSelectCase={(title) => {
                  const match = activeSession.cases.find((c) => {
                    const cTitle = c.Title || (c as unknown as { title?: string }).title || "";
                    return cTitle.toLowerCase().includes(title.toLowerCase());
                  });
                  if (match) {
                    setReaderCase(match);
                    setActiveCanvasTab("reader");
                  }
                }}
              />
            )}

            {/* TAB 3: Circuit Split Matrix */}
            {activeCanvasTab === "split" && <CircuitSplitVisualizer />}

            {/* TAB 4: Doctrine Timeline */}
            {activeCanvasTab === "timeline" && <DoctrineTimeline />}

            {/* TAB 5: IRAC Memorandum (Court Pleading Paper + Inline Co-Counsel Tools) */}
            {activeCanvasTab === "memo" && (
              <div className="memo-view printable-memo">
                {!activeSession.memo ? (
                  <div className="memo-empty">
                    <FileText size={42} />
                    <h3>No Legal Memo Created Yet</h3>
                    <p>Ask a question in the chat box on the left, and the assistant will write a complete legal memo for you.</p>
                  </div>
                ) : (
                  <article className="memo-document">
                    {/* Left Line Numbers 1 to 28 (Federal Pleading Paper Standard) */}
                    <div className="pleading-margin-numbers" aria-hidden>
                      {Array.from({ length: 28 }, (_, i) => (
                        <span key={i + 1} className="pleading-line-num">
                          {i + 1}
                        </span>
                      ))}
                    </div>

                    <div className="pleading-content-body">
                      <header className="memo-head">
                        <div className="memo-crest">IN THE UNITED STATES COURT OF APPEALS</div>
                        <h1 className="memo-title">{activeSession.memo.title}</h1>
                        <div className="memo-meta-grid">
                          <div><strong>DATE:</strong> {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</div>
                          <div><strong>AUTHOR:</strong> CaseFile Research Assistant</div>
                          <div><strong>COURT:</strong> {selectedCourt ? selectedCourt.toUpperCase() : "Federal Appeals Court"}</div>
                          <div><strong>SOURCES:</strong> Checked Against Real Court Records</div>
                        </div>
                      </header>

                      {/* Section 1: Executive Summary */}
                      <section className="memo-section">
                        <div className="section-head-bar">
                          <h2 className="section-heading">I. QUICK OVERVIEW (SUMMARY)</h2>
                          <div className="co-counsel-pills">
                            <button
                              type="button"
                              className="co-counsel-pill"
                              onClick={() => handleGenerateAnnotation("summary", "oral")}
                              title="Generate 15-Second Talking Point"
                            >
                              <Lightning size={12} weight="fill" /> 15-Sec Talking Point
                            </button>
                            <button
                              type="button"
                              className="co-counsel-pill"
                              onClick={() => handleGenerateAnnotation("summary", "statute")}
                              title="Link Written Law"
                            >
                              <Scales size={12} weight="fill" /> Key Law
                            </button>
                          </div>
                        </div>
                        <div className="section-prose">{activeSession.memo.executiveSummary}</div>
                        {memoAnnotations["summary"] && (
                          <aside className={`annotation-callout ${memoAnnotations["summary"].type}`}>
                            <div className="callout-head">
                              <span className="callout-tag">
                                {memoAnnotations["summary"].type === "oral"
                                  ? "⚡ 15-Second Talking Point for the Judges"
                                  : "⚖️ Written Law (Statute)"}
                              </span>
                              <button
                                type="button"
                                className="callout-dismiss"
                                onClick={() => {
                                  const n = { ...memoAnnotations };
                                  delete n["summary"];
                                  setMemoAnnotations(n);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="callout-body">{memoAnnotations["summary"].text}</div>
                          </aside>
                        )}
                      </section>

                      {/* Section 2: Statement of Issue */}
                      <section className="memo-section">
                        <div className="section-head-bar">
                          <h2 className="section-heading">II. THE LEGAL QUESTION</h2>
                        </div>
                        <div className="section-prose">{activeSession.memo.issue}</div>
                      </section>

                      {/* Section 3: Controlling Legal Rules */}
                      <section className="memo-section">
                        <div className="section-head-bar">
                          <h2 className="section-heading">III. THE MAIN RULES OF LAW</h2>
                          <div className="co-counsel-pills">
                            <button
                              type="button"
                              className="co-counsel-pill"
                              onClick={() => handleGenerateAnnotation("rule", "statute")}
                            >
                              <Scales size={12} weight="fill" /> 18 U.S.C. § 1836 Note
                            </button>
                          </div>
                        </div>
                        <div className="section-prose">{activeSession.memo.rule}</div>
                        {memoAnnotations["rule"] && (
                          <aside className="annotation-callout statute">
                            <div className="callout-head">
                              <span className="callout-tag">⚖️ Written Law (Statute)</span>
                              <button
                                type="button"
                                className="callout-dismiss"
                                onClick={() => {
                                  const n = { ...memoAnnotations };
                                  delete n["rule"];
                                  setMemoAnnotations(n);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="callout-body">{memoAnnotations["rule"].text}</div>
                          </aside>
                        )}
                      </section>

                      {/* Section 4: Application */}
                      <section className="memo-section">
                        <div className="section-head-bar">
                          <h2 className="section-heading">IV. APPLYING THE LAW TO YOUR FACTS</h2>
                          <div className="co-counsel-pills">
                            <button
                              type="button"
                              className="co-counsel-pill"
                              onClick={() => handleGenerateAnnotation("app", "oral")}
                            >
                              <Lightning size={12} weight="fill" /> Judge's Question Prep
                            </button>
                          </div>
                        </div>
                        <div className="section-prose">{activeSession.memo.application}</div>
                        {memoAnnotations["app"] && (
                          <aside className="annotation-callout oral">
                            <div className="callout-head">
                              <span className="callout-tag">⚡ How to Answer the Judge's Question</span>
                              <button
                                type="button"
                                className="callout-dismiss"
                                onClick={() => {
                                  const n = { ...memoAnnotations };
                                  delete n["app"];
                                  setMemoAnnotations(n);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="callout-body">{memoAnnotations["app"].text}</div>
                          </aside>
                        )}
                      </section>

                      {/* Section 5: Counter-arguments & Rebuttal */}
                      <section className="memo-section">
                        <div className="section-head-bar">
                          <h2 className="section-heading">V. ANSWERS TO THE OTHER SIDE'S ARGUMENTS</h2>
                          <div className="co-counsel-pills">
                            <button
                              type="button"
                              className="co-counsel-pill"
                              onClick={() => handleGenerateAnnotation("counter", "distinguish")}
                            >
                              <ShieldWarning size={12} weight="fill" /> How Our Case Differs
                            </button>
                          </div>
                        </div>
                        <div className="section-prose">{activeSession.memo.counterArguments}</div>
                        {memoAnnotations["counter"] && (
                          <aside className="annotation-callout distinguish">
                            <div className="callout-head">
                              <span className="callout-tag">🛡️ Why the Other Side's Cases Do Not Apply</span>
                              <button
                                type="button"
                                className="callout-dismiss"
                                onClick={() => {
                                  const n = { ...memoAnnotations };
                                  delete n["counter"];
                                  setMemoAnnotations(n);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="callout-body">{memoAnnotations["counter"].text}</div>
                          </aside>
                        )}
                      </section>

                      {/* Section 6: Conclusion */}
                      <section className="memo-section">
                        <div className="section-head-bar">
                          <h2 className="section-heading">VI. CONCLUSION &amp; WHAT TO DO NEXT</h2>
                        </div>
                        <div className="section-prose">{activeSession.memo.conclusion}</div>
                      </section>
                    </div>
                  </article>
                )}
              </div>
            )}

            {/* TAB 3: Verified Citations Audit */}
            {activeCanvasTab === "citations" && (
              <div className="citations-view">
                <div className="citations-intro">
                  <div className="intro-title">
                    <ShieldCheck size={20} color="var(--accent)" weight="bold" /> Fact-Checked Court Citations
                  </div>
                  <p>
                    Every court case found by CaseFile AI is checked directly against official court records on CourtListener.
                    Fake or unverified case citations are flagged immediately so you can trust every single source.
                  </p>
                </div>

                {activeSession.citations.length === 0 ? (
                  <div className="citations-empty">
                    <ShieldCheck size={36} />
                    <p>No case sources checked yet. Ask a legal question to research real court records.</p>
                  </div>
                ) : (
                  <div className="citations-grid">
                    {activeSession.citations.map((cite) => (
                      <div key={cite.id} className={`citation-card ${cite.status}`}>
                        <div className="cite-badge-row">
                          {cite.status === "verified" && (
                            <span className="guardrail-badge verified">
                              🟢 Verified Official Court Record
                            </span>
                          )}
                          {cite.status === "partial" && (
                            <span className="guardrail-badge partial">
                              🟡 Partial Match / Needs Review
                            </span>
                          )}
                          {cite.status === "unverified" && (
                            <span className="guardrail-badge flagged">
                              🔴 Unverified / Not Found in Court Records
                            </span>
                          )}
                          <span className="cite-court">{cite.court}</span>
                        </div>

                        <h4 className="cite-title">{cite.caseTitle}</h4>
                        <div className="cite-citation-text">{cite.citation}</div>

                        <div className="cite-footer">
                          {cite.dateFiled && <span>Filed: {cite.dateFiled}</span>}
                          {cite.link && (
                            <a
                              href={cite.link}
                              target="_blank"
                              rel="noreferrer"
                              className="cite-link"
                            >
                              View Court Record <ArrowSquareOut size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Opinion Reader */}
            {activeCanvasTab === "reader" && (
              (() => {
                const cur = readerCase || activeSession.cases[0];
                if (!cur) {
                  return (
                    <div className="opinion-reader-empty">
                      <Books size={40} color="var(--accent)" />
                      <h4>No Court Decision Selected Yet</h4>
                      <p>
                        Ask a legal question or click on any case in the Case Table or Case Map to read the full decision written by the judge.
                      </p>
                    </div>
                  );
                }
                const caseTitle = cur.Title || (cur as unknown as { title?: string }).title || "Untitled Case";
                const caseLink = cur.Link || (cur as unknown as { link?: string }).link;
                return (
                  <div className="reader-view">
                    <div className="reader-header">
                      <div>
                        <h2>{caseTitle}</h2>
                        <div className="reader-meta">
                          {cur.court && <span className="chip">{cur.court}</span>}
                          {cur.dateFiled && <span className="chip">{cur.dateFiled}</span>}
                          {cur.citation?.[0] && <span className="chip">{cur.citation[0]}</span>}
                        </div>
                      </div>
                      {caseLink && (
                        <a
                          href={caseLink}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-sm"
                        >
                          CourtListener <ArrowSquareOut size={14} />
                        </a>
                      )}
                    </div>
                    <div className="reader-body">
                      <pre className="opinion-text">
                        {cur.opinionText || cur.snippet || "No decision text found for this case."}
                      </pre>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
