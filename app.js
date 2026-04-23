/* ============================================================
   HoopPicks — app.js
   Uses balldontlie API v1 (free, no key required for basic use)
   Docs: https://www.balldontlie.io/
============================================================ */

const API_BASE = 'https://api.balldontlie.io/v1';

// ── Team emoji map ──────────────────────────────────────────
const TEAM_EMOJI = {
  'Atlanta Hawks': '🦅', 'Boston Celtics': '🍀', 'Brooklyn Nets': '🕸️',
  'Charlotte Hornets': '🐝', 'Chicago Bulls': '🐂', 'Cleveland Cavaliers': '⚔️',
  'Dallas Mavericks': '🤠', 'Denver Nuggets': '⛏️', 'Detroit Pistons': '⚙️',
  'Golden State Warriors': '💛', 'Houston Rockets': '🚀', 'Indiana Pacers': '🏎️',
  'LA Clippers': '✂️', 'Los Angeles Lakers': '💜', 'Memphis Grizzlies': '🐻',
  'Miami Heat': '🔥', 'Milwaukee Bucks': '🦌', 'Minnesota Timberwolves': '🐺',
  'New Orleans Pelicans': '🦩', 'New York Knicks': '🗽', 'Oklahoma City Thunder': '⚡',
  'Orlando Magic': '🪄', 'Philadelphia 76ers': '🔔', 'Phoenix Suns': '☀️',
  'Portland Trail Blazers': '🌲', 'Sacramento Kings': '👑', 'San Antonio Spurs': '🤠',
  'Toronto Raptors': '🦖', 'Utah Jazz': '🎷', 'Washington Wizards': '🧙'
};

const PLAYER_EMOJI = ['🏀', '⚡', '🔥', '💪', '🎯', '👑', '🦁', '🐉', '⭐', '🚀'];

// ── State ───────────────────────────────────────────────────
let state = {
  user: null,
  picks: {},       // { pickId: { id, label, detail, pickType } }
  entries: [],     // submitted entries
  leaderboard: [], // array of { username, correct, total, streak }
  games: [],
  props: [],
};

// ── Utility ─────────────────────────────────────────────────
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDate(str) {
  return new Date(str + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
}

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max+1)); }

function showToast(msg, type = '') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast ' + type;
  void t.offsetWidth;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── LocalStorage ─────────────────────────────────────────────
function saveLocal() {
  localStorage.setItem('hoopp_user', JSON.stringify(state.user));
  localStorage.setItem('hoopp_entries', JSON.stringify(state.entries));
  localStorage.setItem('hoopp_lb', JSON.stringify(state.leaderboard));
}

function loadLocal() {
  try { state.user = JSON.parse(localStorage.getItem('hoopp_user')); } catch {}
  try { state.entries = JSON.parse(localStorage.getItem('hoopp_entries')) || []; } catch {}
  try { state.leaderboard = JSON.parse(localStorage.getItem('hoopp_lb')) || []; } catch {}
}

// ── Auth ─────────────────────────────────────────────────────
function initAuth() {
  const loginBtn = document.getElementById('login-btn');
  const modal = document.getElementById('login-modal');
  const closeBtn = document.getElementById('modal-close');
  const submitBtn = document.getElementById('login-submit');
  const input = document.getElementById('username-input');

  if (state.user) applyUser();

  loginBtn.addEventListener('click', () => {
    if (state.user) {
      // logout
      state.user = null;
      saveLocal();
      loginBtn.textContent = 'Sign In';
      document.getElementById('username-display').textContent = 'Guest';
      showToast('Signed out');
    } else {
      modal.classList.remove('hidden');
      input.focus();
    }
  });

  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

  submitBtn.addEventListener('click', doLogin);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  function doLogin() {
    const name = input.value.trim();
    if (!name) return showToast('Please enter a username', 'error');
    state.user = { username: name, joined: Date.now() };
    saveLocal();
    applyUser();
    modal.classList.add('hidden');
    showToast(`Welcome, ${name}! 🏀`, 'success');
    // Add to leaderboard if not present
    if (!state.leaderboard.find(u => u.username === name)) {
      state.leaderboard.push({ username: name, correct: 0, total: 0, streak: 0 });
      saveLocal();
    }
    renderLeaderboard();
  }

  function applyUser() {
    document.getElementById('username-display').textContent = state.user.username;
    document.getElementById('login-btn').textContent = 'Sign Out';
  }
}

