import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../../api";
import ActionMenu from "../../../components/ActionMenu";
import ColumnFilterArrow from "../../../components/icons/ColumnFilterArrow";
import TagIcon from "../../../components/icons/TagIcon";
import SearchBar from "../../../components/SearchBar";
import { useAuth } from "../../../context/AuthContext";
import { dueInDaysLabel } from "../../../utils/dueInDaysLabel";
import { formatCurrency } from "../../../utils/currency";

function BorrowsTab({ borrows, setBorrows, toast }) {
  const { user } = useAuth();
  const currency = user?.library?.currency;
  const [borrowSearch, setBorrowSearch] = useState("");
  const [borrowBookFilter, setBorrowBookFilter] = useState("");
  const [borrowBorrowerFilter, setBorrowBorrowerFilter] = useState("");
  const [borrowStatusFilter, setBorrowStatusFilter] = useState("");
  const [openBorrowFilter, setOpenBorrowFilter] = useState(null); // 'book' | 'borrower' | 'status' | null
  const [borrowFilterSearch, setBorrowFilterSearch] = useState("");
  const borrowFilterBtnRef = useRef(null);
  const borrowFilterSearchRef = useRef(null);
  const [processingReturnId, setProcessingReturnId] = useState(null);

  const approveReturn = async (borrowId) => {
    setProcessingReturnId(borrowId);
    try {
      await api.put(`/admin/returns/${borrowId}/approve`);
      setBorrows((prev) => prev.filter((b) => b.id !== borrowId));
      toast("Return approved");
    } catch (e) {
      toast(e.response?.data?.error || "Failed to approve return", "error");
    } finally {
      setProcessingReturnId(null);
    }
  };

  const rejectReturn = async (borrowId) => {
    setProcessingReturnId(borrowId);
    try {
      const res = await api.put(`/admin/returns/${borrowId}/reject`);
      setBorrows((prev) =>
        prev.map((b) => (b.id === borrowId ? res.data : b))
      );
      toast("Return request rejected");
    } catch (e) {
      toast(e.response?.data?.error || "Failed to reject return", "error");
    } finally {
      setProcessingReturnId(null);
    }
  };

  const borrowBookOptions = useMemo(
    () => [...new Set(borrows.map((b) => b.book_title))].sort(),
    [borrows]
  );
  const borrowBorrowerOptions = useMemo(
    () => [...new Set(borrows.map((b) => b.username))].sort(),
    [borrows]
  );

  const filteredBorrows = useMemo(
    () =>
      borrows
        .filter((b) => {
          const matchBook =
            !borrowBookFilter || b.book_title === borrowBookFilter;
          const matchBorrower =
            !borrowBorrowerFilter || b.username === borrowBorrowerFilter;
          const matchStatus =
            !borrowStatusFilter ||
            (borrowStatusFilter === "overdue" && b.is_overdue) ||
            (borrowStatusFilter === "active" && !b.is_overdue);
          const q = borrowSearch.trim().toLowerCase();
          const matchSearch =
            !q ||
            b.book_title?.toLowerCase().includes(q) ||
            b.username?.toLowerCase().includes(q);
          return matchBook && matchBorrower && matchStatus && matchSearch;
        })
        // Pending return/fine-payment requests need admin action — surface
        // them first so they aren't buried in the full borrows list.
        .sort((a, b) => (b.return_requested_at ? 1 : 0) - (a.return_requested_at ? 1 : 0)),
    [borrows, borrowBookFilter, borrowBorrowerFilter, borrowStatusFilter, borrowSearch]
  );

  const hasBorrowFilters =
    borrowBookFilter || borrowBorrowerFilter || borrowStatusFilter;
  const clearBorrowFilters = () => {
    setBorrowBookFilter("");
    setBorrowBorrowerFilter("");
    setBorrowStatusFilter("");
  };

  const borrowFilterMenus = {
    book: {
      value: borrowBookFilter,
      setValue: setBorrowBookFilter,
      options: [
        { value: "", label: "All books" },
        ...borrowBookOptions.map((title) => ({ value: title, label: title })),
      ],
    },
    borrower: {
      value: borrowBorrowerFilter,
      setValue: setBorrowBorrowerFilter,
      options: [
        { value: "", label: "All borrowers" },
        ...borrowBorrowerOptions.map((username) => ({
          value: username,
          label: username,
        })),
      ],
    },
    status: {
      value: borrowStatusFilter,
      setValue: setBorrowStatusFilter,
      options: [
        { value: "", label: "All statuses" },
        { value: "active", label: "Active" },
        { value: "overdue", label: "Overdue" },
      ],
    },
  };

  const toggleBorrowFilter = (column) => {
    setOpenBorrowFilter((prev) => (prev === column ? null : column));
    setBorrowFilterSearch("");
  };

  const visibleBorrowFilterOptions = openBorrowFilter
    ? borrowFilterMenus[openBorrowFilter].options.filter(
        (opt) =>
          opt.value === "" ||
          opt.label
            .toLowerCase()
            .includes(borrowFilterSearch.trim().toLowerCase())
      )
    : [];

  useEffect(() => {
    if (openBorrowFilter) borrowFilterSearchRef.current?.focus();
  }, [openBorrowFilter]);

  return (
    <>
      <div className="section-header" data-tour="admin-borrows">
        <h3>Currently Borrowed</h3>
        {hasBorrowFilters && (
          <button
            className="btn btn-sm btn-outline"
            onClick={clearBorrowFilters}
          >
            Clear filters
          </button>
        )}
      </div>
      <div className="search-top-bar" style={{ marginBottom: 20 }}>
        <SearchBar
          value={borrowSearch}
          onChange={setBorrowSearch}
          placeholder="Search by book or borrower…"
          className="search-bar-wide"
        />
      </div>
      {borrows.length === 0 ? (
        <div className="empty">No active borrows</div>
      ) : (
        <table className="borrows-table">
          <thead>
            <tr>
              <th>
                <span className="th-filter-wrap">
                  Book
                  <button
                    type="button"
                    className={`th-filter-btn${
                      borrowBookFilter ? " th-filter-btn-active" : ""
                    }`}
                    ref={
                      openBorrowFilter === "book"
                        ? borrowFilterBtnRef
                        : null
                    }
                    onClick={() => toggleBorrowFilter("book")}
                    aria-label="Filter by book"
                    aria-expanded={openBorrowFilter === "book"}
                  >
                    <ColumnFilterArrow />
                  </button>
                </span>
              </th>
              <th>
                <span className="th-filter-wrap">
                  Borrower
                  <button
                    type="button"
                    className={`th-filter-btn${
                      borrowBorrowerFilter
                        ? " th-filter-btn-active"
                        : ""
                    }`}
                    ref={
                      openBorrowFilter === "borrower"
                        ? borrowFilterBtnRef
                        : null
                    }
                    onClick={() => toggleBorrowFilter("borrower")}
                    aria-label="Filter by borrower"
                    aria-expanded={openBorrowFilter === "borrower"}
                  >
                    <ColumnFilterArrow />
                  </button>
                </span>
              </th>
              <th>
                <span className="th-filter-wrap">
                  Tags
                  <button
                    type="button"
                    className={`th-filter-btn${
                      borrowStatusFilter ? " th-filter-btn-active" : ""
                    }`}
                    ref={
                      openBorrowFilter === "status"
                        ? borrowFilterBtnRef
                        : null
                    }
                    onClick={() => toggleBorrowFilter("status")}
                    aria-label="Filter by tag"
                    aria-expanded={openBorrowFilter === "status"}
                  >
                    <TagIcon />
                  </button>
                </span>
              </th>
              <th>Borrow Date</th>
              <th>Due Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredBorrows.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty">
                  No borrows match your filters
                </td>
              </tr>
            ) : (
              filteredBorrows.map((b) => (
                <tr key={b.id}>
                  <td>{b.book_title}</td>
                  <td>{b.username}</td>
                  <td>
                    <span
                      className={`status-tag${
                        b.is_overdue
                          ? " status-tag-overdue"
                          : " status-tag-active"
                      }`}
                    >
                      {b.is_overdue
                        ? "Overdue"
                        : dueInDaysLabel(b.due_date)}
                    </span>
                    {b.return_requested_at && (
                      <span className="status-tag status-tag-queue">
                        Return Requested
                      </span>
                    )}
                    {b.fine_payment_requested_at && (
                      <span className="status-tag status-tag-queue">
                        Fine Payment {formatCurrency(b.fine, currency)} Pending
                      </span>
                    )}
                  </td>
                  <td>
                    {new Date(b.borrow_date).toLocaleDateString()}
                  </td>
                  <td>{new Date(b.due_date).toLocaleDateString()}</td>
                  <td className="col-action">
                    {b.return_requested_at && (
                      <div className="borrow-return-actions">
                        <button
                          className="btn btn-sm"
                          disabled={processingReturnId === b.id}
                          onClick={() => approveReturn(b.id)}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          disabled={processingReturnId === b.id}
                          onClick={() => rejectReturn(b.id)}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
      <ActionMenu
        open={!!openBorrowFilter}
        anchorRef={borrowFilterBtnRef}
        onClose={() => setOpenBorrowFilter(null)}
      >
        {openBorrowFilter && (
          <>
            <div className="custom-select-search-wrap">
              <input
                ref={borrowFilterSearchRef}
                type="text"
                className="custom-select-search"
                placeholder="Search…"
                value={borrowFilterSearch}
                onChange={(e) => setBorrowFilterSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpenBorrowFilter(null);
                }}
              />
            </div>
            <div className="action-menu-scroll">
              {visibleBorrowFilterOptions.length === 0 ? (
                <div className="custom-select-no-match">No matches</div>
              ) : (
                visibleBorrowFilterOptions.map((opt) => (
                  <button
                    key={opt.value}
                    className={`action-menu-item${
                      borrowFilterMenus[openBorrowFilter].value ===
                      opt.value
                        ? " action-menu-item-active"
                        : ""
                    }`}
                    onClick={() => {
                      borrowFilterMenus[openBorrowFilter].setValue(
                        opt.value
                      );
                      setOpenBorrowFilter(null);
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
    </>
  );
}

export default BorrowsTab;
