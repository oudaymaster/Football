// ─── Constants ───────────────────────────────────────────────────────────────

const CANVAS_W   = 700;
const CANVAS_H   = 400;
const BALL_R     = 10;
const PLAYER_R   = 15;
const GOAL_W     = 16;
const GOAL_H     = 90;
const FRICTION   = 0.984;
const PLAYER_SPD = 3.4;
const AI_SPD     = 2.6;
const KICK_POWER = 8;
const AI_KICK    = 6;
const MATCH_TIME = 90;
const WIN_SCORE  = 3;

// ─── DOM References ───────────────────────────────────────────────────────────

const menuScreen  = document.getElementById('menu-screen');
const gameScreen  = document.getElementById('game-screen');
const endScreen   = document.getElementById('end-screen');
const canvas      = document.getElementById('game-canvas');
const ctx         = canvas.getContext('2d');
const scoreEl     = document.getElementById('score-display');
const timerEl     = document.getElementById('timer-display');
const statusEl    = document.getElementById('status-msg');
const winnerEl    = document.getElementById('winner-text');
const finalScEl   = document.getElementById('final-score');
const team2Name   = document.getElementById('team2-name');
const goalFlash   = document.getElementById('goal-flash');

canvas.width  = CANVAS_W;
canvas.height = CANVAS_H;

// ─── Game State ───────────────────────────────────────────────────────────────

let mode      = '1v1';
let keys      = {};
let animId    = null;
let timerInt  = null;
let timeLeft  = MATCH_TIME;
let running   = false;
let scoring   = false; // brief pause after goal

let ball = {};
let p1   = {};
let p2   = {};

function initBall() {
  const dir = Math.random() > 0.5 ? 1 : -1;
  ball = {
    x:  CANVAS_W / 2,
    y:  CANVAS_H / 2,
    vx: dir * 2.2,
    vy: (Math.random() - 0.5) * 2,
  };
}

function initPlayers() {
  p1 = { x: 110,          y: CANVAS_H / 2, score: 0 };
  p2 = { x: CANVAS_W-110, y: CANVAS_H / 2, score: 0 };
}

// ─── Screen Helpers ───────────────────────────────────────────────────────────

function showScreen(el) {
  [menuScreen, gameScreen, endScreen].forEach(s => s.classList.remove('active'));
  el.classList.add('active');
}

// ─── Start / Restart ──────────────────────────────────────────────────────────

function startGame(selectedMode) {
  mode = selectedMode;
  team2Name.textContent = mode === 'ai' ? 'AI' : 'Player 2';

  initPlayers();
  initBall();
  timeLeft = MATCH_TIME;
  scoring  = false;
  running  = true;

  updateScoreUI();
  updateTimerUI();
  statusEl.textContent = '';

  showScreen(gameScreen);

  clearInterval(timerInt);
  cancelAnimationFrame(animId);

  timerInt = setInterval(tickTimer, 1000);
  animId   = requestAnimationFrame(loop);
}

function restartGame() {
  p1.score = 0;
  p2.score = 0;
  startGame(mode);
}

// ─── Timer ───────────────────────────────────────────────────────────────────

function tickTimer() {
  if (!running || scoring) return;
  timeLeft--;
  updateTimerUI();
  if (timeLeft <= 0) triggerEnd();
}

function updateTimerUI() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  timerEl.textContent = `${m}:${s < 10 ? '0' + s : s}`;
}

function updateScoreUI() {
  scoreEl.textContent = `${p1.score} — ${p2.score}`;
}

// ─── Game Loop ────────────────────────────────────────────────────────────────

function loop() {
  if (!running) return;
  if (!scoring) update();
  draw();
  animId = requestAnimationFrame(loop);
}

// ─── Update ───────────────────────────────────────────────────────────────────

function update() {
  movePlayer1();
  if (mode === '1v1') movePlayer2();
  else moveAI();
  moveBall();
  checkGoals();
}