// ── Tabs ─────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.getElementById('tab-' + tab).classList.remove('hidden');
      if (tab === 'leaderboard') renderLeaderboard();
      if (tab === 'my-picks') renderMyPicks();
    });
  });
}

// ── NBA API ───────────────────────────────────────────────────
async function fetchTodaysGames() {
  const date = today();
  try {
    const res = await fetch(`${API_BASE}/games?dates[]=${date}&per_page=15`);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return data.data || [];
  } catch (e) {
    console.warn('NBA API unavailable, using demo data:', e.message);
    return null; // will trigger demo mode
  }
}

async function fetchTodaysStats() {
  const date = today();
  try {
    const res = await fetch(`${API_BASE}/stats?dates[]=${date}&per_page=50`);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return data.data || [];
  } catch (e) {
    console.warn('Stats unavailable');
    return [];
  }
}

// ── Demo data (used when no games today or API fails) ──────────
function getDemoGames() {
  const teams = [
    { id: 1, full_name: 'Boston Celtics', abbreviation: 'BOS' },
    { id: 2, full_name: 'Miami Heat', abbreviation: 'MIA' },
    { id: 3, full_name: 'Los Angeles Lakers', abbreviation: 'LAL' },
    { id: 4, full_name: 'Golden State Warriors', abbreviation: 'GSW' },
    { id: 5, full_name: 'Milwaukee Bucks', abbreviation: 'MIL' },
    { id: 6, full_name: 'Philadelphia 76ers', abbreviation: 'PHI' },
    { id: 7, full_name: 'Denver Nuggets', abbreviation: 'DEN' },
    { id: 8, full_name: 'Phoenix Suns', abbreviation: 'PHX' },
  ];
  const pairs = [[0,1],[2,3],[4,5],[6,7]];
  return pairs.map((p, i) => ({
    id: 9000 + i,
    status: 'scheduled',
    time: ['7:00 PM ET','7:30 PM ET','8:00 PM ET','10:30 PM ET'][i],
    home_team: teams[p[0]],
    visitor_team: teams[p[1]],
    home_team_score: 0,
    visitor_team_score: 0,
    _demo: true,
  }));
}

function getDemoProps(games) {
  const playerPool = [
    { name: 'Jayson Tatum', team: 'BOS', game: 'BOS vs MIA', stat: 'Points', line: 27.5 },
    { name: 'Jimmy Butler', team: 'MIA', game: 'BOS vs MIA', stat: 'Points', line: 22.5 },
    { name: 'LeBron James', team: 'LAL', game: 'LAL vs GSW', stat: 'Points', line: 24.5 },
    { name: 'Stephen Curry', team: 'GSW', game: 'LAL vs GSW', stat: 'Points', line: 28.5 },
    { name: 'Giannis Antetokounmpo', team: 'MIL', game: 'MIL vs PHI', stat: 'Points', line: 31.5 },
    { name: 'Joel Embiid', team: 'PHI', game: 'MIL vs PHI', stat: 'Points', line: 29.5 },
    { name: 'Nikola Jokic', team: 'DEN', game: 'DEN vs PHX', stat: 'Rebounds', line: 12.5 },
    { name: 'Kevin Durant', team: 'PHX', game: 'DEN vs PHX', stat: 'Points', line: 27.5 },
    { name: 'Jaylen Brown', team: 'BOS', game: 'BOS vs MIA', stat: 'Assists', line: 3.5 },
    { name: 'Anthony Davis', team: 'LAL', game: 'LAL vs GSW', stat: 'Rebounds', line: 13.5 },
    { name: 'Damian Lillard', team: 'MIL', game: 'MIL vs PHI', stat: 'Assists', line: 6.5 },
    { name: 'Tyrese Maxey', team: 'PHI', game: 'MIL vs PHI', stat: 'Points', line: 23.5 },
  ];
  // Use actual games if provided
  if (games && games.length > 0 && !games[0]._demo) {
    return buildPropsFromGames(games);
  }
  return playerPool.map((p, i) => ({ ...p, id: 'prop_' + i, emoji: PLAYER_EMOJI[i % PLAYER_EMOJI.length] }));
}

