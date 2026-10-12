import { useState } from "react";
import { Scales, Sparkle } from "@phosphor-icons/react";

export interface CircuitData {
  circuit: string;
  name: string;
  status: "favorable" | "adverse" | "moderate" | "unsettled";
  summary: string;
  leadCase: string;
  citation: string;
  standard: string;
  strategicNote: string;
}

const CIRCUIT_DATA: Record<string, CircuitData> = {
  ca9: {
    circuit: "9th Cir.",
    name: "U.S. Court of Appeals for the Ninth Circuit",
    status: "favorable",
    summary: "Strongly protects the right to reverse engineer products you buy legally. The person suing must prove you stole secrets by improper means, not just that you took apart something sold to the public.",
    leadCase: "Chicago Lock Co. v. Fanberg / Imax Corp.",
    citation: "676 F.2d 400 (9th Cir. 1982)",
    standard: "Allows taking apart products bought legally; puts a heavy burden on the plaintiff to prove secrecy",
    strategicNote: "Best court for our defense. Focus on proving you bought the product lawfully and inspected it openly.",
  },
  ca2: {
    circuit: "2nd Cir.",
    name: "U.S. Court of Appeals for the Second Circuit",
    status: "moderate",
    summary: "Enforces user contracts strictly. You cannot use reverse engineering as a defense if you signed an agreement or clicked 'agree' promising not to take the software or product apart.",
    leadCase: "Softel, Inc. v. Dragon Med. & Sci. Commc'ns",
    citation: "118 F.3d 955 (2d Cir. 1997)",
    standard: "Signed contracts override the right to reverse engineer",
    strategicNote: "Check if our team signed any terms of service or non-analysis agreement before getting the item.",
  },
  ca5: {
    circuit: "5th Cir.",
    name: "U.S. Court of Appeals for the Fifth Circuit",
    status: "adverse",
    summary: "Tough standard against defendants. If the other side shows you had access to their secret and your product looks very similar, this court assumes you copied it unless you prove otherwise.",
    leadCase: "SPEECA v. Miller Tech Logistics",
    citation: "891 F.3d 520 (5th Cir. 2018)",
    standard: "Very similar designs make the court suspect unfair copying",
    strategicNote: "You must show detailed engineer work logs proving your team built it independently from scratch.",
  },
  ca7: {
    circuit: "7th Cir.",
    name: "U.S. Court of Appeals for the Seventh Circuit",
    status: "favorable",
    summary: "Focuses on business competition. Believes taking products apart keeps markets fair and competitive, as long as nobody trespassed or stole physical property.",
    leadCase: "Rockwell Graphic Sys. v. DEV Indus.",
    citation: "925 F.2d 174 (7th Cir. 1991)",
    standard: "Taking apart public products is completely legal unless physical theft occurred",
    strategicNote: "Argue that stopping people from taking products apart gives companies an unfair monopoly.",
  },
  ca3: {
    circuit: "3rd Cir.",
    name: "U.S. Court of Appeals for the Third Circuit",
    status: "moderate",
    summary: "Carefully checks how you got the product. Reverse engineering is only legal if you bought the sample honestly without lying about who you were.",
    leadCase: "SI Handling Sys. v. Heisley",
    citation: "753 F.2d 1244 (3d Cir. 1985)",
    standard: "Lying or trickery to buy a product cancels out the right to reverse engineer",
    strategicNote: "Make sure our team bought the product through normal store or customer channels.",
  },
  cadc: {
    circuit: "D.C. Cir.",
    name: "U.S. Court of Appeals for the D.C. Circuit",
    status: "unsettled",
    summary: "Handles very few private company trade secret cases. Mostly hears lawsuits against federal agencies over government records.",
    leadCase: "Critical Mass Energy Project v. NRC",
    citation: "975 F.2d 871 (D.C. Cir. 1992)",
    standard: "Focuses on government records; defers regular company disputes to other regional courts",
    strategicNote: "If sued here, consider asking the judge to move the case to your local circuit court.",
  },
  cafc: {
    circuit: "Fed. Cir.",
    name: "U.S. Court of Appeals for the Federal Circuit",
    status: "moderate",
    summary: "Follows local circuit rules for trade secret claims, but makes sure patent rules are followed if patent claims are also involved.",
    leadCase: "GFI, Inc. v. Franklin Corp.",
    citation: "265 F.3d 1268 (Fed. Cir. 2001)",
    standard: "Follows regional court rules, with strict patent boundaries",
    strategicNote: "Look out for patent law overlaps if the lawsuit claims both patent and trade secret issues.",
  },
};

