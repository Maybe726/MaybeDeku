/* ============================================================
 * 坦克大战 Tank Battle —— 经典 Battle City 风格
 * 纯 Canvas 实现，无任何外部资源
 * ============================================================ */
(() => {
'use strict';

// ---------- 常量 ----------
const TILE = 32, COLS = 20, ROWS = 15;
const W = TILE * COLS, H = TILE * ROWS;
const T_EMPTY = 0, T_BRICK = 1, T_STEEL = 2, T_WATER = 3, T_BUSH = 4, T_BASE = 5;
const DIRV = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}]; // 上右下左

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W; canvas.height = H;

const $ = id => document.getElementById(id);

// ---------- 音效（WebAudio 合成，无音频文件） ----------
let AC = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* ignore */ } }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function beep(freq, dur, type = 'square', vol = 0.07, slide = 0) {
  const ac = audio(); if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ac.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + dur);
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g); g.connect(ac.destination);
  o.start(); o.stop(ac.currentTime + dur);
}
const sfx = {
  shoot()     { beep(520, 0.07, 'square', 0.06, -300); },
  enemyShoot(){ beep(300, 0.07, 'square', 0.05, -160); },
  brick()     { beep(160, 0.08, 'square', 0.06, -70); },
  steel()     { beep(230, 0.05, 'triangle', 0.06); },
  hit()       { beep(220, 0.08, 'sawtooth', 0.07, -120); },
  shield()    { beep(760, 0.06, 'sine', 0.06); },
  explode()   { beep(120, 0.35, 'sawtooth', 0.11, -90); beep(60, 0.4, 'triangle', 0.12, -35); },
  power()     { beep(660, 0.08, 'sine', 0.08); setTimeout(() => beep(990, 0.1, 'sine', 0.08), 90); },
  over()      { beep(400, 0.25, 'sawtooth', 0.1, -250); setTimeout(() => beep(200, 0.4, 'sawtooth', 0.1, -150), 220); },
};

// ---------- 关卡 ----------
// 图例: . 空  # 砖墙(可摧毁)  @ 钢墙(需2级炮弹)  ~ 水域  B 基地
const LEVELS = [
  {
    maxOn: 3,
    enemies: { basic: 6, fast: 2, heavy: 0 },
    map: [
      '....................',
      '.##...##....##...##.',
      '.##...##....##...##.',
      '....................',
      '.##..####..####..##.',
      '.##..............##.',
      '....##........##....',
      '.@@.##..@@@@..##.@@.',
      '.@@.##..@@@@..##.@@.',
      '....##........##....',
      '.##..............##.',
      '.##..####..####..##.',
      '....................',
      '......##....##......',
      '......##.BB.##......',
    ],
  },
  {
    maxOn: 4,
    enemies: { basic: 6, fast: 4, heavy: 2 },
    map: [
      '.##.##.##..##.##.##.',
      '.##.##.##..##.##.##.',
      '....................',
      '..@@@......###......',
      '..@@@......###......',
      '....................',
      '.####..######..####.',
      '....................',
      '....~~......~~......',
      '....~~......~~......',
      '....................',
      '.####..######..####.',
      '....................',
      '......##....##......',
      '......##.BB.##......',
    ],
  },
  {
    maxOn: 4,
    enemies: { basic: 6, fast: 6, heavy: 4 },
    map: [
      '####....####....####',
      '#..................#',
      '#..##..##..##..##..#',
      '#..##..##..##..##..#',
      '#..................#',
      '#..@@.......@@.....#',
      '#..@@.......@@.....#',
      '#..................#',
      '#..##..######..##..#',
      '#..##..######..##..#',
      '#..................#',
      '#....~~~~..~~~~....#',
      '#....~~~~..~~~~....#',
      '#.......##.##......#',
      '########.BB.########',
    ],
  },
];

const ENEMY_TYPES = {
  basic: { speed: 60,  hp: 1, score: 100, color: '#b8b8b8', turret: '#8a8a8a', bulletSpeed: 210, fireDelay: 1.4 },
  fast:  { speed: 118, hp: 1, score: 200, color: '#5ad2e8', turret: '#3aa8bc', bulletSpeed: 300, fireDelay: 1.1 },
  heavy: { speed: 46,  hp: 3, score: 300, color: '#d9534f', turret: '#a83a36', bulletSpeed: 190, fireDelay: 1.0 },
};

