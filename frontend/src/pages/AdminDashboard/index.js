import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import TopBar from "../../components/TopBar";
import NavTabs from "../../components/NavTabs";
import Dock from "../../components/Dock";
import Toast from "../../components/Toast";
import Onboarding from "../../components/Onboarding";
import { useToast } from "../../hooks/useToast";
import { useTheme } from "../../context/ThemeContext";
import CommunitiesTab from "./tabs/CommunitiesTab";
import DonationsTab from "./tabs/DonationsTab";
import BorrowsTab from "./tabs/BorrowsTab";
import FinesTab from "./tabs/FinesTab";
import MembersTab from "./tabs/members/MembersTab";
import BooksTab from "./tabs/books/BooksTab";
import MyLibraryTab from "./tabs/MyLibraryTab";
import ReAuthModal from "./shared/ReAuthModal";

const TABS = [
  { id: "books", label: "Books" },
  { id: "borrows", label: "Borrowed Books" },
  { id: "fines", label: "Fines" },
  { id: "members", label: "Members" },
  { id: "communities", label: "Communities" },
  { id: "donations", label: "Donations" },
  { id: "library", label: "My Library" },
];

function AdminDashboard() {
  const { user, logout } = useAuth();
  const { navStyle } = useTheme();
  const [tab, setTab] = useState("books");
  const [borrows, setBorrows] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Members
  const [members, setMembers] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);

  const { toasts, toast } = useToast();

  // Re-auth modal (for sensitive admin actions) — reAuthActionRef holds the
  // pending callback to run once the password is verified.
  const [reAuthFor, setReAuthFor] = useState(false);
  const [reAuthPassword, setReAuthPassword] = useState("");
  const [reAuthError, setReAuthError] = useState("");
  const [reAuthLoading, setReAuthLoading] = useState(false);
  const reAuthActionRef = useRef(null);

  // Donations
  const [donations, setDonations] = useState([]);
  const [donationsLoaded, setDonationsLoaded] = useState(false);

  // Membership requests
  const [membershipRequests, setMembershipRequests] = useState([]);
  const [membershipRequestsLoaded, setMembershipRequestsLoaded] =
    useState(false);

  // Book requests
  const [bookRequests, setBookRequests] = useState([]);
  const [bookRequestsLoaded, setBookRequestsLoaded] = useState(false);

  // Communities
  const [adminCommunities, setAdminCommunities] = useState([]);
  const [adminCommunitiesLoaded, setAdminCommunitiesLoaded] = useState(false);

  const load = useCallback(() => {
    setLoadError("");
    return api.get("/admin/borrows").then((r) => setBorrows(r.data));
  }, []);

  useEffect(() => {
    load().catch(() =>
      setLoadError("Failed to load data. Is the server running?")
    );
    // "books" is the default tab, so its Book Requests section needs its
    // own fetch here — every other tab's lazily-loaded data is instead
    // kicked off from handleTabChange when the admin first switches to it.
    loadBookRequests();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    if (!localStorage.getItem(`onboarding_seen_${user.username}`)) {
      setShowOnboarding(true);
    }
  }, [user]);

  const closeOnboarding = () => {
    localStorage.setItem(`onboarding_seen_${user.username}`, "true");
    setShowOnboarding(false);
  };

  const loadMembers = useCallback(() => {
    api.get("/admin/members").then((r) => {
      setMembers(r.data);
      setMembersLoaded(true);
    });
  }, []);

  const loadDonations = useCallback((status) => {
    const qs = status ? `?status=${status}` : "";
    api.get(`/admin/donations${qs}`).then((r) => {
      setDonations(r.data);
      setDonationsLoaded(true);
    });
  }, []);

  const loadAdminCommunities = useCallback((status) => {
    const qs = status ? `?status=${status}` : "";
    api.get(`/admin/communities${qs}`).then((r) => {
      setAdminCommunities(r.data);
      setAdminCommunitiesLoaded(true);
    });
  }, []);

  const loadMembershipRequests = useCallback((status) => {
    const qs = status ? `?status=${status}` : "";
    api.get(`/admin/membership-requests${qs}`).then((r) => {
      setMembershipRequests(r.data);
      setMembershipRequestsLoaded(true);
    });
  }, []);

  const loadBookRequests = useCallback((status) => {
    const qs = status ? `?status=${status}` : "";
    api.get(`/admin/book-requests${qs}`).then((r) => {
      setBookRequests(r.data);
      setBookRequestsLoaded(true);
    });
  }, []);

  // ── Re-auth (for sensitive admin actions like saving policy/pricing) ──
  const openReAuth = (e, action) => {
    e.preventDefault();
    reAuthActionRef.current = action;
    setReAuthFor(true);
    setReAuthPassword("");
    setReAuthError("");
  };

  const confirmReAuth = async () => {
    setReAuthError("");
    setReAuthLoading(true);
    try {
      await api.post("/admin/verify-password", { password: reAuthPassword });
    } catch {
      setReAuthError("Incorrect password. Please try again.");
      setReAuthLoading(false);
      return;
    }
    setReAuthLoading(false);
    const action = reAuthActionRef.current;
    reAuthActionRef.current = null;
    setReAuthFor(false);
    if (action) await action();
  };

  const handleTabChange = (t) => {
    setTab(t);

    if (t === "members") {
      loadMembers();
      loadMembershipRequests();
    }
    if (t === "donations") loadDonations();
    if (t === "communities") loadAdminCommunities();
    if (t === "books") loadBookRequests();
  };

  const memberStats = useMemo(() => {
    const tierCounts = { none: 0, silver: 0, gold: 0, family: 0 };
    let currentlyBorrowed = 0;
    let finesPending = 0;
    let finesPaid = 0;
    for (const m of members) {
      tierCounts[m.membership_tier || "none"] += 1;
      currentlyBorrowed += m.currently_borrowed || 0;
      finesPending += m.fines_pending || 0;
      finesPaid += m.fines_paid || 0;
    }
    const tiers = [
      { key: "none", label: "None" },
      { key: "silver", label: "Silver" },
      { key: "gold", label: "Gold" },
      { key: "family", label: "Family" },
    ].map((t) => ({ ...t, count: tierCounts[t.key] }));
    const maxTierCount = Math.max(1, ...tiers.map((t) => t.count));

    const topBorrowers = [...members]
      .filter((m) => m.total_borrows > 0)
      .sort((a, b) => b.total_borrows - a.total_borrows)
      .slice(0, 5);
    const maxBorrows = Math.max(1, ...topBorrowers.map((m) => m.total_borrows));

    return {
      totalMembers: members.length,
      currentlyBorrowed,
      finesPending,
      finesPaid,
      tiers,
      maxTierCount,
      topBorrowers,
      maxBorrows,
    };
  }, [members]);

  const pendingBookRequests = bookRequests.filter(
    (r) => r.status === "pending"
  );

  const pendingMembershipRequests = membershipRequests.filter(
    (r) => r.status === "pending"
  );

  const pendingReturnRequests = borrows.filter((b) => b.return_requested_at);

  const tabDots = {
    books: pendingBookRequests.length > 0,
    borrows: pendingReturnRequests.length > 0,
    fines: memberStats.finesPending > 0,
    members: pendingMembershipRequests.length > 0,
    communities: adminCommunities.some((c) => c.status === "pending"),
    donations: donations.some((d) => d.status === "pending"),
  };

  return (
    <>
      {showOnboarding && (
        <Onboarding
          role="admin"
          username={user.username}
          onClose={closeOnboarding}
          onNavigate={handleTabChange}
        />
      )}
      <div className={`layout${navStyle === "dock" ? " layout-nav-dock" : ""}`}>
        <div className="dashboard-header">
          <TopBar
            title="Library Admin"
            username={user.username}
            library={user.library}
            onLogout={logout}
            onReplayTour={() => setShowOnboarding(true)}
          />
          {navStyle !== "dock" && (
            <NavTabs
              tabs={TABS}
              active={tab}
              onChange={handleTabChange}
              dots={tabDots}
            />
          )}
        </div>
        {navStyle === "dock" && (
          <Dock
            tabs={TABS}
            active={tab}
            onChange={handleTabChange}
            dots={tabDots}
          />
        )}
        <div className="content">
          {loadError && <div className="error">{loadError}</div>}

          {/* ── Books ── */}
          {tab === "books" && (
            <BooksTab
              bookRequests={bookRequests}
              bookRequestsLoaded={bookRequestsLoaded}
              pendingBookRequests={pendingBookRequests}
              onReloadBookRequests={loadBookRequests}
              toast={toast}
            />
          )}
          {/* ── Borrowed Books ── */}
          {tab === "borrows" && (
            <BorrowsTab borrows={borrows} setBorrows={setBorrows} toast={toast} />
          )}

          {/* ── Fines ── */}
          {tab === "fines" && (
            <FinesTab toast={toast} />
          )}
          {/* ── Members ── */}
          {tab === "members" && (
            <MembersTab
              members={members}
              membersLoaded={membersLoaded}
              membershipRequests={membershipRequests}
              membershipRequestsLoaded={membershipRequestsLoaded}
              memberStats={memberStats}
              pendingMembershipRequests={pendingMembershipRequests}
              onReloadMembers={loadMembers}
              onReloadMembershipRequests={loadMembershipRequests}
              toast={toast}
            />
          )}

          {/* ── Communities ── */}
          {tab === "communities" && (
            <CommunitiesTab
              adminCommunities={adminCommunities}
              adminCommunitiesLoaded={adminCommunitiesLoaded}
              onReload={loadAdminCommunities}
              toast={toast}
            />
          )}

          {/* ── Donations ── */}
          {tab === "donations" && (
            <DonationsTab
              donations={donations}
              donationsLoaded={donationsLoaded}
              onReload={loadDonations}
              toast={toast}
            />
          )}

          {/* ── My Library ── */}
          {tab === "library" && (
            <MyLibraryTab toast={toast} onOpenReAuth={openReAuth} />
          )}
        </div>

        {reAuthFor && (
          <ReAuthModal
            reAuthPassword={reAuthPassword}
            setReAuthPassword={setReAuthPassword}
            reAuthError={reAuthError}
            reAuthLoading={reAuthLoading}
            onConfirm={confirmReAuth}
            onClose={() => setReAuthFor(false)}
          />
        )}
        <Toast toasts={toasts} />

      </div>
    </>
  );
}

export default AdminDashboard;
