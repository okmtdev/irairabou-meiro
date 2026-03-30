import { generateMaze, findDeepPathCell, findRandomPathCell } from './maze.js';

// ============================================================
// Constants & Stage Config
// ============================================================
const STAGE_CONFIG = {
  easy: {
    name: 'かんたん',
    cols: 5,
    rows: 5,
    timeLimit: 60,
    enemies: 0,
    enemySpeed: 0,
    color: '#7bed9f',
    wallColor: '#2ed573',
    emoji: '🌱',
  },
  normal: {
    name: 'ふつう',
    cols: 7,
    rows: 7,
    timeLimit: 60,
    enemies: 2,
    enemySpeed: 1.2,
    color: '#ffa502',
    wallColor: '#e17055',
    emoji: '🌻',
  },
  hard: {
    name: 'むずかしい',
    cols: 9,
    rows: 9,
    timeLimit: 60,
    enemies: 4,
    enemySpeed: 1.8,
    color: '#ff6b81',
    wallColor: '#d63031',
    emoji: '🔥',
  },
  extra: {
    name: 'えくすとら',
    cols: 12,
    rows: 12,
    timeLimit: 60,
    enemies: 7,
    enemySpeed: 2.2,
    color: '#a29bfe',
    wallColor: '#6c5ce7',
    emoji: '⭐',
  },
};

const STAGE_ORDER = ['easy', 'normal', 'hard', 'extra'];

// ============================================================
// Canvas Setup
// ============================================================
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const uiLayer = document.getElementById('ui-layer');

let canvasW, canvasH;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvasW = window.innerWidth;
  canvasH = window.innerHeight;
  canvas.width = canvasW * dpr;
  canvas.height = canvasH * dpr;
  canvas.style.width = canvasW + 'px';
  canvas.style.height = canvasH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ============================================================
// Game State
// ============================================================
let state = 'title'; // title | select | playing | gameover | clear
let currentStage = null;
let maze = null;
let cellSize = 0;
let mazeOffsetX = 0;
let mazeOffsetY = 0;
let player = { x: 0, y: 0 };
let playerTrail = [];
let hearts = 3;
let maxHearts = 3;
let timeLeft = 60;
let timerInterval = null;
let enemies = [];
let apple = null;
let appleCollected = false;
let invincible = false;
let invincibleTimer = null;
let frozen = false; // player cannot move during knockback
let frozenTimer = null;
let mouseDown = false;
let gameStarted = false;

// ============================================================
// Local Storage for clear status
// ============================================================
function getClearStatus() {
  try {
    return JSON.parse(localStorage.getItem('irairabou-clear') || '{}');
  } catch {
    return {};
  }
}

function setClearStatus(stageKey) {
  const status = getClearStatus();
  status[stageKey] = true;
  localStorage.setItem('irairabou-clear', JSON.stringify(status));
}

function isExtraUnlocked() {
  return !!getClearStatus().hard;
}

// ============================================================
// Sound effects (simple oscillator-based)
// ============================================================
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playSound(freq, duration, type = 'square', volume = 0.15) {
  try {
    const ac = getAudioCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration);
  } catch {
    // Audio not available
  }
}

function playDamageSound() {
  playSound(200, 0.3, 'sawtooth', 0.2);
  setTimeout(() => playSound(150, 0.2, 'sawtooth', 0.15), 100);
}

function playClearSound() {
  playSound(523, 0.15, 'square', 0.15);
  setTimeout(() => playSound(659, 0.15, 'square', 0.15), 150);
  setTimeout(() => playSound(784, 0.3, 'square', 0.15), 300);
}

function playGameOverSound() {
  playSound(400, 0.2, 'sawtooth', 0.15);
  setTimeout(() => playSound(300, 0.2, 'sawtooth', 0.15), 200);
  setTimeout(() => playSound(200, 0.4, 'sawtooth', 0.15), 400);
}

