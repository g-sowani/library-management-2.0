import React from "react";

function HangmanFigure({ wrong }) {
  return (
    <svg
      width="120"
      height="140"
      viewBox="0 0 120 140"
      className="hangman-figure"
    >
      <line
        x1="10"
        y1="130"
        x2="90"
        y2="130"
        stroke="currentColor"
        strokeWidth="4"
      />
      <line
        x1="30"
        y1="130"
        x2="30"
        y2="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <line
        x1="30"
        y1="10"
        x2="80"
        y2="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <line
        x1="80"
        y1="10"
        x2="80"
        y2="28"
        stroke="currentColor"
        strokeWidth="4"
      />
      {wrong >= 1 && (
        <circle
          cx="80"
          cy="40"
          r="12"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
        />
      )}
      {wrong >= 2 && (
        <line
          x1="80"
          y1="52"
          x2="80"
          y2="90"
          stroke="currentColor"
          strokeWidth="3"
        />
      )}
      {wrong >= 3 && (
        <line
          x1="80"
          y1="60"
          x2="65"
          y2="78"
          stroke="currentColor"
          strokeWidth="3"
        />
      )}
      {wrong >= 4 && (
        <line
          x1="80"
          y1="60"
          x2="95"
          y2="78"
          stroke="currentColor"
          strokeWidth="3"
        />
      )}
      {wrong >= 5 && (
        <line
          x1="80"
          y1="90"
          x2="68"
          y2="115"
          stroke="currentColor"
          strokeWidth="3"
        />
      )}
      {wrong >= 6 && (
        <line
          x1="80"
          y1="90"
          x2="92"
          y2="115"
          stroke="currentColor"
          strokeWidth="3"
        />
      )}
    </svg>
  );
}

export default HangmanFigure;
