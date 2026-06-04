import { Group, Text } from 'react-konva';
import { useMemo } from 'react';
import type { CountryTerritory, RegionLabelPlacement } from '../../types/project';
import { defaultCharWidth, exteriorRingsOnly, layoutGlyphs } from '../../utils/curvedLabel';
import { computeRegionLabels } from '../../utils/territoryGeometry';

const LABEL_FONT = 'JetBrains Mono, monospace';

interface CurvedRegionLabelsProps {
  country: CountryTerritory;
}

function resolvePlacements(country: CountryTerritory): RegionLabelPlacement[] {
  const expected = exteriorRingsOnly(country.regions).length;
  if (
    country.regionLabels.length === 0 ||
    country.regionLabels.length !== expected ||
    country.regionLabels.some((l) => !l.spine)
  ) {
    return computeRegionLabels(country.name, country.regions);
  }
  return country.regionLabels;
}

export function CurvedRegionLabels({ country }: CurvedRegionLabelsProps) {
  const placements = useMemo(() => resolvePlacements(country), [country]);

  const glyphGroups = useMemo(() => {
    return placements
      .map((placement, i) => {
        if (!placement.spine) return null;
        const glyphs = layoutGlyphs(
          country.name,
          placement.spine,
          placement.fontSize,
          placement.letterSpacing,
          () => defaultCharWidth(placement.fontSize),
        );
        return { key: `${country.id}-label-${i}`, placement, glyphs };
      })
      .filter((g) => g !== null && g.glyphs.length > 0);
  }, [country, placements]);

  if (glyphGroups.length === 0) return null;

  return (
    <Group listening={false}>
      {glyphGroups.map((group) =>
        group ? (
          <Group key={group.key} listening={false}>
            {group.glyphs.map((g, gi) => {
              const charW = defaultCharWidth(group.placement.fontSize);
              return (
                <Text
                  key={`${group.key}-${gi}`}
                  x={g.x}
                  y={g.y}
                  text={g.char}
                  fontSize={group.placement.fontSize}
                  fill="#f0f0f5"
                  fontFamily={LABEL_FONT}
                  fontStyle="bold"
                  rotation={g.rotation}
                  align="center"
                  verticalAlign="middle"
                  offsetX={charW / 2}
                  offsetY={group.placement.fontSize / 2}
                  shadowColor="rgba(0,0,0,0.9)"
                  shadowBlur={5}
                  shadowOffset={{ x: 1, y: 1 }}
                />
              );
            })}
          </Group>
        ) : null,
      )}
    </Group>
  );
}
