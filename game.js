// ==========================================
// 1. GAME STATE & POWER-UP CONFIGURATION
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let score = 0;

// Player state
const player = {
  x: 100,
  y: 250,
  width: 32,
  height: 32,
  inventory: { shield: false, sword: false }
};

// Medieval Knight Power-Up State
const knightPowerup = {
  active: false,
  pipesRemaining: 0,
  xOffset: 40, // Sits slightly ahead of player
  yOffset: 0,
  animFrame: 0,
  slashTimer: 0
};

// Game Entities
let pipes = [];
let particles = [];
let floatingTexts = [];

// ==========================================
// 2. COMBO & POWER-UP SYSTEM
// ==========================================

/**
 * Call this whenever player collides with a power-up item
 */
function collectItem(type) {
  if (type === 'shield') player.inventory.shield = true;
  if (type === 'sword') player.inventory.sword = true;

  // Check for combo activation
  if (player.inventory.shield && player.inventory.sword) {
    triggerKnightCombo();
  }
}

/**
 * Triggers the Royal Rampage mode
 */
function triggerKnightCombo() {
  // Reset inventory items
  player.inventory.shield = false;
  player.inventory.sword = false;

  // Activate Knight
  knightPowerup.active = true;
  knightPowerup.pipesRemaining = 6;
  knightPowerup.slashTimer = 0;

  // Bonus Points & Visual Text
  score += 50;
  spawnFloatingText("+50 ROYAL RAMPAGE!", player.x, player.y - 20, "#ffd700");
}

// ==========================================
// 3. VISUAL EFFECTS (PARTICLES & FLOATING TEXT)
// ==========================================

/**
 * Spawns particle debris when a pipe shatters
 */
function createPipeShatterParticles(x, y, width, height) {
  const particleCount = 24;
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: x + Math.random() * width,
      y: y + Math.random() * height,
      vx: (Math.random() - 0.2) * 8 + 2,  // Forward burst momentum
      vy: (Math.random() - 0.5) * 8,      // Vertical explosion spread
      size: Math.random() * 6 + 4,
      color: Math.random() > 0.5 ? '#2e7d32' : '#4caf50', // Pipe green shades
      alpha: 1.0,
      gravity: 0.35,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2
    });
  }
}

/**
 * Floating bonus score text popup
 */
function spawnFloatingText(text, x, y, color = '#ffffff') {
  floatingTexts.push({
    text: text,
    x: x,
    y: y,
    alpha: 1.0,
    vy: -1.5,
    color: color
  });
}

// ==========================================
// 4. COLLISION & LOGIC UPDATES
// ==========================================

function updateGameLogic() {
  // A. Update Floating Text Popups
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy;
    ft.alpha -= 0.02;
    if (ft.alpha <= 0) floatingTexts.splice(i, 1);
  }

  // B. Update Pipe Shatter Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.rotation += p.vRot;
    p.alpha -= 0.025;
    if (p.alpha <= 0) particles.splice(i, 1);
  }

  // C. Update Pipe Collisions & Knight Slicing
  const knightX = player.x + knightPowerup.xOffset;

  pipes.forEach(pipe => {
    if (pipe.shattered) return;

    if (knightPowerup.active) {
      // Check if pipe reaches Knight's weapon range
      if (pipe.x <= knightX + 40 && pipe.x + pipe.width >= knightX) {
        // Shatter pipe pair (top & bottom)
        pipe.shattered = true;
        knightPowerup.pipesRemaining--;
        knightPowerup.slashTimer = 10; // Trigger slash anim frame duration

        // Spawn shattering particle effect
        createPipeShatterParticles(pipe.x, 0, pipe.width, pipe.topHeight);
        createPipeShatterParticles(pipe.x, pipe.bottomY, pipe.width, canvas.height - pipe.bottomY);
        spawnFloatingText("SLASH!", pipe.x, player.y, "#ff5252");

        // Deactivate Knight once 6 pipes destroyed
        if (knightPowerup.pipesRemaining <= 0) {
          knightPowerup.active = false;
        }
      }
    } else {
      // Normal collision handling when knight is inactive
      if (checkStandardCollision(player, pipe)) {
        console.log("Game Over!");
      }
    }
  });
}

function checkStandardCollision(player, pipe) {
  // Standard bounding box collision check
  const inX = player.x + player.width > pipe.x && player.x < pipe.x + pipe.width;
  const hitTop = player.y < pipe.topHeight;
  const hitBottom = player.y + player.height > pipe.bottomY;
  return inX && (hitTop || hitBottom);
}

// ==========================================
// 5. RENDERING PIPELINES
// ==========================================

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Draw Pipes
  pipes.forEach(pipe => {
    if (pipe.shattered) return; // Don't render broken pipes

    ctx.fillStyle = "#388e3c";
    // Top Pipe
    ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
    // Bottom Pipe
    ctx.fillRect(pipe.x, pipe.bottomY, pipe.width, canvas.height - pipe.bottomY);
  });

  // 2. Draw Shatter Particles
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  });

  // 3. Draw Player
  ctx.fillStyle = "#2196f3";
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // 4. Draw Knight (If active)
  if (knightPowerup.active) {
    drawKnight(player.x + knightPowerup.xOffset, player.y);
  }

  // 5. Draw Floating Text Popups
  floatingTexts.forEach(ft => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ft.alpha);
    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  });

  // 6. HUD / Knight Counter Status
  if (knightPowerup.active) {
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#ffd700";
    ctx.fillText(`Knight Pipes Remaining: ${knightPowerup.pipesRemaining}`, 10, 30);
  }
}

/**
 * Draws Knight Avatar & Slash Visual FX
 * (Replace rect shapes with custom Knight sprite sheet when available)
 */
function drawKnight(x, y) {
  ctx.save();

  // Knight Body / Armor
  ctx.fillStyle = "#b0bec5";
  ctx.fillRect(x, y - 5, 28, 38);

  // Red Cape
  ctx.fillStyle = "#d32f2f";
  ctx.fillRect(x - 8, y - 2, 8, 30);

  // Helmet Visor
  ctx.fillStyle = "#263238";
  ctx.fillRect(x + 14, y, 10, 6);

  // Sword & Slash Arc
  if (knightPowerup.slashTimer > 0) {
    knightPowerup.slashTimer--;

    // Animated Slash Arc
    ctx.beginPath();
    ctx.arc(x + 30, y + 15, 35, -Math.PI / 3, Math.PI / 3, false);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#e0f7fa";
    ctx.stroke();
  } else {
    // Resting Sword position
    ctx.fillStyle = "#cfd8dc";
    ctx.fillRect(x + 24, y - 15, 4, 30);
  }

  ctx.restore();
}