import { Group } from 'react-konva';
import { memo, useMemo } from 'react';
import type { CountryTerritory, RegionLabelPlacement } from '../../types/project';
import {
  equalSpacingStep,
  exteriorRingsOnly,
  layoutGlyphs,
  layoutGlyphsForRegion,
} from '../../utils/curvedLabel';
import { computeRegionLabels } from '../../utils/territoryGeometry';
import { CachedLabelGroup } from './CachedLabelGroup';

interface CurvedRegionLabelsProps {
  country: CountryTerritory;
  allCountries: CountryTerritory[];
}

function foreignRingsFor(countryId: string, allCountries: CountryTerritory[]) {
  return allCountries
    .filter((c) => c.id !== countryId)
    .flatMap((c) => exteriorRingsOnly(c.regions));
}

function resolvePlacements(
  country: CountryTerritory,
  foreignRings: ReturnType<typeof exteriorRingsOnly>,
): RegionLabelPlacement[] {
  const exteriors = exteriorRingsOnly(country.regions);
  const expected = exteriors.length;
  if (
    country.regionLabels.length === 0 ||
    country.regionLabels.length !== expected ||
    country.regionLabels.some((l) => !l.spine)
  ) {
    return computeRegionLabels(country.name, country.regions, foreignRings);
  }
  return country.regionLabels;
}

export const CurvedRegionLabels = memo(function CurvedRegionLabels({
  country,
  allCountries,
}: CurvedRegionLabelsProps) {
  const foreignRings = useMemo(
    () => foreignRingsFor(country.id, allCountries),
    [country.id, allCountries],
  );

  const exteriors = useMemo(() => exteriorRingsOnly(country.regions), [country.regions]);
  const placements = useMemo(
    () => resolvePlacements(country, foreignRings),
    [country, foreignRings],
  );

  const displayName = country.name.trim();

  const glyphGroups = useMemo(() => {
    if (!displayName) return [];
    return exteriors
      .map((ring, i) => {
        const placement = placements[i];
        const baseFontSize = placement?.fontSize ?? 14;

        if (placement?.spine) {
          const letterSpacing = placement.letterSpacing ?? equalSpacingStep(baseFontSize);
          const glyphs = layoutGlyphs(displayName, placement.spine, baseFontSize, letterSpacing);
          if (glyphs.length === 0) return null;
          return {
            key: `${country.id}-label-${i}`,
            fontSize: baseFontSize,
            glyphs,
          };
        }

        const { fontSize, glyphs } = layoutGlyphsForRegion(
          displayName,
          ring,
          baseFontSize,
          foreignRings,
        );
        if (glyphs.length === 0) return null;

        return {
          key: `${country.id}-label-${i}`,
          fontSize,
          glyphs,
        };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  }, [country.id, displayName, exteriors, placements, foreignRings]);

  if (glyphGroups.length === 0) return null;

  return (
    <Group listening={false}>
      {glyphGroups.map((group) => (
        <CachedLabelGroup
          key={group.key}
          cacheKey={group.key}
          fontSize={group.fontSize}
          glyphs={group.glyphs}
        />
      ))}
    </Group>
  );
});
