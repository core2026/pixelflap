/**
 * PixelJump Engine
 * Version: 1.10.0 (All Items Restored: Slow-Mo, Gems, Shield, Sword Combo, Styled Arrows & Guide)
 */

window.addEventListener('DOMContentLoaded', () => {
  const GAME_VERSION = "v1.10.0";
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // ==========================================
  // 1. STATE & LEADERBOARD DATA
  // ==========================================
  let score = 0;
  let playerInitials = localStorage.getItem('pixeljump_initials') || "AAA";
  let highScores = JSON.parse(localStorage.getItem('pixeljump_top15')) || [
    { name: "ACE", score: 50 },
    { name: "JMP", score: 35 },
    { name: "CAT", score: 20 },
    { name: "NEO", score: 15 },
    { name: "SKY", score: 10 }
  ];

  let gameStarted = false;
  let gameOver = false;
  let showInfoModal = false;
  let frameCount = 0;
  let audioMuted = false;

  // Active Powerup Timers & States
  let slowMoTimer = 0;
  let scoreMultiplierTimer = 0;

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
  // 3. CHARACTERS & SELECTION
  // ==========================================
  const AVATARS = [
    { id: 'cat', emoji: '🐱', name: 'Cat', color: '#ff9800' },
    { id: 'rocket', emoji: '🚀', name: 'Rocket', color: '#e91e63' },
    { id: 'ghost', emoji: '👻', name: 'Ghost', color: '#9c27b0' }
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
    pipesRemaining: 0
  };

  let pipes = [];
  let items = [];
  let particles = [];
  let floatingTexts = [];

  function promptForInitials() {
    let input = prompt("Enter your Initials (1 to 3 letters):", playerInitials);
    if (input !== null) {
      const sanitized = input.replace(/[^a-zA-Z]/g, '').toUpperCase().trim();
      if (sanitized.length >= 1 && sanitized.length <= 3) {
        playerInitials = sanitized;
        localStorage.setItem('pixeljump_initials', playerInitials);
      } else {
        alert("Please enter between 1 and 3 letters!");
        promptForInitials();
      }
    }
  }

  // ==========================================
  // 4. INPUT & CLICK HANDLING
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

    if (showInfoModal) {
      showInfoModal = false;
      return;
    }

    if (!gameStarted) {
      // Info Button Click Zone (y: 10-40, right side)
      if (clickX >= 290 && clickX <= 380 && clickY >= 10 && clickY <= 40) {
        showInfoModal = true;
        return;
      }

      // Initials Box Click Zone (y: 60-100)
      if (clickX >= 50 && clickX <= 350 && clickY >= 60 && clickY <= 100) {
        promptForInitials();
        return;
      }

      // Avatar Previous Arrow Click Zone (y: 110-150, left arrow)
      if (clickX >= 50 && clickX <= 95 && clickY >= 110 && clickY <= 150) {
        selectedAvatarIndex = (selectedAvatarIndex - 1 + AVATARS.length) % AVATARS.length;
        customAvatarImg = null;
        return;
      }

      // Avatar Next Arrow Click Zone (y: 110-150, right arrow)
      if (clickX >= 305 && clickX <= 350 && clickY >= 110 && clickY <= 150) {
        selectedAvatarIndex = (selectedAvatarIndex + 1) % AVATARS.length;
        customAvatarImg = null;
        return;
      }

      // Start Button Click Zone (y: 500-552)
      if (clickX >= 70 && clickX <= 330 && clickY >= 500 && clickY <= 552) {
        if (!playerInitials) promptForInitials();
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
      if (showInfoModal) {
        showInfoModal = false;
        return;
      }
      if (!gameStarted) {
        if (!playerInitials) promptForInitials();
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
  // 5. GAME & LEADERBOARD LOGIC
  // ==========================================
  function spawnItem(pipeX, topHeight, gap) {
    if (Math.random() < 0.45) {
      const rand = Math.random();
      let type = 'shield';

      if (rand < 0.3) type = 'shield';
      else if (rand < 0.55) type = 'sword';
      else if (rand < 0.8) type = 'slow';
      else type = 'gem';

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
    playSound('item');

    if (type === 'shield') {
      player.inventory.shield = true;
      spawnFloatingText("GOT SHIELD!", player.x, player.y - 15, "#00e676");
    } else if (type === 'sword') {
      player.inventory.sword = true;
      spawnFloatingText("GOT SWORD!", player.x, player.y - 15, "#ffea00");
    } else if (type === 'slow') {
      slowMoTimer = 480; // ~8 seconds at 60 FPS
      spawnFloatingText("⏳ SLOW TIME!", player.x, player.y - 15, "#00e5ff");
    } else if (type === 'gem') {
      scoreMultiplierTimer = 360; // ~6 seconds at 60 FPS
      spawnFloatingText("💎 2X POINTS!", player.x, player.y - 15, "#e040fb");
    }

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
    spawnFloatingText("+50 KNIGHT'S AEGIS RAMPAGE!", player.x - 30, player.y - 30, "#ffd700");
  }

  function saveHighScore(newScore) {
    highScores.push({ name: playerInitials, score: newScore });
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 15);
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
    if (!gameStarted || gameOver || showInfoModal) return;
    frameCount++;

    if (slowMoTimer > 0) slowMoTimer--;
    if (scoreMultiplierTimer > 0) scoreMultiplierTimer--;

    const currentSpeed = (slowMoTimer > 0) ? 1.0 : 2.0;

    if (score >= 30) currentTheme = THEMES.retro;
    else if (score >= 20) currentTheme = THEMES.night;
    else if (score >= 10) currentTheme = THEMES.sunset;
    else currentTheme = THEMES.day;

    clouds.forEach(c => {
      c.x -= (c.speed * (currentSpeed / 2));
      if (c.x + c.size * 2 < 0) c.x = canvas.width + 50;
    });

    player.vy += player.gravity;
    player.y += player.vy;

    if (player.y + player.height >= canvas.height || player.y <= 0) {
      handlePlayerHit();
    }

    const pipeSpawnInterval = (slowMoTimer > 0) ? 220 : 110;
    if (frameCount % pipeSpawnInterval === 0) spawnPipe();

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
      item.x -= currentSpeed;

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

    // Pipes & Collisions
    const playerCenterX = player.x + player.width / 2;

    for (let i = pipes.length - 1; i >= 0; i--) {
      const pipe = pipes[i];
      pipe.x -= currentSpeed;

      if (!pipe.passed && pipe.x + pipe.width < player.x) {
        pipe.passed = true;
        const addScore = (scoreMultiplierTimer > 0) ? 2 : 1;
        score += addScore;
        if (scoreMultiplierTimer > 0) {
          spawnFloatingText("+2 PTS 💎", player.x, player.y - 20, "#e040fb");
        }
      }

      if (pipe.shattered) continue;

      if (giantShield.active) {
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
  // 7. DRAWING UI & VISUAL COMPONENTS
  // ==========================================
  function drawKnightKiteShield(x, y) {
    ctx.save();
    ctx.translate(x, y);

    ctx.shadowColor = "#00e676";
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(0, -35);
    ctx.lineTo(25, -35);
    ctx.lineTo(22, 5);
    ctx.lineTo(0, 40);
    ctx.lineTo(-22, 5);
    ctx.lineTo(-25, -35);
    ctx.closePath();

    const grad = ctx.createLinearGradient(-25, -35, 25, 40);
    grad.addColorStop(0, '#e0e0e0');
    grad.addColorStop(0.5, '#9e9e9e');
    grad.addColorStop(1, '#424242');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffd700';
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#b71c1c';
    ctx.fillRect(-4, -30, 8, 60);
    ctx.fillRect(-20, -15, 40, 8);

    ctx.beginPath();
    ctx.arc(0, -11, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  function drawLeaderboardCard(startY, title) {
    const width = 340;
    const height = 310;
    const x = (canvas.width - width) / 2;

    ctx.fillStyle = "rgba(20, 20, 25, 0.9)";
    ctx.fillRect(x, startY, width, height);
    ctx.strokeStyle = "rgba(255, 215, 0, 0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, startY, width, height);

    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, canvas.width / 2, startY + 28);

    const displayScores = highScores.slice(0, 10);
    let rowY = startY + 58;

    displayScores.forEach((hs, idx) => {
      ctx.font = "bold 14px sans-serif";

      if (idx === 0) ctx.fillStyle = "#ffd700";
      else if (idx === 1) ctx.fillStyle = "#e0e0e0";
      else if (idx === 2) ctx.fillStyle = "#cd7f32";
      else ctx.fillStyle = "#b0bec5";

      ctx.textAlign = "left";
      ctx.fillText(`#${idx + 1}`, x + 25, rowY);

      ctx.fillStyle = (hs.name === playerInitials) ? "#00e676" : "#ffffff";
      ctx.fillText(hs.name, x + 85, rowY);

      ctx.textAlign = "right";
      ctx.fillText(`${hs.score} pts`, x + width - 25, rowY);

      rowY += 24;
    });
  }

  // Information & Upgrade Guide Overlay Modal
  function drawInfoModal() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.92)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const width = 350;
    const height = 480;
    const x = (canvas.width - width) / 2;
    const y = 60;

    ctx.fillStyle = "rgba(25, 30, 40, 0.95)";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "#00e676";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 19px sans-serif";
    ctx.fillText("⚔️ GAME UPGRADES & GUIDE 🛡️", canvas.width / 2, y + 35);

    ctx.textAlign = "left";
    let textY = y + 68;

    const sections = [
      { icon: "🛡️", title: "Aura Shield (Default)", body: "Absorbs 1 collision hit from a pipe or ground. Grants a second chance!" },
      { icon: "⏳", title: "Slow-Mo Hourglass", body: "Slows pipe game speed by 50% for 8 seconds for easier navigation." },
      { icon: "💎", title: "Gem Multiplier", body: "Doubles all points earned for passing pipes while active!" },
      { icon: "⚔️", title: "Sword Pickup", body: "Collect alongside your Shield to activate Knight Rampage." },
      { icon: "🛡️+⚔️", title: "Knight's Aegis Rampage", body: "Summons the Knight Kite Shield to smash 6 consecutive pipes for +50 bonus pts!" }
    ];

    sections.forEach(sec => {
      ctx.fillStyle = "#00e676";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(`${sec.icon} ${sec.title}`, x + 18, textY);
      textY += 16;

      ctx.fillStyle = "#d1d5db";
      ctx.font = "11px sans-serif";
      
      const words = sec.body.split(' ');
      let line = '';
      for (let w of words) {
        if (ctx.measureText(line + w).width > width - 36) {
          ctx.fillText(line, x + 18, textY);
          textY += 14;
          line = w + ' ';
        } else {
          line += w + ' ';
        }
      }
      ctx.fillText(line, x + 18, textY);
      textY += 22;
    });

    // Close Button
    ctx.fillStyle = "#2e7d32";
    ctx.fillRect(x + 75, y + height - 48, 200, 36);
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(x + 75, y + height - 48, 200, 36);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("CLOSE GUIDE", canvas.width / 2, y + height - 25);
  }

  function draw() {
    // Background
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

    // Pipes
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
      let icon = '🛡️';
      if (item.type === 'sword') icon = '⚔️';
      else if (item.type === 'slow') icon = '⏳';
      else if (item.type === 'gem') icon = '💎';
      ctx.fillText(icon, item.x, item.y);
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

    // Player Avatar
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

    // Shield Aura
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

    // Knight Shield
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

    let hudY = 68;
    let invStatus = "Inventory: ";
    if (player.inventory.shield) invStatus += "🛡️ ";
    if (player.inventory.sword) invStatus += "⚔️ ";
    ctx.font = "13px sans-serif";
    ctx.fillText(invStatus, 15, hudY);

    if (slowMoTimer > 0) {
      hudY += 18;
      ctx.fillStyle = "#00e5ff";
      ctx.fillText(`⏳ Slow Mo: ${Math.ceil(slowMoTimer / 60)}s`, 15, hudY);
    }

    if (scoreMultiplierTimer > 0) {
      hudY += 18;
      ctx.fillStyle = "#e040fb";
      ctx.fillText(`💎 2x Points: ${Math.ceil(scoreMultiplierTimer / 60)}s`, 15, hudY);
    }

    if (giantShield.active) {
      hudY += 18;
      ctx.fillStyle = "#00e676";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(`Knight Shield Hits Left: ${giantShield.pipesRemaining}`, 15, hudY);
    }

    // ==========================================
    // SPLASH SCREEN WITH STYLIZED ARROWS & INFO
    // ==========================================
    if (!gameStarted) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PIXEL JUMP", canvas.width / 2, 42);

      // Info Guide Icon Button (Top Right)
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fillRect(290, 10, 95, 30);
      ctx.strokeStyle = "#00e676";
      ctx.strokeRect(290, 10, 95, 30);
      ctx.fillStyle = "#00e676";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("ℹ️ Guide", 337, 30);

      // Interactive Initials Box
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(50, 60, 300, 40);
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(50, 60, 300, 40);

      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`INITIALS: [ ${playerInitials} ] (Tap to Change)`, canvas.width / 2, 85);

      // Interactive Avatar Box with Stylized Glowing Arrows
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(50, 110, 300, 40);
      ctx.strokeStyle = "#00e676";
      ctx.strokeRect(50, 110, 300, 40);

      // Left Stylized Arrow Button Box
      ctx.fillStyle = "#1b5e20";
      ctx.fillRect(52, 112, 38, 36);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("⟨", 71, 136);

      // Right Stylized Arrow Button Box
      ctx.fillStyle = "#1b5e20";
      ctx.fillRect(310, 112, 38, 36);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("⟩", 329, 136);

      // Avatar Name & Emoji Center Label
      ctx.fillStyle = "#00e676";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`AVATAR: ${customAvatarImg ? 'Custom 📁' : currentAvatar.emoji + ' ' + currentAvatar.name}`, canvas.width / 2, 135);

      // Leaderboard
      drawLeaderboardCard(165, "🏆 HALL OF FAME 🏆");

      // TAP TO START BUTTON (PERFECTLY CENTER ALIGNED)
      const btnX = 70;
      const btnY = 500;
      const btnWidth = 260;
      const btnHeight = 52;

      ctx.fillStyle = "#2e7d32";
      ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("TAP TO START", btnX + (btnWidth / 2), btnY + (btnHeight / 2));
      ctx.textBaseline = "alphabetic"; // Reset baseline
      ctx.textAlign = "left";
    }

    // ==========================================
    // GAME OVER SCREEN
    // ==========================================
    if (gameOver) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.88)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#ff5252";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", canvas.width / 2, 45);

      ctx.fillStyle = "#ffffff";
      ctx.font = "15px sans-serif";
      ctx.fillText(`Final Score (${playerInitials}): ${score} pts`, canvas.width / 2, 72);

      drawLeaderboardCard(90, "🏅 TOP SCORES LEADERBOARD 🏅");

      ctx.fillStyle = "#00e676";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Tap Screen or Press Space to Play Again", canvas.width / 2, 530);
      ctx.textAlign = "left";
    }

    // Draw Info Modal Overlay over everything when open
    if (showInfoModal) {
      drawInfoModal();
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
    slowMoTimer = 0;
    scoreMultiplierTimer = 0;
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