const SPAWN_POINTS = [[0, 0], [9, 0], [19, 0]];
const PLAYER_SPAWN = [4 * TILE + 2, 14 * TILE + 2];

// ---------- 游戏状态 ----------
let state = 'menu';       // menu | play | clear | over | win
let levelIdx = 0;
let map = [];
let tanks = [];
let bullets = [];
let particles = [];
let powerups = [];
let enemyQueue = [];
let score = 0, lives = 3;
let baseAlive = true;
let gameTime = 0;
let spawnTimer = 0, respawnTimer = 0, clearTimer = 0;
let overReason = '';
let hiScore = 0;
try { hiScore = parseInt(localStorage.getItem('tank-hi') || '0', 10) || 0; } catch (e) { /* ignore */ }

const player = { isPlayer: true, alive: false };
resetTankObject(player);

function resetTankObject(t) {
  t.x = 0; t.y = 0; t.dir = 0; t.speed = 95; t.color = '#e8c53a'; t.turret = '#c9a227';
  t.hp = 1; t.maxBullets = 1; t.bulletSpeed = 390; t.bulletPower = 1;
  t.fireDelay = 0.34; t.cool = 0; t.shield = 0; t.aiTimer = 0; t.blocked = false;
  t.upgrade = 0; t.score = 0; t.type = 'player'; t.hasPowerup = false; t.trackT = 0;
  return t;
}

// ---------- 关卡装载 ----------
function loadLevel(idx) {
  const lv = LEVELS[idx];
  map = lv.map.map(row => [...row].map(ch =>
    ch === '#' ? T_BRICK : ch === '@' ? T_STEEL : ch === '~' ? T_WATER :
    ch === '%' ? T_BUSH : ch === 'B' ? T_BASE : T_EMPTY));
  enemyQueue = [];
  Object.entries(lv.enemies).forEach(([type, n]) => { for (let i = 0; i < n; i++) enemyQueue.push(type); });
  // 打乱出场顺序，但最后一波保证有重型坦克压轴
  for (let i = enemyQueue.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [enemyQueue[i], enemyQueue[j]] = [enemyQueue[j], enemyQueue[i]];
  }
  bullets = []; powerups = []; particles = [];
  tanks = [player];
  baseAlive = true;
  spawnTimer = 1.0;
  respawnPlayer(true);
}

function respawnPlayer(first = false) {
  if (tankCanBeAt(PLAYER_SPAWN[0], PLAYER_SPAWN[1], player)) {
    resetTankObject(player);
    player.x = PLAYER_SPAWN[0]; player.y = PLAYER_SPAWN[1];
    player.alive = true;
    player.shield = first ? 2.5 : 3.5;
    if (!tanks.includes(player)) tanks.push(player);
  } else {
    respawnTimer = 0.5; // 出生点被占，稍后重试
  }
}

// ---------- 几何 / 碰撞 ----------
function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
function solidForTank(c, r) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
  const t = map[r][c];
  return t === T_BRICK || t === T_STEEL || t === T_WATER || t === T_BASE;
}
function tankCanBeAt(x, y, self) {
  if (x < 0 || y < 0 || x + 28 > W || y + 28 > H) return false;
  const c0 = Math.floor(x / TILE), c1 = Math.floor((x + 27) / TILE);
  const r0 = Math.floor(y / TILE), r1 = Math.floor((y + 27) / TILE);
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++)
      if (solidForTank(c, r)) return false;
  for (const t of tanks)
    if (t !== self && t.alive && overlap(x, y, 28, 28, t.x, t.y, 28, 28)) return false;
  return true;
}

// ---------- 坦克行为 ----------
function moveTank(t, dt) {
  const v = DIRV[t.dir];
  const nx = t.x + v.x * t.speed * dt;
  const ny = t.y + v.y * t.speed * dt;
  if (tankCanBeAt(nx, ny, t)) { t.x = nx; t.y = ny; t.blocked = false; }
  else t.blocked = true;
  t.trackT += dt;
}

