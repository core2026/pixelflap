/**
 * =============================================================================
 * PixelJump Engine
 * Version: v2.9.00
 *
 * WHAT CHANGED IN v2.9.00
 * - "How to Play" is now an animated, click-to-open tutorial instead of a
 *   static text grid: a small canvas cycles through mini-scenes (flap
 *   timing, dodging pipes, then each power-up bouncing/spinning with its
 *   description) with Prev/Next controls and step dots. Still only opens
 *   when the button is clicked — never shown automatically.
 *
 * WHAT CHANGED IN v2.8.00
 * - Difficulty presets: Easy / Normal / Hard, selectable on the splash
 *   screen. Each tunes base pipe speed, gap size, and how fast the ramp
 *   tightens up. Choice is remembered between visits.
 * - High scores, personal bests, and the leaderboard are now tracked
 *   separately per difficulty (both locally and via the backend — see
 *   index.js for the required one-time database migration).
 *
 * WHAT CHANGED IN v2.7.00
 * - Visual difficulty cues: a subtle screen darkening plus faint motion-line
 *   particles kick in as the speed ramp progresses, so it *feels* faster,
 *   not just runs faster.
 * - Perfect Run streak: a skill-only bonus for clearing pipes in a row
 *   without collecting ANY item (+8 every 8 in a row). Breaks the moment
 *   you grab a pickup or take a hit.
 * - Rubber-band mercy: three early deaths (under 5 pipes) in a row eases
 *   the difficulty ramp back for the next attempt, with a small friendly
 *   callout. Resets the moment a run clears 5+ pipes. Session-only.
 * - Game-over stats panel now shows Best Perfect Streak and a "Speed
 *   Reached" progress bar showing how far into the 40-pipe ramp you got.
 *
 * WHAT CHANGED IN v2.6.00
 * - Coins now render as a hand-drawn spinning gold coin (gradient body,
 *   ridge ring, $ mark, glossy highlight) instead of the flat 🪙 emoji.
 * - Gentle difficulty ramp: the further you get, the faster pipes move,
 *   the tighter they're spaced, and the narrower the gaps get — all tied
 *   to pipes actually cleared (not score, so bonus points don't cause
 *   spikes) and capped after 40 pipes so it never becomes unwinnable.
 *   A small "Speeding Up!" callout marks each step.
 *
 * WHAT CHANGED IN v2.5.01
 * - Fixed pickup icons being drawn with the default (alphabetic) text
 *   baseline, which anchors differently per-glyph — on iPadOS the shield
 *   emoji rendered noticeably taller than the others and could clip against
 *   the canvas edge. Icons are now centered on their own bounding box.
 * - Lowered the Turtle Time (slow-mo) drop rate — it was showing up too often.
 *
 * WHAT CHANGED IN v2.5.00
 * - Near-miss "close call" bonus: skim past a pipe without touching it and
 *   bank a growing bonus for chaining close calls.
 * - Magnet power-up: pulls nearby items toward the player for a few seconds.
 * - Mini Mode power-up: temporarily shrinks the player to slip through
 *   tight gaps (player position now tracked from its center so this scales
 *   symmetrically).
 * - Lucky Feather power-up: saves you from one otherwise-fatal hit, once.
 * - Coins: a simple persistent currency (saved per-device via
 *   localStorage) shown on the splash screen and tallied after each run.
 * - Game-over screen now shows an easy-to-scan stats panel (personal best,
 *   pipes cleared, best streaks, coins earned) right next to the score.
 *
 * WHAT CHANGED IN v2.4.00
 * - Rare golden pipes: still fly through the gap, but clearing one banks a
 *   +5 point bonus and a sparkle callout.
 * - Sword-kill streak meter: chaining pipe slices without getting hit builds
 *   a streak, with a bonus +10 every 5 in a row. Any hit resets it.
 * - Spinning sword blades now leave a brief golden particle trail as they
 *   orbit the player.
 *
 * WHAT CHANGED IN v2.3.00
 * - Pipe gaps no longer swing straight from floor to ceiling back-to-back;
 *   each new gap is clamped near the previous one's height.
 * - Reworked pipe art: rounded gradient "crystal pillar" pipes with glowing
 *   gem caps and shimmer facets, replacing the flat green Flappy-Bird-style
 *   pipes. Each theme now has its own pipe palette (no more plain green).
 * - Sword pickup now grants a real spinning sword: orbiting blades shatter
 *   any pipe the player touches (consuming a charge) instead of ending the
 *   run. Picking up a Shield while carrying a sword (or vice versa) still
 *   triggers the Knight's Aegis giant-shield combo as before.
 *
 * WHAT CHANGED IN v2.2.00
 * - Added pure JS 8-bit retro background music synth loop using Web Audio API.
 * - Dynamic music tempo that slows down during Turtle Time!
 * =============================================================================
 */

