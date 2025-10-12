"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from '../components/ui/badge'
import { RotateCcw, Trophy, Target, Zap, Undo2 } from "lucide-react"

// Color palette for the game
// const COLORS = [
//   "#FF6B6B", // Red
//   "#4ECDC4", // Teal
//   "#45B7D1", // Blue
//   "#96CEB4", // Green
//   "#FFEAA7", // Yellow
//   "#DDA0DD", // Plum
// ]

// Color palette for the game
const COLORS = [
   "#9CA3AF", // Gray
  "#93C5FD", // Sky Blue
  "#86EFAC", // Soft Green
  "#FCD34D", // Muted Yellow
  "#FCA5A5", // Warm Salmon
  "#C4B5FD", // Light Purple
]

// Color palette for the game
// const COLORS = [
//    "#FFADAD", // Soft Red
//   "#FFD6A5", // Peach
//   "#FDFFB6", // Pale Yellow
//   "#CAFFBF", // Light Green
//   "#A0C4FF", // Light Blue
//   "#BDB2FF", // Soft Purple
// ]

// const COLOR_NAMES = ["Red", "Teal", "Blue", "Green", "Yellow", "Plum"]

const COLOR_NAMES = ["Gray", "Sky Blue", "Soft Green", "Muted Yellow", " Warm Salmon", "Light Purple"]

const DIRECTIONS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

// safe deep clone (uses structuredClone if available)
const deepClone = (v) => (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v)))

/* Memoized cell to reduce re-renders */
const Cell = React.memo(function Cell({ color }) {
  return (
    <div
      className="w-full aspect-square rounded-sm border border-gray-200 transition-colors"
      style={{ backgroundColor: COLORS[color] }}
      aria-hidden
    />
  )
})

