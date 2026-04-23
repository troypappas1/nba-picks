/* ============================================================
   HoopPicks — app.js
   Live games: NBA official CDN scoreboard (no auth required)
   Coins: wager system with tiered multipliers
============================================================ */

const NBA_SCOREBOARD = 'https://nba-prod-us-east-1-mediaops-stats.s3.amazonaws.com/NBA/liveData/scoreboard/todaysScoreboard_00.json';

// ── Team maps ───────────────────────────────────────────────
const TEAM_EMOJI = {
  ATL:'🦅', BOS:'🍀', BKN:'🕸️', CHA:'🐝', CHI:'🐂', CLE:'⚔️',
  DAL:'🤠', DEN:'⛏️', DET:'⚙️', GSW:'💛', HOU:'🚀', IND:'🏎️',
  LAC:'✂️', LAL:'💜', MEM:'🐻', MIA:'🔥', MIL:'🦌', MIN:'🐺',
  NOP:'🦩', NYK:'🗽', OKC:'⚡', ORL:'🪄', PHI:'🔔', PHX:'☀️',
  POR:'🌲', SAC:'👑', SAS:'🤠', TOR:'🦖', UTA:'🎷', WAS:'🧙'
};
const TEAM_FULL = {
  ATL:'Atlanta Hawks', BOS:'Boston Celtics', BKN:'Brooklyn Nets',
  CHA:'Charlotte Hornets', CHI:'Chicago Bulls', CLE:'Cleveland Cavaliers',
  DAL:'Dallas Mavericks', DEN:'Denver Nuggets', DET:'Detroit Pistons',
  GSW:'Golden State Warriors', HOU:'Houston Rockets', IND:'Indiana Pacers',
  LAC:'LA Clippers', LAL:'Los Angeles Lakers', MEM:'Memphis Grizzlies',
  MIA:'Miami Heat', MIL:'Milwaukee Bucks', MIN:'Minnesota Timberwolves',
  NOP:'New Orleans Pelicans', NYK:'New York Knicks', OKC:'Oklahoma City Thunder',
  ORL:'Orlando Magic', PHI:'Philadelphia 76ers', PHX:'Phoenix Suns',
  POR:'Portland Trail Blazers', SAC:'Sacramento Kings', SAS:'San Antonio Spurs',
  TOR:'Toronto Raptors', UTA:'Utah Jazz', WAS:'Washington Wizards'
};

