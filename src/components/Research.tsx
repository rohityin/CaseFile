import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  MagnifyingGlass,
  DownloadSimple,
  BracketsCurly,
  ArrowSquareOut,
  CircleNotch,
  Copy,
  X,
  Stack,
  FileText,
  Sparkle,
  Scales,
  BookmarkSimple,
  Lightning,
} from "@phosphor-icons/react";
import {
  downloadJson,
  enrichCases,
  exportSchema,
  extractCases,
  searchCases,
  slugifyQuery,
} from "../lib/api";
import type { CaseRecord } from "../lib/api";

interface ResearchProps {
  initialQuery: string;
  onStartAgent?: (prompt: string, court?: string) => void;
}

const JURISDICTION_CHIPS = [
  { id: "", label: "All Courts" },
  { id: "scotus", label: "Supreme Court" },
  { id: "ca9", label: "9th Circuit (Tech & IP)" },
  { id: "ca2", label: "2nd Circuit (NY & Business)" },
  { id: "cal", label: "California Supreme Court" },
];

export function Research({ initialQuery, onStartAgent }: ResearchProps) {
  const [query, setQuery] = useState(initialQuery || "");
  const [selectedJurisdiction, setSelectedJurisdiction] = useState("");
  const [results, setResults] = useState<CaseRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Connected to CourtListener Court Records");
  const [jsonOpen, setJsonOpen] = useState(false);
  const [copiedCite, setCopiedCite] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [detailTab, setDetailTab] = useState<"text" | "headnotes" | "docket">("text");
  const [fontChoice, setFontChoice] = useState<"serif" | "mono" | "sans">("serif");

  const abortRef = useRef<AbortController | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reduce = useReducedMotion();

  const selected = useMemo(
    () => results.find((r) => r.Id === selectedId) || null,
    [results, selectedId]
  );

  const runSearch = useCallback(async (q: string, courtOverride = selectedJurisdiction) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);
    setStatus(`Searching court records for "${trimmed}"...`);
    setExtractProgress(0);

    try {
      const data = await searchCases(trimmed, {
        court: courtOverride || undefined,
        pageSize: 18,
        signal: ac.signal,
      });
      setResults(data.results);
      setTotal(data.count);
      setSelectedId(data.results[0]?.Id ?? null);
      setStatus(
        data.count
          ? `${data.count.toLocaleString()} court decisions found • Showing top ${data.results.length}`
          : "No court decisions matched your search."
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message || "Search failed");
      setStatus("Search failed. Please try again.");
      setResults([]);
      setSelectedId(null);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [selectedJurisdiction]);

  useEffect(() => {
    if (initialQuery.trim()) {
      setQuery(initialQuery);
      void runSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  // Modal keyboard controls
  useEffect(() => {
    if (!jsonOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setJsonOpen(false);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [jsonOpen]);

  // Keep selected item in view
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>(".case-item.is-active");
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  // Arrow key navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!results.length || jsonOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const idx = results.findIndex((r) => r.Id === selectedId);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIdx = idx < 0 ? 0 : Math.min(results.length - 1, idx + 1);
        const next = results[nextIdx];
        if (next) setSelectedId(next.Id);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = results[Math.max(0, (idx < 0 ? 0 : idx) - 1)];
        if (prev) setSelectedId(prev.Id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [results, selectedId, jsonOpen]);

  async function handleExtract() {
    if (!results.length || extracting || enriching) return;
    setExtracting(true);
    setError(null);
    setExtractProgress(0.15);
    setStatus("Downloading full decision text from CourtListener...");

    const tick = window.setInterval(() => {
      setExtractProgress((p) => Math.min(0.92, p + 0.08));
    }, 350);

    try {
      const data = await extractCases(results);
      setExtractProgress(1);

      const byId = new Map(data.cases.map((c) => [c.Id, c]));
      setResults((prev) =>
        prev.map((r) => {
          const ex = byId.get(r.Id);
          if (!ex) return r;
          return {
            ...r,
            opinionText: ex.opinionText,
            textSource: ex.textSource,
            extracted: ex.extracted,
          };
        })
      );
      setStatus(`Loaded full text for ${data.count} case${data.count === 1 ? "" : "s"}.`);
    } catch (err) {
      setError((err as Error).message || "Extract failed");
      setStatus("Could not load full text. Please try again.");
    } finally {
      window.clearInterval(tick);
      setExtracting(false);
      window.setTimeout(() => setExtractProgress(0), 800);
    }
  }

  async function handleEnrich() {
    if (!results.length || enriching || extracting) return;
    setEnriching(true);
    setError(null);
    setStatus("Writing AI case summaries and key takeaways with Nebius Token Factory...");

    try {
      const data = await enrichCases(results);
      if (data.mode === "disabled") {
        setStatus(data.detail || "AI summaries are not configured on the server.");
        return;
      }

      const byId = new Map(data.cases.map((c) => [c.Id, c]));
      setResults((prev) =>
        prev.map((r) => {
          const ex = byId.get(r.Id);
          if (!ex || !ex.enriched) return r;
          return {
            ...r,
            court: ex.court || r.court,
            summary: ex.summary,
            jurisdiction: ex.jurisdiction,
            outcome: ex.outcome,
            precedents: ex.precedents,
            enriched: true,
          };
        })
      );
      const done = data.cases.filter((c) => c.enriched).length;
      setStatus(`Created AI summaries for ${done} court cases.`);
    } catch (err) {
      setError((err as Error).message || "Enrich failed");
      setStatus("Could not create AI summaries. Please try again.");
    } finally {
      setEnriching(false);
    }
  }

  function handleDownloadAll() {
    if (!results.length) return;
    const payload = {
      query,
      jurisdiction: selectedJurisdiction || "all",
      exportedAt: new Date().toISOString(),
      count: results.length,
      cases: exportSchema(results),
    };
    downloadJson(`casefile-desk-${slugifyQuery(query)}.json`, payload);
  }

  function handleDownloadOne() {
    if (!selected) return;
    downloadJson(`case-${selected.Id}.json`, exportSchema([selected])[0]);
  }

  const bluebookCitation = useMemo(() => {
    if (!selected) return "";
    const cite = selected.citation?.[0] || selected.docketNumber || `Docket ${selected.Id}`;
    const year = selected.dateFiled ? new Date(selected.dateFiled).getFullYear() : "";
    const court = selected.court ? selected.court.replace("United States Court of Appeals for the ", "").replace("Court of Appeals", "Cir.") : "";
    return `${selected.Title}, ${cite} (${court}${year ? ` ${year}` : ""})`;
  }, [selected]);

  async function copyBluebook() {
    if (!bluebookCitation) return;
    try {
      await navigator.clipboard.writeText(bluebookCitation);
      setCopiedCite(true);
      window.setTimeout(() => setCopiedCite(false), 1600);
    } catch {
      setError("Could not copy citation");
    }
  }

  const jsonPreview = useMemo(() => {
    return JSON.stringify(
      {
        query,
        count: results.length,
        cases: exportSchema(results),
      },
      null,
      2
    );
  }, [query, results]);

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(jsonPreview);
      setCopiedJson(true);
      window.setTimeout(() => setCopiedJson(false), 1600);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  function handleEscalateToAgent() {
    if (!onStartAgent) return;
    const prompt = selected
      ? `Research ${selected.Title} (${selected.citation?.[0] || "case"}). Build our legal argument, find opposing cases from the other side, and write a full legal memo.`
      : query;
    const court = selected?.courtId || selected?.court || selectedJurisdiction || undefined;
    onStartAgent(prompt, court);
  }

  return (
    <div className="workspace desk-redesign">
      {/* Executive Research Command Bar */}
      <div className="research-command-bar">
        <div className="command-bar-main">
          {/* Query Search Form */}
          <form
            className="search-field research-search-box"
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch(query);
            }}
          >
            <MagnifyingGlass size={18} className="search-box-icon" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any legal topic or case, e.g. trade secrets or fair use"
              aria-label="Search court cases and legal topics"
            />
            {query && (
              <button
                type="button"
                className="btn-icon"
                onClick={() => setQuery("")}
                title="Clear input"
              >
                <X size={14} />
              </button>
            )}
            <button type="submit" className="btn btn-primary search-submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <CircleNotch size={15} className="spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>Search</span>
                  <kbd className="cmd-k-kbd">↵</kbd>
                </>
              )}
            </button>
          </form>

          {/* Action Tools */}
          <div className="workspace-tools">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleExtract()}
              disabled={!results.length || extracting || enriching || loading}
              title="Get full decision text written by judges"
            >
              {extracting ? <CircleNotch size={14} className="spin" /> : <Stack size={14} />}
              <span>Get Full Text</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleEnrich()}
              disabled={!results.length || enriching || extracting || loading}
              title="Generate AI summaries and key takeaways"
            >
              {enriching ? <CircleNotch size={14} className="spin" /> : <Sparkle size={14} weight="fill" />}
              <span>AI Summary</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setJsonOpen(true)}
              disabled={!results.length}
              title="View raw data (JSON)"
            >
              <BracketsCurly size={14} />
              <span>View Data</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadAll}
              disabled={!results.length}
              title="Download research results"
            >
              <DownloadSimple size={14} />
              <span>Export</span>
            </button>

            {onStartAgent && (
              <button
                type="button"
                className="btn btn-solid btn-sm agent-escalate-btn"
                onClick={handleEscalateToAgent}
                title="Open this case in the AI Legal Studio"
              >
                <Sparkle size={14} weight="fill" />
                <span>Open in AI Studio</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-bar: Jurisdiction Filters & Status */}
        <div className="command-bar-sub">
          <div className="jurisdiction-pills">
            <span className="pills-label">Court:</span>
            {JURISDICTION_CHIPS.map((chip) => {
              const isSelected = selectedJurisdiction === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  className={`jurisdiction-chip ${isSelected ? "active" : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedJurisdiction(chip.id);
                    if (query.trim()) void runSearch(query, chip.id);
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          <div className={`status-bar-tag ${error ? "error" : ""}`} role="status">
            <span className="status-indicator-dot" />
            <span>{error || status}</span>
          </div>
        </div>

        {/* Extraction Progress Bar */}
        {(extracting || extractProgress > 0) && (
          <div className="extract-progress">
            <span>Loading Full Decisions ({Math.round(extractProgress * 100)}%)</span>
            <div className="bar" aria-hidden>
              <span style={{ transform: `scaleX(${extractProgress || 0.05})` }} />
            </div>
          </div>
        )}
      </div>

      {/* Main Split Layout: Left Cases Docket | Right Judicial Slip Inspector */}
      <div className="workspace-body">
        {/* LEFT PANEL: Case Dockets List */}
        <section className="panel panel-cases" aria-label="Case dockets">
          <div className="panel-head">
            <div className="panel-title-row">
              <Scales size={16} color="var(--accent)" />
              <h2>Court Cases</h2>
            </div>
            <span className="count-badge">
              {loading ? "Searching..." : `${results.length}${total ? ` of ${total.toLocaleString()}` : ""}`}
            </span>
          </div>

          {loading && (
            <div className="skeleton-list" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skel" />
              ))}
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="empty-state">
              <Scales size={42} color="var(--text-mute)" />
              <h3>No Cases Found</h3>
              <p>Search a legal topic or pick a court above to find real decisions.</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <ul className="case-list docket-list" ref={listRef}>
              {results.map((c, i) => {
                const isActive = selectedId === c.Id;
                return (
                  <li key={c.Id || i}>
                    <button
                      type="button"
                      className={`case-item docket-card ${isActive ? "is-active" : ""}`}
                      onClick={() => setSelectedId(c.Id)}
                    >
                      <div className="docket-top">
                        <span className="docket-court">{c.court || "Federal Appeals Court"}</span>
                        {c.dateFiled && <span className="docket-date">{c.dateFiled}</span>}
                      </div>

                      <h3 className="docket-case-title">{c.Title}</h3>

                      <div className="docket-meta-row">
                        {c.citation?.[0] ? (
                          <span className="cite-pill">{c.citation[0]}</span>
                        ) : c.docketNumber ? (
                          <span className="cite-pill">Case #{c.docketNumber}</span>
                        ) : null}

                        {c.extracted ? (
                          <span className="badge-ok">🟢 Full Text</span>
                        ) : (
                          <span className="badge-partial">🟡 Summary Only</span>
                        )}

                        {c.enriched && <span className="badge-enriched">⚡ AI Summary</span>}
                      </div>

                      {c.snippet && <p className="snippet docket-snippet">{c.snippet}</p>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* RIGHT PANEL: Authoritative Judicial Slip Opinion & Headnotes */}
        <section className="panel panel-detail" aria-label="Court Decision Viewer">
          <div className="panel-head detail-head-bar">
            <div className="detail-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === "text"}
                className={`canvas-tab ${detailTab === "text" ? "active" : ""}`}
                onClick={() => setDetailTab("text")}
              >
                <FileText size={15} /> Decision Text
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === "headnotes"}
                className={`canvas-tab ${detailTab === "headnotes" ? "active" : ""}`}
                onClick={() => setDetailTab("headnotes")}
              >
                <Sparkle size={15} weight="fill" /> AI Summary
                {selected?.enriched && <span className="tab-badge">Ready</span>}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === "docket"}
                className={`canvas-tab ${detailTab === "docket" ? "active" : ""}`}
                onClick={() => setDetailTab("docket")}
              >
                <BookmarkSimple size={15} /> Court Details
              </button>
            </div>

            {selected && (
              <div className="detail-head-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={copyBluebook}
                  title="Copy official case citation"
                >
                  <Copy size={13} />
                  <span>{copiedCite ? "Copied Citation" : "Copy Citation"}</span>
                </button>

                {onStartAgent && (
                  <button
                    type="button"
                    className="btn btn-solid btn-sm"
                    onClick={handleEscalateToAgent}
                    title="Analyze this case in AI Legal Studio"
                  >
                    <Lightning size={13} weight="fill" />
                    <span>Open in AI Studio</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {!selected && (
              <motion.div
                key="empty"
                className="empty-state"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
              >
                <FileText size={48} color="var(--text-mute)" />
                <h3>No Case Selected</h3>
                <p>Click on any court case from the list on the left to read the full decision and AI summary.</p>
              </motion.div>
            )}

            {selected && (
              <motion.div
                key={selected.Id}
                className="detail judicial-detail"
                initial={reduce ? false : { opacity: 1, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 1 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Judicial Opinion Header */}
                <header className="judicial-slip-header">
                  <div className="court-masthead">
                    {selected.court || "UNITED STATES COURT OF APPEALS"}
                  </div>
                  <h2 className="judicial-caption-title">{selected.Title}</h2>

                  <div className="judicial-meta-grid">
                    <div className="meta-col">
                      <span className="meta-label">CITATION:</span>
                      <span className="meta-val font-mono">{selected.citation?.[0] || "Unreported / Docket Record"}</span>
                    </div>
                    <div className="meta-col">
                      <span className="meta-label">DATE DECIDED:</span>
                      <span className="meta-val">{selected.dateFiled || "Pending Judgment"}</span>
                    </div>
                    <div className="meta-col">
                      <span className="meta-label">CASE NUMBER:</span>
                      <span className="meta-val font-mono">{selected.docketNumber || selected.Id}</span>
                    </div>
                    <div className="meta-col">
                      <span className="meta-label">COURT:</span>
                      <span className="meta-val">{selected.jurisdiction || selected.court || "Federal Appeals Court"}</span>
                    </div>
                  </div>
                </header>

                {/* TAB 1: Opinion Text */}
                {detailTab === "text" && (
                  <div className="opinion-tab-content">
                    <div className="text-toolbar">
                      <div className="typography-toggles">
                        <span className="toggle-label">Font:</span>
                        <button
                          type="button"
                          className={`btn-toggle ${fontChoice === "serif" ? "active" : ""}`}
                          onClick={() => setFontChoice("serif")}
                        >
                          Serif
                        </button>
                        <button
                          type="button"
                          className={`btn-toggle ${fontChoice === "sans" ? "active" : ""}`}
                          onClick={() => setFontChoice("sans")}
                        >
                          Sans
                        </button>
                        <button
                          type="button"
                          className={`btn-toggle ${fontChoice === "mono" ? "active" : ""}`}
                          onClick={() => setFontChoice("mono")}
                        >
                          Mono
                        </button>
                      </div>

                      <div className="text-stats">
                        <span>
                          {selected.opinionText
                            ? `${selected.opinionText.split(/\s+/).length.toLocaleString()} words`
                            : "Summary record"}
                        </span>
                      </div>
                    </div>

                    <div className={`opinion-text-body font-${fontChoice}`}>
                      {selected.opinionText ||
                        selected.snippet ||
                        "Full decision text has not been loaded yet. Click 'Get Full Text' in the top bar to download the complete opinion."}
                    </div>
                  </div>
                )}

                {/* TAB 2: AI Headnotes & Case Synthesis */}
                {detailTab === "headnotes" && (
                  <div className="headnotes-tab-content">
                    {!selected.enriched && !selected.summary ? (
                      <div className="headnotes-empty">
                        <Sparkle size={36} color="var(--accent)" />
                        <h4>No AI Summary Generated Yet</h4>
                        <p>
                          Click the <strong>AI Summary</strong> button above to have AI
                          summarize the core question, what the judge ruled, and the main cases cited.
                        </p>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => void handleEnrich()}
                          disabled={enriching}
                        >
                          {enriching ? <CircleNotch size={14} className="spin" /> : <Sparkle size={14} weight="fill" />}
                          Generate AI Summary Now
                        </button>
                      </div>
                    ) : (
                      <div className="headnotes-body">
                        <div className="headnote-card">
                          <div className="headnote-tag">Main Legal Question &amp; Ruling</div>
                          <div className="headnote-text">{selected.summary}</div>
                        </div>

                        {selected.outcome && (
                          <div className="headnote-card">
                            <div className="headnote-tag">Court Judgment &amp; Outcome</div>
                            <div className="headnote-text">{selected.outcome}</div>
                          </div>
                        )}

                        {selected.precedents && selected.precedents.length > 0 && (
                          <div className="headnote-card">
                            <div className="headnote-tag">Important Past Cases Cited</div>
                            <div className="precedent-chips-list">
                              {selected.precedents.map((p) => (
                                <span key={p} className="chip">
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: Docket & Record Info */}
                {detailTab === "docket" && (
                  <div className="docket-tab-content">
                    <div className="docket-info-card">
                      <h4>Official Court Record Details</h4>
                      <p>
                        This case record comes directly from CourtListener's public database of court decisions.
                      </p>

                      <div className="docket-fields-table">
                        <div className="df-row">
                          <span className="df-label">Case Record ID</span>
                          <span className="df-val font-mono">{selected.Id}</span>
                        </div>
                        <div className="df-row">
                          <span className="df-label">Court Name</span>
                          <span className="df-val">{selected.court}</span>
                        </div>
                        <div className="df-row">
                          <span className="df-label">Date Decided</span>
                          <span className="df-val">{selected.dateFiled}</span>
                        </div>
                        <div className="df-row">
                          <span className="df-label">Official Legal Citation</span>
                          <span className="df-val font-mono">{bluebookCitation}</span>
                        </div>
                      </div>

                      <div className="docket-external-actions">
                        {selected.Link && (
                          <a
                            href={selected.Link}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            View on CourtListener <ArrowSquareOut size={13} />
                          </a>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleDownloadOne}
                        >
                          <DownloadSimple size={13} /> Download Case Data
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* JSON Inspector Modal */}
      <AnimatePresence>
        {jsonOpen && (
          <motion.div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="json-modal-title"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            onClick={() => setJsonOpen(false)}
          >
            <motion.div
              ref={modalRef}
              className="modal modal-lg json-modal"
              tabIndex={-1}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-head">
                <h2 id="json-modal-title">
                  <BracketsCurly size={18} /> Case Data ({results.length} cases)
                </h2>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setJsonOpen(false)}
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="modal-body">
                <pre className="json-code">
                  <code>{jsonPreview}</code>
                </pre>
              </div>

              <div className="modal-foot">
                <button type="button" className="btn btn-secondary" onClick={() => void copyJson()}>
                  <Copy size={14} />
                  {copiedJson ? "Copied!" : "Copy JSON"}
                </button>
                <button type="button" className="btn btn-primary" onClick={handleDownloadAll}>
                  <DownloadSimple size={14} />
                  Download Data (JSON)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
