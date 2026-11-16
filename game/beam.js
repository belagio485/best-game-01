// Starlight Relay — beam tracing. Pure grid logic: no drawing, no DOM.
//
// Directions: 0 = up, 1 = right, 2 = down, 3 = left. A beam starts at the
// star and walks cell by cell. Mirrors turn it, splitters fork it (one ray
// carries on straight, one reflects), prisms tint it, walls stop it, gloom
// swallows it, and lanterns light when a colour they accept reaches them.
// Lanterns and prisms never block the beam: it passes straight through.

export const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const REFLECT_SLASH = [1, 0, 3, 2];
const REFLECT_BACKSLASH = [3, 2, 1, 0];

export function reflectDir(dir, orient) {
  return orient === "/" ? REFLECT_SLASH[dir] : REFLECT_BACKSLASH[dir];
}

export function cellKey(x, y) {
  return x + "," + y;
}

const MAX_RAYS = 64;
const MAX_STEPS = 4096;

// Trace every ray of the board's beam. Returns the drawn segments (each a
// polyline of grid points in cell units, plus its colour) and the set of
// lit lantern cells, keyed by cellKey.
export function traceBeam(level) {
  const segments = [];
  const lit = new Set();
  const seen = new Set();
  const start = level.emitter;
  const queue = [
    {
      x: start.x,
      y: start.y,
      dir: start.dir,
      color: "gold",
      points: [[start.x + 0.5, start.y + 0.5]],
    },
  ];
  let steps = 0;
  const flush = (points, color) => {
    if (points.length >= 2) segments.push({ points, color });
  };
  while (queue.length > 0) {
    const ray = queue.shift();
    let x = ray.x;
    let y = ray.y;
    let dir = ray.dir;
    let color = ray.color;
    let points = ray.points;
    for (;;) {
      steps += 1;
      if (steps > MAX_STEPS) {
        flush(points, color);
        break;
      }
      const nx = x + DIRS[dir][0];
      const ny = y + DIRS[dir][1];
      if (nx < 0 || ny < 0 || nx >= level.cols || ny >= level.rows) {
        points.push([
          x + 0.5 + DIRS[dir][0] * 0.5,
          y + 0.5 + DIRS[dir][1] * 0.5,
        ]);
        flush(points, color);
        break;
      }
      const state = nx + "," + ny + "," + dir + "," + color;
      if (seen.has(state)) {
        flush(points, color);
        break;
      }
      seen.add(state);
      const cell = level.cells[ny][nx];
      if (cell === null || cell.kind === "emitter") {
        x = nx;
        y = ny;
        continue;
      }
      if (cell.kind === "wall") {
        points.push([
          x + 0.5 + DIRS[dir][0] * 0.5,
          y + 0.5 + DIRS[dir][1] * 0.5,
        ]);
        flush(points, color);
        break;
      }
      if (cell.kind === "gloom") {
        points.push([nx + 0.5, ny + 0.5]);
        flush(points, color);
        break;
      }
      if (cell.kind === "lantern") {
        if (cell.need === null || cell.need === color) lit.add(cellKey(nx, ny));
        x = nx;
        y = ny;
        continue;
      }
      if (cell.kind === "prism") {
        points.push([nx + 0.5, ny + 0.5]);
        flush(points, color);
        x = nx;
        y = ny;
        color = cell.color;
        points = [[nx + 0.5, ny + 0.5]];
        continue;
      }
      if (cell.kind === "mirror") {
        points.push([nx + 0.5, ny + 0.5]);
        dir = reflectDir(dir, cell.orient);
        x = nx;
        y = ny;
        continue;
      }
      if (cell.kind === "splitter") {
        points.push([nx + 0.5, ny + 0.5]);
        if (queue.length < MAX_RAYS) {
          queue.push({
            x: nx,
            y: ny,
            dir: reflectDir(dir, cell.orient),
            color,
            points: [[nx + 0.5, ny + 0.5]],
          });
        }
        x = nx;
        y = ny;
        continue;
      }
      x = nx;
      y = ny;
    }
  }
  return { segments, lit };
}
