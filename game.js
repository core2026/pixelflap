/**
 * PixelJump Game Engine
 * Version: 1.3.1 (Restored Themes, Assets & Knight Combo)
 */

// ==========================================
// 1. CONSTANTS, THEMES & SYSTEM INITIALIZATION
// ==========================================
const GAME_VERSION = "v1.3.1";
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let score = 0;
let gameOver = false;
let frameCount = 0;

// Dynamic Themes (Restored)
const THEMES = {
  day: { background: "#70c5ce", pipeColor: "#2e7d32", pipeAccent: "#1b5e20" },
  night: { background: "#1a237e", pipeColor: "#4527a0", pipeAccent: "#283593" },
  retro: { background: "#212121", pipeColor: "#ff9800", pipeAccent: "#e65100" }
};
let currentTheme = THEMES.day;

// Character & Sprite Registry
const CHARACTERS = {
  cat: { id: 'cat', name: 'Cat', color: '#ff9800', src: 'assets/cat.png', sprite: new Image() },
  rocket: { id: 'rocket', name: 'Rocket', color: '#e91e63', src: 'assets/rocket.png', sprite: new Image() }
};

// Safely load sprites without overwriting state
Object.keys(CHARACTERS).forEach(key => {
  CHARACTERS[key].sprite.src = CHARACTERS[key].src;
});
let activeCharacter = CHARACTERS.cat;

// Player Entity
const player = {
  x: 80,
  y: 250,
  width: 34,
  height: 34,
  vy: 0,
  gravity: 0.35,
  jumpStrength: -7,
  inventory: { shield: false, sword: false }
};

// Knight Combo State
const knightPowerup = {
  active: false,
  pipesRemaining: 0,
  xOffset: 45,
  slashTimer: 0
};

// Game Containers
let pipes = [];
let items = [];
let particles = [];
let floatingTexts = [];

// ==========================================
// 2. INPUT HANDLERS
// ==========================================
function jump() {
  if (gameOver) {
    resetGame();
    return;
  }
  player.vy = player.jumpStrength;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') jump();
});
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  jump();
});

// ==========================================
// 3. KNIGHT COMBO & ITEM LOGIC
// ==========================================
function spawnItem(pipeX) {
  if (Math.random() < 0.35) {
    const type = Math.random() > 0.5 ? 'shield' : 'sword';
    items.push({
      type: type,
      x: pipeX + 15,
      y: 150 + Math.random() * 250,
      size: 22,
      collected: false
    });
  }
}

function collectItem(type) {
  if (type === 'shield') player.inventory.shield = true;
  if (type === 'sword') player.inventory.sword = true;

  spawnFloatingText(`Got ${type.toUpperCase()}!`, player.x, player.y - 15, "#00e676");

  if (player.inventory.shield && player.inventory.sword) {
    triggerKnightCombo();
  }
}

function triggerKnightCombo() {
  player.inventory.shield = false;
  player.inventory.sword = false;

  knightPowerup.active = true;
  knightPowerup.pipesRemaining = 6;
  knightPowerup.slashTimer = 0;

  score += 50;
  spawnFloatingText("+50 ROYAL RAMPAGE!", player.x, player.y - 30, "#ffd700");
}

// ==========================================
// 4. PARTICLES & TEXT POPUPS
// ==========================================
function createPipeShatterParticles(x, y, width, height) {
  for (let i = 0; i < 20; i++) {
    particles.push({
      x: x + Math.random() * width,
      y: y + Math.random() * height,
      vx: (Math.random() - 0.1) * 7 + 2,
      vy: (Math.random() - 0.5) * 8,
      size: Math.random() * 6 + 4,
      color: currentTheme.pipeColor,
      alpha: 1.0,
      gravity: 0.3,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2
    });
  }
}

function spawnFloatingText(text, x, y, color = '#ffffff') {
  floatingTexts.push({ text, x, y, alpha: 1.0, vy: -1.2, color });
}

// ==========================================
// 5. UPDATE ENGINE
// ==========================================
function spawnPipe() {
  const gap = 140;
  const minHeight = 50;
  const maxHeight = canvas.height - gap - minHeight;
  const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

  pipes.push({
    x: canvas.width,
    width: 54,
    topHeight: topHeight,
    bottomY: topHeight + gap,
    passed: false,
    shattered: false
  });

  spawnItem(canvas.width);
}

