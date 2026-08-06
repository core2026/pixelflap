// Worker API Endpoint
const WORKER_URL = "https://pixelflap-main.acekallas.workers.dev";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// UI Elements
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const initialsInput = document.getElementById("player-initials");
const avatarBtns = document.querySelectorAll(".avatar-btn");
const customAvatarInput = document.getElementById("custom-avatar-input");
const leaderboardList = document.getElementById("leaderboard-list");
const finalScoreEl = document.getElementById("final-score");
const container = document.getElementById("game-container");

// Cosmic Themes
const themes = [
  { name: "Cyber Void", bg: "#090a14", pipe: "#00e5ff", pipeBorder: "#0088cc" },
  { name: "Deep Nebula", bg: "#12071f", pipe: "#d500f9", pipeBorder: "#aa00ff" },
  { name: "Solar Flare", bg: "#1a0c00", pipe: "#ff9100", pipeBorder: "#ff6d00" }
];
let currentTheme = themes[0];

// Game State
let gameState = "MENU"; // MENU, PLAYING, GAMEOVER
let score = 0;
let frames = 0;
let playerInitials = "ACE";
let selectedAvatar = "🚀";
let customImageObj = null;

// Player Settings
const player = {
  x: 60,
  y: 250,
  width: 32,
  height: 32,
  gravity: 0.45,
  jump: -7.5,
  velocity: 0
};

// Game Arrays
let pipes = [];
let stars = [];      // Bonus floating star collectibles (+5 pts)
let debris = [];     // Background space dust/asteroids
let particles = [];  // Trail particles

// Initialize Controls & Avatars
avatarBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    avatarBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedAvatar = btn.getAttribute("data-avatar");
    customImageObj = null;
  });
});

customAvatarInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const img = new Image();
      img.onload = () => {
        customImageObj = img;
        avatarBtns.forEach(b => b.classList.remove("active"));
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }
});

function jump() {
  if (gameState === "PLAYING") {
    player.velocity = player.jump;
    // Spawn jump trail particles
    for(let i = 0; i < 5; i++) {
      particles.push({
        x: player.x + 10,
        y: player.y + player.height,
        vx: (Math.random() - 0.5) * 2 - 2,
        vy: Math.random() * 2 + 1,
        life: 15,
        color: currentTheme.pipe
      });
    }
  }
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") jump();
});
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  jump();
});
canvas.addEventListener("mousedown", jump);

// Start / Restart Handlers
startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", () => {
  gameOverScreen.classList.add("hidden");
  startGame();
});

function startGame() {
  const inputVal = initialsInput.value.trim().toUpperCase();
  playerInitials = inputVal.length > 0 ? inputVal.substring(0, 3) : "ACE";

  // Pick random cosmic theme
  currentTheme = themes[Math.floor(Math.random() * themes.length)];

  player.y = 250;
  player.velocity = 0;
  pipes = [];
  stars = [];
  particles = [];
  score = 0;
  frames = 0;

  // Initialize background ambient space debris
  debris = [];
  for (let i = 0; i < 20; i++) {
    debris.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 1.5 + 0.5
    });
  }

  startScreen.classList.add("hidden");
  gameState = "PLAYING";
}

// Main Game Loop
function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

function update() {
  if (gameState !== "PLAYING") return;

  frames++;
  player.velocity += player.gravity;
  player.y += player.velocity;

  // Floor / Ceiling collisions
  if (player.y + player.height >= canvas.height || player.y <= 0) {
    triggerGameOver();
  }

  // Update Background Debris
  debris.forEach(d => {
    d.x -= d.speed;
    if (d.x < 0) d.x = canvas.width;
  });

  // Spawn Obstacles (Pipes)
  if (frames % 90 === 0) {
    const gap = 130;
    const minTop = 40;
    const maxTop = canvas.height - gap - 60;
    const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;

    pipes.push({
      x: canvas.width,
      top: topHeight,
      bottom: canvas.height - topHeight - gap,
      passed: false
    });

    // 40% chance to spawn a bonus floating star collectible (+5 pts)
    if (Math.random() < 0.4) {
      stars.push({
        x: canvas.width + 25,
        y: topHeight + gap / 2,
        size: 12,
        collected: false
      });
    }
  }

  // Update Pipes & Check Collisions
  pipes.forEach(p => {
    p.x -= 2.5;

    // Collision Check
    if (
      player.x < p.x + 45 &&
      player.x + player.width > p.x &&
      (player.y < p.top || player.y + player.height > canvas.height - p.bottom)
    ) {
      triggerGameOver();
    }

    // Score Check
    if (p.x + 45 < player.x && !p.passed) {
      score++;
      p.passed = true;
    }
  });

  // Remove Off-screen Pipes
  pipes = pipes.filter(p => p.x > -50);

  // Update Star Collectibles (+5 points)
  stars.forEach(s => {
    s.x -= 2.5;
    if (!s.collected && Math.hypot(player.x - s.x, player.y - s.y) < 25) {
      s.collected = true;
      score += 5; // Bonus Points!
    }
  });
  stars = stars.filter(s => s.x > -20 && !s.collected);

  // Update Particle Trail
  particles.forEach(pt => {
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.life--;
  });
  particles = particles.filter(pt => pt.life > 0);
}

function render() {
  // Background
  ctx.fillStyle = currentTheme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Render Background Debris
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  debris.forEach(d => {
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Render Jump Particles
  particles.forEach(pt => {
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Render Pipes
  pipes.forEach(p => {
    ctx.fillStyle = currentTheme.pipe;
    ctx.strokeStyle = currentTheme.pipeBorder;
    ctx.lineWidth = 3;

    // Top Pipe
    ctx.fillRect(p.x, 0, 45, p.top);
    ctx.strokeRect(p.x, 0, 45, p.top);

    // Bottom Pipe
    ctx.fillRect(p.x, canvas.height - p.bottom, 45, p.bottom);
    ctx.strokeRect(p.x, canvas.height - p.bottom, 45, p.bottom);
  });

  // Render Star Collectibles
  stars.forEach(s => {
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#ffd700";
  });
  ctx.shadowBlur = 0; // Reset shadow

  // Render Player / Avatar
  if (customImageObj) {
    ctx.drawImage(customImageObj, player.x, player.y, player.width, player.height);
  } else {
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(selectedAvatar, player.x + player.width / 2, player.y + player.height / 2);
  }

  // Render Live Score Counter
  if (gameState === "PLAYING") {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`SCORE: ${score}`, canvas.width / 2, 40);
  }
}

// Game Over & Leaderboard Handling
function triggerGameOver() {
  gameState = "GAMEOVER";
  container.classList.add("shake");
  setTimeout(() => container.classList.remove("shake"), 300);

  finalScoreEl.textContent = `${playerInitials} - Final Score: ${score}`;
  gameOverScreen.classList.remove("hidden");

  submitScore(playerInitials, score);
}

async function submitScore(name, scoreVal) {
  leaderboardList.innerHTML = `<li class="loading">Submitting & updating leaderboard...</li>`;

  try {
    // 1. Post score to live Cloudflare D1 Worker
    await fetch(`${WORKER_URL}/api/leaderboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, score: scoreVal })
    });

    // 2. Fetch updated Top 15 Leaderboard
    const res = await fetch(`${WORKER_URL}/api/leaderboard`);
    const scores = await res.json();

    leaderboardList.innerHTML = "";
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
      leaderboardList.appendChild(li);
    });
  } catch (err) {
    console.error("Leaderboard error:", err);
    leaderboardList.innerHTML = `<li>Error loading scores. Try again later!</li>`;
  }
}

function htmlEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Start Main Render Loop
loop();