export default function FloodGame() {
  const [gameState, setGameState] = useState({
    grid: [],
    moves: 0,
    targetMoves: 0,
    isComplete: false,
    gridSize: 12,
    colorCount: 6,
    isInitialized: false,
  })

  const [gameHistory, setGameHistory] = useState([])
  const [showStrategy, setShowStrategy] = useState(false)

  // Generate a random grid
  const generateGrid = useCallback((size, colors) => {
    const grid = Array.from({ length: size }, () => Array(size).fill(0))
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        grid[i][j] = Math.floor(Math.random() * colors)
      }
    }
    return grid
  }, [])

  // Calculate target moves (approximate heuristic)
  const calculateTargetMoves = useCallback((size, colors) => {
    return Math.max(1, Math.ceil((size * size * 0.8) / (colors * 2)) + Math.floor(size / 3))
  }, [])

  // Initialize new game
  const newGame = useCallback(
    (size = 8, colors = 4) => {
      const safeColors = Math.max(2, Math.min(colors, COLORS.length))
      const safeSize = Math.max(2, size)
      const grid = generateGrid(safeSize, safeColors)
      const targetMoves = calculateTargetMoves(safeSize, safeColors)

      setGameState({
        grid,
        moves: 0,
        targetMoves,
        isComplete: false,
        gridSize: safeSize,
        colorCount: safeColors,
        isInitialized: true,
      })
      setGameHistory([deepClone(grid)])
    },
    [generateGrid, calculateTargetMoves],
  )

  // Flood fill algorithm (BFS with head index, no .shift())
  const floodFill = useCallback((grid, startColor, newColor) => {
    if (!grid || !grid.length || startColor === newColor) return grid
    const size = grid.length
    const newGrid = grid.map((r) => r.slice())
    const visited = Array.from({ length: size }, () => Array(size).fill(false))

    const queue = [[0, 0]]
    let qi = 0
    visited[0][0] = true

    while (qi < queue.length) {
      const [x, y] = queue[qi++]
      newGrid[x][y] = newColor

      for (const [dx, dy] of DIRECTIONS) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < size && ny >= 0 && ny < size && !visited[nx][ny] && grid[nx][ny] === startColor) {
          visited[nx][ny] = true
          queue.push([nx, ny])
        }
      }
    }

    return newGrid
  }, [])

  // Check if grid is all one color
  const checkComplete = useCallback((grid) => {
    if (!grid?.length) return false
    const first = grid[0][0]
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] !== first) return false
      }
    }
    return true
  }, [])

  // Get connected region size starting from 0,0 (BFS)
  const getConnectedSize = useCallback((grid) => {
    if (!grid?.length) return 0
    const size = grid.length
    const startColor = grid[0][0]
    const visited = Array.from({ length: size }, () => Array(size).fill(false))
    const queue = [[0, 0]]
    let qi = 0
    visited[0][0] = true
    let count = 1

    while (qi < queue.length) {
      const [x, y] = queue[qi++]
      for (const [dx, dy] of DIRECTIONS) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < size && ny >= 0 && ny < size && !visited[nx][ny] && grid[nx][ny] === startColor) {
          visited[nx][ny] = true
          queue.push([nx, ny])
          count++
        }
      }
    }
    return count
  }, [])

  // Calculate potential gains (delta) for each color — memoized below
  const calculatePotentialGains = useCallback(
    (grid, colorCount) => {
      if (!grid?.length) return new Array(colorCount).fill(0)
      const gains = new Array(colorCount).fill(0)
      const currentColor = grid[0][0]
      const currentSize = getConnectedSize(grid)

      for (let color = 0; color < colorCount; color++) {
        if (color === currentColor) continue
        const testGrid = floodFill(grid, currentColor, color)
        const newSize = getConnectedSize(testGrid)
        gains[color] = Math.max(0, newSize - currentSize) // delta
      }
      return gains
    },
    [floodFill, getConnectedSize],
  )

  // Initialize game once on mount
  useEffect(() => {
    newGame()
  }, [newGame])

  // selectColor uses functional setState to avoid stale state capture
  const selectColor = useCallback(
    (colorIndex) => {
      setGameState((prev) => {
        if (prev.isComplete || !prev.isInitialized || !prev.grid?.length) return prev
        const currentColor = prev.grid[0][0]
        if (currentColor === colorIndex) return prev

        const newGrid = floodFill(prev.grid, currentColor, colorIndex)
        const isComplete = checkComplete(newGrid)
        const newMoves = prev.moves + 1

        // Update history outside of returning state
        setGameHistory((h) => [...h, deepClone(newGrid)])

        return {
          ...prev,
          grid: newGrid,
          moves: newMoves,
          isComplete,
        }
      })
    },
    [floodFill, checkComplete],
  )

  // Undo last move (optional helper)
  const undo = useCallback(() => {
    setGameHistory((h) => {
      if (h.length <= 1) return h
      const newHistory = h.slice(0, -1)
      const lastGrid = deepClone(newHistory[newHistory.length - 1])
      setGameState((prev) => ({
        ...prev,
        grid: lastGrid,
        moves: Math.max(0, prev.moves - 1),
        isComplete: checkComplete(lastGrid),
      }))
      return newHistory
    })
  }, [checkComplete])

  // Derived values memoized for performance
  const currentConnectedSize = useMemo(() => getConnectedSize(gameState.grid), [gameState.grid, getConnectedSize])

  const potentialGains = useMemo(
    () => calculatePotentialGains(gameState.grid, gameState.colorCount),
    [gameState.grid, gameState.colorCount, calculatePotentialGains],
  )

  const bestMove = useMemo(() => {
    if (!potentialGains || potentialGains.length === 0) return -1
    const max = Math.max(...potentialGains)
    return max > 0 ? potentialGains.indexOf(max) : -1
  }, [potentialGains])

  // Early return if not initialized (keeps UI consistent)
  if (!gameState.isInitialized || !gameState.grid?.length) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-lg">Initializing game...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-blue-500" />
            Flood Puzzle Game - Complete Demo
            {/* Game Statistics */}
      {gameState.isComplete && (
        <div className='w-[50%] '>
          <div>
            <div className="flex items-center gap-2 pl-4">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Game Complete!
            </div>
          </div>
          {/* <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{gameState.moves}</div>
                <div className="text-sm text-gray-600">Moves Used</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{gameState.targetMoves}</div>
                <div className="text-sm text-gray-600">Target Moves</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {gameState.moves > 0 ? Math.round((gameState.targetMoves / gameState.moves) * 100) : 100}%
                </div>
                <div className="text-sm text-gray-600">Efficiency</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {gameState.gridSize}×{gameState.gridSize}
                </div>
                <div className="text-sm text-gray-600">Grid Size</div>
              </div>
            </div>
          </CardContent> */}
        </div>
      )} 
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4">
              <Badge variant="outline" className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                Moves: {gameState.moves}/{gameState.targetMoves}
              </Badge>
              <Badge variant="outline">
                Connected: {currentConnectedSize}/{gameState.gridSize * gameState.gridSize}
              </Badge>
              {gameState.isComplete && (
                <Badge className="bg-green-500 flex items-center gap-1">
                  <Trophy className="h-4 w-4" />
                  Complete!
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowStrategy((s) => !s)} variant="outline">
                {showStrategy ? "Hide" : "Show"} Strategy
              </Button>
              <Button onClick={() => newGame()} className="flex items-center gap-1" variant='outline'>
                <RotateCcw className="h-4 w-4" />
                New Game
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
        {/* Game Board */}
        <Card>
          <CardHeader>
            <CardTitle>Game Board</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Grid container */}
              <div
                className="grid gap-1 mx-auto"
                style={{
                  gridTemplateColumns: `repeat(${gameState.gridSize}, minmax(0, 1fr))`,
                  width: "min(90vw, 500px)",
                }}
              >
                {gameState.grid.map((row, i) =>
                  row.map((cell, j) => <Cell key={`${i}-${j}`} color={cell} />),
                )}
              </div>

              {/* Color Palette */}
              <div className="space-y-2">
                <h3 className="font-semibold">Select Color:</h3>
                <div className="flex gap-2 justify-center">
                  {COLORS.slice(0, gameState.colorCount).map((color, index) => (
                    <Button
                      key={index}
                      onClick={() => selectColor(index)}
                      className="w-12 h-12 rounded-lg border-2 border-gray-300 hover:border-gray-500 transition-all relative"
                      style={{ backgroundColor: color }}
                      disabled={gameState.grid[0][0] === index || gameState.isComplete}
                      aria-label={`${COLOR_NAMES[index]} - Potential gain: ${potentialGains[index]} cells`}
                      title={`${COLOR_NAMES[index]} - Potential gain: ${potentialGains[index]} cells`}
                    >
                      {showStrategy && potentialGains[index] > 0 && (
                        <span className="text-white font-bold text-xs bg-black bg-opacity-50 rounded px-1">
                          +{potentialGains[index]}
                        </span>
                      )}
                      {showStrategy && index === bestMove && potentialGains[index] > 0 && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border border-yellow-600" />
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Strategy & Rules */}
        <Card>
          <CardHeader>
            <CardTitle>Rules & Strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2 text-left ml-8">How to Play:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-left ml-12">
                <li>Start with the top-left corner (your controlled region)</li>
                <li>Click a color to flood your region with that color</li>
                <li>Your region expands to include adjacent cells of the chosen color</li>
                <li>Goal: Make the entire grid the same color</li>
                <li>Complete within the target moves for best score</li>
              </ol>
            </div>

            {showStrategy && (
              <div>
                <h3 className="font-semibold mb-2 text-left ml-8">Strategy Tips:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-left ml-12">
                  <li>
                    <strong>Maximize Growth:</strong> Choose colors that add the most cells
                  </li>
                  <li>
                    <strong>Plan Ahead:</strong> Consider which colors will be accessible next
                  </li>
                  <li>
                    <strong>Corner Strategy:</strong> Work towards corners and edges
                  </li>
                  <li>
                    <strong>Color Frequency:</strong> Target colors that appear frequently
                  </li>
                  <li>
                    <strong>Avoid Isolation:</strong> {"Don't"} create isolated regions
                  </li>
                </ul>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-sm">Current Analysis:</h4>
                  <p className="text-sm">
                    Best move:{" "}
                    <span className="font-semibold" style={{ color: bestMove >= 0 ? COLORS[bestMove] : "inherit" }}>
                      {bestMove >= 0 ? COLOR_NAMES[bestMove] : "—"}
                    </span>{" "}
                    {bestMove >= 0 && `(+${potentialGains[bestMove]} cells)`}
                  </p>
                  <p className="text-sm">
                    Progress: {Math.round((currentConnectedSize / (gameState.gridSize * gameState.gridSize)) * 100)}% complete
                  </p>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-2">Game Variations:</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => newGame(8, 4)} variant="outline" size="sm">
                  Easy (8×8, 4 colors)
                </Button>
                <Button onClick={() => newGame(12, 6)} variant="outline" size="sm">
                  Normal (12×12, 6 colors)
                </Button>
                <Button onClick={() => newGame(16, 6)} variant="outline" size="sm">
                  Hard (16×16, 6 colors)
                </Button>
                <Button onClick={() => newGame(20, 8)} variant="outline" size="sm">
                  Expert (20×20, 8 colors)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Features */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Game Mechanics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Scoring System:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>
                  <strong>Perfect:</strong> Complete within target moves
                </li>
                <li>
                  <strong>Good:</strong> Complete within 120% of target
                </li>
                <li>
                  <strong>Fair:</strong> Complete within 150% of target
                </li>
                <li>
                  <strong>Poor:</strong> Exceeds 150% of target moves
                </li>
              </ul>

              <div className="mt-3 p-2 bg-gray-50 rounded">
                <p className="text-sm">
                  <strong>Current Status:</strong>{" "}
                  {gameState.isComplete
                    ? gameState.moves <= gameState.targetMoves
                      ? "Perfect! 🏆"
                      : gameState.moves <= gameState.targetMoves * 1.2
                        ? "Good! 👍"
                        : gameState.moves <= gameState.targetMoves * 1.5
                          ? "Fair 👌"
                          : "Keep trying! 💪"
                    : `In progress... (${Math.round((currentConnectedSize / (gameState.gridSize * gameState.gridSize)) * 100)}%)`}
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Algorithm Details:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>
                  <strong>Flood Fill:</strong> Breadth-first search from origin
                </li>
                <li>
                  <strong>Connected Component:</strong> Only adjacent cells (4-way)
                </li>
                <li>
                  <strong>Target Calculation:</strong> Based on grid size and color count
                </li>
                <li>
                  <strong>Optimization:</strong> Greedy approach often works well
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
