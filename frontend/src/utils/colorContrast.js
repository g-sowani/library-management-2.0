export function wcagTextColor(r, g, b) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? "#000000" : "#ffffff";
}

// Binary-search the minimum opacity at which rgba(fgVal, fgVal, fgVal, α) composited
// over rgb(bgR,bgG,bgB) achieves the target contrast ratio. fgVal is 0 (black) or 255 (white).
export function minAlphaForContrast(fgVal, bgR, bgG, bgB, minRatio) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const bgL = 0.2126 * lin(bgR) + 0.7152 * lin(bgG) + 0.0722 * lin(bgB);
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 16; i++) {
    const alpha = (lo + hi) / 2;
    const rc = Math.round(fgVal * alpha + bgR * (1 - alpha));
    const gc = Math.round(fgVal * alpha + bgG * (1 - alpha));
    const bc = Math.round(fgVal * alpha + bgB * (1 - alpha));
    const fL = 0.2126 * lin(rc) + 0.7152 * lin(gc) + 0.0722 * lin(bc);
    const ratio = (Math.max(fL, bgL) + 0.05) / (Math.min(fL, bgL) + 0.05);
    if (ratio >= minRatio) hi = alpha;
    else lo = alpha;
  }
  return Math.min(1, hi + 0.005);
}

export function relLuminance(r, g, b) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(l1, l2) {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

export function contrastTextFor(hex) {
  if (!hex) return undefined;
  return wcagTextColor(
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  );
}
