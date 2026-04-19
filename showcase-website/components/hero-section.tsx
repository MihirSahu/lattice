/* ─── LatticeMark icon (matches apps/web/components/lattice-mark.tsx) ─── */
function LatticeMark({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={style}>
      <path
        d="M8 4.75V19.25M16 4.75V19.25M4.75 8H19.25M4.75 16H19.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

/* ─── Icon helpers ────────────────────────────────────────────────────── */
function IconMessageSquarePlus() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="12" y1="8" x2="12" y2="14" /><line x1="9" y1="11" x2="15" y2="11" />
    </svg>
  );
}

function IconPanelLeftClose() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" /><path d="m16 15-3-3 3-3" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /><path d="M2 12h20" />
    </svg>
  );
}

function IconArrowUp() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
    </svg>
  );
}

/* ─── Inline styles (CSS variables work here since globals.css is loaded) */
const s = {
  // Sidebar
  sidebar: {
    width: 220,
    minWidth: 220,
    borderRight: "1px solid var(--border-subtle)",
    background: "var(--bg-panel)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  sidebarHeader: {
    padding: "14px 12px 10px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 16,
    border: "1px solid var(--border-subtle)",
    background: "var(--bg-surface)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: "var(--text-primary)",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  brandText: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 1,
  },
  newChatBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 14px",
    borderRadius: 16,
    fontSize: 14,
    fontWeight: 500,
    cursor: "default",
    width: "100%",
  },
  sidebarContent: {
    flex: 1,
    padding: "4px 8px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    overflowY: "hidden" as const,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "var(--text-quaternary)",
    padding: "8px 8px 4px",
  },
  threadRow: {
    padding: "7px 10px",
    borderRadius: 10,
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    cursor: "default",
  },
  threadTitle: {
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.45,
    color: "var(--text-primary)",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  threadMeta: {
    fontSize: 11.5,
    lineHeight: 1.4,
    color: "var(--text-tertiary)",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  threadTitleMuted: {
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.45,
    color: "var(--text-secondary)",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  // Navbar
  navbar: {
    borderBottom: "1px solid var(--border-subtle)",
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backdropFilter: "blur(12px)",
  },
  navLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    flex: 1,
  },
  navIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    border: "1px solid var(--border-subtle)",
    background: "var(--bg-surface)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: "var(--text-tertiary)",
    cursor: "default",
  },
  navTitleBlock: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 1,
    minWidth: 0,
  },
  chatModePill: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    padding: "3px 10px",
    borderRadius: 999,
    flexShrink: 0,
  },
  // Messages
  messagesArea: {
    flex: 1,
    overflowY: "hidden" as const,
    padding: "20px 20px 12px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
  },
  msgLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "var(--text-quaternary)",
    marginBottom: 4,
  },
  userMsg: {
    marginLeft: "auto",
    maxWidth: "82%",
    textAlign: "right" as const,
  },
  userText: {
    fontSize: 14,
    lineHeight: 1.75,
    color: "var(--text-primary)",
    whiteSpace: "pre-wrap" as const,
  },
  answerText: {
    fontSize: 14,
    lineHeight: 1.75,
    color: "var(--text-primary)",
  },
  answerFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTop: "1px solid var(--border-subtle)",
    fontSize: 12,
    color: "var(--text-tertiary)",
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  // Composer
  composerWrap: {
    padding: "8px 12px 10px",
  },
  composerInner: {
    borderRadius: 18,
    border: "1px solid var(--border-subtle)",
    overflow: "hidden",
  },
  composerBody: {
    padding: "10px 14px 6px",
  },
  composerFooter: {
    padding: "6px 10px 8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  composerPills: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap" as const,
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 400,
    cursor: "default",
  },
  submitBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    cursor: "default",
    color: "var(--text-inverse)",
    background: "var(--bg-primary)",
  },
} as const;

const THREADS = [
  { title: "Reading notes on Thinking, Fast and Slow", meta: "All Sources · QMD · Apr 18", active: true },
  { title: "Weekly review highlights", meta: "Books · QMD · Apr 15" },
  { title: "My project ideas list", meta: "Projects · QMD · Apr 12" },
  { title: "Goals for Q2 2026", meta: "All Sources · QMD · Apr 10" },
];

