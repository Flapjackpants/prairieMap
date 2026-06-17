import { Group, Text } from 'react-konva';
import type Konva from 'konva';
import { memo, useLayoutEffect, useRef } from 'react';
import type { GlyphPlacement } from '../../utils/curvedLabel';
import { defaultCharWidth } from '../../utils/curvedLabel';

const LABEL_FONT = 'JetBrains Mono, monospace';

interface CachedLabelGroupProps {
  cacheKey: string;
  fontSize: number;
  glyphs: GlyphPlacement[];
}

/** Rasterize curved glyphs once; avoids per-frame fillText in Firefox. */
const CachedLabelGroup = memo(function CachedLabelGroup({
  cacheKey,
  fontSize,
  glyphs,
}: CachedLabelGroupProps) {
  const groupRef = useRef<Konva.Group>(null);

  useLayoutEffect(() => {
    const node = groupRef.current;
    if (!node || glyphs.length === 0) return;
    node.clearCache();
    node.cache({ pixelRatio: 1 });
    node.getLayer()?.batchDraw();
    return () => {
      node.clearCache();
    };
  }, [cacheKey, fontSize, glyphs]);

  return (
    <Group ref={groupRef} listening={false}>
      {glyphs.map((g, gi) => {
        const charW = defaultCharWidth(fontSize);
        return (
          <Text
            key={`${cacheKey}-${gi}`}
            x={g.x}
            y={g.y}
            text={g.char}
            fontSize={fontSize}
            fill="#f0f0f5"
            fontFamily={LABEL_FONT}
            fontStyle="bold"
            rotation={g.rotation}
            align="center"
            verticalAlign="middle"
            offsetX={charW / 2}
            offsetY={fontSize / 2}
            listening={false}
            perfectDrawEnabled={false}
          />
        );
      })}
    </Group>
  );
});

export { CachedLabelGroup };
