import { createCliRenderer, TextRenderable } from "@opentui/core";
import {
  createInitialState,
  queueDirection,
  tick,
  togglePause,
  type Direction,
  type GameState,
} from "./src/game";

const TICK_MS = 140;
const MIN_WIDTH = 14;
const MIN_HEIGHT = 10;
const MAX_WIDTH = 36;
const MAX_HEIGHT = 20;

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  useAlternateScreen: true,
  autoFocus: true,
});

const boardSize = getBoardSize(
  renderer.terminalWidth,
  renderer.terminalHeight,
);

let state = createInitialState({
  width: boardSize.width,
  height: boardSize.height,
});

const screen = new TextRenderable(renderer, {
  width: "100%",
  height: "100%",
  content: render(state),
});

renderer.root.add(screen);
renderer.start();

const interval = setInterval(() => {
  state = tick(state);
  screen.content = render(state);
  renderer.requestRender();
}, TICK_MS);

renderer.keyInput.on("keypress", (key) => {
  if (key.ctrl && key.name === "c") {
    return;
  }

  if (key.name === "q") {
    shutdown();
    return;
  }

  if (key.name === "r") {
    state = createInitialState({
      width: boardSize.width,
      height: boardSize.height,
    });
    screen.content = render(state);
    renderer.requestRender();
    return;
  }

  if (key.name === "space" || key.name === "p") {
    state = togglePause(state);
    screen.content = render(state);
    renderer.requestRender();
    return;
  }

  const direction = mapKeyToDirection(key.name, key.sequence);
  if (direction) {
    state = queueDirection(state, direction);
  }
});

renderer.on("destroy", () => {
  clearInterval(interval);
});

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

function shutdown() {
  clearInterval(interval);
  renderer.destroy();
  process.exit(0);
}

function getBoardSize(terminalWidth: number, terminalHeight: number) {
  const width = clamp(terminalWidth - 4, MIN_WIDTH, MAX_WIDTH);
  const height = clamp(terminalHeight - 6, MIN_HEIGHT, MAX_HEIGHT);
  return { width, height };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function mapKeyToDirection(name: string, sequence: string): Direction | null {
  switch (name) {
    case "up":
      return "up";
    case "down":
      return "down";
    case "left":
      return "left";
    case "right":
      return "right";
    case "w":
    case "W":
      return "up";
    case "s":
    case "S":
      return "down";
    case "a":
    case "A":
      return "left";
    case "d":
    case "D":
      return "right";
    default:
      return sequenceToArrow(sequence);
  }
}

function sequenceToArrow(sequence: string): Direction | null {
  switch (sequence) {
    case "\u001b[A":
      return "up";
    case "\u001b[B":
      return "down";
    case "\u001b[C":
      return "right";
    case "\u001b[D":
      return "left";
    default:
      return null;
  }
}

function render(state: GameState): string {
  const lines: string[] = [];
  const status = state.gameOver
    ? state.won
      ? "You filled the board."
      : "Game Over."
    : state.paused
      ? "Paused."
      : "";

  lines.push(`Snake  Score: ${state.score}  Length: ${state.snake.length}`);
  if (status) {
    lines.push(status);
  } else {
    lines.push(" ");
  }

  lines.push(renderBoard(state));
  lines.push(" ");
  lines.push(
    "Controls: Arrow keys/WASD move, P or Space pause, R restart, Q quit",
  );
  if (state.gameOver) {
    lines.push("Press R to restart.");
  }

  return lines.join("\n");
}

function renderBoard(state: GameState): string {
  const { width, height, snake, food } = state;
  const grid: string[][] = [];

  for (let y = 0; y < height; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < width; x += 1) {
      row.push(" ");
    }
    grid.push(row);
  }

  if (food) {
    grid[food.y][food.x] = "*";
  }

  snake.forEach((segment, index) => {
    grid[segment.y][segment.x] = index === 0 ? "@" : "o";
  });

  const top = "+" + "-".repeat(width) + "+";
  const bottom = top;
  const rows = grid.map((row) => `|${row.join("")}|`);

  return [top, ...rows, bottom].join("\n");
}