export default function HeroSection() {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-eyebrow">
          <span className="pill">
            <span className="pill-dot" />
            Self-hosted · Private
          </span>
        </div>
        <h1 className="hero-h1">
          Your knowledge,
          <br />
          always within reach.
        </h1>
        <p className="hero-sub">
          A personal knowledge system that mirrors your Obsidian vault from S3, indexes it with QMD,
          and exposes a secure web UI for grounded retrieval.
        </p>
        <div className="hero-actions">
          <a href="https://github.com/MihirSahu/lattice" className="btn-ghost" target="_blank" rel="noreferrer">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
            View on GitHub
          </a>
        </div>

        {/* ── Mock UI ──────────────────────────────────────────────── */}
        <div className="hero-mock-wrap">
          <div className="mock-ui" style={{ maxWidth: 860, borderRadius: 16, overflow: "hidden", border: "1px solid var(--border-subtle)", background: "var(--bg-panel)", boxShadow: "var(--shadow-mock)" }}>

            {/* macOS title bar */}
            <div className="mock-titlebar">
              <span className="mock-dot mock-dot-r" />
              <span className="mock-dot mock-dot-y" />
              <span className="mock-dot mock-dot-g" />
              <span className="mock-titlebar-label">lattice — vault conversations</span>
            </div>

            {/* App shell */}
            <div style={{ display: "flex", height: 420 }}>

              {/* ── Sidebar ── */}
              <div style={s.sidebar}>
                <div style={s.sidebarHeader}>
                  {/* Brand */}
                  <div style={s.brandRow}>
                    <div style={s.iconBox}>
                      <LatticeMark style={{ width: 16, height: 16 }} />
                    </div>
                    <div style={s.brandText}>
                      <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: "var(--text-primary)" }}>Lattice</span>
                      <span style={{ fontSize: 11.5, lineHeight: 1.4, color: "var(--text-tertiary)" }}>Scoped vault conversations</span>
                    </div>
                  </div>
                  {/* New chat button */}
                  <button className="sidebar-primary-button" style={s.newChatBtn}>
                    <IconMessageSquarePlus />
                    New chat
                  </button>
                </div>

                {/* Thread list */}
                <div style={s.sidebarContent}>
                  <div style={s.sectionLabel}>Current chat</div>
                  <div style={{ ...s.threadRow, background: "var(--bg-surface-hover)" }}>
                    <span style={s.threadTitle}>{THREADS[0].title}</span>
                    <span style={s.threadMeta}>{THREADS[0].meta}</span>
                  </div>

                  <div style={{ ...s.sectionLabel, marginTop: 6 }}>Previous chats</div>
                  {THREADS.slice(1).map((t) => (
                    <div key={t.title} style={s.threadRow}>
                      <span style={s.threadTitleMuted}>{t.title}</span>
                      <span style={s.threadMeta}>{t.meta}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Main panel ── */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

                {/* Navbar */}
                <div className="chat-navbar-shell" style={s.navbar}>
                  <div style={s.navLeft}>
                    <div style={s.navIconBtn}>
                      <IconPanelLeftClose />
                    </div>
                    <div style={s.navTitleBlock}>
                      <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        Reading notes on Thinking, Fast and Slow
                      </span>
                      <span style={{ fontSize: 11.5, lineHeight: 1.4, color: "var(--text-tertiary)" }}>
                        All Sources · QMD
                      </span>
                    </div>
                  </div>
                  <span className="linear-pill" style={s.chatModePill}>
                    Chat mode
                  </span>
                </div>

                {/* Messages */}
                <div style={s.messagesArea}>
                  {/* User message */}
                  <div style={s.userMsg}>
                    <div style={s.msgLabel}>Prompt</div>
                    <p style={s.userText}>
                      What are my reading notes on Thinking, Fast and Slow?
                    </p>
                  </div>

                  {/* Assistant message */}
                  <div>
                    <div style={s.msgLabel}>Answer</div>
                    <p style={s.answerText}>
                      Your notes cover Kahneman&apos;s two-system framework. System 1 operates automatically with little effort, while System 2 allocates attention to effortful activities. Key highlights include the availability heuristic, anchoring effects, and the planning fallacy.
                    </p>
                    <div style={s.answerFooter}>
                      <span>QMD</span>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span>All Sources</span>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span>1.2s</span>
                    </div>
                  </div>
                </div>

                {/* Composer */}
                <div className="chat-composer-dock" style={s.composerWrap}>
                  <div className="chat-composer-docked" style={s.composerInner}>
                    {/* Body */}
                    <div style={s.composerBody}>
                      <span style={{ fontSize: 15, color: "var(--text-tertiary)", display: "block", padding: "2px 0" }}>
                        Ask Lattice
                      </span>
                    </div>
                    {/* Footer */}
                    <div style={s.composerFooter}>
                      <div style={s.composerPills}>
                        <span className="linear-pill" style={s.pill}>QMD</span>
                        <span className="linear-pill" style={s.pill}>
                          <IconGlobe />
                          All Sources
                        </span>
                      </div>
                      <div style={s.submitBtn}>
                        <IconArrowUp />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
