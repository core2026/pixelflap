// ==========================================
// CONFIGURATION
// ==========================================
const WORKER_URL = "https://game-leaderboard-api.acekallas.workers.dev";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Responsive Scaling
function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Game State
let gameState = "MENU"; // MENU, PLAYING, GAMEOVER
let score = 0;
let bestScore = localStorage.getItem("crystal_best") || 0;
let selectedChar = "cat";
let customImage = null; // Custom uploaded avatar Image object

// Physics Engine Vars
let birdY = canvas.height / 2;
let velocity = 0;
const gravity = 0.38;
const jump = -7.5;
const birdRadius = 22; // Enlarged for high-DPI clarity

// Crystal Obstacles
let pipes = [];
const pipeWidth = 50;
const pipeGap = 160;
let frameCount = 0;

// UI Elements
const charSelectOverlay = document.getElementById("character-select");
const gameOverOverlay = document.getElementById("game-over");
const startBtn = document.getElementById("startBtn");
const retryBtn = document.getElementById("retryBtn");
const changeCharBtn = document.getElementById("changeCharBtn");
const imageUpload = document.getElementById("imageUpload");
const uploadStatus = document.getElementById("uploadStatus");
const playerNameInput = document.getElementById("playerName");

// ==========================================
// CUSTOM IMAGE UPLOADER
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
        // Remove active state from preset buttons
        document.querySelectorAll(".char-btn").forEach(b => b.classList.remove("active"));
        uploadStatus.innerText = "✓ Avatar Loaded!";
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});

