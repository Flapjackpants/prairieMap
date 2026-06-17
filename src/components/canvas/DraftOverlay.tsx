import { Circle, Group, Line } from 'react-konva';
import type Konva from 'konva';
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useLayoutEffect,
} from 'react';
import {
  mapRadiusForScreenPx,
  mapStrokeWidthForScreenPx,
} from '../../utils/mapZoom';
import type { SnapVertex } from '../../utils/vertexSnap';

export interface DraftOverlayHandle {
  updatePreview: (
    cursor: { x: number; y: number } | null,
    snap: SnapVertex | null,
    viewportScale: number,
  ) => void;
}

interface DraftOverlayProps {
  draftPoints: { x: number; y: number }[];
  draftColor: string;
  viewportScale: number;
  snapThreshold: number;
  onRemoveDraftAnchor: (index: number) => void;
}

export const DraftOverlay = forwardRef<DraftOverlayHandle, DraftOverlayProps>(
  function DraftOverlay(
    { draftPoints, draftColor, viewportScale, snapThreshold, onRemoveDraftAnchor },
    ref,
  ) {
    const previewLineRef = useRef<Konva.Line>(null);
    const snapRingRef = useRef<Konva.Circle>(null);
    const draftPointsRef = useRef(draftPoints);
    draftPointsRef.current = draftPoints;

    const anchorRadius = (px: number) => mapRadiusForScreenPx(px, viewportScale);
    const anchorStroke = mapStrokeWidthForScreenPx(2, viewportScale);

    useImperativeHandle(ref, () => ({
      updatePreview(cursor, snap, scale) {
        const line = previewLineRef.current;
        const ring = snapRingRef.current;
        const pts = draftPointsRef.current;
        const radius = mapRadiusForScreenPx(8, scale);
        const stroke = mapStrokeWidthForScreenPx(2, scale);

        if (line) {
          if (cursor && pts.length > 0) {
            const flat = pts.flatMap((p) => [p.x, p.y]);
            line.points([...flat, cursor.x, cursor.y]);
            line.visible(true);
          } else if (pts.length > 0) {
            line.points(pts.flatMap((p) => [p.x, p.y]));
            line.visible(true);
          } else {
            line.visible(false);
          }
        }

        if (ring) {
          if (snap) {
            ring.x(snap.x);
            ring.y(snap.y);
            ring.radius(radius);
            ring.strokeWidth(stroke);
            ring.visible(true);
          } else {
            ring.visible(false);
          }
        }

        line?.getLayer()?.batchDraw();
      },
    }));

    useLayoutEffect(() => {
      previewLineRef.current?.getLayer()?.batchDraw();
    }, [draftPoints, draftColor]);

    if (draftPoints.length === 0) {
      return (
        <Group listening={false}>
          <Line
            ref={previewLineRef}
            stroke={draftColor}
            strokeWidth={2}
            dash={[8, 6]}
            visible={false}
            listening={false}
            perfectDrawEnabled={false}
          />
          <Circle
            ref={snapRingRef}
            stroke="#00e5ff"
            fill="rgba(0,229,255,0.25)"
            visible={false}
            listening={false}
            perfectDrawEnabled={false}
          />
        </Group>
      );
    }

    return (
      <Group listening={false}>
        <Line
          ref={previewLineRef}
          points={draftPoints.flatMap((p) => [p.x, p.y])}
          stroke={draftColor}
          strokeWidth={2}
          dash={[8, 6]}
          closed={false}
          listening={false}
          perfectDrawEnabled={false}
        />
        <Circle
          ref={snapRingRef}
          stroke="#00e5ff"
          fill="rgba(0,229,255,0.25)"
          visible={false}
          listening={false}
          perfectDrawEnabled={false}
        />
        {draftPoints.map((p, i) => {
          const radius = anchorRadius(i === 0 ? 7 : 5);
          return (
            <Circle
              key={`draft-${i}`}
              x={p.x}
              y={p.y}
              radius={radius}
              fill={i === 0 ? draftColor : '#121214'}
              stroke={draftColor}
              strokeWidth={anchorStroke}
              hitStrokeWidth={snapThreshold}
              onClick={(e) => {
                e.cancelBubble = true;
                if (e.evt.altKey) onRemoveDraftAnchor(i);
              }}
            />
          );
        })}
      </Group>
    );
  },
);