function buildPropsFromGames(games) {
  const props = [];
  games.forEach((g, i) => {
    const home = g.home_team.full_name;
    const away = g.visitor_team.full_name;
    const matchup = `${g.home_team.abbreviation} vs ${g.visitor_team.abbreviation}`;
    const stats = [
      { stat: 'Points', base: 22 },
      { stat: 'Rebounds', base: 8 },
      { stat: 'Assists', base: 5 },
    ];
    stats.forEach((s, j) => {
      const line = Math.round(rand(s.base - 3, s.base + 8) * 2) / 2;
      props.push({
        id: `prop_${i}_${j}`,
        name: `Player ${i*2+j+1}`,
        team: j % 2 === 0 ? g.home_team.abbreviation : g.visitor_team.abbreviation,
        game: matchup,
        stat: s.stat,
        line,
        emoji: PLAYER_EMOJI[(i * 3 + j) % PLAYER_EMOJI.length],
      });
    });
  });
  return props.slice(0, 12);
}

// ── Render Games ──────────────────────────────────────────────
function renderGames(games) {
  const grid = document.getElementById('games-grid');
  grid.innerHTML = '';

  games.forEach(game => {
    const homeEmoji = TEAM_EMOJI[game.home_team.full_name] || '🏀';
    const awayEmoji = TEAM_EMOJI[game.visitor_team.full_name] || '🏀';
    const isLive = game.status === 'live' || (game.period > 0 && game.time !== 'Final');
    const isFinal = game.status === 'Final' || game.status === 'final';
    const homeScore = game.home_team_score || 0;
    const awayScore = game.visitor_team_score || 0;
    const showScores = isLive || isFinal;
    const gameTime = game._demo ? game.time : (game.status === 'scheduled' ? formatAPITime(game.status, game.time) : game.status);

    const card = document.createElement('div');
    card.className = 'game-card';
    card.innerHTML = `
      <div class="game-card-header">
        <span>${game.home_team.abbreviation} vs ${game.visitor_team.abbreviation}</span>
        ${isLive ? '<span class="game-status-live">LIVE</span>' : isFinal ? '<span style="color:var(--text3)">FINAL</span>' : `<span class="game-time">${gameTime}</span>`}
      </div>
      <div class="game-matchup">
        <div class="team-side">
          <div class="team-logo">${awayEmoji}</div>
          <div class="team-abbr">${game.visitor_team.abbreviation}</div>
          <div class="team-score ${showScores ? '' : 'empty'}">${showScores ? awayScore : '—'}</div>
        </div>
        <div class="vs-badge">
          <span>VS</span>
        </div>
        <div class="team-side">
          <div class="team-logo">${homeEmoji}</div>
          <div class="team-abbr">${game.home_team.abbreviation}</div>
          <div class="team-score ${showScores ? '' : 'empty'}">${showScores ? homeScore : '—'}</div>
        </div>
      </div>
      <div class="pick-buttons">
        <button class="pick-btn" data-game="${game.id}" data-pick="away" data-label="${game.visitor_team.full_name}" data-detail="${game.visitor_team.abbreviation} to win">
          ${awayEmoji} ${game.visitor_team.abbreviation} Win
        </button>
        <button class="pick-btn" data-game="${game.id}" data-pick="home" data-label="${game.home_team.full_name}" data-detail="${game.home_team.abbreviation} to win">
          ${homeEmoji} ${game.home_team.abbreviation} Win
        </button>
      </div>
    `;

    card.querySelectorAll('.pick-btn').forEach(btn => {
      const pickId = `game_${game.id}_${btn.dataset.pick}`;
      if (state.picks[pickId]) btn.classList.add('selected-win');

      btn.addEventListener('click', () => {
        const oppPick = btn.dataset.pick === 'home' ? 'away' : 'home';
        const oppId = `game_${game.id}_${oppPick}`;

        // deselect opponent
        if (state.picks[oppId]) {
          delete state.picks[oppId];
          card.querySelector(`[data-pick="${oppPick}"]`)?.classList.remove('selected-win', 'selected-loss');
          removeSlipItem(oppId);
        }

        if (state.picks[pickId]) {
          delete state.picks[pickId];
          btn.classList.remove('selected-win', 'selected-loss');
          removeSlipItem(pickId);
        } else {
          if (Object.keys(state.picks).length >= 6) return showToast('Max 6 picks per entry', 'error');
          state.picks[pickId] = {
            id: pickId,
            label: btn.dataset.label,
            detail: btn.dataset.detail,
            pickType: 'win',
          };
          btn.classList.add('selected-win');
          addSlipItem(pickId, state.picks[pickId]);
          showToast(`${game.visitor_team.abbreviation} or ${game.home_team.abbreviation} added!`);
        }
        updateSlip();
      });
    });

    grid.appendChild(card);
  });
}

