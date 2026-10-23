// A reclining cat sampled at four times hah.dev's original resolution. The
// abstract head, broad curved ears, and plume tail share a shaped feline torso.
import {catTorsoSurface} from './catAnatomy.js';
export const ASCII_CAT_DRAWING_DESCRIPTION = "A fluffy ASCII cat loafs on a glass table, with a lowered head, large softly curved ears, tucked paws, and a long fluffy tail.";
export const DRAWING_SCALE = 4;
export const DRAWING_COLUMNS = 320;
export const DRAWING_ROWS = 136;
// Reuse the existing canvas margin so the longer tail does not shrink the body.
export const DRAWING_ORIGIN_COLUMN = 9;
export const CAT_TAIL_SPINE = [[18.5, 56], [18.6, 61], [18.7, 65], [18, 70],
  [16.8, 75.4], [14.8, 80], [14.6, 83.3], [16.2, 85.4], [18.9, 84.2]];
const SHADE = " .,:;clodxkO0KXNM";
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const noise = (r, c, seed = 0) => {
  const value = Math.sin((r + 1) * 12.9898 + (c + 1) * 78.233 + seed * 37.719) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
};
const inPolygon = (r, c, points) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a[0] > r) !== (b[0] > r) && c < (b[1] - a[1]) * (r - a[0]) / (b[0] - a[0]) + a[1])
      inside = !inside;
  }
  return inside;
};
function curved(points, steps = 10) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i], c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
    for (let j = 0; j < steps; j++) {
      const t = j / steps;
      out.push([0, 1].map(k => .5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t * t * t)));
    }
  }
  out.push(points.at(-1));
  return out;
}
function painter() {
  const ink = Array.from({ length: DRAWING_ROWS }, () => new Float32Array(DRAWING_COLUMNS).fill(-1));
  const glyphs = new Map();
  const paint = (bounds, fn) => {
    const [top, left, bottom, right] = bounds;
    for (let r = Math.max(0, Math.floor(top * DRAWING_SCALE)); r <= Math.min(DRAWING_ROWS - 1, Math.ceil(bottom * DRAWING_SCALE)); r++) {
      for (let c = Math.max(0, Math.floor((left - DRAWING_ORIGIN_COLUMN) * DRAWING_SCALE)); c <= Math.min(DRAWING_COLUMNS - 1, Math.ceil((right - DRAWING_ORIGIN_COLUMN) * DRAWING_SCALE)); c++) {
        const value = fn(r / DRAWING_SCALE, c / DRAWING_SCALE + DRAWING_ORIGIN_COLUMN);
        if (value !== null) {
          ink[r][c] = clamp(value, 0, 15);
          glyphs.delete(r * DRAWING_COLUMNS + c);
        }
      }
    }
  };
  const line = (points, width, density, glyph = false) => {
    const path = curved(points);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], dr = b[0] - a[0], dc = b[1] - a[1];
      if (glyph) {
        const ar = Math.round(a[0] * DRAWING_SCALE), ac = Math.round((a[1] - DRAWING_ORIGIN_COLUMN) * DRAWING_SCALE), br = Math.round(b[0] * DRAWING_SCALE), bc = Math.round((b[1] - DRAWING_ORIGIN_COLUMN) * DRAWING_SCALE);
        const count = Math.max(1, Math.abs(br - ar), Math.abs(bc - ac));
        const ch = Math.abs(dr) < Math.abs(dc) * .2 ? '-' : Math.abs(dc) < Math.abs(dr) * .2 ? '|' : dr * dc >= 0 ? '\\' : '/';
        for (let j = 0; j <= count; j++) {
          const r = Math.round(ar + (br - ar) * j / count), c = Math.round(ac + (bc - ac) * j / count);
          if (ink[r]?.[c] !== undefined) {
            // Hair sits in a separate, faint text layer; it never erases fur.
            glyphs.set(r * DRAWING_COLUMNS + c, ch);
          }
        }
      }
      else {
        const den = dr * dr + dc * dc / 3;
        const radius = typeof width === "function" ? width((i - 1) / (path.length - 1)) : width;
        paint([Math.min(a[0], b[0]) - radius, Math.min(a[1], b[1]) - radius * 1.8, Math.max(a[0], b[0]) + radius, Math.max(a[1], b[1]) + radius * 1.8], (r, c) => {
          const t = den ? clamp(((r - a[0]) * dr + (c - a[1]) * dc / 3) / den) : 0;
          const dist = Math.hypot(r - a[0] - dr * t, (c - a[1] - dc * t) / 1.73);
          return dist <= radius ? density - 1.7 * (dist / radius) + noise(r, c, 8) * .7 : null;
        });
      }
    }
  };
  return { ink, paint, line, glyphs };
}
function body(p) {
  p.paint([11, 23, 24, 62], (r, c) => {
    const surface=catTorsoSurface(r,c);
    if(!surface)return null;
    const n=noise(r,c,1),edge=1-clamp(surface.depth/5.3);
    const belly=Math.exp(-(((c-41)/12)**2+((r-20.1)/2.2)**2))*4.3;
    const thigh=Math.exp(-(((c-53)/6.7)**2+((r-19.6)/2.2)**2));
    const fold=Math.exp(-(((c-47.5)/2.7)**2+((r-20.4)/1.4)**2));
    return 14-edge**.65*4.5-belly-thigh*.9+fold*.9+n*.9;
  });
}
function tail(p) {
  const path = curved(CAT_TAIL_SPINE, 12);
  // A broad plume, with a soft broken fringe and a gradual narrowing at the tip.
  // The proximal tail stays tucked inside the low reclining rump.
  p.paint([11, 54, 23, 89], (r, c) => {
    let nearest = Infinity, along = 0, normal = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const dr = b[0] - a[0], dc = (b[1] - a[1]) / 1.73;
      const y = r - a[0], x = (c - a[1]) / 1.73;
      const t = clamp((y * dr + x * dc) / (dr * dr + dc * dc || 1));
      const progress = (i - 1 + t) / (path.length - 1);
      const radius = 1.15 + 1.70 * Math.sin(Math.PI * progress) ** .9 - .57 * progress ** 6;
      const distance = Math.hypot(y - dr * t, x - dc * t) / radius;
      if (distance < nearest) {
        nearest = distance;
        along = progress;
        normal = (y * dc - x * dr) / Math.hypot(dr, dc);
      }
    }
    const n = noise(r, c, 8);
    const fringe = .05 * Math.sin(along * 71 + normal * 14) + n * .035;
    if (nearest > 1 + fringe)
      return null;
    const feather = clamp((nearest - .78) / .28);
    const strand = Math.sin(normal * 15 + along * 9) * .45;
    return 11.1 - nearest * 1.3 - feather * 4.2 + strand + n * .6;
  });
}
function edgeDistance(r, c, polygon) {
  let nearest = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const dr = b[0] - a[0], dc = (b[1] - a[1]) / 1.73;
    const y = r - a[0], x = (c - a[1]) / 1.73;
    const t = clamp((y * dr + x * dc) / (dr * dr + dc * dc || 1));
    nearest = Math.min(nearest, Math.hypot(y - dr * t, x - dc * t));
  }
  return nearest;
}
function ears(p, side) {
  const centerR = 19.25, centerC = 21.4;
  const world = points => points.map(([r, c]) => [r + centerR, c + centerC]);
  // The larger ears have bowed sides and broad, softly rounded tips. Each base
  // disappears into the forehead fur instead of ending in a triangle edge.
  const earRim = [[-2.4, -2.55], [-3.8, -3.6], [-5.35, -4.9],
    [-6.18, -6.0], [-6.35, -6.85], [-6.02, -7.65],
    [-5.1, -8.12], [-3.65, -8.3], [-2.4, -7.8], [-2.4, -2.55]];
  const earBowl = [[-2.7, -3.65], [-4.1, -4.3], [-5.7, -6.25],
    [-5.1, -7.1], [-3.8, -7.25], [-2.7, -6.5], [-2.7, -3.65]];
  {
    const project = points => points.map(([r, c]) => [r + (side === 1 ? -.8 : 0),
      side === -1 ? c : -c * .92]);
    const rim = curved(project(earRim), 8), bowl = curved(project(earBowl), 8);
    p.paint([11.5, 12.5, 19, 30], (r, c) => {
      const y = r - centerR, x = c - centerC;
      if (!inPolygon(y, x, rim))
        return null;
      const edge = edgeDistance(y, x, rim);
      const softness = clamp(edge / .32);
      const inner = inPolygon(y, x, bowl) ? .8 : 0;
      return 4.6 + softness * 5.5 - inner + noise(r, c, 4 + side) * .65;
    });
    // Two wisps suggest the furry edge without enlarging the ear cartilage.
    p.line(world(project([[-4.15, -8.20], [-4.8, -8.65], [-5.35, -8.7]])), .03, 5, true);
    p.line(world(project([[-5.95, -7.6], [-6.4, -7.85], [-6.75, -7.9]])), .03, 5, true);
  }
}
function headFur(p) {
  const centerR = 19.25, centerC = 21.4;
  p.paint([15, 11, 24, 33], (r, c) => {
    const y = r - centerR, x = c - centerC, n = noise(r, c, 7);
    const field = Math.abs(x / 8.5) ** 2.4 + Math.abs(y / (3.6 * (y > .4 ? .9 : 1))) ** 2.8;
    if (field > 1 + n * .03)
      return null;
    const d = field ** (1 / 2.8);
    // Keep the head as one shaded fur volume, without eyes, nose or mouth.
    return 12.5 - d * 3.1 - Math.max(0, y) * .24 + n * .65;
  });
}
function whiskers(p) {
  const world = points => points.map(([r, c]) => [r + 19.25, c + 21.4]);
  // A few faint whiskers retain the simple cat silhouette.
  for (const side of [-1, 1]) {
    const reach = side === -1 ? 1 : .94;
    for (const [root, middle, end, tip] of [[1.16, .97, .45, 9.3],
      [1.38, 1.69, 2.0, 9.9], [1.59, 2.30, 3.25, 9.1]]) {
      p.line(world([[root, side * 1.7], [middle, side * 5.5],
        [end, side * tip * reach]]), .03, 4, true);
    }
  }
}
function head(p) { ears(p, -1); ears(p, 1); headFur(p); whiskers(p); }
function paw(p, r, c, side) {
  const outline = [[-.8, -2.5], [-1.0, -1.5], [-.95, 1.3], [-.55, 2.6], [.3, 2.55], [.85, 1.7], [.9, -1.6], [.3, -2.7]];
  p.paint([r - 1.1, c - 3, r + 1, c + 3], (y, x) => {
    const a = y - r, b = x - c;
    if (!inPolygon(a, b, outline))
      return null;
    const edge = Math.max(Math.abs(a) / 1.0, Math.abs(b) / 2.8);
    return 10.7 - edge * .8 + noise(y, x, side) * .8;
  });
  for (const x of [-.8, .8])
    p.line([[r + .32, c + x], [r + .75, c + x + .1]], .075, 13);
}
export function drawLoafLayers() {
  const p = painter();
  tail(p);
  body(p);
  head(p);
  paw(p, 23, 28, 17);
  paw(p, 23, 40, 23);
  const lines = p.ink.map(row => Array.from(row, v => v < 0 ? ' ' : SHADE[Math.round(v)]));
  const hair = Array.from({ length: DRAWING_ROWS }, () => Array(DRAWING_COLUMNS).fill(' '));
  for (const [index, ch] of p.glyphs)
    hair[Math.floor(index / DRAWING_COLUMNS)][index % DRAWING_COLUMNS] = ch;
  return { body: lines.map(row => row.join('')).join('\n'),
    hair: hair.map(row => row.join('')).join('\n') };
}
export function drawLoaf() { return drawLoafLayers().body; }
const drawing = drawLoafLayers();
export const asciiCatDrawing = drawing.body;
export const asciiCatWhiskers = drawing.hair;

