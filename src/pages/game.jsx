import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { RotateCcw, Trophy, Target, Zap, Undo2, Moon, Sun } from "lucide-react";

// --------- Constants & Defaults ----------
const COLORS = [
  "#9CA3AF", // Gray
  "#93C5FD", // Sky Blue
  "#86EFAC", // Soft Green
  "#FCD34D", // Muted Yellow
  "#FCA5A5", // Warm Salmon
  "#C4B5FD", // Light Purple
];

const COLOR_NAMES = [
  "Gray",
  "Sky Blue",
  "Soft Green",
  "Muted Yellow",
  "Warm Salmon",
  "Light Purple",
];

// const COLORS = [
//   "#E74C3C", // Red
//   "#F1C40F", // Yellow
//   "#2ECC71", // Green
//   "#3498DB", // Blue
//   "#9B59B6", // Purple
//   "#E67E22", // Orange
//   "#1ABC9C", // Teal
//   "#E84393", // Pink
// ];

// const COLOR_NAMES = [
//   "Red",
//   "Yellow",
//   "Green",
//   "Blue",
//   "Purple",
//   "Orange",
//   "Teal",
//   "Pink",
// ];

const DIRECTIONS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const DEFAULT_SIZE = 8;
const DEFAULT_COLORS = 4;
const UNDO_LIMIT = 10;

const deepClone = (v) =>
  typeof structuredClone === "function"
    ? structuredClone(v)
    : JSON.parse(JSON.stringify(v));

// --------- Cell component (memoized w/ comparator) ----------
const Cell = React.memo(
  function Cell({ color, controlled, animating }) {
    // Tailwind classes: smoothly transition color, slight hover scale for feedback
    return (
      <div
        className={`tile w-full aspect-square rounded-sm border border-gray-300 dark:border-gray-700 hover:border-gray-500 transition-all duration-200
          ${controlled ? "ring-2 ring-offset-1 ring-blue-300 dark:ring-blue-500 scale-105" : "scale-100"}
          ${animating ? "animating" : ""}
        `}
        style={{ backgroundColor: COLORS[color] }}
        aria-hidden
      />
    );
  },
  (prev, next) =>
    prev.color === next.color && prev.controlled === next.controlled
);

// --------- Helpers ----------
const generateGrid = (size, colors) => {
  const grid = Array.from({ length: size }, () => Array(size).fill(0));
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      grid[i][j] = Math.floor(Math.random() * colors);
    }
  }
  return grid;
};

// A more realistic target heuristic
const calculateTargetMoves = (size, colors) => {
  // baseline based on size + small penalty for fewer colors
  return Math.max(1, Math.floor(0.8 * size + colors * 1.5));
};

// get connected region visited matrix, connected size, and boundary components sizes by color
const getConnectedRegionInfo = (grid) => {
  if (!grid?.length)
    return { visited: [], connectedSize: 0, boundaryColorCounts: [] };
  const size = grid.length;
  const visited = Array.from({ length: size }, () => Array(size).fill(false));
  const startColor = grid[0][0];
  const queue = [[0, 0]];
  let qi = 0;
  visited[0][0] = true;
  let connectedSize = 1;

  while (qi < queue.length) {
    const [x, y] = queue[qi++];
    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (
        nx >= 0 &&
        nx < size &&
        ny >= 0 &&
        ny < size &&
        !visited[nx][ny] &&
        grid[nx][ny] === startColor
      ) {
        visited[nx][ny] = true;
        queue.push([nx, ny]);
        connectedSize++;
      }
    }
  }

  // To compute immediate potential gains: find adjacent components of each color and sum their sizes (without recounting)
  const componentVisited = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  const boundaryColorCounts = {};

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (!visited[i][j]) continue;
      for (const [dx, dy] of DIRECTIONS) {
        const nx = i + dx;
        const ny = j + dy;
        if (
          nx >= 0 &&
          nx < size &&
          ny >= 0 &&
          ny < size &&
          !visited[nx][ny] &&
          !componentVisited[nx][ny]
        ) {
          // Found a neighbor not in connected region. Flood-fill its component (bounded)
          const compColor = grid[nx][ny];
          // BFS for component
          const q = [[nx, ny]];
          let qidx = 0;
          componentVisited[nx][ny] = true;
          let compSize = 0;
          while (qidx < q.length) {
            const [cx, cy] = q[qidx++];
            compSize++;
            for (const [ddx, ddy] of DIRECTIONS) {
              const mx = cx + ddx;
              const my = cy + ddy;
              if (
                mx >= 0 &&
                mx < size &&
                my >= 0 &&
                my < size &&
                !visited[mx][my] &&
                !componentVisited[mx][my] &&
                grid[mx][my] === compColor
              ) {
                componentVisited[mx][my] = true;
                q.push([mx, my]);
              }
            }
          }
          boundaryColorCounts[compColor] =
            (boundaryColorCounts[compColor] || 0) + compSize;
        }
      }
    }
  }

  return { visited, connectedSize, boundaryColorCounts };
};