// Known star players per team for prop generation
const TEAM_STARS = {
  ATL:[{n:'Trae Young',s:'Points',l:26.5},{n:'Dejounte Murray',s:'Assists',l:5.5}],
  BOS:[{n:'Jayson Tatum',s:'Points',l:27.5},{n:'Jaylen Brown',s:'Points',l:23.5}],
  BKN:[{n:'Cam Thomas',s:'Points',l:22.5},{n:'Ben Simmons',s:'Rebounds',l:7.5}],
  CHA:[{n:'LaMelo Ball',s:'Assists',l:7.5},{n:'Miles Bridges',s:'Points',l:18.5}],
  CHI:[{n:'Zach LaVine',s:'Points',l:22.5},{n:'Nikola Vucevic',s:'Rebounds',l:10.5}],
  CLE:[{n:'Donovan Mitchell',s:'Points',l:25.5},{n:'Darius Garland',s:'Assists',l:6.5}],
  DAL:[{n:'Luka Doncic',s:'Points',l:30.5},{n:'Kyrie Irving',s:'Points',l:23.5}],
  DEN:[{n:'Nikola Jokic',s:'Rebounds',l:12.5},{n:'Jamal Murray',s:'Points',l:21.5}],
  DET:[{n:'Cade Cunningham',s:'Points',l:22.5},{n:'Jalen Duren',s:'Rebounds',l:10.5}],
  GSW:[{n:'Stephen Curry',s:'Points',l:28.5},{n:'Klay Thompson',s:'Points',l:17.5}],
  HOU:[{n:'Alperen Sengun',s:'Rebounds',l:9.5},{n:'Jalen Green',s:'Points',l:22.5}],
  IND:[{n:'Tyrese Haliburton',s:'Assists',l:10.5},{n:'Pascal Siakam',s:'Points',l:21.5}],
  LAC:[{n:'Kawhi Leonard',s:'Points',l:22.5},{n:'Paul George',s:'Points',l:22.5}],
  LAL:[{n:'LeBron James',s:'Points',l:24.5},{n:'Anthony Davis',s:'Rebounds',l:13.5}],
  MEM:[{n:'Ja Morant',s:'Points',l:24.5},{n:'Jaren Jackson Jr.',s:'Blocks',l:2.5}],
  MIA:[{n:'Jimmy Butler',s:'Points',l:21.5},{n:'Bam Adebayo',s:'Rebounds',l:10.5}],
  MIL:[{n:'Giannis Antetokounmpo',s:'Points',l:31.5},{n:'Damian Lillard',s:'Assists',l:6.5}],
  MIN:[{n:'Anthony Edwards',s:'Points',l:25.5},{n:'Rudy Gobert',s:'Rebounds',l:12.5}],
  NOP:[{n:'Zion Williamson',s:'Points',l:24.5},{n:'Brandon Ingram',s:'Points',l:21.5}],
  NYK:[{n:'Jalen Brunson',s:'Points',l:24.5},{n:'Julius Randle',s:'Rebounds',l:9.5}],
  OKC:[{n:'Shai Gilgeous-Alexander',s:'Points',l:30.5},{n:'Jalen Williams',s:'Points',l:21.5}],
  ORL:[{n:'Paolo Banchero',s:'Points',l:22.5},{n:'Franz Wagner',s:'Points',l:19.5}],
  PHI:[{n:'Joel Embiid',s:'Points',l:29.5},{n:'Tyrese Maxey',s:'Points',l:23.5}],
  PHX:[{n:'Kevin Durant',s:'Points',l:27.5},{n:'Devin Booker',s:'Points',l:26.5}],
  POR:[{n:'Damian Lillard',s:'Points',l:27.5},{n:'Jerami Grant',s:'Points',l:19.5}],
  SAC:[{n:'De\'Aaron Fox',s:'Points',l:23.5},{n:'Domantas Sabonis',s:'Rebounds',l:12.5}],
  SAS:[{n:'Victor Wembanyama',s:'Points',l:22.5},{n:'Devin Vassell',s:'Points',l:17.5}],
  TOR:[{n:'Scottie Barnes',s:'Points',l:19.5},{n:'RJ Barrett',s:'Points',l:19.5}],
  UTA:[{n:'Lauri Markkanen',s:'Points',l:22.5},{n:'Collin Sexton',s:'Points',l:18.5}],
  WAS:[{n:'Kyle Kuzma',s:'Points',l:20.5},{n:'Bradley Beal',s:'Points',l:21.5}],
};

const PLAYER_EMOJI = ['🏀','⚡','🔥','💪','🎯','👑','🦁','🐉','⭐','🚀','🎪','🏆'];

// ── Coin reward tiers ────────────────────────────────────────
const COIN_TIERS = [
  { picks: 1, mult: 1.5,  label: '1 Pick',  color: '#64748b' },
  { picks: 2, mult: 3,    label: '2 Picks',  color: '#22c55e' },
  { picks: 3, mult: 6,    label: '3 Picks',  color: '#3b82f6' },
  { picks: 4, mult: 12,   label: '4 Picks',  color: '#a855f7' },
  { picks: 5, mult: 25,   label: '5 Picks',  color: '#f59e0b' },
  { picks: 6, mult: 60,   label: '6 Picks',  color: '#ef4444' },
];
const STARTING_COINS = 1000;
const WAGER_OPTIONS = [50, 100, 250, 500];

// ── State ────────────────────────────────────────────────────
let state = {
  user: null,
  picks: {},
  entries: [],
  leaderboard: [],
  games: [],
  props: [],
  wager: 100,
};

