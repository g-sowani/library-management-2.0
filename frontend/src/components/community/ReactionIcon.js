import React from "react";

export const REACTIONS = [
  { key: "like", label: "Like" },
  { key: "love", label: "Love" },
  { key: "haha", label: "Haha" },
  { key: "wow", label: "Wow" },
  { key: "sad", label: "Sad" },
  { key: "angry", label: "Angry" },
];

const sl = "round"; // strokeLinecap / strokeLinejoin shorthand value

function ReactionIcon({ type, size = 13 }) {
  const common = {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: sl,
    strokeLinejoin: sl,
  };
  if (type === "like")
    return (
      <svg {...common}>
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
        <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
      </svg>
    );
  if (type === "love")
    return (
      <svg {...common}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  if (type === "haha")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M8 13s1.5 3 4 3 4-3 4-3" />
        <line x1="9" y1="9.5" x2="9.01" y2="9.5" strokeWidth="2.5" />
        <line x1="15" y1="9.5" x2="15.01" y2="9.5" strokeWidth="2.5" />
      </svg>
    );
  if (type === "wow")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="8.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
        <ellipse cx="12" cy="16" rx="2" ry="2.2" />
      </svg>
    );
  if (type === "sad")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M16 17s-1.5-2-4-2-4 2-4 2" />
        <line x1="9" y1="9.5" x2="9.01" y2="9.5" strokeWidth="2.5" />
        <line x1="15" y1="9.5" x2="15.01" y2="9.5" strokeWidth="2.5" />
      </svg>
    );
  if (type === "angry")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M16 17s-1.5-2-4-2-4 2-4 2" />
        <path d="M7.5 7.5l3 2" />
        <path d="M16.5 7.5l-3 2" />
      </svg>
    );
  return null;
}

export default ReactionIcon;
