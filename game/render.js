// Starlight Relay — all drawing. Canvas 2D, everything generated in code:
// the starfield, the board, the tiles, the beam and the particles. No
// images, no fonts loaded over the network.

export const BEAM_COLORS = {
  gold: "#ffd166",
  cyan: "#53e9ff",
  magenta: "#ff6ec7",
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stars in normalised coordinates, so they survive a resize unchanged.
export function makeStars(seed, count) {
  const rand = mulberry32(seed);
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: rand(),
      y: rand(),
      r: 0.6 + rand() * 1.5,
      phase: rand() * Math.PI * 2,
      speed: 0.4 + rand() * 1.1,
    });
  }
  return stars;
}

export function boardGeometry(width, height, cols, rows) {
  const cell = Math.max(
    24,
    Math.floor(Math.min(width, height) / (Math.max(cols, rows) + 1)),
  );
  const ox = Math.floor((width - cell * cols) / 2);
  const oy = Math.floor((height - cell * rows) / 2);
  return { ox, oy, cell };
}

export function cellCenter(geom, x, y) {
  return [geom.ox + (x + 0.5) * geom.cell, geom.oy + (y + 0.5) * geom.cell];
}

function gridPoint(geom, gx, gy) {
  return [geom.ox + gx * geom.cell, geom.oy + gy * geom.cell];
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, width, height, stars, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#0a0e24");
  sky.addColorStop(0.55, "#101736");
  sky.addColorStop(1, "#0b1029");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const nebula = (cx, cy, r, color) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  nebula(width * 0.18, height * 0.2, width * 0.42, "rgba(88,80,180,0.20)");
  nebula(width * 0.85, height * 0.75, width * 0.45, "rgba(40,140,160,0.14)");
  nebula(width * 0.7, height * 0.12, width * 0.3, "rgba(255,110,199,0.08)");

  for (const star of stars) {
    const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.001 * star.speed + star.phase));
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = "#dfe8ff";
    ctx.beginPath();
    ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const vig = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.42,
    width / 2, height / 2, Math.max(width, height) * 0.75,
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(2,4,14,0.42)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);
}

function drawBoardBase(ctx, geom, level) {
  const { ox, oy, cell } = geom;
  const w = cell * level.cols;
  const h = cell * level.rows;
  ctx.save();
  ctx.shadowColor = "rgba(90,120,255,0.35)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#141b3d";
  roundRect(ctx, ox - 6, oy - 6, w + 12, h + 12, 14);
  ctx.fill();
  ctx.restore();
  for (let y = 0; y < level.rows; y += 1) {
    for (let x = 0; x < level.cols; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.012)";
      ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
    }
  }
  ctx.strokeStyle = "rgba(140,160,255,0.16)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= level.cols; x += 1) {
    ctx.moveTo(ox + x * cell + 0.5, oy);
    ctx.lineTo(ox + x * cell + 0.5, oy + h);
  }
  for (let y = 0; y <= level.rows; y += 1) {
    ctx.moveTo(ox, oy + y * cell + 0.5);
    ctx.lineTo(ox + w, oy + y * cell + 0.5);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(150,175,255,0.4)";
  ctx.lineWidth = 2;
  roundRect(ctx, ox - 6, oy - 6, w + 12, h + 12, 14);
  ctx.stroke();
}

function drawWall(ctx, cx, cy, s) {
  const m = s * 0.1;
  ctx.fillStyle = "#2a3357";
  roundRect(ctx, cx - s / 2 + m, cy - s / 2 + m, s - m * 2, s - m * 2, s * 0.12);
  ctx.fill();
  ctx.fillStyle = "#39467a";
  roundRect(ctx, cx - s / 2 + m, cy - s / 2 + m, s - m * 2, s * 0.3, s * 0.12);
  ctx.fill();
  ctx.strokeStyle = "rgba(180,195,255,0.35)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, cx - s / 2 + m, cy - s / 2 + m, s - m * 2, s - m * 2, s * 0.12);
  ctx.stroke();
  ctx.fillStyle = "rgba(200,212,255,0.5)";
  ctx.beginPath();
  ctx.arc(cx - s * 0.18, cy + s * 0.12, s * 0.045, 0, Math.PI * 2);
  ctx.arc(cx + s * 0.18, cy + s * 0.12, s * 0.045, 0, Math.PI * 2);
  ctx.fill();
}