// ── Utils ────────────────────────────────────────────────────
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDate(str) {
  return new Date(str + 'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
}

function showToast(msg, type='') {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast ' + type;
  void t.offsetWidth;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
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

// ── Coins ─────────────────────────────────────────────────────
function getCoins() {
  if (!state.user) return 0;
  const lb = state.leaderboard.find(u => u.username === state.user.username);
  return lb ? lb.coins : STARTING_COINS;
}
function setCoins(n) {
  const lb = state.leaderboard.find(u => u.username === state.user.username);
  if (lb) lb.coins = Math.max(0, Math.round(n));
  saveLocal();
  renderCoinBadge();
}
function renderCoinBadge() {
  const el = document.getElementById('coin-display');
  if (el) el.textContent = getCoins().toLocaleString();
}

// ── Auth ──────────────────────────────────────────────────────
function initAuth() {
  const loginBtn = document.getElementById('login-btn');
  const modal    = document.getElementById('login-modal');
  const closeBtn = document.getElementById('modal-close');
  const submitBtn= document.getElementById('login-submit');
  const input    = document.getElementById('username-input');

  if (state.user) applyUser();

  loginBtn.addEventListener('click', () => {
    if (state.user) {
      state.user = null; saveLocal();
      loginBtn.textContent = 'Sign In';
      document.getElementById('username-display').textContent = 'Guest';
      document.getElementById('coin-display').textContent = '—';
      showToast('Signed out');
    } else {
      modal.classList.remove('hidden'); input.focus();
    }
  });

  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', e => { if (e.target===modal) modal.classList.add('hidden'); });
  submitBtn.addEventListener('click', doLogin);
  input.addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });

  function doLogin() {
    const name = input.value.trim();
    if (!name) return showToast('Enter a username','error');
    state.user = { username: name, joined: Date.now() };
    saveLocal();
    if (!state.leaderboard.find(u => u.username===name)) {
      state.leaderboard.push({ username:name, correct:0, total:0, streak:0, coins:STARTING_COINS });
      saveLocal();
    }
    applyUser();
    modal.classList.add('hidden');
    showToast(`Welcome, ${name}! You have ${STARTING_COINS.toLocaleString()} coins 🪙`, 'success');
    renderLeaderboard();
  }

  function applyUser() {
    document.getElementById('username-display').textContent = state.user.username;
    document.getElementById('login-btn').textContent = 'Sign Out';
    renderCoinBadge();
  }
}

// ── Tabs ──────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.getElementById('tab-'+tab).classList.remove('hidden');
      if (tab==='leaderboard') renderLeaderboard();
      if (tab==='my-picks')    renderMyPicks();
    });
  });
}

// ── Fetch real NBA games from official CDN ───────────────────
async function fetchTodaysGames() {
  try {
    // bust cache so we always get today's data
    const res = await fetch(NBA_SCOREBOARD + '?_=' + Date.now());
    if (!res.ok) throw new Error('non-200');
    const data = await res.json();
    const raw = data?.scoreboard?.games || [];
    if (!raw.length) return null;
    return raw.map(normalizeNBAGame);
  } catch (e) {
    console.warn('NBA CDN unavailable:', e.message);
    return null;
  }
}

// Convert NBA CDN shape → our internal shape
function normalizeNBAGame(g) {
  const homeAbbr = g.homeTeam.teamTricode;
  const awayAbbr = g.awayTeam.teamTricode;
  // gameStatus: 1=pre-game, 2=live, 3=final
  const statusNum = g.gameStatus;
  let statusText = 'scheduled';
  if (statusNum === 2) statusText = 'live';
  if (statusNum === 3) statusText = 'final';

  // Convert UTC tip-off to local time string
  let timeStr = '';
  if (statusNum === 1 && g.gameTimeUTC) {
    const d = new Date(g.gameTimeUTC);
    timeStr = d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', timeZoneName:'short'});
  } else if (statusNum === 2) {
    // e.g. "Q3 4:22"
    const clock = g.gameClock ? g.gameClock.replace('PT','').replace('M',':').replace('S','').replace(/:\d\d\.\d\d/,m=>m.split('.')[0]) : '';
    timeStr = `Q${g.period} ${clock}`;
  } else if (statusNum === 3) {
    timeStr = 'Final';
  }

  return {
    id: g.gameId,
    status: statusText,
    time: timeStr,
    period: g.period || 0,
    gameClock: g.gameClock || '',
    seriesText: g.seriesText || '',
    home_team: {
      full_name: TEAM_FULL[homeAbbr] || g.homeTeam.teamName,
      abbreviation: homeAbbr,
    },
    visitor_team: {
      full_name: TEAM_FULL[awayAbbr] || g.awayTeam.teamName,
      abbreviation: awayAbbr,
    },
    home_team_score: g.homeTeam.score || 0,
    visitor_team_score: g.awayTeam.score || 0,
  };
}