function movePlayer1() {
  if (keys['KeyA'] || keys['ArrowLeft_p1']) p1.x -= PLAYER_SPD; // only WASD for p1
  if (keys['KeyD'])  p1.x += PLAYER_SPD;
  if (keys['KeyW'])  p1.y -= PLAYER_SPD;
  if (keys['KeyS'])  p1.y += PLAYER_SPD;
  if (keys['Space']) tryKick(p1);
  clampPlayer(p1);
}

function movePlayer2() {
  if (keys['ArrowLeft'])  p2.x -= PLAYER_SPD;
  if (keys['ArrowRight']) p2.x += PLAYER_SPD;
  if (keys['ArrowUp'])    p2.y -= PLAYER_SPD;
  if (keys['ArrowDown'])  p2.y += PLAYER_SPD;
  if (keys['Enter'])      tryKick(p2);
  clampPlayer(p2);
}

function clampPlayer(p) {
  p.x = Math.max(PLAYER_R, Math.min(CANVAS_W - PLAYER_R, p.x));
  p.y = Math.max(PLAYER_R, Math.min(CANVAS_H - PLAYER_R, p.y));
}

function tryKick(player) {
  const dx   = ball.x - player.x;
  const dy   = ball.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < PLAYER_R + BALL_R + 12) {
    const nx = dist > 0 ? dx / dist : 1;
    const ny = dist > 0 ? dy / dist : 0;
    ball.vx  = nx * KICK_POWER;
    ball.vy  = ny * KICK_POWER;
  }
}

// ─── AI ───────────────────────────────────────────────────────────────────────

let aiKickCooldown = 0;

function moveAI() {
  const dx   = ball.x - p2.x;
  const dy   = ball.y - p2.y;
  const dist = Math.hypot(dx, dy);

  // Prefer positioning a bit behind ball to face goal
  const targetX = ball.x + 20; // approach from behind
  const targetY = ball.y;
  const tdx = targetX - p2.x;
  const tdy = targetY - p2.y;
  const tdist = Math.hypot(tdx, tdy);

  if (tdist > 1) {
    p2.x += (tdx / tdist) * AI_SPD;
    p2.y += (tdy / tdist) * AI_SPD;
  }

  clampPlayer(p2);

  // Kick when close
  if (aiKickCooldown <= 0 && dist < PLAYER_R + BALL_R + 10) {
    // Kick toward left goal (player 1's goal)
    const goalX = GOAL_W;
    const goalY = CANVAS_H / 2;
    const gx = goalX - p2.x;
    const gy = goalY - p2.y;
    const gd = Math.hypot(gx, gy);
    ball.vx = (gx / gd) * AI_KICK;
    ball.vy = (gy / gd) * AI_KICK + (Math.random() - 0.5) * 2;
    aiKickCooldown = 30;
  }
  if (aiKickCooldown > 0) aiKickCooldown--;
}

// ─── Ball Physics ─────────────────────────────────────────────────────────────

function moveBall() {
  ball.vx *= FRICTION;
  ball.vy *= FRICTION;
  ball.x  += ball.vx;
  ball.y  += ball.vy;

  // Wall bounces (top/bottom)
  if (ball.y - BALL_R < 0) {
    ball.y  = BALL_R;
    ball.vy *= -0.72;
  }
  if (ball.y + BALL_R > CANVAS_H) {
    ball.y  = CANVAS_H - BALL_R;
    ball.vy *= -0.72;
  }

  // Side walls (outside goal zone)
  const goalTop = CANVAS_H / 2 - GOAL_H / 2;
  const goalBot = CANVAS_H / 2 + GOAL_H / 2;

  if (ball.x - BALL_R < 0) {
    // Left wall — but only if not in goal opening
    if (ball.y < goalTop || ball.y > goalBot) {
      ball.x  = BALL_R;
      ball.vx *= -0.72;
    }
  }
  if (ball.x + BALL_R > CANVAS_W) {
    if (ball.y < goalTop || ball.y > goalBot) {
      ball.x  = CANVAS_W - BALL_R;
      ball.vx *= -0.72;
    }
  }

  // Player collisions
  for (const p of [p1, p2]) {
    const dx   = ball.x - p.x;
    const dy   = ball.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < PLAYER_R + BALL_R) {
      const nx = dist > 0 ? dx / dist : 1;
      const ny = dist > 0 ? dy / dist : 0;
      ball.x  = p.x + nx * (PLAYER_R + BALL_R + 1);
      ball.y  = p.y + ny * (PLAYER_R + BALL_R + 1);
      ball.vx = nx * 4.5;
      ball.vy = ny * 4.5;
    }
  }
}

