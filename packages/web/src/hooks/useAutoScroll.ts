import { useState, useCallback, useEffect, useRef } from 'react';

interface UseAutoScrollOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
}

const ANIMATION_DURATION = 300;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function useAutoScroll({ containerRef, enabled }: UseAutoScrollOptions) {
  const [active, setActive] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [scrollPercent, setScrollPercent] = useState(10);

  const userPausedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const phaseRef = useRef<'waiting' | 'animating'>('waiting');
  const waitStartRef = useRef<number | null>(null);
  const animStartTimeRef = useRef<number | null>(null);
  const animStartScrollRef = useRef(0);
  const animTargetScrollRef = useRef(0);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current !== null) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const resetPhaseRefs = useCallback(() => {
    phaseRef.current = 'waiting';
    waitStartRef.current = null;
    animStartTimeRef.current = null;
    animStartScrollRef.current = 0;
    animTargetScrollRef.current = 0;
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    userPausedRef.current = false;
    resetPhaseRefs();
    clearResumeTimer();
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [clearResumeTimer, resetPhaseRefs]);

  const toggle = useCallback(() => {
    setActive((prev) => {
      if (prev) {
        userPausedRef.current = false;
        resetPhaseRefs();
        clearResumeTimer();
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        return false;
      }
      const el = containerRef.current;
      if (!el) return false;
      if (el.scrollHeight <= el.clientHeight) return false;
      return true;
    });
  }, [clearResumeTimer, resetPhaseRefs, containerRef]);

  // Stop when disabled
  useEffect(() => {
    if (!enabled && active) stop();
  }, [enabled, active, stop]);

  // Animation loop
  useEffect(() => {
    if (!active) return;

    // Reset phase state — first step fires immediately
    phaseRef.current = 'animating';
    waitStartRef.current = null;
    animStartTimeRef.current = null;

    function startAnimation(container: HTMLElement, now: number) {
      const stepSize = container.clientHeight * (scrollPercent / 100);
      phaseRef.current = 'animating';
      animStartTimeRef.current = now;
      animStartScrollRef.current = container.scrollTop;
      animTargetScrollRef.current = container.scrollTop + stepSize;
    }

    function tick(now: number) {
      const container = containerRef.current;
      if (!container) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (userPausedRef.current) {
        waitStartRef.current = null;
        phaseRef.current = 'waiting';
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (phaseRef.current === 'animating') {
        // First frame of animation — capture start position
        if (animStartTimeRef.current === null) {
          startAnimation(container, now);
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        const elapsed = now - animStartTimeRef.current;
        const t = Math.min(elapsed / ANIMATION_DURATION, 1);
        const eased = easeOutCubic(t);

        const startScroll = animStartScrollRef.current;
        const distance = animTargetScrollRef.current - startScroll;
        container.scrollTop = startScroll + distance * eased;

        // Stop at bottom
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 1) {
          setActive(false);
          userPausedRef.current = false;
          resetPhaseRefs();
          return;
        }

        if (t >= 1) {
          // Animation complete — enter waiting phase
          phaseRef.current = 'waiting';
          waitStartRef.current = now;
        }

        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Waiting phase
      if (waitStartRef.current === null) {
        waitStartRef.current = now;
      }

      const waited = now - waitStartRef.current;
      if (waited >= intervalSeconds * 1000) {
        startAnimation(container, now);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, containerRef, intervalSeconds, scrollPercent, resetPhaseRefs]);

  // User scroll detection (wheel + touch)
  useEffect(() => {
    if (!active) return;

    const el = containerRef.current;
    if (!el) return;

    function onUserScroll() {
      userPausedRef.current = true;
      clearResumeTimer();
      resumeTimerRef.current = setTimeout(() => {
        userPausedRef.current = false;
        waitStartRef.current = null;
      }, 2000);
    }

    el.addEventListener('wheel', onUserScroll, { passive: true });
    el.addEventListener('touchmove', onUserScroll, { passive: true });

    return () => {
      el.removeEventListener('wheel', onUserScroll);
      el.removeEventListener('touchmove', onUserScroll);
      clearResumeTimer();
    };
  }, [active, containerRef, clearResumeTimer]);

  return {
    active,
    intervalSeconds,
    scrollPercent,
    toggle,
    stop,
    setIntervalSeconds,
    setScrollPercent,
  };
}