function playAppleSound() {
  playSound(880, 0.1, 'sine', 0.15);
  setTimeout(() => playSound(1100, 0.15, 'sine', 0.15), 100);
}

// ============================================================
// Title Screen
// ============================================================
function showTitle() {
  state = 'title';
  stopTimer();
  uiLayer.innerHTML = '';

  const div = document.createElement('div');
  div.className = 'overlay';
  div.style.background = 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)';
  div.innerHTML = `
    <div style="text-align:center;">
      <div style="font-size: 3rem; margin-bottom: 10px;">🐭</div>
      <h1 style="font-size: 2.2rem; color: #e17055; margin-bottom: 8px; text-shadow: 2px 2px 0 #fff;">いらぼうでめいろ</h1>
      <p style="font-size: 1rem; color: #636e72; margin-bottom: 30px;">ねずみをゴールまでつれていこう！</p>
      <button class="btn btn-primary" id="btn-start" style="font-size: 1.4rem; padding: 16px 48px;">あそぶ</button>
    </div>
  `;
  uiLayer.appendChild(div);

  document.getElementById('btn-start').addEventListener('click', () => {
    getAudioCtx(); // unlock audio on user gesture
    showStageSelect();
  });
}

// ============================================================
// Stage Select
// ============================================================
function showStageSelect() {
  state = 'select';
  uiLayer.innerHTML = '';

  const clearStatus = getClearStatus();
  const extraUnlocked = isExtraUnlocked();

  const div = document.createElement('div');
  div.className = 'overlay';
  div.style.background = 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)';

  let stageButtons = '';
  for (const key of STAGE_ORDER) {
    const cfg = STAGE_CONFIG[key];
    const cleared = clearStatus[key];
    const locked = key === 'extra' && !extraUnlocked;

    if (locked) {
      stageButtons += `
        <button class="btn btn-locked" style="display:block; width:100%; margin: 10px 0; font-size:1.3rem; padding: 14px 20px;" disabled>
          🔒 ${cfg.name}
          <span style="font-size:0.8rem; display:block; color:#999;">「むずかしい」をくりあしよう</span>
        </button>`;
    } else {
      const clearMark = cleared ? ' ✅' : '';
      stageButtons += `
        <button class="btn" data-stage="${key}" style="display:block; width:100%; margin: 10px 0; font-size:1.3rem; padding: 14px 20px; background: ${cfg.color}; color: white;">
          ${cfg.emoji} ${cfg.name}${clearMark}
        </button>`;
    }
  }

  div.innerHTML = `
    <div class="dialog" style="min-width: 280px;">
      <h2 style="color: #0984e3;">すてーじをえらぼう</h2>
      ${stageButtons}
      <button class="btn btn-secondary" id="btn-back" style="margin-top: 15px;">もどる</button>
    </div>
  `;
  uiLayer.appendChild(div);

  div.querySelectorAll('[data-stage]').forEach(btn => {
    btn.addEventListener('click', () => {
      startGame(btn.dataset.stage);
    });
  });

  document.getElementById('btn-back').addEventListener('click', showTitle);
}

