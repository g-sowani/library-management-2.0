import React from "react";
import { useAuth } from "../../../../context/AuthContext";
import { formatCurrency } from "../../../../utils/currency";

function MemberOverviewStats({ memberStats }) {
  const { user } = useAuth();
  const currency = user?.library?.currency;
  return (
    <>
      <div className="section-header" style={{ marginTop: 40 }}>
        <h3>Member Overview</h3>
      </div>

      <div className="member-stats">
        <div className="member-stat">
          <span className="member-stat-label">Total members</span>
          <span className="member-stat-value">
            {memberStats.totalMembers}
          </span>
        </div>
        <div className="member-stat">
          <span className="member-stat-label">
            Currently borrowed
          </span>
          <span className="member-stat-value">
            {memberStats.currentlyBorrowed}
          </span>
        </div>
        <div className="member-stat">
          <span className="member-stat-label">Fines pending</span>
          <span
            className={`member-stat-value${
              memberStats.finesPending > 0 ? " fine-amount" : ""
            }`}
          >
            {formatCurrency(memberStats.finesPending, currency)}
          </span>
        </div>
        <div className="member-stat">
          <span className="member-stat-label">Fines collected</span>
          <span className="member-stat-value member-stat-value-good">
            {formatCurrency(memberStats.finesPaid, currency)}
          </span>
        </div>
      </div>

      <div className="member-charts">
        <div className="member-chart-card">
          <div className="member-chart-title">Members by tier</div>
          <div className="bar-chart">
            {memberStats.tiers.map((t) => (
              <div className="bar-chart-row" key={t.key}>
                <span className="bar-chart-row-label">{t.label}</span>
                <div className="bar-chart-track">
                  <div
                    className={`bar-chart-fill bar-chart-fill-tier-${t.key}`}
                    tabIndex={0}
                    title={`${t.label}: ${t.count} member${
                      t.count === 1 ? "" : "s"
                    }`}
                    style={{
                      width: `${
                        (t.count / memberStats.maxTierCount) * 100
                      }%`,
                    }}
                  />
                </div>
                <span className="bar-chart-row-value">
                  {t.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="member-chart-card">
          <div className="member-chart-title">Top borrowers</div>
          {memberStats.topBorrowers.length === 0 ? (
            <div className="empty">No borrows yet</div>
          ) : (
            <div className="bar-chart">
              {memberStats.topBorrowers.map((m) => (
                <div className="bar-chart-row" key={m.id}>
                  <span className="bar-chart-row-label">
                    {m.username}
                  </span>
                  <div className="bar-chart-track">
                    <div
                      className="bar-chart-fill bar-chart-fill-accent"
                      tabIndex={0}
                      title={`${m.username}: ${m.total_borrows} total borrows`}
                      style={{
                        width: `${
                          (m.total_borrows / memberStats.maxBorrows) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                  <span className="bar-chart-row-value">
                    {m.total_borrows}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default MemberOverviewStats;
