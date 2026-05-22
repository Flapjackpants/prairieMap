import { Group, Text } from 'react-konva';
import type { CountryTerritory } from '../../types/project';
import { computeRegionLabels } from '../../utils/territoryGeometry';

interface FlatRegionLabelsProps {
  country: CountryTerritory;
}

export function FlatRegionLabels({ country }: FlatRegionLabelsProps) {
  const labels =
    country.regionLabels.length > 0
      ? country.regionLabels
      : computeRegionLabels(country.name, country.regions);

  if (labels.length === 0) return null;

  return (
    <Group listening={false}>
      {labels.map((label, i) => (
        <Text
          key={`${country.id}-label-${i}`}
          x={label.x}
          y={label.y}
          text={country.name}
          fontSize={label.fontSize}
          fill="#f0f0f5"
          fontFamily="JetBrains Mono, monospace"
          fontStyle="bold"
          letterSpacing={label.letterSpacing}
          rotation={0}
          align="center"
          verticalAlign="middle"
          offsetX={(country.name.length * label.fontSize * 0.38) / 2}
          offsetY={label.fontSize / 2}
          shadowColor="rgba(0,0,0,0.9)"
          shadowBlur={5}
          shadowOffset={{ x: 1, y: 1 }}
        />
      ))}
    </Group>
  );
}