export function CircuitSplitVisualizer() {
  const [selectedCircuit, setSelectedCircuit] = useState<string>("ca9");
  const circuit = CIRCUIT_DATA[selectedCircuit] || CIRCUIT_DATA.ca9;

  return (
    <div className="circuit-split-container">
      {/* Header */}
      <div className="circuit-head-bar">
        <div>
          <h4 className="circuit-title">
            <Scales size={16} color="var(--accent)" weight="bold" /> How Appeals Courts Disagree (Circuit Splits)
          </h4>
          <p className="circuit-lead">
            See how different federal appeals courts across the country rule differently on the same legal question.
          </p>
        </div>
        <div className="cert-split-badge">
          <Sparkle size={13} weight="fill" />
          <span>Supreme Court Review Potential: <strong>Big Disagreement (9th Cir. vs 5th Cir.)</strong></span>
        </div>
      </div>

      {/* Grid of Circuits */}
      <div className="circuits-selector-grid">
        {Object.entries(CIRCUIT_DATA).map(([key, item]) => {
          const isSelected = selectedCircuit === key;
          return (
            <button
              key={key}
              type="button"
              className={`circuit-tile ${item.status} ${isSelected ? "active" : ""}`}
              onClick={() => setSelectedCircuit(key)}
            >
              <div className="tile-top">
                <span className="tile-code">{item.circuit}</span>
                <span className={`status-pill ${item.status}`}>
                  {item.status === "favorable"
                    ? "Helps Defense"
                    : item.status === "adverse"
                    ? "Helps Other Side"
                    : item.status === "moderate"
                    ? "Balanced Approach"
                    : "Not Settled Yet"}
                </span>
              </div>
              <div className="tile-case">{item.leadCase}</div>
            </button>
          );
        })}
      </div>

      {/* Detailed Circuit Analysis Panel */}
      <div className="circuit-analysis-card">
        <div className="analysis-head">
          <div>
            <span className="analysis-crumb">{circuit.name}</span>
            <h3 className="analysis-title">{circuit.circuit} Court Rules &amp; Key Decisions</h3>
          </div>
          <span className={`guardrail-badge ${circuit.status === "favorable" ? "verified" : circuit.status === "adverse" ? "flagged" : "partial"}`}>
            {circuit.status === "favorable"
              ? "🟢 Rules in Favor of Defense"
              : circuit.status === "adverse"
              ? "🔴 Rules in Favor of the Other Side"
              : "🟡 Looks Closely at All Facts"}
          </span>
        </div>

        <div className="analysis-grid">
          <div className="analysis-box">
            <div className="box-label">Legal Rule Used by This Court</div>
            <div className="box-value">{circuit.standard}</div>
          </div>

          <div className="analysis-box">
            <div className="box-label">Most Important Past Case</div>
            <div className="box-value case-ref">
              <strong>{circuit.leadCase}</strong>
              <span className="cite-sub">{circuit.citation}</span>
            </div>
          </div>

          <div className="analysis-box full-width">
            <div className="box-label">Plain-English Summary</div>
            <div className="box-prose">{circuit.summary}</div>
          </div>

          <div className="analysis-box full-width highlight-strategy">
            <div className="box-label">Argument Strategy for This Court</div>
            <div className="box-prose strategy-text">{circuit.strategicNote}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
