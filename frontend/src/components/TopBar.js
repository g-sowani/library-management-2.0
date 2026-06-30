import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import UserAvatar from './UserAvatar';

// ── Icons ─────────────────────────────────────────────────────────────────────

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 4 13c0-7 7-11 7-11s7 4 7 11a7 7 0 0 1-7 7z"/>
      <line x1="11" y1="20" x2="11" y2="13"/>
    </svg>
  );
}

function WavesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2"/>
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2"/>
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2"/>
    </svg>
  );
}

function FlowerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z"/>
      <path d="M12 14a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z"/>
      <path d="M2 12a4 4 0 0 1 4-4 4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4z"/>
      <path d="M14 12a4 4 0 0 1 4-4 4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4z"/>
    </svg>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const APPEARANCE = [
  { key: 'light',  label: 'Light',  Icon: SunIcon },
  { key: 'system', label: 'System', Icon: MonitorIcon },
  { key: 'dark',   label: 'Dark',   Icon: MoonIcon },
];

const READER_THEMES = [
  { key: 'sepia',  label: 'Sepia',  Icon: BookIcon },
  { key: 'forest', label: 'Forest', Icon: LeafIcon },
  { key: 'ocean',  label: 'Ocean',  Icon: WavesIcon },
  { key: 'rose',   label: 'Rose',   Icon: FlowerIcon },
];

const TIER_LABEL = { silver: 'Silver', gold: 'Gold', family: 'Family' };
const TIER_CLASS = {
  silver: 'membership-badge-silver',
  gold:   'membership-badge-gold',
  family: 'membership-badge-family',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function TierBadge({ tier }) {
  if (!tier || !TIER_CLASS[tier]) return null;
  return <span className={`membership-badge ${TIER_CLASS[tier]}`}>{TIER_LABEL[tier]}</span>;
}

// ── TopBar ────────────────────────────────────────────────────────────────────

function TopBar({ title, username, avatar, tier, onLogout }) {
  const { appearance, setAppearance, readerTheme, setReaderTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="topbar">
      <h2>{title}</h2>

      <div className="topbar-right" ref={wrapRef}>
        <button
          className="topbar-avatar-btn"
          onClick={() => setOpen((o) => !o)}
          aria-label="Profile menu"
          aria-expanded={open}
        >
          <UserAvatar avatar={avatar} username={username} size={32} />
        </button>

        {open && (
          <div className="profile-dropdown">
            {/* User header */}
            <div className="pd-header">
              <UserAvatar avatar={avatar} username={username} size={46} />
              <div className="pd-header-info">
                <div className="pd-username">{username}</div>
                {tier && <TierBadge tier={tier} />}
              </div>
            </div>

            <div className="pd-divider" />

            {/* Appearance */}
            <div className="pd-section-label">Appearance</div>
            <div className="pd-options-row">
              {APPEARANCE.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  className={`pd-option${appearance === key ? ' pd-option-active' : ''}`}
                  onClick={() => setAppearance(key)}
                  title={label}
                >
                  <Icon />
                  {label}
                </button>
              ))}
            </div>

            <div className="pd-divider" />

            {/* Reader Themes */}
            <div className="pd-section-label">Reader Themes</div>
            <div className="pd-options-row">
              {READER_THEMES.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  className={`pd-option${readerTheme === key ? ' pd-option-active' : ''}`}
                  onClick={() => setReaderTheme(readerTheme === key ? '' : key)}
                  title={label}
                >
                  <Icon />
                  {label}
                </button>
              ))}
            </div>

            <div className="pd-divider" />

            {/* Sign out */}
            <button
              className="pd-item pd-signout"
              onClick={() => { setOpen(false); onLogout(); }}
            >
              <span className="pd-item-icon"><SignOutIcon /></span>
              <span className="pd-item-label">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TopBar;
