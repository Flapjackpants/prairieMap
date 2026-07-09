import {
  clampRenderLayout,
  DEFAULT_RENDER_LAYOUT,
  type RenderLayoutOptions,
} from '../types/renderOptions';

/** Compact TNO-style info board on the right of export frames. */
export const DOSSIER_PANEL_WIDTH_FRACTION = DEFAULT_RENDER_LAYOUT.dossierWidthFraction;
export const DOSSIER_PANEL_MAX_WIDTH_FRACTION = 0.22;
export const DOSSIER_PANEL_MIN_WIDTH = 130;

export interface DossierMetrics {
  panelW: number;
  padding: number;
  bodyFontSize: number;
  dateFontSize: number;
  headerFontSize: number;
  lineHeight: number;
  charsPerLine: number;
  activeDivisionsIconSize: number;
}

export function shouldShowDossierPanel(
  showDossier: boolean,
  dateTitle: string,
  eventLog: string,
  activeDivisionCount: number,
): boolean {
  if (!showDossier) return false;
  return Boolean(dateTitle.trim() || eventLog.trim() || activeDivisionCount > 0);
}

export function exportDossierMetrics(
  stageWidth: number,
  stageHeight: number,
  layoutOverrides?: Partial<RenderLayoutOptions>,
): DossierMetrics {
  const layout = clampRenderLayout(layoutOverrides);
  const scale = stageHeight / 1080;
  const widthFraction = layout.dossierWidthFraction;
  const target = Math.round(stageWidth * widthFraction);
  const maxW = Math.round(stageWidth * Math.min(0.35, widthFraction + 0.05));
  const panelW = Math.max(DOSSIER_PANEL_MIN_WIDTH, Math.min(target, maxW));
  const padding = Math.max(8, Math.round(10 * scale));
  const baseBodyFontSize = Math.max(9, Math.round(11 * scale));
  const baseDateFontSize = Math.max(11, Math.round(13 * scale));
  const headerFontSize = Math.max(8, Math.round(9 * scale));
  const bodyFontSize = Math.max(8, Math.round(baseBodyFontSize * layout.eventLogFontScale));
  const dateFontSize = Math.max(9, Math.round(baseDateFontSize * layout.dateFontScale));
  const innerWidth = Math.max(48, panelW - padding * 2);
  const charsPerLine = Math.max(10, Math.floor(innerWidth / (bodyFontSize * 0.52)));
  const activeDivisionsIconSize = Math.max(
    14,
    Math.round(24 * scale * layout.activeDivisionsIconScale),
  );

  return {
    panelW,
    padding,
    bodyFontSize,
    dateFontSize,
    headerFontSize,
    lineHeight: 1.32,
    charsPerLine,
    activeDivisionsIconSize,
  };
}

export function dossierPanelWidth(
  stageWidth: number,
  dateTitle: string,
  eventLog: string,
): number {
  const hasDate = Boolean(dateTitle.trim());
  const hasLog = Boolean(eventLog.trim());
  if (!hasDate && !hasLog) return 0;
  return exportDossierMetrics(stageWidth, 1080).panelW;
}