function fire(t) {
  if (t.cool > 0) return;
  let n = 0;
  for (const b of bullets) if (b.owner === t && !b.dead) n++;
  if (n >= t.maxBullets) return;
  const v = DIRV[t.dir];
  bullets.push({
    x: t.x + 14 + v.x * 20 - 3,
    y: t.y + 14 + v.y * 20 - 3,
    dir: t.dir, speed: t.bulletSpeed, power: t.bulletPower,
    owner: t, dead: false,
  });
  t.cool = t.fireDelay;
  (t.isPlayer ? sfx.shoot : sfx.enemyShoot)();
}

function hitTank(t, b) {
  if (t.shield > 0) { spawnSparks(b.x + 3, b.y + 3, 4, '#7ec8ff'); sfx.shield(); return; }
  t.hp -= b.power;
  if (t.hp <= 0) killTank(t, b.owner.isPlayer);
  else { spawnSparks(b.x + 3, b.y + 3, 6, '#ffd27e'); sfx.hit(); }
}

function killTank(t, byPlayer = false) {
  if (!t.alive) return;
  t.alive = false;
  spawnExplosion(t.x + 14, t.y + 14, t.type === 'heavy' ? 26 : 18);
  sfx.explode();
  if (t.isPlayer) { onPlayerDeath(); return; }
  if (byPlayer) addScore(t.score);
  if (t.hasPowerup) dropPowerup(t.x + 14, t.y + 14);
}

function addScore(n) {
  score += n;
  if (score > hiScore) {
    hiScore = score;
    try { localStorage.setItem('tank-hi', String(hiScore)); } catch (e) { /* ignore */ }
  }
}

function onPlayerDeath() {
  lives--;
  respawnTimer = 1.6;
  if (lives <= 0) gameOver('生命耗尽');
}

function destroyBase() {
  if (!baseAlive) return;
  baseAlive = false;
  spawnExplosion(10 * TILE, 14 * TILE + 16, 40);
  spawnExplosion(9 * TILE + 16, 14 * TILE + 16, 30);
  sfx.explode();
  gameOver('基地被摧毁');
}

function gameOver(reason) {
  overReason = reason;
  state = 'over';
  sfx.over();
}

// ---------- 敌方 AI ----------
function enemiesAlive() {
  let n = 0;
  for (const t of tanks) if (!t.isPlayer && t.alive) n++;
  return n;
}

function trySpawnEnemy() {
  if (!enemyQueue.length || enemiesAlive() >= LEVELS[levelIdx].maxOn) return;
  const [c, r] = SPAWN_POINTS[(Math.random() * SPAWN_POINTS.length) | 0];
  const x = c * TILE + 2, y = r * TILE + 2;
  if (!tankCanBeAt(x, y, null)) return;
  const type = enemyQueue.shift();
  const cfg = ENEMY_TYPES[type];
  tanks.push({
    isPlayer: false, type, x, y, dir: 2, alive: true,
    speed: cfg.speed, hp: cfg.hp, color: cfg.color, turret: cfg.turret,
    score: cfg.score, bulletSpeed: cfg.bulletSpeed, fireDelay: cfg.fireDelay,
    maxBullets: 1, bulletPower: 1, cool: 0.6 + Math.random(),
    shield: 0.8, aiTimer: 0, blocked: false, trackT: 0,
    hasPowerup: Math.random() < 0.22,
  });
}

function aiUpdate(t, dt) {
  t.aiTimer -= dt;
  if (t.aiTimer <= 0) {
    t.aiTimer = 0.35 + Math.random() * 0.55;
    const r = Math.random();
    if (t.blocked || r < 0.3) t.dir = (Math.random() * 4) | 0;
    else if (r < 0.6) aimAt(t);
  }
  moveTank(t, dt);
  if (t.cool <= 0) {
    if (alignedShot(t)) fire(t);
    else if (Math.random() < dt * 0.7) fire(t);
  }
}

