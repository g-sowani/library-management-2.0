import React from 'react';
import { useNavigate } from 'react-router-dom';

// ── Icons (feather-style, matches TopBar / Onboarding) ─────────────────────────

function BookOpenIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

const FEATURES = [
  {
    title: 'Borrow Books',
    desc: "Borrow from the full catalogue and keep what you need for the loan period.",
    image: '/service_borrow.jpg',
  },
  {
    title: 'Reserve a Copy',
    desc: 'All copies checked out? Join the queue and get first dibs when one is returned.',
    image: '/service_reserve.jpg',
  },
  {
    title: 'AI Search',
    desc: "Describe what you're in the mood for and let AI find the right match.",
    image: '/service_ai_search.jpg',
  },
  {
    title: 'Personalized Picks',
    desc: "Recommendations built from what you've read and rated.",
    image: '/service_picks.jpg',
  },
  {
    title: 'Reading Communities',
    desc: 'Join Gold-tier communities to discuss and share with fellow readers.',
    image: '/service_community.jpg',
  },
  {
    title: 'Donate & Earn',
    desc: 'Turn books you own into library credit.',
    image: '/service_donate.jpg',
  },
];

function LandingPage() {
  const navigate = useNavigate();

  const goToLogin = () => navigate('/login');
  const goToRegister = () => navigate('/login', { state: { register: true } });

  return (
    <div className="landing-page">
      <div className="landing-nav">
        <div className="landing-brand">Library</div>
        <div className="landing-nav-actions">
          <button className="btn btn-outline btn-sm" onClick={goToLogin}>Sign In</button>
          <button className="btn btn-sm" onClick={goToRegister}>Get Started</button>
        </div>
      </div>

      <div className="landing-hero">
        <div className="landing-hero-eyebrow">Library Management, Reimagined</div>
        <h1 className="landing-hero-title">Read more.<br />Manage less.</h1>
        <p className="landing-hero-sub">
          One system for members to discover, borrow, and discuss books — and for
          admins to run the whole catalogue without the busywork.
        </p>
        <div className="landing-cta-row">
          <button className="btn" onClick={goToRegister}>Get Started — it's free</button>
          <button className="btn btn-outline" onClick={goToLogin}>Sign In</button>
        </div>
      </div>

      <div className="landing-photo-grid">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="landing-photo-card"
            style={{ backgroundImage: `url(${f.image})` }}
          >
            <div className="landing-photo-overlay">
              <div className="landing-photo-title">{f.title}</div>
              <div className="landing-photo-desc">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="landing-audience">
        <div className="landing-audience-card">
          <div className="landing-audience-icon"><BookOpenIcon /></div>
          <h3>For Members</h3>
          <ul className="onboarding-list">
            <li>Borrow, reserve, and return books with optional ratings &amp; reviews</li>
            <li>Discover new reads via AI search and personalized recommendations</li>
            <li>Track fines, membership tier, and borrowing history in one place</li>
            <li>Donate books for credit and join Gold-tier reading communities</li>
          </ul>
        </div>
        <div className="landing-audience-card">
          <div className="landing-audience-icon"><SlidersIcon /></div>
          <h3>For Admins</h3>
          <ul className="onboarding-list">
            <li>Manage the full book catalogue with AI-assisted metadata enrichment</li>
            <li>Monitor active borrows and configure the fine policy in real time</li>
            <li>Review member tiers, pricing, and donation submissions</li>
            <li>Approve or reject community proposals from Gold members</li>
          </ul>
        </div>
      </div>

      <div className="landing-cta-banner">
        <h2>Ready to start reading?</h2>
        <button className="btn landing-cta-banner-btn" onClick={goToRegister}>Create your account</button>
      </div>

      <div className="landing-footer">
        <span>Library Management System</span>
        <button className="landing-footer-link" onClick={goToLogin}>Sign In</button>
      </div>
    </div>
  );
}

export default LandingPage;
