(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const BASE_WIDTH = 1024;
  const enemySheet = new Image();
  enemySheet.src = 'assets/enemy-sheet.png';
  const arena = new Image();
  arena.src = 'assets/arena-dusk.png';
  const heroSprites = {};
  for (const [name, src] of Object.entries({ idle: 'hero-idle.png', left: 'hero-walk.png', right: 'hero-idle.png', punchRight: 'hero-punch-right.png', punchLeft: 'hero-punch-left.png' })) {
    heroSprites[name] = new Image();
    heroSprites[name].src = `assets/${src}`;
  }
  const factions = [
    { name: 'Soviet', color: '#e54c42' },
    { name: 'China', color: '#ed5541' },
    { name: 'North Korea', color: '#dd4851' },
    { name: 'USA', color: '#628de0' },
    { name: 'Britain', color: '#6487d0' }
  ];
  const input = { left: false, right: false, jump: false, jumpQueued: false };
  let width = BASE_WIDTH;
  let height = 560;
  let floorY = 520;
  let player;
  let enemies = [];
  let particles = [];
  let wave = 1;
  let score = 0;
  let bestWave = readBest();
  let waveBreak = 0;
  let gameOver = false;
  let lastTime = 0;
  let elapsed = 0;
  let hitFlash = 0;
  let platforms = [];

  function readBest() {
    try { return Number(localStorage.getItem('siegsim-best-wave')) || 0; }
    catch { return 0; }
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = BASE_WIDTH;
    height = Math.max(380, BASE_WIDTH * rect.height / rect.width);
    floorY = height - 40;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (player) player.x = Math.max(38, Math.min(width - 38, player.x));
  }

  new ResizeObserver(resizeCanvas).observe(canvas.parentElement);
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function reset() {
    for (const action of Object.keys(input)) input[action] = false;
    wave = 1;
    score = 0;
    waveBreak = 0;
    gameOver = false;
    hitFlash = 0;
    particles = [];
    player = {
      x: width * 0.27, feet: floorY, vx: 0, vy: 0, health: 100,
      facing: 1, onGround: true, coyote: 0, jumpHold: 0,
      attackTime: 0, attackCooldown: 0, attackFacing: 1,
      attackResolved: true, invulnerable: 0, walkPhase: 0
    };
    createPlatforms();
    spawnWave();
    updateHud();
  }

  function spawnWave() {
    const count = Math.min(12, 3 + Math.floor((wave - 1) * 0.7));
    enemies = [];
    createPlatforms();
    const spawnSlots = wave < 4
      ? [0.55, 0.72, 0.88, 0.95, 0.62, 0.8, 0.5, 0.9, 0.66, 0.83, 0.96, 0.58]
      : [0.08, 0.92, 0.23, 0.77, 0.36, 0.64, 0.14, 0.86, 0.04, 0.96, 0.3, 0.7];
    for (let i = 0; i < count; i++) {
      const faction = factions[(wave - 1 + i) % factions.length];
      const x = width * spawnSlots[i % spawnSlots.length];
      enemies.push({
        x, vx: 0, hp: 2 + Math.floor((wave - 1) / 5),
        maxHp: 2 + Math.floor((wave - 1) / 5),
        faction: faction.name, factionIndex: factions.indexOf(faction),
        color: faction.color, hit: 0, hitCooldown: 0, stun: 0, dead: 0,
        alive: true, facing: x < player.x ? 1 : -1,
        seed: i * 1.7 + wave * 0.8, attackCooldown: 1.25 + i * 0.42
      });
    }
    waveBreak = 0;
    updateHud();
  }

  function createPlatforms() {
    const count = 2 + Math.floor(Math.random() * 4);
    const usableHeight = Math.max(150, floorY - 190);
    platforms = [];
    for (let i = 0; i < count; i++) {
      const w = 110 + Math.random() * 115;
      const x = 55 + Math.random() * Math.max(1, width - w - 110);
      const y = floorY - 95 - Math.random() * usableHeight;
      if (platforms.every(p => Math.abs(p.x - x) > 95 || Math.abs(p.y - y) > 70)) platforms.push({ x, y, w });
    }
  }

  function updateHud() {
    // Compact status is drawn directly in the arena.
  }

  function setControl(action, down) {
    if (!(action in input)) return;
    input[action] = down;
    if (action === 'jump' && down) input.jumpQueued = true;
  }

  const keyMap = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump'
  };
  const attackKeys = new Set(['KeyJ']);
  window.addEventListener('keydown', event => {
    if (gameOver && (event.code === 'Enter' || event.code === 'KeyJ')) { event.preventDefault(); reset(); return; }
    const action = keyMap[event.code];
    if (!action && !attackKeys.has(event.code)) return;
    event.preventDefault();
    if (action) setControl(action, true);
    else if (!event.repeat) startAttack();
  });
  window.addEventListener('keyup', event => {
    const action = keyMap[event.code];
    if (action) setControl(action, false);
  });
  window.addEventListener('blur', () => {
    for (const action of Object.keys(input)) input[action] = false;
  });

  document.querySelectorAll('[data-hold]').forEach(button => {
    const action = button.dataset.hold;
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setControl(action, true);
    });
    const release = event => { event.preventDefault(); setControl(action, false); };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', () => setControl(action, false));
  });
  document.querySelector('[data-action="attack"]').addEventListener('pointerdown', event => {
    event.preventDefault();
    startAttack();
  });
  document.querySelector('[data-action="attack"]').addEventListener('click', startAttack);
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button === 0) startAttack();
  });

  function startAttack() {
    if (gameOver) { reset(); return; }
    if (player.attackCooldown > 0) return;
    const moving = Number(input.right) - Number(input.left);
    player.attackFacing = moving || player.facing;
    player.facing = player.attackFacing;
    player.attackTime = 0.3;
    player.attackCooldown = 0.34;
    player.attackResolved = false;
    player.vx *= 0.86;
  }

  function hitTarget() {
    const inReach = enemies.filter(enemy => {
      if (!enemy.alive || enemy.hitCooldown > 0) return false;
      const dx = (enemy.x - player.x) * player.attackFacing;
      const verticalGap = Math.abs((floorY - 36) - (player.feet - 35));
      return dx > 8 && dx < 112 && verticalGap < 66;
    }).sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x));
    const enemy = inReach[0];
    if (!enemy) return;
    enemy.hp -= 1;
    enemy.hit = 0.24;
    enemy.hitCooldown = 0.28;
    enemy.stun = 0.3;
    enemy.vx = player.attackFacing * 260;
    score += 100;
    particles.push({ x: enemy.x, y: floorY - 66, life: 0.55, text: enemy.hp <= 0 ? 'PLOP!' : 'BONK!' });
    if (enemy.hp <= 0) {
      enemy.alive = false;
      enemy.dead = 0.38;
      score += 250 + wave * 20;
      particles.push({ x: enemy.x, y: floorY - 108, life: 0.75, text: enemy.faction });
    }
    updateHud();
  }

  function finish() {
    gameOver = true;
    bestWave = Math.max(bestWave, wave);
    try { localStorage.setItem('siegsim-best-wave', String(bestWave)); } catch { /* storage may be disabled */ }
  }

  function update(dt) {
    elapsed += dt;
    hitFlash = Math.max(0, hitFlash - dt);
    if (gameOver) return;

    if (waveBreak > 0) {
      waveBreak -= dt;
      if (waveBreak <= 0) {
        wave += 1;
        player.health = Math.min(100, player.health + 14);
        spawnWave();
      }
    }

    const direction = Number(input.right) - Number(input.left);
    const acceleration = player.onGround ? 2600 : 1550;
    const maxSpeed = 330;
    if (direction) {
      player.vx += direction * acceleration * dt;
      player.facing = direction;
    } else {
      const drag = player.onGround ? 3200 : 850;
      player.vx -= Math.sign(player.vx) * Math.min(Math.abs(player.vx), drag * dt);
    }
    player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));
    player.x += player.vx * dt;
    if (player.x < 30 || player.x > width - 30) {
      player.x = Math.max(30, Math.min(width - 30, player.x));
      player.vx *= -0.18;
    }
    if (Math.abs(player.vx) > 10) player.walkPhase += dt * 15;

    player.coyote = player.onGround ? 0.12 : Math.max(0, player.coyote - dt);
    if (input.jumpQueued && player.coyote > 0) {
      player.vy = -640;
      player.onGround = false;
      player.coyote = 0;
      player.jumpHold = 0.14;
    }
    input.jumpQueued = false;
    if (input.jump && player.vy < -120 && player.jumpHold > 0) {
      player.vy -= 430 * dt;
      player.jumpHold -= dt;
    } else if (!input.jump) player.jumpHold = 0;
    const oldFeet = player.feet;
    player.vy += 1720 * dt;
    player.feet += player.vy * dt;
    let landed = false;
    if (player.vy >= 0) for (const platform of platforms) {
      if (oldFeet <= platform.y && player.feet >= platform.y && player.x + 12 > platform.x && player.x - 12 < platform.x + platform.w) {
        player.feet = platform.y; player.vy = 0; landed = true; break;
      }
    }
    if (player.feet >= floorY) {
      player.feet = floorY;
      player.vy = 0;
      player.onGround = true;
    } else player.onGround = landed;

    player.attackTime = Math.max(0, player.attackTime - dt);
    player.attackCooldown = Math.max(0, player.attackCooldown - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.attackTime > 0 && player.attackTime <= 0.18 && !player.attackResolved) {
      player.attackResolved = true;
      hitTarget();
    }

    for (const enemy of enemies) {
      if (!enemy.alive) {
        enemy.dead = Math.max(0, enemy.dead - dt);
        continue;
      }
      enemy.hit = Math.max(0, enemy.hit - dt);
      enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      if (enemy.stun > 0) {
        enemy.stun = Math.max(0, enemy.stun - dt);
        enemy.vx *= Math.max(0, 1 - dt * 3.5);
      } else {
        const distance = player.x - enemy.x;
        const chaseSpeed = Math.min(148, 78 + (wave - 1) * 5);
        const desired = Math.abs(distance) < 44 ? 0 : Math.sign(distance) * chaseSpeed;
        enemy.vx += Math.sign(desired - enemy.vx) * Math.min(Math.abs(desired - enemy.vx), 520 * dt);
      }
      enemy.x += enemy.vx * dt;
      enemy.x = Math.max(32, Math.min(width - 32, enemy.x));
      enemy.facing = enemy.x < player.x ? 1 : -1;

      const touching = Math.abs(enemy.x - player.x) < 48 && Math.abs(player.feet - floorY) < 54;
      if (touching && player.invulnerable <= 0 && enemy.attackCooldown <= 0) {
        player.health = Math.max(0, player.health - 5);
        player.invulnerable = 0.88;
        player.vx = (player.x < enemy.x ? -1 : 1) * 360;
        player.vy = -230;
        player.onGround = false;
        enemy.attackCooldown = 1.45;
        hitFlash = 0.14;
        particles.push({ x: player.x, y: player.feet - 74, life: 0.38, text: 'BONKED!' });
        updateHud();
        if (player.health <= 0) finish();
      }
    }

    const waveCleared = enemies.length > 0 && enemies.every(enemy => !enemy.alive);
    enemies = enemies.filter(enemy => enemy.alive || enemy.dead > 0);
    for (const particle of particles) particle.life -= dt;
    particles = particles.filter(particle => particle.life > 0);
    if (waveCleared && waveBreak <= 0) {
      waveBreak = 1.3;
      updateHud();
    }
  }

  function drawCover(image, x, y, destWidth, destHeight) {
    if (!image.complete || !image.naturalWidth) return false;
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const destRatio = destWidth / destHeight;
    let sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight;
    if (sourceRatio > destRatio) {
      sw = image.naturalHeight * destRatio;
      sx = (image.naturalWidth - sw) * 0.5;
    } else {
      sh = image.naturalWidth / destRatio;
      sy = (image.naturalHeight - sh) * 0.5;
    }
    ctx.drawImage(image, sx, sy, sw, sh, x, y, destWidth, destHeight);
    return true;
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    if (!drawCover(arena, 0, 0, width, height)) {
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, '#475b70'); sky.addColorStop(1, '#d88456');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    }
    const floorShade = ctx.createLinearGradient(0, floorY - 72, 0, height);
    floorShade.addColorStop(0, '#26302b00'); floorShade.addColorStop(0.35, '#1c2724aa'); floorShade.addColorStop(1, '#111816ee');
    ctx.fillStyle = floorShade; ctx.fillRect(0, floorY - 72, width, height - floorY + 72);
    ctx.fillStyle = '#e6bb6e'; ctx.globalAlpha = 0.54; ctx.fillRect(0, floorY, width, 2); ctx.globalAlpha = 1;

    for (const p of platforms) {
      ctx.fillStyle = '#382d26'; ctx.fillRect(p.x, p.y, p.w, 12);
      ctx.fillStyle = '#d7a259'; ctx.fillRect(p.x, p.y, p.w, 4);
      ctx.fillStyle = '#f4d28b'; ctx.fillRect(p.x + 8, p.y + 5, Math.max(0, p.w - 16), 2);
    }

    for (const enemy of enemies) drawEnemy(enemy);
    drawHero();
    drawParticles();
    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(222, 86, 67, ${hitFlash * 0.23})`;
      ctx.fillRect(0, 0, width, height);
    }
    if (waveBreak > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.95, waveBreak);
      ctx.fillStyle = '#fff1c7';
      ctx.textAlign = 'center';
      ctx.font = '900 34px Impact, sans-serif';
      ctx.fillText(`WAVE ${wave} CLEAR!`, width * 0.5, height * 0.28);
      ctx.restore();
    }
  }

  function drawEnemy(enemy) {
    const fade = enemy.alive ? 1 : Math.max(0, enemy.dead / 0.38);
    const bob = enemy.alive ? Math.sin(elapsed * 5 + enemy.seed) * 2 : 0;
    const spriteWidth = 74;
    const spriteHeight = 88;
    const top = floorY - spriteHeight + bob;
    ctx.save();
    ctx.globalAlpha = fade;
    if (!enemy.alive) {
      ctx.translate(enemy.x, floorY - spriteHeight / 2);
      ctx.rotate((1 - fade) * 1.9);
      ctx.translate(-enemy.x, -(floorY - spriteHeight / 2));
    }
    if (enemySheet.complete && enemySheet.naturalWidth) {
      const cellWidth = enemySheet.naturalWidth / 5;
      ctx.drawImage(enemySheet, enemy.factionIndex * cellWidth, 0, cellWidth, enemySheet.naturalHeight,
        enemy.x - spriteWidth / 2, top, spriteWidth, spriteHeight);
    } else {
      ctx.fillStyle = enemy.color; ctx.beginPath(); ctx.arc(enemy.x, floorY - 43, 32, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#15191c'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(enemy.x - 14, floorY - 50, 8, 8); ctx.fillRect(enemy.x + 6, floorY - 50, 8, 8);
      ctx.fillStyle = '#172023'; ctx.fillRect(enemy.x - 11, floorY - 48, 4, 5); ctx.fillRect(enemy.x + 9, floorY - 48, 4, 5);
    }
    if (enemy.alive && enemy.hp < enemy.maxHp) {
      ctx.fillStyle = '#242b2c'; ctx.fillRect(enemy.x - 23, top - 5, 46, 5);
      ctx.fillStyle = enemy.color; ctx.fillRect(enemy.x - 22, top - 4, 44 * enemy.hp / enemy.maxHp, 3);
    }
    if (enemy.hit > 0) {
      ctx.globalAlpha = fade * enemy.hit / 0.24 * 0.65;
      ctx.fillStyle = '#fff0c8'; ctx.beginPath(); ctx.arc(enemy.x, floorY - 44, 38, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawHero() {
    const jumping = !player.onGround;
    const moving = player.onGround && Math.abs(player.vx) > 12;
    const bob = moving ? Math.abs(Math.sin(player.walkPhase)) * 3 : Math.sin(elapsed * 3) * 1.2;
    const heightPx = 88;
    const widthPx = 70;
    const top = player.feet - heightPx + bob;
    const alpha = player.invulnerable > 0 && Math.floor(elapsed * 20) % 2 === 0 ? 0.5 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(player.x, top + heightPx * 0.5);
    if (jumping) ctx.rotate(-player.vy * 0.00007);
    const attacking = player.attackTime > 0;
    const pose = attacking ? (player.attackFacing < 0 ? heroSprites.punchLeft : heroSprites.punchRight)
      : moving ? (player.facing < 0 ? heroSprites.left : heroSprites.right)
        : (player.facing < 0 ? heroSprites.left : heroSprites.right);
    if (pose.complete && pose.naturalWidth) {
      const punch = attacking ? Math.max(0, 1 - Math.abs(player.attackTime - 0.16) / 0.14) : 0;
      const spriteWidth = attacking ? 100 + punch * 18 : widthPx;
      ctx.drawImage(pose, -spriteWidth / 2, -heightPx / 2, spriteWidth, heightPx);
      if (!attacking && moving) {
        ctx.fillStyle = '#f1c47b';
        ctx.globalAlpha *= 0.75;
        ctx.fillRect(-12, -heightPx / 2 + 4 + Math.abs(Math.sin(player.walkPhase)) * 3, 8, 3);
      }
    }
    else {
      ctx.fillStyle = '#76513a'; ctx.fillRect(-16, -5, 32, 36);
      ctx.fillStyle = '#e2b487'; ctx.fillRect(-12, -30, 24, 24);
      ctx.fillStyle = '#211e20'; ctx.fillRect(-13, -32, 26, 7); ctx.fillRect(2, -25, 12, 4);
      ctx.fillStyle = '#252329'; ctx.fillRect(-7, -20, 4, 3); ctx.fillRect(5, -20, 4, 3);
      ctx.fillRect(-4, -10, 10, 3);
      ctx.fillStyle = '#252326'; ctx.fillRect(-12, 30, 10, 9); ctx.fillRect(3, 30, 10, 9);
    }
    ctx.restore();

    if (player.attackTime > 0) {
      const progress = 1 - player.attackTime / 0.3;
      const extension = Math.sin(Math.min(1, progress / 0.68) * Math.PI);
      ctx.save();
      ctx.globalAlpha = Math.min(1, extension * 1.5);
      ctx.fillStyle = '#e8bb88';
      ctx.fillRect(player.x + player.attackFacing * 23 - (player.attackFacing < 0 ? 40 + extension * 24 : 0), top + 34, 40 + extension * 24, 10);
      ctx.fillStyle = '#f5d6a7';
      ctx.fillRect(player.x + player.attackFacing * (61 + extension * 24) - (player.attackFacing < 0 ? 8 : 0), top + 32, 12, 14);
      ctx.restore();
    }
  }

  function drawParticles() {
    ctx.save();
    ctx.textAlign = 'left'; ctx.font = 'bold 18px system-ui, sans-serif'; ctx.fillStyle = '#fff1cf';
    ctx.fillText(`SiegSim  ·  WAVE ${wave}  ·  HP ${Math.ceil(player.health)}  ·  ${score}`, 16, 28);
    ctx.restore();
    for (const particle of particles) {
      ctx.globalAlpha = Math.min(1, particle.life * 2.2);
      ctx.fillStyle = '#fff1bb';
      ctx.font = '900 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#211b16'; ctx.shadowBlur = 4;
      ctx.fillText(particle.text, particle.x, particle.y - (0.75 - particle.life) * 46);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    if (gameOver) {
      ctx.fillStyle = '#101719bb'; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#fff1cf'; ctx.textAlign = 'center'; ctx.font = 'bold 38px system-ui, sans-serif';
      ctx.fillText('BONKED!', width / 2, height / 2 - 12);
      ctx.font = 'bold 18px system-ui, sans-serif'; ctx.fillText('Press J or Enter to restart', width / 2, height / 2 + 28);
    }
  }

  function frame(time) {
    const dt = Math.min(0.032, (time - (lastTime || time)) / 1000);
    lastTime = time;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  reset();
  requestAnimationFrame(frame);
})();
