// Worker API Endpoint
const WORKER_URL = "https://pixelflap-main.acekallas.workers.dev";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const container = document.getElementById("game-container");

// Dynamic Resolution Scaler
function resizeCanvas() {
  canvas.width = container.clientWidth || window.innerWidth;
  canvas.height = container.clientHeight || window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => setTimeout(resizeCanvas, 200));

resizeCanvas();
setTimeout(resizeCanvas, 100);

// UI Elements
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const infoModal = document.getElementById("info-modal");
const infoBtn = document.getElementById("info-btn");
const closeInfoBtn = document.getElementById("close-info-btn");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const changeCharBtn = document.getElementById("change-char-btn");
const initialsInput = document.getElementById("player-initials");
const avatarBtns = document.querySelectorAll(".avatar-btn");
const customAvatarInput = document.getElementById("custom-avatar-input");
const leaderboardList = document.getElementById("leaderboard-list");
const finalScoreEl = document.getElementById("final-score");

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
let playerInitials = "";
let selectedAvatar = "🚀";
let customImageObj = null;

// Dynamic Player Avatar Settings
const player = {
  x: 60,
  y: 250,
  size: 44,
  gravity: 0.45,
  jump: -7.5,
  velocity: 0,
  hasShield: false
};

// Power-Up State
const activePowerUps = {
  slowMoTimer: 0,
  doubleScoreTimer: 0
};

// Game Objects
let pipes = [];
let stars = [];
let powerUpItems = [];
let comets = [];
let debris = [];
let particles = [];
let popups = [];

// --- WEB AUDIO API & RETRO SYNTH BGM ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let bgmTimer = null;
let bgmStep = 0;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function triggerHaptic(pattern = [30]) {
  if ("vibrate" in navigator) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

function playSound(type) {
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === "jump") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.1);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === "star") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.08);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === "powerup") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.25);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } else if (type === "shield_break") {
    osc.type = "square";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === "crash") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }
}

function startBGM() {
  stopBGM();
  bgmStep = 0;
  const bassNotes = [110, 110, 130.81, 110, 146.83, 130.81, 98, 110];
  
  bgmTimer = setInterval(() => {
    if (gameState !== "PLAYING" || !audioCtx) return;
    
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.type = "triangle";
    osc.frequency.setValueAtTime(bassNotes[bgmStep % bassNotes.length], now);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.start(now);
    osc.stop(now + 0.2);

    bgmStep++;
  }, 220);
}

function stopBGM() {
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

infoBtn.addEventListener("click", () => {
  infoModal.classList.remove("hidden");
});

closeInfoBtn.addEventListener("click", () => {
  infoModal.classList.add("hidden");
});

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

initialsInput.addEventListener("input", () => {
  initialsInput.classList.remove("invalid");
});

function jump() {
  if (gameState !== "PLAYING") return;

  initAudio();
  player.velocity = player.jump;
  playSound("jump");

  for (let i = 0; i < 6; i++) {
    particles.push({
      x: player.x + 10,
      y: player.y + player.size,
      vx: (Math.random() - 0.5) * 2 - 2,
      vy: Math.random() * 2 + 1,
      life: 18,
      color: currentTheme.pipe
    });
  }
}

function addPopupText(txt, x, y, color = "#00e5ff") {
  popups.push({ text: txt, x: x, y: y, alpha: 1.0, color: color });
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") jump();
});

canvas.addEventListener("touchstart", (e) => {
  if (gameState === "PLAYING") {
    e.preventDefault();
    jump();
  }
}, { passive: false });

canvas.addEventListener("mousedown", (e) => {
  if (gameState === "PLAYING") {
    jump();
  }
});

startBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  initAudio();
  
  const inputVal = initialsInput.value.trim().toUpperCase();
  if (!inputVal || inputVal.length < 1 || inputVal.length > 3) {
    initialsInput.classList.add("invalid");
    initialsInput.focus();
    triggerHaptic([50, 50]);
    return;
  }
  
  playerInitials = inputVal;
  startGame();
});

restartBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  initAudio();
  gameOverScreen.classList.add("hidden");
  startGame();
});

changeCharBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  stopBGM();
  gameState = "MENU";
  gameOverScreen.classList.add("hidden");
  infoModal.classList.add("hidden");
  startScreen.classList.remove("hidden");
  initialsInput.focus();
});

function startGame() {
  resizeCanvas();
  currentTheme = themes[Math.floor(Math.random() * themes.length)];

  player.y = canvas.height / 2;
  player.velocity = player.jump;
  player.hasShield = false;
  activePowerUps.slowMoTimer = 0;
  activePowerUps.doubleScoreTimer = 0;

  pipes = [];
  stars = [];
  powerUpItems = [];
  comets = [];
  particles = [];
  popups = [];
  score = 0;
  frames = 0;

  debris = [];
  for (let i = 0; i < 22; i++) {
    debris.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2.5 + 1,
      baseSpeed: Math.random() * 1.5 + 0.5
    });
  }

  startScreen.classList.add("hidden");
  infoModal.classList.add("hidden");
  
  setTimeout(() => {
    gameState = "PLAYING";
    startBGM();
  }, 50);
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

