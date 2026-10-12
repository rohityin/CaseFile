import { useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import {
  MagnifyingGlass,
  FileArrowDown,
  Stack,
  ArrowRight,
  CaretLeft,
  CaretRight,
  Sparkle,
  ShieldCheck,
  Scales,
  CheckCircle,
  ShieldWarning,
  Lightning,
  Books,
  GitBranch,
  FileText,
} from "@phosphor-icons/react";
import { CardStack } from "./gsap/CardStack";

const PRESET_CARDS = [
  {
    tag: "Tech & IP",
    title: "Taking Apart Code & Trade Secrets",
    query: "DTSA trade secret reverse engineering defense",
    court: "ca9",
    snippet: "Can a company take apart a product to learn how it works? 9th Circuit rules on clean-room reverse engineering.",
  },
  {
    tag: "Constitutional",
    title: "Police Phone-Location Search Warrants",
    query: "Fourth Amendment warrantless geofence warrants",
    court: "scotus",
    snippet: "Are broad police geofence search warrants for phone locations legal under the Fourth Amendment?",
  },
  {
    tag: "AI & Copyright",
    title: "Training AI Models & Fair Use",
    query: "AI model training copyright fair use",
    court: "ca2",
    snippet: "Is using copyrighted books and art to train AI programs protected as transformative fair use?",
  },
  {
    tag: "Fair Competition",
    title: "Apartment Price-Fixing Software",
    query: "Tenant rights against algorithmic rent fixing",
    court: "fed",
    snippet: "Do landlords break antitrust laws when they all use the same pricing software to set rent prices?",
  },
];

const QUOTES = [
  {
    text: "CaseFile AI found the exact cases the other side was planning to use. We were ready with strong answers before oral argument.",
    name: "Maya Ortiz",
    role: "Appeals lawyer, 9th Circuit",
  },
  {
    text: "Zero fake cases is what makes this so trustworthy. Knowing every citation is verified against real court dockets gives us total confidence.",
    name: "Priya Nandakumar",
    role: "Law professor and court advocate",
  },
  {
    text: "Having an AI assistant research cases, summarize rulings, and draft a first legal memo saved our team 6 hours on every brief.",
    name: "Jonah Ellison",
    role: "Senior trial lawyer",
  },
];

const PIPELINE_STAGES = [
  {
    step: "01",
    tag: "Break Down Problem",
    title: "Understand the Legal Question",
    body: "The assistant breaks down your question into key laws and court rules, looking for majority standards and court disagreements.",
    img: "/assets/workspace.jpg",
    widgetTitle: "Searches Run",
    chips: ["18 U.S.C. § 1836", "Defend Trade Secrets", "9th Circuit Rule"],
  },
  {
    step: "02",
    tag: "Compare Both Sides",
    title: "Match Helpful & Opposing Cases",
    body: "Cases are sorted into two columns: decisions that help your argument, and opposing cases with tips on how to answer them.",
    img: "/assets/panel.jpg",
    widgetTitle: "Cases Organized",
    chips: ["Helpful Decisions (4)", "Opposing Answers (2)", "Key Citations"],
  },
  {
    step: "03",
    tag: "Verify & Write",
    title: "Check Citations & Write Legal Memo",
    body: "Drafts a clear 28-line legal memo on numbered court paper, checking every cited court case against real records.",
    img: "/assets/appellate-desk.jpg",
    widgetTitle: "Court Check",
    chips: ["Lines 1–28 Checked", "Real Court Records", "Zero Fake Cases"],
  },
];

interface LandingProps {
  onStartResearch: (query: string) => void;
  onStartAgent: (prompt?: string, court?: string) => void;
}

export function Landing({ onStartResearch, onStartAgent }: LandingProps) {
  const [q, setQ] = useState("DTSA trade secret reverse engineering defense");
  const [showcaseTab, setShowcaseTab] = useState<"matrix" | "pleading" | "citations">("matrix");
  const [openSlice, setOpenSlice] = useState(0);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const reduce = useReducedMotion();

  function launchAgent(query = q, court?: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    onStartAgent(trimmed, court);
  }

  const quote = QUOTES[quoteIdx];

  return (
    <div className="landing">
      {/* ATTENTION: Hero section with authentic executive aesthetic */}
      <section className="hero-asym" aria-labelledby="hero-title">
        <div className="hero-asym-inner">
          <motion.div
            className="hero-asym-copy"
            initial={reduce ? false : { opacity: 1, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="hero-badge">
              <Sparkle size={14} weight="fill" /> Autonomous Legal Intelligence
            </div>

            <h1 id="hero-title" className="hero-title">
              Smart legal research that helps you win your case.
            </h1>

            <p className="hero-lead">
              CaseFile AI searches real court cases, sorts helpful rulings from opposing ones, points out court disagreements, and writes clear legal briefs with zero fake cases.
            </p>

            <div className="hero-ctas">
              <button type="button" className="btn btn-solid" onClick={() => launchAgent()}>
                <Sparkle size={16} weight="fill" />
                Start AI Legal Assistant
                <ArrowRight size={16} weight="bold" />
              </button>
              <button
                type="button"
                className="btn btn-line"
                onClick={() => onStartResearch(q || "cyber crime")}
              >
                Search Court Cases
              </button>
            </div>

            {/* Cognitive Inquiry Terminal */}
            <div className="teaser-search cognitive-terminal-box">
              <div className="terminal-box-header">
                <div className="box-indicator">
                  <span className="live-pulse" />
                  <span className="box-tag">Instant Court Case Search</span>
                </div>
                <span className="box-kbd-hint">Press Enter to search • ⌘K for quick actions</span>
              </div>

              <div className="teaser-row">
                <label htmlFor="hero-query" className="sr-only">
                  Legal question
                </label>
                <input
                  id="hero-query"
                  aria-label="Legal question"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && launchAgent()}
                  placeholder="e.g. Can you take apart software to see how it works?"
                  autoComplete="off"
                />
                <button type="button" className="btn btn-solid" onClick={() => launchAgent()}>
                  Run Search ↵
                </button>
              </div>

              {/* Starter Precedent Cards */}
              <div className="starter-presets-grid" aria-label="Sample Legal Questions">
                {PRESET_CARDS.map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    className="starter-card"
                    onClick={() => {
                      setQ(preset.query);
                      launchAgent(preset.query, preset.court);
                    }}
                  >
                    <div className="starter-card-top">
                      <span className="starter-tag">{preset.tag}</span>
                      <span className="starter-court-badge">{preset.court.toUpperCase()}</span>
                    </div>
                    <div className="starter-title">{preset.title}</div>
                    <div className="starter-snippet">{preset.snippet}</div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            className="hero-float-visual"
            initial={reduce ? false : { opacity: 1, y: 28, rotate: 1.5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
          >
            <div className="hero-float-frame group-hover-media">
              <img
                src="/assets/appellate-desk.jpg"
                alt="Lawyer's desk with court case books and brief notes"
                width={900}
                height={1100}
              />
              <div className="hero-badge-overlay">
                <span className="live-pulse" />
                <span className="overlay-text">Active Legal Research Engine • CourtListener Live</span>
              </div>
            </div>
          </motion.div>
        </div>
        <div className="hero-wash" aria-hidden />
      </section>

      {/* NEW: Interactive Live Deliverables Preview */}
      <section className="section-chapter showcase-section">
        <div className="container">
          <div className="chapter-head chapter-head-center">
            <div className="hero-badge">
              <Sparkle size={13} weight="fill" /> Interactive Preview
            </div>
            <h2>Court-Ready Briefs with Real Cases Only</h2>
            <p>
              See the three helpful documents created automatically for every legal question.
            </p>
          </div>

          <div className="showcase-card-container">
            {/* Tab Bar */}
            <div className="showcase-nav-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={showcaseTab === "matrix"}
                className={`showcase-tab ${showcaseTab === "matrix" ? "active" : ""}`}
                onClick={() => setShowcaseTab("matrix")}
              >
                <Scales size={16} /> 1. Helpful vs. Opposing Cases
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={showcaseTab === "pleading"}
                className={`showcase-tab ${showcaseTab === "pleading" ? "active" : ""}`}
                onClick={() => setShowcaseTab("pleading")}
              >
                <FileArrowDown size={16} /> 2. Court Legal Memo (IRAC)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={showcaseTab === "citations"}
                className={`showcase-tab ${showcaseTab === "citations" ? "active" : ""}`}
                onClick={() => setShowcaseTab("citations")}
              >
                <ShieldCheck size={16} /> 3. Real Citation Check
              </button>
            </div>

            {/* Showcase Viewport */}
            <div className="showcase-viewport">
              {showcaseTab === "matrix" && (
                <div className="showcase-matrix-preview">
                  <div className="preview-split">
                    <div className="preview-card favorable">
                      <div className="preview-card-head">
                        <CheckCircle size={16} color="var(--accent)" weight="bold" />
                        <span>Helpful Ruling (Supports You)</span>
                        <span className="cite-sub">676 F.2d 400 (9th Cir. 1982)</span>
                      </div>
                      <h4>Chicago Lock Co. v. Fanberg</h4>
                      <p className="preview-holding">
                        <strong>What the Court Ruled:</strong> Customers who buy a product lawfully and take it apart to see how it works did nothing wrong or illegal.
                      </p>
                      <div className="preview-strategy">
                        <strong>How to Use This:</strong> Base your defense on the fact that the product was bought legally by anyone in the public.
                      </div>
                    </div>

                    <div className="preview-card adverse">
                      <div className="preview-card-head">
                        <ShieldWarning size={16} color="var(--warn)" weight="bold" />
                        <span>Opposing Ruling (The Other Side)</span>
                        <span className="cite-sub">2026 Fed. App.</span>
                      </div>
                      <h4>Comet Technologies USA v. XP Power, LLC</h4>
                      <p className="preview-holding">
                        <strong>What the Other Side Will Say:</strong> The plaintiff will argue that looking at secret diagrams spoils any later product testing.
                      </p>
                      <div className="preview-distinguish">
                        <strong>How to Answer Their Argument:</strong> In Comet, the defendant had signed a secret non-disclosure agreement. Here, the product was bought openly with no restrictions.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showcaseTab === "pleading" && (
                <div className="showcase-pleading-preview">
                  <div className="pleading-sample-paper">
                    <div className="pleading-margin-col" aria-hidden>
                      {Array.from({ length: 12 }, (_, i) => (
                        <div key={i + 1} className="pleading-line-no">{i + 1}</div>
                      ))}
                    </div>
                    <div className="pleading-sample-body">
                      <div className="pleading-sample-crest">IN THE UNITED STATES COURT OF APPEALS FOR THE NINTH CIRCUIT</div>
                      <h4 className="pleading-sample-title">LEGAL MEMORANDUM &amp; AUTHORITIES: REVERSE ENGINEERING DEFENSE</h4>
                      <div className="pleading-sample-prose">
                        <strong>I. THE CONTROLLING LEGAL RULE:</strong> Under federal law (18 U.S.C. § 1836) and Ninth Circuit rulings in <em>Chicago Lock Co. v. Fanberg</em>, taking apart a product to learn how it works (reverse engineering) is completely legal as long as the product was bought lawfully.
                      </div>
                      <div className="pleading-annotation-demo">
                        <span className="annotation-tag"><Lightning size={12} weight="fill" /> 15-Second Summary for the Judge</span>
                        <div className="annotation-copy">"Your Honors, taking apart a product you bought lawfully is fair competition. The plaintiff cannot use trade secret law to stop people from studying products that are sold to the public."</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showcaseTab === "citations" && (
                <div className="showcase-citations-preview">
                  <div className="showcase-cite-grid">
                    <div className="cite-audit-card">
                      <div className="audit-badge verified">🟢 Verified Real Court Case</div>
                      <h5>Chicago Lock Co. v. Fanberg</h5>
                      <div className="audit-meta font-mono">676 F.2d 400 • Docket ID #1284792</div>
                      <p>Checked against real 9th Circuit court files. 100% real.</p>
                    </div>

                    <div className="cite-audit-card">
                      <div className="audit-badge verified">🟢 Verified Real Court Case</div>
                      <h5>Imax Corp. v. Cinema Technologies, Inc.</h5>
                      <div className="audit-meta font-mono">152 F.3d 1161 • Docket ID #1182245</div>
                      <p>The court's written decision was confirmed in official court reporters.</p>
                    </div>

                    <div className="cite-audit-card">
                      <div className="audit-badge verified">🟢 Verified Real Court Case</div>
                      <h5>United States v. Liew</h5>
                      <div className="audit-meta font-mono">856 F.3d 585 • Docket ID #2819033</div>
                      <p>Checked against real federal appeals court records.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Showcase Footer Action */}
            <div className="showcase-foot">
              <span>Ready to research your own legal question?</span>
              <button
                type="button"
                className="btn btn-solid btn-sm"
                onClick={() => launchAgent(q)}
              >
                <Sparkle size={14} weight="fill" />
                Write Full Brief with AI Assistant
                <ArrowRight size={14} weight="bold" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: Built for Serious Legal Work (Bento Redesign) */}
      <section className="section-chapter">
        <div className="container">
          <div className="chapter-head">
            <h2>Built for Serious Legal Work</h2>
            <p>
              More than simple chat answers: an AI assistant that finds both sides of an argument, checks court records, and writes court-ready papers.
            </p>
          </div>

          <div className="bento-redesign" aria-label="Product capabilities">
            {/* Left 7 Columns: Hero Feature Card */}
            <article className="bento-feat-card">
              <img src="/assets/legal-firm.jpg" alt="Modern law library and archive" />
              <div className="bento-feat-overlay">
                <div className="bento-live-tag">
                  <span className="live-dot" />
                  Connected to Real Court Records
                </div>
                <h3>Live Federal &amp; State Court Decisions</h3>
                <p>
                  Pulls live court decisions and official records directly from the Free Law Project database.
                </p>
                <div className="bento-feat-metrics">
                  <span className="bento-metric-chip">400,000+ Court Opinions</span>
                  <span className="bento-metric-chip">13 Appeals Courts</span>
                  <span className="bento-metric-chip">Supreme Court Rulings</span>
                </div>
              </div>
            </article>

            {/* Right 5 Columns: Side Stack Cards */}
            <div className="bento-side-stack">
              <article className="bento-cell-card">
                <div className="bento-card-top">
                  <div className="bento-icon-badge">
                    <Scales size={22} weight="duotone" />
                  </div>
                  <span className="bento-card-pill">Two-Sided View</span>
                </div>
                <h3>Helpful vs. Opposing Cases</h3>
                <p>
                  Puts cases that help your argument side-by-side with cases the other side might use.
                </p>
                <div className="bento-preview-chips">
                  <div className="bento-chip favorable">
                    <CheckCircle size={14} weight="fill" />
                    <span>Key Ruling Supporting You</span>
                  </div>
                  <div className="bento-chip adverse">
                    <ShieldWarning size={14} weight="fill" />
                    <span>How to Answer the Other Side's Case</span>
                  </div>
                </div>
              </article>

              <article className="bento-cell-card">
                <div className="bento-card-top">
                  <div className="bento-icon-badge shield">
                    <ShieldCheck size={22} weight="duotone" />
                  </div>
                  <span className="bento-card-pill">Zero Fake Cases</span>
                </div>
                <h3>Fake Citation Guard</h3>
                <p>
                  Every case citation is checked against real court files. If a citation cannot be found in real court records, it is removed.
                </p>
                <div className="bento-guard-status">
                  <span className="guard-dot" />
                  <span>Verified: only real court cases allowed</span>
                </div>
              </article>
            </div>

            {/* Bottom 12 Columns: Full-Width IRAC Banner */}
            <article className="bento-bottom-card">
              <div className="bento-bottom-copy">
                <div className="bento-card-top" style={{ justifyContent: "flex-start", gap: "0.75rem" }}>
                  <div className="bento-icon-badge stack">
                    <Stack size={22} weight="duotone" />
                  </div>
                  <span className="bento-card-pill">Court Ready</span>
                </div>
                <h3>Legal Memo Writer (IRAC)</h3>
                <p>
                  Writes formal legal memos (Issue, Rule, Application, Counter-argument, and Conclusion) on numbered court paper.
                </p>
                <div className="bento-bottom-pills">
                  <span className="pill-outline">Numbered Court Paper</span>
                  <span className="pill-outline">Official Legal Citations</span>
                  <span className="pill-outline">Save as PDF or Text</span>
                </div>
              </div>

              <div className="mini-paper">
                <div className="mini-paper-crest">UNITED STATES COURT OF APPEALS</div>
                <div className="mini-paper-title">LEGAL MEMORANDUM &amp; COURT CASES</div>
                <div className="mini-paper-snippet">
                  &ldquo;1. Under federal law, taking apart a product to learn how it works is completely legal as long as the product was bought lawfully...&rdquo;
                </div>
                <div className="mini-paper-badge">
                  <CheckCircle size={13} weight="fill" />
                  Court-Ready Format
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* SECTION 2: How the Research Pipeline Works (Process Grid) */}
      <section className="section-chapter section-tight-top">
        <div className="container">
          <div className="chapter-head">
            <h2>How the Research Pipeline Works</h2>
            <p>A clear 3-step process built to find and check real court law.</p>
          </div>

          <div className="pipeline-grid" role="list">
            {PIPELINE_STAGES.map((stage, i) => (
              <div
                key={stage.step}
                className={`pipeline-card${openSlice === i ? " active" : ""}`}
                role="listitem"
                onMouseEnter={() => setOpenSlice(i)}
                onClick={() => setOpenSlice(i)}
              >
                <div className="pipeline-step-header">
                  <span className="pipeline-step-num">Stage {stage.step}</span>
                  <span className="pipeline-step-tag">{stage.tag}</span>
                </div>

                <h3>{stage.title}</h3>
                <p>{stage.body}</p>

                <div className="pipeline-img-banner">
                  <img src={stage.img} alt={stage.title} />
                </div>

                <div className="pipeline-widget">
                  <span className="pipeline-widget-title">{stage.widgetTitle}</span>
                  <div className="pipeline-widget-chips">
                    {stage.chips.map((chip, cIdx) => (
                      <span key={chip} className={`p-chip${cIdx === 0 ? " accent" : ""}`}>
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: Designed for Serious Court Practice (Split Spotlight) */}
      <section className="section-chapter">
        <div className="container">
          <div className="appellate-spotlight-split">
            <div className="spotlight-copy-col">
              <div className="hero-badge" style={{ alignSelf: "flex-start", margin: 0 }}>
                <Books size={14} weight="fill" /> Built for Lawyers and Students
              </div>
              <h2 style={{ fontSize: "clamp(2rem, 3.2vw, 2.75rem)", lineHeight: 1.2 }}>
                Designed for Serious Court Practice
              </h2>
              <p className="spotlight-lead">
                The two-panel screen puts your research chat on the left and your court documents on the right, keeping full opinions, case tables, and briefs always in view.
              </p>

              <div className="spotlight-pillars">
                <div className="pillar-item">
                  <div className="pillar-icon">
                    <Books size={22} weight="duotone" />
                  </div>
                  <div>
                    <h4>Real Court Cases Only</h4>
                    <p>Every quote is checked against official court decisions so you never cite a fake or made-up case.</p>
                  </div>
                </div>

                <div className="pillar-item">
                  <div className="pillar-icon">
                    <GitBranch size={22} weight="duotone" />
                  </div>
                  <div>
                    <h4>Find Where Courts Disagree</h4>
                    <p>Points out when appeals courts in different parts of the country disagree on what the law means.</p>
                  </div>
                </div>

                <div className="pillar-item">
                  <div className="pillar-icon">
                    <FileText size={22} weight="duotone" />
                  </div>
                  <div>
                    <h4>Easy-to-Read Legal Citations</h4>
                    <p>Checks case volume numbers, court names, and page numbers so your citations match court rules.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="spotlight-media-col">
              <div className="spotlight-frame">
                <img
                  src="/assets/panel.jpg"
                  alt="Open legal books under warm chamber light"
                />
                <div className="spotlight-caption-badge">
                  <span className="caption-dot" />
                  <span>Every case citation is checked against real court records</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: From a Tough Dispute to a Winning Strategy (Rich CardStack) */}
      <CardStack
        title="From a Tough Dispute to a Winning Strategy"
        lead="How CaseFile AI helps you do research like an experienced appeals lawyer."
        cards={[
          <div key="q" className="stack-content-rich">
            <div className="stack-top-meta">
              <span className="stack-badge-num">STAGE 01</span>
              <div className="stack-icon-pill">
                <MagnifyingGlass size={20} weight="duotone" />
              </div>
            </div>
            <h3>1. Search Multiple Appeals Courts</h3>
            <p>
              The assistant searches across federal appeals courts and the Supreme Court to find the main court rulings and key disagreements.
            </p>
            <div className="stack-preview-panel">
              <div className="stack-preview-label">
                <span>Active Court Searches</span>
                <span style={{ color: "var(--accent)" }}>4 Courts Searched</span>
              </div>
              <div className="stack-preview-items">
                <span className="stack-chip-item active">
                  <span className="guard-dot" /> 9th Cir. (Main Court)
                </span>
                <span className="stack-chip-item">2nd Cir. (Disagrees)</span>
                <span className="stack-chip-item">Fed. Cir. (Tech/IP)</span>
                <span className="stack-chip-item">Supreme Court</span>
              </div>
            </div>
          </div>,
          <div key="e" className="stack-content-rich">
            <div className="stack-top-meta">
              <span className="stack-badge-num">STAGE 02</span>
              <div className="stack-icon-pill">
                <Scales size={20} weight="duotone" />
              </div>
            </div>
            <h3>2. Sort Both Sides of the Argument</h3>
            <p>
              Cases are sorted into helpful rulings that support your side and opposing rulings with clear ways to answer them.
            </p>
            <div className="stack-preview-panel">
              <div className="stack-preview-label">
                <span>Case Breakdown</span>
                <span style={{ color: "var(--text-soft)" }}>6 Court Cases Reviewed</span>
              </div>
              <div className="stack-preview-items">
                <span className="stack-chip-item" style={{ borderLeft: "3px solid var(--accent)", color: "var(--accent)" }}>
                  Helpful Rule: Lawful product testing
                </span>
                <span className="stack-chip-item" style={{ borderLeft: "3px solid var(--warn)", color: "var(--warn)" }}>
                  Opposing Argument: Stolen secret claim
                </span>
              </div>
            </div>
          </div>,
          <div key="x" className="stack-content-rich">
            <div className="stack-top-meta">
              <span className="stack-badge-num">STAGE 03</span>
              <div className="stack-icon-pill">
                <FileArrowDown size={20} weight="duotone" />
              </div>
            </div>
            <h3>3. Download Your Court-Ready Memo</h3>
            <p>
              Download your legal brief in formatted text, printable court pleading paper (Lines 1–28), or as data.
            </p>
            <div className="stack-preview-panel">
              <div className="stack-preview-label">
                <span>Download Formats</span>
                <span style={{ color: "var(--accent)" }}>Court-Ready Format</span>
              </div>
              <div className="stack-preview-items">
                <span className="stack-chip-item active">
                  <FileText size={14} weight="bold" /> Formatted Text (Lines 1–28)
                </span>
                <span className="stack-chip-item">
                  <FileArrowDown size={14} weight="bold" /> Printable Court Document (PDF)
                </span>
                <span className="stack-chip-item">
                  <Stack size={14} weight="bold" /> Case Data (JSON)
                </span>
              </div>
            </div>
          </div>,
        ]}
      />

      {/* Testimonials */}
      <section className="section-chapter">
        <div className="container quote-carousel">
          <div className="quote-controls">
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous quote"
              onClick={() => setQuoteIdx((i) => (i + QUOTES.length - 1) % QUOTES.length)}
            >
              <CaretLeft size={18} weight="bold" />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Next quote"
              onClick={() => setQuoteIdx((i) => (i + 1) % QUOTES.length)}
            >
              <CaretRight size={18} weight="bold" />
            </button>
          </div>
          <AnimatePresence mode="wait">
            <motion.figure
              key={quote.name}
              className="quote-slide"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <blockquote>
                <p>"{quote.text}"</p>
              </blockquote>
              <figcaption>
                <span className="quote-avatar" aria-hidden>
                  {quote.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
                <span>
                  <strong>{quote.name}</strong>
                  <span className="quote-role">{quote.role}</span>
                </span>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>
      </section>

      {/* ACTION: Bottom Call to Action */}
      <section className="section-action">
        <div className="container action-inner">
          <h2>Ready to Brief Your Next Case?</h2>
          <p>
            Test CaseFile AI with your hardest legal issue. Review the live cognitive trace, inspect the adversarial matrix, and export the verified memorandum.
          </p>
          <div className="hero-ctas">
            <button
              type="button"
              className="btn btn-solid"
              onClick={() => launchAgent("DTSA trade secret reverse engineering defense", "ca9")}
            >
              <Sparkle size={16} weight="fill" />
              Try DTSA Reverse Engineering Scenario
              <ArrowRight size={16} weight="bold" />
            </button>
            <button
              type="button"
              className="btn btn-line"
              onClick={() => launchAgent()}
            >
              Open AI Agent Studio
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
