// ============================================================
// CHARACTER CONFIG — swap this out later to reskin the game.
// Add new characters here and change ACTIVE_CHARACTER to switch.
// Each character just needs a draw(ctx, x, y, radius, rotation) fn.
// ============================================================
const CHARACTERS = {
  blob: {
    radius: 16,
    draw(ctx, x, y, radius, rotation) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      // body
      ctx.fillStyle = '#f6c744';
      ctx.strokeStyle = '#1e2327';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // eye
      ctx.fillStyle = '#1e2327';
      ctx.beginPath();
      ctx.arc(radius * 0.35, -radius * 0.25, radius * 0.15, 0, Math.PI * 2);
      ctx.fill();

      // little wing
      ctx.fillStyle = '#e0a92f';
      ctx.beginPath();
      ctx.ellipse(-radius * 0.2, radius * 0.1, radius * 0.5, radius * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  },

  star: {
    radius: 16,
    draw(ctx, x, y, radius, rotation) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      const spikes = 5;
      const outerR = radius;
      const innerR = radius * 0.5;

      ctx.fillStyle = '#f9d84a';
      ctx.strokeStyle = '#1e2327';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI / spikes) * i - Math.PI / 2;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // face
      ctx.fillStyle = '#1e2327';
      ctx.beginPath();
      ctx.arc(-radius * 0.22, -radius * 0.05, radius * 0.09, 0, Math.PI * 2);
      ctx.arc(radius * 0.22, -radius * 0.05, radius * 0.09, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#1e2327';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, radius * 0.05, radius * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();

      ctx.restore();
    }
  },

  cat: {
    radius: 16,
    draw(ctx, x, y, radius, rotation) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      // ears
      ctx.fillStyle = '#e8955c';
      ctx.strokeStyle = '#1e2327';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.6, -radius * 0.6);
      ctx.lineTo(-radius * 0.1, -radius * 1.15);
      ctx.lineTo(-radius * 0.05, -radius * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(radius * 0.6, -radius * 0.6);
      ctx.lineTo(radius * 0.1, -radius * 1.15);
      ctx.lineTo(radius * 0.05, -radius * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // head
      ctx.fillStyle = '#f4a862';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // eyes
      ctx.fillStyle = '#1e2327';
      ctx.beginPath();
      ctx.arc(-radius * 0.3, -radius * 0.1, radius * 0.1, 0, Math.PI * 2);
      ctx.arc(radius * 0.3, -radius * 0.1, radius * 0.1, 0, Math.PI * 2);
      ctx.fill();

      // nose + whiskers
      ctx.strokeStyle = '#1e2327';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.5, radius * 0.15);
      ctx.lineTo(-radius * 0.05, radius * 0.25);
      ctx.moveTo(radius * 0.5, radius * 0.15);
      ctx.lineTo(radius * 0.05, radius * 0.25);
      ctx.stroke();

      ctx.restore();
    }
  },

  dog: {
    radius: 16,
    draw(ctx, x, y, radius, rotation) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      // floppy ear
      ctx.fillStyle = '#8a5a34';
      ctx.strokeStyle = '#1e2327';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(-radius * 0.75, radius * 0.1, radius * 0.35, radius * 0.55, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // head
      ctx.fillStyle = '#c98a4b';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // snout patch
      ctx.fillStyle = '#f0d9b5';
      ctx.beginPath();
      ctx.ellipse(radius * 0.35, radius * 0.3, radius * 0.45, radius * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();

      // nose
      ctx.fillStyle = '#1e2327';
      ctx.beginPath();
      ctx.arc(radius * 0.65, radius * 0.28, radius * 0.12, 0, Math.PI * 2);
      ctx.fill();

      // eye
      ctx.beginPath();
      ctx.arc(radius * 0.1, -radius * 0.15, radius * 0.11, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
};

const DEFAULT_CHARACTER = 'star';
let ACTIVE_CHARACTER = localStorage.getItem('pixelflap-character') || DEFAULT_CHARACTER;

// ============================================================
// GAME SETUP
// ============================================================
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

const GRAVITY = 0.45;
const FLAP_VELOCITY = -8;
const PIPE_WIDTH = 60;
const PIPE_GAP = 160;
const PIPE_SPEED = 2.5;
const PIPE_SPAWN_INTERVAL = 90; // frames

const scoreHud = document.getElementById('score-hud');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const bestScoreEl = document.getElementById('best-score');
const startBtn = document.getElementById('start-btn');
const retryBtn = document.getElementById('retry-btn');

function getCharacter() {
  return CHARACTERS[ACTIVE_CHARACTER];
}

let state = 'idle'; // idle | playing | dead
let player, pipes, frameCount, score, bestScore;

function resetGame() {
  player = {
    x: GAME_WIDTH * 0.3,
    y: GAME_HEIGHT / 2,
    velocity: 0,
    radius: getCharacter().radius
  };
  pipes = [];
  frameCount = 0;
  score = 0;
  scoreHud.textContent = '0';
}

function loadBestScore() {
  const stored = localStorage.getItem('pixelflap-best-score');
  bestScore = stored ? parseInt(stored, 10) : 0;
}

function saveBestScoreIfNeeded() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('pixelflap-best-score', String(bestScore));
  }
}

function spawnPipe() {
  const margin = 60;
  const gapCenter = margin + Math.random() * (GAME_HEIGHT - margin * 2 - PIPE_GAP);
  pipes.push({
    x: GAME_WIDTH,
    gapTop: gapCenter - PIPE_GAP / 2,
    gapBottom: gapCenter + PIPE_GAP / 2,
    passed: false
  });
}

function flap() {
  if (state === 'idle') {
    startGame();
  } else if (state === 'playing') {
    player.velocity = FLAP_VELOCITY;
  } else if (state === 'dead') {
    // ignore taps until retry button pressed
  }
}

function startGame() {
  resetGame();
  state = 'playing';
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  player.velocity = FLAP_VELOCITY;
}

function endGame() {
  state = 'dead';
  saveBestScoreIfNeeded();
  finalScoreEl.textContent = `score: ${score}`;
  bestScoreEl.textContent = `best: ${bestScore}`;
  gameOverScreen.classList.remove('hidden');
}

function update() {
  if (state !== 'playing') return;

  frameCount++;

  // physics
  player.velocity += GRAVITY;
  player.y += player.velocity;

  // spawn pipes
  if (frameCount % PIPE_SPAWN_INTERVAL === 0) {
    spawnPipe();
  }

  // move pipes + scoring + collision
  for (const pipe of pipes) {
    pipe.x -= PIPE_SPEED;

    if (!pipe.passed && pipe.x + PIPE_WIDTH < player.x) {
      pipe.passed = true;
      score++;
      scoreHud.textContent = String(score);
    }

    const withinPipeX =
      player.x + player.radius > pipe.x &&
      player.x - player.radius < pipe.x + PIPE_WIDTH;

    if (withinPipeX) {
      const hitsTop = player.y - player.radius < pipe.gapTop;
      const hitsBottom = player.y + player.radius > pipe.gapBottom;
      if (hitsTop || hitsBottom) {
        endGame();
      }
    }
  }

  // remove off-screen pipes
  pipes = pipes.filter(p => p.x + PIPE_WIDTH > 0);

  // floor / ceiling collision
  if (player.y + player.radius > GAME_HEIGHT || player.y - player.radius < 0) {
    player.y = Math.max(player.radius, Math.min(GAME_HEIGHT - player.radius, player.y));
    endGame();
  }
}

function draw() {
  // background
  ctx.fillStyle = '#70c5ce';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // pipes
  ctx.fillStyle = '#4caf50';
  ctx.strokeStyle = '#1e2327';
  ctx.lineWidth = 3;
  for (const pipe of pipes) {
    // top pipe
    ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.gapTop);
    ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, pipe.gapTop);
    // bottom pipe
    ctx.fillRect(pipe.x, pipe.gapBottom, PIPE_WIDTH, GAME_HEIGHT - pipe.gapBottom);
    ctx.strokeRect(pipe.x, pipe.gapBottom, PIPE_WIDTH, GAME_HEIGHT - pipe.gapBottom);
  }

  // player
  const rotation = Math.max(-0.5, Math.min(0.9, player.velocity * 0.06));
  getCharacter().draw(ctx, player.x, player.y, player.radius, rotation);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ============================================================
// CHARACTER SELECTION
// ============================================================
const charOptions = document.querySelectorAll('.char-option');

function selectCharacter(key) {
  ACTIVE_CHARACTER = key;
  localStorage.setItem('pixelflap-character', ACTIVE_CHARACTER);
  markSelectedOption();
}

function markSelectedOption() {
  charOptions.forEach(option => {
    option.classList.toggle('selected', option.dataset.character === ACTIVE_CHARACTER);
  });
}

charOptions.forEach(option => {
  option.addEventListener('click', () => selectCharacter(option.dataset.character));
  option.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectCharacter(option.dataset.character);
    }
  });
});

// ============================================================
// INPUT
// ============================================================
function handleInput(e) {
  e.preventDefault();
  flap();
}

canvas.addEventListener('mousedown', handleInput);
canvas.addEventListener('touchstart', handleInput);
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    flap();
  }
});

startBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', startGame);

// ============================================================
// INIT
// ============================================================
loadBestScore();
resetGame();
markSelectedOption();
draw();
loop();