function update() {
  if (gameOver) return;
  frameCount++;

  // Shift Theme based on score progression
  if (score >= 20) currentTheme = THEMES.retro;
  else if (score >= 10) currentTheme = THEMES.night;
  else currentTheme = THEMES.day;

  // Player Gravity
  player.vy += player.gravity;
  player.y += player.vy;

  if (player.y + player.height >= canvas.height || player.y <= 0) {
    endGame();
  }

  if (frameCount % 110 === 0) spawnPipe();

  // Update Popups
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy;
    ft.alpha -= 0.02;
    if (ft.alpha <= 0) floatingTexts.splice(i, 1);
  }

  // Update Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.rotation += p.vRot;
    p.alpha -= 0.025;
    if (p.alpha <= 0) particles.splice(i, 1);
  }

  // Update Collectibles
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    item.x -= 2;

    if (!item.collected && 
        player.x < item.x + item.size &&
        player.x + player.width > item.x &&
        player.y < item.y + item.size &&
        player.y + player.height > item.y) {
      item.collected = true;
      collectItem(item.type);
      items.splice(i, 1);
    } else if (item.x + item.size < 0) {
      items.splice(i, 1);
    }
  }

  // Pipe Mechanics & Knight Slicing
  const knightX = player.x + knightPowerup.xOffset;

  for (let i = pipes.length - 1; i >= 0; i--) {
    const pipe = pipes[i];
    pipe.x -= 2;

    if (!pipe.passed && pipe.x + pipe.width < player.x) {
      pipe.passed = true;
      score++;
    }

    if (pipe.shattered) continue;

    if (knightPowerup.active) {
      if (pipe.x <= knightX + 45 && pipe.x + pipe.width >= knightX) {
        pipe.shattered = true;
        knightPowerup.pipesRemaining--;
        knightPowerup.slashTimer = 12;

        createPipeShatterParticles(pipe.x, 0, pipe.width, pipe.topHeight);
        createPipeShatterParticles(pipe.x, pipe.bottomY, pipe.width, canvas.height - pipe.bottomY);
        spawnFloatingText("SLASH!", pipe.x, player.y, "#ff5252");

        if (knightPowerup.pipesRemaining <= 0) knightPowerup.active = false;
      }
    } else {
      const hitBox = (
        player.x + player.width > pipe.x &&
        player.x < pipe.x + pipe.width &&
        (player.y < pipe.topHeight || player.y + player.height > pipe.bottomY)
      );
      if (hitBox) endGame();
    }

    if (pipe.x + pipe.width < 0) pipes.splice(i, 1);
  }
}

// ==========================================
// 6. RENDER ENGINE (RESTORED THEMES & PIPES)
// ==========================================
function draw() {
  // 1. Render Dynamic Theme Background
  ctx.fillStyle = currentTheme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Render Pipes with Theme Styling & Caps
  pipes.forEach(pipe => {
    if (pipe.shattered) return;

    ctx.fillStyle = currentTheme.pipeColor;
    ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
    ctx.fillRect(pipe.x, pipe.bottomY, pipe.width, canvas.height - pipe.bottomY);

    // Pipe Cap Accents
    ctx.fillStyle = currentTheme.pipeAccent;
    ctx.fillRect(pipe.x - 3, pipe.topHeight - 15, pipe.width + 6, 15);
    ctx.fillRect(pipe.x - 3, pipe.bottomY, pipe.width + 6, 15);
  });

  // 3. Render Collectible Items
  items.forEach(item => {
    ctx.font = "20px sans-serif";
    ctx.fillText(item.type === 'shield' ? '🛡️' : '⚔️', item.x, item.y);
  });

  // 4. Render Shatter Particles
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  });

  // 5. Render Player (Sprite with Fallback)
  if (activeCharacter.sprite.complete && activeCharacter.sprite.naturalWidth > 0) {
    ctx.drawImage(activeCharacter.sprite, player.x, player.y, player.width, player.height);
  } else {
    ctx.fillStyle = activeCharacter.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
  }

  // 6. Render Knight Avatar
  if (knightPowerup.active) {
    drawKnight(player.x + knightPowerup.xOffset, player.y);
  }

  // 7. Render Floating Text
  floatingTexts.forEach(ft => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ft.alpha);
    ctx.font = "bold 15px sans-serif";
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  });

  // 8. HUD & UI Overlays
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(`Score: ${score}`, 15, 30);

  ctx.font = "12px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.fillText(GAME_VERSION, canvas.width - 55, 20);

  let invStatus = "Items: ";
  if (player.inventory.shield) invStatus += "🛡️ ";
  if (player.inventory.sword) invStatus += "⚔️ ";
  ctx.font = "14px sans-serif";
  ctx.fillText(invStatus, 15, 55);

  if (knightPowerup.active) {
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(`Knight Destruction Left: ${knightPowerup.pipesRemaining}`, 15, 80);
  }

  if (gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = "16px sans-serif";
    ctx.fillText("Tap or Press Space to Restart", canvas.width / 2, canvas.height / 2 + 25);
    ctx.textAlign = "left";
  }
}

function drawKnight(x, y) {
  ctx.save();
  ctx.fillStyle = "#b0bec5";
  ctx.fillRect(x, y - 5, 26, 36);
  ctx.fillStyle = "#d32f2f";
  ctx.fillRect(x - 8, y - 2, 8, 28);
  ctx.fillStyle = "#263238";
  ctx.fillRect(x + 14, y, 10, 6);

  if (knightPowerup.slashTimer > 0) {
    knightPowerup.slashTimer--;
    ctx.beginPath();
    ctx.arc(x + 30, y + 15, 35, -Math.PI / 3, Math.PI / 3, false);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#e0f7fa";
    ctx.stroke();
  } else {
    ctx.fillStyle = "#cfd8dc";
    ctx.fillRect(x + 22, y - 15, 4, 30);
  }
  ctx.restore();
}

function endGame() { gameOver = true; }

function resetGame() {
  player.y = 250;
  player.vy = 0;
  player.inventory.shield = false;
  player.inventory.sword = false;
  knightPowerup.active = false;
  knightPowerup.pipesRemaining = 0;
  score = 0;
  pipes = [];
  items = [];
  particles = [];
  floatingTexts = [];
  frameCount = 0;
  gameOver = false;
}

// Start Game Loop
gameLoop();
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}