function formatAPITime(status, time) {
  if (!time) return status;
  return time;
}

// ── Render Props ──────────────────────────────────────────────
function renderProps(props) {
  const grid = document.getElementById('props-grid');
  grid.innerHTML = '';

  props.forEach(prop => {
    const card = document.createElement('div');
    card.className = 'prop-card';
    card.innerHTML = `
      <div class="prop-card-top">
        <div class="player-avatar">${prop.emoji}</div>
        <div class="player-info">
          <div class="player-name">${prop.name}</div>
          <div class="player-team-game">${prop.team} · ${prop.game}</div>
        </div>
      </div>
      <div class="prop-stat-row">
        <span class="prop-stat-name">${prop.stat}</span>
        <span class="prop-line">${prop.line}</span>
        <span class="prop-stat-unit">${prop.stat.toLowerCase()}</span>
      </div>
      <div class="prop-buttons">
        <button class="over-btn" data-prop="${prop.id}" data-dir="over">▲ Over ${prop.line}</button>
        <button class="under-btn" data-prop="${prop.id}" data-dir="under">▼ Under ${prop.line}</button>
      </div>
    `;

    const overBtn = card.querySelector('.over-btn');
    const underBtn = card.querySelector('.under-btn');
    const overId = `prop_over_${prop.id}`;
    const underId = `prop_under_${prop.id}`;

    if (state.picks[overId]) overBtn.classList.add('selected');
    if (state.picks[underId]) underBtn.classList.add('selected');

    overBtn.addEventListener('click', () => toggleProp(overId, underId, overBtn, underBtn, prop, 'over'));
    underBtn.addEventListener('click', () => toggleProp(underId, overId, underBtn, overBtn, prop, 'under'));

    grid.appendChild(card);
  });
}

function toggleProp(pickId, oppId, btn, oppBtn, prop, dir) {
  // Remove opponent
  if (state.picks[oppId]) {
    delete state.picks[oppId];
    oppBtn.classList.remove('selected');
    removeSlipItem(oppId);
  }

  if (state.picks[pickId]) {
    delete state.picks[pickId];
    btn.classList.remove('selected');
    removeSlipItem(pickId);
  } else {
    if (Object.keys(state.picks).length >= 6) return showToast('Max 6 picks per entry', 'error');
    state.picks[pickId] = {
      id: pickId,
      label: prop.name,
      detail: `${dir === 'over' ? 'Over' : 'Under'} ${prop.line} ${prop.stat}`,
      pickType: dir,
    };
    btn.classList.add('selected');
    addSlipItem(pickId, state.picks[pickId]);
    showToast(`${prop.name} ${dir} ${prop.line} added!`);
  }
  updateSlip();
}

// ── Entry Slip ────────────────────────────────────────────────
function addSlipItem(id, pick) {
  const container = document.getElementById('slip-picks');
  const empty = container.querySelector('.slip-empty');
  if (empty) empty.remove();

  const item = document.createElement('div');
  item.className = 'slip-item';
  item.id = 'slip_' + id;
  item.innerHTML = `
    <div class="slip-item-left">
      <div class="slip-item-name">${pick.label}</div>
      <div class="slip-item-detail">${pick.detail}</div>
    </div>
    <span class="slip-item-pick ${pick.pickType === 'under' ? 'under' : 'over win'}">${pick.pickType.toUpperCase()}</span>
    <button class="slip-item-remove" data-id="${id}">✕</button>
  `;
  item.querySelector('.slip-item-remove').addEventListener('click', () => removePick(id));
  container.appendChild(item);
}

