import {
  BoxRenderable,
  TextRenderable,
  createCliRenderer,
  fg,
  t,
} from "@opentui/core";
import {
  createInitialState,
  queueDirection,
  tick,
  togglePause,
  type Direction,
  type GameState,
  type Point,
} from "./game";

const TICK_MS = 140;
const MIN_WIDTH = 12;
const MIN_HEIGHT = 8;
const MAX_WIDTH = 36;
const MAX_HEIGHT = 22;
const CELL_WIDTH = 2;
const CELL_HEIGHT = 1;
const HEADER_HEIGHT = 3;
const CONTROLS_HEIGHT = 3;
const APP_GAP = 0;
const ROOT_PADDING = 1;

const COLORS = {
  empty: "transparent",
  food: "#cc3b3b",
  snake: "#1e8f54",
  snakeHead: "#34d17c",
  panel: "#0a0a0a",
  border: "#4a4a4a",
  borderAlert: "#d17834",
  controlsKey: "#f2f2f2",
  controlsHint: "#8b909a",
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
let currentSize = boardSize;

let state = createInitialState({
  width: boardSize.width,
  height: boardSize.height,
});
let hasStarted = false;
state = {
  ...state,
  paused: true,
};

const app = new BoxRenderable(renderer, {
  id: "app",
  width: "100%",
  height: "100%",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  padding: ROOT_PADDING,
  gap: APP_GAP,
  shouldFill: true,
});

const gameGroup = new BoxRenderable(renderer, {
  id: "group",
  flexDirection: "column",
  gap: 0,
  alignItems: "center",
});

let boardBox = createBoardBox(boardSize);
const headerBar = new BoxRenderable(renderer, {
  width: boardSize.pixelWidth,
  height: HEADER_HEIGHT,
  justifyContent: "center",
  alignItems: "center",
});

const headerText = new TextRenderable(renderer, {
  content: renderHeader(0),
});

const controlsBar = new BoxRenderable(renderer, {
  width: boardSize.pixelWidth,
  height: CONTROLS_HEIGHT,
  justifyContent: "center",
  alignItems: "center",
});

const controlsText = new TextRenderable(renderer, {
  content: renderControls(),
});

const backdrop = new BoxRenderable(renderer, {
  width: "100%",
  height: "100%",
  position: "absolute",
  top: 0,
  left: 0,
  backgroundColor: "#000000",
  opacity: 0.55,
  zIndex: 8,
  visible: false,
});

const dialogOverlay = new BoxRenderable(renderer, {
  width: "100%",
  height: "100%",
  position: "absolute",
  top: 0,
  left: 0,
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9,
  visible: false,
});

const dialogBox = new BoxRenderable(renderer, {
  width: 36,
  height: 7,
  border: true,
  borderColor: COLORS.borderAlert,
  backgroundColor: COLORS.panel,
  padding: 1,
});

const dialogText = new TextRenderable(renderer, {
  content: "",
});

dialogBox.add(dialogText);
dialogOverlay.add(dialogBox);

headerBar.add(headerText);
controlsBar.add(controlsText);

gameGroup.add(headerBar);
gameGroup.add(boardBox);
gameGroup.add(controlsBar);

app.add(gameGroup);
app.add(backdrop);
app.add(dialogOverlay);
renderer.root.add(app);

let cells = createGrid(boardBox, boardSize.width, boardSize.height);
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
      width: currentSize.width,
      height: currentSize.height,
    });
    hasStarted = false;
    state = {
      ...state,
      paused: true,
    };
    updateUi(state);
    return;
  }

  if (key.name === "space" || key.name === "p") {
    if (!hasStarted) {
      hasStarted = true;
      state = {
        ...state,
        paused: false,
      };
    } else {
      state = togglePause(state);
    }
    updateUi(state);
    return;
  }

  const direction = mapKeyToDirection(key.name, key.sequence);
  if (direction) {
    if (!hasStarted) {
      hasStarted = true;
      state = {
        ...state,
        paused: false,
      };
    }
    state = queueDirection(state, direction);
  }
});

renderer.on("destroy", () => {
  clearInterval(interval);
});

process.stdout.on("resize", () => {
  rebuildLayout();
});

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

function shutdown() {
  clearInterval(interval);
  renderer.destroy();
}

function getBoardSize(
  terminalWidth: number,
  terminalHeight: number,
) {
  const availableWidth = terminalWidth - ROOT_PADDING * 2 - 2;
  const availableHeight =
    terminalHeight -
    ROOT_PADDING * 2 -
    HEADER_HEIGHT -
    CONTROLS_HEIGHT -
    APP_GAP * 2 -
    2;

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

  const pixelWidth = width * CELL_WIDTH + 2;
  const pixelHeight = height * CELL_HEIGHT + 2;

  return {
    width,
    height,
    pixelWidth,
    pixelHeight,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function createBoardBox(size: ReturnType<typeof getBoardSize>) {
  return new BoxRenderable(renderer, {
    id: "board",
    width: size.pixelWidth,
    height: size.pixelHeight,
    border: true,
    borderColor: COLORS.border,
    flexDirection: "row",
    flexWrap: "wrap",
  });
}

function rebuildLayout() {
  const nextSize = getBoardSize(
    renderer.terminalWidth,
    renderer.terminalHeight,
  );
  currentSize = nextSize;

  headerBar.width = nextSize.pixelWidth;
  controlsBar.width = nextSize.pixelWidth;

  gameGroup.remove("board");
  boardBox.destroyRecursively();
  boardBox = createBoardBox(nextSize);
  gameGroup.insertBefore(boardBox, controlsBar);

  cells = createGrid(boardBox, nextSize.width, nextSize.height);
  state = createInitialState({
    width: nextSize.width,
    height: nextSize.height,
  });
  hasStarted = false;
  state = {
    ...state,
    paused: true,
  };
  updateUi(state);
}

function renderHeader(score: number) {
  return t`${fg(COLORS.controlsHint)("score")} ${fg(COLORS.controlsKey)(
    String(score),
  )}`;
}

function renderControls() {
  return t`${fg(COLORS.controlsKey)("Arrows/WASD")} ${fg(
    COLORS.controlsHint,
  )("move")}   ${fg(COLORS.controlsKey)("P/Space")} ${fg(
    COLORS.controlsHint,
  )("pause")}   ${fg(COLORS.controlsKey)("R")} ${fg(
    COLORS.controlsHint,
  )("restart")}   ${fg(COLORS.controlsKey)("Q")} ${fg(
    COLORS.controlsHint,
  )("quit")}`;
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
  headerText.content = renderHeader(nextState.score);
  boardBox.borderColor = nextState.gameOver ? COLORS.borderAlert : COLORS.border;
  const showDialog = nextState.gameOver || !hasStarted;
  backdrop.visible = showDialog;
  dialogOverlay.visible = showDialog;
  if (!hasStarted) {
    dialogText.content = "Welcome to Snake\n\nPress Space or an arrow key to start";
  } else if (nextState.gameOver) {
    const headline = nextState.won ? "You Win!" : "Game Over";
    dialogText.content = `${headline}\n\nScore: ${nextState.score}\nPress R to restart`;
  }
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

  nextState.snake.forEach((segment: Point, index: number) => {
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
