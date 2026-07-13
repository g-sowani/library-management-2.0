import React from "react";
import { wcagTextColor } from "../utils/colorContrast";

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

export function ReaderBookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 4 13c0-7 7-11 7-11s7 4 7 11a7 7 0 0 1-7 7z" />
      <line x1="11" y1="20" x2="11" y2="13" />
    </svg>
  );
}

function WavesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2" />
    </svg>
  );
}

function FlowerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z" />
      <path d="M12 14a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z" />
      <path d="M2 12a4 4 0 0 1 4-4 4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4z" />
      <path d="M14 12a4 4 0 0 1 4-4 4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4z" />
    </svg>
  );
}

export const APPEARANCE_OPTIONS = [
  { key: "light", label: "Light", Icon: SunIcon },
  { key: "system", label: "System", Icon: MonitorIcon },
  { key: "dark", label: "Dark", Icon: MoonIcon },
];

export const READER_THEME_OPTIONS = [
  { key: "sepia", label: "Sepia", Icon: ReaderBookIcon },
  { key: "forest", label: "Forest", Icon: LeafIcon },
  { key: "ocean", label: "Ocean", Icon: WavesIcon },
  { key: "rose", label: "Rose", Icon: FlowerIcon },
];

export const ACCENT_PRESETS = [
  { key: "red", label: "Red", color: "#e53935" },
  { key: "maroon", label: "Maroon", color: "#6d1b2f" },
  { key: "blue", label: "Blue", color: "#1e88e5" },
  { key: "green", label: "Green", color: "#43a047" },
  { key: "yellow", label: "Yellow", color: "#fdd835" },
  { key: "purple", label: "Purple", color: "#8e24aa" },
  { key: "white", label: "White", color: "#ffffff" },
  { key: "gray", label: "Gray", color: "#757575" },
  { key: "teal", label: "Teal", color: "#00897b" },
  { key: "turquoise", label: "Turquoise", color: "#26c6da" },
  { key: "amber", label: "Amber", color: "#ffb300" },
  { key: "orange", label: "Orange", color: "#fb8c00" },
].map((p) => ({
  ...p,
  text: wcagTextColor(
    parseInt(p.color.slice(1, 3), 16),
    parseInt(p.color.slice(3, 5), 16),
    parseInt(p.color.slice(5, 7), 16)
  ),
}));