window.addEventListener('DOMContentLoaded', () => {
  const GAME_VERSION = "v2.9.00";

  // ===========================================================================
  // 0. CONFIG
  // ===========================================================================
  const CONFIG = {
    API_BASE_URL: "https://game-leaderboard-api.acekallas.workers.dev",
    BASE_W: 450,
    BASE_H: 750,
  };

  // Difficulty presets: each tunes base pipe speed, gap size, and how fast
  // the ramp (see difficultyLevel()) tightens things up. High scores are
  // tracked separately per difficulty (see leaderboard section).
  const DIFFICULTY_PRESETS = {
    easy:   { label: 'Easy',   speedMult: 0.82, gapBonus: 26,  rampRate: 0.012, gapRampRate: 0.50, intervalRampRate: 0.40, intervalFloor: 92, gapFloor: 112 },
    normal: { label: 'Normal', speedMult: 1.00, gapBonus: 0,   rampRate: 0.020, gapRampRate: 0.85, intervalRampRate: 0.70, intervalFloor: 78, gapFloor: 100 },
    hard:   { label: 'Hard',   speedMult: 1.18, gapBonus: -18, rampRate: 0.030, gapRampRate: 1.15, intervalRampRate: 0.95, intervalFloor: 62, gapFloor: 86 },
  };
  const VALID_DIFFICULTIES = ['easy', 'normal', 'hard'];

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
  const totalCoinsDisplay = document.getElementById('totalCoinsDisplay');
  const statBestEl = document.getElementById('statBest');
  const statPipesEl = document.getElementById('statPipes');
  const statSwordStreakEl = document.getElementById('statSwordStreak');
  const statGrazeStreakEl = document.getElementById('statGrazeStreak');
  const statCoinsEl = document.getElementById('statCoins');
  const statPerfectStreakEl = document.getElementById('statPerfectStreak');
  const statRampFillEl = document.getElementById('statRampFill');
  const statRampLabelEl = document.getElementById('statRampLabel');

  const difficultySelector = document.getElementById('difficultySelector');
  const splashLeaderboardDiff = document.getElementById('splashLeaderboardDiff');
  const gameOverLeaderboardDiff = document.getElementById('gameOverLeaderboardDiff');

  const splashLeaderboardList = document.getElementById('splashLeaderboardList');
  const splashLeaderboardStatus = document.getElementById('splashLeaderboardStatus');
  const gameOverLeaderboardList = document.getElementById('gameOverLeaderboardList');
  const gameOverLeaderboardStatus = document.getElementById('gameOverLeaderboardStatus');
  const tutorialCanvas = document.getElementById('tutorialCanvas');
  const tutorialCaption = document.getElementById('tutorialCaption');
  const tutorialDots = document.getElementById('tutorialDots');
  const tutorialPrevBtn = document.getElementById('tutorialPrevBtn');
  const tutorialNextBtn = document.getElementById('tutorialNextBtn');

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

  let selectedDifficulty = VALID_DIFFICULTIES.includes(localStorage.getItem('pixeljump_difficulty'))
    ? localStorage.getItem('pixeljump_difficulty') : 'normal';

  function getDifficultyPreset() { return DIFFICULTY_PRESETS[selectedDifficulty] || DIFFICULTY_PRESETS.normal; }
  function difficultyLabel(d) { return DIFFICULTY_PRESETS[d] ? DIFFICULTY_PRESETS[d].label : 'Normal'; }
  function scoreCacheKey(d) { return `pixeljump_top15_cache_${d}`; }
  function personalBestKey(d) { return `pixeljump_personal_best_${d}`; }

  let highScores = JSON.parse(localStorage.getItem(scoreCacheKey(selectedDifficulty))) || [
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
  let swordStreak = 0;
  let swordStreakFlashTimer = 0;
  let magnetTimer = 0;
  let shrinkTimer = 0;
  let hasFeather = false;

  // Grazes: flying close past a pipe without touching it
  let grazeStreak = 0;
  let bestGrazeStreak = 0;
  let bestSwordStreak = 0;
  let pipesClearedThisRun = 0;

  // "Perfect run" — a skill-only streak of pipes cleared without collecting
  // ANY item (no shield, sword, coin, etc. — pure flying).
  let perfectRunStreak = 0;
  let bestPerfectStreak = 0;

  // Rubber-band mercy: if the player dies very early several runs in a row,
  // ease the difficulty ramp back a notch for the next attempt. Session-only
  // (not persisted), and eases back off again the moment they clear 5+ pipes.
  let earlyDeathStreak = 0;
  let mercyMessagePending = false;
  function isMercyActive() { return earlyDeathStreak >= 3; }

  // Faint motion-line particles that kick in as the pipe speed ramps up, so
  // the game visually communicates "getting faster" beyond just the numbers.
  let windStreaks = [];

  // Persistent, per-device progress (localStorage — see note in chat about
  // this not syncing across devices without a real account system).
  let totalCoins = parseInt(localStorage.getItem('pixeljump_total_coins'), 10) || 0;
  let coinsThisRun = 0;
  let personalBest = parseInt(localStorage.getItem(personalBestKey(selectedDifficulty)), 10) || 0;

  let VW = CONFIG.BASE_W;
  let VH = CONFIG.BASE_H;
  let SCALE = 1;

  const THEMES = {
    day: { name: 'Day', background: "#38bdf8", pipeColor: "#8b5cf6", pipeAccent: "#6d28d9", pipeHighlight: "#ddd6fe", pipeCap: "#fbbf24", cloudColor: "rgba(255, 255, 255, 0.75)" },
    sunset: { name: 'Sunset', background: "#f97316", pipeColor: "#f43f5e", pipeAccent: "#be123c", pipeHighlight: "#fecdd3", pipeCap: "#fde047", cloudColor: "rgba(254, 215, 170, 0.65)" },
    night: { name: 'Night', background: "#1e1b4b", pipeColor: "#4338ca", pipeAccent: "#312e81", pipeHighlight: "#a5b4fc", pipeCap: "#38bdf8", cloudColor: "rgba(199, 210, 254, 0.45)" },
    retro: { name: 'Cyberpunk', background: "#0f172a", pipeColor: "#06b6d4", pipeAccent: "#0e7490", pipeHighlight: "#a5f3fc", pipeCap: "#f472b6", cloudColor: "rgba(244, 114, 182, 0.35)" }
  };
  let currentTheme = THEMES.day;

  const clouds = [
    { fx: 0.11, fy: 0.13, speed: 0.4, size: 50 },
    { fx: 0.55, fy: 0.21, speed: 0.6, size: 70 },
    { fx: 0.84, fy: 0.09, speed: 0.3, size: 55 }
  ];
  clouds.forEach(c => { c.x = c.fx * VW; c.y = c.fy * VH; });

  // ===========================================================================
  // 3. AUDIO SYNTHESIZER & RETRO BGM
  // ===========================================================================
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  let bgmInterval = null;
  let bgmNoteIndex = 0;

  // Old-school 8-bit arcade melody line (frequencies in Hz)
  const RETRO_MELODY = [
    261.63, 329.63, 392.00, 523.25, 392.00, 329.63,
    293.66, 349.23, 440.00, 587.33, 440.00, 349.23,
    329.63, 392.00, 493.88, 659.25, 493.88, 392.00,
    349.23, 440.00, 523.25, 698.46, 523.25, 440.00
  ];

  function initAudio() {
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function startBackgroundMusic() {
    if (bgmInterval || audioMuted || !audioCtx) return;

    bgmNoteIndex = 0;
    bgmInterval = setInterval(() => {
      if (audioMuted || !gameStarted || gameOver) {
        stopBackgroundMusic();
        return;
      }

      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        // Square wave creates the iconic NES / GameBoy sound
        osc.type = 'square';
        const freq = RETRO_MELODY[bgmNoteIndex % RETRO_MELODY.length];

        const noteDuration = slowMoTimer > 0 ? 0.25 : 0.14;

        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime); // Soft background volume
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + noteDuration);

        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + noteDuration);

        bgmNoteIndex++;
      } catch (e) { }
    }, 180);
  }

  function stopBackgroundMusic() {
    if (bgmInterval) {
      clearInterval(bgmInterval);
      bgmInterval = null;
    }
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
    } catch (e) { }
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
    baseWidth: 38, baseHeight: 38,
    cx: 90 + 19, cy: 300 + 19, // center point — the source of truth for position
    gravity: 0.36, jumpStrength: -7.2,
    shieldCount: 1,
    inventory: { sword: false, swordCharges: 0 }
  };

  const giantShield = { active: false, pipesRemaining: 0 };

  let pipes = [];
  let items = [];
  let particles = [];
  let floatingTexts = [];
  let lastPipeCenterY = null; // tracks previous gap center so pipes don't swing floor-to-ceiling back to back

  // ===========================================================================
  // 5. RESPONSIVE CANVAS SIZING
  // ===========================================================================
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    VW = gameContainer.clientWidth;
    VH = gameContainer.clientHeight;

    canvas.width = Math.round(VW * dpr);
    canvas.height = Math.round(VH * dpr);
    canvas.style.width = VW + 'px';
    canvas.style.height = VH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    SCALE = Math.min(VW / CONFIG.BASE_W, VH / CONFIG.BASE_H);
    SCALE = Math.max(0.55, Math.min(SCALE, 2.4));

    player.gravity = 0.36 * SCALE;
    player.jumpStrength = -7.2 * SCALE;
    player.baseWidth = 38 * SCALE;
    player.baseHeight = 38 * SCALE;
    const sizeMult = shrinkTimer > 0 ? 0.62 : 1;
    player.width = player.baseWidth * sizeMult;
    player.height = player.baseHeight * sizeMult;
    player.x = player.cx - player.width / 2;
    player.y = player.cy - player.height / 2;

    clouds.forEach(c => { c.x = c.fx * VW; c.y = c.fy * VH; });
  }
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', resizeCanvas);

  // ===========================================================================
  // 6. LEADERBOARD
  // ===========================================================================
  function formatServerDate(rawDate) {
    if (!rawDate || rawDate === "undefined" || rawDate === "null") return "--";

    try {
      let str = String(rawDate).trim();
      if (str.includes(" ") && !str.includes("T")) {
        str = str.replace(" ", "T") + "Z";
      }

      const d = new Date(str);
      if (isNaN(d.getTime())) return "--";

      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const month = months[d.getMonth()];
      if (!month) return "--";

      const date = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');

      return `${month} ${date}, ${hours}:${mins}`;
    } catch (e) {
      return "--";
    }
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
        const displayDate = (hs.date && hs.date !== "undefined") ? hs.date : "--";

        li.innerHTML = `
          <span class="score-date">
            <span class="rank-badge">${medal}</span>
            <span style="color:${isYou ? '#52d17c' : 'inherit'}">${hs.name}</span>
            <span class="time-stamp">${displayDate}</span>
          </span>
          <span class="score-val">${hs.score} pts</span>`;
        list.appendChild(li);
      });
    });
  }

  function updateLeaderboardDiffLabels() {
    const label = difficultyLabel(selectedDifficulty);
    if (splashLeaderboardDiff) splashLeaderboardDiff.textContent = label;
    if (gameOverLeaderboardDiff) gameOverLeaderboardDiff.textContent = label;
  }

  async function fetchLeaderboard() {
    setLeaderboardStatus('Loading scores…');
    updateLeaderboardDiffLabels();
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/api/leaderboard?difficulty=${selectedDifficulty}`);
      if (!res.ok) throw new Error('Bad response');
      const data = await res.json();

      highScores = data.map(r => {
        let rawDate = r.created_at || r.createdAt || r.date || r.timestamp || r.created;
        return {
          name: r.player_name || r.name || "---",
          score: r.score ?? 0,
          date: formatServerDate(rawDate)
        };
      });

      localStorage.setItem(scoreCacheKey(selectedDifficulty), JSON.stringify(highScores));
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
        body: JSON.stringify({ name: validName, score: newScore, difficulty: selectedDifficulty })
      });
    } catch (err) {
      highScores.push({ name: validName, score: newScore, date: '--' });
      highScores.sort((a, b) => b.score - a.score);
      highScores = highScores.slice(0, 15);
      localStorage.setItem(scoreCacheKey(selectedDifficulty), JSON.stringify(highScores));
    }
    await fetchLeaderboard();
  }

  // ===========================================================================
  // 6b. DIFFICULTY SELECTOR
  // ===========================================================================
  function applyDifficultyUI() {
    if (!difficultySelector) return;
    difficultySelector.querySelectorAll('.diff-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.difficulty === selectedDifficulty);
    });
  }

  function selectDifficulty(diff) {
    if (!VALID_DIFFICULTIES.includes(diff) || diff === selectedDifficulty) {
      if (diff === selectedDifficulty) applyDifficultyUI();
      return;
    }
    selectedDifficulty = diff;
    localStorage.setItem('pixeljump_difficulty', selectedDifficulty);
    personalBest = parseInt(localStorage.getItem(personalBestKey(selectedDifficulty)), 10) || 0;
    highScores = JSON.parse(localStorage.getItem(scoreCacheKey(selectedDifficulty))) || [];
    applyDifficultyUI();
    renderLeaderboardLists();
    fetchLeaderboard();
  }

  function initDifficultySelector() {
    if (!difficultySelector) return;
    applyDifficultyUI();
    difficultySelector.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => selectDifficulty(btn.dataset.difficulty));
    });
  }

  // ===========================================================================
  // 7. AVATAR SELECTOR
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
    buttons.forEach((btn) => btn.classList.remove('active'));
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
  // 8. INFO GRID
  // ===========================================================================
  const GUIDE_SECTIONS = [
    { icon: '🛡️', title: 'Aura Shield', body: 'Blocks 1 hit. Grab a 2nd to stack a double barrier!' },
    { icon: '🐢', title: 'Turtle Time', body: 'Everything slows way down for 8 seconds!' },
    { icon: '💎', title: 'Gem Multiplier', body: 'Doubles your points for a while!' },
    { icon: '⚔️', title: 'Spinning Sword', body: 'Orbiting blades slice any pipe you touch! Combine with a Shield for a surprise!' },
    { icon: '🔥', title: 'Sword Streak', body: 'Slice pipes back-to-back without getting hit for a +10 bonus every 5!' },
    { icon: '✨', title: 'Golden Pipe', body: 'Rare gold pipes bank a +5 bonus when you clear them!' },
    { icon: '😅', title: 'Close Calls', body: 'Skim past a pipe without touching it for a near-miss bonus that grows!' },
    { icon: '🧲', title: 'Magnet', body: 'Pulls nearby coins and power-ups straight to you!' },
    { icon: '🤏', title: 'Mini Mode', body: 'Shrinks you down to slip through tight gaps!' },
    { icon: '🪶', title: 'Lucky Feather', body: "Saves you from one otherwise-fatal hit. Only holds one at a time!" },
    { icon: '🪙', title: 'Coins', body: 'Collect coins to grow your all-time total, shown on the start screen!' },
    { icon: '🎯', title: 'Perfect Run', body: 'Clear pipes with zero pickups for a skill-only streak bonus!' },
    { icon: '🛡️+⚔️', title: "Knight's Rampage", body: 'Smashes 6 pipes in a row for +50 points!' },
  ];

  // ===========================================================================
  // 8b. ANIMATED TUTORIAL (only opens when "How to Play" is clicked)
  // ===========================================================================
  const tutorialCtx = tutorialCanvas ? tutorialCanvas.getContext('2d') : null;
  const TUTORIAL_STEPS = [
    { kind: 'flap', caption: "Tap or click anywhere to flap your wings and stay airborne!" },
    { kind: 'dodge', caption: "Fly through the gaps between pipes — don't touch them!" },
    ...GUIDE_SECTIONS.map(sec => ({ kind: 'icon', icon: sec.icon, caption: `${sec.title}: ${sec.body}` })),
  ];
  let tutorialIndex = 0;
  let tutorialFrame = 0;
  let tutorialRAF = null;
  let tutorialAutoTimer = null;

  function buildTutorialDots() {
    if (!tutorialDots) return;
    tutorialDots.innerHTML = '';
    TUTORIAL_STEPS.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'tutorial-dot';
      dot.setAttribute('aria-label', `Tutorial step ${i + 1}`);
      dot.addEventListener('click', () => goToTutorialStep(i));
      tutorialDots.appendChild(dot);
    });
  }

  function goToTutorialStep(i) {
    tutorialIndex = (i + TUTORIAL_STEPS.length) % TUTORIAL_STEPS.length;
    tutorialFrame = 0;
    if (tutorialCaption) tutorialCaption.textContent = TUTORIAL_STEPS[tutorialIndex].caption;
    if (tutorialDots) {
      tutorialDots.querySelectorAll('.tutorial-dot').forEach((dot, idx) => {
        dot.classList.toggle('active', idx === tutorialIndex);
      });
    }
    restartTutorialAutoAdvance();
  }

  function restartTutorialAutoAdvance() {
    if (tutorialAutoTimer) clearTimeout(tutorialAutoTimer);
    tutorialAutoTimer = setTimeout(() => goToTutorialStep(tutorialIndex + 1), 4200);
  }

  // Small, self-contained canvas mini-scenes — independent of the main game
  // loop so they can run while the game itself is paused behind the modal.
  function drawTutorialFrame() {
    if (!tutorialCtx) return;
    const w = tutorialCanvas.width, h = tutorialCanvas.height;
    const t = tutorialFrame;
    const step = TUTORIAL_STEPS[tutorialIndex];

    const sky = tutorialCtx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#38bdf8");
    sky.addColorStop(1, "#8fe3ff");
    tutorialCtx.fillStyle = sky;
    tutorialCtx.fillRect(0, 0, w, h);

    const drawBird = (x, y, size = 26) => {
      tutorialCtx.font = `${size}px sans-serif`;
      tutorialCtx.textAlign = "center";
      tutorialCtx.textBaseline = "middle";
      tutorialCtx.fillText("🐥", x, y);
    };

    if (step.kind === 'flap') {
      const cycle = t % 70;
      const bob = Math.sin((t % 70) / 70 * Math.PI * 2) * -22;
      const y = h / 2 + bob;
      drawBird(w * 0.5, y, 30);
      // "TAP!" pulse ring right before each flap
      const pulse = cycle < 12 ? (12 - cycle) / 12 : 0;
      if (pulse > 0) {
        tutorialCtx.globalAlpha = pulse * 0.6;
        tutorialCtx.beginPath();
        tutorialCtx.arc(w * 0.5, y, 30 + (12 - pulse * 12) * 2, 0, Math.PI * 2);
        tutorialCtx.strokeStyle = "#fff";
        tutorialCtx.lineWidth = 3;
        tutorialCtx.stroke();
        tutorialCtx.globalAlpha = 1;
      }
    } else if (step.kind === 'dodge') {
      const speed = 1.6;
      const gapH = 70;
      const cycleW = 170;
      const scrollX = w - ((t * speed) % cycleW);
      const gapCenter = h / 2 + Math.sin(t * 0.03) * 30;
      tutorialCtx.fillStyle = "#8b5cf6";
      tutorialCtx.fillRect(scrollX, 0, 34, gapCenter - gapH / 2);
      tutorialCtx.fillRect(scrollX, gapCenter + gapH / 2, 34, h - (gapCenter + gapH / 2));
      const birdX = w * 0.28;
      const birdY = gapCenter + Math.sin(t * 0.12) * (gapH * 0.18);
      drawBird(birdX, birdY, 26);
    } else if (step.kind === 'icon') {
      const bob = Math.sin(t * 0.06) * 8;
      const spin = Math.sin(t * 0.05) * 0.15;
      tutorialCtx.save();
      tutorialCtx.translate(w / 2, h / 2 + bob);
      tutorialCtx.rotate(spin);
      tutorialCtx.font = "56px sans-serif";
      tutorialCtx.textAlign = "center";
      tutorialCtx.textBaseline = "middle";
      tutorialCtx.shadowColor = "rgba(255, 213, 79, 0.7)";
      tutorialCtx.shadowBlur = 14;
      tutorialCtx.fillText(step.icon, 0, 0);
      tutorialCtx.restore();
      // gentle sparkle orbit
      for (let i = 0; i < 3; i++) {
        const a = t * 0.04 + (i * Math.PI * 2) / 3;
        const sx = w / 2 + Math.cos(a) * 60;
        const sy = h / 2 + bob + Math.sin(a) * 34;
        tutorialCtx.globalAlpha = 0.7;
        tutorialCtx.font = "14px sans-serif";
        tutorialCtx.textAlign = "center";
        tutorialCtx.fillText("✨", sx, sy);
        tutorialCtx.globalAlpha = 1;
      }
    }
  }

  function tutorialLoop() {
    tutorialFrame++;
    drawTutorialFrame();
    tutorialRAF = requestAnimationFrame(tutorialLoop);
  }

  function startTutorialLoop() {
    stopTutorialLoop();
    tutorialRAF = requestAnimationFrame(tutorialLoop);
  }

  function stopTutorialLoop() {
    if (tutorialRAF) cancelAnimationFrame(tutorialRAF);
    tutorialRAF = null;
    if (tutorialAutoTimer) clearTimeout(tutorialAutoTimer);
    tutorialAutoTimer = null;
  }

  function openTutorial() {
    infoModal.classList.remove('hidden');
    goToTutorialStep(0);
    startTutorialLoop();
  }

  function closeTutorial() {
    infoModal.classList.add('hidden');
    stopTutorialLoop();
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
  // 10. UI EVENT WIRING
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
    startBackgroundMusic();
  });

  howToPlayBtn.addEventListener('click', openTutorial);
  closeInfoBtn.addEventListener('click', closeTutorial);
  infoModal.addEventListener('click', (e) => { if (e.target === infoModal) closeTutorial(); });
  if (tutorialPrevBtn) tutorialPrevBtn.addEventListener('click', () => goToTutorialStep(tutorialIndex - 1));
  if (tutorialNextBtn) tutorialNextBtn.addEventListener('click', () => goToTutorialStep(tutorialIndex + 1));

  muteBtn.addEventListener('click', () => {
    audioMuted = !audioMuted;
    muteBtn.textContent = audioMuted ? '🔇 Audio: Off' : '🔊 Audio: On';
    if (audioMuted) {
      stopBackgroundMusic();
    } else if (gameStarted && !gameOver) {
      startBackgroundMusic();
    }
  });

  customAvatarBtn.addEventListener('click', () => avatarFileInput.click());

  homeBtn.addEventListener('click', () => {
    stopBackgroundMusic();
    gameStarted = false;
    gameOver = false;
    showScreen('splash');
  });

  playAgainBtn.addEventListener('click', () => {
    resetGame();
    gameStarted = true;
    showScreen('game');
    startBackgroundMusic();
  });

  window.addEventListener('keydown', (e) => {
    if (document.activeElement === initialsInput) return;

    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (!infoModal.classList.contains('hidden')) {
        closeTutorial();
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
  // 11. GAMEPLAY LOGIC
  // ===========================================================================
  const ITEM_WEIGHTS = [
    { type: 'coin', weight: 34 },
    { type: 'shield', weight: 14 },
    { type: 'sword', weight: 14 },
    { type: 'slow', weight: 4 },
    { type: 'gem', weight: 10 },
    { type: 'magnet', weight: 8 },
    { type: 'shrink', weight: 6 },
    { type: 'feather', weight: 4 },
  ];
  const ITEM_WEIGHT_TOTAL = ITEM_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);

  function pickItemType() {
    let roll = Math.random() * ITEM_WEIGHT_TOTAL;
    for (const entry of ITEM_WEIGHTS) {
      if (roll < entry.weight) return entry.type;
      roll -= entry.weight;
    }
    return 'coin';
  }

  function spawnItem(pipeX, topHeight, gap) {
    if (Math.random() < 0.55) {
      const type = pickItemType();
      const safeY = topHeight + (gap / 2) - 10;
      items.push({ type, x: pipeX + 18 * SCALE, y: safeY, size: 26 * SCALE, collected: false });
    }
  }

  function collectItem(type) {
    playSound('item');
    perfectRunStreak = 0;
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
      player.inventory.swordCharges = Math.min(5, player.inventory.swordCharges + 3);
      spawnFloatingText("⚔️ SPINNING SWORD!", player.x, player.y - 15, "#facc15");
    } else if (type === 'slow') {
      slowMoTimer = 480;
      spawnFloatingText("🐢 TURTLE TIME!", player.x, player.y - 15, "#22c55e");
    } else if (type === 'gem') {
      scoreMultiplierTimer = 360;
      spawnFloatingText("💎 2X POINTS!", player.x, player.y - 15, "#c084fc");
    } else if (type === 'coin') {
      coinsThisRun++;
      score += 1;
      spawnFloatingText("🪙 +1 COIN", player.x, player.y - 15, "#fbbf24");
    } else if (type === 'magnet') {
      magnetTimer = 420;
      spawnFloatingText("🧲 MAGNET ON!", player.x, player.y - 15, "#38bdf8");
    } else if (type === 'shrink') {
      shrinkTimer = 360;
      spawnFloatingText("🤏 MINI MODE!", player.x, player.y - 15, "#a855f7");
    } else if (type === 'feather') {
      if (!hasFeather) {
        hasFeather = true;
        spawnFloatingText("🪶 FEATHER READY!", player.x, player.y - 15, "#fde68a");
      } else {
        score += 5;
        spawnFloatingText("MAX FEATHER (+5 PTS)", player.x, player.y - 15, "#fde68a");
      }
    }
    if (player.shieldCount > 0 && player.inventory.sword) triggerGiantShieldCombo();
  }

  function triggerGiantShieldCombo() {
    player.shieldCount = 0;
    player.inventory.sword = false;
    player.inventory.swordCharges = 0;
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

  // Difficulty ramps gradually with pipes cleared, not raw score, so bonus
  // points (golden pipes, streaks, combos) don't cause difficulty spikes.
  // Caps out after DIFFICULTY_CAP pipes so it never becomes unwinnable.
  const DIFFICULTY_CAP = 40;
  function difficultyLevel() {
    const effective = pipesClearedThisRun * (isMercyActive() ? 0.5 : 1);
    return Math.min(effective, DIFFICULTY_CAP);
  }

  function spawnPipe() {
    const preset = getDifficultyPreset();
    const d = difficultyLevel();
    const baseGap = Math.max(130 * SCALE, VH * 0.22) + preset.gapBonus * SCALE;
    const gap = Math.max(preset.gapFloor * SCALE, baseGap - d * preset.gapRampRate * SCALE);
    const minCenter = gap / 2 + 60 * SCALE;
    const maxCenter = VH - gap / 2 - 60 * SCALE;

    let center;
    if (lastPipeCenterY === null) {
      center = minCenter + Math.random() * Math.max(1, maxCenter - minCenter);
    } else {
      // Limit how far the gap can move vertically from the previous pipe so
      // it never leaps straight from the floor to the ceiling (or back).
      const maxShift = VH * 0.32;
      const lo = Math.max(minCenter, lastPipeCenterY - maxShift);
      const hi = Math.min(maxCenter, lastPipeCenterY + maxShift);
      center = lo + Math.random() * Math.max(1, hi - lo);
    }
    lastPipeCenterY = center;

    const topHeight = Math.round(center - gap / 2);
    const pipeX = VW;
    const golden = Math.random() < 0.08;
    pipes.push({ x: pipeX, width: 60 * SCALE, topHeight, bottomY: topHeight + gap, passed: false, shattered: false, golden });
    spawnItem(pipeX, topHeight, gap);
  }

  function update() {
    if (!gameStarted || gameOver || !infoModal.classList.contains('hidden')) return;
    frameCount++;

    if (slowMoTimer > 0) slowMoTimer--;
    if (scoreMultiplierTimer > 0) scoreMultiplierTimer--;
    if (swordStreakFlashTimer > 0) swordStreakFlashTimer--;
    if (magnetTimer > 0) magnetTimer--;
    if (shrinkTimer > 0) shrinkTimer--;

    const preset = getDifficultyPreset();
    const speedRamp = 1 + difficultyLevel() * preset.rampRate;
    const currentSpeed = (slowMoTimer > 0 ? 1.1 : 2.2 * preset.speedMult * speedRamp) * SCALE;

    if (score >= 30) currentTheme = THEMES.retro;
    else if (score >= 20) currentTheme = THEMES.night;
    else if (score >= 10) currentTheme = THEMES.sunset;
    else currentTheme = THEMES.day;

    clouds.forEach(c => {
      c.x -= (c.speed * (currentSpeed / 2));
      if (c.x + c.size * 2 < 0) c.x = VW + 50;
    });

    // Motion-line particles kick in once the ramp is noticeably underway,
    // scaling up with difficulty so the game visually "feels" faster.
    const diff = difficultyLevel();
    if (diff > 6 && slowMoTimer <= 0 && Math.random() < (diff - 6) * 0.006) {
      windStreaks.push({
        x: VW + Math.random() * 60,
        y: Math.random() * VH,
        len: (28 + Math.random() * 46) * SCALE,
        alpha: 0.12 + Math.random() * 0.16
      });
    }
    for (let i = windStreaks.length - 1; i >= 0; i--) {
      const w = windStreaks[i];
      w.x -= currentSpeed * 1.7;
      if (w.x + w.len < 0) windStreaks.splice(i, 1);
    }

    if (mercyMessagePending && frameCount === 40) {
      spawnFloatingText("🌈 Taking it easy this round!", player.x - 40, player.y - 55, "#38bdf8");
      mercyMessagePending = false;
    }

    player.vy += player.gravity;
    player.cy += player.vy;
    const sizeMult = shrinkTimer > 0 ? 0.62 : 1;
    player.width = player.baseWidth * sizeMult;
    player.height = player.baseHeight * sizeMult;
    player.x = player.cx - player.width / 2;
    player.y = player.cy - player.height / 2;
    if (player.y + player.height >= VH || player.y <= 0) handlePlayerHit();

    const baseInterval = (slowMoTimer > 0) ? 220 : 110;
    const pipeSpawnInterval = Math.max(preset.intervalFloor, Math.round(baseInterval - difficultyLevel() * preset.intervalRampRate));
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
      if (magnetTimer > 0 && !item.collected) {
        const dx = player.cx - item.x;
        const dy = player.cy - item.y;
        const dist = Math.hypot(dx, dy);
        const magnetRadius = 190 * SCALE;
        if (dist < magnetRadius && dist > 1) {
          const pull = 5 * SCALE;
          item.x += (dx / dist) * pull;
          item.y += (dy / dist) * pull;
        }
      }
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

      // Track how close the player skimmed this pipe while horizontally
      // overlapping it, so a genuine near-miss can be rewarded on pass.
      if (!pipe.shattered && player.x + player.width > pipe.x && player.x < pipe.x + pipe.width) {
        const topGap = player.y - pipe.topHeight;
        const bottomGap = pipe.bottomY - (player.y + player.height);
        const gap = Math.min(topGap, bottomGap);
        if (pipe.grazeMin === undefined || gap < pipe.grazeMin) pipe.grazeMin = gap;
      }

      if (!pipe.passed && pipe.x + pipe.width < player.x) {
        pipe.passed = true;
        pipesClearedThisRun++;
        perfectRunStreak++;
        if (perfectRunStreak > bestPerfectStreak) bestPerfectStreak = perfectRunStreak;
        if (perfectRunStreak > 0 && perfectRunStreak % 8 === 0) {
          score += 8;
          playSound('item');
          spawnFloatingText(`🎯 PERFECT RUN x${perfectRunStreak}! +8`, player.x - 20, player.y - 75, "#22d3ee");
        }
        if (pipesClearedThisRun % 10 === 0 && pipesClearedThisRun <= DIFFICULTY_CAP) {
          spawnFloatingText("⚡ SPEEDING UP!", player.x - 20, player.y - 60, "#f97316");
        }
        const addScore = (scoreMultiplierTimer > 0) ? 2 : 1;
        score += addScore;
        if (scoreMultiplierTimer > 0) spawnFloatingText("+2 PTS 💎", player.x, player.y - 20, "#c084fc");
        if (pipe.golden) {
          score += 5;
          spawnFloatingText("✨ GOLDEN PIPE +5!", player.x, player.y - 38, "#fde047");
        }
        const grazeThreshold = 14 * SCALE;
        if (!pipe.shattered && pipe.grazeMin !== undefined && pipe.grazeMin >= 0 && pipe.grazeMin < grazeThreshold) {
          grazeStreak++;
          if (grazeStreak > bestGrazeStreak) bestGrazeStreak = grazeStreak;
          const bonus = 2 + Math.floor(grazeStreak / 3);
          score += bonus;
          spawnFloatingText(`😅 CLOSE CALL! +${bonus}`, player.x, player.y - 55, "#38bdf8");
        }
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
        if (hitBox) {
          if (player.inventory.sword && player.inventory.swordCharges > 0) {
            pipe.shattered = true;
            player.inventory.swordCharges--;
            if (player.inventory.swordCharges <= 0) player.inventory.sword = false;
            score += 3;
            swordStreak++;
            if (swordStreak > bestSwordStreak) bestSwordStreak = swordStreak;
            swordStreakFlashTimer = 40;
            playSound('shatter');
            createPipeShatterParticles(pipe.x, 0, pipe.width, pipe.topHeight);
            createPipeShatterParticles(pipe.x, pipe.bottomY, pipe.width, VH - pipe.bottomY);
            if (swordStreak > 0 && swordStreak % 5 === 0) {
              score += 10;
              playSound('item');
              spawnFloatingText(`🔥 ${swordStreak} STREAK! +10`, pipe.x, player.y - 40, "#f97316");
            } else {
              spawnFloatingText("⚔️ SLICED! +3", pipe.x, player.y - 20, "#facc15");
            }
          } else {
            handlePlayerHit(pipe);
          }
        }
      }

      if (pipe.x + pipe.width < 0) pipes.splice(i, 1);
    }
  }

  function handlePlayerHit(pipe = null) {
    swordStreak = 0;
    grazeStreak = 0;
    perfectRunStreak = 0;
    if (player.shieldCount > 0) {
      player.shieldCount--;
      playSound('shatter');
      const remText = player.shieldCount > 0 ? "1 SHIELD REMAINING!" : "SHIELD BROKEN!";

      if (pipe) {
        pipe.shattered = true;
        createPipeShatterParticles(pipe.x, 0, pipe.width, pipe.topHeight);
        createPipeShatterParticles(pipe.x, pipe.bottomY, pipe.width, VH - pipe.bottomY);
        spawnFloatingText("🛡️ SHIELD SMASH!", pipe.x, player.y - 20, "#10b981");
        spawnFloatingText(remText, player.x - 20, player.y + 10, "#10b981");
        player.vy = player.jumpStrength * 0.5;
      } else {
        player.vy = player.jumpStrength;
        spawnFloatingText(remText, player.x - 20, player.y - 20, "#10b981");
      }
    } else if (hasFeather) {
      hasFeather = false;
      playSound('item');
      if (pipe) {
        pipe.shattered = true;
        createPipeShatterParticles(pipe.x, 0, pipe.width, pipe.topHeight);
        createPipeShatterParticles(pipe.x, pipe.bottomY, pipe.width, VH - pipe.bottomY);
      }
      player.vy = player.jumpStrength * 1.3;
      spawnFloatingText("🪶 SAVED BY THE FEATHER!", player.x - 20, player.y - 20, "#fde68a");
    } else {
      endGame();
    }
  }

  // ===========================================================================
  // 12. RENDER
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

  // Rounded-rect helper (some older WebViews lack native ctx.roundRect)
  function pathRoundRect(x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // Crystal-pillar pipe design: rounded gradient shafts with a glowing gem
  // cap, replacing the flat green rectangular Flappy-Bird-style pipes.
  function drawPipe(pipe) {
    if (pipe.shattered) return;
    const w = pipe.width;
    const capH = 20 * SCALE;
    const r = 10 * SCALE;

    const drawShaft = (sx, sy, sh) => {
      if (sh <= 0) return;
      const grad = ctx.createLinearGradient(sx, 0, sx + w, 0);
      if (pipe.golden) {
        grad.addColorStop(0, "#b45309");
        grad.addColorStop(0.45, "#f59e0b");
        grad.addColorStop(0.62, "#fef3c7");
        grad.addColorStop(1, "#f59e0b");
      } else {
        grad.addColorStop(0, currentTheme.pipeAccent);
        grad.addColorStop(0.45, currentTheme.pipeColor);
        grad.addColorStop(0.62, currentTheme.pipeHighlight);
        grad.addColorStop(1, currentTheme.pipeColor);
      }
      ctx.fillStyle = grad;
      pathRoundRect(sx, sy, w, sh, r);
      ctx.fill();

      // faceted diagonal shimmer stripes for a crystal look
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = pipe.golden ? 0.32 : 0.18;
      ctx.fillStyle = "#ffffff";
      const stripeGap = 22 * SCALE;
      for (let sX = -sh; sX < w + sh; sX += stripeGap) {
        ctx.beginPath();
        ctx.moveTo(sx + sX, sy);
        ctx.lineTo(sx + sX + 8 * SCALE, sy);
        ctx.lineTo(sx + sX + 8 * SCALE - sh, sy + sh);
        ctx.lineTo(sx + sX - sh, sy + sh);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    // top shaft (hangs from y=0 down to topHeight)
    drawShaft(pipe.x, 0, pipe.topHeight);
    // bottom shaft (from bottomY to floor)
    drawShaft(pipe.x, pipe.bottomY, VH - pipe.bottomY);

    // Gem caps facing the gap, with a soft glow, instead of a flat lip
    const drawCap = (capY) => {
      ctx.save();
      ctx.shadowColor = pipe.golden ? "#fde047" : currentTheme.pipeCap;
      ctx.shadowBlur = (pipe.golden ? 16 : 10) * SCALE;
      ctx.fillStyle = pipe.golden ? "#b45309" : currentTheme.pipeAccent;
      pathRoundRect(pipe.x - 5 * SCALE, capY, w + 10 * SCALE, capH, capH / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = pipe.golden ? "#fde047" : currentTheme.pipeCap;
      ctx.beginPath();
      ctx.arc(pipe.x + w / 2, capY + capH / 2, 6 * SCALE, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    if (pipe.topHeight > 0) drawCap(pipe.topHeight - capH * 0.6);
    if (VH - pipe.bottomY > 0) drawCap(pipe.bottomY - capH * 0.4);
  }

  function drawSpinningSword(cx, cy) {
    const orbitR = (player.width / 2 + 20) * SCALE;
    const angle = frameCount * 0.14;
    for (let i = 0; i < player.inventory.swordCharges; i++) {
      const a = angle + (i * (Math.PI * 2 / Math.max(1, player.inventory.swordCharges)));
      const sx = cx + Math.cos(a) * orbitR;
      const sy = cy + Math.sin(a) * orbitR;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a + Math.PI / 2 + frameCount * 0.25);
      ctx.font = `${20 * SCALE}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 8 * SCALE;
      ctx.fillText("⚔️", 0, 0);
      ctx.restore();

      // Trailing spark behind the blade to sell the spinning motion
      if (frameCount % 3 === 0) {
        particles.push({
          x: sx, y: sy, vx: 0, vy: 0,
          size: (Math.random() * 3 + 2) * SCALE, color: "#facc15",
          alpha: 0.8, gravity: 0,
          rotation: 0, vRot: 0
        });
      }
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // Hand-drawn gold coin (radial gradient body, ridge ring, shine, and a
  // horizontal squish that fakes a slow 3D spin) instead of the flat emoji.
  function drawCoin(item) {
    const cx = item.x + item.size / 2;
    const cy = item.y + item.size / 2;
    const r = item.size / 2;
    const spin = Math.abs(Math.sin(frameCount * 0.07 + item.x * 0.02));
    const rx = r * (0.32 + 0.68 * spin);

    ctx.save();
    ctx.translate(cx, cy);

    const grad = ctx.createRadialGradient(-rx * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    grad.addColorStop(0, "#fff8dc");
    grad.addColorStop(0.42, "#ffd54f");
    grad.addColorStop(0.78, "#f2a90d");
    grad.addColorStop(1, "#a86c05");

    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(1.5, rx), r, 0, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.shadowColor = "rgba(245, 158, 11, 0.55)";
    ctx.shadowBlur = 6 * SCALE;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.strokeStyle = "#a86c05";
    ctx.stroke();

    // inner ridge ring — reads best near face-on, fades out edge-on
    if (spin > 0.3) {
      ctx.globalAlpha = (spin - 0.3) / 0.7;
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(1, rx * 0.68), r * 0.68, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.stroke();

      ctx.font = `700 ${r * 0.95}px 'Baloo 2', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#a86c05";
      ctx.fillText("$", 0, r * 0.06);
      ctx.globalAlpha = 1;
    }

    // glossy highlight streak
    ctx.beginPath();
    ctx.ellipse(-rx * 0.28, -r * 0.32, Math.max(1, rx * 0.26), r * 0.15, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fill();

    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = currentTheme.background;
    ctx.fillRect(0, 0, VW, VH);

    // Gentle darkening as the ramp progresses — a subtle "getting intense"
    // cue that stacks with (but doesn't replace) the score-based themes.
    const intensityAlpha = Math.min(difficultyLevel() / DIFFICULTY_CAP, 1) * 0.22;
    if (intensityAlpha > 0.01) {
      ctx.fillStyle = `rgba(10, 10, 30, ${intensityAlpha})`;
      ctx.fillRect(0, 0, VW, VH);
    }

    ctx.fillStyle = currentTheme.cloudColor;
    clouds.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.size / 2, 0, Math.PI * 2);
      ctx.arc(c.x + c.size * 0.3, c.y - c.size * 0.2, c.size * 0.4, 0, Math.PI * 2);
      ctx.arc(c.x + c.size * 0.6, c.y, c.size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2 * SCALE;
    windStreaks.forEach(w => {
      ctx.globalAlpha = w.alpha;
      ctx.beginPath();
      ctx.moveTo(w.x, w.y);
      ctx.lineTo(w.x - w.len, w.y);
      ctx.stroke();
    });
    ctx.restore();

    pipes.forEach(pipe => drawPipe(pipe));

    items.forEach(item => {
      if (item.type === 'coin') {
        drawCoin(item);
        return;
      }
      ctx.font = `${24 * SCALE}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const ICONS = { sword: '⚔️', slow: '🐢', gem: '💎', magnet: '🧲', shrink: '🤏', feather: '🪶', shield: '🛡️' };
      ctx.fillText(ICONS[item.type] || '🛡️', item.x + item.size / 2, item.y + item.size / 2);
    });
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

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

    if (player.inventory.sword && player.inventory.swordCharges > 0 && !giantShield.active) {
      drawSpinningSword(player.x + player.width / 2, player.y + player.height / 2);
    }

    if (magnetTimer > 0) {
      ctx.save();
      const pulse = 0.15 + 0.08 * Math.sin(frameCount * 0.15);
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 190 * SCALE, 0, Math.PI * 2);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    floatingTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = `600 ${16 * SCALE}px 'Nunito', -apple-system, sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    // --- HUD ---
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
    if (player.inventory.sword) invStatus += `⚔️ x${player.inventory.swordCharges} `;
    if (hasFeather) invStatus += `🪶 `;
    invStatus += `🪙 ${coinsThisRun}`;
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
    if (magnetTimer > 0) {
      hudY += 20 * SCALE;
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`🧲 Magnet: ${Math.ceil(magnetTimer / 60)}s`, pad, hudY);
    }
    if (shrinkTimer > 0) {
      hudY += 20 * SCALE;
      ctx.fillStyle = "#a855f7";
      ctx.fillText(`🤏 Mini Mode: ${Math.ceil(shrinkTimer / 60)}s`, pad, hudY);
    }
    if (giantShield.active) {
      hudY += 20 * SCALE;
      ctx.fillStyle = "#10b981";
      ctx.font = `600 ${14 * SCALE}px 'Nunito', -apple-system, sans-serif`;
      ctx.fillText(`Knight Shield Hits Left: ${giantShield.pipesRemaining}`, pad, hudY);
    }
    if (swordStreak > 0) {
      hudY += 20 * SCALE;
      ctx.font = `${swordStreakFlashTimer > 0 ? 700 : 600} ${(swordStreakFlashTimer > 0 ? 16 : 14) * SCALE}px 'Nunito', -apple-system, sans-serif`;
      ctx.fillStyle = swordStreakFlashTimer > 0 ? "#f97316" : "#facc15";
      ctx.fillText(`🔥 Sword Streak: ${swordStreak}`, pad, hudY);
    }
    if (grazeStreak > 0) {
      hudY += 20 * SCALE;
      ctx.font = `600 ${14 * SCALE}px 'Nunito', -apple-system, sans-serif`;
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`😅 Close-Call Streak: ${grazeStreak}`, pad, hudY);
    }
    if (perfectRunStreak > 0) {
      hudY += 20 * SCALE;
      ctx.font = `600 ${14 * SCALE}px 'Nunito', -apple-system, sans-serif`;
      ctx.fillStyle = "#22d3ee";
      ctx.fillText(`🎯 Perfect Streak: ${perfectRunStreak}`, pad, hudY);
    }
  }

  // ===========================================================================
  // 13. GAME STATE TRANSITIONS
  // ===========================================================================
  async function endGame() {
    if (!gameOver) {
      stopBackgroundMusic();
      playSound('hit');
      gameOver = true;

      // Rubber-band mercy bookkeeping: track early deaths (under 5 pipes)
      // in a row so the NEXT run can ease off the ramp a little.
      if (pipesClearedThisRun < 5) {
        earlyDeathStreak++;
      } else {
        earlyDeathStreak = 0;
      }

      totalCoins += coinsThisRun;
      localStorage.setItem('pixeljump_total_coins', String(totalCoins));
      updateCoinBadge();

      let isNewBest = false;
      if (score > personalBest) {
        personalBest = score;
        localStorage.setItem(personalBestKey(selectedDifficulty), String(personalBest));
        isNewBest = true;
      }

      finalScoreEl.textContent = `Score (${playerInitials || "---"}): ${score} pts — ${difficultyLabel(selectedDifficulty)}`;
      renderStatsPanel(isNewBest);
      showScreen('gameover');
      gameContainer.classList.add('shake');
      setTimeout(() => gameContainer.classList.remove('shake'), 300);
      await submitHighScore(score);
    }
  }

  function updateCoinBadge() {
    if (totalCoinsDisplay) totalCoinsDisplay.textContent = totalCoins.toLocaleString();
  }

  function renderStatsPanel(isNewBest) {
    if (statBestEl) statBestEl.textContent = `${personalBest}${isNewBest ? ' 🎉 NEW!' : ''}`;
    if (statPipesEl) statPipesEl.textContent = pipesClearedThisRun;
    if (statSwordStreakEl) statSwordStreakEl.textContent = bestSwordStreak;
    if (statGrazeStreakEl) statGrazeStreakEl.textContent = bestGrazeStreak;
    if (statCoinsEl) statCoinsEl.textContent = `+${coinsThisRun} (Total: ${totalCoins.toLocaleString()})`;
    if (statPerfectStreakEl) statPerfectStreakEl.textContent = bestPerfectStreak;
    const rampReached = Math.min(pipesClearedThisRun, DIFFICULTY_CAP);
    if (statRampLabelEl) statRampLabelEl.textContent = `${rampReached}/${DIFFICULTY_CAP}`;
    if (statRampFillEl) statRampFillEl.style.width = `${(rampReached / DIFFICULTY_CAP) * 100}%`;
  }

  function resetGame() {
    player.cy = VH * 0.4 + player.baseHeight / 2;
    player.vy = 0;
    player.shieldCount = 1;
    player.inventory.sword = false;
    player.inventory.swordCharges = 0;
    giantShield.active = false;
    giantShield.pipesRemaining = 0;
    slowMoTimer = 0;
    scoreMultiplierTimer = 0;
    swordStreak = 0;
    swordStreakFlashTimer = 0;
    magnetTimer = 0;
    shrinkTimer = 0;
    hasFeather = false;
    grazeStreak = 0;
    bestGrazeStreak = 0;
    bestSwordStreak = 0;
    perfectRunStreak = 0;
    bestPerfectStreak = 0;
    pipesClearedThisRun = 0;
    coinsThisRun = 0;
    windStreaks = [];
    mercyMessagePending = isMercyActive();
    score = 0;
    pipes = [];
    items = [];
    particles = [];
    floatingTexts = [];
    frameCount = 0;
    gameOver = false;
    lastPipeCenterY = null;
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
  player.cx = VW * 0.2 + player.baseWidth / 2;
  player.cy = VH * 0.4 + player.baseHeight / 2;
  player.x = player.cx - player.width / 2;
  player.y = player.cy - player.height / 2;
  syncInitialsInput();
  buildAvatarSelector();
  buildTutorialDots();
  updateCoinBadge();
  initDifficultySelector();
  fetchLeaderboard();
  gameLoop();
});