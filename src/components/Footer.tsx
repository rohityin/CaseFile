export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <span className="brand" aria-label="CaseFile AI">
            <span className="brand-mark" aria-hidden>
              CF
            </span>
            <span className="brand-text">
              CaseFile <span className="brand-ai">AI</span>
            </span>
          </span>
          <p>
            Smart legal research and memos — searches real court cases and helps you prepare clear legal arguments.
          </p>
          <p>
            <a
              href="https://www.courtlistener.com/"
              target="_blank"
              rel="noreferrer"
            >
              CourtListener Records
            </a>
          </p>
        </div>
        <div className="footer-meta">
          <p>
            Court data from{" "}
            <a
              href="https://www.courtlistener.com/"
              target="_blank"
              rel="noreferrer"
            >
              CourtListener
            </a>{" "}
            and the Free Law Project. This tool does not give official legal advice. Always double-check real court rules and decisions before using them in court.
          </p>
        </div>
      </div>
    </footer>
  );
}
