(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const BASE_WIDTH = 1024;
  const enemySheet = new Image();
  enemySheet.src = 'assets/enemy-sheet.png';
  const arena = new Image();
  arena.src = 'assets/arena-dusk.png';
  const heroSprites = { ready: new Image(), fire: new Image() };
  heroSprites.ready.src = 'assets/hero-ready.png';
  heroSprites.fire.src = 'assets/hero-fire.png';
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
  let hazards = [];
  let projectiles = [];

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
    projectiles = [];
    player = {
      x: width * 0.27, feet: floorY, vx: 0, vy: 0, health: 100,
      facing: 1, onGround: true, coyote: 0, jumpHold: 0,
      attackTime: 0, attackCooldown: 0, attackFacing: 1,
      invulnerable: 0, walkPhase: 0
    };
    createPlatforms();
    spawnWave();
    updateHud();
  }

  function spawnWave() {
    const count = Math.min(12, 3 + Math.floor((wave - 1) * 0.7));
    enemies = [];
    createPlatforms();
    createHazards();
    const spawnSlots = wave < 4
      ? [0.55, 0.72, 0.88, 0.95, 0.62, 0.8, 0.5, 0.9, 0.66, 0.83, 0.96, 0.58]
      : [0.08, 0.92, 0.23, 0.77, 0.36, 0.64, 0.14, 0.86, 0.04, 0.96, 0.3, 0.7];
    for (let i = 0; i < count; i++) {
      const faction = factions[(wave - 1 + i) % factions.length];
      const x = width * spawnSlots[i % spawnSlots.length];
      enemies.push({
        x, feet: floorY, vy: 0, onGround: true, jumpCooldown: 0.8 + Math.random() * 3, jumpTargetX: null,
        vx: 0, hp: 2 + Math.floor((wave - 1) / 5),
        maxHp: 2 + Math.floor((wave - 1) / 5),
        faction: faction.name, factionIndex: factions.indexOf(faction),
        color: faction.color, hit: 0, hitCooldown: 0, stun: 0, dead: 0,
        alive: true, facing: x < player.x ? 1 : -1,
        seed: i * 1.7 + wave * 0.8, attackCooldown: 1.25 + i * 0.42,
        shooter: wave >= 10 && (i % (wave >= 15 ? 2 : 3) === 0),
        shotCooldown: 1.8 + Math.random() * 1.8
      });
    }
    waveBreak = 0;
    updateHud();
  }

  function createPlatforms() {
    const count = 2 + Math.floor(Math.random() * 4);
    const usableHeight = Math.min(65, Math.max(40, floorY - 220));
    platforms = [];
    for (let i = 0; i < count; i++) {
      const w = 110 + Math.random() * 115;
      const x = 55 + Math.random() * Math.max(1, width - w - 110);
      const y = floorY - 65 - Math.random() * usableHeight;
      if (platforms.every(p => Math.abs(p.x - x) > 95 || Math.abs(p.y - y) > 70)) platforms.push({ x, y, w });
    }
  }

  function createHazards() {
    hazards = [];
    if (wave < 5) return;
    const count = Math.min(4, Math.floor(wave / 5));
    for (let i = 0; i < count; i++) {
      const onPlatform = platforms.length && Math.random() < 0.55;
      const platform = onPlatform ? platforms[Math.floor(Math.random() * platforms.length)] : null;
      const y = platform ? platform.y : floorY;
      const hazardWidth = 74 + Math.random() * 68;
      const x = platform
        ? platform.x + 8 + Math.random() * Math.max(1, platform.w - hazardWidth - 16)
        : 60 + Math.random() * Math.max(1, BASE_WIDTH - hazardWidth - 120);
      hazards.push({ x, y, width: hazardWidth, damage: 12 });
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
    player.attackTime = 0.26;
    player.attackCooldown = 0.38;
    const muzzleX = player.x + player.facing * 72;
    const muzzleY = player.feet - 55;
    projectiles.push({ x: muzzleX, y: muzzleY, vx: player.facing * 620, vy: -10, life: 1.35, owner: 'player', seed: elapsed });
    for (let i = 0; i < 5; i++) particles.push({ x: muzzleX, y: muzzleY, vx: player.facing * (30 + Math.random() * 130), vy: -100 + Math.random() * 170, life: 0.18 + Math.random() * 0.18, text: '', ember: true });
    player.vx *= 0.86;
  }

  function hitEnemy(enemy, direction) {
    enemy.hp -= 1;
    enemy.hit = 0.24;
    enemy.hitCooldown = 0.28;
    enemy.stun = 0.3;
    enemy.vx = direction * 260;
    score += 100;
    particles.push({ x: enemy.x, y: enemy.feet - 66, life: 0.55, text: enemy.hp <= 0 ? 'PLOP!' : 'TOAST!' });
    if (enemy.hp <= 0) {
      enemy.alive = false;
      enemy.dead = 0.38;
      score += 250 + wave * 20;
      particles.push({ x: enemy.x, y: enemy.feet - 108, life: 0.75, text: enemy.faction });
    }
    updateHud();
  }

  function hurtPlayer(damage, direction) {
    if (player.invulnerable > 0) return;
    player.health = Math.max(0, player.health - damage);
    player.invulnerable = 0.88;
    player.vx = direction * 300;
    player.vy = -230;
    player.onGround = false;
    hitFlash = 0.14;
    if (player.health <= 0) finish();
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
    for (const enemy of enemies) {
      if (!enemy.alive) {
        enemy.dead = Math.max(0, enemy.dead - dt);
        continue;
      }
      enemy.hit = Math.max(0, enemy.hit - dt);
      enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      enemy.jumpCooldown -= dt;
      enemy.shotCooldown -= dt;
      if (enemy.stun > 0) {
        enemy.stun = Math.max(0, enemy.stun - dt);
        enemy.vx *= Math.max(0, 1 - dt * 3.5);
      } else {
        const distance = player.x - enemy.x;
        const chaseSpeed = Math.min(148, 78 + (wave - 1) * 5);
        const desired = Math.abs(distance) < 44 ? 0 : Math.sign(distance) * chaseSpeed;
        if (wave >= 3 && enemy.onGround && enemy.jumpCooldown <= 0) {
          const reachable = platforms.filter(p => p.y < enemy.feet - 60 && Math.abs((p.x + p.w / 2) - enemy.x) < 165);
          if (reachable.length) {
            const target = reachable.reduce((best, p) => Math.abs(p.x + p.w / 2 - player.x) < Math.abs(best.x + best.w / 2 - player.x) ? p : best);
            enemy.jumpTargetX = target.x + target.w / 2;
            enemy.vx = Math.sign(enemy.jumpTargetX - enemy.x) * Math.min(220, chaseSpeed + 80);
            enemy.vy = -720;
            enemy.onGround = false;
            enemy.jumpCooldown = 2.2 + Math.random() * 2.8;
          }
        }
        if (enemy.onGround) {
          enemy.jumpTargetX = null;
          enemy.vx += Math.sign(desired - enemy.vx) * Math.min(Math.abs(desired - enemy.vx), 520 * dt);
        } else if (enemy.jumpTargetX !== null) {
          const steer = Math.sign(enemy.jumpTargetX - enemy.x) * 220;
          enemy.vx += Math.sign(steer - enemy.vx) * Math.min(Math.abs(steer - enemy.vx), 420 * dt);
        }
      }
      enemy.x += enemy.vx * dt;
      enemy.x = Math.max(32, Math.min(width - 32, enemy.x));
      enemy.facing = enemy.x < player.x ? 1 : -1;

      const enemyOldFeet = enemy.feet;
      enemy.vy += 1720 * dt;
      enemy.feet += enemy.vy * dt;
      let enemyLanded = false;
      if (enemy.vy >= 0) for (const platform of platforms) {
        if (enemyOldFeet <= platform.y && enemy.feet >= platform.y && enemy.x + 24 > platform.x && enemy.x - 24 < platform.x + platform.w) {
          enemy.feet = platform.y; enemy.vy = 0; enemyLanded = true; break;
        }
      }
      if (enemy.feet >= floorY) { enemy.feet = floorY; enemy.vy = 0; enemy.onGround = true; }
      else enemy.onGround = enemyLanded;

      if (enemy.shooter && enemy.shotCooldown <= 0) {
        const dx = player.x - enemy.x, dy = (player.feet - 52) - (enemy.feet - 48);
        const length = Math.max(1, Math.hypot(dx, dy));
        const speed = Math.min(390, 275 + wave * 3);
        projectiles.push({ x: enemy.x + enemy.facing * 34, y: enemy.feet - 48, vx: dx / length * speed, vy: dy / length * speed, life: 2.8, owner: 'enemy', seed: elapsed });
        enemy.shotCooldown = Math.max(0.9, 2.8 - wave * 0.055) + Math.random() * 0.8;
      }

      const touching = Math.abs(enemy.x - player.x) < 48 && Math.abs((enemy.feet - 42) - (player.feet - 45)) < 64;
      if (touching && player.invulnerable <= 0 && enemy.attackCooldown <= 0) {
        hurtPlayer(5, player.x < enemy.x ? -1 : 1);
        enemy.attackCooldown = 1.45;
        particles.push({ x: player.x, y: player.feet - 74, life: 0.38, text: 'BONKED!' });
        updateHud();
      }
    }

    for (const hazard of hazards) {
      if (player.onGround && player.x + 16 > hazard.x && player.x - 16 < hazard.x + hazard.width && Math.abs(player.feet - hazard.y) < 13 && player.invulnerable <= 0) {
        hurtPlayer(hazard.damage, player.x < hazard.x + hazard.width / 2 ? -1 : 1);
        particles.push({ x: player.x, y: player.feet - 30, life: 0.5, text: 'OUCH!' });
      }
    }

    for (const shot of projectiles) {
      shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
      if (shot.owner === 'player') {
        const target = enemies.find(enemy => enemy.alive && Math.abs(shot.x - enemy.x) < 34 && Math.abs(shot.y - (enemy.feet - 44)) < 40);
        if (target) { hitEnemy(target, Math.sign(shot.vx)); shot.life = 0; }
      } else if (Math.abs(shot.x - player.x) < 24 && Math.abs(shot.y - (player.feet - 50)) < 30) {
        hurtPlayer(8, shot.vx < 0 ? -1 : 1);
        particles.push({ x: player.x, y: player.feet - 50, life: 0.4, text: 'PFFT!' });
        shot.life = 0;
      }
    }
    projectiles = projectiles.filter(shot => shot.life > 0 && shot.x > -30 && shot.x < width + 30 && shot.y > -30 && shot.y < height + 30);

    const waveCleared = enemies.length > 0 && enemies.every(enemy => !enemy.alive);
    enemies = enemies.filter(enemy => enemy.alive || enemy.dead > 0);
    for (const particle of particles) {
      particle.life -= dt;
      if (particle.ember) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 360 * dt; }
    }
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
    drawHazards();

    for (const enemy of enemies) drawEnemy(enemy);
    drawHero();
    drawProjectiles();
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
    const top = enemy.feet - spriteHeight + bob;
    ctx.save();
    ctx.globalAlpha = fade;
    if (!enemy.alive) {
      ctx.translate(enemy.x, enemy.feet - spriteHeight / 2);
      ctx.rotate((1 - fade) * 1.9);
      ctx.translate(-enemy.x, -(enemy.feet - spriteHeight / 2));
    }
    if (enemySheet.complete && enemySheet.naturalWidth) {
      const cellWidth = enemySheet.naturalWidth / 5;
      ctx.drawImage(enemySheet, enemy.factionIndex * cellWidth, 0, cellWidth, enemySheet.naturalHeight,
        enemy.x - spriteWidth / 2, top, spriteWidth, spriteHeight);
    } else {
      ctx.fillStyle = enemy.color; ctx.beginPath(); ctx.arc(enemy.x, enemy.feet - 43, 32, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#15191c'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(enemy.x - 14, enemy.feet - 50, 8, 8); ctx.fillRect(enemy.x + 6, enemy.feet - 50, 8, 8);
      ctx.fillStyle = '#172023'; ctx.fillRect(enemy.x - 11, enemy.feet - 48, 4, 5); ctx.fillRect(enemy.x + 9, enemy.feet - 48, 4, 5);
    }
    if (enemy.alive && enemy.shooter) {
      ctx.fillStyle = '#352a25'; ctx.fillRect(enemy.x + enemy.facing * 13 - (enemy.facing < 0 ? 25 : 0), enemy.feet - 48, 25, 8);
      ctx.fillStyle = '#f3b467'; ctx.fillRect(enemy.x + enemy.facing * 34 - (enemy.facing < 0 ? 4 : 0), enemy.feet - 46, 5, 4);
    }
    if (enemy.alive && enemy.hp < enemy.maxHp) {
      ctx.fillStyle = '#242b2c'; ctx.fillRect(enemy.x - 23, top - 5, 46, 5);
      ctx.fillStyle = enemy.color; ctx.fillRect(enemy.x - 22, top - 4, 44 * enemy.hp / enemy.maxHp, 3);
    }
    if (enemy.hit > 0) {
      ctx.globalAlpha = fade * enemy.hit / 0.24 * 0.65;
      ctx.fillStyle = '#fff0c8'; ctx.beginPath(); ctx.arc(enemy.x, enemy.feet - 44, 38, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawHero() {
    const jumping = !player.onGround;
    const moving = player.onGround && Math.abs(player.vx) > 12;
    const bob = moving ? Math.abs(Math.sin(player.walkPhase)) * 3 : Math.sin(elapsed * 3) * 1.2;
    const heightPx = 105;
    const top = player.feet - heightPx + bob;
    const alpha = player.invulnerable > 0 && Math.floor(elapsed * 20) % 2 === 0 ? 0.5 : 1;
    const facing = player.attackTime > 0 ? player.attackFacing : player.facing;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(player.x, top + heightPx * 0.5);
    const attacking = player.attackTime > 0;
    const pose = attacking ? heroSprites.fire : heroSprites.ready;
    const spriteHeight = attacking ? 96 : heightPx;
    const spriteWidth = pose.naturalHeight ? spriteHeight * pose.naturalWidth / pose.naturalHeight : 70;
    ctx.scale(facing, 1);
    if (jumping) ctx.rotate(-player.vy * 0.00007);
    if (pose.complete && pose.naturalWidth) ctx.drawImage(pose, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
    else {
      ctx.fillStyle = '#76513a'; ctx.fillRect(-20, -8, 40, 48);
      ctx.fillStyle = '#e2b487'; ctx.fillRect(-22, -52, 44, 42);
      ctx.fillStyle = '#1a1714'; ctx.fillRect(-20, -56, 42, 12);
    }
    if (moving && !attacking) {
      const step = Math.sin(player.walkPhase) * 4;
      ctx.fillStyle = '#59402a'; ctx.fillRect(-14 + step, spriteHeight / 2 - 9, 12, 6); ctx.fillRect(2 - step, spriteHeight / 2 - 5, 13, 6);
    }
    ctx.restore();

    if (attacking) {
      const muzzleX = player.x + facing * (spriteWidth / 2 + 2);
      const muzzleY = player.feet - 55;
      const flicker = 0.72 + Math.sin(elapsed * 77) * 0.2;
      ctx.save();
      ctx.globalAlpha = Math.min(1, player.attackTime / 0.1) * flicker;
      ctx.fillStyle = '#ff7738'; ctx.beginPath(); ctx.ellipse(muzzleX, muzzleY, 18, 13, facing * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe58a'; ctx.beginPath(); ctx.ellipse(muzzleX + facing * 5, muzzleY, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawHazards() {
    for (const hazard of hazards) {
      const baseY = hazard.y - 4;
      ctx.strokeStyle = '#c5c0a8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(hazard.x, baseY); ctx.lineTo(hazard.x + hazard.width, baseY); ctx.stroke();
      ctx.strokeStyle = '#e6d2a0'; ctx.lineWidth = 2;
      for (let x = hazard.x + 7; x < hazard.x + hazard.width - 4; x += 18) {
        ctx.beginPath(); ctx.moveTo(x - 4, baseY - 7); ctx.lineTo(x + 3, baseY + 6); ctx.lineTo(x + 8, baseY - 7); ctx.stroke();
      }
      ctx.fillStyle = '#c93e35'; ctx.fillRect(hazard.x, baseY + 7, hazard.width, 3);
    }
  }

  function drawProjectiles() {
    for (const shot of projectiles) {
      ctx.save();
      if (shot.owner === 'player') {
        const flicker = 0.8 + Math.sin(elapsed * 50 + shot.seed) * 0.2;
        ctx.globalAlpha = flicker;
        ctx.fillStyle = '#ff6d33'; ctx.beginPath(); ctx.ellipse(shot.x - Math.sign(shot.vx) * 6, shot.y, 14, 7, Math.atan2(shot.vy, shot.vx), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff0a0'; ctx.beginPath(); ctx.arc(shot.x, shot.y, 5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#4bc1ce'; ctx.beginPath(); ctx.arc(shot.x, shot.y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e9fbdf'; ctx.fillRect(shot.x - 2, shot.y - 2, 4, 4);
      }
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
      if (particle.ember) {
        ctx.fillStyle = '#ff9a45'; ctx.fillRect(particle.x, particle.y, 4, 4);
        continue;
      }
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
