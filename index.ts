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
} from "./src/game";

const TICK_MS = 140;
const MIN_WIDTH = 12;
const MIN_HEIGHT = 8;
const MAX_WIDTH = 36;
const MAX_HEIGHT = 22;
const CELL_WIDTH = 2;
const CELL_HEIGHT = 1;
const PANEL_WIDTH = 28;
const PANEL_HEIGHT = 12;
const CONTROLS_HEIGHT = 3;
const APP_GAP = 0;
const GAP = 2;
const ROOT_PADDING = 1;
const LAYOUT_BREAKPOINT = 100;

const COLORS = {
  empty: "#121212",
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

const layoutMode = getLayoutMode(renderer.terminalWidth);
const boardSize = getBoardSize(
  renderer.terminalWidth,
  renderer.terminalHeight,
  layoutMode,
);

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
  gap: APP_GAP,
  alignItems: "center",
});

const mainArea = new BoxRenderable(renderer, {
  id: "main",
  width: "auto",
  flexDirection: layoutMode,
  justifyContent: "center",
  alignItems: "center",
  gap: GAP,
});

let boardBox = createBoardBox(boardSize);
const panelBox = createPanelBox(boardSize, layoutMode);

const titleText = new TextRenderable(renderer, {
  content: "Snake",
});

const scoreText = new TextRenderable(renderer, {
  content: "",
});

const statusText = new TextRenderable(renderer, {
  content: "",
});

const controlsBar = new BoxRenderable(renderer, {
  width: getGroupWidth(layoutMode, boardSize),
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

panelBox.add(titleText);
panelBox.add(scoreText);
panelBox.add(statusText);
dialogBox.add(dialogText);
dialogOverlay.add(dialogBox);

mainArea.add(boardBox);
mainArea.add(panelBox);
controlsBar.add(controlsText);

gameGroup.add(mainArea);
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
      width: boardSize.width,
      height: boardSize.height,
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

function getLayoutMode(terminalWidth: number): "row" | "column" {
  return terminalWidth < LAYOUT_BREAKPOINT ? "column" : "row";
}

function getBoardSize(
  terminalWidth: number,
  terminalHeight: number,
  layout: "row" | "column",
) {
  const availableWidth =
    layout === "row"
      ? terminalWidth - ROOT_PADDING * 2 - PANEL_WIDTH - GAP - 2
      : terminalWidth - ROOT_PADDING * 2 - 2;
  const availableHeight =
    layout === "row"
      ? terminalHeight - ROOT_PADDING * 2 - CONTROLS_HEIGHT - APP_GAP - 2
      : terminalHeight -
        ROOT_PADDING * 2 -
        PANEL_HEIGHT -
        GAP -
        CONTROLS_HEIGHT -
        APP_GAP -
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
    panelHeight:
      layout === "row"
        ? pixelHeight
        : Math.max(
            6,
            Math.min(
              PANEL_HEIGHT,
              terminalHeight -
                ROOT_PADDING * 2 -
                CONTROLS_HEIGHT -
                APP_GAP -
                pixelHeight -
                GAP -
                2,
            ),
          ),
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

function createPanelBox(
  size: ReturnType<typeof getBoardSize>,
  layout: "row" | "column",
) {
  return new BoxRenderable(renderer, {
    id: "panel",
    width: layout === "row" ? PANEL_WIDTH : size.pixelWidth,
    height: layout === "row" ? size.panelHeight : size.panelHeight,
    border: true,
    borderColor: COLORS.border,
    flexDirection: "column",
    padding: 1,
    gap: 1,
  });
}

function rebuildLayout() {
  const nextLayout = getLayoutMode(renderer.terminalWidth);
  const nextSize = getBoardSize(
    renderer.terminalWidth,
    renderer.terminalHeight,
    nextLayout,
  );

  mainArea.flexDirection = nextLayout;
  controlsBar.width = getGroupWidth(nextLayout, nextSize);

  mainArea.remove("board");
  boardBox.destroyRecursively();
  boardBox = createBoardBox(nextSize);
  mainArea.insertBefore(boardBox, panelBox);

  panelBox.width = nextLayout === "row" ? PANEL_WIDTH : nextSize.pixelWidth;
  panelBox.height = nextLayout === "row" ? nextSize.panelHeight : nextSize.panelHeight;

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

function getGroupWidth(
  layout: "row" | "column",
  size: ReturnType<typeof getBoardSize>,
) {
  return layout === "row"
    ? size.pixelWidth + PANEL_WIDTH + GAP
    : Math.max(size.pixelWidth, PANEL_WIDTH);
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
  } else if (!hasStarted) {
    statusLine = "Ready";
  } else if (nextState.paused) {
    statusLine = "Paused";
  }

  statusText.content = statusLine ? `\n${statusLine}\n` : "";
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
