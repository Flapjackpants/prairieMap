declare module 'polygon-clipping' {
  export type Ring = [number, number][];
  export type Polygon = Ring[];
  export type MultiPolygon = Polygon[];

  export function difference(
    subject: Polygon | MultiPolygon,
    clipping: Polygon | MultiPolygon,
  ): MultiPolygon;

  export function union(
    subject: Polygon | MultiPolygon,
    clipping: Polygon | MultiPolygon,
  ): MultiPolygon;

  const polygonClipping: {
    difference: typeof difference;
    union: typeof union;
  };
  export default polygonClipping;
}