function removeSlipItem(id) {
  document.getElementById('slip_' + id)?.remove();
  const container = document.getElementById('slip-picks');
  if (!container.querySelector('.slip-item')) {
    container.innerHTML = '<p class="slip-empty">Add picks to build your entry</p>';
  }
}

function removePick(id) {
  if (!state.picks[id]) return;
  const pick = state.picks[id];
  delete state.picks[id];

  // Un-highlight the card button
  const [type] = id.split('_');
  if (type === 'game') {
    document.querySelector(`[data-game][data-pick]`)?.classList.remove('selected-win','selected-loss');
    document.querySelectorAll('.pick-btn').forEach(b => {
      if (`game_${b.dataset.game}_${b.dataset.pick}` === id) b.classList.remove('selected-win','selected-loss');
    });
  } else {
    const dir = id.startsWith('prop_over') ? '.over-btn' : '.under-btn';
    document.querySelectorAll(dir).forEach(b => {
      const propId = id.replace('prop_over_','').replace('prop_under_','');
      if (b.dataset.prop === propId) b.classList.remove('selected');
    });
  }

  removeSlipItem(id);
  updateSlip();
}

function updateSlip() {
  const count = Object.keys(state.picks).length;
  document.getElementById('slip-count').textContent = `${count} / 6`;
  document.getElementById('picks-count').textContent = count;
  const submitBtn = document.getElementById('slip-submit');
  submitBtn.disabled = count === 0;
}

function initSlip() {
  document.getElementById('clear-slip').addEventListener('click', clearSlip);
  document.getElementById('slip-submit').addEventListener('click', submitEntry);
  document.getElementById('submit-picks-btn').addEventListener('click', submitEntry);
}

function clearSlip() {
  state.picks = {};
  document.getElementById('slip-picks').innerHTML = '<p class="slip-empty">Add picks to build your entry</p>';
  // Remove all highlights
  document.querySelectorAll('.pick-btn.selected-win,.pick-btn.selected-loss').forEach(b => b.classList.remove('selected-win','selected-loss'));
  document.querySelectorAll('.over-btn.selected,.under-btn.selected').forEach(b => b.classList.remove('selected'));
  updateSlip();
}

function submitEntry() {
  if (!state.user) {
    document.getElementById('login-modal').classList.remove('hidden');
    return showToast('Sign in to submit picks!', 'error');
  }
  const count = Object.keys(state.picks).length;
  if (count === 0) return showToast('Add at least 1 pick', 'error');

  const entry = {
    id: Date.now(),
    date: today(),
    username: state.user.username,
    picks: Object.values(state.picks).map(p => ({ ...p, result: 'pending' })),
    status: 'pending',
    submittedAt: new Date().toLocaleTimeString(),
  };

  state.entries.push(entry);
  saveLocal();
  clearSlip();
  showToast(`Entry submitted with ${count} pick${count > 1 ? 's' : ''}! 🏀`, 'success');

  // Simulate results after 3 seconds (for demo)
  setTimeout(() => simulateResults(entry.id), 3000);
}

// ── Simulate Results (demo) ───────────────────────────────────
function simulateResults(entryId) {
  const entry = state.entries.find(e => e.id === entryId);
  if (!entry) return;

  let correct = 0;
  entry.picks.forEach(pick => {
    pick.result = Math.random() > 0.45 ? 'correct' : 'wrong';
    if (pick.result === 'correct') correct++;
  });

  const allCorrect = correct === entry.picks.length;
  const majority = correct > entry.picks.length / 2;
  entry.status = allCorrect ? 'won' : majority ? 'won' : 'lost';
  entry.correct = correct;

  // Update leaderboard
  let lb = state.leaderboard.find(u => u.username === entry.username);
  if (!lb) {
    lb = { username: entry.username, correct: 0, total: 0, streak: 0 };
    state.leaderboard.push(lb);
  }
  lb.correct += correct;
  lb.total += entry.picks.length;
  lb.streak = entry.status === 'won' ? (lb.streak || 0) + 1 : 0;

  saveLocal();
  showToast(`Results in! ${correct}/${entry.picks.length} correct 🎯`, correct > 0 ? 'success' : '');
  renderLeaderboard();
}

