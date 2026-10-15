(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const width = 1024;
  const height = 500;
  const floorY = 480;
  const images = {};
  const files = {
    playerLeft: 'assets/player-left.png',
    playerRight: 'assets/player-right.png',
    playerAttackLeft: 'assets/player-attack-left.png',
    playerAttackRight: 'assets/player-attack-right.png',
    enemyLeft: 'assets/enemy-left.png',
    enemyRight: 'assets/enemy-right.png',
    ground: 'assets/ground.png',
    flag: 'assets/flag.png',
    barrier: 'assets/barrier.png'
  };
  for (const [name, src] of Object.entries(files)) {
    const image = new Image();
    image.src = src;
    images[name] = image;
  }

  const input = { left: false, right: false, jump: false, attackLeft: false, attackRight: false };
  const ui = {
    message: document.getElementById('message'),
    healthFill: document.getElementById('health-fill'),
    healthTrack: document.querySelector('.health-track'),
    healthValue: document.getElementById('health-value'),
    targetValue: document.getElementById('target-value'),
    overlay: document.getElementById('overlay'),
    overlayKicker: document.getElementById('overlay-kicker'),
    overlayTitle: document.getElementById('overlay-title'),
    overlayCopy: document.getElementById('overlay-copy')
  };

  let player;
  let enemies;
  let gameOver = false;
  let victory = false;
  let lastTime = 0;
  let elapsed = 0;
  let hitFlash = 0;
  let particles = [];

  function reset() {
    player = {
      x: 93, feet: floorY, vx: 0, vy: 0, health: 100, facing: 1,
      onGround: true, coyote: 0.1, jumpHold: 0, attackTime: 0,
      attackCooldown: 0, attackFacing: 1, swingHit: false,
      invulnerable: 0, walkPhase: 0
    };
    enemies = [
      { x: 480, vx: 85, hp: 3, maxHp: 3, hit: 0, hitCooldown: 0, dead: 0, alive: true, facing: 1, seed: 0.2 },
      { x: 576, vx: -75, hp: 3, maxHp: 3, hit: 0, hitCooldown: 0, dead: 0, alive: true, facing: -1, seed: 2.4 },
      { x: 672, vx: 90, hp: 3, maxHp: 3, hit: 0, hitCooldown: 0, dead: 0, alive: true, facing: 1, seed: 4.1 }
    ];
    gameOver = false;
    victory = false;
    hitFlash = 0;
    particles = [];
    ui.overlay.classList.add('hidden');
    ui.message.textContent = 'Clear the arena: 3 balls remain';
    updateHud();
  }

  function updateHud() {
    const alive = enemies.filter(enemy => enemy.alive).length;
    ui.healthFill.style.width = `${Math.max(0, player.health)}%`;
    ui.healthFill.style.background = player.health < 30 ? 'linear-gradient(90deg,#be4c43,#e57c52)' : 'linear-gradient(90deg,#d36b51,#e8ad54)';
    ui.healthValue.textContent = String(Math.ceil(player.health));
    ui.healthTrack.setAttribute('aria-valuenow', String(Math.ceil(player.health)));
    ui.targetValue.innerHTML = `${alive} <i>/ 3</i>`;
    if (!gameOver) ui.message.textContent = alive === 1 ? 'One target left — finish the round' : `Clear the arena: ${alive} balls remain`;
  }

  function setInput(name, down) {
    if (name in input) input[name] = down;
  }

  const keyMap = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyQ: 'attackLeft', KeyE: 'attackRight'
  };
  window.addEventListener('keydown', event => {
    const action = keyMap[event.code];
    if (!action) return;
    event.preventDefault();
    setInput(action, true);
  });
  window.addEventListener('keyup', event => {
    const action = keyMap[event.code];
    if (action) setInput(action, false);
  });
  window.addEventListener('blur', () => Object.keys(input).forEach(key => setInput(key, false)));

  document.querySelectorAll('[data-hold]').forEach(button => {
    const action = button.dataset.hold;
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setInput(action, true);
    });
    const release = event => { event.preventDefault(); setInput(action, false); };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', () => setInput(action, false));
  });

  function startAttack(direction) {
    if (player.attackCooldown > 0) return;
    player.attackFacing = direction;
    player.facing = direction;
    player.attackTime = 0.19;
    player.attackCooldown = 0.39;
    player.swingHit = false;
    player.vx *= 0.72;
  }

  function hitTargets() {
    if (player.attackTime <= 0 || player.swingHit || player.attackTime > 0.13) return;
    player.swingHit = true;
    const direction = player.attackFacing;
    for (const enemy of enemies) {
      if (!enemy.alive || enemy.hitCooldown > 0) continue;
      const dx = enemy.x - player.x;
      const verticalDistance = Math.abs((floorY - 32) - (player.feet - 38));
      if (dx * direction < 4 || Math.abs(dx) > 94 || verticalDistance > 44) continue;
      enemy.hp -= 1;
      enemy.hit = 0.22;
      enemy.hitCooldown = 0.3;
      enemy.vx = direction * 135;
      particles.push({ x: enemy.x, y: floorY - 56, life: 0.48, text: enemy.hp <= 0 ? 'DOWN!' : 'HIT!' });
      if (enemy.hp <= 0) {
        enemy.alive = false;
        enemy.dead = 0.42;
      }
    }
    updateHud();
    if (enemies.every(enemy => !enemy.alive)) finish(true);
  }

  function finish(won) {
    if (gameOver) return;
    gameOver = true;
    victory = won;
    ui.overlay.classList.remove('hidden');
    ui.overlayKicker.textContent = won ? 'ROUND COMPLETE' : 'ROUND OVER';
    ui.overlayTitle.textContent = won ? 'Arena cleared' : 'You were overwhelmed';
    ui.overlayCopy.textContent = won ? 'All three enemy balls are down. The arena is yours.' : 'The balls pushed you back. Try again with better timing.';
    ui.message.textContent = won ? 'All targets cleared' : 'Round over';
  }

  function update(dt) {
    elapsed += dt;
    hitFlash = Math.max(0, hitFlash - dt);
    if (gameOver) return;
    const direction = Number(input.right) - Number(input.left);
    const acceleration = player.onGround ? 1850 : 1160;
    if (direction) {
      player.vx += direction * acceleration * dt;
      player.facing = direction;
    } else {
      const drag = player.onGround ? 2100 : 520;
      player.vx -= Math.sign(player.vx) * Math.min(Math.abs(player.vx), drag * dt);
    }
    player.vx = Math.max(-250, Math.min(250, player.vx));
    player.x = Math.max(28, Math.min(width - 28, player.x + player.vx * dt));
    if (Math.abs(player.vx) > 8) player.walkPhase += dt * 12;

    player.coyote = player.onGround ? 0.11 : Math.max(0, player.coyote - dt);
    if (input.jump && player.coyote > 0) {
      player.vy = -560;
      player.onGround = false;
      player.coyote = 0;
      player.jumpHold = 0.15;
    }
    if (input.jump && player.vy < -150 && player.jumpHold > 0) {
      player.vy -= 520 * dt;
      player.jumpHold -= dt;
    } else if (!input.jump) {
      player.jumpHold = 0;
    }
    player.vy += 1550 * dt;
    player.feet += player.vy * dt;
    if (player.feet >= floorY) {
      player.feet = floorY;
      player.vy = 0;
      player.onGround = true;
    } else player.onGround = false;

    player.attackTime = Math.max(0, player.attackTime - dt);
    player.attackCooldown = Math.max(0, player.attackCooldown - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (input.attackLeft) startAttack(-1);
    else if (input.attackRight) startAttack(1);
    hitTargets();

    for (const enemy of enemies) {
      if (!enemy.alive) {
        enemy.dead = Math.max(0, enemy.dead - dt);
        continue;
      }
      enemy.hit = Math.max(0, enemy.hit - dt);
      enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
      const patrol = Math.sin(elapsed * 0.8 + enemy.seed);
      if (Math.abs(enemy.vx) < 100) enemy.vx = patrol >= 0 ? 80 : -80;
      enemy.x += enemy.vx * dt;
      if (enemy.x < 370 || enemy.x > 936) enemy.vx *= -1;
      enemy.facing = enemy.vx >= 0 ? 1 : -1;

      const close = Math.abs(enemy.x - player.x) < 45 && Math.abs(player.feet - floorY) < 28;
      if (close && player.invulnerable <= 0) {
        player.health = Math.max(0, player.health - 12);
        player.invulnerable = 0.82;
        player.vx = (player.x < enemy.x ? -1 : 1) * 230;
        player.vy = -190;
        player.onGround = false;
        hitFlash = 0.18;
        updateHud();
        if (player.health <= 0) finish(false);
      }
    }
    for (const particle of particles) particle.life -= dt;
    particles = particles.filter(particle => particle.life > 0);
  }

  function drawImage(name, x, y, drawWidth, drawHeight, flip = false, alpha = 1) {
    const image = images[name];
    if (!image || !image.complete || image.naturalWidth === 0) return false;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (flip) {
      ctx.translate(x + drawWidth, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(image, 0, y, drawWidth, drawHeight);
    } else ctx.drawImage(image, x, y, drawWidth, drawHeight);
    ctx.restore();
    return true;
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(0, 0, width, height);

    // Original room decorations and blue floor tiles.
    drawImage('flag', 128, 96, 160, 300);
    drawImage('flag', 800, 96, 160, 300);
    for (let x = 0; x < width; x += 64) drawImage('ground', x, floorY, 86, 32);

    // Very subtle floor guide lines keep the original empty arena readable.
    ctx.fillStyle = '#30383c';
    ctx.fillRect(0, floorY, width, 2);

    for (const enemy of enemies) {
      if (!enemy.alive && enemy.dead <= 0) continue;
      const fade = enemy.alive ? 1 : Math.max(0, enemy.dead / 0.42);
      const bob = enemy.alive ? Math.sin(elapsed * 4 + enemy.seed) * 2 : 0;
      const y = floorY - 64 + bob;
      if (!enemy.alive) ctx.save(), ctx.translate(enemy.x, floorY - 32), ctx.rotate((1 - fade) * 1.8), ctx.translate(-enemy.x, -(floorY - 32));
      // Keep a visible countryball on screen even if a hosted PNG fails to load.
      drawEnemyFallback(enemy.x, floorY - 32 + bob, fade);
      drawImage(enemy.facing < 0 ? 'enemy-left' : 'enemy-right', enemy.x - 32, y, 64, 64, false, fade);
      if (enemy.alive && enemy.hp < enemy.maxHp) {
        ctx.fillStyle = '#2a3033'; ctx.fillRect(enemy.x - 22, y - 10, 44, 5);
        ctx.fillStyle = '#e1a448'; ctx.fillRect(enemy.x - 22, y - 10, 44 * enemy.hp / enemy.maxHp, 5);
      }
      if (!enemy.alive) ctx.restore();
      if (enemy.alive && enemy.hit > 0) {
        ctx.globalAlpha = enemy.hit / 0.22 * 0.75;
        ctx.fillStyle = '#fff2d4'; ctx.beginPath(); ctx.arc(enemy.x, floorY - 32, 34, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    const attacking = player.attackTime > 0;
    const sprite = attacking
      ? (player.attackFacing < 0 ? 'playerAttackLeft' : 'playerAttackRight')
      : (player.facing < 0 ? 'playerLeft' : 'playerRight');
    const spriteW = attacking ? 81 : 59;
    const spriteX = player.x - spriteW / 2;
    const spriteY = player.feet - 90 + (player.onGround && Math.abs(player.vx) > 8 ? Math.sin(player.walkPhase) * 2 : 0);
    const playerAlpha = player.invulnerable > 0 && Math.floor(elapsed * 18) % 2 === 0 ? 0.48 : 1;
    drawImage(sprite, spriteX, spriteY, spriteW, 90, false, playerAlpha);

    if (attacking) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, player.attackTime / 0.19) * 0.72;
      ctx.strokeStyle = '#f0c86c'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      const arcX = player.x + player.attackFacing * 43;
      const arcY = player.feet - 43;
      ctx.beginPath();
      ctx.arc(arcX, arcY, 30, player.attackFacing > 0 ? -1.15 : Math.PI + 0.15, player.attackFacing > 0 ? 1.15 : Math.PI - 0.15, player.attackFacing < 0);
      ctx.stroke();
      ctx.restore();
    }

    for (const particle of particles) {
      ctx.globalAlpha = Math.min(1, particle.life * 2.4);
      ctx.fillStyle = '#f5d27e';
      ctx.font = '700 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(particle.text, particle.x, particle.y - (0.48 - particle.life) * 44);
    }
    ctx.globalAlpha = 1;

    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(203, 71, 57, ${hitFlash * 0.22})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawEnemyFallback(x, y, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#d70d19';
    ctx.strokeStyle = '#65141a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f4d84c';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 === 0 ? 10 : 4.5;
      const px = x - 5 + Math.cos(angle) * radius;
      const py = y - 7 + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function frame(time) {
    const dt = Math.min(0.033, (time - (lastTime || time)) / 1000);
    lastTime = time;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  document.getElementById('restart').addEventListener('click', reset);
  document.getElementById('play-again').addEventListener('click', reset);
  reset();
  requestAnimationFrame(frame);
})();
