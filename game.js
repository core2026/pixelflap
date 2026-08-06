/**
 * PixelJump Engine
 * Version: 1.13.0 (In-Box Initials Typing, Clean Gameplay HUD, Double Shield Stacking & End-Screen Customization)
 */

window.addEventListener('DOMContentLoaded', () => {
  const GAME_VERSION = "v1.13.0";
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const avatarFileInput = document.getElementById('avatarUpload');

  // ==========================================
  // 1. STATE & LEADERBOARD DATA
  // ==========================================
  let score = 0;
  let playerInitials = localStorage.getItem('pixeljump_initials') || "ACE";
  let isEditingInitials = false;

  let highScores = JSON.parse(localStorage.getItem('pixeljump_top15_v2')) || [
    { name: "ACE", score: 50, date: "Aug 02, 14:20" },
    { name: "JMP", score: 35, date: "Aug 03, 09:15" },
    { name: "CAT", score: 20, date: "Aug 04, 18:45" },
    { name: "NEO", score: 15, date: "Aug 05, 11:10" },
    { name: "SKY", score: 10, date: "Aug 05, 20:30" }
  ];

  let gameStarted = false;
  let gameOver = false;
  let showInfoModal = false;
  let frameCount = 0;
  let audioMuted = false;

  // Active Powerup Timers
  let slowMoTimer = 0;
  let scoreMultiplierTimer = 0;

  const THEMES = {
    day: { name: 'Day', background: "#38bdf8", pipeColor: "#059669", pipeAccent: "#047857", cloudColor: "rgba(255, 255, 255, 0.75)" },
    sunset: { name: 'Sunset', background: "#f97316", pipeColor: "#c2410c", pipeAccent: "#9a3412", cloudColor: "rgba(254, 215, 170, 0.65)" },
    night: { name: 'Night', background: "#1e1b4b", pipeColor: "#6d28d9", pipeAccent: "#5b21b6", cloudColor: "rgba(199, 210, 254, 0.45)" },
    retro: { name: 'Cyberpunk', background: "#0f172a", pipeColor: "#06b6d4", pipeAccent: "#0e7490", cloudColor: "rgba(244, 114, 182, 0.35)" }
  };
  let currentTheme = THEMES.day;

  const clouds = [
    { x: 50, y: 100, speed: 0.4, size: 50 },
    { x: 250, y: 160, speed: 0.6, size: 70 },
    { x: 380, y: 70, speed: 0.3, size: 55 }
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
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(420, now + 0.1);
        gain.gain.setValueAtTime(0.25, now);
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
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {}
  }

  // ==========================================
  // 3. CHARACTERS & SELECTION (8 PLAYABLE)
  // ==========================================
  const AVATARS = [
    { id: 'cat', emoji: '🐱', name: 'Cat', color: '#f97316' },
    { id: 'panda', emoji: '🐼', name: 'Panda', color: '#64748b' },
    { id: 'ninja', emoji: '🥷', name: 'Ninja', color: '#334155' },
    { id: 'alien', emoji: '👾', name: 'Alien', color: '#a855f7' },
    { id: 'dragon', emoji: '🐲', name: 'Dragon', color: '#10b981' },
    { id: 'wizard', emoji: '🧙', name: 'Wizard', color: '#6366f1' },
    { id: 'rocket', emoji: '🚀', name: 'Rocket', color: '#ef4444' },
    { id: 'ghost', emoji: '👻', name: 'Ghost', color: '#ec4899' }
  ];
  let selectedAvatarIndex = 0;
  let customAvatarImg = null;

  const player = {
    x: 90,
    y: 300,
    width: 38,
    height: 38,
    vy: 0,
    gravity: 0.36,
    jumpStrength: -7.2,
    shieldCount: 1, // Double shield stacking supported (1 or 2)
    inventory: { sword: false }
  };

  const giantShield = {
    active: false,
    pipesRemaining: 0
  };

  let pipes = [];
  let items = [];
  let particles = [];
  let floatingTexts = [];

  function getFormattedTimestamp() {
    const d = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${month} ${day}, ${hours}:${mins}`;
  }

  avatarFileInput.addEventListener('change', (e) => {
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
      // Direct In-Box Initials Click Box (y: 65 - 110)
      if (clickX >= 50 && clickX <= 400 && clickY >= 65 && clickY <= 110) {
        isEditingInitials = true;
        playerInitials = "";
        return;
      } else {
        isEditingInitials = false;
        if (playerInitials.trim().length === 0) playerInitials = "ACE";
      }

      // Avatar Selector Left Arrow Zone (y: 120 - 165)
      if (clickX >= 50 && clickX <= 96 && clickY >= 120 && clickY <= 165) {
        selectedAvatarIndex = (selectedAvatarIndex - 1 + AVATARS.length) % AVATARS.length;
        customAvatarImg = null;
        return;
      }

      // Avatar Selector Right Arrow Zone (y: 120 - 165)
      if (clickX >= 354 && clickX <= 400 && clickY >= 120 && clickY <= 165) {
        selectedAvatarIndex = (selectedAvatarIndex + 1) % AVATARS.length;
        customAvatarImg = null;
        return;
      }

      // How to Play Guide Button (y: 650-695 left)
      if (clickX >= 50 && clickX <= 215 && clickY >= 650 && clickY <= 695) {
        showInfoModal = true;
        return;
      }

      // Start Game Button (y: 650-695 right)
      if (clickX >= 235 && clickX <= 400 && clickY >= 650 && clickY <= 695) {
        if (!playerInitials || playerInitials.trim().length === 0) playerInitials = "ACE";
        localStorage.setItem('pixeljump_initials', playerInitials);
        initAudio();
        gameStarted = true;
        resetGame();
        return;
      }
      return;
    }

    if (gameOver) {
      // Audio Toggle Button (y: 645-685, Left)
      if (clickX >= 40 && clickX <= 215 && clickY >= 645 && clickY <= 685) {
        audioMuted = !audioMuted;
        return;
      }

      // Upload Custom Avatar Button (y: 645-685, Right)
      if (clickX >= 235 && clickX <= 410 && clickY >= 645 && clickY <= 685) {
        avatarFileInput.click();
        return;
      }

      // Main Menu Home Button (y: 695-735, Left)
      if (clickX >= 40 && clickX <= 215 && clickY >= 695 && clickY <= 735) {
        gameStarted = false;
        gameOver = false;
        return;
      }

      // Play Again Button (y: 695-735, Right)
      if (clickX >= 235 && clickX <= 410 && clickY >= 695 && clickY <= 735) {
        resetGame();
        return;
      }
      return;
    }

    // Gameplay Jump
    initAudio();
    player.vy = player.jumpStrength;
    playSound('jump');
  }

  // Keyboard Typing directly for Initials & Control
  window.addEventListener('keydown', (e) => {
    if (!gameStarted && isEditingInitials) {
      if (e.key === 'Backspace') {
        playerInitials = playerInitials.slice(0, -1);
        return;
      }
      if (e.key === 'Enter') {
        isEditingInitials = false;
        if (playerInitials.trim().length === 0) playerInitials = "ACE";
        localStorage.setItem('pixeljump_initials', playerInitials);
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key) && playerInitials.length < 3) {
        playerInitials += e.key.toUpperCase();
        return;
      }
    }

    if (e.code === 'Space' || e.code === 'ArrowUp') {
      if (showInfoModal) {
        showInfoModal = false;
        return;
      }
      if (!gameStarted) {
        if (!playerInitials || playerInitials.trim().length === 0) playerInitials = "ACE";
        localStorage.setItem('pixeljump_initials', playerInitials);
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
        x: pipeX + 18,
        y: safeY,
        size: 26,
        collected: false
      });
    }
  }

  function collectItem(type) {
    playSound('item');

    if (type === 'shield') {
      if (player.shieldCount < 2) {
        player.shieldCount++;
        const msg = player.shieldCount === 2 ? "DOUBLE SHIELD x2! 🛡️🛡️" : "GOT SHIELD! 🛡️";
        spawnFloatingText(msg, player.x, player.y - 15, "#10b981");
      } else {
        score += 5;
        spawnFloatingText("MAX SHIELD (+5 PTS)", player.x, player.y - 15, "#10b981");
      }
    } else if (type === 'sword') {
      player.inventory.sword = true;
      spawnFloatingText("GOT SWORD!", player.x, player.y - 15, "#facc15");
    } else if (type === 'slow') {
      slowMoTimer = 480; // ~8 seconds
      spawnFloatingText("⏱️ CHRONO PULSE!", player.x, player.y - 15, "#38bdf8");
    } else if (type === 'gem') {
      scoreMultiplierTimer = 360; // ~6 seconds
      spawnFloatingText("💎 2X POINTS!", player.x, player.y - 15, "#c084fc");
    }

    if (player.shieldCount > 0 && player.inventory.sword) {
      triggerGiantShieldCombo();
    }
  }

  function triggerGiantShieldCombo() {
    player.shieldCount = 0;
    player.inventory.sword = false;

    giantShield.active = true;
    giantShield.pipesRemaining = 6;

    score += 50;
    playSound('item');
    spawnFloatingText("+50 KNIGHT'S AEGIS RAMPAGE!", player.x - 30, player.y - 30, "#facc15");
  }

  function saveHighScore(newScore) {
    const validName = playerInitials || "ACE";
    const timestamp = getFormattedTimestamp();
    highScores.push({ name: validName, score: newScore, date: timestamp });
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 15);
    localStorage.setItem('pixeljump_top15_v2', JSON.stringify(highScores));
  }

  function createPipeShatterParticles(x, y, width, height) {
    for (let i = 0; i < 24; i++) {
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
    const gap = 160;
    const minHeight = 60;
    const maxHeight = canvas.height - gap - minHeight;
    const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

    const pipeX = canvas.width;
    pipes.push({
      x: pipeX,
      width: 60,
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

    const currentSpeed = (slowMoTimer > 0) ? 1.1 : 2.2;

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
          spawnFloatingText("+2 PTS 💎", player.x, player.y - 20, "#c084fc");
        }
      }

      if (pipe.shattered) continue;

      if (giantShield.active) {
        if (pipe.x <= playerCenterX + 70 && pipe.x + pipe.width >= playerCenterX - 35) {
          pipe.shattered = true;
          giantShield.pipesRemaining--;

          playSound('shatter');
          createPipeShatterParticles(pipe.x, 0, pipe.width, pipe.topHeight);
          createPipeShatterParticles(pipe.x, pipe.bottomY, pipe.width, canvas.height - pipe.bottomY);
          spawnFloatingText("AEGIS SHATTER!", pipe.x, player.y, "#10b981");

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
    if (player.shieldCount > 0) {
      player.shieldCount--;
      player.vy = player.jumpStrength;
      playSound('shatter');
      const remText = player.shieldCount > 0 ? "1 SHIELD REMAINING!" : "SHIELD BROKEN!";
      spawnFloatingText(remText, player.x - 20, player.y - 20, "#10b981");
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

    ctx.shadowColor = "#10b981";
    ctx.shadowBlur = 14;

    ctx.beginPath();
    ctx.moveTo(0, -38);
    ctx.lineTo(28, -38);
    ctx.lineTo(24, 6);
    ctx.lineTo(0, 44);
    ctx.lineTo(-24, 6);
    ctx.lineTo(-28, -38);
    ctx.closePath();

    const grad = ctx.createLinearGradient(-28, -38, 28, 44);
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(0.5, '#94a3b8');
    grad.addColorStop(1, '#334155');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#facc15';
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-5, -32, 10, 64);
    ctx.fillRect(-22, -16, 44, 10);

    ctx.restore();
  }

  // Render Full Top-15 High Scores Leaderboard WITH DATE & TIME
  function drawLeaderboardCard(startY, title) {
    const width = 390;
    const height = 440;
    const x = (canvas.width - width) / 2;

    ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
    ctx.fillRect(x, startY, width, height);
    ctx.strokeStyle = "rgba(250, 204, 21, 0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, startY, width, height);

    ctx.fillStyle = "#facc15";
    ctx.font = "600 16px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, canvas.width / 2, startY + 28);

    // Dynamic Header Row
    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 11px -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("RANK  NAME", x + 16, startY + 50);
    ctx.textAlign = "center";
    ctx.fillText("DATE / TIME", x + width / 2 + 20, startY + 50);
    ctx.textAlign = "right";
    ctx.fillText("SCORE", x + width - 16, startY + 50);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.moveTo(x + 12, startY + 56);
    ctx.lineTo(x + width - 12, startY + 56);
    ctx.stroke();

    const displayScores = highScores.slice(0, 15);
    let rowY = startY + 76;
    const rowStep = 23; 

    displayScores.forEach((hs, idx) => {
      ctx.font = "600 13px -apple-system, monospace";

      if (idx === 0) ctx.fillStyle = "#facc15";
      else if (idx === 1) ctx.fillStyle = "#e2e8f0";
      else if (idx === 2) ctx.fillStyle = "#fb923c";
      else ctx.fillStyle = "#94a3b8";

      ctx.textAlign = "left";
      ctx.fillText(`#${idx + 1}`.padEnd(5, ' '), x + 16, rowY);

      ctx.fillStyle = (hs.name === playerInitials) ? "#10b981" : "#f8fafc";
      ctx.fillText(hs.name, x + 68, rowY);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(hs.date || "Aug 05, --:--", x + width / 2 + 20, rowY);

      ctx.fillStyle = "#facc15";
      ctx.font = "600 13px -apple-system, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${hs.score} pts`, x + width - 16, rowY);

      rowY += rowStep;
    });
  }

  // Information Overlay Guide
  function drawInfoModal() {
    ctx.fillStyle = "rgba(2, 6, 23, 0.94)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const width = 390;
    const height = 540;
    const x = (canvas.width - width) / 2;
    const y = 80;

    ctx.fillStyle = "rgba(15, 23, 42, 0.96)";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#facc15";
    ctx.font = "600 20px -apple-system, sans-serif";
    ctx.fillText("⚔️ GAME UPGRADES & GUIDE 🛡️", canvas.width / 2, y + 40);

    ctx.textAlign = "left";
    let textY = y + 80;

    const sections = [
      { icon: "🛡️", title: "Aura Shield (Double Stacking)", body: "Absorbs 1 collision hit. Grab a 2nd shield to stack a double barrier (🛡️ x2)!" },
      { icon: "⏱️", title: "Chrono Pulse", body: "Slows pipe movement speed by 50% for 8 seconds for precision dodging." },
      { icon: "💎", title: "Gem Multiplier", body: "Doubles all points earned for passing pipes while active!" },
      { icon: "⚔️", title: "Sword Pickup", body: "Collect alongside active Shield to trigger Knight Rampage." },
      { icon: "🛡️+⚔️", title: "Knight's Aegis Rampage", body: "Summons the Knight Kite Shield to smash 6 consecutive pipes for +50 bonus pts!" }
    ];

    sections.forEach(sec => {
      ctx.fillStyle = "#10b981";
      ctx.font = "600 14px -apple-system, sans-serif";
      ctx.fillText(`${sec.icon} ${sec.title}`, x + 20, textY);
      textY += 18;

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "12px -apple-system, sans-serif";
      
      const words = sec.body.split(' ');
      let line = '';
      for (let w of words) {
        if (ctx.measureText(line + w).width > width - 40) {
          ctx.fillText(line, x + 20, textY);
          textY += 15;
          line = w + ' ';
        } else {
          line += w + ' ';
        }
      }
      ctx.fillText(line, x + 20, textY);
      textY += 24;
    });

    // Close Button
    ctx.fillStyle = "#059669";
    ctx.fillRect(x + 95, y + height - 55, 200, 40);
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(x + 95, y + height - 55, 200, 40);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 14px -apple-system, sans-serif";
    ctx.fillText("CLOSE GUIDE", canvas.width / 2, y + height - 30);
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
      ctx.fillRect(pipe.x - 4, pipe.topHeight - 18, pipe.width + 8, 18);
      ctx.fillRect(pipe.x - 4, pipe.bottomY, pipe.width + 8, 18);
    });

    // Items
    items.forEach(item => {
      ctx.font = "24px sans-serif";
      let icon = '🛡️';
      if (item.type === 'sword') icon = '⚔️';
      else if (item.type === 'slow') icon = '⏱️';
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
      ctx.font = "20px sans-serif";
      ctx.fillText(currentAvatar.emoji, player.x + 8, player.y + 27);
    }

    // Shield Aura Rendering (Layered for Double Shields)
    if (player.shieldCount > 0 && !giantShield.active) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width / 2 + 7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(16, 185, 129, 0.35)";
      ctx.fill();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Outer Layer Ring for Double Shield
      if (player.shieldCount >= 2) {
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width / 2 + 13, 0, Math.PI * 2);
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Knight Shield
    if (giantShield.active) {
      drawKnightKiteShield(player.x + player.width + 24, player.y + player.height / 2);
    }

    // Floating Text
    floatingTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = "600 16px -apple-system, sans-serif";
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    // HUD (Cleaned of custom avatar/audio buttons)
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 20px -apple-system, sans-serif";
    ctx.fillText(`Score: ${score}`, 20, 35);

    ctx.font = "13px -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillText(`Player: ${playerInitials || "---"}`, 20, 56);
    ctx.fillText(`${currentTheme.name} Theme`, canvas.width - 110, 45);
    ctx.fillText(GAME_VERSION, canvas.width - 65, 24);

    let hudY = 78;
    let invStatus = "Shields: ";
    if (player.shieldCount > 0) invStatus += `🛡️ x${player.shieldCount} `;
    if (player.inventory.sword) invStatus += "⚔️ ";
    ctx.font = "14px -apple-system, sans-serif";
    ctx.fillText(invStatus, 20, hudY);

    if (slowMoTimer > 0) {
      hudY += 20;
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`⏱️ Chrono Pulse: ${Math.ceil(slowMoTimer / 60)}s`, 20, hudY);
    }

    if (scoreMultiplierTimer > 0) {
      hudY += 20;
      ctx.fillStyle = "#c084fc";
      ctx.fillText(`💎 2x Points: ${Math.ceil(scoreMultiplierTimer / 60)}s`, 20, hudY);
    }

    if (giantShield.active) {
      hudY += 20;
      ctx.fillStyle = "#10b981";
      ctx.font = "600 14px -apple-system, sans-serif";
      ctx.fillText(`Knight Shield Hits Left: ${giantShield.pipesRemaining}`, 20, hudY);
    }

    // ==========================================
    // MAIN SPLASH MENU
    // ==========================================
    if (!gameStarted) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 32px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PIXEL JUMP", canvas.width / 2, 45);

      // Interactive Initials Box (Direct Typing in Container)
      ctx.fillStyle = isEditingInitials ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(50, 65, 350, 44);
      ctx.strokeStyle = isEditingInitials ? "#10b981" : "#facc15";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(50, 65, 350, 44);

      ctx.fillStyle = isEditingInitials ? "#10b981" : "#facc15";
      ctx.font = "600 14px -apple-system, sans-serif";
      const displayInit = playerInitials + (isEditingInitials ? "_" : "");
      ctx.fillText(`INITIALS: [ ${displayInit} ] ${isEditingInitials ? '(TYPE ON KEYBOARD)' : '(TAP TO TYPE)'}`, canvas.width / 2, 92);

      // Interactive Avatar Box
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(50, 120, 350, 44);
      ctx.strokeStyle = "#10b981";
      ctx.strokeRect(50, 120, 350, 44);

      // Left Arrow
      ctx.fillStyle = "#047857";
      ctx.fillRect(52, 122, 44, 40);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px -apple-system, sans-serif";
      ctx.fillText("⟨", 74, 147);

      // Right Arrow
      ctx.fillStyle = "#047857";
      ctx.fillRect(354, 122, 44, 40);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px -apple-system, sans-serif";
      ctx.fillText("⟩", 376, 147);

      // Avatar Name & Emoji Center Label
      ctx.fillStyle = "#10b981";
      ctx.font = "600 14px -apple-system, sans-serif";
      ctx.fillText(`AVATAR: ${customAvatarImg ? 'Custom 📁' : currentAvatar.emoji + ' ' + currentAvatar.name}`, canvas.width / 2, 147);

      // Leaderboard Top 15 with Date & Time
      drawLeaderboardCard(180, "🏆 TOP 15 HALL OF FAME 🏆");

      // MENU BOTTOM BUTTON BAR: [ 🧭 GUIDE ] [ ▶ START ]
      const btnY = 650;
      const btnH = 45;

      // Guide Button
      ctx.fillStyle = "#334155";
      ctx.fillRect(50, btnY, 165, btnH);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(50, btnY, 165, btnH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 14px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🧭 HOW TO PLAY", 132, btnY + (btnH / 2));

      // Start Game Button
      ctx.fillStyle = "#059669";
      ctx.fillRect(235, btnY, 165, btnH);
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(235, btnY, 165, btnH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 14px -apple-system, sans-serif";
      ctx.fillText("▶ START GAME", 317, btnY + (btnH / 2));

      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
    }

    // ==========================================
    // GAME OVER SCREEN (WITH AUDIO & CUSTOM AVATAR OPTIONS)
    // ==========================================
    if (gameOver) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#f87171";
      ctx.font = "bold 28px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", canvas.width / 2, 40);

      ctx.fillStyle = "#ffffff";
      ctx.font = "14px -apple-system, sans-serif";
      ctx.fillText(`Final Score (${playerInitials || "ACE"}): ${score} pts`, canvas.width / 2, 62);

      // Full Top 15 Leaderboard with Timestamp
      drawLeaderboardCard(80, "🏅 TOP 15 SCORES LEADERBOARD 🏅");

      const btnW = 175;
      const btnH = 40;

      // Row 1: Settings (Audio Toggle & Upload Custom Avatar)
      const row1Y = 645;

      // 1. Audio Toggle
      ctx.fillStyle = audioMuted ? "#475569" : "#0284c7";
      ctx.fillRect(40, row1Y, btnW, btnH);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.strokeRect(40, row1Y, btnW, btnH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 13px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(audioMuted ? "🔇 AUDIO: OFF" : "🔊 AUDIO: ON", 40 + (btnW / 2), row1Y + (btnH / 2));

      // 2. Custom Avatar Upload
      ctx.fillStyle = "#0284c7";
      ctx.fillRect(235, row1Y, btnW, btnH);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.strokeRect(235, row1Y, btnW, btnH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 13px -apple-system, sans-serif";
      ctx.fillText("📁 CUSTOM AVATAR", 235 + (btnW / 2), row1Y + (btnH / 2));

      // Row 2: Navigation (Home vs Play Again)
      const row2Y = 695;

      // 3. Home Menu Button (Left)
      ctx.fillStyle = "#334155";
      ctx.fillRect(40, row2Y, btnW, btnH);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(40, row2Y, btnW, btnH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 14px -apple-system, sans-serif";
      ctx.fillText("🏠 HOME", 40 + (btnW / 2), row2Y + (btnH / 2));

      // 4. Play Again Button (Right)
      ctx.fillStyle = "#059669";
      ctx.fillRect(235, row2Y, btnW, btnH);
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(235, row2Y, btnW, btnH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 14px -apple-system, sans-serif";
      ctx.fillText("🎮 PLAY AGAIN", 235 + (btnW / 2), row2Y + (btnH / 2));

      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
    }

    // Overlay Guide
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
    player.y = 300;
    player.vy = 0;
    player.shieldCount = 1;
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