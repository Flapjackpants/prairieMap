import { Group, Text } from 'react-konva';
import { useMemo } from 'react';
import type { CountryTerritory, RegionLabelPlacement } from '../../types/project';
import {
  defaultCharWidth,
  exteriorRingsOnly,
  layoutGlyphs,
  layoutGlyphsForRegion,
  orientSpineForReading,
} from '../../utils/curvedLabel';
import { computeRegionLabels } from '../../utils/territoryGeometry';

const LABEL_FONT = 'JetBrains Mono, monospace';

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

export function CurvedRegionLabels({ country, allCountries }: CurvedRegionLabelsProps) {
  const foreignRings = useMemo(
    () => foreignRingsFor(country.id, allCountries),
    [country.id, allCountries],
  );

  const exteriors = useMemo(() => exteriorRingsOnly(country.regions), [country.regions]);
  const placements = useMemo(
    () => resolvePlacements(country, foreignRings),
    [country, foreignRings],
  );

  const glyphGroups = useMemo(() => {
    return exteriors
      .map((ring, i) => {
        const placement = placements[i];
        if (!placement?.spine) return null;

        const { fontSize, letterSpacing, spine } = layoutGlyphsForRegion(
          country.name,
          ring,
          placement.fontSize,
          foreignRings,
        );
        const glyphs = layoutGlyphs(
          country.name,
          orientSpineForReading(spine),
          fontSize,
          letterSpacing,
        );
        return {
          key: `${country.id}-label-${i}`,
          fontSize,
          letterSpacing,
          glyphs,
        };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null && g.glyphs.length > 0);
  }, [country.name, exteriors, placements, foreignRings]);

  if (glyphGroups.length === 0) return null;

  return (
    <Group listening={false}>
      {glyphGroups.map((group) => (
        <Group key={group.key} listening={false}>
          {group.glyphs.map((g, gi) => {
            const charW = defaultCharWidth(group.fontSize);
            return (
              <Text
                key={`${group.key}-${gi}`}
                x={g.x}
                y={g.y}
                text={g.char}
                fontSize={group.fontSize}
                fill="#f0f0f5"
                fontFamily={LABEL_FONT}
                fontStyle="bold"
                rotation={g.rotation}
                align="center"
                verticalAlign="middle"
                offsetX={charW / 2}
                offsetY={group.fontSize / 2}
                shadowColor="rgba(0,0,0,0.9)"
                shadowBlur={5}
                shadowOffset={{ x: 1, y: 1 }}
              />
            );
          })}
        </Group>
      ))}
    </Group>
  );
}
