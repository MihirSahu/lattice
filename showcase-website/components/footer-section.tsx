const STACK = ["Next.js 15", "Docker", "QMD", "Cloudflare", "TypeScript", "Raspberry Pi"];

export default function FooterSection() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div className="footer-left">
            <span>© 2026 Lattice</span>
            <span className="footer-sep">·</span>
            <span>Built by Mihir Sahu</span>
          </div>
          <div className="footer-right">
            {STACK.map((item) => (
              <span key={item} className="stack-pill">{item}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