// ============================================================
// Start Game
// ============================================================
function startGame(stageKey) {
  currentStage = stageKey;
  const cfg = STAGE_CONFIG[stageKey];

  // Generate maze
  maze = generateMaze(cfg.cols, cfg.rows);

  // Reset player
  player = { x: 1, y: 1 }; // start cell in grid coords
  playerTrail = [{ x: 1, y: 1 }];
  hearts = maxHearts;
  timeLeft = cfg.timeLimit;
  invincible = false;
  frozen = false;
  mouseDown = false;
  gameStarted = false;
  appleCollected = false;

  if (invincibleTimer) clearTimeout(invincibleTimer);
  if (frozenTimer) clearTimeout(frozenTimer);

  // Place apple
  const appleCell = findDeepPathCell(maze);
  apple = appleCell ? { x: appleCell.x, y: appleCell.y } : null;

  // Setup enemies
  enemies = [];
  for (let i = 0; i < cfg.enemies; i++) {
    let cell = findRandomPathCell(maze);
    // Make sure enemy isn't on start
    let tries = 0;
    while (cell && (cell.x <= 2 && cell.y <= 2) && tries < 20) {
      cell = findRandomPathCell(maze);
      tries++;
    }
    if (cell) {
      enemies.push({
        x: cell.x,
        y: cell.y,
        dx: 0,
        dy: 0,
        speed: cfg.enemySpeed,
        moveTimer: 0,
        moveInterval: 0.3 + Math.random() * 0.3,
      });
    }
  }

  state = 'playing';
  uiLayer.innerHTML = '';

  startTimer();
  requestAnimationFrame(gameLoop);
}