// 与目标（玩家/基地）同行或同列时瞄准
function aimAt(t) {
  const targets = [];
  if (player.alive) targets.push([player.x + 14, player.y + 14]);
  if (baseAlive) targets.push([10 * TILE, 14 * TILE + 16]);
  const [tx, ty] = targets[(Math.random() * targets.length) | 0];
  const dx = tx - (t.x + 14), dy = ty - (t.y + 14);
  if (Math.abs(dx) > Math.abs(dy)) t.dir = dx > 0 ? 1 : 3;
  else t.dir = dy > 0 ? 2 : 0;
}

function alignedShot(t) {
  if (!player.alive) return false;
  const cx = t.x + 14, cy = t.y + 14;
  const px = player.x + 14, py = player.y + 14;
  if (Math.abs(cy - py) < 14 && Math.random() < 0.5) { t.dir = px > cx ? 1 : 3; return true; }
  if (Math.abs(cx - px) < 14 && Math.random() < 0.5) { t.dir = py > cy ? 2 : 0; return true; }
  return false;
}

// ---------- 炮弹 ----------
function updateBullet(b, dt) {
  let rem = b.speed * dt;
  while (rem > 0 && !b.dead) {
    const d = Math.min(rem, 4);
    rem -= d;
    b.x += DIRV[b.dir].x * d;
    b.y += DIRV[b.dir].y * d;
    bulletCollide(b);
  }
}

function bulletCollide(b) {
  if (b.x < -8 || b.y < -8 || b.x > W + 8 || b.y > H + 8) { b.dead = true; return; }

  // 地形
  const c = Math.floor((b.x + 3) / TILE), r = Math.floor((b.y + 3) / TILE);
  if (c >= 0 && r >= 0 && c < COLS && r < ROWS) {
    const t = map[r][c];
    if (t === T_BRICK) {
      map[r][c] = T_EMPTY;
      spawnSparks(b.x + 3, b.y + 3, 6, '#c96a3b');
      sfx.brick(); b.dead = true; return;
    }
    if (t === T_STEEL) {
      if (b.power >= 2) { map[r][c] = T_EMPTY; spawnSparks(b.x + 3, b.y + 3, 8, '#cccccc'); }
      else spawnSparks(b.x + 3, b.y + 3, 3, '#cccccc');
      sfx.steel(); b.dead = true; return;
    }
    if (t === T_BASE) { b.dead = true; destroyBase(); return; }
  }

  // 坦克
  for (const t of tanks) {
    if (!t.alive || t === b.owner) continue;
    if (overlap(b.x, b.y, 6, 6, t.x, t.y, 28, 28)) {
      hitTank(t, b);
      b.dead = true;
      return;
    }
  }

  // 对撞的炮弹互相抵消
  for (const o of bullets) {
    if (o === b || o.dead || o.owner === b.owner) continue;
    if (overlap(b.x, b.y, 6, 6, o.x, o.y, 6, 6)) {
      o.dead = true; b.dead = true;
      spawnSparks((b.x + o.x) / 2 + 3, (b.y + o.y) / 2 + 3, 4, '#ffffff');
      return;
    }
  }
}

// ---------- 道具 ----------
function dropPowerup(x, y) {
  const kinds = ['star', 'shield', 'life', 'bomb'];
  const kind = kinds[(Math.random() * kinds.length) | 0];
  powerups.push({
    x: Math.min(COLS - 1, Math.max(0, Math.floor(x / TILE))) * TILE,
    y: Math.min(ROWS - 1, Math.max(0, Math.floor(y / TILE))) * TILE,
    kind, t: 12,
  });
}

function applyPowerup(p) {
  sfx.power();
  switch (p.kind) {
    case 'star':
      player.upgrade = Math.min(2, player.upgrade + 1);
      if (player.upgrade === 1) { player.maxBullets = 2; player.fireDelay = 0.28; }
      if (player.upgrade === 2) { player.bulletPower = 2; player.speed = 105; player.color = '#ffe066'; }
      break;
    case 'shield':
      player.shield = 7; break;
    case 'life':
      lives++; break;
    case 'bomb':
      for (const t of tanks) {
        if (!t.isPlayer && t.alive) { addScore(t.score); killTankNoDrop(t); }
      }
      break;
  }
}

