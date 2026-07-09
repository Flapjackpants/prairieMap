import { describe, expect, it } from 'vitest';
import {
  exportDossierMetrics,
  shouldShowDossierPanel,
} from './dossierLayout';

describe('dossierLayout', () => {
  it('shows the dossier panel when date, event log, or active divisions exist', () => {
    expect(shouldShowDossierPanel(true, 'June 1944', '', 0)).toBe(true);
    expect(shouldShowDossierPanel(true, '', '> Offensive begins', 0)).toBe(true);
    expect(shouldShowDossierPanel(true, '', '', 2)).toBe(true);
    expect(shouldShowDossierPanel(false, 'June 1944', '', 0)).toBe(false);
    expect(shouldShowDossierPanel(true, '', '', 0)).toBe(false);
  });

  it('applies layout overrides to panel width and font sizes', () => {
    const base = exportDossierMetrics(1920, 1080);
    const wide = exportDossierMetrics(1920, 1080, {
      dossierWidthFraction: 0.3,
      dateFontScale: 1.5,
      eventLogFontScale: 1.25,
      activeDivisionsIconScale: 1.2,
    });

    expect(wide.panelW).toBeGreaterThan(base.panelW);
    expect(wide.dateFontSize).toBeGreaterThan(base.dateFontSize);
    expect(wide.bodyFontSize).toBeGreaterThan(base.bodyFontSize);
    expect(wide.activeDivisionsIconSize).toBeGreaterThan(base.activeDivisionsIconSize);
  });
});
