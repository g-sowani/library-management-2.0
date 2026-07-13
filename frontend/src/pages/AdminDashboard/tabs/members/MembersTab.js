import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../../../api";
import Select from "../../../../components/Select";
import ActionMenu from "../../../../components/ActionMenu";
import ColumnFilterArrow from "../../../../components/icons/ColumnFilterArrow";
import TagIcon from "../../../../components/icons/TagIcon";
import MemberRecordsModal from "./MemberRecordsModal";
import MembershipRequestModals from "./MembershipRequestModals";
import MemberOverviewStats from "./MemberOverviewStats";
import MembershipRequestHistorySection from "./MembershipRequestHistorySection";
import SearchBar from "../../../../components/SearchBar";
import { useAuth } from "../../../../context/AuthContext";
import { formatCurrency } from "../../../../utils/currency";

function MembersTab({
  members,
  membersLoaded,
  membershipRequests,
  membershipRequestsLoaded,
  memberStats,
  pendingMembershipRequests,
  onReloadMembers,
  onReloadMembershipRequests,
  toast,
}) {
  const { user } = useAuth();
  const currency = user?.library?.currency;
  const [memberSearch, setMemberSearch] = useState("");
  const [memberUsernameFilter, setMemberUsernameFilter] = useState("");
  const [memberTierFilter, setMemberTierFilter] = useState("");
  const [openMemberFilter, setOpenMemberFilter] = useState(null); // 'username' | 'tier' | null
  const [memberFilterSearch, setMemberFilterSearch] = useState("");
  const memberFilterBtnRef = useRef(null);
  const memberFilterSearchRef = useRef(null);

  const [selectedMember, setSelectedMember] = useState(null);
  const [memberBorrows, setMemberBorrows] = useState([]);
  const [memberBorrowsLoading, setMemberBorrowsLoading] = useState(false);

  const [membershipRequestHistoryOpen, setMembershipRequestHistoryOpen] = useState(false);
  const [membershipRequestHistoryFilter, setMembershipRequestHistoryFilter] = useState("");

  const [approvingMembershipRequest, setApprovingMembershipRequest] = useState(null);
  const [approveMembershipNotes, setApproveMembershipNotes] = useState("");
  const [approveMembershipError, setApproveMembershipError] = useState("");
  const [rejectingMembershipRequest, setRejectingMembershipRequest] = useState(null);
  const [rejectMembershipNotes, setRejectMembershipNotes] = useState("");
  const [rejectMembershipError, setRejectMembershipError] = useState("");

  const openMember = async (member) => {
    setSelectedMember(member);
    setMemberBorrows([]);
    setMemberBorrowsLoading(true);
    try {
      const res = await api.get(`/admin/members/${member.id}/borrows`);
      setMemberBorrows(res.data);
    } finally {
      setMemberBorrowsLoading(false);
    }
  };

  const changeMemberTier = async (memberId, tier) => {
    try {
      await api.put(`/admin/members/${memberId}/membership`, {
        tier: tier || null,
      });
      onReloadMembers();
      toast("Tier updated");
    } catch (err) {
      toast(err.response?.data?.error || "Failed to update tier", "error");
    }
  };

  const openApproveMembershipRequest = (req) => {
    setApprovingMembershipRequest(req);
    setApproveMembershipNotes("");
    setApproveMembershipError("");
  };

  const submitApproveMembershipRequest = async (e) => {
    e.preventDefault();
    setApproveMembershipError("");
    try {
      await api.put(
        `/admin/membership-requests/${approvingMembershipRequest.id}/approve`,
        { admin_notes: approveMembershipNotes }
      );
      setApprovingMembershipRequest(null);
      onReloadMembershipRequests();
      toast("Membership request approved");
    } catch (err) {
      setApproveMembershipError(
        err.response?.data?.error || "Failed to approve request"
      );
    }
  };

  const openRejectMembershipRequest = (req) => {
    setRejectingMembershipRequest(req);
    setRejectMembershipNotes("");
    setRejectMembershipError("");
  };

  const submitRejectMembershipRequest = async (e) => {
    e.preventDefault();
    setRejectMembershipError("");
    try {
      await api.put(
        `/admin/membership-requests/${rejectingMembershipRequest.id}/reject`,
        { admin_notes: rejectMembershipNotes }
      );
      setRejectingMembershipRequest(null);
      onReloadMembershipRequests();
      toast("Membership request rejected");
    } catch (err) {
      setRejectMembershipError(
        err.response?.data?.error || "Failed to reject request"
      );
    }
  };

  const memberUsernameOptions = useMemo(
    () => [...new Set(members.map((m) => m.username))].sort(),
    [members]
  );

  const filteredMembers = useMemo(
    () =>
      members.filter((m) => {
        const matchUsername =
          !memberUsernameFilter || m.username === memberUsernameFilter;
        const matchTier =
          !memberTierFilter ||
          (memberTierFilter === "none"
            ? !m.membership_tier
            : m.membership_tier === memberTierFilter);
        const q = memberSearch.trim().toLowerCase();
        const matchSearch = !q || m.username?.toLowerCase().includes(q);
        return matchUsername && matchTier && matchSearch;
      }),
    [members, memberUsernameFilter, memberTierFilter, memberSearch]
  );

  const hasMemberFilters = memberUsernameFilter || memberTierFilter;
  const clearMemberFilters = () => {
    setMemberUsernameFilter("");
    setMemberTierFilter("");
  };

  const historyMembershipRequests = membershipRequests.filter(
    (r) =>
      r.status !== "pending" &&
      (!membershipRequestHistoryFilter ||
        r.status === membershipRequestHistoryFilter)
  );

  const memberFilterMenus = {
    username: {
      value: memberUsernameFilter,
      setValue: setMemberUsernameFilter,
      options: [
        { value: "", label: "All members" },
        ...memberUsernameOptions.map((username) => ({
          value: username,
          label: username,
        })),
      ],
    },
    tier: {
      value: memberTierFilter,
      setValue: setMemberTierFilter,
      options: [
        { value: "", label: "All tiers" },
        { value: "none", label: "None" },
        { value: "silver", label: "Silver" },
        { value: "gold", label: "Gold" },
        { value: "family", label: "Family" },
      ],
    },
  };

  const toggleMemberFilter = (column) => {
    setOpenMemberFilter((prev) => (prev === column ? null : column));
    setMemberFilterSearch("");
  };

  const visibleMemberFilterOptions = openMemberFilter
    ? memberFilterMenus[openMemberFilter].options.filter(
        (opt) =>
          opt.value === "" ||
          opt.label
            .toLowerCase()
            .includes(memberFilterSearch.trim().toLowerCase())
      )
    : [];

  useEffect(() => {
    if (openMemberFilter) memberFilterSearchRef.current?.focus();
  }, [openMemberFilter]);

  return (
    <>
      {membershipRequestsLoaded && pendingMembershipRequests.length > 0 && (
        <>
          <div className="section-header">
            <h3>Membership Requests</h3>
            <span
              className="fine-amount"
              style={{ fontSize: "0.9rem", fontWeight: 600 }}
            >
              {pendingMembershipRequests.length} pending
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Requested Tier</th>
                <th>Notes</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pendingMembershipRequests.map((r) => (
                <tr key={r.id}>
                  <td>{r.username}</td>
                  <td>
                    <span
                      className={`membership-badge membership-badge-${r.requested_tier}`}
                    >
                      {r.requested_tier.charAt(0).toUpperCase() +
                        r.requested_tier.slice(1)}
                    </span>
                  </td>
                  <td>{r.notes || <span className="muted">—</span>}</td>
                  <td>
                    {new Date(r.submitted_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="btn-row">
                      <button
                        className="btn btn-sm"
                        onClick={() => openApproveMembershipRequest(r)}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => openRejectMembershipRequest(r)}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <MemberOverviewStats memberStats={memberStats} />

      <div
        className="section-header"
        style={{ marginTop: 40 }}
        data-tour="admin-members"
      >
        <h3>Member Records</h3>
        {hasMemberFilters && (
          <button
            className="btn btn-sm btn-outline"
            onClick={clearMemberFilters}
          >
            Clear filters
          </button>
        )}
      </div>
      <div className="search-top-bar" style={{ marginBottom: 20 }}>
        <SearchBar
          value={memberSearch}
          onChange={setMemberSearch}
          placeholder="Search by username…"
          className="search-bar-wide"
        />
      </div>
      {!membersLoaded ? (
        <div className="empty">Loading…</div>
      ) : members.length === 0 ? (
        <div className="empty">No members registered</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>
                <span className="th-filter-wrap">
                  Username
                  <button
                    type="button"
                    className={`th-filter-btn${
                      memberUsernameFilter ? " th-filter-btn-active" : ""
                    }`}
                    ref={
                      openMemberFilter === "username"
                        ? memberFilterBtnRef
                        : null
                    }
                    onClick={() => toggleMemberFilter("username")}
                    aria-label="Filter by username"
                    aria-expanded={openMemberFilter === "username"}
                  >
                    <ColumnFilterArrow />
                  </button>
                </span>
              </th>
              <th>
                <span className="th-filter-wrap">
                  Tier
                  <button
                    type="button"
                    className={`th-filter-btn${
                      memberTierFilter ? " th-filter-btn-active" : ""
                    }`}
                    ref={
                      openMemberFilter === "tier"
                        ? memberFilterBtnRef
                        : null
                    }
                    onClick={() => toggleMemberFilter("tier")}
                    aria-label="Filter by tier"
                    aria-expanded={openMemberFilter === "tier"}
                  >
                    <TagIcon />
                  </button>
                </span>
              </th>
              <th>Family Group</th>
              <th>Currently Borrowed</th>
              <th>Total Borrows</th>
              <th>Fines Pending</th>
              <th>Fines Paid</th>
              <th>Change Tier</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty">
                  No members match your filters
                </td>
              </tr>
            ) : (
            filteredMembers.map((m) => (
              <tr key={m.id}>
                <td>{m.username}</td>
                <td>
                  {m.membership_tier ? (
                    <span
                      className={`membership-badge membership-badge-${m.membership_tier}`}
                    >
                      {m.membership_tier.charAt(0).toUpperCase() +
                        m.membership_tier.slice(1)}
                    </span>
                  ) : (
                    <span className="muted">None</span>
                  )}
                </td>
                <td>
                  {m.family_group_id != null ? (
                    `Group ${m.family_group_id}`
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>{m.currently_borrowed}</td>
                <td>{m.total_borrows}</td>
                <td
                  className={m.fines_pending > 0 ? "fine-amount" : ""}
                >
                  {m.fines_pending > 0 ? (
                    formatCurrency(m.fines_pending, currency)
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {m.fines_paid > 0 ? (
                    formatCurrency(m.fines_paid, currency)
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <Select
                    className="filter-select"
                    value={m.membership_tier || ""}
                    onChange={(e) =>
                      changeMemberTier(m.id, e.target.value)
                    }
                  >
                    <option value="">None</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                    <option value="family">Family</option>
                  </Select>
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => openMember(m)}
                  >
                    View Records
                  </button>
                </td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      )}

      <MembershipRequestHistorySection
        membershipRequestHistoryOpen={membershipRequestHistoryOpen}
        setMembershipRequestHistoryOpen={setMembershipRequestHistoryOpen}
        membershipRequestHistoryFilter={membershipRequestHistoryFilter}
        setMembershipRequestHistoryFilter={setMembershipRequestHistoryFilter}
        historyMembershipRequests={historyMembershipRequests}
      />

      <ActionMenu
        open={!!openMemberFilter}
        anchorRef={memberFilterBtnRef}
        onClose={() => setOpenMemberFilter(null)}
      >
        {openMemberFilter && (
          <>
            <div className="custom-select-search-wrap">
              <input
                ref={memberFilterSearchRef}
                type="text"
                className="custom-select-search"
                placeholder="Search…"
                value={memberFilterSearch}
                onChange={(e) => setMemberFilterSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpenMemberFilter(null);
                }}
              />
            </div>
            <div className="action-menu-scroll">
              {visibleMemberFilterOptions.length === 0 ? (
                <div className="custom-select-no-match">No matches</div>
              ) : (
                visibleMemberFilterOptions.map((opt) => (
                  <button
                    key={opt.value}
                    className={`action-menu-item${
                      memberFilterMenus[openMemberFilter].value ===
                      opt.value
                        ? " action-menu-item-active"
                        : ""
                    }`}
                    onClick={() => {
                      memberFilterMenus[openMemberFilter].setValue(
                        opt.value
                      );
                      setOpenMemberFilter(null);
                    }}
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </ActionMenu>

      {selectedMember && (
        <MemberRecordsModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          memberBorrows={memberBorrows}
          memberBorrowsLoading={memberBorrowsLoading}
        />
      )}

      <MembershipRequestModals
        approvingMembershipRequest={approvingMembershipRequest}
        setApprovingMembershipRequest={setApprovingMembershipRequest}
        approveMembershipNotes={approveMembershipNotes}
        setApproveMembershipNotes={setApproveMembershipNotes}
        approveMembershipError={approveMembershipError}
        onSubmitApprove={submitApproveMembershipRequest}
        rejectingMembershipRequest={rejectingMembershipRequest}
        setRejectingMembershipRequest={setRejectingMembershipRequest}
        rejectMembershipNotes={rejectMembershipNotes}
        setRejectMembershipNotes={setRejectMembershipNotes}
        rejectMembershipError={rejectMembershipError}
        onSubmitReject={submitRejectMembershipRequest}
      />
    </>
  );
}

export default MembersTab;
