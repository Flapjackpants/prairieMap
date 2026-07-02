/** Compact TNO-style info board on the right of export frames. */
export const DOSSIER_PANEL_WIDTH_FRACTION = 0.17;
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
}

export function exportDossierMetrics(stageWidth: number, stageHeight: number): DossierMetrics {
  const scale = stageHeight / 1080;
  const target = Math.round(stageWidth * DOSSIER_PANEL_WIDTH_FRACTION);
  const maxW = Math.round(stageWidth * DOSSIER_PANEL_MAX_WIDTH_FRACTION);
  const panelW = Math.max(DOSSIER_PANEL_MIN_WIDTH, Math.min(target, maxW));
  const padding = Math.max(8, Math.round(10 * scale));
  const bodyFontSize = Math.max(9, Math.round(11 * scale));
  const dateFontSize = Math.max(11, Math.round(13 * scale));
  const headerFontSize = Math.max(8, Math.round(9 * scale));
  const innerWidth = Math.max(48, panelW - padding * 2);
  const charsPerLine = Math.max(10, Math.floor(innerWidth / (bodyFontSize * 0.52)));

  return {
    panelW,
    padding,
    bodyFontSize,
    dateFontSize,
    headerFontSize,
    lineHeight: 1.32,
    charsPerLine,
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
