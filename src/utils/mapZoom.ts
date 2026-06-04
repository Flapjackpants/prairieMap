import { SNAP_THRESHOLD_PX } from '../types/project';

const MIN_VIEWPORT_SCALE = 0.15;

/** Clamp viewport scale used for zoom-dependent map sizing. */
export function effectiveViewportScale(scale: number): number {
  return Math.max(scale, MIN_VIEWPORT_SCALE);
}

/**
 * Map-space radius so a circle appears ~screenPx wide on screen at viewportScale.
 */
export function mapRadiusForScreenPx(
  screenPx: number,
  viewportScale: number,
  minMapRadius = 2,
  maxMapRadius = 14,
): number {
  const mapRadius = screenPx / effectiveViewportScale(viewportScale);
  return Math.min(maxMapRadius, Math.max(minMapRadius, mapRadius));
}

/**
 * Map-space stroke width so a stroke appears ~screenPx wide on screen.
 */
export function mapStrokeWidthForScreenPx(screenPx: number, viewportScale: number): number {
  return mapRadiusForScreenPx(screenPx, viewportScale, 0.5, 8);
}

/**
 * Konva hitStrokeWidth (map units) so total pick diameter ≈ targetScreenPx on screen.
 */
export function hitStrokeWidthForScreenPx(
  targetScreenPx: number,
  visibleMapRadius: number,
  viewportScale: number,
): number {
  const targetMapDiameter = targetScreenPx / effectiveViewportScale(viewportScale);
  return Math.max(0, (targetMapDiameter - 2 * visibleMapRadius) / 2);
}

/** Default on-screen pick target for territory anchors (matches snap threshold). */
export const ANCHOR_HIT_SCREEN_PX = SNAP_THRESHOLD_PX;
