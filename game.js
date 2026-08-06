/**
 * =============================================================================
 * PixelJump Engine
 * Version: v2.1.01
 *
 * WHAT CHANGED IN v2.1.0
 * - Shield pickup now destroys the pipe it collides with (small hop instead
 *   of a big bounce) instead of just cushioning the hit.
 * - Slow-mo pickup reskinned from a stopwatch to "Turtle Time" (🐢).
 * - Initials are required before Start Game will work (shake + red outline
 *   if left blank) — no more silent "---" fallback.
 * - "Custom Avatar" upload is now a clearly-labeled camera button with a
 *   hint caption, instead of an ambiguous folder icon.
 * - CONFIG.API_BASE_URL now points at the real deployed Worker.
 *
 * WHAT CHANGED IN v2.1.01
 * - Canvas now fills the screen edge-to-edge and resizes live (no more fixed
 *   450x750 box) so it scales cleanly to phones, tablets, and desktops.
 * - Splash / Game Over / How-to-Play screens moved OUT of hand-drawn canvas
 *   code and into real HTML (see index.html + style.css). The canvas now only
 *   renders active gameplay (pipes, player, particles, HUD).
 * - The leaderboard is now backed by the Cloudflare Worker + D1 database in
 *   index.js instead of localStorage-only. See CONFIG.API_BASE_URL below.
 *
 * =============================================================================
 * AI / DEVELOPER EDITING REQUIREMENT
 * =============================================================================
 * Anyone (human or AI) who edits this file MUST bump GAME_VERSION below AND
 * the matching version markers in index.html (<title> + "?v=" script tag) and
 * style.css ("?v=" link tag), using semantic versioning:
 *   PATCH -> bug fixes / tiny tweaks / comment-only changes
 *   MINOR -> new features, new visuals, non-breaking additions
 *   MAJOR -> structural rewrites / breaking changes
 * This keeps the on-screen version badge accurate and busts browser cache.
 * =============================================================================
 */

