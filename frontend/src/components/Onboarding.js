import React, { useEffect, useRef, useState } from 'react';

// ── Icons (feather-style, matches TopBar's icon set) ──────────────────────────

function CompassIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21 12 16 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function AwardIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M8.5 13.5 7 22l5-3 5 3-1.5-8.5" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function UserCircleIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.2 18.5a6 6 0 0 1 11.6 0" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5.5a4 4 0 0 0-4-2H10a3.5 3.5 0 0 0 0 7h4a3.5 3.5 0 0 1 0 7h-3a4 4 0 0 1-4-2" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function MessageCircleIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

// ── Step content ────────────────────────────────────────────────────────────
// Steps with a `target` (a `[data-tour="…"]` selector) are shown as a spotlight
// callout anchored to that element; steps without one render as a centered
// welcome/closing card. `tab`, if set, is switched to before the step is shown.

function buildMemberSteps(username) {
  return [
    {
      icon: CompassIcon,
      eyebrow: 'Getting Started',
      title: `Welcome to the Library, ${username}`,
      body: "A quick guided look at what you can do here — we'll highlight each feature as we go.",
    },
    {
      icon: SearchIcon,
      eyebrow: 'Available Books',
      title: 'Find your next read',
      tab: 'books',
      target: '[data-tour="member-search"]',
      body: [
        'Search by title, author, or genre, or open Filters for availability and rating.',
        'Try AI Search — describe a book in plain language and let it find matches.',
      ],
    },
    {
      icon: BookmarkIcon,
      eyebrow: 'Borrowing',
      title: 'Borrow, reserve, and return',
      tab: 'books',
      target: '[data-tour="member-genres"]',
      body: [
        'Browse by genre, then open any book to borrow it — or reserve your spot if every copy is out.',
        'When you return a book, you can leave an optional star rating and review, anonymously if you like.',
      ],
    },
    {
      icon: AwardIcon,
      eyebrow: 'Membership',
      title: 'Your tier sets your limit',
      tab: 'profile',
      target: '[data-tour="member-membership"]',
      body: 'Silver members can borrow 1 book at a time, Gold up to 3, and Family plans share 1 per person across up to 4 accounts. Gold membership also unlocks Reading Communities.',
    },
    {
      icon: GiftIcon,
      eyebrow: 'Donations',
      title: 'Turn your old books into credit',
      tab: 'profile',
      target: '[data-tour="member-donations"]',
      body: "Submit books you own right here. Once an admin approves the donation, it's added to the catalogue and you earn credit toward your account.",
    },
    {
      icon: UserCircleIcon,
      eyebrow: 'My Profile',
      title: 'Everything in one place',
      body: 'Track your borrowed books, reservations, fines, and donation history — and update your avatar — right from your Profile tab.',
      cta: 'Start exploring',
    },
  ];
}

function buildAdminSteps(username) {
  return [
    {
      icon: CompassIcon,
      eyebrow: 'Admin Console',
      title: `Welcome back, ${username}`,
      body: "A quick guided tour of what you're in charge of as an administrator.",
    },
    {
      icon: EditIcon,
      eyebrow: 'Books',
      title: 'Manage the catalogue',
      tab: 'books',
      target: '[data-tour="admin-books"]',
      body: 'Add, edit, or remove books. Use Refresh to pull descriptions, author bios, and cover art automatically, or generate missing fields with AI.',
    },
    {
      icon: BookmarkIcon,
      eyebrow: 'Borrowed Books',
      title: "See what's out on loan",
      tab: 'borrows',
      target: '[data-tour="admin-borrows"]',
      body: 'Every active borrow at a glance, with borrower, borrow date, due date, and overdue status.',
    },
    {
      icon: DollarIcon,
      eyebrow: 'Fines',
      title: 'Track and settle fines',
      tab: 'fines',
      target: '[data-tour="admin-fines"]',
      body: 'Mark fines as paid, and adjust the fine-per-day and loan-length policy anytime — changes apply instantly, no restart needed.',
    },
    {
      icon: UsersIcon,
      eyebrow: 'Members',
      title: 'Members and tiers',
      tab: 'members',
      target: '[data-tour="admin-members"]',
      body: 'Review every member, change their membership tier, and adjust Silver / Gold / Family pricing.',
    },
    {
      icon: InboxIcon,
      eyebrow: 'Donations',
      title: 'Review member donations',
      tab: 'donations',
      target: '[data-tour="admin-donations"]',
      body: 'Approve submissions to add them to the catalogue and award credit, or reject them with a reason.',
    },
    {
      icon: MessageCircleIcon,
      eyebrow: 'Communities',
      title: 'Moderate reading communities',
      tab: 'communities',
      target: '[data-tour="admin-communities"]',
      body: 'Gold members can propose communities — approve to let them go live, or reject with a note.',
    },
    {
      icon: AwardIcon,
      eyebrow: 'All Set',
      title: "You're ready to go",
      body: 'You can replay this tour anytime from your profile menu.',
      cta: 'Get started',
    },
  ];
}