function drawGloom(ctx, cx, cy, s, time) {
  const r = s * 0.34;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, "#05060f");
  g.addColorStop(0.7, "#0d0a1e");
  g.addColorStop(1, "rgba(20,12,40,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(150,110,255,0.55)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i += 1) {
    const a0 = time * 0.0006 * (i === 0 ? 1 : -1.4) + i * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, r * (0.55 + i * 0.3), a0, a0 + Math.PI * 1.1);
    ctx.stroke();
  }
}

function drawMirrorFace(ctx, cx, cy, s, orient, splitter) {
  const m = s * 0.14;
  ctx.fillStyle = "rgba(170,205,255,0.10)";
  roundRect(ctx, cx - s / 2 + m, cy - s / 2 + m, s - m * 2, s - m * 2, s * 0.14);
  ctx.fill();
  ctx.strokeStyle = "rgba(190,215,255,0.45)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, cx - s / 2 + m, cy - s / 2 + m, s - m * 2, s - m * 2, s * 0.14);
  ctx.stroke();
  const d = s * 0.3;
  const [x1, y1, x2, y2] = orient === "/"
    ? [cx - d, cy + d, cx + d, cy - d]
    : [cx - d, cy - d, cx + d, cy + d];
  ctx.save();
  ctx.shadowColor = "#bfe3ff";
  ctx.shadowBlur = 10;
  ctx.strokeStyle = "#eaf6ff";
  ctx.lineWidth = Math.max(3, s * 0.07);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#dcebff";
  ctx.beginPath();
  ctx.arc(x1, y1, s * 0.05, 0, Math.PI * 2);
  ctx.arc(x2, y2, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  if (splitter) {
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,209,102,0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.16, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPrism(ctx, cx, cy, s, color, time) {
  const fill = BEAM_COLORS[color];
  const pulse = 1 + 0.06 * Math.sin(time * 0.002 + cx);
  const r = s * 0.3 * pulse;
  ctx.save();
  ctx.shadowColor = fill;
  ctx.shadowBlur = 14;
  const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.45, fill);
  g.addColorStop(1, fill);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.85, cy + r * 0.7);
  ctx.lineTo(cx - r * 0.85, cy + r * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.25, cy - r * 0.25, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

function drawLantern(ctx, cx, cy, s, need, lit, time) {
  const glowColor = lit ? BEAM_COLORS[need === null ? "gold" : need] : null;
  ctx.strokeStyle = "#8a94c4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.34);
  ctx.lineTo(cx, cy - s * 0.2);
  ctx.stroke();
  ctx.fillStyle = "#3a4470";
  roundRect(ctx, cx - s * 0.16, cy - s * 0.24, s * 0.32, s * 0.09, 3);
  ctx.fill();
  const bodyR = s * 0.2;
  ctx.save();
  if (lit) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 22;
  }
  ctx.fillStyle = lit ? glowColor : "rgba(70,80,130,0.55)";
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.04, bodyR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = lit ? "#fff6dd" : "rgba(190,200,240,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.04, bodyR, 0, Math.PI * 2);
  ctx.stroke();
  if (lit) {
    const flicker = 1 + 0.12 * Math.sin(time * 0.009 + cx * 0.7);
    ctx.fillStyle = "rgba(255,252,235,0.95)";
    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.04, bodyR * 0.48 * flicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = glowColor;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      const a = (Math.PI / 2) * i + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * bodyR * 1.35, cy + s * 0.04 + Math.sin(a) * bodyR * 1.35);
      ctx.lineTo(cx + Math.cos(a) * bodyR * 1.7, cy + s * 0.04 + Math.sin(a) * bodyR * 1.7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = "rgba(20,26,54,0.9)";
    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.04, bodyR * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  if (need !== null) {
    ctx.fillStyle = BEAM_COLORS[need];
    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.34, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#3a4470";
  roundRect(ctx, cx - s * 0.1, cy + s * 0.24, s * 0.2, s * 0.06, 3);
  ctx.fill();
}

function drawEmitter(ctx, cx, cy, s, dir, time) {
  const pulse = 1 + 0.1 * Math.sin(time * 0.003);
  const r = s * 0.26 * pulse;
  ctx.save();
  ctx.shadowColor = "#ffd166";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#fff3cf";
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI / 4) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.42;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  const arrow = [[0, -1], [1, 0], [0, 1], [-1, 0]][dir];
  const ax = cx + arrow[0] * s * 0.36;
  const ay = cy + arrow[1] * s * 0.36;
  const ang = Math.atan2(arrow[1], arrow[0]);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(ang);
  ctx.fillStyle = "#ffe9a8";
  ctx.beginPath();
  ctx.moveTo(s * 0.09, 0);
  ctx.lineTo(-s * 0.06, -s * 0.06);
  ctx.lineTo(-s * 0.06, s * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTiles(ctx, geom, level, lit, time) {
  const { cell } = geom;
  for (let y = 0; y < level.rows; y += 1) {
    for (let x = 0; x < level.cols; x += 1) {
      const cellObj = level.cells[y][x];
      if (cellObj === null) continue;
      const [cx, cy] = cellCenter(geom, x, y);
      if (cellObj.kind === "wall") drawWall(ctx, cx, cy, cell);
      else if (cellObj.kind === "gloom") drawGloom(ctx, cx, cy, cell, time);
      else if (cellObj.kind === "mirror") drawMirrorFace(ctx, cx, cy, cell, cellObj.orient, false);
      else if (cellObj.kind === "splitter") drawMirrorFace(ctx, cx, cy, cell, cellObj.orient, true);
      else if (cellObj.kind === "prism") drawPrism(ctx, cx, cy, cell, cellObj.color, time);
      else if (cellObj.kind === "lantern") {
        drawLantern(ctx, cx, cy, cell, cellObj.need, lit.has(x + "," + y), time);
      } else if (cellObj.kind === "emitter") drawEmitter(ctx, cx, cy, cell, cellObj.dir, time);
    }
  }
}

function drawBeam(ctx, geom, beam, time) {
  for (const segment of beam.segments) {
    const color = BEAM_COLORS[segment.color] || BEAM_COLORS.gold;
    const pts = segment.points.map(([gx, gy]) => gridPoint(geom, gx, gy));
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
    };
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = geom.cell * 0.26;
    trace();
    ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = geom.cell * 0.1;
    trace();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "#fffbe8";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 16]);
    ctx.lineDashOffset = -((time * 0.06) % 28);
    trace();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#fffbe8";
    for (let i = 1; i < pts.length - 1; i += 1) {
      ctx.beginPath();
      ctx.arc(pts[i][0], pts[i][1], 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawParticles(ctx, particles) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCellFrame(ctx, geom, x, y, stroke, fill, dashed) {
  const px = geom.ox + x * geom.cell;
  const py = geom.oy + y * geom.cell;
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(px + 2, py + 2, geom.cell - 4, geom.cell - 4);
  }
  ctx.save();
  if (dashed) ctx.setLineDash([6, 5]);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.5;
  roundRect(ctx, px + 3, py + 3, geom.cell - 6, geom.cell - 6, 8);
  ctx.stroke();
  ctx.restore();
}

export function drawScene(ctx, scene) {
  const { width, height } = scene;
  ctx.clearRect(0, 0, width, height);
  drawBackground(ctx, width, height, scene.stars, scene.time);
  const geom = scene.geom;
  drawBoardBase(ctx, geom, scene.level);
  if (scene.hover && scene.interactive) {
    drawCellFrame(ctx, geom, scene.hover.x, scene.hover.y, "rgba(255,209,102,0.65)", "rgba(255,209,102,0.08)", false);
  }
  if (scene.showCursor && scene.cursor) {
    drawCellFrame(ctx, geom, scene.cursor.x, scene.cursor.y, "rgba(83,233,255,0.9)", null, true);
  }
  drawBeam(ctx, geom, scene.beam, scene.time);
  drawTiles(ctx, geom, scene.level, scene.beam.lit, scene.time);
  drawParticles(ctx, scene.particles);
}
