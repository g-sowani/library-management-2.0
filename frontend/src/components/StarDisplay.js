import React from "react";

function StarDisplay({ rating }) {
  const rounded = Math.round(rating);
  return (
    <span className="star-display">
      {"★".repeat(rounded)}
      {"☆".repeat(5 - rounded)}
    </span>
  );
}

export default StarDisplay;
