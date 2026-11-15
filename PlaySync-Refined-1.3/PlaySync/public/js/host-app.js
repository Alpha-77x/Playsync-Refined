import { GAMES, getGame } from '../games/registry.js';

const socket = io();
const players = new Map();
let room = '';
let gameId = GAMES[0].id;
let engine = null;
let running = false;
let overlay = false;

const $ = (id) => document.getElementById(id);
const esc = (value) => {
  const d = document.createElement('div');
  d.textContent = value ?? '';
  return d.innerHTML;
};

function cards() {
  $('games').innerHTML = GAMES.map((g) => `
    <button class="game ${g.id === gameId ? 'sel' : ''}" data-id="${g.id}" style="--accent:${g.accent}">
      <span class="icon">${g.icon}</span>
      <span class="tag">${g.subtitle} · ${g.minPlayers}-${g.maxPlayers} PLAYERS</span>
      <span class="name">${g.title}</span>
      <span class="desc">${g.description}</span>
    </button>
  `).join('');

  document.querySelectorAll('.game').forEach((button) => {
    button.onclick = () => {
      if (running) return;
      gameId = button.dataset.id;
      cards();
      if (room) socket.emit('host_set_game', { roomId: room, gameId });
      render();
    };
  });
}

function render() {
  const roster = [...players.values()].sort((a, b) => a.slot - b.slot);
  $('count').textContent = `${roster.length}/8`;
  $('roster').innerHTML = roster.length
    ? roster.map((p) => `<span class="chip" style="--chip:${p.color}">P${p.slot} · ${esc(p.name)}</span>`).join('')
    : '<span class="empty">Scan the QR code with phones to join.</span>';

  const leaderboard = [...roster].sort((a, b) => (b.score || 0) - (a.score || 0));
  $('leader').innerHTML = leaderboard.length
    ? leaderboard.map((p, i) => `<div class="row"><span>#${i + 1}</span><span style="color:${p.color}">P${p.slot} · ${esc(p.name)}</span><span class="score">${p.score || 0}</span></div>`).join('')
    : '<div class="empty">Waiting for players...</div>';
  $('tlead').innerHTML = leaderboard.length
    ? leaderboard.map((p, i) => `<div class="row"><span>${i + 1}</span><span>${esc(p.name)}</span><span class="score">${p.score || 0}</span></div>`).join('')
    : '<div class="empty">Waiting...</div>';

  launchState();
}

function launchState() {
  const game = getGame(gameId);
  const count = players.size;
  $('launch').disabled = running;
  $('launch').textContent = running
    ? 'MATCH IN PROGRESS'
    : count === 0
      ? `START ${game.title.toUpperCase()} · LOCAL TEST`
      : count === 1
        ? `START ${game.title.toUpperCase()} · 1 PLAYER (TEST MODE)`
        : `START ${game.title.toUpperCase()} · ${count} PLAYERS`;
  $('hint').textContent = count === 0
    ? 'Local test mode: keyboard controls are enabled. Connect a phone for multiplayer.'
    : count === 1
      ? 'Solo test mode: add another phone for multiplayer.'
      : `${count} controllers connected · ${game.title}`;
}

function applyRoomPlayers(list) {
  const next = new Map((list || []).map((p) => [p.id, p]));
  if (running && players.has('__local_test__') && !next.has('__local_test__')) {
    next.set('__local_test__', players.get('__local_test__'));
  }

  if (engine && running) {
    for (const [id, player] of next) {
      if (!players.has(id)) engine.addPlayer?.(id, player);
    }
    for (const id of players.keys()) {
      if (!next.has(id)) engine.removePlayer?.(id);
    }
  }

  players.clear();
  next.forEach((value, key) => players.set(key, value));
  render();
}

