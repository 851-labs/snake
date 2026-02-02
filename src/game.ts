export type Point = {
  x: number;
  y: number;
};

export type Direction = "up" | "down" | "left" | "right";

export type GameState = {
  width: number;
  height: number;
  snake: Point[];
  direction: Direction;
  nextDirection: Direction;
  food: Point | null;
  score: number;
  gameOver: boolean;
  paused: boolean;
  won: boolean;
};

export type GameOptions = {
  width: number;
  height: number;
  initialLength?: number;
};

export type Rng = () => number;

const DEFAULT_INITIAL_LENGTH = 3;

export function createInitialState(
  options: GameOptions,
  rng: Rng = Math.random,
): GameState {
  const { width, height, initialLength = DEFAULT_INITIAL_LENGTH } = options;
  const startX = Math.floor(width / 2);
  const startY = Math.floor(height / 2);

  const snake: Point[] = [];
  for (let i = 0; i < initialLength; i += 1) {
    snake.push({ x: startX - i, y: startY });
  }

  const direction: Direction = "right";
  const food = placeFood(width, height, snake, rng);

  return {
    width,
    height,
    snake,
    direction,
    nextDirection: direction,
    food,
    score: 0,
    gameOver: false,
    paused: false,
    won: false,
  };
}

export function queueDirection(state: GameState, next: Direction): GameState {
  if (isOpposite(state.direction, next)) {
    return state;
  }

  return {
    ...state,
    nextDirection: next,
  };
}

export function togglePause(state: GameState): GameState {
  if (state.gameOver) {
    return state;
  }

  return {
    ...state,
    paused: !state.paused,
  };
}

export function tick(state: GameState, rng: Rng = Math.random): GameState {
  if (state.gameOver || state.paused) {
    return state;
  }

  const direction = state.nextDirection;
  const head = state.snake[0];
  const nextHead = move(head, direction);
  const willEat = state.food !== null && pointsEqual(nextHead, state.food);
  const hitsWall = isOutOfBounds(nextHead, state.width, state.height);

  if (hitsWall || hitsSelf(nextHead, state.snake, willEat)) {
    return {
      ...state,
      direction,
      gameOver: true,
      paused: false,
    };
  }

  let nextSnake: Point[];
  let nextFood = state.food;
  let nextScore = state.score;
  let won = state.won;

  if (willEat) {
    nextSnake = [nextHead, ...state.snake];
    nextScore += 1;
    nextFood = placeFood(state.width, state.height, nextSnake, rng);
    if (nextFood === null) {
      won = true;
    }
  } else {
    nextSnake = [nextHead, ...state.snake.slice(0, -1)];
  }

  return {
    ...state,
    snake: nextSnake,
    direction,
    nextDirection: direction,
    food: nextFood,
    score: nextScore,
    won,
    gameOver: won ? true : state.gameOver,
  };
}

export function placeFood(
  width: number,
  height: number,
  snake: Point[],
  rng: Rng,
): Point | null {
  const occupied = new Set(snake.map((segment) => `${segment.x},${segment.y}`));
  const empty: Point[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!occupied.has(`${x},${y}`)) {
        empty.push({ x, y });
      }
    }
  }

  if (empty.length === 0) {
    return null;
  }

  const index = Math.floor(rng() * empty.length);
  return empty[Math.max(0, Math.min(index, empty.length - 1))];
}

function move(point: Point, direction: Direction): Point {
  switch (direction) {
    case "up":
      return { x: point.x, y: point.y - 1 };
    case "down":
      return { x: point.x, y: point.y + 1 };
    case "left":
      return { x: point.x - 1, y: point.y };
    case "right":
    default:
      return { x: point.x + 1, y: point.y };
  }
}

function hitsSelf(nextHead: Point, snake: Point[], willEat: boolean): boolean {
  const body = willEat ? snake : snake.slice(0, -1);
  return body.some((segment) => pointsEqual(segment, nextHead));
}

function isOutOfBounds(point: Point, width: number, height: number): boolean {
  return point.x < 0 || point.y < 0 || point.x >= width || point.y >= height;
}

function isOpposite(a: Direction, b: Direction): boolean {
  return (
    (a === "up" && b === "down") ||
    (a === "down" && b === "up") ||
    (a === "left" && b === "right") ||
    (a === "right" && b === "left")
  );
}

function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}