// ─── Goal Detection ───────────────────────────────────────────────────────────

function checkGoals() {
  const goalTop = CANVAS_H / 2 - GOAL_H / 2;
  const goalBot = CANVAS_H / 2 + GOAL_H / 2;

  // Ball fully inside left goal → p2 scores
  if (ball.x - BALL_R < GOAL_W && ball.y > goalTop && ball.y < goalBot) {
    p2.score++;
    onGoal(mode === 'ai' ? 'AI GOAL' : 'P2 GOAL', '#e24b4a');
    return;
  }

  // Ball fully inside right goal → p1 scores
  if (ball.x + BALL_R > CANVAS_W - GOAL_W && ball.y > goalTop && ball.y < goalBot) {
    p1.score++;
    onGoal('GOAL!', '#4a8fe2');
    return;
  }
}

function onGoal(msg, color) {
  scoring = true;
  updateScoreUI();
  showGoalFlash(msg, color);

  if (p1.score >= WIN_SCORE || p2.score >= WIN_SCORE) {
    setTimeout(triggerEnd, 1400);
    return;
  }

  setTimeout(() => {
    initBall();
    resetPositions();
    scoring = false;
  }, 1400);
}

function resetPositions() {
  p1.x = 110;          p1.y = CANVAS_H / 2;
  p2.x = CANVAS_W-110; p2.y = CANVAS_H / 2;
}

function showGoalFlash(text, color) {
  goalFlash.textContent = text;
  goalFlash.style.background = color + '22';
  goalFlash.style.color = color;
  goalFlash.style.textShadow = `0 0 20px ${color}`;
  goalFlash.classList.remove('hidden', 'show');
  void goalFlash.offsetWidth; // reflow to restart animation
  goalFlash.classList.add('show');
  setTimeout(() => goalFlash.classList.remove('show'), 1400);
}

// ─── End Game ─────────────────────────────────────────────────────────────────