async function launch() {
  if (running) return;

  const game = getGame(gameId);
  const localTest = players.size === 0;
  if (localTest) {
    players.set('__local_test__', {
      id: '__local_test__',
      slot: 1,
      name: 'LOCAL TEST',
      color: '#ffffff',
      score: 0,
      test: true
    });
  }

  // Keep the lobby visible until the game has successfully initialized.
  try {
    const module = await import(game.module);
    if (!module?.createGame) throw new Error(`Game module ${game.module} does not export createGame().`);

    engine = module.createGame({
      container: $('stage'),
      players,
      onScores: (scores) => {
        const scoreMap = new Map(scores.map((x) => [x.id, x.score]));
        players.forEach((player) => {
          if (scoreMap.has(player.id)) player.score = scoreMap.get(player.id);
        });
        render();
        const real = scores.filter((x) => x.id !== '__local_test__');
        if (real.length && room) socket.emit('host_update_scores', { roomId: room, scores: real });
      },
      onStatus: (status) => {
        if (room) socket.emit('host_set_status', { roomId: room, status });
      }
    });

    $('dashboard').style.display = 'none';
    $('stage').style.display = 'block';
    running = true;
    overlay = false;
    $('theater').style.display = 'none';

    engine.start();
    launchState();
  } catch (error) {
    console.error('PlaySync launch failed:', error);
    running = false;
    $('stage').style.display = 'none';
    $('dashboard').style.display = 'flex';
    engine?.stop?.();
    engine = null;
    players.delete('__local_test__');
    render();

    const message = error instanceof Error ? error.message : String(error);
    $('hint').textContent = `GAME ERROR: ${message}`;
    $('hint').style.color = '#ff6b81';
    alert(`PlaySync could not start the game.\n\n${message}\n\nOpen F12 → Console if you want the full error.`);
  }
}

function quit() {
  engine?.stop?.();
  engine = null;
  running = false;
  overlay = false;
  $('stage').style.display = 'none';
  $('dashboard').style.display = 'flex';
  if (room) socket.emit('host_set_status', { roomId: room, status: 'lobby' });
  render();
}

function toggleOverlay() {
  if (!running) return;
  overlay = !overlay;
  $('theater').style.display = overlay ? 'block' : 'none';
  engine?.resize?.();
}

function sendLocalAction(action) {
  const local = players.get('__local_test__') || [...players.values()][0];
  if (local && engine) engine.handleAction(local.id, action);
}

const keys = {
  w: ['MOVE_UP_START', 'MOVE_UP_STOP'], ArrowUp: ['MOVE_UP_START', 'MOVE_UP_STOP'],
  s: ['MOVE_DOWN_START', 'MOVE_DOWN_STOP'], ArrowDown: ['MOVE_DOWN_START', 'MOVE_DOWN_STOP'],
  a: ['MOVE_LEFT_START', 'MOVE_LEFT_STOP'], ArrowLeft: ['MOVE_LEFT_START', 'MOVE_LEFT_STOP'],
  d: ['MOVE_RIGHT_START', 'MOVE_RIGHT_STOP'], ArrowRight: ['MOVE_RIGHT_START', 'MOVE_RIGHT_STOP'],
  ' ': ['ACTION_A_START', 'ACTION_A_STOP'],
  Shift: ['ACTION_B_START', 'ACTION_B_STOP']
};

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && running) {
    event.preventDefault();
    toggleOverlay();
    return;
  }
  if (!running || event.repeat || !keys[event.key]) return;
  event.preventDefault();
  sendLocalAction(keys[event.key][0]);
});

window.addEventListener('keyup', (event) => {
  if (running && keys[event.key]) sendLocalAction(keys[event.key][1]);
});

window.addEventListener('blur', () => {
  if (!running) return;
  ['MOVE_UP_STOP', 'MOVE_DOWN_STOP', 'MOVE_LEFT_STOP', 'MOVE_RIGHT_STOP'].forEach(sendLocalAction);
});

socket.on('connect', () => socket.emit('host_create_room'));
socket.on('room_created', (data) => {
  room = data.roomId;
  $('code').textContent = room;
  $('url').textContent = data.joinUrl;
  $('qr').src = data.qrDataUrl;
  $('tqr').src = data.qrDataUrl;
  socket.emit('host_set_game', { roomId: room, gameId });
});
socket.on('room_state', (state) => {
  if (!room || state.roomId === room) {
    room = state.roomId;
    if (state.gameId && !running) gameId = state.gameId;
    applyRoomPlayers(state.players || []);
  }
});
socket.on('score_update', (state) => applyRoomPlayers(state.players || []));
socket.on('player_action', (data) => engine?.handleAction?.(data.playerId, data.action));
socket.on('session_closed', () => { location.href = '/'; });

$('launch').onclick = launch;
$('quit').onclick = quit;
$('dash').onclick = toggleOverlay;
window.addEventListener('resize', () => engine?.resize?.());

cards();
render();