window.addEventListener('DOMContentLoaded', () => {
  const GAME_VERSION = "v2.1.0";

  // ===========================================================================
  // 0. CONFIG
  // ===========================================================================
  const CONFIG = {
    // TODO(dev): replace with your deployed Worker URL, e.g.
    // "https://pixeljump-leaderboard.<your-subdomain>.workers.dev"
    // This must point at the index.js Worker that talks to your D1 database
    // named "game-leaderboard". Leave as-is to run in local/offline mode.
    API_BASE_URL: "https://game-leaderboard-api.acekallas.workers.dev",
    // Reference design resolution. All gameplay physics/sizes are scaled
    // relative to this so the game *feels* the same on any screen size.
    BASE_W: 450,
    BASE_H: 750,
  };

  // ===========================================================================
  // 1. DOM REFERENCES
  // ===========================================================================
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const gameContainer = document.getElementById('game-container');
  const avatarFileInput = document.getElementById('avatarUpload');

  const splashScreen = document.getElementById('splash-screen');
  const gameOverScreen = document.getElementById('game-over-screen');
  const infoModal = document.getElementById('info-modal');

  const initialsInput = document.getElementById('initialsInput');
  const avatarSelector = document.getElementById('avatarSelector');
  const finalScoreEl = document.getElementById('final-score');

  const splashLeaderboardList = document.getElementById('splashLeaderboardList');
  const splashLeaderboardStatus = document.getElementById('splashLeaderboardStatus');
  const gameOverLeaderboardList = document.getElementById('gameOverLeaderboardList');
  const gameOverLeaderboardStatus = document.getElementById('gameOverLeaderboardStatus');
  const infoGrid = document.getElementById('infoGrid');

  const startGameBtn = document.getElementById('startGameBtn');
  const howToPlayBtn = document.getElementById('howToPlayBtn');
  const closeInfoBtn = document.getElementById('closeInfoBtn');
  const muteBtn = document.getElementById('muteBtn');
  const customAvatarBtn = document.getElementById('customAvatarBtn');
  const homeBtn = document.getElementById('homeBtn');
  const playAgainBtn = document.getElementById('playAgainBtn');

  // ===========================================================================
  // 2. STATE
  // ===========================================================================
  let score = 0;
  let playerInitials = (localStorage.getItem('pixeljump_initials') || "").toUpperCase();

  // Local fallback copy of the leaderboard (used if the Worker/D1 API is
  // unreachable, e.g. offline, or CONFIG.API_BASE_URL hasn't been set yet).
  let highScores = JSON.parse(localStorage.getItem('pixeljump_top15_cache')) || [
    { name: "ACE", score: 50, date: "Aug 02, 14:20" },
    { name: "JMP", score: 35, date: "Aug 03, 09:15" },
    { name: "CAT", score: 20, date: "Aug 04, 18:45" },
  ];
  let leaderboardOnline = false;

  let gameStarted = false;
  let gameOver = false;
  let frameCount = 0;
  let audioMuted = false;

  let slowMoTimer = 0;
  let scoreMultiplierTimer = 0;

  // Live logical (CSS-pixel) size of the canvas — recalculated on resize.
  // Everything in update()/draw() is positioned relative to VW/VH instead of
  // hard-coded pixel numbers, which is what makes the layout scale cleanly.
  let VW = CONFIG.BASE_W;
  let VH = CONFIG.BASE_H;
  // Uniform gameplay scale factor vs. the reference design resolution, used
  // to keep physics (gravity, speed, sizes) feeling consistent on any screen.
  let SCALE = 1;

  const THEMES = {
    day: { name: 'Day', background: "#38bdf8", pipeColor: "#059669", pipeAccent: "#047857", cloudColor: "rgba(255, 255, 255, 0.75)" },
    sunset: { name: 'Sunset', background: "#f97316", pipeColor: "#c2410c", pipeAccent: "#9a3412", cloudColor: "rgba(254, 215, 170, 0.65)" },
    night: { name: 'Night', background: "#1e1b4b", pipeColor: "#6d28d9", pipeAccent: "#5b21b6", cloudColor: "rgba(199, 210, 254, 0.45)" },
    retro: { name: 'Cyberpunk', background: "#0f172a", pipeColor: "#06b6d4", pipeAccent: "#0e7490", cloudColor: "rgba(244, 114, 182, 0.35)" }
  };
  let currentTheme = THEMES.day;

  // Cloud positions are stored as 0-1 fractions of VW/VH so they redistribute
  // correctly whenever the canvas is resized.
  const clouds = [
    { fx: 0.11, fy: 0.13, speed: 0.4, size: 50 },
    { fx: 0.55, fy: 0.21, speed: 0.6, size: 70 },
    { fx: 0.84, fy: 0.09, speed: 0.3, size: 55 }
  ];
  clouds.forEach(c => { c.x = c.fx * VW; c.y = c.fy * VH; });

  // ===========================================================================
  // 3. AUDIO SYNTHESIZER (unchanged logic — tiny procedural sound effects,
  //    no audio files needed)
  // ===========================================================================
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
        osc.start(now); osc.stop(now + 0.1);
      } else if (type === 'item') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now); osc.stop(now + 0.25);
      } else if (type === 'shatter') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
      } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
      }
    } catch (e) { /* Audio can fail silently (e.g. autoplay policy) — non-critical */ }
  }

  // ===========================================================================
  // 4. CHARACTERS
  // ===========================================================================
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
    x: 90, y: 300, width: 38, height: 38, vy: 0,
    gravity: 0.36, jumpStrength: -7.2,
    shieldCount: 1,
    inventory: { sword: false }
  };

  const giantShield = { active: false, pipesRemaining: 0 };

  let pipes = [];
  let items = [];
  let particles = [];
  let floatingTexts = [];

  // ===========================================================================
  // 5. RESPONSIVE CANVAS SIZING
  // Runs on load and every resize/orientation change. Recomputes VW/VH (the
  // logical pixel size the game "thinks" in) and SCALE (how much bigger or
  // smaller that is than the 450x750 reference design), then rescales the
  // player's physics so the game feels equally fast/floaty everywhere.
  // ===========================================================================
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    VW = gameContainer.clientWidth;
    VH = gameContainer.clientHeight;

    // Render at device-pixel resolution for crispness, but keep all game
    // logic working in CSS-pixel (VW/VH) space via this transform.
    canvas.width = Math.round(VW * dpr);
    canvas.height = Math.round(VH * dpr);
    canvas.style.width = VW + 'px';
    canvas.style.height = VH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    SCALE = Math.min(VW / CONFIG.BASE_W, VH / CONFIG.BASE_H);
    SCALE = Math.max(0.55, Math.min(SCALE, 2.4)); // clamp so ultra-wide/tall screens stay playable

    player.gravity = 0.36 * SCALE;
    player.jumpStrength = -7.2 * SCALE;
    player.width = 38 * SCALE;
    player.height = 38 * SCALE;

    clouds.forEach(c => { c.x = c.fx * VW; c.y = c.fy * VH; });
  }
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', resizeCanvas);

  // ===========================================================================
  // 6. LEADERBOARD (Cloudflare Worker + D1, with local-cache fallback)
  // ===========================================================================
  function formatServerDate(iso) {
    try {
      const d = new Date(iso);
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch (e) { return "--"; }
  }

  function setLeaderboardStatus(text) {
    if (splashLeaderboardStatus) splashLeaderboardStatus.textContent = text;
    if (gameOverLeaderboardStatus) gameOverLeaderboardStatus.textContent = text;
  }

  function renderLeaderboardLists() {
    [splashLeaderboardList, gameOverLeaderboardList].forEach(list => {
      if (!list) return;
      list.innerHTML = '';
      highScores.slice(0, 15).forEach((hs, idx) => {
        const li = document.createElement('li');
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
        const isYou = hs.name === playerInitials && playerInitials !== "";
        li.innerHTML = `
          <span class="score-date">
            <span class="rank-badge">${medal}</span>
            <span style="color:${isYou ? '#52d17c' : 'inherit'}">${hs.name}</span>
            <span class="time-stamp">${hs.date || ''}</span>
          </span>
          <span class="score-val">${hs.score} pts</span>`;
        list.appendChild(li);
      });
    });
  }

  async function fetchLeaderboard() {
    setLeaderboardStatus('Loading scores…');
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/api/leaderboard`);
      if (!res.ok) throw new Error('Bad response');
      const data = await res.json();
      highScores = data.map(r => ({ name: r.player_name, score: r.score, date: formatServerDate(r.created_at) }));
      localStorage.setItem('pixeljump_top15_cache', JSON.stringify(highScores));
      leaderboardOnline = true;
      setLeaderboardStatus('🌐 Live global scores');
    } catch (err) {
      leaderboardOnline = false;
      setLeaderboardStatus('📴 Offline — showing saved scores');
    }
    renderLeaderboardLists();
  }

  async function submitHighScore(newScore) {
    const validName = (playerInitials.trim() || "---").substring(0, 3).toUpperCase();
    try {
      await fetch(`${CONFIG.API_BASE_URL}/api/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: validName, score: newScore })
      });
    } catch (err) {
      // Offline or Worker unreachable — keep an optimistic local copy so the
      // player still sees their score in the list this session.
      highScores.push({ name: validName, score: newScore, date: 'Just now' });
      highScores.sort((a, b) => b.score - a.score);
      highScores = highScores.slice(0, 15);
      localStorage.setItem('pixeljump_top15_cache', JSON.stringify(highScores));
    }
    await fetchLeaderboard();
  }

  // ===========================================================================
  // 7. AVATAR SELECTOR (built once into the DOM from the AVATARS list above,
  //    so the list only needs to be maintained in one place)
  // ===========================================================================
  function buildAvatarSelector() {
    avatarSelector.innerHTML = '';
    AVATARS.forEach((avatar, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'avatar-btn';
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-label', avatar.name);
      btn.innerHTML = `<span>${avatar.emoji}</span>`;
      btn.addEventListener('click', () => {
        selectedAvatarIndex = idx;
        customAvatarImg = null;
        updateAvatarSelectionUI();
      });
      avatarSelector.appendChild(btn);
    });

    const uploadBtn = document.createElement('button');
    uploadBtn.type = 'button';
    uploadBtn.className = 'avatar-btn upload-btn';
    uploadBtn.setAttribute('aria-label', 'Use your own photo instead');
    uploadBtn.setAttribute('title', 'Use your own photo!');
    uploadBtn.innerHTML = `<span>📷<i class="plus-badge">+</i></span>`;
    uploadBtn.addEventListener('click', () => avatarFileInput.click());
    avatarSelector.appendChild(uploadBtn);

    updateAvatarSelectionUI();
  }

  function updateAvatarSelectionUI() {
    const buttons = avatarSelector.querySelectorAll('.avatar-btn');
    buttons.forEach((btn, idx) => btn.classList.remove('active'));
    if (!customAvatarImg && buttons[selectedAvatarIndex]) {
      buttons[selectedAvatarIndex].classList.add('active');
    }
  }

  avatarFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => {
          customAvatarImg = img;
          updateAvatarSelectionUI();
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // ===========================================================================
  // 8. "HOW TO PLAY" INFO GRID (built from data so gameplay tuning and the
  //    guide text can never drift out of sync)
  // ===========================================================================
  const GUIDE_SECTIONS = [
    { icon: '🛡️', title: 'Aura Shield', body: 'Blocks 1 hit. Grab a 2nd to stack a double barrier!' },
    { icon: '🐢', title: 'Turtle Time', body: 'Everything slows way down for 8 seconds!' },
    { icon: '💎', title: 'Gem Multiplier', body: 'Doubles your points for a while!' },
    { icon: '⚔️', title: 'Sword Pickup', body: 'Combine with an active Shield for a surprise!' },
    { icon: '🛡️+⚔️', title: "Knight's Rampage", body: 'Smashes 6 pipes in a row for +50 points!' },
  ];

  function buildInfoGrid() {
    infoGrid.innerHTML = '';
    GUIDE_SECTIONS.forEach(sec => {
      const div = document.createElement('div');
      div.className = 'info-item';
      div.innerHTML = `<span class="icon">${sec.icon}</span><div><strong>${sec.title}</strong><small>${sec.body}</small></div>`;
      infoGrid.appendChild(div);
    });
  }

  // ===========================================================================
  // 9. SCREEN MANAGEMENT
  // ===========================================================================
  function showScreen(name) {
    splashScreen.classList.toggle('hidden', name !== 'splash');
    gameOverScreen.classList.toggle('hidden', name !== 'gameover');
  }

  function syncInitialsInput() {
    initialsInput.value = playerInitials;
  }

  // ===========================================================================
  // 10. UI EVENT WIRING (real DOM controls replace the old hand-drawn
  //     hit-testing on the canvas — more robust, accessible, and touch-friendly)
  // ===========================================================================
  initialsInput.addEventListener('input', () => {
    playerInitials = initialsInput.value.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 3);
    initialsInput.value = playerInitials;
    if (playerInitials.length > 0) initialsInput.classList.remove('invalid');
  });
  initialsInput.addEventListener('blur', () => {
    if (playerInitials.trim().length > 0) localStorage.setItem('pixeljump_initials', playerInitials);
  });

  startGameBtn.addEventListener('click', () => {
    // Require at least one letter before play can begin — no silent "---" fallback.
    if (playerInitials.trim().length === 0) {
      initialsInput.classList.add('invalid');
      initialsInput.focus();
      splashScreen.classList.add('shake');
      setTimeout(() => splashScreen.classList.remove('shake'), 300);
      return;
    }
    localStorage.setItem('pixeljump_initials', playerInitials);
    initAudio();
    gameStarted = true;
    showScreen('game');
    resetGame();
  });

  howToPlayBtn.addEventListener('click', () => infoModal.classList.remove('hidden'));
  closeInfoBtn.addEventListener('click', () => infoModal.classList.add('hidden'));
  infoModal.addEventListener('click', (e) => { if (e.target === infoModal) infoModal.classList.add('hidden'); });

  muteBtn.addEventListener('click', () => {
    audioMuted = !audioMuted;
    muteBtn.textContent = audioMuted ? '🔇 Audio: Off' : '🔊 Audio: On';
  });

  customAvatarBtn.addEventListener('click', () => avatarFileInput.click());

  homeBtn.addEventListener('click', () => {
    gameStarted = false;
    gameOver = false;
    showScreen('splash');
  });

  playAgainBtn.addEventListener('click', () => {
    resetGame();
    gameStarted = true;
    showScreen('game');
  });

  // Space / Up-arrow: jump during play, start on splash, replay on game over.
  // Ignored while the player is actively typing in the initials field.
  window.addEventListener('keydown', (e) => {
    if (document.activeElement === initialsInput) return;

    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (!infoModal.classList.contains('hidden')) {
        infoModal.classList.add('hidden');
        return;
      }
      if (!gameStarted) {
        startGameBtn.click();
      } else if (gameOver) {
        playAgainBtn.click();
      } else {
        initAudio();
        player.vy = player.jumpStrength;
        playSound('jump');
      }
    }
  });

  // Tap/click/touch anywhere on the canvas = jump (only relevant during
  // active gameplay now that menus are real DOM elements sitting on top).
  function handleJumpInput(e) {
    if (!gameStarted || gameOver) return;
    e.preventDefault();
    initAudio();
    player.vy = player.jumpStrength;
    playSound('jump');
  }
  canvas.addEventListener('touchstart', handleJumpInput, { passive: false });
  canvas.addEventListener('mousedown', handleJumpInput);

  // ===========================================================================
  // 11. GAMEPLAY LOGIC (spawning, scoring, collisions — scaled by SCALE/VW/VH
  //     so difficulty and layout stay consistent across screen sizes)
  // ===========================================================================
  function spawnItem(pipeX, topHeight, gap) {
    if (Math.random() < 0.45) {
      const rand = Math.random();
      let type = rand < 0.3 ? 'shield' : rand < 0.55 ? 'sword' : rand < 0.8 ? 'slow' : 'gem';
      const safeY = topHeight + (gap / 2) - 10;
      items.push({ type, x: pipeX + 18 * SCALE, y: safeY, size: 26 * SCALE, collected: false });
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
      slowMoTimer = 480;
      spawnFloatingText("🐢 TURTLE TIME!", player.x, player.y - 15, "#22c55e");
    } else if (type === 'gem') {
      scoreMultiplierTimer = 360;
      spawnFloatingText("💎 2X POINTS!", player.x, player.y - 15, "#c084fc");
    }
    if (player.shieldCount > 0 && player.inventory.sword) triggerGiantShieldCombo();
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

  function createPipeShatterParticles(x, y, width, height) {
    for (let i = 0; i < 24; i++) {
      particles.push({
        x: x + Math.random() * width, y: y + Math.random() * height,
        vx: (Math.random() - 0.1) * 7 + 2, vy: (Math.random() - 0.5) * 8,
        size: (Math.random() * 6 + 4) * SCALE, color: currentTheme.pipeColor,
        alpha: 1.0, gravity: 0.3 * SCALE,
        rotation: Math.random() * Math.PI * 2, vRot: (Math.random() - 0.5) * 0.2
      });
    }
  }

  function spawnFloatingText(text, x, y, color = '#ffffff') {
    floatingTexts.push({ text, x, y, alpha: 1.0, vy: -1.2, color });
  }

  function spawnPipe() {
    const gap = Math.max(130 * SCALE, VH * 0.22);
    const minHeight = 60 * SCALE;
    const maxHeight = VH - gap - minHeight;
    const topHeight = Math.floor(Math.random() * Math.max(1, maxHeight - minHeight)) + minHeight;
    const pipeX = VW;
    pipes.push({ x: pipeX, width: 60 * SCALE, topHeight, bottomY: topHeight + gap, passed: false, shattered: false });
    spawnItem(pipeX, topHeight, gap);
  }

  function update() {
    if (!gameStarted || gameOver || !infoModal.classList.contains('hidden')) return;
    frameCount++;

    if (slowMoTimer > 0) slowMoTimer--;
    if (scoreMultiplierTimer > 0) scoreMultiplierTimer--;

    const currentSpeed = (slowMoTimer > 0 ? 1.1 : 2.2) * SCALE;

    if (score >= 30) currentTheme = THEMES.retro;
    else if (score >= 20) currentTheme = THEMES.night;
    else if (score >= 10) currentTheme = THEMES.sunset;
    else currentTheme = THEMES.day;

    clouds.forEach(c => {
      c.x -= (c.speed * (currentSpeed / 2));
      if (c.x + c.size * 2 < 0) c.x = VW + 50;
    });

    player.vy += player.gravity;
    player.y += player.vy;
    if (player.y + player.height >= VH || player.y <= 0) handlePlayerHit();

    const pipeSpawnInterval = (slowMoTimer > 0) ? 220 : 110;
    if (frameCount % pipeSpawnInterval === 0) spawnPipe();

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy; ft.alpha -= 0.02;
      if (ft.alpha <= 0) floatingTexts.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.rotation += p.vRot; p.alpha -= 0.025;
      if (p.alpha <= 0) particles.splice(i, 1);
    }

    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      item.x -= currentSpeed;
      if (!item.collected && player.x < item.x + item.size && player.x + player.width > item.x &&
          player.y < item.y + item.size && player.y + player.height > item.y) {
        item.collected = true;
        collectItem(item.type);
        items.splice(i, 1);
      } else if (item.x + item.size < 0) {
        items.splice(i, 1);
      }
    }

    const playerCenterX = player.x + player.width / 2;
    for (let i = pipes.length - 1; i >= 0; i--) {
      const pipe = pipes[i];
      pipe.x -= currentSpeed;

      if (!pipe.passed && pipe.x + pipe.width < player.x) {
        pipe.passed = true;
        const addScore = (scoreMultiplierTimer > 0) ? 2 : 1;
        score += addScore;
        if (scoreMultiplierTimer > 0) spawnFloatingText("+2 PTS 💎", player.x, player.y - 20, "#c084fc");
      }

      if (pipe.shattered) continue;

      if (giantShield.active) {
        const reach = 70 * SCALE, backReach = 35 * SCALE;
        if (pipe.x <= playerCenterX + reach && pipe.x + pipe.width >= playerCenterX - backReach) {
          pipe.shattered = true;
          giantShield.pipesRemaining--;
          playSound('shatter');
          createPipeShatterParticles(pipe.x, 0, pipe.width, pipe.topHeight);
          createPipeShatterParticles(pipe.x, pipe.bottomY, pipe.width, VH - pipe.bottomY);
          spawnFloatingText("AEGIS SHATTER!", pipe.x, player.y, "#10b981");
          if (giantShield.pipesRemaining <= 0) giantShield.active = false;
        }
      } else {
        const hitBox = (player.x + player.width > pipe.x && player.x < pipe.x + pipe.width &&
          (player.y < pipe.topHeight || player.y + player.height > pipe.bottomY));
        if (hitBox) handlePlayerHit(pipe);
      }

      if (pipe.x + pipe.width < 0) pipes.splice(i, 1);
    }
  }

  // pipe is optional — omitted when the hit was the ceiling/floor rather than
  // an actual pipe (in that case the shield just cushions the bump).
  function handlePlayerHit(pipe = null) {
    if (player.shieldCount > 0) {
      player.shieldCount--;
      playSound('shatter');
      const remText = player.shieldCount > 0 ? "1 SHIELD REMAINING!" : "SHIELD BROKEN!";

      if (pipe) {
        // Shield smashes straight through the pipe instead of just bouncing off it.
        pipe.shattered = true;
        createPipeShatterParticles(pipe.x, 0, pipe.width, pipe.topHeight);
        createPipeShatterParticles(pipe.x, pipe.bottomY, pipe.width, VH - pipe.bottomY);
        spawnFloatingText("🛡️ SHIELD SMASH!", pipe.x, player.y - 20, "#10b981");
        spawnFloatingText(remText, player.x - 20, player.y + 10, "#10b981");
        player.vy = player.jumpStrength * 0.5; // small hop, the pipe is already gone
      } else {
        player.vy = player.jumpStrength;
        spawnFloatingText(remText, player.x - 20, player.y - 20, "#10b981");
      }
    } else {
      endGame();
    }
  }

  // ===========================================================================
  // 12. RENDER (gameplay layer only — menus are DOM now, see index.html)
  // ===========================================================================
  function drawKnightKiteShield(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = "#10b981";
    ctx.shadowBlur = 14 * SCALE;
    ctx.beginPath();
    ctx.moveTo(0, -38 * SCALE); ctx.lineTo(28 * SCALE, -38 * SCALE); ctx.lineTo(24 * SCALE, 6 * SCALE);
    ctx.lineTo(0, 44 * SCALE); ctx.lineTo(-24 * SCALE, 6 * SCALE); ctx.lineTo(-28 * SCALE, -38 * SCALE);
    ctx.closePath();
    const grad = ctx.createLinearGradient(-28 * SCALE, -38 * SCALE, 28 * SCALE, 44 * SCALE);
    grad.addColorStop(0, '#f8fafc'); grad.addColorStop(0.5, '#94a3b8'); grad.addColorStop(1, '#334155');
    ctx.fillStyle = grad; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#facc15'; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-5 * SCALE, -32 * SCALE, 10 * SCALE, 64 * SCALE);
    ctx.fillRect(-22 * SCALE, -16 * SCALE, 44 * SCALE, 10 * SCALE);
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = currentTheme.background;
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = currentTheme.cloudColor;
    clouds.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.size / 2, 0, Math.PI * 2);
      ctx.arc(c.x + c.size * 0.3, c.y - c.size * 0.2, c.size * 0.4, 0, Math.PI * 2);
      ctx.arc(c.x + c.size * 0.6, c.y, c.size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    });

    pipes.forEach(pipe => {
      if (pipe.shattered) return;
      ctx.fillStyle = currentTheme.pipeColor;
      ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
      ctx.fillRect(pipe.x, pipe.bottomY, pipe.width, VH - pipe.bottomY);
      ctx.fillStyle = currentTheme.pipeAccent;
      ctx.fillRect(pipe.x - 4 * SCALE, pipe.topHeight - 18 * SCALE, pipe.width + 8 * SCALE, 18 * SCALE);
      ctx.fillRect(pipe.x - 4 * SCALE, pipe.bottomY, pipe.width + 8 * SCALE, 18 * SCALE);
    });

    items.forEach(item => {
      ctx.font = `${24 * SCALE}px sans-serif`;
      let icon = item.type === 'sword' ? '⚔️' : item.type === 'slow' ? '🐢' : item.type === 'gem' ? '💎' : '🛡️';
      ctx.fillText(icon, item.x, item.y);
    });

    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    const currentAvatar = AVATARS[selectedAvatarIndex];
    if (customAvatarImg) {
      ctx.drawImage(customAvatarImg, player.x, player.y, player.width, player.height);
    } else {
      ctx.fillStyle = currentAvatar.color;
      ctx.beginPath();
      ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = `${20 * SCALE}px sans-serif`;
      ctx.fillText(currentAvatar.emoji, player.x + 8 * SCALE, player.y + 27 * SCALE);
    }

    if (player.shieldCount > 0 && !giantShield.active) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width / 2 + 7 * SCALE, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(16, 185, 129, 0.35)";
      ctx.fill();
      ctx.strokeStyle = "#10b981"; ctx.lineWidth = 2; ctx.stroke();
      if (player.shieldCount >= 2) {
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width / 2 + 13 * SCALE, 0, Math.PI * 2);
        ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2.5; ctx.stroke();
      }
      ctx.restore();
    }

    if (giantShield.active) drawKnightKiteShield(player.x + player.width + 24 * SCALE, player.y + player.height / 2);

    floatingTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = `600 ${16 * SCALE}px 'Nunito', -apple-system, sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    // --- HUD (live score / status, only meaningful during active play) ---
    const pad = 20 * SCALE;
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${20 * SCALE}px 'Baloo 2', -apple-system, sans-serif`;
    ctx.fillText(`Score: ${score}`, pad, 35 * SCALE);

    ctx.font = `${13 * SCALE}px 'Nunito', -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillText(`Player: ${playerInitials || "---"}`, pad, 56 * SCALE);
    ctx.textAlign = "right";
    ctx.fillText(`${currentTheme.name} Theme`, VW - pad, 45 * SCALE);
    ctx.fillText(GAME_VERSION, VW - pad, 24 * SCALE);
    ctx.textAlign = "left";

    let hudY = 78 * SCALE;
    let invStatus = "Shields: ";
    if (player.shieldCount > 0) invStatus += `🛡️ x${player.shieldCount} `;
    if (player.inventory.sword) invStatus += "⚔️ ";
    ctx.font = `${14 * SCALE}px 'Nunito', -apple-system, sans-serif`;
    ctx.fillText(invStatus, pad, hudY);

    if (slowMoTimer > 0) {
      hudY += 20 * SCALE;
      ctx.fillStyle = "#22c55e";
      ctx.fillText(`🐢 Turtle Time: ${Math.ceil(slowMoTimer / 60)}s`, pad, hudY);
    }
    if (scoreMultiplierTimer > 0) {
      hudY += 20 * SCALE;
      ctx.fillStyle = "#c084fc";
      ctx.fillText(`💎 2x Points: ${Math.ceil(scoreMultiplierTimer / 60)}s`, pad, hudY);
    }
    if (giantShield.active) {
      hudY += 20 * SCALE;
      ctx.fillStyle = "#10b981";
      ctx.font = `600 ${14 * SCALE}px 'Nunito', -apple-system, sans-serif`;
      ctx.fillText(`Knight Shield Hits Left: ${giantShield.pipesRemaining}`, pad, hudY);
    }
  }

  // ===========================================================================
  // 13. GAME STATE TRANSITIONS
  // ===========================================================================
  async function endGame() {
    if (!gameOver) {
      playSound('hit');
      gameOver = true;
      finalScoreEl.textContent = `Score (${playerInitials || "---"}): ${score} pts`;
      showScreen('gameover');
      gameContainer.classList.add('shake');
      setTimeout(() => gameContainer.classList.remove('shake'), 300);
      await submitHighScore(score);
    }
  }

  function resetGame() {
    player.y = VH * 0.4;
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

  // ===========================================================================
  // 14. BOOTSTRAP
  // ===========================================================================
  resizeCanvas();
  player.x = VW * 0.2;
  player.y = VH * 0.4;
  syncInitialsInput();
  buildAvatarSelector();
  buildInfoGrid();
  fetchLeaderboard();
  gameLoop();
});
