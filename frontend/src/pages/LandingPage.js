import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

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

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const TIERS = [
  {
    id: 'silver',
    name: 'Silver',
    priceKey: 'silver_rate',
    tagline: 'Standard access for everyday readers',
    benefits: [
      'Borrow 1 book at a time',
      'Reserve, wishlist, and rate any title',
      'AI search & personalized recommendations',
      'Donate books to earn library credit',
    ],
  },
  {
    id: 'gold',
    name: 'Gold',
    priceKey: 'gold_rate',
    tagline: 'For members who read (and talk about it) often',
    featured: true,
    benefits: [
      'Borrow up to 3 books at once',
      'Everything in Silver',
      'Join Gold-only Reading Communities',
      'Book-themed games that build a cumulative XP score',
    ],
  },
  {
    id: 'family',
    name: 'Family',
    priceKey: 'family_rate',
    tagline: 'One plan for the whole household',
    benefits: [
      'Up to 4 members on one plan',
      '1 book at a time per member',
      'Everything in Silver, for every member',
      'A single monthly bill',
    ],
  },
];

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
  const [pricing, setPricing] = useState(null);

  useEffect(() => {
    api.get('/membership/pricing').then((r) => setPricing(r.data)).catch(() => {});
  }, []);

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
          One system for members to discover, borrow, and discuss books and for
          admins to run the whole catalogue without the busywork.
        </p>
        <div className="landing-cta-row">
          <button className="btn" onClick={goToRegister}>Get Started, it's free!</button>
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

      <div className="landing-tiers-section">
        <div className="landing-tiers-heading">
          <h2>Membership Tiers</h2>
          <p>Pick the plan that fits how you read. Upgrade or downgrade anytime.</p>
        </div>
        <div className="landing-tiers">
          {TIERS.map((t) => (
            <div
              key={t.id}
              className={`landing-tier-card${t.featured ? ' landing-tier-featured' : ''}`}
            >
              {t.featured && <div className="landing-tier-tag">Most Popular</div>}
              <h3>{t.name}</h3>
              <div className="landing-tier-price">
                {pricing ? `$${pricing[t.priceKey].toFixed(2)}` : '—'}
                <span className="landing-tier-price-period">/mo</span>
              </div>
              <p className="landing-tier-tagline">{t.tagline}</p>
              <ul className="landing-tier-benefits">
                {t.benefits.map((b) => (
                  <li key={b}>
                    <span className="landing-tier-check"><CheckIcon /></span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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
