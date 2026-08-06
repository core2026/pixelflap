/**
 * PixelJump Game Engine
 * Version: 1.3.0 (Medieval Knight Combo Update)
 */

// ==========================================
// 1. CONSTANTS & INITIALIZATION
// ==========================================
const GAME_VERSION = "v1.3.0";
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let score = 0;
let gameOver = false;
let frameCount = 0;

// Isolated Character Selection System (Prevents Cat & Rocket sprite overwriting)
const CHARACTERS = {
  cat: {
    id: 'cat',
    name: 'Cat',
    color: '#ff9800',
    imageSrc: 'assets/cat.png',
    sprite: new Image()
  },
  rocket: {
    id: 'rocket',
    name: 'Rocket',
    color: '#e91e63',
    imageSrc: 'assets/rocket.png',
    sprite: new Image()
  }
};

// Preload sprites independently
Object.keys(CHARACTERS).forEach(key => {
  CHARACTERS[key].sprite.src = CHARACTERS[key].imageSrc;
});

// Selected Player State
let currentCharacter = CHARACTERS.cat;

const player = {
  x: 80,
  y: 250,
  width: 32,
  height: 32,
  vy: 0,
  gravity: 0.35,
  jumpStrength: -7,
  inventory: { shield: false, sword: false }
};

// Medieval Knight Combo State
const knightPowerup = {
  active: false,
  pipesRemaining: 0,
  xOffset: 45,
  slashTimer: 0
};

// Game Entities Arrays
let pipes = [];
let items = [];
let particles = [];
let floatingTexts = [];

// ==========================================
// 2. INPUT & EVENT LISTENERS
// ==========================================
function jump() {
  if (gameOver) {
    resetGame();
    return;
  }
  player.vy = player.jumpStrength;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    jump();
  }
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  jump();
});

// ==========================================
// 3. COMBO & ITEM LOGIC
// ==========================================
function spawnItem(pipeX) {
  // 30% chance to spawn shield or sword when pipes spawn
  if (Math.random() < 0.3) {
    const type = Math.random() > 0.5 ? 'shield' : 'sword';
    items.push({
      type: type,
      x: pipeX + 20,
      y: 200 + Math.random() * 150,
      size: 20,
      collected: false
    });
  }
}

function collectItem(type) {
  if (type === 'shield') player.inventory.shield = true;
  if (type === 'sword') player.inventory.sword = true;

  spawnFloatingText(`Picked up ${type.toUpperCase()}!`, player.x, player.y - 15, "#00e676");

  // Trigger Medieval Knight Combo if player holds both
  if (player.inventory.shield && player.inventory.sword) {
    triggerKnightCombo();
  }
}

function triggerKnightCombo() {
  // Consume items
  player.inventory.shield = false;
  player.inventory.sword = false;

  // Activate Knight state
  knightPowerup.active = true;
  knightPowerup.pipesRemaining = 6;
  knightPowerup.slashTimer = 0;

  // Award bonus points & popup
  score += 50;
  spawnFloatingText("+50 ROYAL RAMPAGE!", player.x, player.y - 30, "#ffd700");
}

// ==========================================
// 4. PARTICLES & VISUAL POPUPS
// ==========================================
function createPipeShatterParticles(x, y, width, height) {
  const particleCount = 20;
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: x + Math.random() * width,
      y: y + Math.random() * height,
      vx: (Math.random() - 0.1) * 7 + 2,
      vy: (Math.random() - 0.5) * 8,
      size: Math.random() * 6 + 4,
      color: Math.random() > 0.5 ? '#2e7d32' : '#4caf50',
      alpha: 1.0,
      gravity: 0.3,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2
    });
  }
}

function spawnFloatingText(text, x, y, color = '#ffffff') {
  floatingTexts.push({
    text: text,
    x: x,
    y: y,
    alpha: 1.0,
    vy: -1.2,
    color: color
  });
}

