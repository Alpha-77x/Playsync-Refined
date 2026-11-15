const COLORS = ['#ff4757','#2ed573','#1e90ff','#ffa502','#9b59b6','#00d2d3','#ff6b81','#a4b0be'];

export function createGame({ container, players, onScores, onStatus }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });

  const state = {
    players: new Map(), running: false, frame: 0, last: 0,
    round: 1, phase: 'countdown', timer: 3, roundTime: 48,
    hud: null, W: 0, H: 0, powerups: [], particles: [], nextPowerup: 2.5,
    shake: 0
  };

  const scores = () => [...state.players.values()].map(p => ({ id: p.id, score: Math.round(p.score) }));
  const message = (text) => { const e = state.hud?.querySelector('#m'); if (e) e.textContent = text; };
  const phase = (value) => {
    state.phase = value;
    const e = state.hud?.querySelector('#p');
    if (e) e.textContent = value === 'playing' ? `${Math.max(0, Math.ceil(state.timer))}s` : value.toUpperCase();
  };

  function makeHud() {
    const h = document.createElement('div');
    h.className = 'game-hud';
    h.innerHTML = '<div class="game-hud-top"><span class="game-pill" id="r">ROUND 1/3</span><span class="game-pill" id="p">GET READY</span></div><div class="game-hud-message" id="m">GET READY</div>';
    container.appendChild(h);
    state.hud = h;
  }

  function resize() {
    state.W = container.clientWidth || innerWidth;
    state.H = container.clientHeight || innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.floor(state.W * dpr));
    canvas.height = Math.max(1, Math.floor(state.H * dpr));
    canvas.style.width = `${state.W}px`;
    canvas.style.height = `${state.H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnPos(slot) {
    const pos = [[.12,.15],[.88,.15],[.12,.85],[.88,.85],[.35,.15],[.65,.15],[.35,.85],[.65,.85]][(slot - 1) % 8];
    return { x: pos[0] * state.W, y: pos[1] * state.H };
  }

  function add(id, data) {
    const pos = spawnPos(data.slot || 1);
    state.players.set(id, {
      ...data,
      color: data.color || COLORS[(data.slot - 1) % COLORS.length],
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      score: Number(data.score) || 0, alive: true,
      dash: 0, shield: 0, boost: 0,
      input: { x: 0, y: 0 }
    });
  }

  function remove(id) { state.players.delete(id); }

  function spawnParticle(x, y, color, count = 12, speed = 100) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (.35 + Math.random() * .9);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .35 + Math.random() * .5, color });
    }
  }

  function resetRound() {
    state.players.forEach(p => {
      const pos = spawnPos(p.slot);
      p.x = pos.x; p.y = pos.y; p.vx = 0; p.vy = 0;
      p.alive = true; p.dash = 0; p.shield = 0; p.boost = 0;
      p.input = { x: 0, y: 0 };
    });
    state.powerups = [];
    state.particles = [];
    state.nextPowerup = 2.2;
    state.timer = state.roundTime;
    phase('countdown');
    message('GET READY');
    const r = state.hud?.querySelector('#r');
    if (r) r.textContent = `ROUND ${state.round}/3`;
  }

  function eliminate(p) {
    if (!p.alive) return;
    p.alive = false;
    p.score += 25;
    spawnParticle(p.x, p.y, p.color, 22, 180);
    state.shake = Math.min(10, state.shake + 6);
    onScores(scores());
    const alive = [...state.players.values()].filter(x => x.alive);
    if (alive.length <= 1) {
      if (alive[0]) {
        alive[0].score += 100;
        message(`${alive[0].name} WINS ROUND ${state.round}`);
      } else {
        message('NO SURVIVOR');
      }
      onScores(scores());
      state.timer = 3.2;
      phase('round-over');
    }
  }

  function action(id, a) {
    const p = state.players.get(id);
    if (!p || !p.alive) return;

    if (typeof a === 'string' && a.startsWith('MOVE_AXIS:')) {
      const [sx, sy] = a.slice(10).split(',').map(Number);
      const x = Number.isFinite(sx) ? Math.max(-1, Math.min(1, sx)) : 0;
      const y = Number.isFinite(sy) ? Math.max(-1, Math.min(1, sy)) : 0;
      p.input.x = x;
      p.input.y = y;
      return;
    }

    const map = {
      MOVE_UP_START: ['y', -1], MOVE_UP_STOP: ['y', 0],
      MOVE_DOWN_START: ['y', 1], MOVE_DOWN_STOP: ['y', 0],
      MOVE_LEFT_START: ['x', -1], MOVE_LEFT_STOP: ['x', 0],
      MOVE_RIGHT_START: ['x', 1], MOVE_RIGHT_STOP: ['x', 0]
    };
    if (map[a]) {
      p.input[map[a][0]] = map[a][1];
      return;
    }

    if (a === 'ACTION_A_START' && p.dash <= 0 && state.phase === 'playing') {
      const dx = p.input.x, dy = p.input.y;
      const n = Math.hypot(dx, dy) || 1;
      p.vx += (dx / n) * 520;
      p.vy += (dy / n) * 520;
      p.dash = .48;
      spawnParticle(p.x, p.y, p.color, 12, 90);
    }
    if (a === 'ACTION_B_START' && p.shield <= 0 && state.phase === 'playing') {
      p.shield = 1.45;
      spawnParticle(p.x, p.y, '#6de7ff', 18, 80);
    }
  }

  function givePowerup() {
    const types = ['boost', 'shield', 'dash'];
    const type = types[Math.floor(Math.random() * types.length)];
    state.powerups.push({
      x: 80 + Math.random() * Math.max(1, state.W - 160),
      y: 130 + Math.random() * Math.max(1, state.H - 200),
      type,
      ttl: 12
    });
  }

  function update(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(.06, dt); p.vy *= Math.pow(.06, dt);
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    state.shake = Math.max(0, state.shake - dt * 14);

    if (state.phase === 'countdown') {
      state.timer -= dt;
      message(state.timer > 0 ? String(Math.ceil(state.timer)) : 'GO!');
      if (state.timer <= 0) {
        state.timer = state.roundTime;
        phase('playing');
      }
      return;
    }

    if (state.phase === 'round-over') {
      state.timer -= dt;
      if (state.timer <= 0) {
        if (state.round >= 3) {
          const winner = [...state.players.values()].sort((a,b) => b.score - a.score)[0];
          message(winner ? `${winner.name} WINS THE MATCH` : 'MATCH COMPLETE');
          phase('finished'); onStatus('finished');
        } else {
          state.round += 1;
          resetRound();
        }
      }
      return;
    }

    if (state.phase !== 'playing') return;

    state.timer -= dt;
    if (state.timer <= 0) {
      const alive = [...state.players.values()].filter(x => x.alive);
      if (alive.length) {
        alive.sort((a,b) => Math.hypot(b.vx,b.vy) - Math.hypot(a.vx,a.vy));
        alive[0].score += 75;
        message(`${alive[0].name} WINS ON TIME`);
        onScores(scores());
      }
      state.timer = 3.2;
      phase('round-over');
      return;
    }

    state.nextPowerup -= dt;
    if (state.nextPowerup <= 0 && state.powerups.length < 2) {
      givePowerup();
      state.nextPowerup = 8 + Math.random() * 4;
    }

    for (const p of state.players.values()) {
      if (!p.alive) continue;
      const inputMag = Math.hypot(p.input.x, p.input.y);
      const accel = p.dash > 0 ? 1450 : (p.boost > 0 ? 1100 : 900);
      if (inputMag > .05) {
        p.vx += p.input.x * accel * dt;
        p.vy += p.input.y * accel * dt;
      }
      p.vx *= Math.pow(.025, dt);
      p.vy *= Math.pow(.025, dt);
      const speed = Math.hypot(p.vx, p.vy);
      const max = p.dash > 0 ? 600 : (p.boost > 0 ? 420 : 300);
      if (speed > max) { p.vx = p.vx / speed * max; p.vy = p.vy / speed * max; }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.dash = Math.max(0, p.dash - dt);
      p.shield = Math.max(0, p.shield - dt);
      p.boost = Math.max(0, p.boost - dt);

      if (p.x < 40 || p.x > state.W - 40 || p.y < 105 || p.y > state.H - 38) eliminate(p);

      for (let i = state.powerups.length - 1; i >= 0; i--) {
        const u = state.powerups[i];
        u.ttl -= dt;
        if (u.ttl <= 0) { state.powerups.splice(i, 1); continue; }
        if (Math.hypot(p.x - u.x, p.y - u.y) < 32) {
          if (u.type === 'boost') p.boost = 4;
          if (u.type === 'shield') p.shield = 4;
          if (u.type === 'dash') p.dash = .85;
          spawnParticle(u.x, u.y, u.type === 'shield' ? '#6de7ff' : '#ffd166', 20, 130);
          state.powerups.splice(i, 1);
        }
      }
    }

    const list = [...state.players.values()];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (!a.alive || !b.alive) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .001, min = 54;
      if (d < min) {
        const nx = dx / d, ny = dy / d, push = (min - d) * .5;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        const impulse = Math.max(120, Math.abs(relative) * 1.4);
        if (a.shield <= 0) { a.vx -= nx * impulse; a.vy -= ny * impulse; }
        if (b.shield <= 0) { b.vx += nx * impulse; b.vy += ny * impulse; }
        state.shake = Math.min(8, state.shake + 1.5);
      }
    }

    phase('playing');
  }

  function render() {
    const w = state.W, h = state.H;
    ctx.clearRect(0, 0, w, h);
    const shakeX = (Math.random() - .5) * state.shake;
    const shakeY = (Math.random() - .5) * state.shake;
    ctx.save(); ctx.translate(shakeX, shakeY);

    ctx.fillStyle = '#04111c'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w*.5, h*.4, 40, w*.5, h*.45, Math.max(w,h)*.75);
    g.addColorStop(0, 'rgba(0,242,255,.15)'); g.addColorStop(1, 'rgba(3,6,12,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);

    ctx.fillStyle = '#0c1e2f'; ctx.fillRect(14, 80, w - 28, h - 94);
    ctx.strokeStyle = 'rgba(109,231,255,.45)'; ctx.lineWidth = 3; ctx.strokeRect(14,80,w-28,h-94);

    ctx.strokeStyle='rgba(109,231,255,.035)'; ctx.lineWidth=1;
    for(let x=18;x<w-18;x+=56){ctx.beginPath();ctx.moveTo(x,80);ctx.lineTo(x,h-14);ctx.stroke()}
    for(let y=88;y<h-14;y+=56){ctx.beginPath();ctx.moveTo(14,y);ctx.lineTo(w-14,y);ctx.stroke()}

    for (const u of state.powerups) {
      const pulse = 1 + Math.sin(performance.now()/160) * .08;
      const colors = { boost:'#ffd166', shield:'#6de7ff', dash:'#ff6b81' };
      ctx.save(); ctx.translate(u.x,u.y); ctx.scale(pulse,pulse);
      ctx.shadowBlur=20; ctx.shadowColor=colors[u.type]; ctx.fillStyle=colors[u.type];
      ctx.beginPath(); ctx.arc(0,0,15,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      ctx.fillStyle='#07111f'; ctx.font='800 11px Inter'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(u.type === 'shield' ? 'S' : u.type === 'boost' ? 'B' : 'D', 0, 1); ctx.restore();
    }

    for (const p of state.particles) { ctx.globalAlpha = Math.max(0, p.life * 1.6); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,3,3); }
    ctx.globalAlpha = 1;

    for (const p of state.players.values()) {
      if (!p.alive) { ctx.fillStyle='rgba(255,71,87,.55)'; ctx.font='700 12px Inter'; ctx.textAlign='center'; ctx.fillText('OUT',p.x,p.y); continue; }
      ctx.save(); ctx.translate(p.x,p.y);
      const speed = Math.hypot(p.vx,p.vy);
      if (speed > 40) { ctx.globalAlpha=.22; ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(-p.vx*.025,-p.vy*.025,28,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
      ctx.shadowBlur=18; ctx.shadowColor=p.color; ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      if(p.shield>0){ctx.strokeStyle='#6de7ff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,30,0,Math.PI*2);ctx.stroke()}
      ctx.restore();
      ctx.fillStyle='#fff'; ctx.font='700 13px Inter'; ctx.textAlign='center'; ctx.fillText(`${p.name} · ${Math.round(p.score)}`,p.x,p.y-35);
    }
    ctx.restore();
  }

  function loop() {
    if (!state.running) return;
    const now = performance.now();
    const dt = Math.min((now - state.last) / 1000, .05);
    state.last = now;
    update(dt); render();
    state.frame = requestAnimationFrame(loop);
  }

  function start() {
    resize(); makeHud();
    state.round = 1; state.running = true; state.last = performance.now();
    resetRound(); onStatus('running'); loop();
  }

  function stop() {
    state.running = false; cancelAnimationFrame(state.frame);
    state.hud?.remove(); canvas.remove(); state.players.clear(); state.powerups=[]; state.particles=[];
  }

  return { start, stop, resize, handleAction: action, addPlayer: (id,d) => state.running && add(id,d), removePlayer: remove, getScores: scores };
}
