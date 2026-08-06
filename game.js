/**
 * PixelJump Full Engine
 * Version: 1.4.0 (Restored Themes, Web Audio, Leaderboards & Knight Rampage Combo)
 */

window.addEventListener('DOMContentLoaded', () => {
  const GAME_VERSION = "v1.4.0";
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // ==========================================
  // 1. GAME STATE & THEME ENGINE
  // ==========================================
  let score = 0;
  let highScore = localStorage.getItem('pixeljump_highscore') || 0;
  let gameOver = false;
  let frameCount = 0;
  let audioMuted = false;

  // Full Dynamic Themes Palette
  const THEMES = {
    day: {
      name: 'Day',
      background: "#70c5ce",
      pipeColor: "#2e7d32",
      pipeAccent: "#1b5e20",
      cloudColor: "rgba(255, 255, 255, 0.7)"
    },
    sunset: {
      name: 'Sunset',
      background: "#ff7043",
      pipeColor: "#e65100",
      pipeAccent: "#bf360c",
      cloudColor: "rgba(255, 204, 188, 0.6)"
    },
    night: {
      name: 'Night',
      background: "#1a237e",
      pipeColor: "#4527a0",
      pipeAccent: "#283593",
      cloudColor: "rgba(159, 168, 218, 0.4)"
    },
    retro: {
      name: 'Cyberpunk',
      background: "#212121",
      pipeColor: "#00e676",
      pipeAccent: "#00a152",
      cloudColor: "rgba(255, 0, 128, 0.3)"
    }
  };
  let currentTheme = THEMES.day;

  // Background Environment Elements
  const clouds = [
    { x: 50, y: 80, speed: 0.4, size: 40 },
    { x: 220, y: 140, speed: 0.6, size: 60 },
    { x: 340, y: 50, speed: 0.3, size: 45 }
  ];

  // ==========================================
  // 2. AUDIO SYNTHESIZER (WEB AUDIO API)
  // ==========================================
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) audioCtx = new AudioCtx();
  }

  function playSound(type) {
    if (audioMuted || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

      if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'item') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'shatter') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      // Ignore audio resume errors
    }
  }

  // ==========================================
  // 3. PLAYER & CHARACTERS
  // ==========================================
  const CHARACTERS = {
    cat: { id: 'cat', name: 'Cat', color: '#ff9800', src: 'cat.png', loaded: false, sprite: new Image() },
    rocket: { id: 'rocket', name: 'Rocket', color: '#e91e63', src: 'rocket.png', loaded: false, sprite: new Image() }
  };

  Object.keys(CHARACTERS).forEach(key => {
    const char = CHARACTERS[key];
    char.sprite.onload = () => { char.loaded = true; };
    char.sprite.onerror = () => { char.loaded = false; };
    char.sprite.src = char.src;
  });

  let activeCharacter = CHARACTERS.cat;
  let customAvatarImg = null;

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

  // Medieval Knight Combo State
  const knightPowerup = {
    active: false,
    pipesRemaining: 0,
    xOffset: 45,
    slashTimer: 0
  };

  // Entity Containers
  let pipes = [];
  let items = [];
  let particles = [];
  let floatingTexts = [];

  // ==========================================
  // 4. INPUT & UI EVENT LISTENERS
  // ==========================================
  function jump() {
    initAudio();
    if (gameOver) {
      resetGame();
      return;
    }
    player.vy = player.jumpStrength;
    playSound('jump');
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') jump();
  });
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    jump();
  });

  document.getElementById('audioToggle').addEventListener('click', (e) => {
    audioMuted = !audioMuted;
    e.target.innerText = audioMuted ? '🔇 Audio Off' : '🔊 Mute Audio';
  });

  document.getElementById('avatarUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => {
          customAvatarImg = img;
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // ==========================================
  // 5. KNIGHT COMBO & ITEM LOGIC
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

    playSound('item');
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
    playSound('item');
    spawnFloatingText("+50 KNIGHT RAMPAGE!", player.x, player.y - 30, "#ffd700");
  }

  function createPipeShatterParticles(x, y, width, height) {
    for (let i = 0; i < 22; i++) {
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
  // 6. PIPELINE & GAME ENGINE UPDATES
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

    // Dynamic Theme Switching Progression
    if (score >= 30) currentTheme = THEMES.retro;
    else if (score >= 20) currentTheme = THEMES.night;
    else if (score >= 10) currentTheme = THEMES.sunset;
    else currentTheme = THEMES.day;

    // Cloud Animations
    clouds.forEach(c => {
      c.x -= c.speed;
      if (c.x + c.size * 2 < 0) c.x = canvas.width + 50;
    });

    // Player Gravity
    player.vy += player.gravity;
    player.y += player.vy;

    if (player.y + player.height >= canvas.height || player.y <= 0) {
      endGame();
    }

    if (frameCount % 110 === 0) spawnPipe();

    // Update Floating Texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 0.02;
      if (ft.alpha <= 0) floatingTexts.splice(i, 1);
    }

    // Update Shatter Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.vRot;
      p.alpha -= 0.025;
      if (p.alpha <= 0) particles.splice(i, 1);
    }

    // Update Items
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

    // Update Pipes & Knight Slicing
    const knightX = player.x + knightPowerup.xOffset;

    for (let i = pipes.length - 1; i >= 0; i--) {
      const pipe = pipes[i];
      pipe.x -= 2;

      if (!pipe.passed && pipe.x + pipe.width < player.x) {
        pipe.passed = true;
        score++;
        if (score > highScore) {
          highScore = score;
          localStorage.setItem('pixeljump_highscore', highScore);
        }
      }

      if (pipe.shattered) continue;

      if (knightPowerup.active) {
        if (pipe.x <= knightX + 45 && pipe.x + pipe.width >= knightX) {
          pipe.shattered = true;
          knightPowerup.pipesRemaining--;
          knightPowerup.slashTimer = 12;

          playSound('shatter');
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
  // 7. COMPLETE GRAPHICS RENDERER
  // ==========================================
  function draw() {
    // 1. Theme Background
    ctx.fillStyle = currentTheme.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Parallax Theme Clouds
    ctx.fillStyle = currentTheme.cloudColor;
    clouds.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.size / 2, 0, Math.PI * 2);
      ctx.arc(c.x + c.size * 0.3, c.y - c.size * 0.2, c.size * 0.4, 0, Math.PI * 2);
      ctx.arc(c.x + c.size * 0.6, c.y, c.size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. Pipes & Accent Caps
    pipes.forEach(pipe => {
      if (pipe.shattered) return;

      ctx.fillStyle = currentTheme.pipeColor;
      ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
      ctx.fillRect(pipe.x, pipe.bottomY, pipe.width, canvas.height - pipe.bottomY);

      // Pipe Rim Highlight/Caps
      ctx.fillStyle = currentTheme.pipeAccent;
      ctx.fillRect(pipe.x - 3, pipe.topHeight - 15, pipe.width + 6, 15);
      ctx.fillRect(pipe.x - 3, pipe.bottomY, pipe.width + 6, 15);
    });

    // 4. Collectible Items
    items.forEach(item => {
      ctx.font = "20px sans-serif";
      ctx.fillText(item.type === 'shield' ? '🛡️' : '⚔️', item.x, item.y);
    });

    // 5. Shatter Particles
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    // 6. Render Player (Custom Upload -> Sprite -> Procedural Fallback)
    if (customAvatarImg) {
      ctx.drawImage(customAvatarImg, player.x, player.y, player.width, player.height);
    } else if (activeCharacter.loaded) {
      ctx.drawImage(activeCharacter.sprite, player.x, player.y, player.width, player.height);
    } else {
      ctx.fillStyle = activeCharacter.color;
      ctx.beginPath();
      ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px sans-serif";
      ctx.fillText("🐱", player.x + 8, player.y + 23);
    }

    // 7. Knight Powerup Companion Avatar
    if (knightPowerup.active) {
      drawKnight(player.x + knightPowerup.xOffset, player.y);
    }

    // 8. Floating Scores/Text Popups
    floatingTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = "bold 15px sans-serif";
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    // 9. HUD Overlay
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(`Score: ${score}`, 15, 30);

    ctx.font = "12px sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillText(`Best: ${highScore}`, 15, 48);
    ctx.fillText(`${currentTheme.name} Theme`, canvas.width - 100, 38);
    ctx.fillText(GAME_VERSION, canvas.width - 55, 20);

    let invStatus = "Inventory: ";
    if (player.inventory.shield) invStatus += "🛡️ ";
    if (player.inventory.sword) invStatus += "⚔️ ";
    ctx.font = "13px sans-serif";
    ctx.fillText(invStatus, 15, 70);

    if (knightPowerup.active) {
      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(`Knight Destruction: ${knightPowerup.pipesRemaining}`, 15, 90);
    }

    // 10. Game Over Screen
    if (gameOver) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 15);
      ctx.font = "16px sans-serif";
      ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + 15);
      ctx.fillText("Tap or Press Space to Restart", canvas.width / 2, canvas.height / 2 + 45);
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

  function endGame() {
    if (!gameOver) playSound('hit');
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

  function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
  }

  // Start Full Engine
  gameLoop();
});