// ==========================================
// 5. GAME LOGIC & COLLISIONS
// ==========================================
function spawnPipe() {
  const gap = 140;
  const minHeight = 50;
  const maxHeight = canvas.height - gap - minHeight;
  const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

  pipes.push({
    x: canvas.width,
    width: 50,
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

  // Apply Player Physics
  player.vy += player.gravity;
  player.y += player.vy;

  // Floor / Ceiling Boundaries
  if (player.y + player.height >= canvas.height || player.y <= 0) {
    endGame();
  }

  // Spawn Pipes every 120 frames
  if (frameCount % 120 === 0) {
    spawnPipe();
  }

  // Update Floating Texts
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

  // Update Collectible Items
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    item.x -= 2;

    // Item Pickup Detection
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

  // Update Pipes & Collision Checks
  const knightX = player.x + knightPowerup.xOffset;

  for (let i = pipes.length - 1; i >= 0; i--) {
    const pipe = pipes[i];
    pipe.x -= 2;

    // Pass Pipe Scoring
    if (!pipe.passed && pipe.x + pipe.width < player.x) {
      pipe.passed = true;
      score++;
    }

    if (pipe.shattered) continue;

    // Knight Destroy Logic
    if (knightPowerup.active) {
      if (pipe.x <= knightX + 45 && pipe.x + pipe.width >= knightX) {
        pipe.shattered = true;
        knightPowerup.pipesRemaining--;
        knightPowerup.slashTimer = 12;

        // Shatter Effect & Text
        createPipeShatterParticles(pipe.x, 0, pipe.width, pipe.topHeight);
        createPipeShatterParticles(pipe.x, pipe.bottomY, pipe.width, canvas.height - pipe.bottomY);
        spawnFloatingText("SLASH!", pipe.x, player.y, "#ff5252");

        if (knightPowerup.pipesRemaining <= 0) {
          knightPowerup.active = false;
        }
      }
    } else {
      // Standard Box Collision Check
      const hitBox = (
        player.x + player.width > pipe.x &&
        player.x < pipe.x + pipe.width &&
        (player.y < pipe.topHeight || player.y + player.height > pipe.bottomY)
      );

      if (hitBox) {
        endGame();
      }
    }

    // Cleanup off-screen pipes
    if (pipe.x + pipe.width < 0) {
      pipes.splice(i, 1);
    }
  }
}

// ==========================================
// 6. RENDERING PIPELINE
// ==========================================
function draw() {
  // Clear Frame
  ctx.fillStyle = "#70c5ce";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 1. Draw Pipes
  pipes.forEach(pipe => {
    if (pipe.shattered) return;
    ctx.fillStyle = "#388e3c";
    ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
    ctx.fillRect(pipe.x, pipe.bottomY, pipe.width, canvas.height - pipe.bottomY);
  });

  // 2. Draw Items
  items.forEach(item => {
    ctx.font = "20px sans-serif";
    const icon = item.type === 'shield' ? '🛡️' : '⚔️';
    ctx.fillText(icon, item.x, item.y);
  });

  // 3. Draw Shatter Particles
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  });

  // 4. Draw Player Character
  if (currentCharacter.sprite.complete && currentCharacter.sprite.naturalWidth !== 0) {
    ctx.drawImage(currentCharacter.sprite, player.x, player.y, player.width, player.height);
  } else {
    // Fallback block if sprite asset is loading
    ctx.fillStyle = currentCharacter.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
  }

  // 5. Draw Knight Avatar (If active)
  if (knightPowerup.active) {
    drawKnight(player.x + knightPowerup.xOffset, player.y);
  }

  // 6. Draw Floating Score Text
  floatingTexts.forEach(ft => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ft.alpha);
    ctx.font = "bold 15px sans-serif";
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  });

  // 7. HUD & Inventory Overlay
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(`Score: ${score}`, 15, 30);

  // Version Display
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.fillText(GAME_VERSION, canvas.width - 55, 20);

  // Inventory Status
  let invStatus = "Items: ";
  if (player.inventory.shield) invStatus += "🛡️ ";
  if (player.inventory.sword) invStatus += "⚔️ ";
  ctx.font = "14px sans-serif";
  ctx.fillText(invStatus, 15, 55);

  // Knight Rampage Counter Status
  if (knightPowerup.active) {
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(`Knight Destruction Left: ${knightPowerup.pipesRemaining}`, 15, 80);
  }

  // Game Over Screen
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

  // Armor Body
  ctx.fillStyle = "#b0bec5";
  ctx.fillRect(x, y - 5, 26, 36);

  // Red Cape
  ctx.fillStyle = "#d32f2f";
  ctx.fillRect(x - 8, y - 2, 8, 28);

  // Visor
  ctx.fillStyle = "#263238";
  ctx.fillRect(x + 14, y, 10, 6);

  // Sword Swing
  if (knightPowerup.slashTimer > 0) {
    knightPowerup.slashTimer--;
    ctx.beginPath();
    ctx.arc(x + 30, y + 15, 35, -Math.PI / 3, Math.PI / 3, false);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#e0f7fa";
    ctx.stroke();
  } else {
    // Upright Sword
    ctx.fillStyle = "#cfd8dc";
    ctx.fillRect(x + 22, y - 15, 4, 30);
  }

  ctx.restore();
}

function endGame() {
  gameOver = true;
}

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

// ==========================================
// 7. MAIN GAME LOOP
// ==========================================
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Start Game Engine
gameLoop();