// --------- Main component ----------
export default function FloodGame() {
  const [gameState, setGameState] = useState({
    grid: [],
    moves: 0,
    targetMoves: 0,
    isComplete: false,
    gridSize: DEFAULT_SIZE,
    colorCount: DEFAULT_COLORS,
    isInitialized: false,
  });

  const [gameHistory, setGameHistory] = useState([]);
  const [showStrategy, setShowStrategy] = useState(false);

  // Animation state for cell transitions
  const [animatingCells, setAnimatingCells] = useState(new Set());
  const [isAnimating, setIsAnimating] = useState(false);

  // Dark Mode for the page 
  const [darkMode, setDarkMode] = useState(false);

  // Dark mode on/off
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [darkMode]);

  // localStorage keys for best score persistence
  const getBestScoreKey = (size, colors) => `flood_best_${size}x${size}_${colors}`;

  // Initialize a new game
  const newGame = useCallback(
    (size = DEFAULT_SIZE, colors = DEFAULT_COLORS) => {
      const safeColors = Math.max(2, Math.min(colors, COLORS.length));
      const safeSize = Math.max(2, size);
      const grid = generateGrid(safeSize, safeColors);
      const targetMoves = calculateTargetMoves(safeSize, safeColors);
      setGameState({
        grid,
        moves: 0,
        targetMoves,
        isComplete: false,
        gridSize: safeSize,
        colorCount: safeColors,
        isInitialized: true,
      });
      setGameHistory([deepClone(grid)]);
    },
    []
  );

  // On mount: start a default game
  useEffect(() => {
    newGame(DEFAULT_SIZE, DEFAULT_COLORS);
  }, [newGame]);

  // Select color (user action)
  const selectColor = useCallback(  (colorIndex) => {
    setGameState((prev) => {
      if (prev.isComplete || !prev.isInitialized || !prev.grid?.length)
        return prev;
      const currentColor = prev.grid[0][0];
      if (currentColor === colorIndex) return prev;

      // await 
      animatedFloodFill(prev.grid, currentColor, colorIndex);
      const newGrid = deepClone(prev.grid);
      const newMoves = prev.moves + 1;

      // push to history (limit)
      setGameHistory((h) => {
        const next = [...h, deepClone(newGrid)];
        if (next.length > UNDO_LIMIT) next.splice(0, next.length - UNDO_LIMIT);
        return next;
      });

      return {
        ...prev,
        moves: newMoves,
      };
    });
  }, []);

  // Animated cells effect

 const animatedFloodFill = useCallback(async (grid, startColor, newColor) => {
  if (startColor === newColor) return grid;

  const size = grid.length;
  const newGrid = grid.map(row => row.slice());
  const visited = Array.from({ length: size }, () => Array(size).fill(false));
  const queue = [[0, 0]];
  visited[0][0] = true;

  const animationQueue = [];

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    animationQueue.push([x, y]);

    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (
        nx >= 0 && nx < size &&
        ny >= 0 && ny < size &&
        !visited[nx][ny] &&
        grid[nx][ny] === startColor
      ) {
        visited[nx][ny] = true;
        queue.push([nx, ny]);
      }
    }
  }

  // ---- Animation batching ----
  const totalCells = animationQueue.length;
  const BATCH_SIZE = Math.max(4, Math.ceil(totalCells / 10)); // adaptive batching
  const MIN_DELAY = 60; // ms - ensures even small floods show animation
  const delayPerBatch = Math.max(MIN_DELAY / Math.ceil(totalCells / BATCH_SIZE), 12);

  setIsAnimating(true);

  // ---- Animation batching loop (same as before) ----
