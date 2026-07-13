import React from "react";
import Modal from "../../../components/Modal";
import Select from "../../../components/Select";
import { GENRES } from "../../../constants";
import { useAuth } from "../../../context/AuthContext";
import { formatCurrency, getCurrencySymbol } from "../../../utils/currency";

function DonateModal({
  donationForm,
  setDonationForm,
  donationError,
  donationSuccess,
  setDonationSuccess,
  onClose,
  onSubmit,
}) {
  const { user } = useAuth();
  const currency = user?.library?.currency;
  return (
    <Modal title="Donate a Book" onClose={onClose}>
      {donationSuccess ? (
        <>
          <p style={{ color: "#2e7d32", marginBottom: 20 }}>
            Your donation has been submitted! The admin will review it and
            add the book to the catalogue. You'll earn{" "}
            <strong>1/4 of the estimated value</strong> as credit once
            approved.
          </p>
          <div className="modal-actions">
            <button
              className="btn btn-sm"
              onClick={() => {
                onClose();
                setDonationSuccess(false);
              }}
            >
              Close
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => setDonationSuccess(false)}
            >
              Donate another
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={onSubmit}>
          {donationError && <div className="error">{donationError}</div>}
          <div className="form-group">
            <label>Title *</label>
            <input
              value={donationForm.title}
              onChange={(e) =>
                setDonationForm({
                  ...donationForm,
                  title: e.target.value,
                })
              }
              placeholder="Book title"
              required
            />
          </div>
          <div className="form-group">
            <label>Author *</label>
            <input
              value={donationForm.author}
              onChange={(e) =>
                setDonationForm({
                  ...donationForm,
                  author: e.target.value,
                })
              }
              placeholder="Author name"
              required
            />
          </div>
          <div className="form-group">
            <label>
              ISBN{" "}
              <span
                className="muted"
                style={{ textTransform: "none", fontSize: "0.75rem" }}
              >
                (optional — helps us find cover &amp; description)
              </span>
            </label>
            <input
              value={donationForm.isbn}
              onChange={(e) =>
                setDonationForm({ ...donationForm, isbn: e.target.value })
              }
              placeholder="e.g. 978-0747532743"
            />
          </div>
          <div className="form-group">
            <label>
              Genre{" "}
              <span
                className="muted"
                style={{ textTransform: "none", fontSize: "0.75rem" }}
              >
                (optional)
              </span>
            </label>
            <Select
              value={donationForm.genre}
              onChange={(e) =>
                setDonationForm({
                  ...donationForm,
                  genre: e.target.value,
                })
              }
            >
              <option value="">— Select genre —</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </div>
          <div className="form-group">
            <label>Condition *</label>
            <Select
              value={donationForm.condition}
              onChange={(e) =>
                setDonationForm({
                  ...donationForm,
                  condition: e.target.value,
                })
              }
            >
              <option value="new">New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </Select>
          </div>
          <div className="form-group">
            <label>Estimated Value ({getCurrencySymbol(currency)}) *</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={donationForm.estimated_price}
              onChange={(e) =>
                setDonationForm({
                  ...donationForm,
                  estimated_price: e.target.value,
                })
              }
              placeholder="e.g. 20.00"
              required
            />
            {donationForm.estimated_price > 0 && (
              <p className="field-hint">
                You will earn{" "}
                <strong>
                  {formatCurrency(
                    Number(donationForm.estimated_price) / 4,
                    currency
                  )}
                </strong>{" "}
                in library credit upon approval.
              </p>
            )}
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-sm">
              Submit Donation
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default DonateModal;
