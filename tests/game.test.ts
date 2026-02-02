import { expect, test } from "bun:test";
import {
  createInitialState,
  placeFood,
  queueDirection,
  tick,
  type GameState,
} from "../src/game";

function makeRng(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function withState(overrides: Partial<GameState>): GameState {
  return {
    width: 5,
    height: 5,
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    direction: "right",
    nextDirection: "right",
    food: { x: 4, y: 4 },
    score: 0,
    gameOver: false,
    paused: false,
    won: false,
    ...overrides,
  };
}

test("tick moves the snake forward", () => {
  const state = withState({ food: { x: 4, y: 4 } });
  const next = tick(state, makeRng());

  expect(next.snake[0]).toEqual({ x: 3, y: 2 });
  expect(next.snake.length).toBe(3);
});

test("tick grows the snake when eating", () => {
  const state = withState({ food: { x: 3, y: 2 } });
  const next = tick(state, makeRng(7));

  expect(next.snake.length).toBe(4);
  expect(next.score).toBe(1);
  expect(next.food).not.toBeNull();
  expect(next.food).not.toEqual({ x: 2, y: 2 });
});

test("tick ends the game on wall collision", () => {
  const state = withState({
    snake: [{ x: 4, y: 0 }, { x: 3, y: 0 }, { x: 2, y: 0 }],
    direction: "right",
    nextDirection: "right",
  });

  const next = tick(state, makeRng());
  expect(next.gameOver).toBe(true);
});

test("tick ends the game on self collision", () => {
  const state = withState({
    snake: [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 2 },
    ],
    direction: "right",
    nextDirection: "right",
  });

  const next = tick(state, makeRng());
  expect(next.gameOver).toBe(true);
});

test("queueDirection blocks immediate reversal", () => {
  const state = withState({ direction: "right", nextDirection: "right" });
  const blocked = queueDirection(state, "left");
  expect(blocked.nextDirection).toBe("right");
});

test("placeFood avoids the snake", () => {
  const snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ];

  const food = placeFood(4, 4, snake, makeRng(9));
  expect(food).not.toBeNull();
  expect(snake.some((segment) => segment.x === food!.x && segment.y === food!.y)).toBe(
    false,
  );
});

test("createInitialState sets up the board", () => {
  const rng = makeRng(3);
  const state = createInitialState({ width: 6, height: 6 }, rng);

  expect(state.snake.length).toBe(3);
  expect(state.food).not.toBeNull();
});