for (let i = 0; i < animationQueue.length; i += BATCH_SIZE) {
  const batch = animationQueue.slice(i, i + BATCH_SIZE);

  setAnimatingCells(new Set(batch.map(([x, y]) => `${x}-${y}`)));
  await new Promise(requestAnimationFrame);

  setGameState(prev => {
    const gridCopy = prev.grid.map(r => r.slice());
    batch.forEach(([x, y]) => (gridCopy[x][y] = newColor));
    return { ...prev, grid: gridCopy };
  });

  await new Promise(r => setTimeout(r, delayPerBatch));
}

// After last batch, wait one more frame before cleanup
await new Promise(requestAnimationFrame);
await new Promise(r => setTimeout(r, 100));

setAnimatingCells(new Set());
setIsAnimating(false);

// Check completion only AFTER cleanup to ensure visuals finished
setTimeout(() => {
  setGameState(prev => {
    const { connectedSize } = getConnectedRegionInfo(prev.grid);
    const isComplete = connectedSize === prev.grid.length * prev.grid.length;
    if (isComplete && !prev.isComplete) console.log("✅ Game Completed!");
    return { ...prev, isComplete };
  });
}, 150);

  // After final frame, check completion
  setTimeout(() => {
    setGameState((prev) => {
      const { connectedSize } = getConnectedRegionInfo(prev.grid);
      const isComplete = connectedSize === prev.grid.length * prev.grid.length;
      // if (isComplete && !prev.isComplete) {
      //   console.log("Game Completed!");
      // }
      return { ...prev, isComplete };
    });
  }, 100); // tiny delay to ensure React updates have settled

  return newGrid;
}, []);


  // Undo
  const undo = useCallback(() => {
    setGameHistory((h) => {
      if (h.length <= 1) return h;
      const newHistory = h.slice(0, -1);
      const lastGrid = deepClone(newHistory[newHistory.length - 1]);
      setGameState((prev) => ({
        ...prev,
        grid: lastGrid,
        moves: Math.max(0, prev.moves - 1),
        isComplete: (() => {
          const { connectedSize } = getConnectedRegionInfo(lastGrid);
          return connectedSize === lastGrid.length * lastGrid.length;
        })(),
      }));
      return newHistory;
    });
  }, []);

  // Reset game (keeps current grid size & colors)
  const resetGame = useCallback(() => {
    setGameState((prev) => {
      const grid = generateGrid(prev.gridSize, prev.colorCount);
      const targetMoves = calculateTargetMoves(prev.gridSize, prev.colorCount);
      setGameHistory([deepClone(grid)]);
      return {
        grid,
        moves: 0,
        targetMoves,
        isComplete: false,
        gridSize: prev.gridSize,
        colorCount: prev.colorCount,
        isInitialized: true,
      };
    });
  }, []);

  // Derived & memoized values
  const connectedInfo = useMemo(
    () => getConnectedRegionInfo(gameState.grid),
    [gameState.grid]
  );
  const currentConnectedSize = connectedInfo.connectedSize || 0;

  const potentialGains = useMemo(() => {
    if (!gameState.grid?.length) return new Array(gameState.colorCount).fill(0);
    const gains = new Array(gameState.colorCount).fill(0);
    if (!connectedInfo.boundaryColorCounts) return gains;
    for (let c = 0; c < gameState.colorCount; c++) {
      gains[c] = connectedInfo.boundaryColorCounts[c] || 0;
    }
    // Gains are immediate neighbor-component sizes. Could be extended later.
    return gains;
  }, [gameState.grid, gameState.colorCount, connectedInfo]);

  const bestMove = useMemo(() => {
    if (!potentialGains || potentialGains.length === 0) return -1;
    const max = Math.max(...potentialGains);
    return max > 0 ? potentialGains.indexOf(max) : -1;
  }, [potentialGains]);

  // Save best score to localStorage when completing a game
  useEffect(() => {
    if (!gameState.isComplete) return;
    const key = getBestScoreKey(gameState.gridSize, gameState.colorCount);
    const existing = parseInt(localStorage.getItem(key) || "0", 10);
    // lower moves are better
    const currentScore = gameState.moves;
    if (!existing || currentScore < existing || existing === 0) {
      localStorage.setItem(key, String(currentScore));
    }
  }, [
    gameState.isComplete,
    gameState.moves,
    gameState.gridSize,
    gameState.colorCount,
  ]);

  const getBestScore = (size, colors) => {
    const key = getBestScoreKey(size, colors);
    const v = localStorage.getItem(key);
    return v ? parseInt(v, 10) : null;
  };

  // Early return while initializing
  if (!gameState.isInitialized || !gameState.grid?.length) {
    return (
      <div className="max-w-6xl mx-auto p-4 space-y-6 bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 transition-colors duration-300">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-lg">Initializing game...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // UI render
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6 bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 transition-colors duration-300">
      <Card className="bg-white dark:bg-gray-800 dark:border-gray-700 transition-colors duration-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            
            ColorFlow
            {gameState.isComplete && (
              <div className="w-[50%] ">
                <div className="flex items-center gap-2 pl-4">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Game Complete!
                </div>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4">
              <Badge variant="outline" className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                Moves: {gameState.moves}/
                {gameState.targetMoves ||
                  calculateTargetMoves(
                    gameState.gridSize,
                    gameState.colorCount
                  )}
              </Badge>
              <Badge variant="outline">
                Controlled: {currentConnectedSize}/
                {gameState.gridSize * gameState.gridSize}
              </Badge>
              {gameState.isComplete && (
                <Badge className="bg-green-500 flex items-center gap-1">
                  <Trophy className="h-4 w-4" />
                  Complete!
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setDarkMode(!darkMode)}
                variant="outline"
                className="ml-2 flex items-center gap-1"
              >
                {darkMode ? (
                  <div>
                    <Sun className="h-4 w-4 text-yellow-400" /> 
                  </div>
                ) : (
                  <div>
                    <Moon className="h-4 w-4 text-blue-400" />
                  </div>
                )}
              </Button>

              <Button
                onClick={() => setShowStrategy((s) => !s)}
                variant="outline"
              >
                {showStrategy ? "Hide" : "Show"} Strategy
              </Button>
              <Button
                onClick={() => newGame()}
                className="flex items-center gap-1"
                variant="outline"
              >
                <RotateCcw className="h-4 w-4" />
                New Game
              </Button>
              <Button onClick={resetGame} variant="outline" className="ml-2">
                Reset Game
              </Button>
              <Button onClick={undo} variant="outline" className="ml-2">
                <Undo2 className="h-4 w-4" />
                Undo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Board */}
        <Card>
          <CardHeader>
            <CardTitle>Game Board</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div
                className="grid gap-1 mx-auto"
                style={{
                  gridTemplateColumns: `repeat(${gameState.gridSize}, minmax(0, 1fr))`,
                  width: "min(90vw, 500px)",
                }}
              >
                {gameState.grid.map((row, i) =>
                  row.map((cell, j) => {
                    const controlled = !isAnimating && connectedInfo.visited?.[i]?.[j];
                    return (
                      <Cell
                        key={`${i}-${j}`}
                        color={cell}
                        controlled={!isAnimating && connectedInfo.visited?.[i]?.[j]}
                        className="tile flooding"
                        animating={animatingCells.has(`${i}-${j}`)}
                      />
                    );
                  })
                )}
              </div>

              {/* Palette */}
              <div className="space-y-2">
                <h3 className="font-semibold">Select Color:</h3>
                <div className="flex gap-2 justify-center">
                  {COLORS.slice(0, gameState.colorCount).map((color, index) => (
                    <Button
                      key={index}
                      onClick={() => selectColor(index)}
                      className={`w-12 h-12 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-all relative 
                        ${
                          showStrategy &&
                          index === bestMove &&
                          potentialGains[index] > 0
                            ? "ring-4 ring-black ring-opacity-50 active-ring"
                            : ""
                        }`}
                      style={{ backgroundColor: color }}
                      disabled={
                        gameState.grid[0][0] === index || gameState.isComplete
                      }
                      aria-label={`${COLOR_NAMES[index]} - Potential gain: ${
                        potentialGains[index] || 0
                      } cells`}
                      title={`${COLOR_NAMES[index]} - Potential gain: ${
                        potentialGains[index] || 0
                      } cells`}
                    >
                      {showStrategy && potentialGains[index] > 0 && (
                        <span className="text-white font-bold text-xs bg-black bg-opacity-50 rounded px-1">
                          +{potentialGains[index]}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Strategy */}
        <Card>
          <CardHeader>
            <CardTitle>Rules & Strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2 text-left ml-8">
                How to Play:
              </h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-left ml-12">
                <li>Start with the top-left corner (your controlled region)</li>
                <li>Click a color to flood your region with that color</li>
                <li>
                  Your region expands to include adjacent cells of the chosen
                  color
                </li>
                <li>Goal: Make the entire grid the same color</li>
                <li>Complete within the target moves for best score</li>
              </ol>
            </div>

            {showStrategy && (
              <div>
                <h3 className="font-semibold mb-2 text-left ml-8">
                  Strategy Tips:
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-left ml-12">
                  <li>
                    <strong>Maximize Growth:</strong> Choose colors that add the
                    most cells
                  </li>
                  <li>
                    <strong>Plan Ahead:</strong> Consider which colors will be
                    accessible next
                  </li>
                  <li>
                    <strong>Corner Strategy:</strong> Work towards corners and
                    edges
                  </li>
                  <li>
                    <strong>Color Frequency:</strong> Target colors that appear
                    frequently
                  </li>
                  <li>
                    <strong>Avoid Isolation:</strong> {"Don't"} create isolated
                    regions
                  </li>
                </ul>

                <div className="mt-4 p-3 rounded-lg">
                  <h4 className="font-semibold text-sm">Current Analysis:</h4>
                  <p className="text-sm">
                    Best move:{" "}
                    <span
                      className="font-semibold"
                      style={{
                        color: bestMove >= 0 ? COLORS[bestMove] : "inherit",
                      }}
                    >
                      {bestMove >= 0 ? COLOR_NAMES[bestMove] : "—"}
                    </span>{" "}
                    {bestMove >= 0 && `(+${potentialGains[bestMove]} cells)`}
                  </p>
                  <p className="text-sm">
                    Progress:{" "}
                    {Math.round(
                      (currentConnectedSize /
                        (gameState.gridSize * gameState.gridSize)) *
                        100
                    )}
                    % complete
                  </p>
                  <p className="text-sm">
                    Best score (mode):{" "}
                    {getBestScore(gameState.gridSize, gameState.colorCount) ??
                      "—"}
                  </p>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-2">Game Variations:</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => newGame(8, 4)}
                  variant="outline"
                  size="sm"
                >
                  Easy (8×8, 4 colors)
                </Button>
                <Button
                  onClick={() => newGame(12, 6)}
                  variant="outline"
                  size="sm"
                >
                  Normal (12×12, 6 colors)
                </Button>
                <Button
                  onClick={() => newGame(16, 6)}
                  variant="outline"
                  size="sm"
                >
                  Hard (16×16, 6 colors)
                </Button>
                <Button
                  onClick={() => newGame(20, 8)}
                  variant="outline"
                  size="sm"
                >
                  Expert (20×20, 8 colors)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