function update() {
  if (gameState !== "PLAYING") return;

  frames++;

  const isSlowMo = activePowerUps.slowMoTimer > 0;
  if (isSlowMo) activePowerUps.slowMoTimer--;
  if (activePowerUps.doubleScoreTimer > 0) activePowerUps.doubleScoreTimer--;

  const speedMult = isSlowMo ? 0.55 : 1.0;
  const gameSpeed = 2.5 * speedMult;

  player.velocity += player.gravity * (isSlowMo ? 0.75 : 1.0);
  player.y += player.velocity;

  if (frames > 5) {
    if (player.y + player.size >= canvas.height || player.y <= 0) {
      if (player.hasShield) {
        player.hasShield = false;
        player.velocity = -6;
        playSound("shield_break");
        triggerHaptic([40, 30, 40]);
        addPopupText("SHIELD BROKEN!", player.x, player.y - 10, "#ff1744");
      } else {
        triggerGameOver();
        return;
      }
    }
  }

  const warpBonus = Math.min(score * 0.1, 4.0);
  debris.forEach(d => {
    d.x -= (d.baseSpeed + warpBonus) * speedMult;
    if (d.x < 0) d.x = canvas.width;
  });

  const spawnRate = isSlowMo ? 120 : 90;
  if (frames % spawnRate === 0) {
    const gap = 145;
    const minTop = 40;
    const maxTop = canvas.height - gap - 60;
    const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;

    pipes.push({
      x: canvas.width,
      top: topHeight,
      bottom: canvas.height - topHeight - gap,
      passed: false,
      isMoving: score >= 12 && Math.random() < 0.5,
      offset: 0,
      dir: 1
    });

    const rand = Math.random();
    if (rand < 0.35) {
      stars.push({ x: canvas.width + 25, y: topHeight + gap / 2, size: 14, collected: false });
    } else if (rand > 0.75) {
      const types = ["shield", "slowMo", "2x"];
      const pType = types[Math.floor(Math.random() * types.length)];
      powerUpItems.push({ x: canvas.width + 25, y: topHeight + gap / 2, type: pType, collected: false });
    }
  }

  if (score >= 8 && frames % 260 === 0 && Math.random() < 0.6) {
    comets.push({
      x: canvas.width + 30,
      y: Math.random() * (canvas.height - 150) + 50,
      vx: -(Math.random() * 2 + 4) * speedMult,
      vy: (Math.random() - 0.5) * 1.5,
      size: 10
    });
  }

  pipes.forEach(p => {
    p.x -= gameSpeed;

    if (p.isMoving) {
      p.offset += 0.8 * p.dir;
      if (Math.abs(p.offset) > 25) p.dir *= -1;
    }

    const currentTop = p.top + (p.isMoving ? p.offset : 0);
    const currentBottom = p.bottom - (p.isMoving ? p.offset : 0);

    if (
      player.x < p.x + 45 &&
      player.x + player.size > p.x &&
      (player.y < currentTop || player.y + player.size > canvas.height - currentBottom)
    ) {
      if (player.hasShield) {
        player.hasShield = false;
        p.x = -100;
        playSound("shield_break");
        triggerHaptic([40, 30, 40]);
        addPopupText("SHIELD BROKEN!", player.x, player.y - 10, "#ff1744");
      } else {
        triggerGameOver();
        return;
      }
    }

    if (p.x + 45 < player.x && !p.passed) {
      const pts = activePowerUps.doubleScoreTimer > 0 ? 2 : 1;
      score += pts;
      p.passed = true;
      triggerHaptic([20]);
      addPopupText(`+${pts}`, player.x + 10, player.y - 10, "#76ff03");
    }
  });
  pipes = pipes.filter(p => p.x > -50);

  comets.forEach(c => {
    c.x += c.vx;
    c.y += c.vy;

    const pX = player.x + player.size / 2;
    const pY = player.y + player.size / 2;
    if (Math.hypot(pX - c.x, pY - c.y) < player.size / 2 + c.size) {
      if (player.hasShield) {
        player.hasShield = false;
        c.x = -100;
        playSound("shield_break");
        triggerHaptic([40, 30, 40]);
        addPopupText("SHIELD BROKEN!", player.x, player.y - 10, "#ff1744");
      } else {
        triggerGameOver();
        return;
      }
    }
  });
  comets = comets.filter(c => c.x > -40);

  const playerCenterX = player.x + player.size / 2;
  const playerCenterY = player.y + player.size / 2;

  stars.forEach(s => {
    s.x -= gameSpeed;
    if (!s.collected && Math.hypot(playerCenterX - s.x, playerCenterY - s.y) < player.size / 2 + s.size) {
      s.collected = true;
      const pts = activePowerUps.doubleScoreTimer > 0 ? 10 : 5;
      score += pts;
      playSound("star");
      triggerHaptic([35]);
      addPopupText(`+${pts}`, s.x, s.y, "#ffd700");
    }
  });
  stars = stars.filter(s => s.x > -20 && !s.collected);

  powerUpItems.forEach(pu => {
    pu.x -= gameSpeed;
    if (!pu.collected && Math.hypot(playerCenterX - pu.x, playerCenterY - pu.y) < player.size / 2 + 16) {
      pu.collected = true;
      playSound("powerup");
      triggerHaptic([50, 50]);

      if (pu.type === "shield") {
        player.hasShield = true;
        addPopupText("SHIELD!", pu.x, pu.y, "#00e5ff");
      } else if (pu.type === "slowMo") {
        activePowerUps.slowMoTimer = 300;
        addPopupText("SLOW-MO!", pu.x, pu.y, "#d500f9");
      } else if (pu.type === "2x") {
        activePowerUps.doubleScoreTimer = 360;
        addPopupText("2X SCORE!", pu.x, pu.y, "#76ff03");
      }
    }
  });
  powerUpItems = powerUpItems.filter(pu => pu.x > -30 && !pu.collected);

  particles.forEach(pt => {
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.life--;
  });
  particles = particles.filter(pt => pt.life > 0);

  popups.forEach(pop => {
    pop.y -= 1.2;
    pop.alpha -= 0.02;
  });
  popups = popups.filter(pop => pop.alpha > 0);
}