function triggerEnd() {
  running = false;
  clearInterval(timerInt);
  cancelAnimationFrame(animId);

  let winner;
  if (p1.score > p2.score)      winner = 'Player 1 wins! 🎉';
  else if (p2.score > p1.score) winner = (mode === 'ai' ? 'AI wins! 🤖' : 'Player 2 wins! 🎉');
  else                          winner = "It's a draw! 🤝";

  winnerEl.textContent  = winner;
  finalScEl.textContent = `${p1.score} — ${p2.score}`;

  setTimeout(() => showScreen(endScreen), 800);
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

function draw() {
  drawPitch();
  drawGoals();
  drawPlayers();
  drawBall();
}

function drawPitch() {
  // Base green
  ctx.fillStyle = '#2d8a35';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Alternating stripes
  const stripeW = CANVAS_W / 8;
  ctx.fillStyle = '#2a7030';
  for (let i = 0; i < 8; i += 2) {
    ctx.fillRect(i * stripeW, 0, stripeW, CANVAS_H);
  }

  // Pitch border
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(6, 6, CANVAS_W - 12, CANVAS_H - 12);

  // Halfway line
  ctx.beginPath();
  ctx.moveTo(CANVAS_W / 2, 6);
  ctx.lineTo(CANVAS_W / 2, CANVAS_H - 6);
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(CANVAS_W / 2, CANVAS_H / 2, 44, 0, Math.PI * 2);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(CANVAS_W / 2, CANVAS_H / 2, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Penalty boxes
  const pbW = 100, pbH = 160;
  const pbY  = CANVAS_H / 2 - pbH / 2;
  ctx.strokeRect(6, pbY, pbW, pbH);
  ctx.strokeRect(CANVAS_W - 6 - pbW, pbY, pbW, pbH);

  // Corner arcs
  const corners = [[0,0],[CANVAS_W,0],[0,CANVAS_H],[CANVAS_W,CANVAS_H]];
  corners.forEach(([cx,cy]) => {
    const sx = cx === 0 ? 6 : -6;
    const sy = cy === 0 ? 6 : -6;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawGoals() {
  const goalTop  = CANVAS_H / 2 - GOAL_H / 2;

  // Left goal
  ctx.fillStyle   = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, goalTop, GOAL_W, GOAL_H);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 2;
  ctx.strokeRect(0, goalTop, GOAL_W, GOAL_H);

  // Net lines — left
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth   = 0.5;
  for (let y = goalTop + 12; y < goalTop + GOAL_H; y += 12) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GOAL_W, y); ctx.stroke();
  }

  // Right goal
  ctx.fillStyle   = 'rgba(255,255,255,0.12)';
  ctx.fillRect(CANVAS_W - GOAL_W, goalTop, GOAL_W, GOAL_H);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 2;
  ctx.strokeRect(CANVAS_W - GOAL_W, goalTop, GOAL_W, GOAL_H);

  // Net lines — right
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth   = 0.5;
  for (let y = goalTop + 12; y < goalTop + GOAL_H; y += 12) {
    ctx.beginPath(); ctx.moveTo(CANVAS_W - GOAL_W, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }
}

function drawPlayers() {
  drawPlayer(p1, '#4a8fe2', '#1a5fa0', '1');
  drawPlayer(p2, '#e24b4a', '#a02020', mode === 'ai' ? 'AI' : '2');
}

function drawPlayer(p, bodyColor, darkColor, label) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(p.x + 3, p.y + 4, PLAYER_R, PLAYER_R * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Outer ring
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
  ctx.fill();

  // Inner circle (shirt)
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_R * 0.58, 0, Math.PI * 2);
  ctx.fill();

  // Number / label
  ctx.fillStyle    = '#fff';
  ctx.font         = `600 ${label.length > 1 ? 8 : 10}px sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, p.x, p.y);

  // Border ring
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
}

function drawBall() {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(ball.x + 2, ball.y + 4, BALL_R, BALL_R * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ball body
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();

  // Outline
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth   = 0.8;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.stroke();

  // Soccer pentagon
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Small pentagon details
  ctx.fillStyle = '#444';
  const offsets = [[0,-1],[0.85,0.5],[-0.85,0.5]].map(([ox,oy]) => [ox * BALL_R * 0.7, oy * BALL_R * 0.7]);
  offsets.forEach(([ox, oy]) => {
    ctx.beginPath();
    ctx.arc(ball.x + ox, ball.y + oy, BALL_R * 0.15, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ─── Input ────────────────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  keys[e.code] = true;
  // Prevent arrow keys from scrolling page during game
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code) && running) {
    e.preventDefault();
  }
});

document.addEventListener('keyup', e => {
  keys[e.code] = false;
});

// ─── Buttons ──────────────────────────────────────────────────────────────────

document.getElementById('btn-1v1').addEventListener('click', () => startGame('1v1'));
document.getElementById('btn-ai').addEventListener('click',  () => startGame('ai'));

document.getElementById('btn-menu').addEventListener('click', () => {
  running = false;
  clearInterval(timerInt);
  cancelAnimationFrame(animId);
  showScreen(menuScreen);
});

document.getElementById('btn-restart').addEventListener('click', restartGame);
document.getElementById('btn-rematch').addEventListener('click', restartGame);
document.getElementById('btn-end-menu').addEventListener('click', () => showScreen(menuScreen));