// Canonical coat samples seed the 3D character renderer. These are material
// coordinates, not visible text layers or transformed images.
function piece(id, draw) {
  const p = painter();
  draw(p);
  const runs = [];
  const text = p.ink.map((row, r) => {
    let start = -1;
    for (let c = 0; c <= DRAWING_COLUMNS; c++) {
      if (c < DRAWING_COLUMNS && row[c] >= 0) {
        if (start < 0) start = c;
      } else if (start >= 0) {
        runs.push([r, start, c - start]);
        start = -1;
      }
    }
    return Array.from(row, v => v < 0 ? ' ' : SHADE[Math.round(v)]).join('');
  }).join('\n');
  const hair = Array.from({ length: DRAWING_ROWS }, () => Array(DRAWING_COLUMNS).fill(' '));
  for (const [index, ch] of p.glyphs)
    hair[Math.floor(index / DRAWING_COLUMNS)][index % DRAWING_COLUMNS] = ch;
  return { id, text, hair: hair.map(row => row.join('')).join('\n'), runs };
}
export const catPieces = [piece('tail', tail), piece('body', body),
  piece('left-ear', p => ears(p, -1)), piece('right-ear', p => ears(p, 1)),
  piece('head-fur', p => { headFur(p); whiskers(p); }),
  piece('left', p => paw(p, 23, 28, 17)), piece('right', p => paw(p, 23, 40, 23))];
