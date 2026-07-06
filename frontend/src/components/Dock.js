import React from 'react';

// ── Icons ─────────────────────────────────────────────────────────────────────

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

function BooksIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function CommunityIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function GamesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <circle cx="15.5" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="13.5" r="0.9" fill="currentColor" stroke="none" />
      <rect x="2" y="6" width="20" height="12" rx="6" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function BorrowsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  );
}

function FinesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H7" />
    </svg>
  );
}

function MembersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function DonationsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="4" />
      <path d="M12 9v12" />
      <path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
      <path d="M12 9c-1.5-3-3.5-4-5-3s-1 3.5 0 4.5 3.5 0.5 5-1.5z" />
      <path d="M12 9c1.5-3 3.5-4 5-3s1 3.5 0 4.5-3.5 0.5-5-1.5z" />
    </svg>
  );
}

function MembershipRequestsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="7" y1="9" x2="17" y2="9" />
      <line x1="7" y1="13" x2="13" y2="13" />
      <polyline points="7 17 9 19 13 15" />
    </svg>
  );
}

const ICONS = {
  home: HomeIcon,
  books: BooksIcon,
  community: CommunityIcon,
  games: GamesIcon,
  profile: ProfileIcon,
  borrows: BorrowsIcon,
  fines: FinesIcon,
  members: MembersIcon,
  communities: CommunityIcon,
  donations: DonationsIcon,
  "membership-requests": MembershipRequestsIcon,
};

function Dock({ tabs, active, onChange, badges = {} }) {
  return (
    <div className="dock-wrap">
      <div className="dock">
        {tabs.map(({ id, label }) => {
          const Icon = ICONS[id] || MembersIcon;
          const isActive = active === id;
          return (
            <button
              key={id}
              className={`dock-item${isActive ? ' dock-item-active' : ''}`}
              onClick={() => onChange(id)}
              title={label}
              aria-label={label}
              aria-current={isActive}
            >
              <span className="dock-icon"><Icon /></span>
              {badges[id] > 0 && (
                <span className="dock-badge">{badges[id] > 99 ? '99+' : badges[id]}</span>
              )}
              <span className="dock-dot" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Dock;