// ── Layout constants ────────────────────────────────────────────────────────

const TOOLTIP_WIDTH = 320;
const VIEWPORT_MARGIN = 16;
const TARGET_GAP = 14;

// ── Shared bits ─────────────────────────────────────────────────────────────

function ProgressDots({ steps, step }) {
  return (
    <div className="onboarding-progress">
      {steps.map((_, i) => (
        <span key={i} className={`onboarding-dot${i === step ? ' onboarding-dot-active' : ''}`} />
      ))}
    </div>
  );
}

function StepFooter({ step, isLast, cta, onBack, onNext }) {
  return (
    <div className="onboarding-footer">
      <button
        className="btn btn-outline btn-sm"
        onClick={onBack}
        style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
      >
        Back
      </button>
      <button className="btn btn-sm" onClick={onNext}>
        {isLast ? cta : 'Next'}
      </button>
    </div>
  );
}

function StepBody({ current }) {
  return Array.isArray(current.body) ? (
    <ul className="onboarding-list">
      {current.body.map((line, i) => <li key={i}>{line}</li>)}
    </ul>
  ) : (
    <p className="onboarding-body">{current.body}</p>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

function Onboarding({ role, username, onClose, onNavigate }) {
  const steps = role === 'admin' ? buildAdminSteps(username) : buildMemberSteps(username);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const rafRef = useRef(null);

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Switch to the step's tab (if any) and track its target element's position
  // on screen so the spotlight + callout can follow it — including through the
  // tab switch itself, window resizes, and any scrolling.
  useEffect(() => {
    if (current.tab && onNavigate) onNavigate(current.tab);

    if (!current.target) {
      setRect(null);
      return undefined;
    }

    const measure = () => {
      const el = document.querySelector(current.target);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    // Give the tab switch a moment to render before scrolling/measuring.
    const scrollTimer = setTimeout(() => {
      document.querySelector(current.target)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      measure();
    }, 60);

    const onScrollOrResize = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      clearTimeout(scrollTimer);
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [step]); // eslint-disable-line

  const spotlighting = !!rect;

  // Compute the callout's position from the live target rect — `bottom` is
  // used (instead of a measured height) for the "above" placement so no
  // second render pass is needed to know the callout's own height.
  let tooltipStyle = null;
  let placement = 'below';
  if (rect) {
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    placement = spaceBelow >= 240 || rect.top < 240 ? 'below' : 'above';
    let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN));
    tooltipStyle = { left };
    if (placement === 'below') {
      tooltipStyle.top = rect.top + rect.height + TARGET_GAP;
    } else {
      tooltipStyle.bottom = window.innerHeight - rect.top + TARGET_GAP;
    }
  }

  return (
    <div className={`onboarding-overlay${spotlighting ? ' tour-active' : ''}`}>
      {spotlighting && (
        <div
          className="tour-spotlight"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}

      {spotlighting ? (
        <div className="tour-tooltip" data-placement={placement} style={tooltipStyle}>
          <button className="onboarding-skip" onClick={onClose}>Skip</button>
          <div key={step} className="tour-tooltip-anim">
            <div className="tour-tooltip-header">
              <span className="tour-tooltip-icon"><Icon /></span>
              <span className="onboarding-eyebrow tour-tooltip-eyebrow">{current.eyebrow}</span>
            </div>
            <h3 className="onboarding-title">{current.title}</h3>
            <StepBody current={current} />
          </div>
          <ProgressDots steps={steps} step={step} />
          <StepFooter
            step={step}
            isLast={isLast}
            cta={current.cta}
            onBack={() => setStep((s) => s - 1)}
            onNext={() => (isLast ? onClose() : setStep((s) => s + 1))}
          />
        </div>
      ) : (
        <div className="onboarding-card">
          <button className="onboarding-skip" onClick={onClose}>Skip</button>

          <div key={step} className="onboarding-content tour-tooltip-anim">
            <div className="onboarding-icon-badge">
              <Icon />
            </div>
            <div className="onboarding-eyebrow">{current.eyebrow}</div>
            <h3 className="onboarding-title">{current.title}</h3>
            <StepBody current={current} />
          </div>

          <ProgressDots steps={steps} step={step} />
          <StepFooter
            step={step}
            isLast={isLast}
            cta={current.cta}
            onBack={() => setStep((s) => s - 1)}
            onNext={() => (isLast ? onClose() : setStep((s) => s + 1))}
          />
        </div>
      )}
    </div>
  );
}

export default Onboarding;