// ── Leaderboard ───────────────────────────────────────────────
function seedLeaderboard() {
  const names = ['KingJames23', 'HoopDreams', 'BenchWarmer', 'StatPadder', 'PickMaster', 'NBAGenius', 'CourtVision', 'Analyst_X', 'BallIQ100'];
  names.forEach((name, i) => {
    if (!state.leaderboard.find(u => u.username === name)) {
      const correct = randInt(30, 120);
      const total = correct + randInt(10, 40);
      state.leaderboard.push({ username: name, correct, total, streak: randInt(0, 8) });
    }
  });
  saveLocal();
}

function renderLeaderboard() {
  const sorted = [...state.leaderboard].sort((a, b) => {
    const accA = a.total > 0 ? a.correct / a.total : 0;
    const accB = b.total > 0 ? b.correct / b.total : 0;
    return accB - accA || b.correct - a.correct;
  });

  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '';

  sorted.forEach((u, i) => {
    const rank = i + 1;
    const acc = u.total > 0 ? ((u.correct / u.total) * 100).toFixed(1) : '0.0';
    const isMe = state.user && u.username === state.user.username;
    const rankClass = rank === 1 ? 'top1' : rank === 2 ? 'top2' : rank === 3 ? 'top3' : '';
    const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const streakStr = u.streak > 0 ? `<span class="streak-fire">🔥</span>${u.streak}` : '—';

    const tr = document.createElement('tr');
    if (isMe) tr.style.background = 'rgba(124,58,237,0.08)';
    tr.innerHTML = `
      <td><span class="lb-rank ${rankClass}">${rankIcon}</span></td>
      <td><span class="lb-username">${u.username}${isMe ? '<span class="lb-me-badge">YOU</span>' : ''}</span></td>
      <td>${u.correct}</td>
      <td>${u.total}</td>
      <td class="lb-accuracy">${acc}%</td>
      <td class="lb-streak">${streakStr}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── My Picks ──────────────────────────────────────────────────
function renderMyPicks() {
  const container = document.getElementById('my-picks-list');
  const myEntries = state.user
    ? state.entries.filter(e => e.username === state.user.username).reverse()
    : [];

  if (myEntries.length === 0) {
    container.innerHTML = state.user
      ? '<p class="empty-msg">No entries yet. Make some picks!</p>'
      : '<p class="empty-msg">Sign in to see your picks.</p>';
    return;
  }

  container.innerHTML = myEntries.map(entry => {
    const picksHtml = entry.picks.map(pick => {
      const resultClass = pick.result === 'correct' ? 'pick-result-correct' : pick.result === 'wrong' ? 'pick-result-wrong' : 'pick-result-pending';
      const resultIcon = pick.result === 'correct' ? '✓' : pick.result === 'wrong' ? '✗' : '•';
      return `
        <div class="entry-pick-row">
          <span>${pick.label}</span>
          <span style="color:var(--text3);font-size:0.8rem">${pick.detail}</span>
          <span class="${resultClass}">${resultIcon}</span>
        </div>
      `;
    }).join('');

    const statusClass = entry.status === 'won' ? 'won' : entry.status === 'lost' ? 'lost' : 'pending';
    const statusLabel = entry.status === 'won' ? 'Won' : entry.status === 'lost' ? 'Lost' : 'Pending';

    return `
      <div class="entry-card">
        <div class="entry-card-header">
          <div>
            <strong>Entry #${entry.id.toString().slice(-4)}</strong>
            <span> · ${entry.date} at ${entry.submittedAt}</span>
          </div>
          <span class="entry-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="entry-picks-list">${picksHtml}</div>
      </div>
    `;
  }).join('');
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  loadLocal();
  initAuth();
  initTabs();
  initSlip();

  document.getElementById('today-date').textContent = fmtDate(today());

  // Seed leaderboard with demo users
  if (state.leaderboard.length < 5) seedLeaderboard();

  const loadingEl = document.getElementById('loading-state');
  const noGamesEl = document.getElementById('no-games-state');

  // Fetch real games
  let games = await fetchTodaysGames();
  let usingDemo = false;

  if (!games || games.length === 0) {
    usingDemo = true;
    games = getDemoGames();
    noGamesEl.classList.remove('hidden');
  }

  loadingEl.classList.add('hidden');

  state.games = games;
  state.props = getDemoProps(games);

  renderGames(games);
  renderProps(state.props);
  renderLeaderboard();
}

document.addEventListener('DOMContentLoaded', init);