// ── Build props from real game matchups ───────────────────────
function buildPropsFromGames(games) {
  const props = [];
  games.forEach((g, gi) => {
    const teams = [g.home_team.abbreviation, g.visitor_team.abbreviation];
    const matchup = `${g.visitor_team.abbreviation} @ ${g.home_team.abbreviation}`;
    teams.forEach((abbr, ti) => {
      const stars = TEAM_STARS[abbr] || [];
      stars.forEach((star, si) => {
        props.push({
          id: `prop_${gi}_${ti}_${si}`,
          name: star.n,
          team: abbr,
          game: matchup,
          stat: star.s,
          line: star.l,
          emoji: PLAYER_EMOJI[(gi*4 + ti*2 + si) % PLAYER_EMOJI.length],
        });
      });
    });
  });
  // Deduplicate by player name (e.g. player traded)
  const seen = new Set();
  return props.filter(p => { if (seen.has(p.name)) return false; seen.add(p.name); return true; });
}

// ── Fallback demo games ───────────────────────────────────────
function getDemoGames() {
  const pairs = [
    ['NYK','ATL'],['CLE','TOR'],['DEN','MIN'],
  ];
  return pairs.map(([away,home], i) => ({
    id: 'demo_'+i, status:'scheduled',
    time: ['7:00 PM ET','8:00 PM ET','9:30 PM ET'][i],
    period:0, gameClock:'', seriesText:'',
    home_team:{ full_name: TEAM_FULL[home]||home, abbreviation:home },
    visitor_team:{ full_name: TEAM_FULL[away]||away, abbreviation:away },
    home_team_score:0, visitor_team_score:0,
    _demo:true,
  }));
}

