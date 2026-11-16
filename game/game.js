// Starlight Relay — the game controller: state, input, scoring, overlays
// and the frame loop. The board logic lives in beam.js, the levels in
// levels.js, the drawing in render.js and the sound in audio.js.

import { LEVEL_DEFS, parseLevel } from "./levels.js";
import { traceBeam } from "./beam.js";
import {
  BEAM_COLORS,
  boardGeometry,
  cellCenter,
  drawScene,
  makeStars,
  mulberry32,
} from "./render.js";

const OUTCOME_DELAY_MS = 650;
const SHOT_TIME_MS = 1500;

// Scripted board setups for the maker's screenshot scenes (?shot=...).
// Coordinates are [x, y] cells to rotate once from the level's start.
const SHOT_ROTATIONS = {
  play: { level: 2, cells: [[3, 4]] },
  win: { level: 1, cells: [[4, 3], [4, 1]] },
};

export class Game {
  constructor(canvas, sound) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.sound = sound;
    const $ = (id) => document.getElementById(id);
    this.ui = {
      hudLevel: $("hud-level"),
      hudLanterns: $("hud-lanterns"),
      hudMoves: $("hud-moves"),
      hudScore: $("hud-score"),
      btnRestart: $("btn-restart"),
      btnSound: $("btn-sound"),
      btnMenu: $("btn-menu"),
      sideName: $("side-name"),
      sideGoal: $("side-goal"),
      invMirror: $("inv-mirror"),
      invSplitter: $("inv-splitter"),
      invMirrorCount: $("inv-mirror-count"),
      invSplitterCount: $("inv-splitter-count"),
      levelButtons: Array.from(document.querySelectorAll(".lvl-btn")),
      bestScore: $("best-score"),
      btnStart: $("btn-start"),
      btnHow: $("btn-how"),
      howto: $("howto"),
      overlays: {
        title: $("overlay-title"),
        pause: $("overlay-pause"),
        clear: $("overlay-clear"),
        gameClear: $("overlay-gameclear"),
        fail: $("overlay-fail"),
      },
      clearStars: $("clear-stars"),
      clearLines: $("clear-lines"),
      clearTotal: $("clear-total"),
      btnNext: $("btn-next"),
      btnReplayClear: $("btn-replay-clear"),
      btnMenuClear: $("btn-menu-clear"),
      gameClearTotal: $("gameclear-total"),
      gameClearBest: $("gameclear-best"),
      btnAgain: $("btn-again"),
      btnMenuGameClear: $("btn-menu-gameclear"),
      btnRetry: $("btn-retry"),
      btnMenuFail: $("btn-menu-fail"),
      btnResume: $("btn-resume"),
      btnRestartPause: $("btn-restart-pause"),
      btnMenuPause: $("btn-menu-pause"),
    };
    this.stars = makeStars(20261116, 130);
    this.state = "title";
    this.levelIndex = 0;
    this.level = parseLevel(LEVEL_DEFS[0]);
    this.beam = traceBeam(this.level);
    this.movesLeft = LEVEL_DEFS[0].moves;
    this.spares = { ...LEVEL_DEFS[0].spares };
    this.score = 0;
    this.bestScore = this.loadNumber("starlight-relay-best", 0);
    this.unlocked = this.loadNumber("starlight-relay-unlocked", 0);
    this.hover = null;
    this.cursor = { x: 0, y: 0 };
    this.showCursor = false;
    this.placing = null;
    this.particles = [];
    this.animTime = 0;
    this.lastFrame = 0;
    this.frames = 0;
    this.shotMode = false;
    this.outcomeToken = 0;
    this.levelStartStamp = 0;
    this.cssSize = 720;
    this.dpr = 1;
    this.geom = boardGeometry(720, 720, this.level.cols, this.level.rows);
    this.boundLoop = (t) => this.loop(t);
    window.__game = this;
  }

  start() {
    this.bindInput();
    this.resize();
    const params = new URLSearchParams(window.location.search);
    const shot = params.get("shot");
    if (shot) {
      this.shotMode = true;
      this.applyShotMode(shot, params);
    } else {
      this.openMenu();
    }
    this.updateSoundButton();
    requestAnimationFrame(this.boundLoop);
  }

  // ----- setup and sizing -----

  resize() {
    const wrap = this.canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    const size = Math.max(280, Math.floor(Math.min(rect.width, rect.height)));
    this.cssSize = size;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = size + "px";
    this.canvas.style.height = size + "px";
    this.canvas.width = Math.floor(size * this.dpr);
    this.canvas.height = Math.floor(size * this.dpr);
    this.computeGeometry();
  }

  computeGeometry() {
    this.geom = boardGeometry(
      this.cssSize,
      this.cssSize,
      this.level.cols,
      this.level.rows,
    );
  }

  // ----- level flow -----

  loadLevel(index, options = {}) {
    this.outcomeToken += 1;
    this.levelIndex = index;
    this.level = parseLevel(LEVEL_DEFS[index]);
    this.movesLeft = LEVEL_DEFS[index].moves;
    this.spares = { ...LEVEL_DEFS[index].spares };
    this.placing = null;
    this.particles = [];
    this.cursor = { x: 0, y: 0 };
    this.hover = null;
    this.computeGeometry();
    this.beam = traceBeam(this.level);
    this.levelStartStamp = performance.now();
    if (!options.silent) {
      this.state = "playing";
      this.hideOverlays();
    }
    this.updateHud();
    this.updateSidebar();
    this.updateLevelSelect();
  }

  startRun(index) {
    this.score = 0;
    this.loadLevel(index);
  }

  restartLevel() {
    this.sound.click();
    this.loadLevel(this.levelIndex);
  }

  openMenu() {
    this.outcomeToken += 1;
    this.loadLevel(0, { silent: true });
    this.state = "title";
    this.showOverlay("title");
    this.updateHud();
  }

  togglePause() {
    if (this.state === "playing") {
      this.state = "paused";
      this.showOverlay("pause");
      this.sound.click();
    } else if (this.state === "paused") {
      this.state = "playing";
      this.hideOverlays();
      this.sound.click();
    }
  }

  toggleMute() {
    this.sound.setMuted(!this.sound.muted);
    this.updateSoundButton();
    if (!this.sound.muted) this.sound.click();
  }

  updateSoundButton() {
    this.ui.btnSound.textContent = this.sound.muted ? "Sound: Off" : "Sound: On";
  }

  // ----- beam, outcomes and scoring -----

  recomputeBeam() {
    const prevLit = this.beam ? this.beam.lit : new Set();
    this.beam = traceBeam(this.level);
    if (this.state === "playing" && !this.shotMode) {
      const newly = [...this.beam.lit].filter((key) => !prevLit.has(key));
      newly.forEach((key, i) => {
        const [x, y] = key.split(",").map(Number);
        const [cx, cy] = cellCenter(this.geom, x, y);
        const cell = this.level.cells[y][x];
        const color = BEAM_COLORS[cell.need === null ? "gold" : cell.need];
        this.burstAt(cx, cy, color, 16, null);
        this.sound.lantern(this.beam.lit.size - newly.length + i);
      });
    }
    this.updateHud();
    if (this.state !== "playing" || this.shotMode) return;
    if (this.beam.lit.size === this.level.lanterns.length) {
      this.scheduleOutcome("win");
    } else if (this.movesLeft <= 0) {
      this.scheduleOutcome("lose");
    }
  }

  scheduleOutcome(kind) {
    const token = ++this.outcomeToken;
    window.setTimeout(() => {
      if (token !== this.outcomeToken || this.state !== "playing") return;
      if (kind === "win") {
        if (this.beam.lit.size !== this.level.lanterns.length) return;
        this.celebrate();
        this.finishLevel((performance.now() - this.levelStartStamp) / 1000);
      } else {
        if (this.movesLeft > 0 || this.beam.lit.size === this.level.lanterns.length) return;
        this.state = "outOfMoves";
        this.showOverlay("fail");
        this.sound.levelFail();
      }
    }, OUTCOME_DELAY_MS);
  }

  celebrate() {
    for (const lantern of this.level.lanterns) {
      const [cx, cy] = cellCenter(this.geom, lantern.x, lantern.y);
      const cell = this.level.cells[lantern.y][lantern.x];
      const color = BEAM_COLORS[cell.need === null ? "gold" : cell.need];
      this.burstAt(cx, cy, color, 26, null);
    }
  }

  finishLevel(elapsedSec) {
    const def = this.level.def;
    const used = def.moves - this.movesLeft;
    const timeBonus = Math.max(0, 200 - Math.floor(elapsedSec) * 2);
    const moveBonus = 100 * this.movesLeft;
    const levelScore = 400 + moveBonus + timeBonus;
    const stars = used <= def.par ? 3 : used <= def.par + 2 ? 2 : 1;
    this.score += levelScore;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.saveNumber("starlight-relay-best", this.bestScore);
    }
    this.unlocked = Math.max(
      this.unlocked,
      Math.min(this.levelIndex + 1, LEVEL_DEFS.length - 1),
    );
    this.saveNumber("starlight-relay-unlocked", this.unlocked);
    this.updateHud();
    this.updateLevelSelect();
    const last = this.levelIndex === LEVEL_DEFS.length - 1;
    if (last) {
      this.state = "gameClear";
      this.ui.gameClearTotal.textContent = this.score;
      this.ui.gameClearBest.textContent = this.bestScore;
      this.showOverlay("gameClear");
      this.sound.gameWin();
      return;
    }
    this.state = "levelClear";
    this.ui.clearStars.textContent =
      "★".repeat(stars) + "☆".repeat(3 - stars);
    this.ui.clearLines.innerHTML = "";
    const lines = [
      ["Lanterns lit", "400"],
      ["Moves left bonus", "+" + moveBonus],
      ["Time bonus", "+" + timeBonus],
      ["Level score", "" + levelScore],
    ];
    for (const [label, value] of lines) {
      const row = document.createElement("div");
      row.className = "score-row";
      const a = document.createElement("span");
      a.textContent = label;
      const b = document.createElement("span");
      b.textContent = value;
      row.append(a, b);
      this.ui.clearLines.append(row);
    }
    this.ui.clearTotal.textContent = this.score;
    this.ui.btnNext.textContent =
      "Next: " + LEVEL_DEFS[this.levelIndex + 1].name;
    this.showOverlay("clear");
    this.sound.levelWin();
  }

  // ----- moves -----

  rotateAt(x, y) {
    if (this.state !== "playing") return false;
    const cell = this.level.cells[y][x];
    if (!cell || (cell.kind !== "mirror" && cell.kind !== "splitter")) return false;
    if (this.movesLeft <= 0) {
      this.sound.error();
      return false;
    }
    cell.orient = cell.orient === "/" ? "\\" : "/";
    this.movesLeft -= 1;
    this.placing = null;
    this.sound.rotate();
    const [cx, cy] = cellCenter(this.geom, x, y);
    this.burstAt(cx, cy, "#bfe3ff", 6, null);
    this.recomputeBeam();
    this.updateSidebar();
    return true;
  }

  placeAt(x, y) {
    if (this.state !== "playing" || !this.placing) return false;
    if (this.level.cells[y][x] !== null) return false;
    if (this.spares[this.placing] <= 0 || this.movesLeft <= 0) {
      this.sound.error();
      return false;
    }
    this.level.cells[y][x] = {
      kind: this.placing,
      orient: "/",
      placed: true,
    };
    this.spares[this.placing] -= 1;
    this.movesLeft -= 1;
    this.placing = null;
    this.sound.place();
    this.recomputeBeam();
    this.updateSidebar();
    return true;
  }

  pickupAt(x, y) {
    if (this.state !== "playing") return false;
    const cell = this.level.cells[y][x];
    if (!cell || !cell.placed) return false;
    this.level.cells[y][x] = null;
    this.spares[cell.kind] += 1;
    this.sound.pickup();
    this.recomputeBeam();
    this.updateSidebar();
    return true;
  }

  burstAt(cx, cy, color, count, rand) {
    for (let i = 0; i < count; i += 1) {
      const a = (rand ? rand() : Math.random()) * Math.PI * 2;
      const speed = 30 + (rand ? rand() : Math.random()) * 90;
      const life = 350 + (rand ? rand() : Math.random()) * 450;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life,
        maxLife: life,
        size: 2 + (rand ? rand() : Math.random()) * 3,
        color,
      });
    }
  }

  // ----- input -----

  bindInput() {
    const unlock = () => this.sound.ensure();
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });

    this.canvas.addEventListener("click", (event) => {
      const cell = this.cellFromEvent(event);
      if (!cell) return;
      if (this.placing && this.level.cells[cell.y][cell.x] === null) {
        this.placeAt(cell.x, cell.y);
      } else {
        this.rotateAt(cell.x, cell.y);
      }
    });
    this.canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const cell = this.cellFromEvent(event);
      if (cell) this.pickupAt(cell.x, cell.y);
    });
    this.canvas.addEventListener("mousemove", (event) => {
      this.hover = this.cellFromEvent(event);
    });
    this.canvas.addEventListener("mouseleave", () => {
      this.hover = null;
    });
    window.addEventListener("keydown", (event) => this.onKey(event));
    window.addEventListener("resize", () => this.resize());

    const click = (el, fn) => el.addEventListener("click", fn);
    click(this.ui.btnStart, () => {
      this.sound.click();
      this.startRun(0);
    });
    click(this.ui.btnHow, () => {
      this.sound.click();
      this.ui.howto.classList.toggle("hidden");
    });
    for (const btn of this.ui.levelButtons) {
      click(btn, () => {
        const index = Number(btn.dataset.level);
        if (index > this.unlocked) return;
        this.sound.click();
        this.startRun(index);
      });
    }
    click(this.ui.btnRestart, () => this.restartLevel());
    click(this.ui.btnSound, () => this.toggleMute());
    click(this.ui.btnMenu, () => {
      this.sound.click();
      this.openMenu();
    });
    click(this.ui.btnResume, () => this.togglePause());
    click(this.ui.btnRestartPause, () => this.restartLevel());
    click(this.ui.btnMenuPause, () => {
      this.sound.click();
      this.openMenu();
    });
    click(this.ui.btnNext, () => {
      this.sound.click();
      this.loadLevel(this.levelIndex + 1);
    });
    click(this.ui.btnReplayClear, () => this.restartLevel());
    click(this.ui.btnMenuClear, () => {
      this.sound.click();
      this.openMenu();
    });
    click(this.ui.btnAgain, () => {
      this.sound.click();
      this.startRun(0);
    });
    click(this.ui.btnMenuGameClear, () => {
      this.sound.click();
      this.openMenu();
    });
    click(this.ui.btnRetry, () => this.restartLevel());
    click(this.ui.btnMenuFail, () => {
      this.sound.click();
      this.openMenu();
    });
    click(this.ui.invMirror, () => this.togglePlacing("mirror"));
    click(this.ui.invSplitter, () => this.togglePlacing("splitter"));
  }

  togglePlacing(kind) {
    if (this.state !== "playing") return;
    if (this.spares[kind] <= 0) {
      this.sound.error();
      return;
    }
    this.placing = this.placing === kind ? null : kind;
    this.sound.click();
    this.updateSidebar();
  }

  onKey(event) {
    const gameKeys = [
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
      " ", "Enter", "KeyW", "KeyA", "KeyS", "KeyD",
      "KeyF", "KeyR", "KeyP", "KeyM", "Escape",
    ];
    if (gameKeys.includes(event.code) || gameKeys.includes(event.key)) {
      event.preventDefault();
    }
    if (event.code === "KeyM") {
      this.toggleMute();
      return;
    }
    if (event.code === "KeyP" || event.key === "Escape") {
      if (this.state === "playing" || this.state === "paused") this.togglePause();
      return;
    }
    if (event.code === "KeyR") {
      if (this.state === "playing" || this.state === "paused") this.restartLevel();
      return;
    }
    if (this.state === "title" && event.key === "Enter") {
      this.sound.click();
      this.startRun(0);
      return;
    }
    if (this.state !== "playing") return;
    const move = {
      ArrowUp: [0, -1], KeyW: [0, -1],
      ArrowDown: [0, 1], KeyS: [0, 1],
      ArrowLeft: [-1, 0], KeyA: [-1, 0],
      ArrowRight: [1, 0], KeyD: [1, 0],
    }[event.code];
    if (move) {
      this.showCursor = true;
      this.cursor.x = Math.max(0, Math.min(this.level.cols - 1, this.cursor.x + move[0]));
      this.cursor.y = Math.max(0, Math.min(this.level.rows - 1, this.cursor.y + move[1]));
      return;
    }
    if (event.code === "Space" || event.key === "Enter") {
      this.showCursor = true;
      if (this.placing && this.level.cells[this.cursor.y][this.cursor.x] === null) {
        this.placeAt(this.cursor.x, this.cursor.y);
      } else {
        this.rotateAt(this.cursor.x, this.cursor.y);
      }
      return;
    }
    if (event.code === "KeyF") {
      this.showCursor = true;
      const cell = this.level.cells[this.cursor.y][this.cursor.x];
      if (this.placing) {
        this.placeAt(this.cursor.x, this.cursor.y);
      } else if (cell && cell.placed) {
        this.pickupAt(this.cursor.x, this.cursor.y);
      } else if (this.spares.mirror > 0) {
        this.togglePlacing("mirror");
      } else if (this.spares.splitter > 0) {
        this.togglePlacing("splitter");
      }
    }
  }

  cellFromEvent(event) {
    const rect = this.canvas.getBoundingClientRect();
    const px = (event.clientX - rect.left) * (this.cssSize / rect.width);
    const py = (event.clientY - rect.top) * (this.cssSize / rect.height);
    const x = Math.floor((px - this.geom.ox) / this.geom.cell);
    const y = Math.floor((py - this.geom.oy) / this.geom.cell);
    if (x < 0 || y < 0 || x >= this.level.cols || y >= this.level.rows) return null;
    return { x, y };
  }

  // ----- interface -----

  showOverlay(name) {
    for (const [key, el] of Object.entries(this.ui.overlays)) {
      el.classList.toggle("hidden", key !== name);
    }
  }

  hideOverlays() {
    for (const el of Object.values(this.ui.overlays)) el.classList.add("hidden");
  }

  updateHud() {
    const def = this.level.def;
    this.ui.hudLevel.textContent =
      "Level " + (this.levelIndex + 1) + " · " + def.name;
    this.ui.hudLanterns.textContent =
      this.beam.lit.size + " / " + this.level.lanterns.length;
    this.ui.hudMoves.textContent = this.movesLeft;
    this.ui.hudScore.textContent = this.score;
    this.ui.bestScore.textContent = this.bestScore;
  }

  updateSidebar() {
    const def = this.level.def;
    this.ui.sideName.textContent = "Level " + (this.levelIndex + 1) + ": " + def.name;
    this.ui.sideGoal.textContent = def.hint;
    this.ui.invMirrorCount.textContent = "× " + this.spares.mirror;
    this.ui.invSplitterCount.textContent = "× " + this.spares.splitter;
    this.ui.invMirror.classList.toggle("selected", this.placing === "mirror");
    this.ui.invSplitter.classList.toggle("selected", this.placing === "splitter");
    this.ui.invMirror.disabled = this.spares.mirror <= 0;
    this.ui.invSplitter.disabled = this.spares.splitter <= 0;
  }

  updateLevelSelect() {
    for (const btn of this.ui.levelButtons) {
      const index = Number(btn.dataset.level);
      btn.disabled = index > this.unlocked;
      btn.classList.toggle("locked", index > this.unlocked);
      btn.classList.toggle("done", index < this.unlocked);
      btn.classList.toggle(
        "current",
        index === this.levelIndex && this.state !== "title",
      );
    }
  }

  // ----- screenshot scenes -----

  applyShotMode(shot, params) {
    // A missing ?level= means "use the scripted default": Number(null) is 0,
    // so the raw parameter must be checked before it is converted.
    const rawLevel = params.get("level");
    const levelParam = rawLevel === null ? NaN : Number(rawLevel);
    if (shot === "play" || shot === "win") {
      const script = SHOT_ROTATIONS[shot];
      const index = Number.isInteger(levelParam) ? levelParam : script.level;
      const clamped = Math.max(0, Math.min(LEVEL_DEFS.length - 1, index));
      this.loadLevel(clamped, { silent: true });
      if (clamped === script.level) {
        for (const [x, y] of script.cells) {
          const cell = this.level.cells[y][x];
          if (cell && (cell.kind === "mirror" || cell.kind === "splitter")) {
            cell.orient = cell.orient === "/" ? "\\" : "/";
            this.movesLeft -= 1;
          }
        }
      }
      this.beam = traceBeam(this.level);
      if (shot === "win") {
        const rand = mulberry32(7);
        for (const lantern of this.level.lanterns) {
          const [cx, cy] = cellCenter(this.geom, lantern.x, lantern.y);
          const cell = this.level.cells[lantern.y][lantern.x];
          const color = BEAM_COLORS[cell.need === null ? "gold" : cell.need];
          this.burstAt(cx, cy, color, 22, rand);
        }
        this.finishLevel(38);
      } else {
        this.state = "playing";
        this.hideOverlays();
        this.updateHud();
      }
      return;
    }
    if (shot === "lose") {
      const index = Number.isInteger(levelParam) ? levelParam : 3;
      const clamped = Math.max(0, Math.min(LEVEL_DEFS.length - 1, index));
      this.loadLevel(clamped, { silent: true });
      this.movesLeft = 0;
      this.beam = traceBeam(this.level);
      this.state = "outOfMoves";
      this.showOverlay("fail");
      this.updateHud();
      return;
    }
    this.loadLevel(0, { silent: true });
    this.state = "title";
    this.showOverlay("title");
    this.updateHud();
  }

  // ----- persistence -----

  loadNumber(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      const parsed = value === null ? NaN : Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    } catch (err) {
      return fallback;
    }
  }

  saveNumber(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch (err) {
      /* Progress saving is a nicety, never a requirement. */
    }
  }

  // ----- frame loop -----

  loop(t) {
    requestAnimationFrame(this.boundLoop);
    const dt = this.shotMode ? 0 : Math.min(50, this.lastFrame ? t - this.lastFrame : 16);
    this.lastFrame = t;
    this.animTime = this.shotMode ? SHOT_TIME_MS : this.animTime + dt;
    if (dt > 0) {
      const step = dt / 1000;
      this.particles = this.particles.filter((p) => {
        p.life -= dt;
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.vy += 26 * step;
        return p.life > 0;
      });
    }
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawScene(this.ctx, {
      width: this.cssSize,
      height: this.cssSize,
      stars: this.stars,
      level: this.level,
      beam: this.beam,
      geom: this.geom,
      time: this.animTime,
      hover: this.hover,
      cursor: this.cursor,
      showCursor: this.showCursor && this.state === "playing",
      placing: this.placing,
      particles: this.particles,
      interactive: this.state === "playing",
    });
    this.frames += 1;
    if (this.frames === 5) window.__shotReady = true;
  }
}
