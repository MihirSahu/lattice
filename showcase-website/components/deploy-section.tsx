export default function DeploySection() {
  return (
    <section className="section" id="deploy">
      <div className="container">
        <div className="section-header">
          <div className="section-label">Deployment</div>
          <h2 className="section-h2">One Compose file. Any ARM64 Linux box.</h2>
          <p className="section-sub">
            The full stack — sync worker, QMD, OpenCode query service, scheduler, and web app —
            orchestrated by a single Docker Compose file.
          </p>
        </div>
        <div className="deploy-grid">

          <div className="services-list">
            {[
              { name: "web", badge: "public", internal: false },
              { name: "qmd", badge: "internal", internal: true },
              { name: "opencode-query", badge: "internal", internal: true },
              { name: "sync-worker", badge: "internal", internal: true },
              { name: "scheduler", badge: "internal", internal: true },
              { name: "cloudflared", badge: "tunnel", internal: false },
            ].map((svc) => (
              <div key={svc.name} className="service-row">
                <span className={`service-dot${svc.internal ? " internal" : ""}`} />
                <span className="service-name">{svc.name}</span>
                <span className="service-badge">{svc.badge}</span>
              </div>
            ))}
          </div>

          <div className="code-block">
            <div className="code-block-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" x2="20" y1="19" y2="19" />
              </svg>
              Quick Start
            </div>
            <div className="code-block-body">
              <pre>
                <span className="code-comment"># Clone and configure{"\n"}</span>
                <span className="code-cmd">git clone</span>{" https://github.com/you/lattice\n"}
                <span className="code-cmd">cp</span>{" .env.example .env\n"}
                {"\n"}
                <span className="code-comment"># Set your S3 bucket, region, and creds{"\n"}</span>
                <span className="code-comment"># Set CLOUDFLARE_TUNNEL_TOKEN{"\n"}</span>
                {"\n"}
                <span className="code-comment"># Create runtime directories{"\n"}</span>
                <span className="code-cmd">mkdir -p</span>{" /srv/lattice/{vault,qmd,status,logs}\n"}
                {"\n"}
                <span className="code-comment"># Start the stack{"\n"}</span>
                <span className="code-cmd">make</span>{" up"}
              </pre>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
