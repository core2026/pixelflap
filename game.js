// ==========================================
// CONFIGURATION
// ==========================================
const WORKER_URL = "https://game-leaderboard-api.acekallas.workers.dev";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Game State
let gameState = "MENU"; // MENU, PLAYING, GAMEOVER
let score = 0;
let bestScore = localStorage.getItem("pixeljump_best") || 0;
let selectedChar = "cat";
let customImage = null;

// Physics Engine Vars
let birdY = canvas.height / 2;
let velocity = 0;
const gravity = 0.38;
const jump = -7.5;

// Dynamic Sizes
let currentBirdRadius = 22;
let currentPipeGap = 160;
let currentPipeWidth = 50;

// Obstacles & Particles
let pipes = [];
let particles = [];
let stars = [];
let frameCount = 0;

// Dynamic Theme Presets (Chosen randomly on game start)
const THEME_PRESETS = [
  { name: "Synthwave Dusk", top: "#1e1b4b", bottom: "#311042", crystal1: "#a855f7", crystal2: "#3b82f6", glow: "#a855f7", trail: "#f97316" },
  { name: "Cyber Emerald", top: "#022c22", bottom: "#064e3b", crystal1: "#10b981", crystal2: "#06b6d4", glow: "#10b981", trail: "#34d399" },
  { name: "Neon Sunset", top: "#450a0a", bottom: "#7c2d12", crystal1: "#f97316", crystal2: "#eab308", glow: "#f97316", trail: "#facc15" },
  { name: "Deep Void", top: "#030712", bottom: "#111827", crystal1: "#6366f1", crystal2: "#a855f7", glow: "#818cf8", trail: "#c084fc" },
  { name: "Electric Sakura", top: "#500724", bottom: "#831843", crystal1: "#f472b6", crystal2: "#fb7185", glow: "#f472b6", trail: "#fbcfe8" }
];
let activeTheme = THEME_PRESETS[0];

// UI Elements
const charSelectOverlay = document.getElementById("character-select");
const gameOverOverlay = document.getElementById("game-over");
const startBtn = document.getElementById("startBtn");
const retryBtn = document.getElementById("retryBtn");
const changeCharBtn = document.getElementById("changeCharBtn");
const imageUpload = document.getElementById("imageUpload");
const uploadStatus = document.getElementById("uploadStatus");
const playerNameInput = document.getElementById("playerName");

// Restrict initials input to max 3 uppercase letters (allows 1, 2, or 3 letters)
playerNameInput.addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase();
});

// Setup Background Starfield
for (let i = 0; i < 40; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2 + 0.5,
    speed: Math.random() * 0.5 + 0.2
  });
}

function updateGameplayDimensions() {
  if (selectedChar === "custom") {
    currentBirdRadius = 30;
    currentPipeGap = 195;
    currentPipeWidth = 45;
  } else {
    currentBirdRadius = 22;
    currentPipeGap = 160;
    currentPipeWidth = 50;
  }
}

// ==========================================
// CUSTOM IMAGE UPLOADER & CHAR PICKER
// ==========================================
imageUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.onload = function () {
        customImage = img;
        selectedChar = "custom";
        document.querySelectorAll(".char-btn").forEach(b => b.classList.remove("active"));
        uploadStatus.innerText = "✓ Avatar Loaded!";
        updateGameplayDimensions();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});

document.querySelectorAll(".char-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".char-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedChar = btn.dataset.char;
    customImage = null;
    uploadStatus.innerText = "";
    updateGameplayDimensions();
  });
});

// ==========================================
// NAVIGATION & OVERLAY CONTROLS
// ==========================================
startBtn.addEventListener("click", startGame);

retryBtn.addEventListener("click", () => {
  gameOverOverlay.classList.add("hidden");
  resetGameVars();
  gameState = "PLAYING";
});

changeCharBtn.addEventListener("click", () => {
  gameOverOverlay.classList.add("hidden");
  charSelectOverlay.classList.remove("hidden");
  gameState = "MENU";
  resetGameVars();
});