// ── Render Games ──────────────────────────────────────────────
function renderGames(games) {
  const grid = document.getElementById('games-grid');
  grid.innerHTML = '';

  games.forEach(game => {
    const he = TEAM_EMOJI[game.home_team.abbreviation] || '🏀';
    const ae = TEAM_EMOJI[game.visitor_team.abbreviation] || '🏀';
    const isLive  = game.status === 'live';
    const isFinal = game.status === 'final';
    const showScores = isLive || isFinal;
    const hs = game.home_team_score;
    const as = game.visitor_team_score;

    let statusHtml;
    if (isLive)       statusHtml = `<span class="game-status-live">LIVE · ${game.time}</span>`;
    else if (isFinal) statusHtml = `<span class="game-status-final">FINAL</span>`;
    else              statusHtml = `<span class="game-time">${game.time}</span>`;

    const seriesBadge = game.seriesText
      ? `<span class="series-badge">${game.seriesText}</span>` : '';

    const card = document.createElement('div');
    card.className = 'game-card';
    card.innerHTML = `
      <div class="game-card-header">
        <span>${game.visitor_team.abbreviation} @ ${game.home_team.abbreviation} ${seriesBadge}</span>
        ${statusHtml}
      </div>
      <div class="game-matchup">
        <div class="team-side">
          <div class="team-logo">${ae}</div>
          <div class="team-abbr">${game.visitor_team.abbreviation}</div>
          <div class="team-name-small">${game.visitor_team.full_name}</div>
          <div class="team-score ${showScores?'':'empty'}">${showScores ? as : '—'}</div>
        </div>
        <div class="vs-badge"><span>@</span></div>
        <div class="team-side">
          <div class="team-logo">${he}</div>
          <div class="team-abbr">${game.home_team.abbreviation}</div>
          <div class="team-name-small">${game.home_team.full_name}</div>
          <div class="team-score ${showScores?'':'empty'}">${showScores ? hs : '—'}</div>
        </div>
      </div>
      <div class="pick-buttons">
        <button class="pick-btn" data-game="${game.id}" data-pick="away"
          data-label="${game.visitor_team.full_name}"
          data-detail="${game.visitor_team.abbreviation} to win">
          ${ae} ${game.visitor_team.abbreviation} Win
        </button>
        <button class="pick-btn" data-game="${game.id}" data-pick="home"
          data-label="${game.home_team.full_name}"
          data-detail="${game.home_team.abbreviation} to win">
          ${he} ${game.home_team.abbreviation} Win
        </button>
      </div>
    `;

    card.querySelectorAll('.pick-btn').forEach(btn => {
      const pickId = `game_${game.id}_${btn.dataset.pick}`;
      if (state.picks[pickId]) btn.classList.add('selected-win');

      btn.addEventListener('click', () => {
        const opp    = btn.dataset.pick === 'home' ? 'away' : 'home';
        const oppId  = `game_${game.id}_${opp}`;
        if (state.picks[oppId]) {
          delete state.picks[oppId];
          card.querySelector(`[data-pick="${opp}"]`)?.classList.remove('selected-win','selected-loss');
          removeSlipItem(oppId);
        }
        if (state.picks[pickId]) {
          delete state.picks[pickId];
          btn.classList.remove('selected-win','selected-loss');
          removeSlipItem(pickId);
        } else {
          if (Object.keys(state.picks).length >= 6) return showToast('Max 6 picks per entry','error');
          state.picks[pickId] = { id:pickId, label:btn.dataset.label, detail:btn.dataset.detail, pickType:'win' };
          btn.classList.add('selected-win');
          addSlipItem(pickId, state.picks[pickId]);
        }
        updateSlip();
      });
    });

    grid.appendChild(card);
  });
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
        <button class="over-btn" data-prop="${prop.id}">▲ Over ${prop.line}</button>
        <button class="under-btn" data-prop="${prop.id}">▼ Under ${prop.line}</button>
      </div>
    `;
    const overBtn  = card.querySelector('.over-btn');
    const underBtn = card.querySelector('.under-btn');
    const overId   = `prop_over_${prop.id}`;
    const underId  = `prop_under_${prop.id}`;
    if (state.picks[overId])  overBtn.classList.add('selected');
    if (state.picks[underId]) underBtn.classList.add('selected');
    overBtn.addEventListener('click',  () => toggleProp(overId, underId, overBtn, underBtn, prop, 'over'));
    underBtn.addEventListener('click', () => toggleProp(underId, overId, underBtn, overBtn, prop, 'under'));
    grid.appendChild(card);
  });
}

function toggleProp(pickId, oppId, btn, oppBtn, prop, dir) {
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
    if (Object.keys(state.picks).length >= 6) return showToast('Max 6 picks per entry','error');
    state.picks[pickId] = {
      id:pickId, label:prop.name,
      detail:`${dir==='over'?'Over':'Under'} ${prop.line} ${prop.stat}`,
      pickType:dir,
    };
    btn.classList.add('selected');
    addSlipItem(pickId, state.picks[pickId]);
  }
  updateSlip();
}

// ── Entry Slip ────────────────────────────────────────────────
function addSlipItem(id, pick) {
  const container = document.getElementById('slip-picks');
  container.querySelector('.slip-empty')?.remove();
  const item = document.createElement('div');
  item.className = 'slip-item';
  item.id = 'slip_' + id;
  item.innerHTML = `
    <div class="slip-item-left">
      <div class="slip-item-name">${pick.label}</div>
      <div class="slip-item-detail">${pick.detail}</div>
    </div>
    <span class="slip-item-pick ${pick.pickType==='under'?'under':'over win'}">${pick.pickType.toUpperCase()}</span>
    <button class="slip-item-remove" data-id="${id}">✕</button>
  `;
  item.querySelector('.slip-item-remove').addEventListener('click', () => removePick(id));
  container.appendChild(item);
}

function removeSlipItem(id) {
  document.getElementById('slip_'+id)?.remove();
  const container = document.getElementById('slip-picks');
  if (!container.querySelector('.slip-item'))
    container.innerHTML = '<p class="slip-empty">Add picks to build your entry</p>';
}

function removePick(id) {
  if (!state.picks[id]) return;
  delete state.picks[id];
  if (id.startsWith('game_')) {
    document.querySelectorAll('.pick-btn').forEach(b => {
      if (`game_${b.dataset.game}_${b.dataset.pick}` === id)
        b.classList.remove('selected-win','selected-loss');
    });
  } else {
    const isOver = id.startsWith('prop_over_');
    const propId = id.replace('prop_over_','').replace('prop_under_','');
    document.querySelectorAll(isOver ? '.over-btn' : '.under-btn').forEach(b => {
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
  document.getElementById('slip-submit').disabled = count === 0;

  // Update payout preview in slip
  renderSlipPayout(count);
}

function renderSlipPayout(count) {
  const el = document.getElementById('slip-payout-row');
  if (!el) return;
  if (count === 0) { el.style.display = 'none'; return; }
  const tier = COIN_TIERS.find(t => t.picks === count) || COIN_TIERS[COIN_TIERS.length-1];
  const payout = Math.round(state.wager * tier.mult);
  el.style.display = 'flex';
  el.innerHTML = `
    <span>Payout (${count} pick${count>1?'s':''})</span>
    <span style="color:${tier.color};font-weight:700">🪙 ${payout.toLocaleString()}</span>
  `;
}

function initSlip() {
  document.getElementById('clear-slip').addEventListener('click', clearSlip);
  document.getElementById('slip-submit').addEventListener('click', submitEntry);

  // Wager selector
  WAGER_OPTIONS.forEach(amt => {
    const btn = document.querySelector(`.wager-btn[data-amt="${amt}"]`);
    if (!btn) return;
    if (amt === state.wager) btn.classList.add('active');
    btn.addEventListener('click', () => {
      state.wager = amt;
      document.querySelectorAll('.wager-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateSlip();
    });
  });
}

function clearSlip() {
  state.picks = {};
  document.getElementById('slip-picks').innerHTML = '<p class="slip-empty">Add picks to build your entry</p>';
  document.querySelectorAll('.pick-btn.selected-win,.pick-btn.selected-loss').forEach(b => b.classList.remove('selected-win','selected-loss'));
  document.querySelectorAll('.over-btn.selected,.under-btn.selected').forEach(b => b.classList.remove('selected'));
  updateSlip();
}

function submitEntry() {
  if (!state.user) {
    document.getElementById('login-modal').classList.remove('hidden');
    return showToast('Sign in to submit picks!','error');
  }
  const count = Object.keys(state.picks).length;
  if (count === 0) return showToast('Add at least 1 pick','error');

  const coins = getCoins();
  if (coins < state.wager) return showToast(`Not enough coins! You have ${coins}🪙`,'error');

  const tier = COIN_TIERS.find(t => t.picks === count) || COIN_TIERS[COIN_TIERS.length-1];
  const potentialPayout = Math.round(state.wager * tier.mult);

  // Deduct wager immediately
  setCoins(coins - state.wager);

  const entry = {
    id: Date.now(),
    date: today(),
    username: state.user.username,
    picks: Object.values(state.picks).map(p => ({...p, result:'pending'})),
    status: 'pending',
    submittedAt: new Date().toLocaleTimeString(),
    wager: state.wager,
    potentialPayout,
    mult: tier.mult,
  };

  state.entries.push(entry);
  saveLocal();
  clearSlip();
  showToast(`Entry submitted! Wagered 🪙${state.wager} · potential 🪙${potentialPayout.toLocaleString()}`, 'success');
  scheduleResultCheck(entry.id);
}

// ── Real result grading ───────────────────────────────────────
// Polls the NBA CDN every 60s until every game tied to the entry is final,
// then grades picks against actual scores. Wager was already deducted —
// payout is credited only if ALL picks are correct, nothing returned on a loss.

function scheduleResultCheck(entryId) {
  // Check immediately (game may already be final on reload), then every 60s
  checkEntryResults(entryId);
}

async function checkEntryResults(entryId) {
  const entry = state.entries.find(e => e.id === entryId);
  if (!entry || entry.status !== 'pending') return;

  let games;
  try {
    const res = await fetch(NBA_SCOREBOARD + '?_=' + Date.now());
    if (!res.ok) throw new Error('non-200');
    const data = await res.json();
    games = (data?.scoreboard?.games || []).map(normalizeNBAGame);
  } catch {
    // Can't reach API — retry in 60s
    setTimeout(() => checkEntryResults(entryId), 60000);
    return;
  }

  // Build a lookup of gameId → game
  const gameMap = {};
  games.forEach(g => { gameMap[g.id] = g; });

  // Find every game referenced by this entry's picks
  const gamePickIds = entry.picks
    .filter(p => p.id.startsWith('game_'))
    .map(p => {
      // id format: game_<gameId>_home|away
      const parts = p.id.split('_');
      return { pick: p, gameId: parts[1], side: parts[2] };
    });

  // Prop picks can't be graded from scoreboard (no live box score) — mark correct
  // They will remain 'pending' shown in UI; we only gate on game picks here
  const propPicks = entry.picks.filter(p => !p.id.startsWith('game_'));

  // Check if all referenced games are final
  const allFinal = gamePickIds.every(({ gameId }) => {
    const g = gameMap[gameId];
    return g && g.status === 'final';
  });

  if (!allFinal) {
    // At least one game still in progress or not started — check again in 60s
    setTimeout(() => checkEntryResults(entryId), 60000);
    return;
  }

  // Grade game picks against real scores
  let correct = 0;
  gamePickIds.forEach(({ pick, gameId, side }) => {
    const g = gameMap[gameId];
    if (!g) { pick.result = 'pending'; return; }
    const homeWon = g.home_team_score > g.visitor_team_score;
    const pickedHome = side === 'home';
    pick.result = (pickedHome === homeWon) ? 'correct' : 'wrong';
    if (pick.result === 'correct') correct++;
  });

  // Prop picks: mark pending (no box score available from CDN)
  propPicks.forEach(pick => {
    if (pick.result === 'pending') pick.result = 'pending';
  });

  // Entry wins only if ALL picks correct (game picks graded, props count as correct)
  const gradedTotal = gamePickIds.length;
  const allCorrect  = correct === gradedTotal && gradedTotal > 0;

  entry.correct = correct;
  entry.status  = allCorrect ? 'won' : 'lost';

  if (allCorrect) {
    setCoins(getCoins() + entry.potentialPayout);
    showToast(`💰 ALL CORRECT! +🪙${entry.potentialPayout.toLocaleString()} credited!`, 'success');
  } else {
    showToast(`Results in — ${correct}/${gradedTotal} correct. 🪙${entry.wager} lost.`);
  }

  let lb = state.leaderboard.find(u => u.username === entry.username);
  if (!lb) { lb = {username:entry.username, correct:0, total:0, streak:0, coins:STARTING_COINS}; state.leaderboard.push(lb); }
  lb.correct += correct;
  lb.total   += gradedTotal;
  lb.streak   = allCorrect ? (lb.streak||0)+1 : 0;

  saveLocal();
  renderLeaderboard();
  renderMyPicks();
  renderCoinBadge();
}

// ── Leaderboard ───────────────────────────────────────────────
function seedLeaderboard() {
  // no fake users — leaderboard is real players only
}

function renderLeaderboard() {
  const sorted = [...state.leaderboard].sort((a,b) => (b.coins||0) - (a.coins||0));
  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '';
  sorted.forEach((u, i) => {
    const rank = i+1;
    const acc  = u.total > 0 ? ((u.correct/u.total)*100).toFixed(1) : '0.0';
    const isMe = state.user && u.username === state.user.username;
    const rankIcon = rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':rank;
    const rankClass= rank===1?'top1':rank===2?'top2':rank===3?'top3':'';
    const streakStr= u.streak>0?`<span class="streak-fire">🔥</span>${u.streak}`:'—';
    const coins = (u.coins||0).toLocaleString();
    const tr = document.createElement('tr');
    if (isMe) tr.style.background='rgba(124,58,237,0.08)';
    tr.innerHTML = `
      <td><span class="lb-rank ${rankClass}">${rankIcon}</span></td>
      <td><span class="lb-username">${u.username}${isMe?'<span class="lb-me-badge">YOU</span>':''}</span></td>
      <td class="lb-coins">🪙 ${coins}</td>
      <td>${u.correct}</td>
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
    ? state.entries.filter(e => e.username===state.user.username).reverse()
    : [];

  if (!myEntries.length) {
    container.innerHTML = state.user
      ? '<p class="empty-msg">No entries yet. Make some picks!</p>'
      : '<p class="empty-msg">Sign in to see your picks.</p>';
    return;
  }

  container.innerHTML = myEntries.map(entry => {
    const picksHtml = entry.picks.map(pick => {
      const rc = pick.result==='correct'?'pick-result-correct':pick.result==='wrong'?'pick-result-wrong':'pick-result-pending';
      const ri = pick.result==='correct'?'✓':pick.result==='wrong'?'✗':'•';
      return `<div class="entry-pick-row">
        <span>${pick.label}</span>
        <span style="color:var(--text3);font-size:0.8rem">${pick.detail}</span>
        <span class="${rc}">${ri}</span>
      </div>`;
    }).join('');

    const sc = entry.status==='won'?'won':entry.status==='lost'?'lost':'pending';
    const sl = entry.status==='won'?'Won':entry.status==='lost'?'Lost':'Pending';
    const coinResult = entry.status==='won'
      ? `<span style="color:var(--green);font-weight:700">+🪙${entry.potentialPayout.toLocaleString()}</span>`
      : entry.status==='lost'
      ? `<span style="color:var(--red)">-🪙${entry.wager}</span>`
      : `<span style="color:var(--yellow)">🪙${entry.wager} wagered</span>`;

    return `<div class="entry-card">
      <div class="entry-card-header">
        <div><strong>Entry #${entry.id.toString().slice(-4)}</strong><span> · ${entry.date} at ${entry.submittedAt}</span></div>
        <div style="display:flex;align-items:center;gap:10px">${coinResult}<span class="entry-status ${sc}">${sl}</span></div>
      </div>
      <div class="entry-picks-list">${picksHtml}</div>
      <div style="font-size:0.78rem;color:var(--text3);margin-top:4px">
        Wager: 🪙${entry.wager} · Potential: 🪙${entry.potentialPayout.toLocaleString()} · ${entry.mult}× multiplier
      </div>
    </div>`;
  }).join('');
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  loadLocal();
  initAuth();
  initTabs();
  initSlip();

  document.getElementById('today-date').textContent = fmtDate(today());
  const loadingEl = document.getElementById('loading-state');
  const noGamesEl = document.getElementById('no-games-state');

  let games = await fetchTodaysGames();
  let usingDemo = false;

  if (!games || !games.length) {
    usingDemo = true;
    games = getDemoGames();
    noGamesEl.classList.remove('hidden');
  }

  loadingEl.classList.add('hidden');
  state.games = games;
  state.props  = buildPropsFromGames(games);

  renderGames(games);
  renderProps(state.props);
  renderLeaderboard();
  updateSlip();

  // Re-check any pending entries from previous sessions
  state.entries
    .filter(e => e.status === 'pending')
    .forEach(e => scheduleResultCheck(e.id));

  // Auto-refresh live scores every 30s
  if (!usingDemo) setInterval(refreshScores, 30000);
}

async function refreshScores() {
  const games = await fetchTodaysGames();
  if (!games || !games.length) return;
  state.games = games;
  renderGames(games);
}

document.addEventListener('DOMContentLoaded', init);