// Character Picker Listener
document.querySelectorAll(".char-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".char-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedChar = btn.dataset.char;
    customImage = null; // Reset custom image if user chooses default
    uploadStatus.innerText = "";
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

// Fix: Change Character Button Action
changeCharBtn.addEventListener("click", () => {
  gameOverOverlay.classList.add("hidden");
  charSelectOverlay.classList.remove("hidden");
  gameState = "MENU";
  resetGameVars();
});

function startGame() {
  charSelectOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  resetGameVars();
  gameState = "PLAYING";
}

function resetGameVars() {
  birdY = canvas.height / 2;
  velocity = 0;
  pipes = [];
  score = 0;
  frameCount = 0;
}

// User Interaction / Jump
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
// RENDER HELPERS (Clear Cat, Single Star, Custom Avatar)
// ==========================================
function drawPlayer(x, y) {
  ctx.save();
  ctx.translate(x, y);

  if (selectedChar === "custom" && customImage) {
    // Render Custom Uploaded Image inside a circle
    ctx.beginPath();
    ctx.arc(0, 0, birdRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(customImage, -birdRadius, -birdRadius, birdRadius * 2, birdRadius * 2);
  } else if (selectedChar === "cat") {
    // High-Clarity Cat Design
    // Head Base
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.arc(0, 0, birdRadius, 0, Math.PI * 2);
    ctx.fill();

    // Outer Ears
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.moveTo(-16, -10); ctx.lineTo(-22, -26); ctx.lineTo(-6, -18); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(16, -10); ctx.lineTo(22, -26); ctx.lineTo(6, -18); ctx.fill();

    // Inner Pink Ears
    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.moveTo(-14, -12); ctx.lineTo(-19, -22); ctx.lineTo(-8, -17); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -12); ctx.lineTo(19, -22); ctx.lineTo(8, -17); ctx.fill();

    // Large Eyes
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(-7, -2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, -2, 6, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.beginPath(); ctx.arc(-6, -2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -2, 3, 0, Math.PI * 2); ctx.fill();

    // Pink Nose Triangle
    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.moveTo(0, 3); ctx.lineTo(-3, 7); ctx.lineTo(3, 7); ctx.fill();

  } else if (selectedChar === "star") {
    // Single Crisp Star Rendering (Fixed double-render glitch)
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(
        Math.cos(((18 + i * 72) * Math.PI) / 180) * birdRadius,
        -Math.sin(((18 + i * 72) * Math.PI) / 180) * birdRadius
      );
      ctx.lineTo(
        Math.cos(((54 + i * 72) * Math.PI) / 180) * (birdRadius / 2),
        -Math.sin(((54 + i * 72) * Math.PI) / 180) * (birdRadius / 2)
      );
    }
    ctx.closePath();
    ctx.fill();

  } else {
    // Dog Avatar
    ctx.fillStyle = "#eab308";
    ctx.beginPath(); ctx.arc(0, 0, birdRadius, 0, Math.PI * 2); ctx.fill();
    // Floppy Ears
    ctx.fillStyle = "#ca8a04";
    ctx.beginPath(); ctx.ellipse(-18, 0, 6, 14, Math.PI / 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(18, 0, 6, 14, -Math.PI / 6, 0, Math.PI * 2); ctx.fill();
    // Eyes & Nose
    ctx.fillStyle = "#000000";
    ctx.beginPath(); ctx.arc(-6, -3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 4, 4, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

// ==========================================
// MAIN GAME LOOP & OBSTACLES
// ==========================================
function update() {
  if (gameState !== "PLAYING") return;

  velocity += gravity;
  birdY += velocity;

  // Floor / Ceiling Collision
  if (birdY + birdRadius >= canvas.height || birdY - birdRadius <= 0) {
    endGame();
  }

  // Spawn Crystal Pipes
  frameCount++;
  if (frameCount % 90 === 0) {
    const topHeight = Math.random() * (canvas.height - pipeGap - 120) + 40;
    pipes.push({ x: canvas.width, top: topHeight, passed: false });
  }

  // Move Pipes
  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].x -= 2.5;

    // Check Score
    if (!pipes[i].passed && pipes[i].x < 80) {
      pipes[i].passed = true;
      score++;
    }

    // Collision Check
    const p = pipes[i];
    if (
      80 + birdRadius > p.x &&
      80 - birdRadius < p.x + pipeWidth &&
      (birdY - birdRadius < p.top || birdY + birdRadius > p.top + pipeGap)
    ) {
      endGame();
    }

    // Remove Off-screen Pipes
    if (pipes[i].x + pipeWidth < 0) {
      pipes.splice(i, 1);
    }
  }
}

function draw() {
  // Dusk Sky Background
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, "#1e1b4b");
  skyGrad.addColorStop(1, "#311042");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Crystal Spires (Obstacles)
  pipes.forEach((p) => {
    const crystalGrad = ctx.createLinearGradient(p.x, 0, p.x + pipeWidth, 0);
    crystalGrad.addColorStop(0, "#a855f7");
    crystalGrad.addColorStop(0.5, "#3b82f6");
    crystalGrad.addColorStop(1, "#1e40af");

    ctx.fillStyle = crystalGrad;
    // Top Crystal
    ctx.fillRect(p.x, 0, pipeWidth, p.top);
    // Bottom Crystal
    ctx.fillRect(p.x, p.top + pipeGap, pipeWidth, canvas.height - (p.top + pipeGap));
  });

  // Draw Player Avatar
  if (gameState === "PLAYING") {
    drawPlayer(80, birdY);
  }

  // Draw Live Score Counter
  if (gameState === "PLAYING") {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(score, canvas.width / 2 - 10, 50);
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
    localStorage.setItem("crystal_best", bestScore);
  }
  document.getElementById("bestScore").innerText = bestScore;

  gameOverOverlay.classList.remove("hidden");

  // Submit Score & Refresh High Scores list
  submitScore(playerNameInput.value || "Player1", score);
}

async function submitScore(name, scoreVal) {
  const listEl = document.getElementById("leaderboardList");
  listEl.innerHTML = "<li>Updating leaderboard...</li>";

  try {
    // 1. Post current score
    if (scoreVal > 0) {
      await fetch(`${WORKER_URL}/api/leaderboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, score: scoreVal }),
      });
    }

    // 2. Retrieve Top 10 from Cloudflare D1
    const res = await fetch(`${WORKER_URL}/api/leaderboard`);
    const scores = await res.json();

    listEl.innerHTML = "";
    if (scores.length === 0) {
      listEl.innerHTML = "<li>No scores yet. Be the first!</li>";
      return;
    }

    scores.forEach((entry, idx) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${idx + 1}. ${htmlEscape(entry.player_name)}</span> <strong>${entry.score}</strong>`;
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