function startGame() {
  const initials = playerNameInput.value.trim();
  // Validates length to be strictly between 1 and 3 characters
  if (initials.length < 1 || initials.length > 3) {
    alert("Please enter 1 to 3 letters for your initials.");
    playerNameInput.focus();
    return;
  }

  charSelectOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  resetGameVars();
  gameState = "PLAYING";
}

function resetGameVars() {
  birdY = canvas.height / 2;
  velocity = 0;
  pipes = [];
  particles = [];
  score = 0;
  frameCount = 0;
  
  // Pick a random theme layout every time a fresh round starts
  activeTheme = THEME_PRESETS[Math.floor(Math.random() * THEME_PRESETS.length)];
  
  updateGameplayDimensions();
}

// Controls
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") handleAction();
});
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  handleAction();
}, { passive: false });
canvas.addEventListener("mousedown", handleAction);

function handleAction() {
  if (gameState === "PLAYING") {
    velocity = jump;
  }
}

// ==========================================
// RENDER HELPERS & PARTICLES
// ==========================================
function spawnParticle(x, y) {
  particles.push({
    x: x - currentBirdRadius / 2,
    y: y + (Math.random() * 10 - 5),
    vx: -Math.random() * 2 - 1,
    vy: Math.random() * 2 - 1,
    size: Math.random() * 4 + 2,
    alpha: 1.0,
    color: activeTheme.trail
  });
}