function killTankNoDrop(t) {
  t.alive = false;
  spawnExplosion(t.x + 14, t.y + 14, 18);
  sfx.explode();
}

// ---------- 粒子 ----------
function spawnSparks(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 90;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25 + Math.random() * 0.25, max: 0.5, color, size: 1 + Math.random() * 2.5 });
  }
}
function spawnExplosion(x, y, n) {
  const colors = ['#ffd27e', '#ff9248', '#e94560', '#888888'];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 140;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35 + Math.random() * 0.5, max: 0.85, color: colors[(Math.random() * colors.length) | 0], size: 2 + Math.random() * 3.5 });
  }
}
function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.94; p.vy *= 0.94;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
}

// ---------- 输入 ----------
const keys = {};
let lastMoveKey = null;
const MOVE_KEYS = {
  ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1,
  ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3,
};

addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  audio();
  keys[e.code] = true;
  if (e.code in MOVE_KEYS) lastMoveKey = e.code;

  if (e.code === 'Enter') {
    if (state === 'menu') startGame();
    else if (state === 'over' || state === 'win') { state = 'menu'; }
  }
  if (e.code === 'KeyP' && (state === 'play' || state === 'pause')) {
    state = state === 'play' ? 'pause' : 'play';
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });

function handlePlayerInput(dt) {
  if (!player.alive) return;
  let dir = null;
  if (lastMoveKey && keys[lastMoveKey]) dir = MOVE_KEYS[lastMoveKey];
  if (dir === null) {
    for (const code in MOVE_KEYS) if (keys[code]) { dir = MOVE_KEYS[code]; break; }
  }
  if (dir !== null) { player.dir = dir; moveTank(player, dt); }
  if (keys.Space || keys.KeyJ) fire(player);
}

// ---------- 流程控制 ----------
function startGame() {
  score = 0; lives = 3; levelIdx = 0;
  state = 'play';
  loadLevel(0);
}

function nextLevel() {
  levelIdx++;
  if (levelIdx >= LEVELS.length) { state = 'win'; sfx.power(); return; }
  state = 'play';
  loadLevel(levelIdx);
}

// ---------- 主更新 ----------
function update(dt) {
  gameTime += dt;
  updateParticles(dt);

  if (state === 'clear') {
    clearTimer -= dt;
    if (clearTimer <= 0) nextLevel();
    return;
  }
  if (state !== 'play') return;

  handlePlayerInput(dt);

  for (const t of tanks) {
    if (!t.alive) continue;
    t.cool -= dt;
    t.shield = Math.max(0, t.shield - dt);
    if (!t.isPlayer) aiUpdate(t, dt);
  }

  for (const b of bullets) if (!b.dead) updateBullet(b, dt);
  bullets = bullets.filter(b => !b.dead);
  tanks = tanks.filter(t => t.alive || t.isPlayer);

  // 玩家重生
  if (!player.alive && lives > 0 && state === 'play') {
    respawnTimer -= dt;
    if (respawnTimer <= 0) respawnPlayer();
  }

  // 敌方增援
  spawnTimer -= dt;
  if (spawnTimer <= 0) { spawnTimer = 2.2; trySpawnEnemy(); }

  // 道具拾取 / 超时
  for (const p of powerups) {
    p.t -= dt;
    if (player.alive && overlap(p.x, p.y, TILE, TILE, player.x, player.y, 28, 28)) {
      p.t = 0; applyPowerup(p);
    }
  }
  powerups = powerups.filter(p => p.t > 0);

  // 过关判定
  if (state === 'play' && baseAlive && !enemyQueue.length && enemiesAlive() === 0) {
    state = 'clear';
    clearTimer = 2.2;
    sfx.power();
  }

  updateHUD();
}

function updateHUD() {
  $('hud-level').textContent = levelIdx + 1;
  $('hud-score').textContent = score;
  $('hud-lives').textContent = Math.max(0, lives);
  $('hud-enemies').textContent = enemyQueue.length + enemiesAlive();
}

