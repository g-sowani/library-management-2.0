import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import TopBar from '../components/TopBar';
import NavTabs from '../components/NavTabs';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import SearchBar from '../components/SearchBar';
import { GENRES } from '../constants';

const TABS = [
  { id: 'books', label: 'Books' },
  { id: 'borrows', label: 'Borrowed Books' },
  { id: 'fines', label: 'Fines' },
  { id: 'members', label: 'Members' },
  { id: 'communities', label: 'Communities' },
  { id: 'donations', label: 'Donations' },
];

const EMPTY_BOOK_FORM = { title: '', author: '', isbn: '', total_copies: 1, genre: '' };

function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('books');
  const [books, setBooks] = useState([]);
  const [borrows, setBorrows] = useState([]);
  const [fines, setFines] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [loadError, setLoadError] = useState('');

  // Add book
  const [showAdd, setShowAdd] = useState(false);
  const [bookForm, setBookForm] = useState(EMPTY_BOOK_FORM);
  const [bookError, setBookError] = useState('');

  // Edit book
  const [editingBook, setEditingBook] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editError, setEditError] = useState('');

  // Book logs
  const [logsBook, setLogsBook] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Members
  const [members, setMembers] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberBorrows, setMemberBorrows] = useState([]);
  const [memberBorrowsLoading, setMemberBorrowsLoading] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // Re-auth modal (for sensitive admin actions)
  const [reAuthFor, setReAuthFor] = useState(null); // 'policy' | 'pricing'
  const [reAuthPassword, setReAuthPassword] = useState('');
  const [reAuthError, setReAuthError] = useState('');
  const [reAuthLoading, setReAuthLoading] = useState(false);

  // Fine policy
  const [policy, setPolicy] = useState(null);
  const [policyForm, setPolicyForm] = useState({ fine_per_day: '', borrow_days: '' });
  const [policyError, setPolicyError] = useState('');
  const [policySaved, setPolicySaved] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState(null);

  // Memberships
  const [membershipPricing, setMembershipPricing] = useState(null);
  const [membershipPricingForm, setMembershipPricingForm] = useState({ silver_rate: '', gold_rate: '', family_rate: '' });
  const [membershipPricingError, setMembershipPricingError] = useState('');
  const [membershipPricingSaved, setMembershipPricingSaved] = useState(false);
  const [membershipsLoaded, setMembershipsLoaded] = useState(false);

  // Donations
  const [donations, setDonations] = useState([]);
  const [donationsLoaded, setDonationsLoaded] = useState(false);
  const [donationStatusFilter, setDonationStatusFilter] = useState('pending');

  // Communities
  const [adminCommunities, setAdminCommunities] = useState([]);
  const [adminCommunitiesLoaded, setAdminCommunitiesLoaded] = useState(false);
  const [adminCommunitiesFilter, setAdminCommunitiesFilter] = useState('pending');
  const [approvingCommunity, setApprovingCommunity] = useState(null);
  const [communityApproveNotes, setCommunityApproveNotes] = useState('');
  const [communityApproveError, setCommunityApproveError] = useState('');
  const [rejectingCommunity, setRejectingCommunity] = useState(null);
  const [communityRejectNotes, setCommunityRejectNotes] = useState('');
  const [communityRejectError, setCommunityRejectError] = useState('');
  const [approvingDonation, setApprovingDonation] = useState(null); // donation object
  const [approveCredit, setApproveCredit] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [approveError, setApproveError] = useState('');
  const [rejectingDonation, setRejectingDonation] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectError, setRejectError] = useState('');

  const [refreshingAll, setRefreshingAll] = useState(false);
  const [showRefreshLog, setShowRefreshLog] = useState(false);
  const [refreshLog, setRefreshLog] = useState([]);
  const [refreshProgress, setRefreshProgress] = useState(null); // { done, total }

  const load = useCallback(() => {
    setLoadError('');
    return Promise.all([
      api.get('/books').then(r => setBooks(r.data)),
      api.get('/admin/borrows').then(r => setBorrows(r.data)),
      api.get('/admin/fines').then(r => setFines(r.data)),
      api.get('/admin/policy').then(r => {
        setPolicy(r.data);
        setPolicyForm({ fine_per_day: r.data.fine_per_day, borrow_days: r.data.borrow_days });
      }),
    ]);
  }, []);

  useEffect(() => {
    load().catch(() => setLoadError('Failed to load data. Is the server running?'));
  }, [load]);

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    setRefreshLog([]);
    setRefreshProgress({ done: 0, total: books.length });
    setShowRefreshLog(true);

    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      try {
        const res = await api.post(`/books/${book.id}/scrape`);
        const d = res.data;
        const loaded = [];
        if (d.description) loaded.push('description');
        if (d.cover_url) loaded.push('cover');
        if (d.author_bio) loaded.push('author bio');
        if (d.cover_color) loaded.push('color');
        setRefreshLog(prev => [...prev, { title: book.title, ok: true, loaded }]);
      } catch {
        setRefreshLog(prev => [...prev, { title: book.title, ok: false, loaded: [] }]);
      }
      setRefreshProgress({ done: i + 1, total: books.length });
    }

    await load();
    setRefreshingAll(false);
  };

  const loadMembers = useCallback(() => {
    api.get('/admin/members').then(r => { setMembers(r.data); setMembersLoaded(true); });
  }, []);

  const loadMembershipPricing = useCallback(() => {
    api.get('/admin/memberships/pricing').then(r => {
      setMembershipPricing(r.data);
      setMembershipPricingForm({ silver_rate: r.data.silver_rate, gold_rate: r.data.gold_rate, family_rate: r.data.family_rate });
    });
  }, []);

  const loadDonations = useCallback((status) => {
    const qs = status ? `?status=${status}` : '';
    api.get(`/admin/donations${qs}`).then(r => { setDonations(r.data); setDonationsLoaded(true); });
  }, []);

  const loadAdminCommunities = useCallback((status) => {
    const qs = status ? `?status=${status}` : '';
    api.get(`/admin/communities${qs}`).then(r => {
      setAdminCommunities(r.data);
      setAdminCommunitiesLoaded(true);
    });
  }, []);

  const handleTabChange = (t) => {
    setTab(t);
    setPolicySaved(false);
    setMembershipPricingSaved(false);
    if (t === 'members') {
      if (!membersLoaded) loadMembers();
      if (!membershipsLoaded) {
        loadMembershipPricing();
        setMembershipsLoaded(true);
      }
    }
    if (t === 'donations') loadDonations(donationStatusFilter);
    if (t === 'communities') loadAdminCommunities(adminCommunitiesFilter);
  };

  const submitApproveCommunity = async (e) => {
    e.preventDefault();
    setCommunityApproveError('');
    try {
      await api.put(`/admin/communities/${approvingCommunity.id}/approve`, {
        admin_notes: communityApproveNotes,
      });
      setApprovingCommunity(null);
      loadAdminCommunities(adminCommunitiesFilter);
    } catch (err) {
      setCommunityApproveError(err.response?.data?.error || 'Failed to approve');
    }
  };

  const submitRejectCommunity = async (e) => {
    e.preventDefault();
    setCommunityRejectError('');
    try {
      await api.put(`/admin/communities/${rejectingCommunity.id}/reject`, {
        admin_notes: communityRejectNotes,
      });
      setRejectingCommunity(null);
      loadAdminCommunities(adminCommunitiesFilter);
    } catch (err) {
      setCommunityRejectError(err.response?.data?.error || 'Failed to reject');
    }
  };

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

  // ── Add book ──────────────────────────────────────────────────
  const addBook = async (e) => {
    e.preventDefault();
    setBookError('');
    try {
      await api.post('/books', { ...bookForm, total_copies: Number(bookForm.total_copies) });
      setShowAdd(false);
      setBookForm(EMPTY_BOOK_FORM);
      load();
    } catch (err) {
      setBookError(err.response?.data?.error || 'Failed to add book');
    }
  };

  const deleteBook = async (id) => {
    try {
      await api.delete(`/books/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Cannot delete');
    }
  };

  const refreshMeta = async (id) => {
    try {
      const res = await api.post(`/books/${id}/scrape`);
      setBooks(prev => prev.map(b =>
        b.id === id
          ? { ...b, description: res.data.description, author_bio: res.data.author_bio, cover_url: res.data.cover_url || b.cover_url }
          : b
      ));
      showToast('Metadata refreshed');
    } catch {
      alert('Failed to refresh metadata');
    }
  };

  // ── Edit book ─────────────────────────────────────────────────
  const openEdit = (book) => {
    setEditingBook(book);
    setEditForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      genre: book.genre || '',
      total_copies: book.total_copies,
      discard_reason: '',
    });
    setEditError('');
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    try {
      await api.put(`/books/${editingBook.id}`, {
        ...editForm,
        total_copies: Number(editForm.total_copies),
      });
      setEditingBook(null);
      load();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update book');
    }
  };

  // ── Book logs ─────────────────────────────────────────────────
  const openLogs = async (book) => {
    setLogsBook(book);
    setLogsLoading(true);
    setLogs([]);
    try {
      const res = await api.get(`/books/${book.id}/logs`);
      setLogs(res.data);
    } finally {
      setLogsLoading(false);
    }
  };

  // ── Re-auth ───────────────────────────────────────────────────
  const openReAuth = (e, forAction) => {
    e.preventDefault();
    setReAuthFor(forAction);
    setReAuthPassword('');
    setReAuthError('');
  };

  const confirmReAuth = async () => {
    setReAuthError('');
    setReAuthLoading(true);
    try {
      await api.post('/admin/verify-password', { password: reAuthPassword });
    } catch {
      setReAuthError('Incorrect password. Please try again.');
      setReAuthLoading(false);
      return;
    }
    setReAuthLoading(false);
    const action = reAuthFor;
    setReAuthFor(null);
    if (action === 'policy') await doSavePolicy();
    if (action === 'pricing') await doSaveMembershipPricing();
  };

  // ── Fines ─────────────────────────────────────────────────────
  const markFinePaid = async (borrowId) => {
    setMarkingPaidId(borrowId);
    try {
      await api.put(`/admin/fines/${borrowId}/mark-paid`);
      setFines(prev => prev.filter(f => f.id !== borrowId));
      showToast('Fine marked as paid');
    } catch {
      showToast('Failed to mark fine as paid');
    } finally {
      setMarkingPaidId(null);
    }
  };

  // ── Fine policy ───────────────────────────────────────────────
  const doSavePolicy = async () => {
    setPolicyError('');
    setPolicySaved(false);
    try {
      const res = await api.put('/admin/policy', policyForm);
      setPolicy(res.data);
      setPolicySaved(true);
    } catch (err) {
      const errs = err.response?.data?.errors;
      setPolicyError(errs ? Object.values(errs).join(', ') : 'Failed to save policy');
    }
  };

  const savePolicy = (e) => openReAuth(e, 'policy');

  // ── Membership ────────────────────────────────────────────────
  const doSaveMembershipPricing = async () => {
    setMembershipPricingError('');
    setMembershipPricingSaved(false);
    try {
      const res = await api.put('/admin/memberships/pricing', membershipPricingForm);
      setMembershipPricing(res.data);
      setMembershipPricingSaved(true);
    } catch (err) {
      const errs = err.response?.data?.errors;
      setMembershipPricingError(errs ? Object.values(errs).join(', ') : 'Failed to save pricing');
    }
  };

  const saveMembershipPricing = (e) => openReAuth(e, 'pricing');

  const changeMemberTier = async (memberId, tier) => {
    try {
      await api.put(`/admin/members/${memberId}/membership`, { tier: tier || null });
      loadMembers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update tier');
    }
  };

  const openApprove = (donation) => {
    setApprovingDonation(donation);
    setApproveCredit((donation.estimated_price / 4).toFixed(2));
    setApproveNotes('');
    setApproveError('');
  };

  const submitApprove = async (e) => {
    e.preventDefault();
    setApproveError('');
    try {
      await api.put(`/admin/donations/${approvingDonation.id}/approve`, {
        credit_amount: Number(approveCredit),
        admin_notes: approveNotes,
      });
      setApprovingDonation(null);
      loadDonations(donationStatusFilter);
    } catch (err) {
      setApproveError(err.response?.data?.error || 'Failed to approve donation');
    }
  };

  const openReject = (donation) => {
    setRejectingDonation(donation);
    setRejectNotes('');
    setRejectError('');
  };

  const submitReject = async (e) => {
    e.preventDefault();
    setRejectError('');
    try {
      await api.put(`/admin/donations/${rejectingDonation.id}/reject`, {
        admin_notes: rejectNotes,
      });
      setRejectingDonation(null);
      loadDonations(donationStatusFilter);
    } catch (err) {
      setRejectError(err.response?.data?.error || 'Failed to reject donation');
    }
  };

  // ── Helpers ───────────────────────────────────────────────────
  const genreCounts = useMemo(() => {
    const counts = {};
    books.forEach(b => {
      const g = b.genre || 'Other';
      counts[g] = (counts[g] || 0) + 1;
    });
    return counts;
  }, [books]);

  const availableGenres = useMemo(() => Object.keys(genreCounts).sort(), [genreCounts]);

  const filteredBooks = useMemo(() => books.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = b.title.toLowerCase().includes(q)
      || b.author.toLowerCase().includes(q)
      || (b.genre || '').toLowerCase().includes(q);
    const matchGenre = !selectedGenre || (b.genre || 'Other') === selectedGenre;
    return matchSearch && matchGenre;
  }), [books, search, selectedGenre]);

  const isDiscarding = editingBook && Number(editForm.total_copies) < editingBook.total_copies;
  const borrowed = editingBook ? editingBook.total_copies - editingBook.available_copies : 0;

  const bookField = (key) => ({
    value: bookForm[key],
    onChange: (e) => setBookForm({ ...bookForm, [key]: e.target.value }),
  });

  const editField = (key) => ({
    value: editForm[key] ?? '',
    onChange: (e) => setEditForm({ ...editForm, [key]: e.target.value }),
  });

  return (
    <div className="layout">
      <TopBar title="Library Admin" username={user.username} onLogout={logout} />
      <NavTabs tabs={TABS} active={tab} onChange={handleTabChange} />
      <div className="content">
        {loadError && <div className="error">{loadError}</div>}

        {/* ── Books ── */}
        {tab === 'books' && (
          <>
            <div className="section-header">
              <h3>All Books</h3>
              <div className="btn-row">
                <button className="btn btn-sm btn-outline btn-icon" onClick={handleRefreshAll} disabled={refreshingAll} title="Refresh all books data">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  {refreshingAll ? 'Refreshing…' : 'Refresh All'}
                </button>
                <button className="btn btn-sm" onClick={() => setShowAdd(true)}>Add Book</button>
              </div>
            </div>

            <div className="search-top-bar">
              <SearchBar value={search} onChange={setSearch} placeholder="Search by title, author or genre…" className="search-bar-wide" />
              
            </div>

            {availableGenres.length > 0 && (
              <div className="genre-strip">
                <button
                  className={`genre-card${!selectedGenre ? ' active' : ''}`}
                  onClick={() => setSelectedGenre('')}
                >
                  <span className="genre-card-name">All</span>
                  <span className="genre-card-count">{books.length}</span>
                </button>
                {availableGenres.map(genre => (
                  <button
                    key={genre}
                    className={`genre-card${selectedGenre === genre ? ' active' : ''}`}
                    onClick={() => setSelectedGenre(selectedGenre === genre ? '' : genre)}
                  >
                    <span className="genre-card-name">{genre}</span>
                    <span className="genre-card-count">{genreCounts[genre]}</span>
                  </button>
                ))}
              </div>
            )}

            {filteredBooks.length === 0 && (
              <div className="empty">{search || selectedGenre ? 'No books match your filters' : 'No books yet'}</div>
            )}
            {filteredBooks.length > 0 && (
              <table>
                <thead>
                  <tr><th>Title</th><th>Author</th><th>Genre</th><th>ISBN</th><th>Copies</th><th></th></tr>
                </thead>
                <tbody>
                  {filteredBooks.map(b => (
                    <tr key={b.id}>
                      <td>{b.title}</td>
                      <td>{b.author}</td>
                      <td>{b.genre || <span className="muted">—</span>}</td>
                      <td>{b.isbn}</td>
                      <td>{b.available_copies} / {b.total_copies}</td>
                      <td>
                        <div className="btn-row">
                          <div className="btn-group">
                            <button className="btn btn-sm" onClick={() => openEdit(b)}>Edit</button>
                            <button className="btn btn-sm btn-group-danger btn-icon" onClick={() => deleteBook(b.id)} title="Delete book">
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                            </button>
                          </div>
                          <button className="btn btn-sm btn-outline" onClick={() => openLogs(b)}>Logs</button>
                          <button className="btn btn-sm btn-outline btn-icon" onClick={() => refreshMeta(b.id)} title="Re-fetch description, author bio, and cover from Open Library">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="23 4 23 10 17 10"/>
                              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* ── Borrowed Books ── */}
        {tab === 'borrows' && (
          <>
            <div className="section-header"><h3>Currently Borrowed</h3></div>
            {borrows.length === 0 ? (
              <div className="empty">No active borrows</div>
            ) : (
              <table>
                <thead>
                  <tr><th>Book</th><th>Borrower</th><th>Borrow Date</th><th>Due Date</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {borrows.map(b => (
                    <tr key={b.id}>
                      <td>{b.book_title}</td>
                      <td>{b.username}</td>
                      <td>{new Date(b.borrow_date).toLocaleDateString()}</td>
                      <td>{new Date(b.due_date).toLocaleDateString()}</td>
                      <td>
                        <Badge variant={b.is_overdue ? 'overdue' : 'active'}>
                          {b.is_overdue ? 'Overdue' : 'Active'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* ── Fines ── */}
        {tab === 'fines' && (
          <>
            <div className="section-header">
              <h3>Pending Fines</h3>
              {fines.length > 0 && (
                <span className="fine-amount" style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  {fines.length} unpaid · ${fines.reduce((s, f) => s + f.fine, 0).toFixed(2)} total
                </span>
              )}
            </div>
            {fines.length === 0 ? (
              <div className="empty">No pending fines</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>User</th>
                    <th>Due Date</th>
                    <th>Fine</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {fines.map(b => (
                    <tr key={b.id}>
                      <td>{b.book_title}</td>
                      <td>{b.username}</td>
                      <td>{new Date(b.due_date).toLocaleDateString()}</td>
                      <td className="fine-amount">${b.fine.toFixed(2)}</td>
                      <td>
                        {b.return_date
                          ? <Badge variant="returned">Returned Late</Badge>
                          : <Badge variant="overdue">Overdue</Badge>}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm"
                          disabled={markingPaidId === b.id}
                          onClick={() => markFinePaid(b.id)}
                        >
                          {markingPaidId === b.id ? 'Saving…' : 'Mark Paid'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="section-header" style={{ marginTop: 40 }}><h3>Fine Policy</h3></div>
            {policy && (
              <form className="policy-form" onSubmit={savePolicy}>
                {policyError && <div className="error">{policyError}</div>}
                {policySaved && <div className="success">Policy saved successfully</div>}
                <div className="form-group">
                  <label>Fine Per Day ($)</label>
                  <input type="number" min="0" step="0.01"
                    value={policyForm.fine_per_day}
                    onChange={e => setPolicyForm({ ...policyForm, fine_per_day: e.target.value })}
                    required />
                  <p className="field-hint">Charged per day a book is overdue</p>
                </div>
                <div className="form-group">
                  <label>Borrow Duration (days)</label>
                  <input type="number" min="1"
                    value={policyForm.borrow_days}
                    onChange={e => setPolicyForm({ ...policyForm, borrow_days: e.target.value })}
                    required />
                  <p className="field-hint">Applies to new borrows only</p>
                </div>
                <button type="submit" className="btn btn-sm">Save Policy</button>
              </form>
            )}
          </>
        )}

        {/* ── Members ── */}
        {tab === 'members' && (
          <>
            <div className="section-header"><h3>Membership Pricing</h3></div>
            {membershipPricing && (
              <form className="membership-pricing-form" onSubmit={saveMembershipPricing}>
                {membershipPricingError && <div className="error">{membershipPricingError}</div>}
                {membershipPricingSaved && <div className="success">Pricing saved successfully</div>}
                <div className="tier-pricing-grid">
                  <div className="tier-pricing-card">
                    <div className="tier-pricing-name">Silver</div>
                    <div className="tier-pricing-desc">1 book at a time · Standard access</div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Monthly Rate ($)</label>
                      <input
                        type="number" min="0" step="0.01" required
                        value={membershipPricingForm.silver_rate}
                        onChange={e => setMembershipPricingForm({ ...membershipPricingForm, silver_rate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="tier-pricing-card tier-pricing-card-gold">
                    <div className="tier-pricing-name">Gold</div>
                    <div className="tier-pricing-desc">3 books at a time · Community access</div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Monthly Rate ($)</label>
                      <input
                        type="number" min="0" step="0.01" required
                        value={membershipPricingForm.gold_rate}
                        onChange={e => setMembershipPricingForm({ ...membershipPricingForm, gold_rate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="tier-pricing-card">
                    <div className="tier-pricing-name">Family</div>
                    <div className="tier-pricing-desc">Up to 4 members · 1 book each · Shared plan</div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Monthly Rate ($)</label>
                      <input
                        type="number" min="0" step="0.01" required
                        value={membershipPricingForm.family_rate}
                        onChange={e => setMembershipPricingForm({ ...membershipPricingForm, family_rate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <p className="field-hint" style={{ marginBottom: 12 }}>Gold rate must be higher than Silver; Family rate is for the whole group</p>
                <button type="submit" className="btn btn-sm">Save Pricing</button>
              </form>
            )}

            <div className="section-header" style={{ marginTop: 40 }}><h3>Member Records</h3></div>
            {!membersLoaded ? (
              <div className="empty">Loading…</div>
            ) : members.length === 0 ? (
              <div className="empty">No members registered</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Tier</th>
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
                  {members.map(m => (
                    <tr key={m.id}>
                      <td>{m.username}</td>
                      <td>
                        {m.membership_tier
                          ? <span className={`membership-badge membership-badge-${m.membership_tier}`}>{m.membership_tier.charAt(0).toUpperCase() + m.membership_tier.slice(1)}</span>
                          : <span className="muted">None</span>}
                      </td>
                      <td>{m.family_group_id != null ? `Group ${m.family_group_id}` : <span className="muted">—</span>}</td>
                      <td>{m.currently_borrowed}</td>
                      <td>{m.total_borrows}</td>
                      <td className={m.fines_pending > 0 ? 'fine-amount' : ''}>
                        {m.fines_pending > 0 ? `$${m.fines_pending.toFixed(2)}` : <span className="muted">—</span>}
                      </td>
                      <td>{m.fines_paid > 0 ? `$${m.fines_paid.toFixed(2)}` : <span className="muted">—</span>}</td>
                      <td>
                        <select
                          className="filter-select"
                          value={m.membership_tier || ''}
                          onChange={e => changeMemberTier(m.id, e.target.value)}
                        >
                          <option value="">None</option>
                          <option value="silver">Silver</option>
                          <option value="gold">Gold</option>
                          <option value="family">Family</option>
                        </select>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={() => openMember(m)}>View Records</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* ── Communities ── */}
        {tab === 'communities' && (
          <>
            <div className="section-header">
              <h3>Community Requests</h3>
              <div className="btn-row">
                {['pending', 'approved', 'rejected', ''].map(s => (
                  <button
                    key={s || 'all'}
                    className={`btn btn-sm${adminCommunitiesFilter === s ? '' : ' btn-outline'}`}
                    onClick={() => { setAdminCommunitiesFilter(s); loadAdminCommunities(s); }}
                  >
                    {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
                  </button>
                ))}
              </div>
            </div>
            {!adminCommunitiesLoaded ? (
              <div className="empty">Loading…</div>
            ) : adminCommunities.length === 0 ? (
              <div className="empty">No communities{adminCommunitiesFilter ? ` with status "${adminCommunitiesFilter}"` : ''}</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Creator</th>
                    <th>Members</th>
                    <th>Posts</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {adminCommunities.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td style={{ maxWidth: 200, color: '#555', fontSize: '0.85rem' }}>
                        {c.description || <span className="muted">—</span>}
                      </td>
                      <td>{c.creator_username}</td>
                      <td>{c.member_count}</td>
                      <td>{c.post_count}</td>
                      <td>
                        <Badge
                          variant={c.status === 'approved' ? 'active' : c.status === 'rejected' ? 'overdue' : 'returned'}
                        >
                          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </Badge>
                      </td>
                      <td>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td>
                        {c.status === 'pending' && (
                          <div className="btn-row">
                            <button className="btn btn-sm" onClick={() => { setApprovingCommunity(c); setCommunityApproveNotes(''); setCommunityApproveError(''); }}>Approve</button>
                            <button className="btn btn-sm btn-outline" onClick={() => { setRejectingCommunity(c); setCommunityRejectNotes(''); setCommunityRejectError(''); }}>Reject</button>
                          </div>
                        )}
                        {c.admin_notes && (
                          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 4 }} title={c.admin_notes}>
                            Note: {c.admin_notes.length > 40 ? c.admin_notes.slice(0, 40) + '…' : c.admin_notes}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* ── Donations ── */}
        {tab === 'donations' && (
          <>
            <div className="section-header">
              <h3>Book Donations</h3>
              <div className="btn-row">
                {['pending', 'approved', 'rejected', ''].map(s => (
                  <button
                    key={s || 'all'}
                    className={`btn btn-sm${donationStatusFilter === s ? '' : ' btn-outline'}`}
                    onClick={() => { setDonationStatusFilter(s); loadDonations(s); }}
                  >
                    {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
                  </button>
                ))}
              </div>
            </div>

            {!donationsLoaded ? (
              <div className="empty">Loading…</div>
            ) : donations.length === 0 ? (
              <div className="empty">No donations{donationStatusFilter ? ` with status "${donationStatusFilter}"` : ''}</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Condition</th>
                    <th>Est. Value</th>
                    <th>Credit</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {donations.map(d => (
                    <tr key={d.id}>
                      <td>{d.username}</td>
                      <td>
                        {d.title}
                        {d.isbn && <div style={{ fontSize: '0.75rem', color: '#888' }}>ISBN: {d.isbn}</div>}
                        {d.genre && <div style={{ fontSize: '0.75rem', color: '#888' }}>{d.genre}</div>}
                      </td>
                      <td>{d.author}</td>
                      <td style={{ textTransform: 'capitalize' }}>{d.condition}</td>
                      <td>${d.estimated_price.toFixed(2)}</td>
                      <td>
                        {d.credit_amount != null
                          ? <span style={{ color: '#2e7d32', fontWeight: 600 }}>${d.credit_amount.toFixed(2)}</span>
                          : <span className="muted">—</span>}
                      </td>
                      <td>
                        <Badge
                          variant={d.status === 'approved' ? 'active' : d.status === 'rejected' ? 'overdue' : 'returned'}
                        >
                          {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                        </Badge>
                      </td>
                      <td>{new Date(d.submitted_at).toLocaleDateString()}</td>
                      <td>
                        {d.status === 'pending' && (
                          <div className="btn-row">
                            <button className="btn btn-sm" onClick={() => openApprove(d)}>Approve</button>
                            <button className="btn btn-sm btn-outline" onClick={() => openReject(d)}>Reject</button>
                          </div>
                        )}
                        {d.admin_notes && (
                          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 4 }} title={d.admin_notes}>
                            Note: {d.admin_notes.length > 40 ? d.admin_notes.slice(0, 40) + '…' : d.admin_notes}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* ── Refresh All Log Modal ── */}
      {showRefreshLog && (
        <Modal title="Refresh All Books" onClose={() => !refreshingAll && setShowRefreshLog(false)} wide>
          {refreshProgress && (
            <div className="refresh-progress">
              <div className="refresh-progress-bar">
                <div style={{ width: `${(refreshProgress.done / refreshProgress.total) * 100}%` }} />
              </div>
              <span className="refresh-progress-label">
                {refreshProgress.done} / {refreshProgress.total}
              </span>
            </div>
          )}
          <div className="refresh-log">
            {refreshLog.map((entry, i) => (
              <div key={i} className={`refresh-log-entry ${entry.ok ? 'refresh-log-ok' : 'refresh-log-error'}`}>
                <span className="refresh-log-icon">{entry.ok ? '✓' : '✗'}</span>
                <span className="refresh-log-title">{entry.title}</span>
                <span className="refresh-log-details">
                  {entry.ok
                    ? (entry.loaded.length > 0 ? entry.loaded.join(', ') : 'no data found')
                    : 'failed'}
                </span>
              </div>
            ))}
            {refreshingAll && (
              <div className="refresh-log-entry refresh-log-pending">
                <span className="refresh-log-icon">⋯</span>
                <span className="refresh-log-title">Working…</span>
              </div>
            )}
          </div>
          {!refreshingAll && (
            <div className="modal-actions">
              <button className="btn btn-sm" onClick={() => setShowRefreshLog(false)}>Close</button>
            </div>
          )}
        </Modal>
      )}

      {/* ── Re-auth Modal ── */}
      {reAuthFor && (
        <Modal
          title="Confirm Your Identity"
          onClose={() => setReAuthFor(null)}
        >
          <p style={{ marginBottom: 16, fontSize: '0.9rem', color: 'var(--text-secondary, #555)' }}>
            This action requires you to re-enter your password to continue.
          </p>
          {reAuthError && <div className="error" style={{ marginBottom: 12 }}>{reAuthError}</div>}
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={reAuthPassword}
              onChange={e => setReAuthPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmReAuth()}
              autoFocus
              placeholder="Enter your password"
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-sm" onClick={confirmReAuth} disabled={reAuthLoading || !reAuthPassword}>
              {reAuthLoading ? 'Verifying…' : 'Confirm'}
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => setReAuthFor(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* ── Approve Community Modal ── */}
      {approvingCommunity && (
        <Modal title="Approve Community" onClose={() => setApprovingCommunity(null)}>
          <p style={{ marginBottom: 16, fontSize: '0.9rem', color: '#555' }}>
            Approving <strong>{approvingCommunity.name}</strong> created by <strong>{approvingCommunity.creator_username}</strong>.
            The creator will automatically be added as a moderator.
          </p>
          <form onSubmit={submitApproveCommunity}>
            {communityApproveError && <div className="error">{communityApproveError}</div>}
            <div className="form-group">
              <label>Admin notes <span className="muted" style={{ textTransform: 'none', fontSize: '0.75rem' }}>(optional)</span></label>
              <input
                value={communityApproveNotes}
                onChange={e => setCommunityApproveNotes(e.target.value)}
                placeholder="Any notes for the community creator…"
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setApprovingCommunity(null)}>Cancel</button>
              <button type="submit" className="btn btn-sm">Confirm Approval</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Reject Community Modal ── */}
      {rejectingCommunity && (
        <Modal title="Reject Community" onClose={() => setRejectingCommunity(null)}>
          <p style={{ marginBottom: 16, fontSize: '0.9rem', color: '#555' }}>
            Rejecting <strong>{rejectingCommunity.name}</strong> submitted by <strong>{rejectingCommunity.creator_username}</strong>.
          </p>
          <form onSubmit={submitRejectCommunity}>
            {communityRejectError && <div className="error">{communityRejectError}</div>}
            <div className="form-group">
              <label>Reason <span className="muted" style={{ textTransform: 'none', fontSize: '0.75rem' }}>(optional — shown to creator)</span></label>
              <input
                value={communityRejectNotes}
                onChange={e => setCommunityRejectNotes(e.target.value)}
                placeholder="e.g. Duplicate community, inappropriate name…"
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setRejectingCommunity(null)}>Cancel</button>
              <button type="submit" className="btn btn-sm btn-outline">Confirm Rejection</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Approve Donation Modal ── */}
      {approvingDonation && (
        <Modal title="Approve Donation" onClose={() => setApprovingDonation(null)}>
          <p style={{ marginBottom: 16, fontSize: '0.9rem', color: '#555' }}>
            Approving <strong>{approvingDonation.title}</strong> by {approvingDonation.author} donated by <strong>{approvingDonation.username}</strong>.
            The book will be added to the catalogue with 1 copy.
          </p>
          <form onSubmit={submitApprove}>
            {approveError && <div className="error">{approveError}</div>}
            <div className="form-group">
              <label>Credit to award ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={approveCredit}
                onChange={e => setApproveCredit(e.target.value)}
                required
              />
              <p className="field-hint">
                Default is 1/4 of estimated value (${(approvingDonation.estimated_price / 4).toFixed(2)}). You can adjust this.
              </p>
            </div>
            <div className="form-group">
              <label>Admin notes <span className="muted" style={{ textTransform: 'none', fontSize: '0.75rem' }}>(optional)</span></label>
              <input
                value={approveNotes}
                onChange={e => setApproveNotes(e.target.value)}
                placeholder="Any notes for the member…"
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setApprovingDonation(null)}>Cancel</button>
              <button type="submit" className="btn btn-sm">Confirm Approval</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Reject Donation Modal ── */}
      {rejectingDonation && (
        <Modal title="Reject Donation" onClose={() => setRejectingDonation(null)}>
          <p style={{ marginBottom: 16, fontSize: '0.9rem', color: '#555' }}>
            Rejecting <strong>{rejectingDonation.title}</strong> donated by <strong>{rejectingDonation.username}</strong>.
          </p>
          <form onSubmit={submitReject}>
            {rejectError && <div className="error">{rejectError}</div>}
            <div className="form-group">
              <label>Reason <span className="muted" style={{ textTransform: 'none', fontSize: '0.75rem' }}>(optional — shown to member)</span></label>
              <input
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                placeholder="e.g. Duplicate, poor condition, not in our catalogue…"
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setRejectingDonation(null)}>Cancel</button>
              <button type="submit" className="btn btn-sm btn-outline">Confirm Rejection</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Add Book Modal ── */}
      {showAdd && (
        <Modal title="Add Book" onClose={() => { setShowAdd(false); setBookError(''); }}>
          <form onSubmit={addBook}>
            {bookError && <div className="error">{bookError}</div>}
            <div className="form-group">
              <label>Title</label>
              <input {...bookField('title')} required />
            </div>
            <div className="form-group">
              <label>Author</label>
              <input {...bookField('author')} required />
            </div>
            <div className="form-group">
              <label>ISBN</label>
              <input {...bookField('isbn')} required />
            </div>
            <div className="form-group">
              <label>Genre</label>
              <select {...bookField('genre')}>
                <option value="">— Select genre —</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Copies</label>
              <input type="number" min="1" {...bookField('total_copies')} required />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline btn-sm"
                onClick={() => { setShowAdd(false); setBookError(''); }}>Cancel</button>
              <button type="submit" className="btn btn-sm">Add</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit Book Modal ── */}
      {editingBook && (
        <Modal title={`Edit — ${editingBook.title}`} onClose={() => setEditingBook(null)}>
          <form onSubmit={saveEdit}>
            {editError && <div className="error">{editError}</div>}
            <div className="form-group">
              <label>Title</label>
              <input {...editField('title')} required />
            </div>
            <div className="form-group">
              <label>Author</label>
              <input {...editField('author')} required />
            </div>
            <div className="form-group">
              <label>ISBN</label>
              <input {...editField('isbn')} required />
            </div>
            <div className="form-group">
              <label>Genre</label>
              <select {...editField('genre')}>
                <option value="">— Select genre —</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Total Copies</label>
              <input type="number" min="1" {...editField('total_copies')} required />
              {borrowed > 0 && (
                <p className="field-hint">{borrowed} currently borrowed — minimum is {borrowed}</p>
              )}
            </div>
            {isDiscarding && (
              <div className="form-group discard-reason">
                <label>
                  Reason for Discarding <span className="required">*</span>
                </label>
                <input
                  {...editField('discard_reason')}
                  placeholder="e.g. Damaged, lost, worn out…"
                  required
                />
                <p className="field-hint">
                  Discarding {editingBook.total_copies - Number(editForm.total_copies)} copy/copies —
                  this will be logged
                </p>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline btn-sm"
                onClick={() => setEditingBook(null)}>Cancel</button>
              <button type="submit" className="btn btn-sm">Save</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Member Records Modal ── */}
      {selectedMember && (
        <Modal title={`Records — ${selectedMember.username}`} onClose={() => setSelectedMember(null)} wide>
          <div className="member-stats">
            <div className="member-stat">
              <span className="member-stat-label">Currently Borrowed</span>
              <span className="member-stat-value">{selectedMember.currently_borrowed}</span>
            </div>
            <div className="member-stat">
              <span className="member-stat-label">Total Borrows</span>
              <span className="member-stat-value">{selectedMember.total_borrows}</span>
            </div>
            <div className="member-stat">
              <span className="member-stat-label">Fines Pending</span>
              <span className={`member-stat-value${selectedMember.fines_pending > 0 ? ' fine-amount' : ''}`}>
                {selectedMember.fines_pending > 0 ? `$${selectedMember.fines_pending.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="member-stat">
              <span className="member-stat-label">Fines Paid</span>
              <span className="member-stat-value">
                {selectedMember.fines_paid > 0 ? `$${selectedMember.fines_paid.toFixed(2)}` : '—'}
              </span>
            </div>
          </div>
          {memberBorrowsLoading ? (
            <div className="empty">Loading…</div>
          ) : memberBorrows.length === 0 ? (
            <div className="empty">No borrow history</div>
          ) : (
            <div className="modal-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Borrowed</th>
                    <th>Due</th>
                    <th>Returned</th>
                    <th>Fine</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {memberBorrows.map(b => (
                    <tr key={b.id}>
                      <td>{b.book_title}</td>
                      <td>{new Date(b.borrow_date).toLocaleDateString()}</td>
                      <td>{new Date(b.due_date).toLocaleDateString()}</td>
                      <td>
                        {b.return_date
                          ? new Date(b.return_date).toLocaleDateString()
                          : <Badge variant={b.is_overdue ? 'overdue' : 'active'}>{b.is_overdue ? 'Overdue' : 'Active'}</Badge>}
                      </td>
                      <td className={b.fine > 0 ? 'fine-amount' : ''}>
                        {b.fine > 0 ? `$${b.fine.toFixed(2)}` : <span className="muted">—</span>}
                      </td>
                      <td>
                        {b.fine > 0
                          ? (b.fine_paid
                            ? <Badge variant="returned">Paid</Badge>
                            : <Badge variant="overdue">Unpaid</Badge>)
                          : <span className="muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {/* ── Toast ── */}
      {toastMsg && <div className="toast">{toastMsg}</div>}

      {/* ── Book Logs Modal ── */}
      {logsBook && (
        <Modal title={`Inventory Logs — ${logsBook.title}`} onClose={() => setLogsBook(null)} wide>
          {logsLoading ? (
            <div className="empty">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="empty">No log entries for this book</div>
          ) : (
            <div className="modal-scroll">
              <table>
                <thead>
                  <tr><th>Action</th><th>Details</th><th>Admin</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id}>
                      <td><span className="log-action">{l.action}</span></td>
                      <td className="log-details">{l.details}</td>
                      <td>{l.admin_username}</td>
                      <td className="log-date">{new Date(l.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

export default AdminDashboard;
