const ArrowIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export default function ArchSection() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <div className="section-label">Architecture</div>
          <h2 className="section-h2">From vault to answer, end to end.</h2>
          <p className="section-sub">
            Obsidian writes to S3 via Remotely Save. The stack takes it from there — syncing, indexing,
            and serving — entirely on your hardware.
          </p>
        </div>
        <div className="arch-flow">

          <div className="arch-node">
            <div className="arch-box">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "-2px", marginRight: "6px", opacity: 0.6 }}>
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Obsidian Vault
            </div>
            <span className="arch-label">Remotely Save</span>
          </div>

          <div className="arch-arrow"><ArrowIcon /></div>

          <div className="arch-node">
            <div className="arch-box">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "-2px", marginRight: "6px", opacity: 0.6 }}>
                <path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path d="M17 20V8" /><path d="M22 4v16" />
              </svg>
              AWS S3
            </div>
            <span className="arch-label">read-only bucket</span>
          </div>

          <div className="arch-arrow"><ArrowIcon /></div>

          <div className="arch-node">
            <div className="arch-box">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "-2px", marginRight: "6px", opacity: 0.6 }}>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              sync-worker
            </div>
            <span className="arch-label">every 5 min</span>
          </div>

          <div className="arch-arrow"><ArrowIcon /></div>

          <div className="arch-node">
            <div className="arch-box">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "-2px", marginRight: "6px", opacity: 0.6 }}>
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5V19A9 3 0 0 0 21 19V5" />
                <path d="M3 12A9 3 0 0 0 21 12" />
              </svg>
              QMD index
            </div>
            <span className="arch-label">vectors + search</span>
          </div>

          <div className="arch-arrow"><ArrowIcon /></div>

          <div className="arch-node">
            <div className="arch-box">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "-2px", marginRight: "6px", opacity: 0.6 }}>
                <rect width="20" height="14" x="2" y="3" rx="2" />
                <path d="M8 21h8" /><path d="M12 17v4" />
              </svg>
              Next.js UI
            </div>
            <span className="arch-label">web app</span>
          </div>

          <div className="arch-arrow"><ArrowIcon /></div>

          <div className="arch-node">
            <div className="arch-box">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "-2px", marginRight: "6px", opacity: 0.6 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              </svg>
              Cloudflare
            </div>
            <span className="arch-label">Tunnel + Access</span>
          </div>

        </div>
      </div>
    </section>
  );
}
