// Starlight Relay — level data.
//
// Every level is a small grid of characters, one character per cell:
//
//   '.'  empty floor            '#'  wall (stops the beam)
//   'x'  gloom (swallows the beam)
//   '/'  mirror, leaning right  '\'  mirror, leaning left
//   'S'  splitter, leaning right  's'  splitter, leaning left
//   'C'  cyan prism             'M'  magenta prism
//   'o'  lantern, any colour    'c'  cyan lantern   'm'  magenta lantern
//   '>'  star, firing right     '<'  star, firing left
//   '^'  star, firing up        'v'  star, firing down
//
// A mirror or splitter turns with a click (or Space). A splitter also lets
// the beam pass straight through. A prism tints the beam that crosses it.
// A lantern lights when a beam of a colour it accepts reaches it. Spare
// pieces from the tray can be placed on empty floor.

export const LEVEL_DEFS = [
  {
    name: "First Light",
    hint: "Click the mirror to turn the beam up to the lantern.",
    moves: 3,
    par: 1,
    spares: { mirror: 0, splitter: 0 },
    grid: [
      "....o.",
      "......",
      ">.o.\\.",
      "......",
      "......",
      "......",
    ],
  },
  {
    name: "Two Turns",
    hint: "The beam must bend twice to reach the far lantern.",
    moves: 4,
    par: 2,
    spares: { mirror: 0, splitter: 0 },
    grid: [
      ".......",
      ".o../..",
      ".......",
      ">.o.\\..",
      ".......",
      "..##...",
      ".......",
    ],
  },
  {
    name: "Split Decision",
    hint: "A splitter sends the beam two ways at once.",
    moves: 4,
    par: 2,
    spares: { mirror: 0, splitter: 0 },
    grid: [
      "........",
      ".o./....",
      "........",
      "........",
      ">.os..o.",
      "........",
      "...#..#.",
      "........",
    ],
  },
  {
    name: "True Colours",
    hint: "Prisms tint the beam. Coloured lanterns need matching light.",
    moves: 4,
    par: 2,
    spares: { mirror: 0, splitter: 0 },
    grid: [
      "........",
      "...mM./.",
      "........",
      "........",
      ">.C.oc\\.",
      "........",
      "........",
      "..####..",
    ],
  },
  {
    name: "Gloom Hollow",
    hint: "Gloom swallows light. Place the spare splitter to route around it.",
    moves: 6,
    par: 4,
    spares: { mirror: 0, splitter: 1 },
    grid: [
      ".........",
      ".\\..o./..",
      ".......x.",
      "........o",
      ">\\....o..",
      ".........",
      "......o..",
      ".........",
      ".........",
    ],
  },
  {
    name: "Grand Relay",
    hint: "Everything at once: mirrors, a splitter, prisms and gloom.",
    moves: 6,
    par: 4,
    spares: { mirror: 0, splitter: 0 },
    grid: [
      "#.......#",
      "..\\.cM./.",
      "..C......",
      "...x.....",
      ">.\\..m.s.",
      ".....x...",
      ".........",
      "..m....m.",
      ".........",
    ],
  },
];

// Turn a level definition into a fresh, mutable board. Every cell is null
// (empty floor) or an object describing what stands on it.
export function parseLevel(def) {
  const rows = def.grid.length;
  const cols = def.grid[0].length;
  const cells = [];
  let emitter = null;
  const lanterns = [];
  for (let y = 0; y < rows; y += 1) {
    const row = [];
    for (let x = 0; x < cols; x += 1) {
      const ch = def.grid[y][x];
      let cell = null;
      if (ch === "#") {
        cell = { kind: "wall" };
      } else if (ch === "x") {
        cell = { kind: "gloom" };
      } else if (ch === "/" || ch === "\\") {
        cell = { kind: "mirror", orient: ch, placed: false };
      } else if (ch === "S" || ch === "s") {
        cell = { kind: "splitter", orient: ch === "S" ? "/" : "\\", placed: false };
      } else if (ch === "C") {
        cell = { kind: "prism", color: "cyan" };
      } else if (ch === "M") {
        cell = { kind: "prism", color: "magenta" };
      } else if (ch === "o" || ch === "c" || ch === "m") {
        cell = {
          kind: "lantern",
          need: ch === "o" ? null : ch === "c" ? "cyan" : "magenta",
        };
        lanterns.push({ x, y });
      } else if (ch === ">" || ch === "<" || ch === "^" || ch === "v") {
        const dir = ch === ">" ? 1 : ch === "<" ? 3 : ch === "^" ? 0 : 2;
        cell = { kind: "emitter", dir };
        emitter = { x, y, dir };
      }
      row.push(cell);
    }
    cells.push(row);
  }
  return { def, rows, cols, cells, emitter, lanterns };
}
