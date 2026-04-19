export default function FeaturesSection() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <div className="section-label">Features</div>
          <h2 className="section-h2">Built for personal, private knowledge work.</h2>
          <p className="section-sub">
            Every component runs in your own infrastructure — nothing leaves your network without your intent.
          </p>
        </div>
        <div className="features-grid">

          <div className="feature-card">
            <div className="feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <div className="feature-title">Dual Query Engines</div>
            <div className="feature-desc">
              Ask questions against your vault using QMD&apos;s fast vector retrieval, or switch to
              OpenCode-backed grounded answers with your preferred LLM.
            </div>
            <div className="feature-tags">
              <span className="feature-tag">QMD</span>
              <span className="feature-tag">Claude Sonnet 4.6</span>
              <span className="feature-tag">GPT-5</span>
              <span className="feature-tag">Gemini 2.5</span>
              <span className="feature-tag">Grok-4</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="feature-title">Multi-threaded Chat</div>
            <div className="feature-desc">
              Every question is a thread. Browse your history from a persistent sidebar, resume
              conversations, and keep source citations alongside each answer.
            </div>
            <div className="feature-tags">
              <span className="feature-tag">localStorage</span>
              <span className="feature-tag">Markdown rendering</span>
              <span className="feature-tag">Source citations</span>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="feature-title">Secure by Default</div>
            <div className="feature-desc">
              Only the Next.js UI is reachable externally through Cloudflare Tunnel and Access. QMD,
              OpenCode, and the sync worker are locked to the internal Docker network.
            </div>
            <div className="feature-tags">
              <span className="feature-tag">Cloudflare Tunnel</span>
              <span className="feature-tag">Cloudflare Access</span>
              <span className="feature-tag">Internal-only services</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
