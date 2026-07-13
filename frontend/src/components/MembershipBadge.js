import React from "react";
import { TIER_LABELS } from "../constants/membership";

function MembershipBadge({ tier }) {
  if (!tier) return null;
  return (
    <span className={`membership-badge membership-badge-${tier}`}>
      {TIER_LABELS[tier]}
    </span>
  );
}

export default MembershipBadge;
