import React, { useRef, useState } from "react";
import api from "../../../api";
import UserAvatar from "../../../components/UserAvatar";
import Select from "../../../components/Select";
import MembershipBadge from "../../../components/MembershipBadge";
import CheckIcon from "../../../components/icons/CheckIcon";
import PaletteIcon from "../../../components/icons/PaletteIcon";
import { resizeImageToBase64 } from "../../../utils/resizeImageToBase64";
import { contrastTextFor } from "../../../utils/colorContrast";
import { formatCurrency } from "../../../utils/currency";
import { TIER_LABELS, TIER_OPTIONS } from "../../../constants/membership";
import {
  APPEARANCE_OPTIONS,
  READER_THEME_OPTIONS,
  ACCENT_PRESETS,
  ReaderBookIcon,
} from "../../../constants/appearance";

const EMPTY_ACCOUNT_FORM = {
  username: "",
  email: "",
  new_password: "",
  confirm_password: "",
  current_password: "",
};

function ProfileTab({
  user,
  updateUser,
  toast,
  load,
  membershipInfo,
  membershipRequests,
  navStyle,
  setNavStyle,
  appearance,
  setAppearance,
  readerTheme,
  setReaderTheme,
  accentOverride,
  setAccentOverride,
  autoAccentColor,
}) {
  const currency = user?.library?.currency;
  const avatarInputRef = useRef(null);
  const [avatarError, setAvatarError] = useState("");

  const accentColorInputRef = useRef(null);
  const isPresetAccent =
    !accentOverride || ACCENT_PRESETS.some((p) => p.color === accentOverride);

  const [accountEditing, setAccountEditing] = useState(false);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const [accountError, setAccountError] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);

  const [requestedTier, setRequestedTier] = useState(null);

  const pendingMembershipRequest =
    membershipRequests.find((r) => r.status === "pending") || null;
  const lastReviewedMembershipRequest =
    membershipRequests.find((r) => r.status !== "pending") || null;

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Image must be under 5 MB");
      return;
    }
    setAvatarError("");
    try {
      const base64 = await resizeImageToBase64(file);
      const res = await api.put("/auth/avatar", { avatar: base64 });
      updateUser(res.data);
      toast("Photo updated");
    } catch {
      setAvatarError("Failed to update profile image");
    }
  };

  const startAccountEdit = () => {
    setAccountForm({
      ...EMPTY_ACCOUNT_FORM,
      username: user.username,
      email: user.email || "",
    });
    setAccountError("");
    setAccountEditing(true);
  };

  const cancelAccountEdit = () => {
    setAccountEditing(false);
    setAccountError("");
    setAccountForm(EMPTY_ACCOUNT_FORM);
  };

  const saveAccountDetails = async () => {
    setAccountError("");
    if (!accountForm.current_password) {
      setAccountError("Enter your current password to save changes");
      return;
    }
    if (
      accountForm.new_password &&
      accountForm.new_password !== accountForm.confirm_password
    ) {
      setAccountError("New passwords do not match");
      return;
    }
    setAccountSaving(true);
    try {
      const res = await api.put("/auth/profile", {
        current_password: accountForm.current_password,
        username: accountForm.username,
        email: accountForm.email,
        new_password: accountForm.new_password || undefined,
      });
      updateUser(res.data);
      setAccountEditing(false);
      setAccountForm(EMPTY_ACCOUNT_FORM);
      toast("Account details updated");
    } catch (err) {
      setAccountError(
        err.response?.data?.error || "Failed to update account details"
      );
    } finally {
      setAccountSaving(false);
    }
  };

  const submitTierRequest = async () => {
    if (!requestedTier) return;
    try {
      await api.post("/membership-requests", { tier: requestedTier });
      setRequestedTier(null);
      load();
      toast("Membership request submitted");
    } catch (err) {
      toast(err.response?.data?.error || "Failed to submit request", "error");
    }
  };

  return (
    <>
      {/* Avatar editor */}
      <div className="profile-avatar-section">
        <div
          className="profile-avatar-wrap"
          onClick={() => avatarInputRef.current?.click()}
          title="Change profile photo"
        >
          <UserAvatar
            avatar={user.avatar}
            username={user.username}
            size={80}
          />
          <div className="profile-avatar-overlay">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        </div>
        <div className="profile-avatar-info">
          <div className="profile-username">{user.username}</div>
          <div className="profile-avatar-hint">
            Click to change photo
          </div>
          {avatarError && (
            <div
              className="error"
              style={{ marginTop: 4, marginBottom: 0 }}
            >
              {avatarError}
            </div>
          )}
        </div>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleAvatarChange}
        />
      </div>

      {membershipInfo && (
        <div className="membership-card" data-tour="member-membership">
          <div className="membership-card-tier">
            <MembershipBadge tier={membershipInfo.membership?.tier} />
            {!membershipInfo.membership && (
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                {pendingMembershipRequest
                  ? "No membership yet"
                  : "No membership — pick a tier below to request one"}
              </span>
            )}
          </div>
          <div className="membership-card-stats">
            {membershipInfo.membership && (
              <>
                <div className="membership-stat">
                  <span className="membership-stat-label">
                    Borrow limit
                  </span>
                  <span className="membership-stat-value">
                    {membershipInfo.membership.borrow_limit} book
                    {membershipInfo.membership.borrow_limit > 1
                      ? "s"
                      : ""}{" "}
                    at a time
                  </span>
                </div>
                <div className="membership-stat">
                  <span className="membership-stat-label">
                    Monthly rate
                  </span>
                  <span className="membership-stat-value">
                    {formatCurrency(
                      membershipInfo.membership.tier === "silver"
                        ? membershipInfo.pricing.silver_rate
                        : membershipInfo.membership.tier === "gold"
                        ? membershipInfo.pricing.gold_rate
                        : membershipInfo.pricing.family_rate,
                      currency
                    )}
                  </span>
                </div>
                {membershipInfo.membership.tier === "family" &&
                  membershipInfo.family_members.length > 0 && (
                    <div className="membership-stat">
                      <span className="membership-stat-label">
                        Family group
                      </span>
                      <span
                        className="membership-stat-value"
                        style={{ fontSize: "0.85rem" }}
                      >
                        {membershipInfo.family_members.join(", ")}
                      </span>
                    </div>
                  )}
              </>
            )}
          </div>
        </div>
      )}

      {pendingMembershipRequest ? (
        <div className="membership-card" style={{ marginTop: -16 }}>
          <div className="membership-card-tier">
            <MembershipBadge
              tier={pendingMembershipRequest.requested_tier}
            />
          </div>
          <div className="membership-card-stats">
            <div className="membership-stat">
              <span className="membership-stat-label">Status</span>
              <span className="membership-stat-value">
                Requested — awaiting admin approval
              </span>
            </div>
            <div className="membership-stat">
              <span className="membership-stat-label">Submitted</span>
              <span className="membership-stat-value">
                {new Date(
                  pendingMembershipRequest.submitted_at
                ).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      ) : (
        membershipInfo && (
          <div style={{ marginTop: -16, marginBottom: 28 }}>
            {lastReviewedMembershipRequest?.status === "rejected" && (
              <p
                className="field-hint"
                style={{ marginTop: 0, marginBottom: 10 }}
              >
                Your last request (
                {
                  TIER_LABELS[
                    lastReviewedMembershipRequest.requested_tier
                  ]
                }
                ) was declined
                {lastReviewedMembershipRequest.admin_notes
                  ? `: "${lastReviewedMembershipRequest.admin_notes}"`
                  : "."}{" "}
                You can submit a new request below.
              </p>
            )}
            <Select
              value={requestedTier || ""}
              onChange={(e) => setRequestedTier(e.target.value || null)}
            >
              <option value="">Switch Membership Tier</option>
              {TIER_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {membershipInfo.pricing
                    ? ` — ${formatCurrency(
                        membershipInfo.pricing[t.priceKey],
                        currency
                      )}/mo`
                    : ""}
                </option>
              ))}
            </Select>
            {requestedTier && (
              <>
                <p className="field-hint">
                  {
                    TIER_OPTIONS.find((t) => t.id === requestedTier)
                      ?.desc
                  }
                </p>
                <button
                  className="btn btn-sm"
                  style={{ marginTop: 10 }}
                  onClick={submitTierRequest}
                >
                  {membershipInfo.membership
                    ? "Request Update"
                    : "Request Membership"}
                </button>
              </>
            )}
          </div>
        )
      )}

      {/* Account details */}
      <div className="section-header" style={{ marginTop: 32 }}>
        <h3>Account Details</h3>
        {!accountEditing && (
          <button
            className="btn btn-sm btn-outline"
            onClick={startAccountEdit}
          >
            Edit
          </button>
        )}
      </div>
      <div style={{ marginBottom: 32 }}>
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            value={accountEditing ? accountForm.username : user.username}
            disabled={!accountEditing}
            onChange={(e) =>
              setAccountForm({
                ...accountForm,
                username: e.target.value,
              })
            }
          />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={accountEditing ? accountForm.email : user.email || ""}
            disabled={!accountEditing}
            onChange={(e) =>
              setAccountForm({ ...accountForm, email: e.target.value })
            }
          />
        </div>
        <div className="form-group">
          <label>New Password</label>
          <input
            type="password"
            placeholder={
              accountEditing
                ? "Leave blank to keep current password"
                : "••••••••"
            }
            value={accountEditing ? accountForm.new_password : ""}
            disabled={!accountEditing}
            onChange={(e) =>
              setAccountForm({
                ...accountForm,
                new_password: e.target.value,
              })
            }
          />
        </div>
        {accountEditing && (
          <>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={accountForm.confirm_password}
                onChange={(e) =>
                  setAccountForm({
                    ...accountForm,
                    confirm_password: e.target.value,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label>Current Password (required to save changes)</label>
              <input
                type="password"
                value={accountForm.current_password}
                onChange={(e) =>
                  setAccountForm({
                    ...accountForm,
                    current_password: e.target.value,
                  })
                }
                autoFocus
              />
            </div>
            {accountError && <div className="error">{accountError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn btn-sm"
                onClick={saveAccountDetails}
                disabled={accountSaving}
              >
                {accountSaving ? "Saving…" : "Save Changes"}
              </button>
              <button
                className="btn btn-sm btn-outline"
                onClick={cancelAccountEdit}
                disabled={accountSaving}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>

      {/* Preferences */}
      <div className="section-header" style={{ marginTop: 32 }}>
        <h3>Preferences</h3>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--text-3)",
            marginBottom: 10,
          }}
        >
          Navigation style
        </div>
        <div className="nav-style-picker">
          <button
            type="button"
            className={`nav-style-option${
              navStyle !== "dock" ? " active" : ""
            }`}
            onClick={() => setNavStyle("tabs")}
          >
            <div className="nav-style-preview">
              <div className="nav-style-preview-tabs">
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="nav-style-option-name">Tab Bar</div>
            <div className="nav-style-option-desc">
              Tabs below the header, as it is now
            </div>
          </button>
          <button
            type="button"
            className={`nav-style-option${
              navStyle === "dock" ? " active" : ""
            }`}
            onClick={() => setNavStyle("dock")}
          >
            <div className="nav-style-preview">
              <div className="nav-style-preview-dock">
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="nav-style-option-name">Dock</div>
            <div className="nav-style-option-desc">
              A floating Mac-style icon dock
            </div>
          </button>
        </div>
      </div>

      <div className="pref-columns" style={{ marginBottom: 32 }}>
        <div className="pref-column">
          <div
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "var(--text-3)",
              marginBottom: 10,
            }}
          >
            Appearance
          </div>
          <div className="pd-options-row pref-options-row">
            {APPEARANCE_OPTIONS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                className={`pd-option${
                  appearance === key ? " pd-option-active" : ""
                }`}
                onClick={() => setAppearance(key)}
                title={label}
              >
                <Icon />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="pref-column">
          <div
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "var(--text-3)",
              marginBottom: 10,
            }}
          >
            Reader theme
          </div>
          <div className="pd-options-row pref-options-row">
            {READER_THEME_OPTIONS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                className={`pd-option${
                  readerTheme === key ? " pd-option-active" : ""
                }`}
                onClick={() =>
                  setReaderTheme(readerTheme === key ? "" : key)
                }
                title={label}
              >
                <Icon />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--text-3)",
            marginBottom: 10,
          }}
        >
          Accent color
        </div>
        <div className="accent-swatch-row">
          <button
            type="button"
            className={`accent-swatch accent-swatch-auto${
              !accentOverride ? " accent-swatch-selected" : ""
            }`}
            onClick={() => setAccentOverride("")}
            title={
              autoAccentColor
                ? "Default — matches your borrowed book's cover"
                : "Default — matches your borrowed book's cover (borrow a book to see it)"
            }
            style={
              autoAccentColor
                ? {
                    background: autoAccentColor,
                    color: contrastTextFor(autoAccentColor),
                  }
                : undefined
            }
          >
            {!accentOverride ? (
              <CheckIcon />
            ) : (
              <ReaderBookIcon />
            )}
          </button>
          {ACCENT_PRESETS.map(({ key, label, color, text }) => (
            <button
              key={key}
              type="button"
              className={`accent-swatch${
                accentOverride === color
                  ? " accent-swatch-selected"
                  : ""
              }${color === "#ffffff" ? " accent-swatch-outlined" : ""}`}
              style={{ background: color, color: text }}
              onClick={() => setAccentOverride(color)}
              title={label}
            >
              {accentOverride === color && <CheckIcon />}
            </button>
          ))}
          <button
            type="button"
            className={`accent-swatch accent-swatch-custom${
              accentOverride && !isPresetAccent
                ? " accent-swatch-selected"
                : ""
            }`}
            style={
              accentOverride && !isPresetAccent
                ? {
                    background: accentOverride,
                    color: contrastTextFor(accentOverride),
                  }
                : undefined
            }
            onClick={() => accentColorInputRef.current?.click()}
            title="Pick a custom color"
          >
            {accentOverride && !isPresetAccent ? (
              <CheckIcon />
            ) : (
              <PaletteIcon />
            )}
          </button>
          <input
            ref={accentColorInputRef}
            type="color"
            value={
              accentOverride && !isPresetAccent
                ? accentOverride
                : "#000000"
            }
            onChange={(e) => setAccentOverride(e.target.value)}
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
    </>
  );
}

export default ProfileTab;
