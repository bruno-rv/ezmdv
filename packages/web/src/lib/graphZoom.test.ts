import { describe, expect, it } from 'vitest';
import { computeViewBox, clampZoom, MIN_ZOOM, MAX_ZOOM } from './graphZoom';

describe('computeViewBox', () => {
  it('returns full dimensions at zoom 1 with no pan', () => {
    const vb = computeViewBox(1, { x: 0, y: 0 });
    expect(vb).toEqual({ x: 0, y: 0, w: 1200, h: 760 });
  });

  it('zooms in to half-size centered at zoom 2', () => {
    const vb = computeViewBox(2, { x: 0, y: 0 });
    expect(vb).toEqual({ x: 300, y: 190, w: 600, h: 380 });
  });

  it('zooms out to double-size centered at zoom 0.5', () => {
    const vb = computeViewBox(0.5, { x: 0, y: 0 });
    expect(vb).toEqual({ x: -600, y: -380, w: 2400, h: 1520 });
  });

  it('applies pan offset', () => {
    const vb = computeViewBox(1, { x: 100, y: -50 });
    expect(vb).toEqual({ x: 100, y: -50, w: 1200, h: 760 });
  });

  it('combines zoom and pan', () => {
    const vb = computeViewBox(2, { x: 50, y: 30 });
    expect(vb).toEqual({ x: 350, y: 220, w: 600, h: 380 });
  });
});

describe('clampZoom', () => {
  it('returns value within range unchanged', () => {
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it('clamps below MIN_ZOOM', () => {
    expect(clampZoom(0.1)).toBe(MIN_ZOOM);
    expect(clampZoom(-1)).toBe(MIN_ZOOM);
  });

  it('clamps above MAX_ZOOM', () => {
    expect(clampZoom(5)).toBe(MAX_ZOOM);
    expect(clampZoom(100)).toBe(MAX_ZOOM);
  });

  it('returns boundary values exactly', () => {
    expect(clampZoom(MIN_ZOOM)).toBe(MIN_ZOOM);
    expect(clampZoom(MAX_ZOOM)).toBe(MAX_ZOOM);
  });
});
