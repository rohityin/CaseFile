import { useState } from "react";
import { Clock, BookmarkSimple } from "@phosphor-icons/react";

interface Milestone {
  year: string;
  era: string;
  title: string;
  court: string;
  holding: string;
  impact: string;
  doctrineStatus: "foundational" | "expansion" | "statutory" | "modern";
}

const TIMELINE_EVENTS: Milestone[] = [
  {
    year: "1974",
    era: "Early Foundation",
    title: "Kewanee Oil Co. v. Bicron Corp.",
    court: "U.S. Supreme Court (416 U.S. 470)",
    holding: "State trade secret rules are allowed alongside federal patent law. Taking products apart to see how they work is clearly protected as fair business competition.",
    impact: "Set the foundational rule that trade secret owners do not get a monopoly. Anyone is allowed to figure out a product on their own or take it apart lawfully.",
    doctrineStatus: "foundational",
  },
  {
    year: "1982",
    era: "Appeals Court Ruling",
    title: "Chicago Lock Co. v. Fanberg",
    court: "U.S. Court of Appeals for the Ninth Circuit (676 F.2d 400)",
    holding: "Lock buyers who took apart key cylinders and published the code combinations did not do anything illegal or dishonest.",
    impact: "Created the famous 9th Circuit rule: a trade secret owner can only sue someone who broke a confidential promise or used illegal means.",
    doctrineStatus: "expansion",
  },
  {
    year: "2016",
    era: "Federal Law Passed",
    title: "Defend Trade Secrets Act (DTSA) Becomes Law",
    court: "U.S. Congress (18 U.S.C. § 1836 et seq.)",
    holding: "Created a nationwide federal law for trade secret lawsuits while writing in an official protection for lawful reverse engineering.",
    impact: "Protected reverse engineering and whistleblowers across the entire United States under federal law.",
    doctrineStatus: "statutory",
  },
  {
    year: "2021",
    era: "Software & Fair Use",
    title: "Google LLC v. Oracle America, Inc.",
    court: "U.S. Supreme Court (141 S. Ct. 1183)",
    holding: "Copying software code interfaces so different programs can talk to each other counts as fair use under copyright law.",
    impact: "Made it clear that developers can inspect and connect to existing software without infringing copyright.",
    doctrineStatus: "modern",
  },
  {
    year: "2026",
    era: "AI & Modern Tech",
    title: "AI Models & Software Testing",
    court: "Federal Appeals Courts (Recent)",
    holding: "Testing public AI outputs and inspecting model files is protected under reverse engineering rights unless you signed a contract saying you would not.",
    impact: "Sets the ground rules separating fair technical testing from unlawful model stealing.",
    doctrineStatus: "modern",
  },
];

export function DoctrineTimeline() {
  const [activeIdx, setActiveIdx] = useState(2);
  const activeEvent = TIMELINE_EVENTS[activeIdx];

  const statusLabel =
    activeEvent.doctrineStatus === "foundational"
      ? "FOUNDATIONAL CASE"
      : activeEvent.doctrineStatus === "expansion"
      ? "LANDMARK CASE"
      : activeEvent.doctrineStatus === "statutory"
      ? "WRITTEN LAW"
      : "MODERN RULING";

  return (
    <div className="doctrine-timeline-wrap">
      <div className="timeline-header">
        <div>
          <h4 className="timeline-title">
            <Clock size={16} color="var(--accent)" weight="bold" /> 50-Year Legal Timeline
          </h4>
          <p className="timeline-lead">
            Follow the 50-year journey of how courts have protected the right to inspect and reverse engineer products.
          </p>
        </div>
        <span className="era-badge">
          <BookmarkSimple size={13} weight="fill" /> {TIMELINE_EVENTS.length} Key Legal Milestones
        </span>
      </div>

      {/* Horizontal Interactive Timeline Axis */}
      <div className="timeline-axis-container">
        <div className="timeline-axis-line" />
        <div className="timeline-nodes-row">
          {TIMELINE_EVENTS.map((event, idx) => {
            const isSelected = activeIdx === idx;
            return (
              <button
                key={event.year + event.title}
                type="button"
                className={`timeline-node-btn ${isSelected ? "active" : ""} ${event.doctrineStatus}`}
                onClick={() => setActiveIdx(idx)}
              >
                <span className="node-marker">
                  <span className="node-ring" />
                </span>
                <span className="node-year">{event.year}</span>
                <span className="node-era">{event.era}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Milestone Detail Card */}
      <div className="timeline-milestone-card">
        <div className="milestone-head">
          <div>
            <div className="milestone-year-tag">{activeEvent.year} • {activeEvent.era}</div>
            <h3 className="milestone-title">{activeEvent.title}</h3>
            <div className="milestone-court">{activeEvent.court}</div>
          </div>
          <span className={`status-pill ${activeEvent.doctrineStatus}`}>
            {statusLabel}
          </span>
        </div>

        <div className="milestone-body">
          <div className="milestone-block">
            <div className="block-label">What the Court Decided</div>
            <div className="block-text">{activeEvent.holding}</div>
          </div>

          <div className="milestone-block highlight">
            <div className="block-label">Why This Matters for Your Legal Argument</div>
            <div className="block-text">{activeEvent.impact}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
