// Starlight Relay — entry point. Wires the canvas and the sound engine
// into the game controller once the page is ready.

import { Game } from "./game.js";
import { SoundEngine } from "./audio.js";

function boot() {
  const canvas = document.getElementById("board");
  const sound = new SoundEngine();
  const game = new Game(canvas, sound);
  game.start();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
