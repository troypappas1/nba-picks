/* ============================================================
   HoopPicks — app.js
   Backend: Firebase Firestore (global leaderboard, entries, groups)
   Games:   NBA official CDN scoreboard
============================================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, collection,
  addDoc, query, orderBy, limit, onSnapshot, getDocs, where,
  serverTimestamp, increment, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDTrNxtWHahIQUdmCvq38msAOFBu2SAPHc",
  authDomain: "hoop-picks.firebaseapp.com",
  projectId: "hoop-picks",
  storageBucket: "hoop-picks.firebasestorage.app",
  messagingSenderId: "326949366473",
  appId: "1:326949366473:web:33eb34bf9e1d3751f4bb18"
};

const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);

// ── Firestore helpers ────────────────────────────────────────
const usersCol   = () => collection(db, 'users');
const entriesCol = () => collection(db, 'entries');
const groupsCol  = () => collection(db, 'groups');

async function fbGetUser(username) {
  const snap = await getDoc(doc(db, 'users', username.toLowerCase()));
  return snap.exists() ? snap.data() : null;
}
async function fbSetUser(username, data) {
  await setDoc(doc(db, 'users', username.toLowerCase()), data, { merge: true });
}
async function fbGetCoins(username) {
  const u = await fbGetUser(username);
  return u ? (u.coins ?? STARTING_COINS) : STARTING_COINS;
}
async function fbUpdateCoins(username, newAmount) {
  await fbSetUser(username, { coins: Math.max(0, Math.round(newAmount)) });
}
async function fbAddEntry(entry) {
  return addDoc(entriesCol(), entry);
}
async function fbUpdateEntry(entryId, data) {
  await updateDoc(doc(db, 'entries', entryId), data);
}
async function fbGetUserEntries(username) {
  const q = query(entriesCol(), where('username','==',username.toLowerCase()), orderBy('createdAt','desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ fbId: d.id, ...d.data() }));
}

// ── Constants ────────────────────────────────────────────────
const NBA_SCOREBOARD = 'https://nba-prod-us-east-1-mediaops-stats.s3.amazonaws.com/NBA/liveData/scoreboard/todaysScoreboard_00.json';
const STARTING_COINS = 1000;
const WAGER_OPTIONS  = [50, 100, 250, 500];
const COIN_TIERS = [
  { picks:1, mult:1.5,  color:'#64748b' },
  { picks:2, mult:3,    color:'#22c55e' },
  { picks:3, mult:6,    color:'#3b82f6' },
  { picks:4, mult:12,   color:'#a855f7' },
  { picks:5, mult:25,   color:'#f59e0b' },
  { picks:6, mult:60,   color:'#ef4444' },
];

const TEAM_EMOJI = {
  ATL:'🦅',BOS:'🍀',BKN:'🕸️',CHA:'🐝',CHI:'🐂',CLE:'⚔️',
  DAL:'🤠',DEN:'⛏️',DET:'⚙️',GSW:'💛',HOU:'🚀',IND:'🏎️',
  LAC:'✂️',LAL:'💜',MEM:'🐻',MIA:'🔥',MIL:'🦌',MIN:'🐺',
  NOP:'🦩',NYK:'🗽',OKC:'⚡',ORL:'🪄',PHI:'🔔',PHX:'☀️',
  POR:'🌲',SAC:'👑',SAS:'🤠',TOR:'🦖',UTA:'🎷',WAS:'🧙'
};
const TEAM_FULL = {
  ATL:'Atlanta Hawks',BOS:'Boston Celtics',BKN:'Brooklyn Nets',
  CHA:'Charlotte Hornets',CHI:'Chicago Bulls',CLE:'Cleveland Cavaliers',
  DAL:'Dallas Mavericks',DEN:'Denver Nuggets',DET:'Detroit Pistons',
  GSW:'Golden State Warriors',HOU:'Houston Rockets',IND:'Indiana Pacers',
  LAC:'LA Clippers',LAL:'Los Angeles Lakers',MEM:'Memphis Grizzlies',
  MIA:'Miami Heat',MIL:'Milwaukee Bucks',MIN:'Minnesota Timberwolves',
  NOP:'New Orleans Pelicans',NYK:'New York Knicks',OKC:'Oklahoma City Thunder',
  ORL:'Orlando Magic',PHI:'Philadelphia 76ers',PHX:'Phoenix Suns',
  POR:'Portland Trail Blazers',SAC:'Sacramento Kings',SAS:'San Antonio Spurs',
  TOR:'Toronto Raptors',UTA:'Utah Jazz',WAS:'Washington Wizards'
};
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
  SAC:[{n:"De'Aaron Fox",s:'Points',l:23.5},{n:'Domantas Sabonis',s:'Rebounds',l:12.5}],
  SAS:[{n:'Victor Wembanyama',s:'Points',l:22.5},{n:'Devin Vassell',s:'Points',l:17.5}],
  TOR:[{n:'Scottie Barnes',s:'Points',l:19.5},{n:'RJ Barrett',s:'Points',l:19.5}],
  UTA:[{n:'Lauri Markkanen',s:'Points',l:22.5},{n:'Collin Sexton',s:'Points',l:18.5}],
  WAS:[{n:'Kyle Kuzma',s:'Points',l:20.5},{n:'Bradley Beal',s:'Points',l:21.5}],
};
const PLAYER_EMOJI = ['🏀','⚡','🔥','💪','🎯','👑','🦁','🐉','⭐','🚀','🎪','🏆'];

// ── State ────────────────────────────────────────────────────
let state = {
  user:    null,   // { username, coins, correct, total, streak, groups[] }
  picks:   {},
  entries: [],     // local cache of this user's entries
  games:   [],
  props:   [],
  wager:   100,
  activeGroup: null,  // group id currently viewed in leaderboard
  lbUnsub: null,      // firestore listener unsubscribe
};

// ── Utils ────────────────────────────────────────────────────
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDate(str) {
  return new Date(str+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
}
function showToast(msg, type='') {
  let t = document.getElementById('toast');
  if (!t) { t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast '+type;
  void t.offsetWidth;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 3200);
}

// keep username in localStorage so we auto-login on reload
function saveUserLocal() {
  if (state.user) localStorage.setItem('hoopp_username', state.user.username);
  else            localStorage.removeItem('hoopp_username');
}
function getSavedUsername() { return localStorage.getItem('hoopp_username'); }

// ── Auth ──────────────────────────────────────────────────────
function initAuth() {
  const loginBtn  = document.getElementById('login-btn');
  const modal     = document.getElementById('login-modal');
  const closeBtn  = document.getElementById('modal-close');
  const submitBtn = document.getElementById('login-submit');
  const input     = document.getElementById('username-input');

  loginBtn.addEventListener('click', () => {
    if (state.user) {
      state.user = null; saveUserLocal();
      loginBtn.textContent = 'Sign In';
      document.getElementById('username-display').textContent = 'Guest';
      document.getElementById('coin-display').textContent = '—';
      state.entries = [];
      renderMyPicks();
      showToast('Signed out');
    } else {
      modal.classList.remove('hidden'); input.focus();
    }
  });

  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', e => { if (e.target===modal) modal.classList.add('hidden'); });
  submitBtn.addEventListener('click', doLogin);
  input.addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });

  // Auto-login from saved username
  const saved = getSavedUsername();
  if (saved) doLoginWithName(saved, true);

  async function doLogin() {
    const raw = input.value.trim();
    if (!raw) return showToast('Enter a username','error');
    modal.classList.add('hidden');
    await doLoginWithName(raw.toLowerCase());
  }
}

async function doLoginWithName(rawName, silent=false) {
  const name = rawName.toLowerCase();
  showToast('Loading account…');

  // Check Firestore for existing user
  let userData = await fbGetUser(name);
  const isNew  = !userData;

  if (isNew) {
    userData = { username:name, coins:STARTING_COINS, correct:0, total:0, streak:0, groups:[], createdAt: Date.now() };
    await fbSetUser(name, userData);
  }

  state.user = userData;
  saveUserLocal();
  applyUser();

  if (!silent) {
    modal?.classList.add('hidden');
    showToast(
      isNew
        ? `Welcome, ${name}! You have 🪙${STARTING_COINS.toLocaleString()} to start`
        : `Welcome back, ${name}! 🪙${userData.coins.toLocaleString()}`,
      'success'
    );
  }

  // Load this user's entries from Firestore
  state.entries = await fbGetUserEntries(name);
  renderMyPicks();
  renderGroupsTab();

  // Re-check any pending entries
  state.entries.filter(e => e.status==='pending').forEach(e => scheduleResultCheck(e.fbId));
}

function applyUser() {
  document.getElementById('username-display').textContent = state.user.username;
  document.getElementById('login-btn').textContent = 'Sign Out';
  document.getElementById('coin-display').textContent = (state.user.coins||0).toLocaleString();
}

function getCoins()    { return state.user ? (state.user.coins||0) : 0; }
async function setCoins(n) {
  if (!state.user) return;
  const val = Math.max(0, Math.round(n));
  state.user.coins = val;
  document.getElementById('coin-display').textContent = val.toLocaleString();
  await fbUpdateCoins(state.user.username, val);
}

// ── Tabs ──────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(el=>el.classList.add('hidden'));
      document.getElementById('tab-'+tab).classList.remove('hidden');
      if (tab==='leaderboard') renderLeaderboard('global');
      if (tab==='my-picks')    renderMyPicks();
      if (tab==='groups')      renderGroupsTab();
    });
  });
}

// ── NBA CDN ───────────────────────────────────────────────────
async function fetchTodaysGames() {
  try {
    const res  = await fetch(NBA_SCOREBOARD+'?_='+Date.now());
    if (!res.ok) throw new Error('non-200');
    const data = await res.json();
    const raw  = data?.scoreboard?.games||[];
    if (!raw.length) return null;
    return raw.map(normalizeNBAGame);
  } catch(e) { console.warn('NBA CDN unavailable:',e.message); return null; }
}

function normalizeNBAGame(g) {
  const homeAbbr = g.homeTeam.teamTricode;
  const awayAbbr = g.awayTeam.teamTricode;
  const statusNum = g.gameStatus;
  let statusText = statusNum===2?'live':statusNum===3?'final':'scheduled';
  let timeStr = '';
  if (statusNum===1 && g.gameTimeUTC) {
    timeStr = new Date(g.gameTimeUTC).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  } else if (statusNum===2) {
    const raw = (g.gameClock||'').replace('PT','').replace('M',':').replace('S','');
    const parts = raw.split(':');
    timeStr = parts.length>=2 ? `Q${g.period} ${parts[0]}:${parts[1].split('.')[0].padStart(2,'0')}` : `Q${g.period}`;
  } else if (statusNum===3) {
    timeStr = 'Final';
  }
  return {
    id: String(g.gameId).padStart(10,'0'),
    status: statusText, time: timeStr, period: g.period||0,
    seriesText: g.seriesText||'',
    home_team:    { full_name:TEAM_FULL[homeAbbr]||g.homeTeam.teamName, abbreviation:homeAbbr },
    visitor_team: { full_name:TEAM_FULL[awayAbbr]||g.awayTeam.teamName, abbreviation:awayAbbr },
    home_team_score:    g.homeTeam.score||0,
    visitor_team_score: g.awayTeam.score||0,
  };
}

function getDemoGames() {
  const pairs = [['NYK','ATL'],['CLE','TOR'],['DEN','MIN']];
  return pairs.map(([away,home],i) => ({
    id:'demo_'+i, status:'scheduled',
    time:['7:00 PM ET','8:00 PM ET','9:30 PM ET'][i],
    period:0, seriesText:'',
    home_team:    {full_name:TEAM_FULL[home]||home, abbreviation:home},
    visitor_team: {full_name:TEAM_FULL[away]||away, abbreviation:away},
    home_team_score:0, visitor_team_score:0, _demo:true,
  }));
}

function buildPropsFromGames(games) {
  const props = []; const seen = new Set();
  games.forEach((g,gi) => {
    [g.home_team.abbreviation, g.visitor_team.abbreviation].forEach((abbr,ti) => {
      (TEAM_STARS[abbr]||[]).forEach((star,si) => {
        if (seen.has(star.n)) return; seen.add(star.n);
        const matchup = `${g.visitor_team.abbreviation} @ ${g.home_team.abbreviation}`;
        props.push({ id:`prop_${gi}_${ti}_${si}`, name:star.n, team:abbr,
          game:matchup, stat:star.s, line:star.l,
          emoji:PLAYER_EMOJI[(gi*4+ti*2+si)%PLAYER_EMOJI.length] });
      });
    });
  });
  return props;
}

// ── Render Games ──────────────────────────────────────────────
function renderGames(games) {
  const grid = document.getElementById('games-grid');
  grid.innerHTML = '';
  games.forEach(game => {
    const he=TEAM_EMOJI[game.home_team.abbreviation]||'🏀';
    const ae=TEAM_EMOJI[game.visitor_team.abbreviation]||'🏀';
    const isLive=game.status==='live', isFinal=game.status==='final';
    const showScores=isLive||isFinal;
    const hs=game.home_team_score, as=game.visitor_team_score;
    let statusHtml;
    if (isLive)       statusHtml=`<span class="game-status-live">LIVE · ${game.time}</span>`;
    else if (isFinal) statusHtml=`<span class="game-status-final">FINAL</span>`;
    else              statusHtml=`<span class="game-time">${game.time}</span>`;
    const seriesBadge = game.seriesText?`<span class="series-badge">${game.seriesText}</span>`:'';

    const card = document.createElement('div');
    card.className='game-card';
    card.innerHTML=`
      <div class="game-card-header">
        <span>${game.visitor_team.abbreviation} @ ${game.home_team.abbreviation} ${seriesBadge}</span>
        ${statusHtml}
      </div>
      <div class="game-matchup">
        <div class="team-side">
          <div class="team-logo">${ae}</div>
          <div class="team-abbr">${game.visitor_team.abbreviation}</div>
          <div class="team-name-small">${game.visitor_team.full_name}</div>
          <div class="team-score ${showScores?'':'empty'}">${showScores?as:'—'}</div>
        </div>
        <div class="vs-badge"><span>@</span></div>
        <div class="team-side">
          <div class="team-logo">${he}</div>
          <div class="team-abbr">${game.home_team.abbreviation}</div>
          <div class="team-name-small">${game.home_team.full_name}</div>
          <div class="team-score ${showScores?'':'empty'}">${showScores?hs:'—'}</div>
        </div>
      </div>
      <div class="pick-buttons">
        <button class="pick-btn" data-game="${game.id}" data-pick="away"
          data-label="${game.visitor_team.full_name}" data-detail="${game.visitor_team.abbreviation} to win">
          ${ae} ${game.visitor_team.abbreviation} Win
        </button>
        <button class="pick-btn" data-game="${game.id}" data-pick="home"
          data-label="${game.home_team.full_name}" data-detail="${game.home_team.abbreviation} to win">
          ${he} ${game.home_team.abbreviation} Win
        </button>
      </div>`;

    card.querySelectorAll('.pick-btn').forEach(btn => {
      const pickId=`game_${game.id}_${btn.dataset.pick}`;
      if (state.picks[pickId]) btn.classList.add('selected-win');
      btn.addEventListener('click', () => {
        const opp=btn.dataset.pick==='home'?'away':'home';
        const oppId=`game_${game.id}_${opp}`;
        if (state.picks[oppId]) { delete state.picks[oppId]; card.querySelector(`[data-pick="${opp}"]`)?.classList.remove('selected-win','selected-loss'); removeSlipItem(oppId); }
        if (state.picks[pickId]) { delete state.picks[pickId]; btn.classList.remove('selected-win','selected-loss'); removeSlipItem(pickId); }
        else {
          if (Object.keys(state.picks).length>=6) return showToast('Max 6 picks per entry','error');
          state.picks[pickId]={id:pickId,label:btn.dataset.label,detail:btn.dataset.detail,pickType:'win'};
          btn.classList.add('selected-win'); addSlipItem(pickId,state.picks[pickId]);
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
    card.className='prop-card';
    card.innerHTML=`
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
      </div>`;
    const overBtn=card.querySelector('.over-btn'), underBtn=card.querySelector('.under-btn');
    const overId=`prop_over_${prop.id}`, underId=`prop_under_${prop.id}`;
    if (state.picks[overId]) overBtn.classList.add('selected');
    if (state.picks[underId]) underBtn.classList.add('selected');
    overBtn.addEventListener('click', ()=>toggleProp(overId,underId,overBtn,underBtn,prop,'over'));
    underBtn.addEventListener('click', ()=>toggleProp(underId,overId,underBtn,overBtn,prop,'under'));
    grid.appendChild(card);
  });
}

function toggleProp(pickId,oppId,btn,oppBtn,prop,dir) {
  if (state.picks[oppId]) { delete state.picks[oppId]; oppBtn.classList.remove('selected'); removeSlipItem(oppId); }
  if (state.picks[pickId]) { delete state.picks[pickId]; btn.classList.remove('selected'); removeSlipItem(pickId); }
  else {
    if (Object.keys(state.picks).length>=6) return showToast('Max 6 picks per entry','error');
    state.picks[pickId]={id:pickId,label:prop.name,detail:`${dir==='over'?'Over':'Under'} ${prop.line} ${prop.stat}`,pickType:dir};
    btn.classList.add('selected'); addSlipItem(pickId,state.picks[pickId]);
  }
  updateSlip();
}

// ── Entry Slip ────────────────────────────────────────────────
function addSlipItem(id,pick) {
  const c=document.getElementById('slip-picks');
  c.querySelector('.slip-empty')?.remove();
  const item=document.createElement('div'); item.className='slip-item'; item.id='slip_'+id;
  item.innerHTML=`
    <div class="slip-item-left">
      <div class="slip-item-name">${pick.label}</div>
      <div class="slip-item-detail">${pick.detail}</div>
    </div>
    <span class="slip-item-pick ${pick.pickType==='under'?'under':'over win'}">${pick.pickType.toUpperCase()}</span>
    <button class="slip-item-remove" data-id="${id}">✕</button>`;
  item.querySelector('.slip-item-remove').addEventListener('click',()=>removePick(id));
  c.appendChild(item);
}
function removeSlipItem(id) {
  document.getElementById('slip_'+id)?.remove();
  const c=document.getElementById('slip-picks');
  if (!c.querySelector('.slip-item')) c.innerHTML='<p class="slip-empty">Add picks to build your entry</p>';
}
function removePick(id) {
  if (!state.picks[id]) return;
  delete state.picks[id];
  if (id.startsWith('game_')) {
    document.querySelectorAll('.pick-btn').forEach(b=>{
      if (`game_${b.dataset.game}_${b.dataset.pick}`===id) b.classList.remove('selected-win','selected-loss');
    });
  } else {
    const isOver=id.startsWith('prop_over_');
    const propId=id.replace('prop_over_','').replace('prop_under_','');
    document.querySelectorAll(isOver?'.over-btn':'.under-btn').forEach(b=>{
      if (b.dataset.prop===propId) b.classList.remove('selected');
    });
  }
  removeSlipItem(id); updateSlip();
}
function updateSlip() {
  const count=Object.keys(state.picks).length;
  document.getElementById('slip-count').textContent=`${count} / 6`;
  document.getElementById('picks-count').textContent=count;
  document.getElementById('slip-submit').disabled=count===0;
  renderSlipPayout(count);
}
function renderSlipPayout(count) {
  const el=document.getElementById('slip-payout-row');
  if (!el) return;
  if (count===0) { el.style.display='none'; return; }
  const tier=COIN_TIERS.find(t=>t.picks===count)||COIN_TIERS[COIN_TIERS.length-1];
  const payout=Math.round(state.wager*tier.mult);
  el.style.display='flex';
  el.innerHTML=`<span>Payout (${count} pick${count>1?'s':''})</span><span style="color:${tier.color};font-weight:700">🪙 ${payout.toLocaleString()}</span>`;
}
function initSlip() {
  document.getElementById('clear-slip').addEventListener('click',clearSlip);
  document.getElementById('slip-submit').addEventListener('click',submitEntry);
  WAGER_OPTIONS.forEach(amt=>{
    const btn=document.querySelector(`.wager-btn[data-amt="${amt}"]`);
    if (!btn) return;
    if (amt===state.wager) btn.classList.add('active');
    btn.addEventListener('click',()=>{
      state.wager=amt;
      document.querySelectorAll('.wager-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); updateSlip();
    });
  });
}
function clearSlip() {
  state.picks={};
  document.getElementById('slip-picks').innerHTML='<p class="slip-empty">Add picks to build your entry</p>';
  document.querySelectorAll('.pick-btn.selected-win,.pick-btn.selected-loss').forEach(b=>b.classList.remove('selected-win','selected-loss'));
  document.querySelectorAll('.over-btn.selected,.under-btn.selected').forEach(b=>b.classList.remove('selected'));
  updateSlip();
}

// ── Submit Entry ──────────────────────────────────────────────
async function submitEntry() {
  if (!state.user) { document.getElementById('login-modal').classList.remove('hidden'); return showToast('Sign in to submit picks!','error'); }
  const count=Object.keys(state.picks).length;
  if (count===0) return showToast('Add at least 1 pick','error');
  const coins=getCoins();
  if (coins<state.wager) return showToast(`Not enough coins! You have 🪙${coins}`,'error');

  const tier=COIN_TIERS.find(t=>t.picks===count)||COIN_TIERS[COIN_TIERS.length-1];
  const potentialPayout=Math.round(state.wager*tier.mult);

  await setCoins(coins-state.wager);

  const entry = {
    username:       state.user.username,
    date:           today(),
    picks:          Object.values(state.picks).map(p=>({...p,result:'pending'})),
    status:         'pending',
    submittedAt:    new Date().toLocaleTimeString(),
    createdAt:      Date.now(),
    wager:          state.wager,
    potentialPayout,
    mult:           tier.mult,
  };

  const ref  = await fbAddEntry(entry);
  const full = { fbId:ref.id, ...entry };
  state.entries.unshift(full);
  clearSlip();
  showToast(`Entry submitted! Wagered 🪙${state.wager} · potential 🪙${potentialPayout.toLocaleString()}`,'success');
  renderMyPicks();
  scheduleResultCheck(ref.id);
}

// ── Result Grading ────────────────────────────────────────────
// Polls NBA CDN every 60s until all games in the entry are final,
// then grades picks against real scores.
// WIN = ALL picks correct → payout credited. LOSS = nothing returned.

function scheduleResultCheck(fbEntryId) {
  checkEntryResults(fbEntryId);
}

async function checkEntryResults(fbEntryId) {
  const entry=state.entries.find(e=>e.fbId===fbEntryId);
  if (!entry||entry.status!=='pending') return;

  let games;
  try {
    const res=await fetch(NBA_SCOREBOARD+'?_='+Date.now());
    if (!res.ok) throw new Error();
    const data=await res.json();
    games=(data?.scoreboard?.games||[]).map(normalizeNBAGame);
  } catch { setTimeout(()=>checkEntryResults(fbEntryId),60000); return; }

  const gameMap={};
  games.forEach(g=>{ gameMap[String(g.id).padStart(10,'0')]=g; });

  const gamePickIds=entry.picks
    .filter(p=>p.id.startsWith('game_'))
    .map(p=>{
      const withoutPrefix=p.id.replace(/^game_/,'');
      const side=withoutPrefix.split('_').pop();
      const rawId=withoutPrefix.slice(0,-(side.length+1));
      return { pick:p, gameId:rawId.padStart(10,'0'), side };
    });

  // If no game picks, can't grade — keep pending
  if (gamePickIds.length===0) { setTimeout(()=>checkEntryResults(fbEntryId),60000); return; }

  const allFinal=gamePickIds.every(({gameId})=>{ const g=gameMap[gameId]; return g&&g.status==='final'; });
  if (!allFinal) { setTimeout(()=>checkEntryResults(fbEntryId),60000); return; }

  // Grade each pick
  let correct=0;
  gamePickIds.forEach(({pick,gameId,side})=>{
    const g=gameMap[gameId];
    if (!g) { pick.result='pending'; return; }
    const homeWon=g.home_team_score>g.visitor_team_score;
    pick.result=(side==='home'===homeWon)?'correct':'wrong';
    if (pick.result==='correct') correct++;
  });
  // Prop picks stay pending (no box score grading yet)
  entry.picks.filter(p=>!p.id.startsWith('game_')).forEach(p=>{ if(p.result==='pending') p.result='pending'; });

  const total=gamePickIds.length;
  const allCorrect=correct===total;
  entry.status=allCorrect?'won':'lost';
  entry.correct=correct;

  // Payout: win gets potentialPayout, loss gets nothing
  if (allCorrect) {
    await setCoins(getCoins()+entry.potentialPayout);
    showToast(`💰 ALL CORRECT! +🪙${entry.potentialPayout.toLocaleString()} credited!`,'success');
  } else {
    showToast(`Results in — ${correct}/${total} correct. 🪙${entry.wager} lost.`);
  }

  // Update Firestore entry
  await fbUpdateEntry(fbEntryId,{ status:entry.status, correct, picks:entry.picks });

  // Update user stats in Firestore
  await fbSetUser(state.user.username,{
    correct: (state.user.correct||0)+correct,
    total:   (state.user.total||0)+total,
    streak:  allCorrect ? (state.user.streak||0)+1 : 0,
  });
  state.user.correct=(state.user.correct||0)+correct;
  state.user.total=(state.user.total||0)+total;
  state.user.streak=allCorrect?(state.user.streak||0)+1:0;

  renderMyPicks();
}

// ── Global Leaderboard (real-time Firestore listener) ─────────
function initLeaderboardBack() {
  const btn=document.getElementById('lb-back-global');
  if (btn) btn.addEventListener('click',()=>{ btn.classList.add('hidden'); renderLeaderboard('global'); });
}

function renderLeaderboard(mode='global', groupId=null) {
  const backBtn=document.getElementById('lb-back-global');
  if (backBtn) backBtn.classList.toggle('hidden', mode==='global');
  // Unsubscribe previous listener
  if (state.lbUnsub) { state.lbUnsub(); state.lbUnsub=null; }

  const tbody=document.getElementById('leaderboard-body');
  const titleEl=document.getElementById('lb-title');
  tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">Loading…</td></tr>';

  let q;
  if (mode==='group' && groupId) {
    // Will filter client-side after fetching group members
    loadGroupLeaderboard(groupId); return;
  } else {
    q=query(usersCol(), orderBy('coins','desc'), limit(50));
    if (titleEl) titleEl.textContent='Global Leaderboard';
  }

  state.lbUnsub = onSnapshot(q, snap => {
    const users=snap.docs.map(d=>d.data());
    populateLbTable(users);
  });
}

function populateLbTable(users) {
  const tbody=document.getElementById('leaderboard-body');
  tbody.innerHTML='';
  if (!users.length) {
    tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">No players yet</td></tr>'; return;
  }
  users.forEach((u,i)=>{
    const rank=i+1;
    const acc=u.total>0?((u.correct/u.total)*100).toFixed(1):'0.0';
    const isMe=state.user&&u.username===state.user.username;
    const rankIcon=rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':rank;
    const rankClass=rank===1?'top1':rank===2?'top2':rank===3?'top3':'';
    const streakStr=u.streak>0?`<span class="streak-fire">🔥</span>${u.streak}`:'—';
    const tr=document.createElement('tr');
    if (isMe) tr.style.background='rgba(124,58,237,0.08)';
    tr.innerHTML=`
      <td><span class="lb-rank ${rankClass}">${rankIcon}</span></td>
      <td><span class="lb-username">${u.username}${isMe?'<span class="lb-me-badge">YOU</span>':''}</span></td>
      <td class="lb-coins">🪙 ${(u.coins||0).toLocaleString()}</td>
      <td>${u.correct||0}</td>
      <td class="lb-accuracy">${acc}%</td>
      <td class="lb-streak">${streakStr}</td>`;
    tbody.appendChild(tr);
  });
}

async function loadGroupLeaderboard(groupId) {
  const titleEl=document.getElementById('lb-title');
  const snap=await getDoc(doc(db,'groups',groupId));
  if (!snap.exists()) return;
  const group=snap.data();
  if (titleEl) titleEl.textContent=`${group.name} — Group Leaderboard`;

  // Fetch each member's user doc
  const memberDocs=await Promise.all(group.members.map(m=>getDoc(doc(db,'users',m))));
  const users=memberDocs.filter(d=>d.exists()).map(d=>d.data());
  users.sort((a,b)=>(b.coins||0)-(a.coins||0));
  populateLbTable(users);
}

// ── Groups ────────────────────────────────────────────────────
function renderGroupsTab() {
  const container=document.getElementById('groups-content');
  if (!container) return;
  if (!state.user) { container.innerHTML='<p class="empty-msg">Sign in to use groups.</p>'; return; }
  container.innerHTML=`
    <div class="groups-wrapper">
      <div class="groups-actions">
        <button class="btn-primary" id="create-group-btn">+ Create Group</button>
        <button class="btn-secondary" id="join-group-btn">Join Group</button>
      </div>
      <div id="my-groups-list"></div>
    </div>`;
  document.getElementById('create-group-btn').addEventListener('click',showCreateGroup);
  document.getElementById('join-group-btn').addEventListener('click',showJoinGroup);
  loadMyGroups();
}

async function loadMyGroups() {
  const list=document.getElementById('my-groups-list');
  if (!list) return;
  list.innerHTML='<p style="color:var(--text3);font-size:0.85rem">Loading groups…</p>';

  const groups=state.user.groups||[];
  if (!groups.length) { list.innerHTML='<p class="empty-msg">No groups yet. Create one or join with a code!</p>'; return; }

  const snaps=await Promise.all(groups.map(id=>getDoc(doc(db,'groups',id))));
  const valid=snaps.filter(s=>s.exists()).map(s=>({id:s.id,...s.data()}));

  list.innerHTML='';
  valid.forEach(g=>{
    const card=document.createElement('div');
    card.className='group-card';
    card.innerHTML=`
      <div class="group-card-info">
        <div class="group-name">${g.name}</div>
        <div class="group-meta">${g.members.length} members · Code: <strong>${g.code}</strong></div>
      </div>
      <button class="btn-primary btn-sm view-group-lb" data-id="${g.id}">View Leaderboard</button>`;
    card.querySelector('.view-group-lb').addEventListener('click',()=>{
      // Switch to leaderboard tab showing this group
      document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
      document.querySelector('[data-tab="leaderboard"]').classList.add('active');
      document.querySelectorAll('.tab-content').forEach(el=>el.classList.add('hidden'));
      document.getElementById('tab-leaderboard').classList.remove('hidden');
      renderLeaderboard('group', g.id);
    });
    list.appendChild(card);
  });
}

function showCreateGroup() {
  const name=prompt('Group name:');
  if (!name?.trim()) return;
  createGroup(name.trim());
}

async function createGroup(name) {
  const code=Math.random().toString(36).slice(2,8).toUpperCase();
  const ref=await addDoc(groupsCol(),{
    name, code, createdBy:state.user.username,
    members:[state.user.username], createdAt:Date.now()
  });
  // Add group to user's groups array
  const groups=[...(state.user.groups||[]), ref.id];
  await fbSetUser(state.user.username,{groups});
  state.user.groups=groups;
  showToast(`Group "${name}" created! Code: ${code}`,'success');
  renderGroupsTab();
}

function showJoinGroup() {
  const code=prompt('Enter group code:');
  if (!code?.trim()) return;
  joinGroup(code.trim().toUpperCase());
}

async function joinGroup(code) {
  const q=query(groupsCol(),where('code','==',code));
  const snap=await getDocs(q);
  if (snap.empty) return showToast('Group not found — check the code','error');

  const groupDoc=snap.docs[0];
  const group=groupDoc.data();
  if (group.members.includes(state.user.username)) return showToast('You\'re already in this group!');

  await updateDoc(doc(db,'groups',groupDoc.id),{ members:[...group.members,state.user.username] });
  const groups=[...(state.user.groups||[]),groupDoc.id];
  await fbSetUser(state.user.username,{groups});
  state.user.groups=groups;
  showToast(`Joined "${group.name}"!`,'success');
  renderGroupsTab();
}

// ── My Picks ──────────────────────────────────────────────────
function renderMyPicks() {
  const container=document.getElementById('my-picks-list');
  if (!state.user) { container.innerHTML='<p class="empty-msg">Sign in to see your picks.</p>'; return; }
  if (!state.entries.length) { container.innerHTML='<p class="empty-msg">No entries yet. Make some picks!</p>'; return; }

  container.innerHTML='';
  state.entries.forEach(entry=>{
    const sc=entry.status==='won'?'won':entry.status==='lost'?'lost':'pending';
    const sl=entry.status==='won'?'Won':entry.status==='lost'?'Lost':'Pending';
    const coinResult=entry.status==='won'
      ?`<span style="color:var(--green);font-weight:700">+🪙${entry.potentialPayout.toLocaleString()}</span>`
      :entry.status==='lost'
      ?`<span style="color:var(--red)">-🪙${entry.wager}</span>`
      :`<span style="color:var(--yellow)">🪙${entry.wager} wagered</span>`;

    const card=document.createElement('div'); card.className='entry-card';
    card.innerHTML=`
      <div class="entry-card-header">
        <div><strong>Entry #${String(entry.createdAt||entry.fbId).slice(-4)}</strong><span> · ${entry.date} at ${entry.submittedAt}</span></div>
        <div style="display:flex;align-items:center;gap:10px">${coinResult}<span class="entry-status ${sc}">${sl}</span></div>
      </div>
      <div class="entry-picks-list" id="picks-list-${entry.fbId}"></div>
      <div style="font-size:0.78rem;color:var(--text3);margin-top:4px">
        Wager: 🪙${entry.wager} · Potential: 🪙${entry.potentialPayout.toLocaleString()} · ${entry.mult}× multiplier
      </div>`;
    container.appendChild(card);
    renderPickRows(entry);
  });
}

function renderPickRows(entry) {
  const list=document.getElementById(`picks-list-${entry.fbId}`);
  if (!list) return;
  list.innerHTML='';
  entry.picks.forEach((pick,idx)=>{
    const rc=pick.result==='correct'?'pick-result-correct':pick.result==='wrong'?'pick-result-wrong':'pick-result-pending';
    const ri=pick.result==='correct'?'✓':pick.result==='wrong'?'✗':'•';
    const expandId=`tracker-${entry.fbId}-${idx}`;
    const row=document.createElement('div'); row.className='entry-pick-row expandable';
    row.innerHTML=`
      <div class="pick-row-main">
        <span class="pick-row-label">${pick.label}</span>
        <span class="pick-row-detail">${pick.detail}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="pick-row-chevron">▼</span>
          <span class="${rc}">${ri}</span>
        </div>
      </div>
      <div class="pick-tracker" id="${expandId}" style="display:none"></div>`;
    row.querySelector('.pick-row-main').addEventListener('click',()=>{
      const tracker=document.getElementById(expandId);
      const chevron=row.querySelector('.pick-row-chevron');
      const isOpen=tracker.style.display!=='none';
      tracker.style.display=isOpen?'none':'block';
      chevron.textContent=isOpen?'▼':'▲';
      if (!isOpen) loadTracker(pick,tracker,entry);
    });
    list.appendChild(row);
  });
}

// ── Tracker ───────────────────────────────────────────────────
async function loadTracker(pick,el,entry) {
  el.innerHTML='<div class="tracker-loading"><div class="spinner-sm"></div> Loading live data…</div>';
  if (pick.id.startsWith('game_')) await loadGameTracker(pick,el);
  else await loadPropTracker(pick,el,entry);
}

async function loadGameTracker(pick,el) {
  const withoutPrefix=pick.id.replace(/^game_/,'');
  const side=withoutPrefix.split('_').pop();
  const rawId=withoutPrefix.slice(0,-(side.length+1));
  const gameId=rawId.padStart(10,'0');

  let liveGame=state.games.find(g=>String(g.id).padStart(10,'0')===gameId)||null;
  try {
    const res=await fetch(NBA_SCOREBOARD+'?_='+Date.now());
    const data=await res.json();
    const found=(data?.scoreboard?.games||[]).map(normalizeNBAGame).find(g=>String(g.id).padStart(10,'0')===gameId);
    if (found) liveGame=found;
  } catch {}

  if (!liveGame) { el.innerHTML='<p class="tracker-empty">Game data not available yet.</p>'; return; }

  const hs=liveGame.home_team_score||0, as=liveGame.visitor_team_score||0;
  const pickedTeam=side==='home'?liveGame.home_team:liveGame.visitor_team;
  const otherTeam=side==='home'?liveGame.visitor_team:liveGame.home_team;
  const pickedScore=side==='home'?hs:as;
  const otherScore=side==='home'?as:hs;
  const isWinning=pickedScore>otherScore, isTied=pickedScore===otherScore;
  const diff=pickedScore-otherScore;
  const isFinal=liveGame.status==='final', isLive=liveGame.status==='live', isPreGame=liveGame.status==='scheduled';

  let clampedPct,barColor,statusLine;
  if (isPreGame) {
    clampedPct=0; barColor='var(--text3)'; statusLine=`Pre-game · ${liveGame.time}`;
  } else {
    const total=pickedScore+otherScore;
    clampedPct=total===0?50:Math.min(100,Math.max(0,(pickedScore/total)*100));
    barColor=isFinal?(isWinning?'var(--green)':'var(--red)'):isWinning?'var(--green)':isTied?'var(--yellow)':'var(--red)';
    statusLine=isFinal?(isWinning?`✓ ${pickedTeam.abbreviation} won`:`✗ ${pickedTeam.abbreviation} lost`):isTied?'Tied':isWinning?`+${diff} lead`:`Down ${Math.abs(diff)}`;
  }

  el.innerHTML=`
    <div class="tracker-box">
      <div class="tracker-matchup-row">
        <span class="tracker-team picked">${TEAM_EMOJI[pickedTeam.abbreviation]||'🏀'} ${pickedTeam.abbreviation} <span class="tracker-score">${isPreGame?'—':pickedScore}</span></span>
        <span class="tracker-vs">vs</span>
        <span class="tracker-team other">${TEAM_EMOJI[otherTeam.abbreviation]||'🏀'} ${otherTeam.abbreviation} <span class="tracker-score">${isPreGame?'—':otherScore}</span></span>
      </div>
      <div class="tracker-bar-wrap">
        <div class="tracker-bar-label">
          <span>${pickedTeam.abbreviation} score share</span>
          <span class="tracker-status-label" style="color:${barColor}">${statusLine}</span>
        </div>
        <div class="tracker-bar-bg">
          <div class="tracker-bar-fill" style="width:${clampedPct}%;background:${barColor}"></div>
          <div class="tracker-bar-line" style="left:50%"></div>
        </div>
        <div class="tracker-bar-ends"><span>Behind</span><span>Even</span><span>Ahead</span></div>
      </div>
      ${isLive?`<div class="tracker-live-dot">● LIVE · ${liveGame.time}</div>`:''}
      ${isFinal?'<div class="tracker-final-tag">FINAL</div>':''}
    </div>`;
}

async function loadPropTracker(pick,el,entry) {
  const detailParts=pick.detail.split(' ');
  const dir=detailParts[0].toLowerCase();
  const line=parseFloat(detailParts[1]);
  const stat=detailParts.slice(2).join(' ');
  const playerTeam=findPlayerTeam(pick.label);
  const game=playerTeam?state.games.find(g=>g.home_team.abbreviation===playerTeam||g.visitor_team.abbreviation===playerTeam):null;

  if (!game) { renderPropTrackerBar(el,pick.label,stat,line,dir,null,'Game not found — check back closer to tip-off.'); return; }
  if (game.status==='scheduled') { renderPropTrackerBar(el,pick.label,stat,line,dir,0,null,true); return; }

  let current=null;
  try {
    const paddedId=String(game.id).padStart(10,'0');
    const res=await fetch(`https://nba-prod-us-east-1-mediaops-stats.s3.amazonaws.com/NBA/liveData/boxscore/boxscore_${paddedId}.json?_=${Date.now()}`);
    const data=await res.json();
    const allPlayers=[...(data?.game?.homeTeam?.players||[]),...(data?.game?.awayTeam?.players||[])];
    const playerData=allPlayers.find(p=>
      p.name?.toLowerCase().includes(pick.label.split(' ').slice(-1)[0].toLowerCase())||
      pick.label.toLowerCase().includes((p.name||'').toLowerCase())
    );
    if (playerData?.statistics) {
      const s=playerData.statistics;
      const statMap={'points':s.points,'rebounds':s.reboundsTotal,'assists':s.assists,'blocks':s.blocks,'steals':s.steals};
      current=statMap[stat.toLowerCase()]??null;
    }
  } catch {}
  renderPropTrackerBar(el,pick.label,stat,line,dir,current,current===null?'Live box score unavailable — check back during/after game':null);
}

function renderPropTrackerBar(el,playerName,stat,line,dir,current,note,isPreGame=false) {
  if (current===null) {
    el.innerHTML=`<div class="tracker-box"><div class="tracker-prop-header"><span class="tracker-player-name">${playerName}</span><span class="tracker-prop-line">${dir==='over'?'▲ Over':'▼ Under'} ${line} ${stat}</span></div><p class="tracker-note">${note}</p></div>`; return;
  }
  const maxVal=line*1.5;
  const pct=isPreGame?0:Math.min(100,(current/maxVal)*100);
  const linePct=(line/maxVal)*100;
  const hitting=isPreGame?null:(dir==='over'?current>=line:current<=line);
  const barColor=isPreGame?'var(--text3)':hitting?'var(--green)':'var(--red)';
  const statusLine=isPreGame?'Game hasn\'t started yet':dir==='over'?(current>=line?`✓ Hit! (${current})`:`Need ${(line-current).toFixed(1)} more`):(current<=line?`✓ Tracking under (${current})`:`⚠ ${(current-line).toFixed(1)} over line`);
  el.innerHTML=`
    <div class="tracker-box">
      <div class="tracker-prop-header">
        <span class="tracker-player-name">${playerName}</span>
        <span class="tracker-prop-line">${dir==='over'?'▲ Over':'▼ Under'} ${line} ${stat}</span>
      </div>
      <div class="tracker-stat-display">
        <span class="tracker-current-val" style="color:${barColor}">${isPreGame?'0':current}</span>
        <span class="tracker-stat-label">${stat.toLowerCase()} so far</span>
      </div>
      <div class="tracker-bar-wrap">
        <div class="tracker-bar-label"><span>0</span><span class="tracker-status-label" style="color:${barColor}">${statusLine}</span><span>${maxVal.toFixed(0)}</span></div>
        <div class="tracker-bar-bg" style="position:relative">
          <div class="tracker-bar-fill" style="width:${pct}%;background:${barColor}"></div>
          <div class="tracker-bar-line" style="left:${linePct}%"></div>
          <div class="tracker-line-label" style="left:${linePct}%">${line}</div>
        </div>
      </div>
    </div>`;
}

function findPlayerTeam(playerName) {
  const lower=playerName.toLowerCase();
  for (const [abbr,stars] of Object.entries(TEAM_STARS)) {
    if (stars.some(s=>s.n.toLowerCase()===lower)) return abbr;
  }
  return null;
}

async function refreshScores() {
  const games=await fetchTodaysGames();
  if (!games||!games.length) return;
  state.games=games; renderGames(games);
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  initTabs();
  initSlip();
  document.getElementById('today-date').textContent=fmtDate(today());

  const loadingEl=document.getElementById('loading-state');
  const noGamesEl=document.getElementById('no-games-state');

  let games=await fetchTodaysGames();
  let usingDemo=false;
  if (!games||!games.length) { usingDemo=true; games=getDemoGames(); noGamesEl.classList.remove('hidden'); }
  loadingEl.classList.add('hidden');
  state.games=games;
  state.props=buildPropsFromGames(games);
  renderGames(games); renderProps(state.props); updateSlip();

  // Auth init (may auto-login from saved username)
  initAuth();
  initLeaderboardBack();

  // Global leaderboard live listener
  renderLeaderboard('global');

  if (!usingDemo) setInterval(refreshScores,30000);
}

document.addEventListener('DOMContentLoaded', init);