// ============================================================
// Timer
// ============================================================
function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    if (state !== 'playing') return;
    if (!gameStarted) return;
    timeLeft -= 1;
    if (timeLeft <= 0) {
      timeLeft = 0;
      gameOver();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ============================================================
// Drawing
// ============================================================
function calcMazeMetrics() {
  if (!maze) return;
  const mazeGridW = maze[0].length;
  const mazeGridH = maze.length;

  const hudHeight = 60;
  const padding = 10;
  const availW = canvasW - padding * 2;
  const availH = canvasH - hudHeight - padding * 2;

  cellSize = Math.floor(Math.min(availW / mazeGridW, availH / mazeGridH));
  cellSize = Math.max(cellSize, 8); // minimum cell size

  const mazePixelW = cellSize * mazeGridW;
  const mazePixelH = cellSize * mazeGridH;

  mazeOffsetX = Math.floor((canvasW - mazePixelW) / 2);
  mazeOffsetY = hudHeight + Math.floor((canvasH - hudHeight - mazePixelH) / 2);
}

function drawMaze() {
  if (!maze) return;
  const cfg = STAGE_CONFIG[currentStage];
  const mazeGridW = maze[0].length;
  const mazeGridH = maze.length;

  for (let y = 0; y < mazeGridH; y++) {
    for (let x = 0; x < mazeGridW; x++) {
      const px = mazeOffsetX + x * cellSize;
      const py = mazeOffsetY + y * cellSize;

      if (maze[y][x] === 0) {
        // Wall
        ctx.fillStyle = cfg.wallColor;
        ctx.fillRect(px, py, cellSize, cellSize);
      } else if (maze[y][x] === 2) {
        // Start
        ctx.fillStyle = '#fff9c4';
        ctx.fillRect(px, py, cellSize, cellSize);
        ctx.fillStyle = '#ff9800';
        ctx.font = `${Math.floor(cellSize * 0.6)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', px + cellSize / 2, py + cellSize / 2);
      } else if (maze[y][x] === 3) {
        // Goal
        ctx.fillStyle = '#c8e6c9';
        ctx.fillRect(px, py, cellSize, cellSize);
        ctx.fillStyle = '#4caf50';
        ctx.font = `${Math.floor(cellSize * 0.6)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('G', px + cellSize / 2, py + cellSize / 2);
      } else {
        // Path
        ctx.fillStyle = '#fffde7';
        ctx.fillRect(px, py, cellSize, cellSize);
      }
    }
  }
}

function drawPlayer() {
  const px = mazeOffsetX + player.x * cellSize;
  const py = mazeOffsetY + player.y * cellSize;
  const size = cellSize * 0.8;
  const offset = (cellSize - size) / 2;

  // Blink when invincible
  if (invincible && Math.floor(Date.now() / 100) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }

  // Draw mouse emoji
  ctx.font = `${Math.floor(cellSize * 0.75)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐭', px + cellSize / 2, py + cellSize / 2);

  ctx.globalAlpha = 1.0;
}

function drawEnemies() {
  for (const enemy of enemies) {
    const px = mazeOffsetX + enemy.x * cellSize;
    const py = mazeOffsetY + enemy.y * cellSize;
    ctx.font = `${Math.floor(cellSize * 0.7)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐛', px + cellSize / 2, py + cellSize / 2);
  }
}

function drawApple() {
  if (!apple || appleCollected) return;
  const px = mazeOffsetX + apple.x * cellSize;
  const py = mazeOffsetY + apple.y * cellSize;
  ctx.font = `${Math.floor(cellSize * 0.7)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🍎', px + cellSize / 2, py + cellSize / 2);
}

function drawHUD() {
  // Background
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(0, 0, canvasW, 52);
  ctx.fillStyle = '#ddd';
  ctx.fillRect(0, 52, canvasW, 2);

  // Hearts
  const heartSize = 28;
  for (let i = 0; i < maxHearts; i++) {
    ctx.font = `${heartSize}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(i < hearts ? '❤️' : '🤍', 10 + i * (heartSize + 4), 28);
  }

  // Timer
  ctx.fillStyle = timeLeft <= 10 ? '#e74c3c' : '#2d3436';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${timeLeft}びょう`, canvasW - 15, 28);

  // Stage name
  const cfg = STAGE_CONFIG[currentStage];
  ctx.fillStyle = '#636e72';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cfg.emoji + ' ' + cfg.name, canvasW / 2, 28);

  // Instruction text at start
  if (!gameStarted) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ねずみをクリック/タッチしてスタート！', canvasW / 2, mazeOffsetY - 15);
  }
}

function draw() {
  // Clear
  ctx.fillStyle = '#f0e6d3';
  ctx.fillRect(0, 0, canvasW, canvasH);

  if (state === 'playing' || state === 'gameover' || state === 'clear') {
    calcMazeMetrics();
    drawMaze();
    drawApple();
    drawEnemies();
    drawPlayer();
    drawHUD();
  }
}

// ============================================================
// Enemy AI
// ============================================================
let lastEnemyUpdate = 0;

function updateEnemies(timestamp) {
  if (!gameStarted) return;
  const dt = (timestamp - lastEnemyUpdate) / 1000;
  lastEnemyUpdate = timestamp;

  if (dt > 0.5) return; // skip large jumps

  for (const enemy of enemies) {
    enemy.moveTimer += dt;

    if (enemy.moveTimer >= enemy.moveInterval) {
      enemy.moveTimer = 0;

      // Get possible directions
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      const possibleDirs = dirs.filter(([dx, dy]) => {
        const nx = enemy.x + dx;
        const ny = enemy.y + dy;
        return ny >= 0 && ny < maze.length && nx >= 0 && nx < maze[0].length && maze[ny][nx] !== 0;
      });

      if (possibleDirs.length > 0) {
        // Prefer continuing in same direction if possible
        const continueDir = possibleDirs.find(([dx, dy]) => dx === enemy.dx && dy === enemy.dy);
        const reversedDir = possibleDirs.find(([dx, dy]) => dx === -enemy.dx && dy === -enemy.dy);

        let chosen;
        if (continueDir && Math.random() < 0.6) {
          chosen = continueDir;
        } else {
          // Avoid going back unless only option
          const nonReverse = possibleDirs.filter(d => d !== reversedDir);
          const choices = nonReverse.length > 0 ? nonReverse : possibleDirs;
          chosen = choices[Math.floor(Math.random() * choices.length)];
        }

        enemy.dx = chosen[0];
        enemy.dy = chosen[1];
        enemy.x += chosen[0];
        enemy.y += chosen[1];
      }
    }
  }
}

// ============================================================
// Collision Detection
// ============================================================
function checkEnemyCollision() {
  if (invincible || frozen) return;
  for (const enemy of enemies) {
    if (Math.abs(enemy.x - player.x) < 0.8 && Math.abs(enemy.y - player.y) < 0.8) {
      takeDamage();
      return;
    }
  }
}

function checkAppleCollision() {
  if (!apple || appleCollected) return;
  if (player.x === apple.x && player.y === apple.y) {
    appleCollected = true;
    if (hearts < maxHearts) {
      hearts++;
    }
    playAppleSound();
  }
}

function checkGoal() {
  if (frozen) return;
  const mazeGridH = maze.length;
  const mazeGridW = maze[0].length;
  if (player.x === mazeGridW - 2 && player.y === mazeGridH - 2) {
    // Win!
    stageClear();
  }
}

// ============================================================
// Damage & Game Over
// ============================================================
function takeDamage() {
  if (invincible || frozen) return;

  hearts--;
  playDamageSound();

  if (hearts <= 0) {
    gameOver();
    return;
  }

  // Knockback: move player back along trail
  frozen = true;
  invincible = true;

  // Find position a few steps back
  const stepsBack = Math.min(5, playerTrail.length - 1);
  if (stepsBack > 0) {
    const backPos = playerTrail[playerTrail.length - 1 - stepsBack];
    player.x = backPos.x;
    player.y = backPos.y;
    // Trim trail
    playerTrail = playerTrail.slice(0, playerTrail.length - stepsBack);
  }

  // Frozen period (can't move, can't be damaged, can't reach goal)
  frozenTimer = setTimeout(() => {
    frozen = false;
  }, 800);

  // Invincibility period
  invincibleTimer = setTimeout(() => {
    invincible = false;
  }, 1500);
}

function gameOver() {
  state = 'gameover';
  stopTimer();
  playGameOverSound();

  setTimeout(() => {
    uiLayer.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'overlay';
    div.innerHTML = `
      <div class="dialog">
        <div style="font-size: 3rem;">😢</div>
        <h2>ゲームオーバー</h2>
        <p>${timeLeft <= 0 ? 'じかんぎれ！' : 'ハートがなくなった！'}</p>
        <button class="btn btn-primary" id="btn-retry">もういちど</button>
        <button class="btn btn-secondary" id="btn-title">タイトル</button>
      </div>
    `;
    uiLayer.appendChild(div);

    document.getElementById('btn-retry').addEventListener('click', () => startGame(currentStage));
    document.getElementById('btn-title').addEventListener('click', showTitle);
  }, 500);
}

function stageClear() {
  state = 'clear';
  stopTimer();
  setClearStatus(currentStage);
  playClearSound();

  setTimeout(() => {
    uiLayer.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'overlay';

    const bonusMsg = currentStage === 'hard' && !getClearStatus().extra
      ? '<p style="color: #6c5ce7;">🔓 「えくすとら」がかいほうされた！</p>'
      : '';

    div.innerHTML = `
      <div class="dialog">
        <div style="font-size: 3rem;">🎉</div>
        <h2 style="color: #00b894;">くりあ！</h2>
        <p>のこり ${timeLeft}びょう ❤️×${hearts}</p>
        ${bonusMsg}
        <button class="btn btn-primary" id="btn-next">つぎのすてーじ</button>
        <button class="btn btn-secondary" id="btn-select">すてーじせんたく</button>
        <button class="btn btn-secondary" id="btn-title2">タイトル</button>
      </div>
    `;
    uiLayer.appendChild(div);

    // Next stage button
    const currentIdx = STAGE_ORDER.indexOf(currentStage);
    const nextBtn = document.getElementById('btn-next');
    if (currentIdx < STAGE_ORDER.length - 1) {
      const nextKey = STAGE_ORDER[currentIdx + 1];
      if (nextKey === 'extra' && !isExtraUnlocked()) {
        nextBtn.style.display = 'none';
      } else {
        nextBtn.addEventListener('click', () => startGame(nextKey));
      }
    } else {
      nextBtn.style.display = 'none';
    }

    document.getElementById('btn-select').addEventListener('click', showStageSelect);
    document.getElementById('btn-title2').addEventListener('click', showTitle);
  }, 500);
}

// ============================================================
// Input Handling
// ============================================================
function getGridPos(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  const gx = Math.floor((mx - mazeOffsetX) / cellSize);
  const gy = Math.floor((my - mazeOffsetY) / cellSize);
  return { gx, gy, mx, my };
}

function isOnPlayer(clientX, clientY) {
  const { gx, gy } = getGridPos(clientX, clientY);
  return gx === player.x && gy === player.y;
}

function tryMovePlayer(clientX, clientY) {
  if (state !== 'playing' || frozen) return;

  const { gx, gy } = getGridPos(clientX, clientY);

  // Check if adjacent to player (or same cell)
  const dx = gx - player.x;
  const dy = gy - player.y;

  // Only move one step at a time toward the cursor
  let moveX = 0;
  let moveY = 0;

  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
    moveX = dx > 0 ? 1 : -1;
  } else if (dy !== 0) {
    moveY = dy > 0 ? 1 : -1;
  } else {
    return; // Same cell
  }

  const nx = player.x + moveX;
  const ny = player.y + moveY;

  // Check bounds
  if (ny < 0 || ny >= maze.length || nx < 0 || nx >= maze[0].length) return;

  // Check if wall
  if (maze[ny][nx] === 0) {
    // Hit wall - take damage
    takeDamage();
    return;
  }

  // Move
  player.x = nx;
  player.y = ny;
  playerTrail.push({ x: nx, y: ny });

  // Keep trail at reasonable size
  if (playerTrail.length > 200) {
    playerTrail = playerTrail.slice(-100);
  }

  checkAppleCollision();
  checkGoal();
}

// Continuous movement tracking
let lastMoveTime = 0;
const MOVE_COOLDOWN = 120; // ms between moves

function handlePointerMove(clientX, clientY) {
  if (!mouseDown || !gameStarted || state !== 'playing' || frozen) return;

  const now = Date.now();
  if (now - lastMoveTime < MOVE_COOLDOWN) return;
  lastMoveTime = now;

  tryMovePlayer(clientX, clientY);
}

// Mouse events
canvas.addEventListener('mousedown', (e) => {
  e.preventDefault();
  if (state !== 'playing') return;

  if (!gameStarted) {
    if (isOnPlayer(e.clientX, e.clientY)) {
      gameStarted = true;
      mouseDown = true;
    }
    return;
  }

  mouseDown = true;
  lastMoveTime = 0;
  tryMovePlayer(e.clientX, e.clientY);
});

canvas.addEventListener('mousemove', (e) => {
  e.preventDefault();
  handlePointerMove(e.clientX, e.clientY);
});

canvas.addEventListener('mouseup', () => {
  mouseDown = false;
});

canvas.addEventListener('mouseleave', () => {
  mouseDown = false;
});

// Touch events
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (state !== 'playing') return;
  const touch = e.touches[0];

  if (!gameStarted) {
    if (isOnPlayer(touch.clientX, touch.clientY)) {
      gameStarted = true;
      mouseDown = true;
    }
    return;
  }

  mouseDown = true;
  lastMoveTime = 0;
  tryMovePlayer(touch.clientX, touch.clientY);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (e.touches.length > 0) {
    handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  mouseDown = false;
}, { passive: false });

// ============================================================
// Game Loop
// ============================================================
let lastTimestamp = 0;

function gameLoop(timestamp) {
  if (state !== 'playing') {
    draw();
    return;
  }

  if (lastTimestamp === 0) lastTimestamp = timestamp;
  lastEnemyUpdate = lastEnemyUpdate || timestamp;

  updateEnemies(timestamp);
  checkEnemyCollision();
  draw();

  lastTimestamp = timestamp;
  requestAnimationFrame(gameLoop);
}

// ============================================================
// Init
// ============================================================
showTitle();
