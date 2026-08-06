/**
 * PixelJump Engine
 * Version: 1.7.0 (Initials Prompt, Avatar Selection, Top 15 Leaderboard & Knight Kite Shield Graphic)
 */

window.addEventListener('DOMContentLoaded', () => {
  const GAME_VERSION = "v1.7.0";
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // ==========================================
  // 1. STATE & TOP 15 LEADERBOARD
  // ==========================================
  let score = 0;
  let playerInitials = localStorage.getItem('pixeljump_initials') || "AAA";
  let highScores = JSON.parse(localStorage.getItem('pixeljump_top15')) || [
    { name: "ACE", score: 50 },
    { name: "JMP", score: 35 },
    { name: "CAT", score: 20 }
  ];

  let gameStarted = false;
  let gameOver = false;
  let frameCount = 0;
  let audioMuted = false;

  const THEMES = {
    day: { name: 'Day', background: "#70c5ce", pipeColor: "#2e7d32", pipeAccent: "#1b5e20", cloudColor: "rgba(255, 255, 255, 0.7)" },
    sunset: { name: 'Sunset', background: "#ff7043", pipeColor: "#d84315", pipeAccent: "#bf360c", cloudColor: "rgba(255, 204, 188, 0.6)" },
    night: { name: 'Night', background: "#1a237e", pipeColor: "#512da8", pipeAccent: "#311b92", cloudColor: "rgba(159, 168, 218, 0.4)" },
    retro: { name: 'Cyberpunk', background: "#212121", pipeColor: "#00b0ff", pipeAccent: "#0081cb", cloudColor: "rgba(255, 0, 128, 0.3)" }
  };
  let currentTheme = THEMES.day;

  const clouds = [
    { x: 50, y: 80, speed: 0.4, size: 40 },
    { x: 220, y: 140, speed: 0.6, size: 60 },
    { x: 340, y: 50, speed: 0.3, size: 45 }
  ];

  // ==========================================
  // 2. AUDIO SYNTHESIZER
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
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
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
    } catch (e) {}
  }

  // ==========================================
  // 3. PLAYER & CHARACTERS
  // ==========================================
  const AVATARS = [
    { id: 'cat', emoji: '🐱', name: 'Cat', color: '#ff9800', src: 'cat.png' },
    { id: 'rocket', emoji: '🚀', name: 'Rocket', color: '#e91e63', src: 'rocket.png' },
    { id: 'ghost', emoji: '👻', name: 'Ghost', color: '#9c27b0', src: '' }
  ];
  let selectedAvatarIndex = 0;
  let customAvatarImg = null;

  const player = {
    x: 80,
    y: 250,
    width: 34,
    height: 34,
    vy: 0,
    gravity: 0.35,
    jumpStrength: -7,
    inventory: { shield: true, sword: false }
  };

  const giantShield = {
    active: false,
    pipesRemaining: 0,
    scale: 1.0,
    angle: 0
  };

  let pipes = [];
  let items = [];
  let particles = [];
  let floatingTexts = [];

  // ==========================================
  // 4. INPUT & SPLASH SCREEN INTERACTION
  // ==========================================
  function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clickX = (e.clientX - rect.left) * scaleX;
    let clickY = (e.clientY - rect.top) * scaleY;

    if (e.touches && e.touches[0]) {
      clickX = (e.touches[0].clientX - rect.left) * scaleX;
      clickY = (e.touches[0].clientY - rect.top) * scaleY;
    }

    if (!gameStarted) {
      // Initials Click Zone
      if (clickX >= 110 && clickX <= 290 && clickY >= 180 && clickY <= 220) {
        let input = prompt("Enter your 3-letter initials:", playerInitials);
        if (input) {
          playerInitials = input.toUpperCase().trim().substring(0, 3) || "AAA";
          localStorage.setItem('pixeljump_initials', playerInitials);
        }
        return;
      }

      // Avatar Toggle Click Zone
      if (clickX >= 110 && clickX <= 290 && clickY >= 235 && clickY <= 275) {
        selectedAvatarIndex = (selectedAvatarIndex + 1) % AVATARS.length;
        customAvatarImg = null; // Reset custom upload when toggling preset avatars
        return;
      }

      // Start Button Click Zone
      if (clickX >= 100 && clickX <= 300 && clickY >= 500 && clickY <= 555) {
        initAudio();
        gameStarted = true;
        resetGame();
        return;
      }
      return;
    }

    if (gameOver) {
      resetGame();
      return;
    }

    // Gameplay Jump
    initAudio();
    player.vy = player.jumpStrength;
    playSound('jump');
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      if (!gameStarted) {
        initAudio();
        gameStarted = true;
        resetGame();
      } else if (gameOver) {
        resetGame();
      } else {
        initAudio();
        player.vy = player.jumpStrength;
        playSound('jump');
      }
    }
  });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleCanvasClick(e);
  });
  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    handleCanvasClick(e);
  });

  document.getElementById('audioToggle').addEventListener('click', () => {
    audioMuted = !audioMuted;
    document.getElementById('audioToggle').innerText = audioMuted ? '🔇 Audio Off' : '🔊 Mute Audio';
  });

  document.getElementById('avatarUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => { customAvatarImg = img; };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // ==========================================
  // 5. RANDOMIZED ITEM SPAWNING & COMBOS
  // ==========================================
  function spawnItem(pipeX, topHeight, gap) {
    if (Math.random() < 0.35) {
      const type = Math.random() < 0.5 ? 'shield' : 'sword';
      const safeY = topHeight + (gap / 2) - 10;

      items.push({
        type: type,
        x: pipeX + 16,
        y: safeY,
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
      triggerGiantShieldCombo();
    }
  }

  function triggerGiantShieldCombo() {
    player.inventory.shield = false;
    player.inventory.sword = false;

    giantShield.active = true;
    giantShield.pipesRemaining = 6;

    score += 50;
    playSound('item');
    spawnFloatingText("+50 KNIGHT'S AEGIS SHIELD!", player.x - 30, player.y - 30, "#ffd700");
  }

  function saveHighScore(newScore) {
    highScores.push({ name: playerInitials, score: newScore });
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 15); // Retain top 15
    localStorage.setItem('pixeljump_top15', JSON.stringify(highScores));
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
  // 6. GAME LOOP UPDATES
  // ==========================================
  function spawnPipe() {
    const gap = 145;
    const minHeight = 50;
    const maxHeight = canvas.height - gap - minHeight;
    const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

    const pipeX = canvas.width;
    pipes.push({
      x: pipeX,
      width: 54,
      topHeight: topHeight,
      bottomY: topHeight + gap,
      passed: false,
      shattered: false
    });

    spawnItem(pipeX, topHeight, gap);
  }

  function update() {
    if (!gameStarted || gameOver) return;
    frameCount++;

    if (score >= 30) currentTheme = THEMES.retro;
    else if (score >= 20) currentTheme = THEMES.night;
    else if (score >= 10) currentTheme = THEMES.sunset;
    else currentTheme = THEMES.day;

    clouds.forEach(c => {
      c.x -= c.speed;
      if (c.x + c.size * 2 < 0) c.x = canvas.width + 50;
    });

    player.vy += player.gravity;
    player.y += player.vy;

    if (player.y + player.height >= canvas.height || player.y <= 0) {
      handlePlayerHit();
    }

    if (frameCount % 110 === 0) spawnPipe();

    // Floating text
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 0.02;
      if (ft.alpha <= 0) floatingTexts.splice(i, 1);
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.vRot;
      p.alpha -= 0.025;
      if (p.alpha <= 0) particles.splice(i, 1);
    }

    // Items
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

    // Pipes & Knight Shield Collisions
    const playerCenterX = player.x + player.width / 2;

    for (let i = pipes.length - 1; i >= 0; i--) {
      const pipe = pipes[i];
      pipe.x -= 2;

      if (!pipe.passed && pipe.x + pipe.width < player.x) {
        pipe.passed = true;
        score++;
      }

      if (pipe.shattered) continue;

      if (giantShield.active) {
        // Shield impact zone centered in front of player
        if (pipe.x <= playerCenterX + 65 && pipe.x + pipe.width >= playerCenterX - 30) {
          pipe.shattered = true;
          giantShield.pipesRemaining--;

          playSound('shatter');
          createPipeShatterParticles(pipe.x, 0, pipe.width, pipe.topHeight);
          createPipeShatterParticles(pipe.x, pipe.bottomY, pipe.width, canvas.height - pipe.bottomY);
          spawnFloatingText("AEGIS SHATTER!", pipe.x, player.y, "#00e676");

          if (giantShield.pipesRemaining <= 0) giantShield.active = false;
        }
      } else {
        const hitBox = (
          player.x + player.width > pipe.x &&
          player.x < pipe.x + pipe.width &&
          (player.y < pipe.topHeight || player.y + player.height > pipe.bottomY)
        );

        if (hitBox) {
          handlePlayerHit();
        }
      }

      if (pipe.x + pipe.width < 0) pipes.splice(i, 1);
    }
  }

  function handlePlayerHit() {
    if (player.inventory.shield) {
      player.inventory.shield = false;
      player.vy = player.jumpStrength;
      playSound('shatter');
      spawnFloatingText("SHIELD ABSORBED HIT!", player.x - 20, player.y - 20, "#00e676");
    } else {
      endGame();
    }
  }

  // ==========================================
  // 7. DRAWING GRAPHICS & KITE SHIELD
  // ==========================================
  function drawKnightKiteShield(x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Glowing Aura behind shield
    ctx.shadowColor = "#00e676";
    ctx.shadowBlur = 12;

    // Shield Body (Kite Shape)
    ctx.beginPath();
    ctx.moveTo(0, -35); // Top center
    ctx.lineTo(25, -35); // Top right
    ctx.lineTo(22, 5);   // Mid right curve
    ctx.lineTo(0, 40);   // Bottom point
    ctx.lineTo(-22, 5);  // Mid left curve
    ctx.lineTo(-25, -35); // Top left
    ctx.closePath();

    // Steel Metallic Gradient Base
    const grad = ctx.createLinearGradient(-25, -35, 25, 40);
    grad.addColorStop(0, '#e0e0e0');
    grad.addColorStop(0.5, '#9e9e9e');
    grad.addColorStop(1, '#424242');
    ctx.fillStyle = grad;
    ctx.fill();

    // Gold Outer Rim Border
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffd700';
    ctx.stroke();

    // Inner Metallic Cross Emblem
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#b71c1c'; // Crimson Shield Cross
    ctx.fillRect(-4, -30, 8, 60);
    ctx.fillRect(-20, -15, 40, 8);

    // Center Gold Boss / Stud
    ctx.beginPath();
    ctx.arc(0, -11, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  function draw() {
    // Background Theme
    ctx.fillStyle = currentTheme.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dynamic Clouds
    ctx.fillStyle = currentTheme.cloudColor;
    clouds.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.size / 2, 0, Math.PI * 2);
      ctx.arc(c.x + c.size * 0.3, c.y - c.size * 0.2, c.size * 0.4, 0, Math.PI * 2);
      ctx.arc(c.x + c.size * 0.6, c.y, c.size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    });

    // Theme Pipes
    pipes.forEach(pipe => {
      if (pipe.shattered) return;

      ctx.fillStyle = currentTheme.pipeColor;
      ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
      ctx.fillRect(pipe.x, pipe.bottomY, pipe.width, canvas.height - pipe.bottomY);

      ctx.fillStyle = currentTheme.pipeAccent;
      ctx.fillRect(pipe.x - 3, pipe.topHeight - 15, pipe.width + 6, 15);
      ctx.fillRect(pipe.x - 3, pipe.bottomY, pipe.width + 6, 15);
    });

    // Items
    items.forEach(item => {
      ctx.font = "22px sans-serif";
      ctx.fillText(item.type === 'shield' ? '🛡️' : '⚔️', item.x, item.y);
    });

    // Particles
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    // Player Rendering
    const currentAvatar = AVATARS[selectedAvatarIndex];
    if (customAvatarImg) {
      ctx.drawImage(customAvatarImg, player.x, player.y, player.width, player.height);
    } else {
      ctx.fillStyle = currentAvatar.color;
      ctx.beginPath();
      ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "16px sans-serif";
      ctx.fillText(currentAvatar.emoji, player.x + 7, player.y + 24);
    }

    // Standard Shield Aura
    if (player.inventory.shield && !giantShield.active) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width / 2 + 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 230, 118, 0.35)";
      ctx.fill();
      ctx.strokeStyle = "#00e676";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // DRAW ACTUAL KNIGHT'S KITE SHIELD WHEN ACTIVE
    if (giantShield.active) {
      drawKnightKiteShield(player.x + player.width + 22, player.y + player.height / 2);
    }

    // Floating Text
    floatingTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = "bold 15px sans-serif";
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    // HUD
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(`Score: ${score}`, 15, 30);

    ctx.font = "12px sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillText(`Player: ${playerInitials}`, 15, 48);
    ctx.fillText(`${currentTheme.name} Theme`, canvas.width - 100, 38);
    ctx.fillText(GAME_VERSION, canvas.width - 55, 20);

    let invStatus = "Inventory: ";
    if (player.inventory.shield) invStatus += "🛡️ ";
    if (player.inventory.sword) invStatus += "⚔️ ";
    ctx.font = "13px sans-serif";
    ctx.fillText(invStatus, 15, 70);

    if (giantShield.active) {
      ctx.fillStyle = "#00e676";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(`Knight Shield Hits Left: ${giantShield.pipesRemaining}`, 15, 90);
    }

    // ==========================================
    // START SPLASH SCREEN & TOP 15 LEADERBOARD
    // ==========================================
    if (!gameStarted) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 30px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PIXEL JUMP", canvas.width / 2, 45);

      // Interactive Setup Box
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fillRect(110, 65, 180, 40);
      ctx.strokeStyle = "#ffd700";
      ctx.strokeRect(110, 65, 180, 40);

      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`INITIALS: ${playerInitials} (Tap Change)`, canvas.width / 2, 90);

      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fillRect(110, 115, 180, 40);
      ctx.strokeStyle = "#00e676";
      ctx.strokeRect(110, 115, 180, 40);

      ctx.fillStyle = "#00e676";
      ctx.fillText(`AVATAR: ${customAvatarImg ? 'Custom 📁' : currentAvatar.emoji + ' ' + currentAvatar.name}`, canvas.width / 2, 140);

      // Leaderboard Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("🏆 TOP 15 LEADERBOARD 🏆", canvas.width / 2, 180);

      // Leaderboard Rows
      ctx.font = "13px monospace";
      let startY = 205;
      const displayScores = highScores.slice(0, 15);
      
      displayScores.forEach((hs, idx) => {
        const col = idx < 8 ? 60 : 230;
        const rowY = startY + (idx % 8) * 22;
        ctx.textAlign = "left";
        ctx.fillStyle = idx === 0 ? "#ffd700" : (idx === 1 ? "#c0c0c0" : (idx === 2 ? "#cd7f32" : "#ffffff"));
        ctx.fillText(`${idx + 1}. ${hs.name} - ${hs.score}`, col, rowY);
      });

      // Start Button
      ctx.textAlign = "center";
      ctx.fillStyle = "#2e7d32";
      ctx.fillRect(100, 480, 200, 50);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(100, 480, 200, 50);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("TAP TO START", canvas.width / 2, 512);

      ctx.textAlign = "left";
    }

    // ==========================================
    // GAME OVER OVERLAY & LEADERBOARD
    // ==========================================
    if (gameOver) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", canvas.width / 2, 50);

      ctx.font = "16px sans-serif";
      ctx.fillText(`Final Score (${playerInitials}): ${score}`, canvas.width / 2, 80);

      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("TOP 15 HIGH SCORES", canvas.width / 2, 120);

      ctx.font = "13px monospace";
      let startY = 145;
      highScores.slice(0, 15).forEach((hs, idx) => {
        const col = idx < 8 ? 60 : 230;
        const rowY = startY + (idx % 8) * 22;
        ctx.textAlign = "left";
        ctx.fillStyle = idx === 0 ? "#ffd700" : "#ffffff";
        ctx.fillText(`${idx + 1}. ${hs.name} - ${hs.score}`, col, rowY);
      });

      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("Tap Screen or Press Space to Restart", canvas.width / 2, 520);
      ctx.textAlign = "left";
    }
  }

  function endGame() {
    if (!gameOver) {
      playSound('hit');
      saveHighScore(score);
    }
    gameOver = true;
  }

  function resetGame() {
    player.y = 250;
    player.vy = 0;
    player.inventory.shield = true;
    player.inventory.sword = false;
    giantShield.active = false;
    giantShield.pipesRemaining = 0;
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

  gameLoop();
});