// ---------- 绘制 ----------
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  drawTiles();
  for (const p of powerups) drawPowerup(p);
  for (const t of tanks) if (t.alive) drawTank(t);
  for (const b of bullets) drawBullet(b);
  updateDrawParticles();
  drawBushOverlay();
  drawShield();

  if (state === 'menu') drawOverlay('坦克大战', 'TANK BATTLE', '按 Enter 开始游戏');
  else if (state === 'pause') drawOverlay('已暂停', 'PAUSED', '按 P 继续');
  else if (state === 'clear') drawOverlay('第 ' + (levelIdx + 1) + ' 关完成！', 'STAGE CLEAR', '');
  else if (state === 'over') drawOverlay('游戏结束', 'GAME OVER', overReason + ' — 得分 ' + score + '，按 Enter 返回菜单');
  else if (state === 'win') drawOverlay('恭喜通关！', 'YOU WIN', '总得分 ' + score + ' / 最高分 ' + hiScore + '，按 Enter 返回菜单');
}

function drawTiles() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = map[r][c], x = c * TILE, y = r * TILE;
      if (t === T_BRICK) {
        ctx.fillStyle = '#8a3324';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#6e2418';
        ctx.fillRect(x, y + 9, TILE, 2);
        ctx.fillRect(x, y + 21, TILE, 2);
        ctx.fillRect(x + 10, y, 2, 9);
        ctx.fillRect(x + 22, y, 2, 9);
        ctx.fillRect(x + 4, y + 11, 2, 10);
        ctx.fillRect(x + 16, y + 11, 2, 10);
        ctx.fillRect(x + 27, y + 11, 2, 10);
        ctx.fillRect(x + 10, y + 23, 2, 9);
        ctx.fillRect(x + 22, y + 23, 2, 9);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x, y, TILE, 3);
      } else if (t === T_STEEL) {
        ctx.fillStyle = '#9aa0a6';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#c8ccd0';
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = '#e8eaec';
        ctx.fillRect(x + 5, y + 5, TILE - 14, 4);
        ctx.fillStyle = '#787d82';
        ctx.fillRect(x + TILE - 8, y + 6, 3, TILE - 12);
        ctx.fillRect(x + 6, y + TILE - 8, TILE - 12, 3);
      } else if (t === T_WATER) {
        ctx.fillStyle = '#103a9e';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = 'rgba(120,180,255,0.55)';
        ctx.lineWidth = 2;
        const off = Math.sin(gameTime * 2.2 + c * 0.9 + r) * 3;
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 10 + off);
        ctx.quadraticCurveTo(x + 12, y + 6 + off, x + 20, y + 10 + off);
        ctx.quadraticCurveTo(x + 26, y + 13 + off, x + 29, y + 10 + off);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 23 - off);
        ctx.quadraticCurveTo(x + 11, y + 19 - off, x + 19, y + 23 - off);
        ctx.stroke();
      } else if (t === T_BASE) {
        drawBase(x, y);
      }
    }
  }
}

