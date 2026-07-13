import React, { useEffect, useState } from "react";
import api from "../../../api";
import Select from "../../../components/Select";
import { useAuth } from "../../../context/AuthContext";
import { CURRENCIES, getCurrencySymbol } from "../../../utils/currency";

function MyLibraryTab({ toast, onOpenReAuth }) {
  const { user, updateUser } = useAuth();
  const currency = user?.library?.currency;

  const [libraryForm, setLibraryForm] = useState({
    name: user.library.name,
    currency: user.library.currency,
  });
  const [libraryError, setLibraryError] = useState("");

  const [policy, setPolicy] = useState(null);
  const [policyForm, setPolicyForm] = useState({
    fine_per_day: "",
    borrow_days: "",
  });
  const [policyError, setPolicyError] = useState("");

  const [membershipPricing, setMembershipPricing] = useState(null);
  const [membershipPricingForm, setMembershipPricingForm] = useState({
    silver_rate: "",
    gold_rate: "",
    family_rate: "",
  });
  const [membershipPricingError, setMembershipPricingError] = useState("");

  useEffect(() => {
    api.get("/admin/policy").then((r) => {
      setPolicy(r.data);
      setPolicyForm({
        fine_per_day: r.data.fine_per_day,
        borrow_days: r.data.borrow_days,
      });
    });
    api.get("/admin/memberships/pricing").then((r) => {
      setMembershipPricing(r.data);
      setMembershipPricingForm({
        silver_rate: r.data.silver_rate,
        gold_rate: r.data.gold_rate,
        family_rate: r.data.family_rate,
      });
    });
  }, []);

  const doSaveLibrary = async () => {
    setLibraryError("");
    try {
      const res = await api.put("/admin/library", libraryForm);
      updateUser({ library: { ...user.library, ...res.data } });
      toast("Library settings saved");
    } catch (err) {
      const errs = err.response?.data?.errors;
      setLibraryError(
        errs ? Object.values(errs).join(", ") : "Failed to save library settings"
      );
    }
  };

  const saveLibrary = (e) => onOpenReAuth(e, doSaveLibrary);

  const doSavePolicy = async () => {
    setPolicyError("");
    try {
      const res = await api.put("/admin/policy", policyForm);
      setPolicy(res.data);
      toast("Policy saved");
    } catch (err) {
      const errs = err.response?.data?.errors;
      setPolicyError(
        errs ? Object.values(errs).join(", ") : "Failed to save policy"
      );
    }
  };

  const savePolicy = (e) => onOpenReAuth(e, doSavePolicy);

  const doSaveMembershipPricing = async () => {
    setMembershipPricingError("");
    try {
      const res = await api.put(
        "/admin/memberships/pricing",
        membershipPricingForm
      );
      setMembershipPricing(res.data);
      toast("Pricing saved");
    } catch (err) {
      const errs = err.response?.data?.errors;
      setMembershipPricingError(
        errs ? Object.values(errs).join(", ") : "Failed to save pricing"
      );
    }
  };

  const saveMembershipPricing = (e) => onOpenReAuth(e, doSaveMembershipPricing);

  return (
    <>
      <div className="section-header">
        <h3>My Library</h3>
      </div>
      <form className="policy-form" onSubmit={saveLibrary}>
        {libraryError && <div className="error">{libraryError}</div>}
        <div className="form-group">
          <label>Library Name</label>
          <input
            type="text"
            value={libraryForm.name}
            onChange={(e) =>
              setLibraryForm({ ...libraryForm, name: e.target.value })
            }
            required
          />
        </div>
        <div className="form-group">
          <label>Currency</label>
          <Select
            value={libraryForm.currency}
            onChange={(e) =>
              setLibraryForm({ ...libraryForm, currency: e.target.value })
            }
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label} ({c.symbol})
              </option>
            ))}
          </Select>
          <p className="field-hint">
            Used everywhere money is shown across your library
          </p>
        </div>
        <div className="form-group">
          <label>Join Code</label>
          <input type="text" value={user.library.code} disabled />
          <p className="field-hint">
            Share this code so other admins/members can join your library
          </p>
        </div>
        <button type="submit" className="btn btn-sm">
          Save Library Settings
        </button>
      </form>

      <div className="section-header" style={{ marginTop: 40 }}>
        <h3>Fine Policy</h3>
      </div>
      {policy && (
        <form className="policy-form" onSubmit={savePolicy}>
          {policyError && <div className="error">{policyError}</div>}
          <div className="form-group">
            <label>Fine Per Day ({getCurrencySymbol(currency)})</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={policyForm.fine_per_day}
              onChange={(e) =>
                setPolicyForm({
                  ...policyForm,
                  fine_per_day: e.target.value,
                })
              }
              required
            />
            <p className="field-hint">
              Charged per day a book is overdue
            </p>
          </div>
          <div className="form-group">
            <label>Borrow Duration (days)</label>
            <input
              type="number"
              min="1"
              value={policyForm.borrow_days}
              onChange={(e) =>
                setPolicyForm({
                  ...policyForm,
                  borrow_days: e.target.value,
                })
              }
              required
            />
            <p className="field-hint">Applies to new borrows only</p>
          </div>
          <button type="submit" className="btn btn-sm">
            Save Policy
          </button>
        </form>
      )}

      <div className="section-header" style={{ marginTop: 40 }}>
        <h3>Membership Pricing</h3>
      </div>
      {membershipPricing && (
        <form
          className="membership-pricing-form"
          onSubmit={saveMembershipPricing}
        >
          {membershipPricingError && (
            <div className="error">{membershipPricingError}</div>
          )}
          <div className="tier-pricing-grid">
            <div className="tier-pricing-card">
              <div className="tier-pricing-name">Silver</div>
              <div className="tier-pricing-desc">
                1 book at a time · Standard access
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Monthly Rate ({getCurrencySymbol(currency)})</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={membershipPricingForm.silver_rate}
                  onChange={(e) =>
                    setMembershipPricingForm({
                      ...membershipPricingForm,
                      silver_rate: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="tier-pricing-card tier-pricing-card-gold">
              <div className="tier-pricing-name">Gold</div>
              <div className="tier-pricing-desc">
                3 books at a time · Community & Games access
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Monthly Rate ({getCurrencySymbol(currency)})</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={membershipPricingForm.gold_rate}
                  onChange={(e) =>
                    setMembershipPricingForm({
                      ...membershipPricingForm,
                      gold_rate: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="tier-pricing-card">
              <div className="tier-pricing-name">Family</div>
              <div className="tier-pricing-desc">
                Up to 4 members · 1 book each · Shared plan
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Monthly Rate ({getCurrencySymbol(currency)})</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={membershipPricingForm.family_rate}
                  onChange={(e) =>
                    setMembershipPricingForm({
                      ...membershipPricingForm,
                      family_rate: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
          <p className="field-hint" style={{ marginBottom: 12 }}>
            Gold rate must be higher than Silver; Family rate is for the
            whole group
          </p>
          <button type="submit" className="btn btn-sm">
            Save Pricing
          </button>
        </form>
      )} 
    </>
  );
}

export default MyLibraryTab;
