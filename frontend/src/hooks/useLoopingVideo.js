import { useEffect } from 'react';

const FADE_DURATION = 0.5;
const END_BUFFER = 1; // stop & loop this many seconds before the true end

// Wires a <video> ref into a manual seamless loop: fades in/out around the
// clip's start/end instead of relying on the native `loop` attribute, so the
// loop point is invisible instead of a hard cut. The loop is also triggered
// early (END_BUFFER before the real end) rather than waiting for the native
// `ended` event, so the clip never plays into its last second.
export function useLoopingVideo(videoRef) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    let rafId;
    let looping = false;

    const restart = () => {
      if (looping) return;
      looping = true;
      video.pause();
      video.style.opacity = 0;
      setTimeout(() => {
        video.currentTime = 0;
        video.play();
        looping = false;
      }, 100);
    };

    const tick = () => {
      const { currentTime, duration } = video;
      if (duration) {
        const effectiveEnd = Math.max(duration - END_BUFFER, FADE_DURATION);
        let opacity = 1;
        if (currentTime < FADE_DURATION) {
          opacity = currentTime / FADE_DURATION;
        } else if (currentTime > effectiveEnd - FADE_DURATION) {
          opacity = Math.max((effectiveEnd - currentTime) / FADE_DURATION, 0);
        }
        video.style.opacity = opacity;

        if (currentTime >= effectiveEnd) {
          restart();
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // Fallback in case the early trigger above is ever missed (e.g. a
    // throttled background tab) — the browser will still reach the real end.
    video.addEventListener('ended', restart);

    return () => {
      cancelAnimationFrame(rafId);
      video.removeEventListener('ended', restart);
    };
  }, [videoRef]);
}