function drawBase(x, y) {
  ctx.fillStyle = '#222';
  ctx.fillRect(x, y, TILE, TILE);
  if (!baseAlive) {
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(x + 16, y + 20, 10, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x + 6, y + 22, 20, 6);
    return;
  }
  // 金鹰旗
  ctx.fillStyle = '#7a5c1e';
  ctx.fillRect(x + 14, y + 6, 3, 20);
  ctx.fillStyle = '#ffc947';
  ctx.beginPath();
  ctx.moveTo(x + 17, y + 6);
  ctx.lineTo(x + 29, y + 11);
  ctx.lineTo(x + 17, y + 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8b53a';
  ctx.beginPath();
  ctx.ellipse(x + 13, y + 18, 7, 9, -0.25, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#fff2c8';
  ctx.beginPath();
  ctx.arc(x + 15, y + 13, 3, 0, 7);
  ctx.fill();
}

function drawTank(t) {
  ctx.save();
  ctx.translate(t.x + 14, t.y + 14);
  ctx.rotate(t.dir * Math.PI / 2);
  // 履带
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(-14, -14, 7, 28);
  ctx.fillRect(7, -14, 7, 28);
  ctx.fillStyle = '#4a4a4a';
  const ph = (t.trackT * 40) % 7;
  for (let i = -14; i < 14; i += 7) {
    ctx.fillRect(-13, i + ph - 7 < -14 ? -14 : i + ph - 7, 5, 2.5);
    ctx.fillRect(8, i + ph - 7 < -14 ? -14 : i + ph - 7, 5, 2.5);
  }
  // 车身
  ctx.fillStyle = t.color;
  ctx.fillRect(-7, -12, 14, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-7, -12, 14, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(-7, 8, 14, 4);
  // 炮塔 + 炮管
  ctx.fillStyle = t.turret;
  ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, 7); ctx.fill();
  ctx.fillRect(-2.2, -21, 4.4, 15);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.arc(-2, -2, 2.5, 0, 7); ctx.fill();
  ctx.restore();
}

function drawShield() {
  for (const t of tanks) {
    if (!t.alive || t.shield <= 0) continue;
    ctx.save();
    ctx.strokeStyle = 'rgba(126,200,255,' + (0.4 + 0.3 * Math.sin(gameTime * 10)) + ')';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -gameTime * 30;
    ctx.beginPath();
    ctx.arc(t.x + 14, t.y + 14, 19, 0, 7);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBullet(b) {
  ctx.fillStyle = b.owner && b.owner.isPlayer ? '#ffe98a' : '#ff9a7e';
  ctx.fillRect(b.x, b.y, 6, 6);
  ctx.fillStyle = '#fff';
  ctx.fillRect(b.x + 1.5, b.y + 1.5, 3, 3);
}

function drawPowerup(p) {
  const blink = p.t < 3 && Math.sin(gameTime * 12) > 0;
  if (blink) return;
  const cx = p.x + 16, cy = p.y + 16;
  const colors = { star: '#ffc947', shield: '#7ec8ff', life: '#7ee87e', bomb: '#ff6b6b' };
  ctx.fillStyle = '#111';
  ctx.fillRect(p.x + 2, p.y + 2, 28, 28);
  ctx.strokeStyle = colors[p.kind];
  ctx.lineWidth = 2;
  ctx.strokeRect(p.x + 2.5, p.y + 2.5, 27, 27);
  ctx.fillStyle = colors[p.kind];
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const glyph = { star: '★', shield: '⛨', life: '♥', bomb: '✦' }[p.kind];
  ctx.fillText(glyph, cx, cy + 1);
}

function updateDrawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawBushOverlay() {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (map[r][c] === T_BUSH) {
        const x = c * TILE, y = r * TILE;
        ctx.fillStyle = 'rgba(28,110,38,0.6)';
        ctx.beginPath();
        ctx.arc(x + 9, y + 11, 8, 0, 7);
        ctx.arc(x + 22, y + 10, 8, 0, 7);
        ctx.arc(x + 15, y + 22, 9, 0, 7);
        ctx.fill();
      }
}

function drawOverlay(title, sub, hint) {
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e94560';
  ctx.font = 'bold 52px "Microsoft YaHei", sans-serif';
  ctx.fillText(title, W / 2, H / 2 - 32);
  ctx.fillStyle = '#ffc947';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(sub, W / 2, H / 2 + 6);
  if (hint) {
    ctx.fillStyle = '#fff';
    ctx.font = '16px "Microsoft YaHei", sans-serif';
    ctx.fillText(hint, W / 2, H / 2 + 44);
  }
  if (state === 'menu' && hiScore > 0) {
    ctx.fillStyle = '#8b9dc3';
    ctx.font = '14px monospace';
    ctx.fillText('最高分 ' + hiScore, W / 2, H / 2 + 76);
  }
}

// ---------- 主循环 ----------
let lastT = 0;
function loop(t) {
  const dt = Math.min((t - lastT) / 1000 || 0, 0.05);
  lastT = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

loadLevel(0);   // 预载第 1 关作为菜单背景
state = 'menu';
updateHUD();
requestAnimationFrame(loop);

})();
