/**
 * Maze generation using recursive backtracking.
 * Returns a 2D grid where:
 *   0 = wall
 *   1 = path
 *   2 = start
 *   3 = goal
 */

export function generateMaze(cols, rows) {
  // Grid is (2*cols+1) x (2*rows+1) to include walls between cells
  const w = 2 * cols + 1;
  const h = 2 * rows + 1;
  const grid = Array.from({ length: h }, () => Array(w).fill(0));

  // Each cell in the logical grid is at (2*x+1, 2*y+1)
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));

  const directions = [
    [0, -1], // up
    [0, 1],  // down
    [-1, 0], // left
    [1, 0],  // right
  ];

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function carve(cx, cy) {
    visited[cy][cx] = true;
    grid[2 * cy + 1][2 * cx + 1] = 1;

    const dirs = shuffle([...directions]);
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny][nx]) {
        // Remove wall between current and next
        grid[2 * cy + 1 + dy][2 * cx + 1 + dx] = 1;
        carve(nx, ny);
      }
    }
  }

  carve(0, 0);

  // Set start (top-left) and goal (bottom-right)
  grid[1][1] = 2; // start
  grid[h - 2][w - 2] = 3; // goal

  // Add some extra openings to create multiple paths (and dead ends remain)
  const extraOpenings = Math.floor(cols * rows * 0.08);
  for (let i = 0; i < extraOpenings; i++) {
    const rx = Math.floor(Math.random() * (w - 2)) + 1;
    const ry = Math.floor(Math.random() * (h - 2)) + 1;
    if (grid[ry][rx] === 0) {
      // Only open if it connects two path cells
      let adjPaths = 0;
      if (ry > 0 && grid[ry - 1][rx] === 1) adjPaths++;
      if (ry < h - 1 && grid[ry + 1][rx] === 1) adjPaths++;
      if (rx > 0 && grid[ry][rx - 1] === 1) adjPaths++;
      if (rx < w - 1 && grid[ry][rx + 1] === 1) adjPaths++;
      if (adjPaths >= 2) {
        grid[ry][rx] = 1;
      }
    }
  }

  return grid;
}

/**
 * Find a valid path position for placing items.
 * Returns {gridX, gridY} of a random path cell that isn't start or goal.
 */
export function findRandomPathCell(grid) {
  const pathCells = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      if (grid[y][x] === 1) {
        pathCells.push({ x, y });
      }
    }
  }
  if (pathCells.length === 0) return null;
  return pathCells[Math.floor(Math.random() * pathCells.length)];
}

/**
 * Find path cells that are far from start for placing items deeper in maze.
 */
export function findDeepPathCell(grid) {
  const h = grid.length;
  const w = grid[0].length;

  // BFS from start to find distances
  const dist = Array.from({ length: h }, () => Array(w).fill(-1));
  const queue = [{ x: 1, y: 1 }];
  dist[1][1] = 0;

  while (queue.length > 0) {
    const { x, y } = queue.shift();
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (ny >= 0 && ny < h && nx >= 0 && nx < w && dist[ny][nx] === -1 && grid[ny][nx] >= 1) {
        dist[ny][nx] = dist[y][x] + 1;
        queue.push({ x: nx, y: ny });
      }
    }
  }

  // Find cells in the middle distance range (not too close, not at goal)
  let maxDist = 0;
  const candidates = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (dist[y][x] > maxDist) maxDist = dist[y][x];
    }
  }

  const minD = Math.floor(maxDist * 0.3);
  const maxD = Math.floor(maxDist * 0.7);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] === 1 && dist[y][x] >= minD && dist[y][x] <= maxD) {
        candidates.push({ x, y });
      }
    }
  }

  if (candidates.length === 0) return findRandomPathCell(grid);
  return candidates[Math.floor(Math.random() * candidates.length)];
}
