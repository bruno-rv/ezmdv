export const WIDTH = 1200;
export const HEIGHT = 760;
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 3.0;
export const ZOOM_STEP = 0.15;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function computeViewBox(
  zoom: number,
  panOffset: { x: number; y: number },
): { x: number; y: number; w: number; h: number } {
  const w = WIDTH / zoom;
  const h = HEIGHT / zoom;
  const x = (WIDTH - w) / 2 + panOffset.x;
  const y = (HEIGHT - h) / 2 + panOffset.y;
  return { x, y, w, h };
}
