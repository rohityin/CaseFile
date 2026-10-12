import type { CSSProperties, ReactNode } from "react";

interface CardStackProps {
  title: string;
  lead: string;
  cards: ReactNode[];
}

// Cards stack as you scroll using CSS `position: sticky` — deterministic and
// seek-safe, with no scroll-height corruption (the previous GSAP pin/pinSpacing
// approach piled the cards into overlapping, unreadable text).
export function CardStack({ title, lead, cards }: CardStackProps) {
  return (
    <section className="stack-section">
      <div className="container stack-intro">
        <h2>{title}</h2>
        <p>{lead}</p>
      </div>
      <div className="stack-track container">
        {cards.map((card, i) => (
          <div
            key={i}
            className="stack-card"
            style={{ "--i": i, zIndex: i + 1 } as CSSProperties}
          >
            <div className="stack-card-inner">{card}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
