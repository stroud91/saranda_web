// Project lat/lng into a small SVG box (equirectangular is fine at Albania's scale).
export function project(points, width, height, pad = 12) {
  if (!points.length) return { pts: [], toXY: () => [0, 0] };
  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const k = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = Math.max((maxLng - minLng) * k, 0.02);
  const spanY = Math.max(maxLat - minLat, 0.02);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  const toXY = ([lat, lng]) => [offX + (lng - minLng) * k * scale, offY + (maxLat - lat) * scale];
  return { pts: points.map(toXY), toXY };
}

export const smoothPath = (pts) => {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2 - Math.hypot(x1 - x0, y1 - y0) * 0.12;
    d += ` Q${mx.toFixed(1)},${my.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
};
