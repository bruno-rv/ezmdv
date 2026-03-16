import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useAutoScroll } from './useAutoScroll';

function makeContainerRef(overrides: Partial<HTMLElement> = {}) {
  const el = {
    clientHeight: 500,
    scrollHeight: 2000,
    scrollTop: 0,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...overrides,
  } as unknown as HTMLElement;
  return { current: el };
}

describe('useAutoScroll', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts inactive with default settings', () => {
    const containerRef = makeContainerRef();
    const { result } = renderHook(() =>
      useAutoScroll({ containerRef, enabled: true }),
    );

    expect(result.current.active).toBe(false);
    expect(result.current.intervalSeconds).toBe(5);
    expect(result.current.scrollPercent).toBe(10);
  });

  it('toggle activates and deactivates', () => {
    const containerRef = makeContainerRef();
    const { result } = renderHook(() =>
      useAutoScroll({ containerRef, enabled: true }),
    );

    act(() => { result.current.toggle(); });
    expect(result.current.active).toBe(true);

    act(() => { result.current.toggle(); });
    expect(result.current.active).toBe(false);
  });

  it('stop resets active state', () => {
    const containerRef = makeContainerRef();
    const { result } = renderHook(() =>
      useAutoScroll({ containerRef, enabled: true }),
    );

    act(() => { result.current.toggle(); });
    expect(result.current.active).toBe(true);

    act(() => { result.current.stop(); });
    expect(result.current.active).toBe(false);
  });

  it('stops when enabled becomes false', () => {
    const containerRef = makeContainerRef();
    const { result, rerender } = renderHook(
      ({ enabled }) => useAutoScroll({ containerRef, enabled }),
      { initialProps: { enabled: true } },
    );

    act(() => { result.current.toggle(); });
    expect(result.current.active).toBe(true);

    rerender({ enabled: false });
    expect(result.current.active).toBe(false);
  });

  it('toggle does nothing when container ref is null', () => {
    const containerRef = { current: null };
    const { result } = renderHook(() =>
      useAutoScroll({ containerRef, enabled: true }),
    );

    act(() => { result.current.toggle(); });
    expect(result.current.active).toBe(false);
  });

  it('toggle does nothing when content does not overflow', () => {
    const containerRef = makeContainerRef({
      scrollHeight: 500,
      clientHeight: 500,
    });
    const { result } = renderHook(() =>
      useAutoScroll({ containerRef, enabled: true }),
    );

    act(() => { result.current.toggle(); });
    expect(result.current.active).toBe(false);
  });

  it('updates intervalSeconds and scrollPercent', () => {
    const containerRef = makeContainerRef();
    const { result } = renderHook(() =>
      useAutoScroll({ containerRef, enabled: true }),
    );

    act(() => { result.current.setIntervalSeconds(10); });
    expect(result.current.intervalSeconds).toBe(10);

    act(() => { result.current.setScrollPercent(25); });
    expect(result.current.scrollPercent).toBe(25);
  });

  it('scrolls in discrete steps with ease-out animation', () => {
    const rafCallbacks: ((time: number) => void)[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const el = {
      clientHeight: 500,
      scrollHeight: 5000,
      scrollTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const containerRef = { current: el as unknown as HTMLElement };

    const { result } = renderHook(() =>
      useAutoScroll({ containerRef, enabled: true }),
    );

    // Start — first step fires immediately
    act(() => { result.current.toggle(); });

    // Frame 1: animating phase begins, captures start position
    const cbs1 = rafCallbacks.splice(0);
    act(() => { cbs1.forEach((cb) => cb(1000)); });
    expect(el.scrollTop).toBe(0); // calibration frame

    // Mid-animation at 150ms — ease-out should be >50% (front-loaded)
    const cbs2 = rafCallbacks.splice(0);
    act(() => { cbs2.forEach((cb) => cb(1150)); });
    const stepSize = 500 * 0.1; // 50px
    expect(el.scrollTop).toBeGreaterThan(stepSize * 0.5);

    // Animation complete at 300ms — should be exactly one step
    const cbs3 = rafCallbacks.splice(0);
    act(() => { cbs3.forEach((cb) => cb(1300)); });
    expect(el.scrollTop).toBeCloseTo(stepSize, 0);

    // During wait period (1s later) — no movement
    const scrollAfterStep = el.scrollTop;
    const cbs4 = rafCallbacks.splice(0);
    act(() => { cbs4.forEach((cb) => cb(2300)); });
    expect(el.scrollTop).toBe(scrollAfterStep);

    // After full interval (5s wait from 1300ms) — next step begins
    const cbs5 = rafCallbacks.splice(0);
    act(() => { cbs5.forEach((cb) => cb(6300)); });
    // This is the calibration frame for the second step
    const cbs6 = rafCallbacks.splice(0);
    act(() => { cbs6.forEach((cb) => cb(6600)); });
    // After 300ms of animation, should have scrolled another step
    expect(el.scrollTop).toBeCloseTo(stepSize * 2, 0);
    expect(result.current.active).toBe(true);
  });

  it('does not jump or stop when intervalSeconds changes mid-scroll', () => {
    const rafCallbacks: ((time: number) => void)[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const el = {
      clientHeight: 500,
      scrollHeight: 5000,
      scrollTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const containerRef = { current: el as unknown as HTMLElement };

    const { result } = renderHook(() =>
      useAutoScroll({ containerRef, enabled: true }),
    );

    // Start autoscroll
    act(() => { result.current.toggle(); });
    expect(result.current.active).toBe(true);

    // Run through first animation step (calibration + full 300ms)
    const cbs1 = rafCallbacks.splice(0);
    act(() => { cbs1.forEach((cb) => cb(1000)); });
    const cbs2 = rafCallbacks.splice(0);
    act(() => { cbs2.forEach((cb) => cb(1300)); });

    const scrollAfterFirstStep = el.scrollTop;
    expect(scrollAfterFirstStep).toBeCloseTo(50, 0); // 500 * 0.1

    // Change intervalSeconds mid-scroll — this re-runs the effect
    act(() => { result.current.setIntervalSeconds(15); });

    // The effect restart triggers immediate first step (calibration frame)
    const postChange = rafCallbacks.splice(0);
    act(() => { postChange.forEach((cb) => cb(6000)); });

    // Should not jump — calibration captures current position
    expect(el.scrollTop).toBe(scrollAfterFirstStep);
    expect(result.current.active).toBe(true);

    // Next frame animates from the captured position
    const next = rafCallbacks.splice(0);
    act(() => { next.forEach((cb) => cb(6300)); });
    expect(el.scrollTop).toBeCloseTo(scrollAfterFirstStep + 50, 0);
    expect(result.current.active).toBe(true);
  });

  it('survives container ref becoming null temporarily', () => {
    const rafCallbacks: ((time: number) => void)[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const el = {
      clientHeight: 500,
      scrollHeight: 5000,
      scrollTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const containerRef = { current: el as unknown as HTMLElement };

    const { result } = renderHook(() =>
      useAutoScroll({ containerRef, enabled: true }),
    );

    // Start and run through first step
    act(() => { result.current.toggle(); });
    const cbs1 = rafCallbacks.splice(0);
    act(() => { cbs1.forEach((cb) => cb(1000)); });
    const cbs2 = rafCallbacks.splice(0);
    act(() => { cbs2.forEach((cb) => cb(1300)); });
    expect(el.scrollTop).toBeGreaterThan(0);

    // Simulate container becoming null
    containerRef.current = null as unknown as HTMLElement;
    const cbs3 = rafCallbacks.splice(0);
    act(() => { cbs3.forEach((cb) => cb(1400)); });

    // RAF loop should still be alive
    expect(rafCallbacks.length).toBeGreaterThan(0);
    expect(result.current.active).toBe(true);

    // Restore container — advance past the interval to trigger next step
    containerRef.current = el as unknown as HTMLElement;
    const scrollBefore = el.scrollTop;

    // Advance past wait period (5s interval from step end at 1300ms)
    const cbs4 = rafCallbacks.splice(0);
    act(() => { cbs4.forEach((cb) => cb(6400)); });

    // Animate the next step
    const cbs5 = rafCallbacks.splice(0);
    act(() => { cbs5.forEach((cb) => cb(6700)); });
    expect(el.scrollTop).toBeGreaterThan(scrollBefore);
    expect(result.current.active).toBe(true);
  });
});