function drawPlayer(x, y) {
  ctx.save();
  ctx.translate(x, y);

  if (selectedChar === "custom" && customImage) {
    ctx.beginPath();
    ctx.arc(0, 0, currentBirdRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(
      customImage, 
      -currentBirdRadius, 
      -currentBirdRadius, 
      currentBirdRadius * 2, 
      currentBirdRadius * 2
    );
  } else if (selectedChar === "cat") {
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.arc(0, 0, currentBirdRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.moveTo(-16, -10); ctx.lineTo(-22, -26); ctx.lineTo(-6, -18); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(16, -10); ctx.lineTo(22, -26); ctx.lineTo(6, -18); ctx.fill();

    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.moveTo(-14, -12); ctx.lineTo(-19, -22); ctx.lineTo(-8, -17); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -12); ctx.lineTo(19, -22); ctx.lineTo(8, -17); ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(-7, -2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, -2, 6, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.beginPath(); ctx.arc(-6, -2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -2, 3, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.moveTo(0, 3); ctx.lineTo(-3, 7); ctx.lineTo(3, 7); ctx.fill();

  } else if (selectedChar === "star") {
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(
        Math.cos(((18 + i * 72) * Math.PI) / 180) * currentBirdRadius,
        -Math.sin(((18 + i * 72) * Math.PI) / 180) * currentBirdRadius
      );
      ctx.lineTo(
        Math.cos(((54 + i * 72) * Math.PI) / 180) * (currentBirdRadius / 2),
        -Math.sin(((54 + i * 72) * Math.PI) / 180) * (currentBirdRadius / 2)
      );
    }
    ctx.closePath();
    ctx.fill();

  } else {
    ctx.fillStyle = "#eab308";
    ctx.beginPath(); ctx.arc(0, 0, currentBirdRadius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ca8a04";
    ctx.beginPath(); ctx.ellipse(-18, 0, 6, 14, Math.PI / 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(18, 0, 6, 14, -Math.PI / 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.beginPath(); ctx.arc(-6, -3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 4, 4, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

// ==========================================
// MAIN LOOP & PHYSICS
// ==========================================
function update() {
  stars.forEach((s) => {
    s.x -= s.speed;
    if (s.x < 0) s.x = canvas.width;
  });

  if (gameState !== "PLAYING") return;

  velocity += gravity;
  birdY += velocity;

  if (frameCount % 2 === 0) {
    spawnParticle(80, birdY);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.03;
    if (p.alpha <= 0) particles.splice(i, 1);
  }

  if (birdY + currentBirdRadius >= canvas.height || birdY - currentBirdRadius <= 0) {
    endGame();
  }

  frameCount++;
  if (frameCount % 90 === 0) {
    const topHeight = Math.random() * (canvas.height - currentPipeGap - 120) + 40;
    pipes.push({ x: canvas.width, top: topHeight, passed: false });
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].x -= 2.5;

    if (!pipes[i].passed && pipes[i].x < 80) {
      pipes[i].passed = true;
      score++;
    }

    const p = pipes[i];
    if (
      80 + currentBirdRadius > p.x &&
      80 - currentBirdRadius < p.x + currentPipeWidth &&
      (birdY - currentBirdRadius < p.top || birdY + currentBirdRadius > p.top + currentPipeGap)
    ) {
      endGame();
    }

    if (pipes[i].x + currentPipeWidth < 0) {
      pipes.splice(i, 1);
    }
  }
}

function draw() {
  // Render active randomized theme background gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, activeTheme.top);
  skyGrad.addColorStop(1, activeTheme.bottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Parallax Starfield
  ctx.fillStyle = "#ffffff";
  stars.forEach((s) => {
    ctx.globalAlpha = 0.6;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  });
  ctx.globalAlpha = 1.0;

  // Particle Trail
  particles.forEach((p) => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Pulsing Crystal Pillars based on active theme
  pipes.forEach((p) => {
    const pulse = Math.sin(frameCount * 0.05) * 0.2 + 0.8;
    const crystalGrad = ctx.createLinearGradient(p.x, 0, p.x + currentPipeWidth, 0);
    crystalGrad.addColorStop(0, activeTheme.crystal1);
    crystalGrad.addColorStop(1, activeTheme.crystal2);

    ctx.fillStyle = crystalGrad;
    ctx.shadowBlur = 12 * pulse;
    ctx.shadowColor = activeTheme.glow;

    // Top Crystal
    ctx.fillRect(p.x, 0, currentPipeWidth, p.top);
    // Bottom Crystal
    ctx.fillRect(p.x, p.top + currentPipeGap, currentPipeWidth, canvas.height - (p.top + currentPipeGap));
    
    ctx.shadowBlur = 0;
  });

  if (gameState === "PLAYING") {
    drawPlayer(80, birdY);
  }

  if (gameState === "PLAYING") {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px sans-serif";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.fillText(score, canvas.width / 2 - 10, 50);
    ctx.shadowBlur = 0;
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();

// ==========================================
// HIGH SCORE & LEADERBOARD API INTEGRATION
// ==========================================
function endGame() {
  gameState = "GAMEOVER";
  document.getElementById("finalScore").innerText = score;

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("pixeljump_best", bestScore);
  }
  document.getElementById("bestScore").innerText = bestScore;

  gameOverOverlay.classList.remove("hidden");

  const initials = (playerNameInput.value || "ACE").toUpperCase();
  submitScore(initials, score);
}

async function submitScore(name, scoreVal) {
  const listEl = document.getElementById("leaderboardList");
  listEl.innerHTML = "<li>Updating leaderboard...</li>";

  try {
    if (scoreVal > 0) {
      await fetch(`${WORKER_URL}/api/leaderboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, score: scoreVal }),
      });
    }

    // Fetch Top 15 High Scores
    const res = await fetch(`${WORKER_URL}/api/leaderboard`);
    const scores = await res.json();

    listEl.innerHTML = "";
    if (!scores || scores.length === 0) {
      listEl.innerHTML = "<li>No scores yet. Be the first!</li>";
      return;
    }

    scores.forEach((entry, idx) => {
      const li = document.createElement("li");
      
      let formattedTime = "";
      if (entry.created_at) {
        const d = new Date(entry.created_at);
        formattedTime = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }

      li.innerHTML = `
        <span class="rank-name">${idx + 1}. <strong>${htmlEscape(entry.player_name)}</strong></span>
        <span class="score-date">
          <small class="time-stamp">${formattedTime}</small>
          <strong class="score-val">${entry.score}</strong>
        </span>
      `;
      listEl.appendChild(li);
    });
  } catch (err) {
    listEl.innerHTML = "<li>Unable to load live scores</li>";
    console.error("Leaderboard Error:", err);
  }
}

function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}