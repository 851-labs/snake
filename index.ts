import { BoxRenderable, TextRenderable, createCliRenderer } from "@opentui/core";
import {
  createInitialState,
  queueDirection,
  tick,
  togglePause,
  type Direction,
  type GameState,
  type Point,
} from "./src/game";

const TICK_MS = 140;
const MIN_WIDTH = 12;
const MIN_HEIGHT = 8;
const MAX_WIDTH = 36;
const MAX_HEIGHT = 22;
const CELL_WIDTH = 2;
const CELL_HEIGHT = 1;
const PANEL_WIDTH = 28;
const GAP = 2;
const ROOT_PADDING = 1;

const COLORS = {
  empty: "#121212",
  food: "#cc3b3b",
  snake: "#1e8f54",
  snakeHead: "#34d17c",
  panel: "#0a0a0a",
  border: "#4a4a4a",
  borderAlert: "#d17834",
};

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

const root = new BoxRenderable(renderer, {
  width: "100%",
  height: "100%",
  flexDirection: "row",
  padding: ROOT_PADDING,
  gap: GAP,
  backgroundColor: COLORS.panel,
  shouldFill: true,
});

const boardBox = new BoxRenderable(renderer, {
  width: boardSize.pixelWidth,
  height: boardSize.pixelHeight,
  border: true,
  borderColor: COLORS.border,
  flexDirection: "row",
  flexWrap: "wrap",
});

const panelBox = new BoxRenderable(renderer, {
  width: PANEL_WIDTH,
  height: boardSize.pixelHeight,
  border: true,
  borderColor: COLORS.border,
  flexDirection: "column",
  padding: 1,
  gap: 1,
});

const titleText = new TextRenderable(renderer, {
  content: "Snake",
});

const scoreText = new TextRenderable(renderer, {
  content: "",
});

const statusText = new TextRenderable(renderer, {
  content: "",
});

const helpText = new TextRenderable(renderer, {
  content:
    "Controls\n\nArrows / WASD  Move\nP or Space    Pause\nR             Restart\nQ             Quit",
});

panelBox.add(titleText);
panelBox.add(scoreText);
panelBox.add(statusText);
panelBox.add(helpText);

root.add(boardBox);
root.add(panelBox);
renderer.root.add(root);

const cells = createGrid(boardBox, boardSize.width, boardSize.height);
updateUi(state);

renderer.start();

const interval = setInterval(() => {
  state = tick(state);
  updateUi(state);
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
    updateUi(state);
    return;
  }

  if (key.name === "space" || key.name === "p") {
    state = togglePause(state);
    updateUi(state);
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
  const availableWidth =
    terminalWidth - ROOT_PADDING * 2 - PANEL_WIDTH - GAP - 2;
  const availableHeight = terminalHeight - ROOT_PADDING * 2 - 2;

  const width = clamp(
    Math.floor(availableWidth / CELL_WIDTH),
    MIN_WIDTH,
    MAX_WIDTH,
  );
  const height = clamp(
    Math.floor(availableHeight / CELL_HEIGHT),
    MIN_HEIGHT,
    MAX_HEIGHT,
  );

  return {
    width,
    height,
    pixelWidth: width * CELL_WIDTH + 2,
    pixelHeight: height * CELL_HEIGHT + 2,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function createGrid(
  container: BoxRenderable,
  width: number,
  height: number,
) {
  const grid: {
    box: BoxRenderable;
    text: TextRenderable;
  }[][] = [];

  for (let y = 0; y < height; y += 1) {
    const row: { box: BoxRenderable; text: TextRenderable }[] = [];
    for (let x = 0; x < width; x += 1) {
      const cellBox = new BoxRenderable(renderer, {
        width: CELL_WIDTH,
        height: CELL_HEIGHT,
        backgroundColor: COLORS.empty,
        shouldFill: true,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
      });

      const cellText = new TextRenderable(renderer, {
        content: " ",
        width: "100%",
        height: "100%",
      });

      cellBox.add(cellText);
      container.add(cellBox);
      row.push({ box: cellBox, text: cellText });
    }
    grid.push(row);
  }

  return grid;
}

function updateUi(nextState: GameState) {
  updatePanel(nextState);
  updateGrid(nextState);
  renderer.requestRender();
}

function updatePanel(nextState: GameState) {
  scoreText.content = `Score: ${nextState.score}\nLength: ${nextState.snake.length}`;

  let statusLine = "";
  if (nextState.gameOver) {
    statusLine = nextState.won ? "You filled the board!" : "Game Over";
  } else if (nextState.paused) {
    statusLine = "Paused";
  }

  statusText.content = statusLine ? `\n${statusLine}\n` : "";
  boardBox.borderColor = nextState.gameOver ? COLORS.borderAlert : COLORS.border;
}

function updateGrid(nextState: GameState) {
  for (let y = 0; y < nextState.height; y += 1) {
    for (let x = 0; x < nextState.width; x += 1) {
      const cell = cells[y]![x]!;
      cell.box.backgroundColor = COLORS.empty;
      cell.text.content = " ";
    }
  }

  if (nextState.food) {
    paintCell(nextState.food, COLORS.food, " ");
  }

  nextState.snake.forEach((segment, index) => {
    paintCell(
      segment,
      index === 0 ? COLORS.snakeHead : COLORS.snake,
      " ",
    );
  });
}

function paintCell(point: Point, color: string, symbol: string) {
  const row = cells[point.y];
  const cell = row ? row[point.x] : undefined;
  if (!cell) {
    return;
  }
  cell.box.backgroundColor = color;
  cell.text.content = symbol;
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
