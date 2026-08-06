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
    radius: 20,
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
    radius: 20,
    draw(ctx, x, y, radius, rotation) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      ctx.strokeStyle = '#1e2327';
      ctx.lineWidth = 3;

      // outer ears (bigger + more triangular for clarity at small size)
      ctx.fillStyle = '#e8955c';
      ctx.beginPath();
      ctx.moveTo(-radius * 0.75, -radius * 0.5);
      ctx.lineTo(-radius * 0.15, -radius * 1.35);
      ctx.lineTo(-radius * 0.05, -radius * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(radius * 0.75, -radius * 0.5);
      ctx.lineTo(radius * 0.15, -radius * 1.35);
      ctx.lineTo(radius * 0.05, -radius * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // inner ears (pink, for contrast/readability)
      ctx.fillStyle = '#f4a9c0';
      ctx.beginPath();
      ctx.moveTo(-radius * 0.55, -radius * 0.55);
      ctx.lineTo(-radius * 0.22, -radius * 1.0);
      ctx.lineTo(-radius * 0.12, -radius * 0.5);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(radius * 0.55, -radius * 0.55);
      ctx.lineTo(radius * 0.22, -radius * 1.0);
      ctx.lineTo(radius * 0.12, -radius * 0.5);
      ctx.closePath();
      ctx.fill();

      // head
      ctx.fillStyle = '#f4a862';
      ctx.beginPath();
      ctx.arc(0, radius * 0.05, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // big round eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-radius * 0.32, -radius * 0.02, radius * 0.22, 0, Math.PI * 2);
      ctx.arc(radius * 0.32, -radius * 0.02, radius * 0.22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1e2327';
      ctx.beginPath();
      ctx.arc(-radius * 0.28, -radius * 0.02, radius * 0.11, 0, Math.PI * 2);
      ctx.arc(radius * 0.28, -radius * 0.02, radius * 0.11, 0, Math.PI * 2);
      ctx.fill();

      // pink nose
      ctx.fillStyle = '#e8637f';
      ctx.beginPath();
      ctx.moveTo(-radius * 0.09, radius * 0.28);
      ctx.lineTo(radius * 0.09, radius * 0.28);
      ctx.lineTo(0, radius * 0.4);
      ctx.closePath();
      ctx.fill();

      // whiskers
      ctx.strokeStyle = '#1e2327';
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.75, radius * 0.32);
      ctx.lineTo(-radius * 0.15, radius * 0.38);
      ctx.moveTo(radius * 0.75, radius * 0.32);
      ctx.lineTo(radius * 0.15, radius * 0.38);
      ctx.stroke();

      ctx.restore();
    }
  },

  dog: {
    radius: 20,
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
const initialsEntry = document.getElementById('initials-entry');
const initialsInput = document.getElementById('initials-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const leaderboardList = document.getElementById('leaderboard-list');
const changeCharacterBtn = document.getElementById('change-character-btn');

const LEADERBOARD_KEY = 'pixelflap-leaderboard';
const MAX_LEADERBOARD_ENTRIES = 10;

function loadLeaderboard() {
  try {
    const stored = localStorage.getItem(LEADERBOARD_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveLeaderboard(entries) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
}

function addLeaderboardEntry(initials, entryScore) {
  const entries = loadLeaderboard();
  entries.push({
    initials: initials || '---',
    score: entryScore,
    date: new Date().toISOString()
  });
  entries.sort((a, b) => b.score - a.score);
  const trimmed = entries.slice(0, MAX_LEADERBOARD_ENTRIES);
  saveLeaderboard(trimmed);
  return trimmed;
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function renderLeaderboard() {
  const entries = loadLeaderboard();
  leaderboardList.innerHTML = '';
  if (entries.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'no scores yet';
    leaderboardList.appendChild(li);
    return;
  }
  entries.forEach(entry => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="lb-initials">${entry.initials}</span>
      <span>${entry.score}</span>
      <span class="lb-date">${formatDate(entry.date)}</span>
    `;
    leaderboardList.appendChild(li);
  });
}

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
  // Re-derive the active character straight from the DOM at the moment
  // play is pressed, rather than trusting only the in-memory variable.
  const selectedOption = document.querySelector('.char-option.selected');
  if (selectedOption) {
    ACTIVE_CHARACTER = selectedOption.dataset.character;
  }

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

  initialsEntry.classList.remove('hidden');
  initialsInput.value = '';
  renderLeaderboard();
  setTimeout(() => initialsInput.focus(), 0);
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

function drawCrystalSpire(x, y, w, h, capAtBottom) {
  ctx.save();

  // gradient body — cool purple/blue, distinct from a plain green pipe
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, '#4a3fc7');
  grad.addColorStop(0.5, '#8b7ff5');
  grad.addColorStop(1, '#4a3fc7');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#241c66';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();

  // vertical highlight stripe for a faceted-crystal feel
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.fillRect(x + w * 0.18, y + 6, w * 0.16, h - 12);

  // diamond cap pointing toward the gap
  const capSize = w * 0.65;
  const capX = x + w / 2;
  const capY = capAtBottom ? y + h : y;
  const dir = capAtBottom ? 1 : -1;

  ctx.fillStyle = '#a89bff';
  ctx.beginPath();
  ctx.moveTo(capX, capY + dir * capSize * 0.55);
  ctx.lineTo(capX + capSize / 2, capY);
  ctx.lineTo(capX, capY - dir * capSize * 0.55);
  ctx.lineTo(capX - capSize / 2, capY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function draw() {
  // sky — soft dusk gradient instead of flat blue
  const sky = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  sky.addColorStop(0, '#6f86d6');
  sky.addColorStop(1, '#c99fd6');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // crystal spires
  for (const pipe of pipes) {
    drawCrystalSpire(pipe.x, 0, PIPE_WIDTH, pipe.gapTop, true);
    drawCrystalSpire(pipe.x, pipe.gapBottom, PIPE_WIDTH, GAME_HEIGHT - pipe.gapBottom, false);
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

changeCharacterBtn.addEventListener('click', () => {
  state = 'idle';
  gameOverScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
});

// ============================================================
// HIGH SCORE / INITIALS ENTRY
// ============================================================
initialsInput.addEventListener('input', () => {
  // strip anything that isn't a letter, cap at 3 chars, force uppercase
  initialsInput.value = initialsInput.value
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3);
});

initialsInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveScoreBtn.click();
  }
});

saveScoreBtn.addEventListener('click', () => {
  const initials = initialsInput.value || 'YOU';
  addLeaderboardEntry(initials, score);
  renderLeaderboard();
  initialsEntry.classList.add('hidden');
});

// ============================================================
// INIT
// ============================================================
loadBestScore();
resetGame();
markSelectedOption();
draw();
loop();