function render() {
  ctx.fillStyle = currentTheme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  debris.forEach(d => {
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
    ctx.fill();
  });

  particles.forEach(pt => {
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  pipes.forEach(p => {
    const currentTop = p.top + (p.isMoving ? p.offset : 0);
    const currentBottom = p.bottom - (p.isMoving ? p.offset : 0);

    ctx.fillStyle = p.isMoving ? "#ff1744" : currentTheme.pipe;
    ctx.strokeStyle = currentTheme.pipeBorder;
    ctx.lineWidth = 3;

    ctx.fillRect(p.x, 0, 45, currentTop);
    ctx.strokeRect(p.x, 0, 45, currentTop);

    ctx.fillRect(p.x, canvas.height - currentBottom, 45, currentBottom);
    ctx.strokeRect(p.x, canvas.height - currentBottom, 45, currentBottom);
  });

  comets.forEach(c => {
    ctx.save();
    ctx.fillStyle = "#ff3d00";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#ff9100";
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  stars.forEach(s => {
    ctx.save();
    ctx.fillStyle = "#ffd700";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ffd700";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  powerUpItems.forEach(pu => {
    ctx.save();
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const icon = pu.type === "shield" ? "🛡️" : pu.type === "slowMo" ? "⏱️" : "⚡";
    ctx.fillText(icon, pu.x, pu.y);
    ctx.restore();
  });

  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;
  const radius = player.size / 2;

  if (customImageObj) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(customImageObj, player.x, player.y, player.size, player.size);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.font = `${player.size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(selectedAvatar, centerX, centerY);
  }

  if (player.hasShield) {
    ctx.save();
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 3;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#00e5ff";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  popups.forEach(pop => {
    ctx.save();
    ctx.fillStyle = pop.color;
    ctx.globalAlpha = pop.alpha;
    ctx.font = "bold 16px 'Segoe UI', sans-serif";
    ctx.fillText(pop.text, pop.x, pop.y);
    ctx.restore();
  });

  let hudOffset = 70;
  if (activePowerUps.slowMoTimer > 0) {
    ctx.fillStyle = "#d500f9";
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.fillText(`⏱️ SLOW-MO: ${(activePowerUps.slowMoTimer / 60).toFixed(1)}s`, 10, hudOffset);
    hudOffset += 20;
  }
  if (activePowerUps.doubleScoreTimer > 0) {
    ctx.fillStyle = "#76ff03";
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.fillText(`⚡ 2X SCORE: ${(activePowerUps.doubleScoreTimer / 60).toFixed(1)}s`, 10, hudOffset);
  }

  if (gameState === "PLAYING") {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`SCORE: ${score}`, canvas.width / 2, 40);
  }
}

function triggerGameOver() {
  gameState = "GAMEOVER";
  stopBGM();
  playSound("crash");
  triggerHaptic([100, 50, 100]);

  container.classList.add("shake");
  setTimeout(() => container.classList.remove("shake"), 300);

  finalScoreEl.textContent = `${playerInitials} - Final Score: ${score}`;
  gameOverScreen.classList.remove("hidden");

  submitScore(playerInitials, score);
}

async function submitScore(name, scoreVal) {
  leaderboardList.innerHTML = `<li class="loading">Submitting & updating leaderboard...</li>`;

  try {
    await fetch(`${WORKER_URL}/api/leaderboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, score: scoreVal })
    });

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

loop();