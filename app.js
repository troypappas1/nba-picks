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
const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
const NBA_BOXSCORE_BASE = 'https://nba-prod-us-east-1-mediaops-stats.s3.amazonaws.com/NBA/liveData/boxscore/boxscore_';
const STARTING_COINS = 1000;  // cents → $10.00
const WAGER_OPTIONS  = [50, 100, 250, 500];  // cents → $0.50, $1.00, $2.50, $5.00
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
// 2024-25 season averages — lines set at season avg ±0.5 (sportsbook style)
// Injured players removed: Embiid (OUT), Doncic (OUT hamstring), Wembanyama (GTD)
const TEAM_STARS = {
  ATL:[
    {n:'Trae Young',       s:'Points',   l:23.5},  // 23.6 PPG
    {n:'Trae Young',       s:'Assists',  l:10.5},  // 11.4 APG
    {n:'Dyson Daniels',    s:'Points',   l:13.5},  // 14.0 PPG
    {n:'Onyeka Okongwu',   s:'Rebounds', l:8.5},   // 8.9 RPG
  ],
  BOS:[
    {n:'Jayson Tatum',     s:'Points',   l:27.5},  // 28.0 PPG
    {n:'Jaylen Brown',     s:'Points',   l:22.5},  // 22.8 PPG
    {n:'Jayson Tatum',     s:'Rebounds', l:8.5},   // 8.6 RPG
    {n:'Derrick White',    s:'Points',   l:14.5},  // 14.9 PPG
  ],
  BKN:[
    {n:'Cam Thomas',       s:'Points',   l:22.5},  // 23.1 PPG
    {n:'Nic Claxton',      s:'Rebounds', l:8.5},   // 9.0 RPG
    {n:'Ziaire Williams',  s:'Points',   l:13.5},
  ],
  CHA:[
    {n:'LaMelo Ball',      s:'Points',   l:29.5},  // 30.3 PPG (when healthy)
    {n:'LaMelo Ball',      s:'Assists',  l:5.5},   // 5.8 APG
    {n:'Brandon Miller',   s:'Points',   l:17.5},  // 18.1 PPG
  ],
  CHI:[
    {n:'Zach LaVine',      s:'Points',   l:23.5},  // 24.1 PPG
    {n:'Nikola Vucevic',   s:'Rebounds', l:11.5},  // 11.9 RPG
    {n:'Coby White',       s:'Points',   l:18.5},  // 19.3 PPG
    {n:'Josh Giddey',      s:'Assists',  l:5.5},
  ],
  CLE:[
    {n:'Donovan Mitchell', s:'Points',   l:25.5},  // 25.9 PPG
    {n:'Darius Garland',   s:'Assists',  l:6.5},   // 6.8 APG
    {n:'Evan Mobley',      s:'Rebounds', l:8.5},   // 8.9 RPG
    {n:'Jarrett Allen',    s:'Rebounds', l:9.5},   // 10.1 RPG
  ],
  DAL:[
    // Luka Doncic OUT (hamstring) — removed from props
    {n:'Kyrie Irving',     s:'Points',   l:23.5},  // 23.6 PPG
    {n:'Klay Thompson',    s:'Points',   l:14.5},  // 14.5 PPG
    {n:'P.J. Washington',  s:'Points',   l:13.5},
  ],
  DEN:[
    {n:'Nikola Jokic',     s:'Points',   l:29.5},  // 29.9 PPG
    {n:'Nikola Jokic',     s:'Rebounds', l:12.5},  // 12.7 RPG
    {n:'Nikola Jokic',     s:'Assists',  l:9.5},   // 10.2 APG
    {n:'Jamal Murray',     s:'Points',   l:18.5},  // 19.1 PPG
  ],
  DET:[
    {n:'Cade Cunningham',  s:'Points',   l:25.5},  // 26.1 PPG
    {n:'Cade Cunningham',  s:'Assists',  l:8.5},   // 9.0 APG
    {n:'Jalen Duren',      s:'Rebounds', l:11.5},  // 11.6 RPG
    {n:'Ausar Thompson',   s:'Points',   l:13.5},
  ],
  GSW:[
    {n:'Stephen Curry',    s:'Points',   l:24.5},  // 24.9 PPG
    {n:'Stephen Curry',    s:'Assists',  l:5.5},   // 5.8 APG
    {n:'Buddy Hield',      s:'Points',   l:14.5},
    {n:'Jonathan Kuminga', s:'Points',   l:16.5},
  ],
  HOU:[
    {n:'Alperen Sengun',   s:'Points',   l:21.5},  // 22.1 PPG
    {n:'Alperen Sengun',   s:'Rebounds', l:8.5},   // 8.9 RPG
    {n:'Jalen Green',      s:'Points',   l:20.5},  // 20.7 PPG
    {n:'Amen Thompson',    s:'Rebounds', l:7.5},
    {n:'Fred VanVleet',    s:'Assists',  l:6.5},
  ],
  IND:[
    {n:'Tyrese Haliburton', s:'Points',  l:18.5},  // 19.0 PPG
    {n:'Tyrese Haliburton', s:'Assists', l:9.5},   // 9.9 APG
    {n:'Pascal Siakam',    s:'Points',   l:20.5},  // 20.8 PPG
    {n:'Myles Turner',     s:'Blocks',   l:2.5},   // 2.6 BPG
  ],
  LAC:[
    {n:'James Harden',     s:'Points',   l:19.5},  // 20.0 PPG
    {n:'James Harden',     s:'Assists',  l:8.5},   // 8.6 APG
    {n:'Ivica Zubac',      s:'Rebounds', l:11.5},  // 11.7 RPG
    {n:'Norman Powell',    s:'Points',   l:22.5},  // 23.1 PPG
  ],
  LAL:[
    {n:'LeBron James',     s:'Points',   l:23.5},  // 23.7 PPG
    {n:'Anthony Davis',    s:'Points',   l:25.5},  // 25.7 PPG
    {n:'Anthony Davis',    s:'Rebounds', l:11.5},  // 11.7 RPG
    {n:'Austin Reaves',    s:'Points',   l:18.5},  // 19.0 PPG
  ],
  MEM:[
    {n:'Ja Morant',        s:'Points',   l:22.5},  // 22.8 PPG
    {n:'Ja Morant',        s:'Assists',  l:7.5},   // 8.0 APG
    {n:'Jaren Jackson Jr.',s:'Points',   l:21.5},  // 21.6 PPG
    {n:'Jaren Jackson Jr.',s:'Blocks',   l:2.5},   // 2.7 BPG
    {n:'Desmond Bane',     s:'Points',   l:19.5},
  ],
  MIA:[
    {n:'Tyler Herro',      s:'Points',   l:23.5},  // 23.9 PPG
    {n:'Bam Adebayo',      s:'Points',   l:17.5},
    {n:'Bam Adebayo',      s:'Rebounds', l:9.5},   // 10.1 RPG
    {n:'Nikola Jovic',     s:'Points',   l:11.5},
  ],
  MIL:[
    {n:'Giannis Antetokounmpo', s:'Points',   l:30.5},  // 30.4 PPG
    {n:'Giannis Antetokounmpo', s:'Rebounds', l:11.5},  // 11.7 RPG
    {n:'Damian Lillard',   s:'Points',   l:24.5},  // 24.9 PPG
    {n:'Damian Lillard',   s:'Assists',  l:4.5},
  ],
  MIN:[
    {n:'Anthony Edwards',  s:'Points',   l:25.5},  // 25.8 PPG
    {n:'Julius Randle',    s:'Points',   l:23.5},  // 24.1 PPG (traded to MIN)
    {n:'Julius Randle',    s:'Rebounds', l:9.5},
    {n:'Rudy Gobert',      s:'Rebounds', l:12.5},  // 12.3 RPG
  ],
  NOP:[
    {n:'Zion Williamson',  s:'Points',   l:24.5},  // 24.9 PPG (when healthy)
    {n:'CJ McCollum',      s:'Points',   l:18.5},
    {n:'Brandon Ingram',   s:'Points',   l:22.5},  // traded — verify availability
  ],
  NYK:[
    {n:'Jalen Brunson',    s:'Points',   l:27.5},  // 28.3 PPG
    {n:'Jalen Brunson',    s:'Assists',  l:6.5},   // 6.6 APG
    {n:'Karl-Anthony Towns', s:'Points', l:24.5},  // 25.1 PPG
    {n:'Karl-Anthony Towns', s:'Rebounds', l:12.5},// 13.0 RPG
    {n:'OG Anunoby',       s:'Points',   l:15.5},
    {n:'Mikal Bridges',    s:'Points',   l:18.5},  // 19.0 PPG
  ],
  OKC:[
    {n:'Shai Gilgeous-Alexander', s:'Points',  l:31.5},  // 32.0 PPG
    {n:'Shai Gilgeous-Alexander', s:'Assists', l:5.5},
    {n:'Jalen Williams',   s:'Points',   l:22.5},  // 22.8 PPG
    {n:'Chet Holmgren',    s:'Rebounds', l:7.5},
  ],
  ORL:[
    {n:'Paolo Banchero',   s:'Points',   l:24.5},  // 25.0 PPG
    {n:'Paolo Banchero',   s:'Rebounds', l:7.5},
    {n:'Franz Wagner',     s:'Points',   l:24.5},  // 25.0 PPG
    {n:'Wendell Carter Jr.',s:'Rebounds',l:9.5},
  ],
  PHI:[
    // Joel Embiid OUT — removed from props
    {n:'Tyrese Maxey',     s:'Points',   l:27.5},  // 28.3 PPG
    {n:'Tyrese Maxey',     s:'Assists',  l:6.5},   // 6.6 APG
    {n:'Paul George',      s:'Points',   l:17.5},  // 17.8 PPG
    {n:'Kelly Oubre Jr.',  s:'Points',   l:13.5},
  ],
  PHX:[
    {n:'Kevin Durant',     s:'Points',   l:25.5},  // 26.0 PPG
    {n:'Kevin Durant',     s:'Rebounds', l:5.5},   // 5.5 RPG
    {n:'Devin Booker',     s:'Points',   l:25.5},  // 25.7 PPG
    {n:'Bradley Beal',     s:'Points',   l:13.5},
  ],
  POR:[
    {n:'Deni Avdija',      s:'Points',   l:23.5},  // 24.2 PPG
    {n:'Deni Avdija',      s:'Assists',  l:6.5},   // 6.7 APG
    {n:'Anfernee Simons',  s:'Points',   l:20.5},
    {n:'Donovan Clingan',  s:'Rebounds', l:11.5},  // 11.6 RPG
    {n:'Shaedon Sharpe',   s:'Points',   l:16.5},
    {n:'Toumani Camara',   s:'Rebounds', l:7.5},
  ],
  SAC:[
    {n:"De'Aaron Fox",     s:'Points',   l:25.5},  // 26.1 PPG
    {n:"De'Aaron Fox",     s:'Assists',  l:5.5},
    {n:'Domantas Sabonis', s:'Rebounds', l:13.5},  // 13.9 RPG
    {n:'Domantas Sabonis', s:'Assists',  l:7.5},   // 7.9 APG
    {n:'Zach LaVine',      s:'Points',   l:22.5},  // traded to SAC
  ],
  SAS:[
    // Wembanyama GTD — include but could be scratched
    {n:'Victor Wembanyama',s:'Points',   l:24.5},  // 25.0 PPG
    {n:'Victor Wembanyama',s:'Rebounds', l:10.5},  // 10.7 RPG
    {n:'Victor Wembanyama',s:'Blocks',   l:3.5},   // 3.6 BPG
    {n:'Stephon Castle',   s:'Points',   l:14.5},
    {n:'Stephon Castle',   s:'Assists',  l:6.5},   // 7.4 APG
    {n:'Harrison Barnes',  s:'Points',   l:13.5},
  ],
  TOR:[
    {n:'Scottie Barnes',   s:'Points',   l:19.5},
    {n:'Immanuel Quickley',s:'Points',   l:18.5},
    {n:'RJ Barrett',       s:'Points',   l:18.5},  // traded — may not be on TOR
    {n:'Jakob Poeltl',     s:'Rebounds', l:8.5},
  ],
  UTA:[
    {n:'Lauri Markkanen',  s:'Points',   l:23.5},  // 24.0 PPG
    {n:'Collin Sexton',    s:'Points',   l:18.5},
    {n:'Jordan Clarkson',  s:'Points',   l:14.5},
  ],
  WAS:[
    {n:'Jordan Poole',     s:'Points',   l:17.5},
    {n:'Kyle Kuzma',       s:'Points',   l:15.5},
    {n:'Alexandre Sarr',   s:'Points',   l:12.5},
    {n:'Alexandre Sarr',   s:'Rebounds', l:6.5},
  ],
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
function fmtMoney(cents) {
  return '$' + (cents / 100).toFixed(2);
}
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

// keep username + coins in localStorage so balance persists offline
function saveUserLocal() {
  if (state.user) {
    localStorage.setItem('hoopp_username', state.user.username);
    localStorage.setItem('hoopp_coins', String(state.user.coins || 0));
    localStorage.setItem('hoopp_entries', JSON.stringify(state.entries || []));
  } else {
    localStorage.removeItem('hoopp_username');
    localStorage.removeItem('hoopp_coins');
    localStorage.removeItem('hoopp_entries');
  }
}
function getSavedUsername() { return localStorage.getItem('hoopp_username'); }
function getSavedCoins()    { const v=localStorage.getItem('hoopp_coins'); return v!=null?parseInt(v,10):null; }
function getSavedEntries()  { try { return JSON.parse(localStorage.getItem('hoopp_entries')||'[]'); } catch { return []; } }

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
  if (!silent) showToast('Loading account…');

  try {
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
      showToast(
        isNew
          ? `Welcome, ${name}! You have ${fmtMoney(STARTING_COINS)} to start`
          : `Welcome back, ${name}! ${fmtMoney(userData.coins||0)}`,
        'success'
      );
    }

    // Load this user's entries from Firestore, fall back to localStorage cache
    try {
      state.entries = await fbGetUserEntries(name);
      localStorage.setItem('hoopp_entries', JSON.stringify(state.entries));
    } catch {
      state.entries = getSavedEntries();
    }
    renderMyPicks();
    renderGroupsTab();

    // Re-check any pending entries
    state.entries.filter(e => e.status==='pending').forEach(e => scheduleResultCheck(e.fbId));

  } catch(err) {
    console.error('Login error:', err);
    if (err.code === 'permission-denied' || err.message?.includes('permission')) {
      showToast('⚠️ Firebase rules not configured yet — see setup instructions', 'error');
    } else {
      // Fall back to cached balance + entries so nothing is lost offline
      const cachedCoins = getSavedCoins();
      const coins = cachedCoins != null ? cachedCoins : STARTING_COINS;
      state.user = { username:name, coins, correct:0, total:0, streak:0, groups:[], createdAt:Date.now() };
      state.entries = getSavedEntries().filter(e => e.username === name);
      saveUserLocal();
      applyUser();
      renderMyPicks();
      if (!silent) showToast(`Signed in as ${name} — ${fmtMoney(coins)}`, 'success');
    }
  }
}

function applyUser() {
  document.getElementById('username-display').textContent = state.user.username;
  document.getElementById('login-btn').textContent = 'Sign Out';
  document.getElementById('coin-display').textContent = fmtMoney(state.user.coins||0);
}

function getCoins() { return state.user ? (state.user.coins||0) : 0; }
async function setCoins(n) {
  if (!state.user) return;
  const val = Math.max(0, Math.round(n));
  state.user.coins = val;
  document.getElementById('coin-display').textContent = fmtMoney(val);
  localStorage.setItem('hoopp_coins', String(val));
  try { await fbUpdateCoins(state.user.username, val); } catch(e) { console.warn('setCoins Firestore error:', e.message); }
}

// ── Tabs ──────────────────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const btn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(el=>el.classList.add('hidden'));
  document.getElementById('tab-'+tabName).classList.remove('hidden');
  if (tabName==='leaderboard') renderLeaderboard('global');
  if (tabName==='my-picks')    renderMyPicks();
  if (tabName==='groups')      renderGroupsTab();
}

function initTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

// ── NBA CDN ───────────────────────────────────────────────────
async function fetchTodaysGames() {
  try {
    const res  = await fetch(ESPN_SCOREBOARD + '?_=' + Date.now());
    if (!res.ok) throw new Error('non-200');
    const data = await res.json();
    const events = data?.events || [];
    if (!events.length) return null;
    return events.map(normalizeESPNGame).filter(Boolean);
  } catch(e) { console.warn('ESPN API unavailable:', e.message); return null; }
}

function normalizeESPNGame(event) {
  try {
    const comp = event.competitions[0];
    const home = comp.competitors.find(c => c.homeAway === 'home');
    const away = comp.competitors.find(c => c.homeAway === 'away');
    if (!home || !away) return null;

    const homeAbbr = home.team.abbreviation;
    const awayAbbr = away.team.abbreviation;
    const state    = event.status.type.state; // 'pre', 'in', 'post'
    const statusText = state === 'in' ? 'live' : state === 'post' ? 'final' : 'scheduled';

    let timeStr = '';
    if (state === 'pre') {
      timeStr = new Date(event.date).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', timeZoneName:'short'});
    } else if (state === 'in') {
      timeStr = `Q${event.status.period} ${event.status.displayClock}`;
    } else {
      timeStr = 'Final';
    }

    const seriesText = comp.series?.summary || '';

    return {
      id:               event.id,
      espnId:           event.id,
      status:           statusText,
      time:             timeStr,
      period:           event.status.period || 0,
      seriesText,
      home_team:        { full_name: home.team.displayName, abbreviation: homeAbbr },
      visitor_team:     { full_name: away.team.displayName, abbreviation: awayAbbr },
      home_team_score:  parseInt(home.score) || 0,
      visitor_team_score: parseInt(away.score) || 0,
    };
  } catch(e) { console.warn('normalizeESPNGame error:', e); return null; }
}

function getDemoGames() {
  // Only used when NBA CDN is unreachable — no hardcoded teams
  return [];
}

// ESPN team abbreviation → team ID map
const ESPN_TEAM_ID = {
  ATL:1,BOS:2,BKN:17,CHA:30,CHI:4,CLE:5,DAL:6,DEN:7,DET:8,GSW:9,
  HOU:10,IND:11,LAC:12,LAL:13,MEM:29,MIA:14,MIL:15,MIN:16,NOP:3,
  NYK:18,OKC:25,ORL:19,PHI:20,PHX:21,POR:22,SAC:23,SAS:24,TOR:28,
  UTA:26,WAS:27
};

// Fetch active (non-injured) players for a team from ESPN
async function fetchActiveRoster(abbr) {
  const teamId = ESPN_TEAM_ID[abbr];
  if (!teamId) return null;
  try {
    const res  = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/roster`);
    const data = await res.json();
    const athletes = data?.athletes || [];
    // Filter to active players only (status name "Active", no injury or injury status "Day-To-Day" still ok)
    return athletes.filter(p => {
      const statusName = p?.status?.name || '';
      const injStatus  = (p?.injuries?.[0]?.status || '').toLowerCase();
      // Exclude Out, Suspended, IR
      if (['Out','Injured Reserve','Suspended','Did Not Return'].includes(statusName)) return false;
      if (injStatus === 'out') return false;
      return true;
    }).map(p => ({
      name:     p.displayName || p.fullName,
      position: p.position?.abbreviation || '',
    }));
  } catch { return null; }
}

// Stat lines by position group
function getStatLine(position, name, usedStats) {
  // usedStats: Set of "name|stat" already picked for this player (avoid duplicates)
  for (const stars of Object.values(TEAM_STARS)) {
    const matches = stars.filter(s => s.n.toLowerCase() === name.toLowerCase());
    for (const match of matches) {
      const key = `${name.toLowerCase()}|${match.s}`;
      if (!usedStats || !usedStats.has(key)) return { stat: match.s, line: match.l };
    }
  }
  // Fall back to position-based defaults
  if (['PG','SG'].includes(position)) return { stat: 'Points', line: 18.5 };
  if (['SF','PF'].includes(position))  return { stat: 'Points', line: 16.5 };
  if (position === 'C')               return { stat: 'Rebounds', line: 9.5 };
  return { stat: 'Points', line: 15.5 };
}

async function buildPropsFromGames(games) {
  const props = [];
  const seenPlayer = new Set(); // player already has a prop card
  const usedStats  = new Set(); // "name|stat" combos already used

  await Promise.all(games.map(async (g, gi) => {
    const teams = [
      { abbr: g.home_team.abbreviation, side: 'home' },
      { abbr: g.visitor_team.abbreviation, side: 'away' },
    ];
    const matchup = `${g.visitor_team.abbreviation} @ ${g.home_team.abbreviation}`;

    await Promise.all(teams.map(async ({ abbr }, ti) => {
      const roster = await fetchActiveRoster(abbr);
      const starNames = (TEAM_STARS[abbr] || []).map(s => s.n);

      // Build candidate list: TEAM_STARS players first (by order in roster), then fill with roster
      let players = [];
      if (roster) {
        // Put star players first (preserving roster position data), then others
        const starPlayers = roster.filter(p => starNames.some(n => n.toLowerCase() === p.name.toLowerCase()));
        const otherPlayers = roster.filter(p => !starNames.some(n => n.toLowerCase() === p.name.toLowerCase()));
        players = [...starPlayers, ...otherPlayers].slice(0, 5);
      } else {
        players = (TEAM_STARS[abbr] || []).map(s => ({ name: s.n, position: 'SF' })).slice(0, 5);
      }

      players.forEach((player, si) => {
        if (seenPlayer.has(player.name.toLowerCase())) return;
        const { stat, line } = getStatLine(player.position, player.name, usedStats);
        seenPlayer.add(player.name.toLowerCase());
        usedStats.add(`${player.name.toLowerCase()}|${stat}`);
        props.push({
          id:    `prop_${gi}_${ti}_${si}`,
          name:  player.name,
          team:  abbr,
          game:  matchup,
          stat,
          line,
          emoji: PLAYER_EMOJI[(gi*4+ti*2+si) % PLAYER_EMOJI.length],
        });
      });
    }));
  }));

  return props;
}

function buildTeamStatsHtml(abbr) {
  const stars = TEAM_STARS[abbr] || [];
  if (!stars.length) return '<p style="color:var(--text3);font-size:0.75rem">No data</p>';
  // Group by player name
  const byPlayer = {};
  stars.forEach(s => {
    if (!byPlayer[s.n]) byPlayer[s.n] = [];
    byPlayer[s.n].push(s);
  });
  return Object.entries(byPlayer).map(([name, lines]) => {
    const statChips = lines.map(l => `<span class="stat-chip">${l.s}: <strong>${l.l}</strong></span>`).join('');
    return `<div class="stats-player-row"><span class="stats-player-name">${name}</span><div class="stat-chips">${statChips}</div></div>`;
  }).join('');
}

function buildPlayerStatsHtml(playerName) {
  const rows = [];
  for (const stars of Object.values(TEAM_STARS)) {
    for (const s of stars) {
      if (s.n.toLowerCase() === playerName.toLowerCase()) rows.push(s);
    }
  }
  if (!rows.length) return '<p style="color:var(--text3);font-size:0.75rem">No season data available</p>';
  return rows.map(s => `<div class="prop-stat-detail-row"><span class="prop-stat-detail-label">${s.s}</span><span class="prop-stat-detail-val">${s.l} avg</span></div>`).join('');
}

function teamLogoImg(abbr, size=48) {
  const lower = abbr.toLowerCase();
  return `<img src="https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/${lower}.png" alt="${abbr}" width="${size}" height="${size}" style="object-fit:contain" onerror="this.style.display='none';this.nextSibling.style.display='inline'"><span style="display:none;font-size:${size*0.55}px">${TEAM_EMOJI[abbr]||'🏀'}</span>`;
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

    const awayStars = buildTeamStatsHtml(game.visitor_team.abbreviation);
    const homeStars = buildTeamStatsHtml(game.home_team.abbreviation);

    const card = document.createElement('div');
    card.className='game-card';
    card.innerHTML=`
      <div class="game-card-header">
        <span>${game.visitor_team.abbreviation} @ ${game.home_team.abbreviation} ${seriesBadge}</span>
        ${statusHtml}
      </div>
      <div class="game-matchup">
        <div class="team-side">
          <div class="team-logo">${teamLogoImg(game.visitor_team.abbreviation,52)}</div>
          <div class="team-abbr">${game.visitor_team.abbreviation}</div>
          <div class="team-name-small">${game.visitor_team.full_name}</div>
          <div class="team-score ${showScores?'':'empty'}">${showScores?as:'—'}</div>
        </div>
        <div class="vs-badge"><span>@</span></div>
        <div class="team-side">
          <div class="team-logo">${teamLogoImg(game.home_team.abbreviation,52)}</div>
          <div class="team-abbr">${game.home_team.abbreviation}</div>
          <div class="team-name-small">${game.home_team.full_name}</div>
          <div class="team-score ${showScores?'':'empty'}">${showScores?hs:'—'}</div>
        </div>
      </div>
      <div class="pick-buttons">
        <button class="pick-btn" data-game="${game.id}" data-pick="away"
          data-label="${game.visitor_team.full_name}" data-detail="${game.visitor_team.abbreviation} to win">
          ${game.visitor_team.abbreviation} Win
        </button>
        <button class="pick-btn" data-game="${game.id}" data-pick="home"
          data-label="${game.home_team.full_name}" data-detail="${game.home_team.abbreviation} to win">
          ${game.home_team.abbreviation} Win
        </button>
      <div class="stats-toggle-row">
        <button class="stats-toggle-btn" data-away="${game.visitor_team.abbreviation}" data-home="${game.home_team.abbreviation}">📊 Team Stats</button>
      </div>
      <div class="team-stats-panel" style="display:none">
        <div class="stats-two-col">
          <div class="stats-col"><div class="stats-col-header">${game.visitor_team.abbreviation}</div>${awayStars}</div>
          <div class="stats-col"><div class="stats-col-header">${game.home_team.abbreviation}</div>${homeStars}</div>
        </div>
      </div>`;

    card.querySelector('.stats-toggle-btn').addEventListener('click', () => {
      const panel = card.querySelector('.team-stats-panel');
      const btn   = card.querySelector('.stats-toggle-btn');
      const open  = panel.style.display !== 'none';
      panel.style.display = open ? 'none' : 'block';
      btn.textContent = open ? '📊 Team Stats' : '▲ Hide Stats';
    });

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
    const playerStats = buildPlayerStatsHtml(prop.name);
    const card = document.createElement('div');
    card.className='prop-card';
    card.innerHTML=`
      <div class="prop-card-top">
        <div class="player-avatar">${teamLogoImg(prop.team,36)}</div>
        <div class="player-info">
          <div class="player-name">${prop.name}</div>
          <div class="player-team-game">${prop.team} · ${prop.game}</div>
        </div>
        <button class="player-stats-btn" title="Season averages">📊</button>
      </div>
      <div class="player-stats-panel" style="display:none">${playerStats}</div>
      <div class="prop-stat-row">
        <span class="prop-stat-name">${prop.stat}</span>
        <span class="prop-line">${prop.line}</span>
        <span class="prop-stat-unit">avg / game</span>
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
    card.querySelector('.player-stats-btn').addEventListener('click', () => {
      const panel = card.querySelector('.player-stats-panel');
      const btn   = card.querySelector('.player-stats-btn');
      const open  = panel.style.display !== 'none';
      panel.style.display = open ? 'none' : 'block';
      btn.textContent = open ? '📊' : '▲';
    });
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
  // Highlight active tier cell
  document.querySelectorAll('.tier-item').forEach(item=>{
    const picks=parseInt(item.querySelector('.tier-picks')?.textContent||'0',10);
    item.classList.toggle('active-tier', picks===count && count>0);
  });
  if (count===0) { el.style.display='none'; return; }
  const tier=COIN_TIERS.find(t=>t.picks===count)||COIN_TIERS[COIN_TIERS.length-1];
  const payout=Math.round(state.wager*tier.mult);
  el.style.display='flex';
  el.innerHTML=`<span>Payout (${count} pick${count>1?'s':''})</span><span style="color:${tier.color};font-weight:700">${fmtMoney(payout)}</span>`;
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
  if (coins<state.wager) return showToast(`Not enough funds! You have ${fmtMoney(coins)}`,'error');

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
  localStorage.setItem('hoopp_entries', JSON.stringify(state.entries));
  clearSlip();
  showToast(`Entry submitted! Wagered ${fmtMoney(state.wager)} · potential ${fmtMoney(potentialPayout)}`,'success');
  switchTab('my-picks');
  scheduleResultCheck(ref.id);
}

// ── Result Grading ────────────────────────────────────────────
// Polls ESPN every 60s until ALL relevant games are final, then grades
// every pick (game-winner + player props) and credits/deducts balance.

function scheduleResultCheck(fbEntryId) {
  checkEntryResults(fbEntryId);
}

async function checkEntryResults(fbEntryId) {
  const entry=state.entries.find(e=>e.fbId===fbEntryId);
  if (!entry||entry.status!=='pending') return;

  // Ensure every pick has a result field
  entry.picks.forEach(p=>{ if(!p.result) p.result='pending'; });

  // Entries older than 2 days with still-pending picks can't be graded
  // (ESPN scoreboard only shows today's games) — mark as expired
  const twoDaysMs=2*24*60*60*1000;
  if (entry.createdAt && Date.now()-entry.createdAt > twoDaysMs) {
    entry.picks.forEach(p=>{ if(p.result==='pending') p.result='wrong'; });
    entry.status='lost';
    entry.correct=entry.picks.filter(p=>p.result==='correct').length;
    await fbUpdateEntry(fbEntryId,{ status:'lost', correct:entry.correct, picks:entry.picks });
    localStorage.setItem('hoopp_entries',JSON.stringify(state.entries));
    renderMyPicks();
    return;
  }

  let games;
  try {
    const res=await fetch(ESPN_SCOREBOARD+'?_='+Date.now());
    if (!res.ok) throw new Error();
    const data=await res.json();
    games=(data?.events||[]).map(normalizeESPNGame).filter(Boolean);
  } catch { setTimeout(()=>checkEntryResults(fbEntryId),60000); return; }

  const gameMap={};
  games.forEach(g=>{ gameMap[String(g.id)]=g; });

  // Parse game-winner picks
  const gamePicks=entry.picks
    .filter(p=>p.id.startsWith('game_'))
    .map(p=>{
      const withoutPrefix=p.id.replace(/^game_/,'');
      const side=withoutPrefix.split('_').pop();
      const rawId=withoutPrefix.slice(0,-(side.length+1));
      return { pick:p, gameId:rawId, side };
    });

  // Parse prop picks — extract team from state.props or TEAM_STARS lookup
  const propPicks=entry.picks
    .filter(p=>!p.id.startsWith('game_'))
    .map(p=>{
      const detailParts=p.detail.split(' ');
      const dir=detailParts[0].toLowerCase();
      const line=parseFloat(detailParts[1]);
      const stat=detailParts.slice(2).join(' ').toLowerCase();
      const teamAbbr=findPlayerTeam(p.label);
      const game=teamAbbr?games.find(g=>g.home_team.abbreviation===teamAbbr||g.visitor_team.abbreviation===teamAbbr):null;
      return { pick:p, dir, line, stat, teamAbbr, game };
    });

  // Determine which games need to be final before we can grade
  const relevantGameIds=new Set();
  gamePicks.forEach(({gameId})=>relevantGameIds.add(gameId));
  propPicks.forEach(({game})=>{ if(game) relevantGameIds.add(String(game.id)); });

  // No relevant games found in today's scoreboard → retry later (game may not have started)
  if (relevantGameIds.size===0) { setTimeout(()=>checkEntryResults(fbEntryId),60000); return; }

  const allFinal=[...relevantGameIds].every(id=>{ const g=gameMap[id]; return g&&g.status==='final'; });
  if (!allFinal) { setTimeout(()=>checkEntryResults(fbEntryId),60000); return; }

  // Grade game-winner picks
  let correct=0;
  gamePicks.forEach(({pick,gameId,side})=>{
    const g=gameMap[gameId];
    if (!g) { pick.result='pending'; return; }
    const homeWon=g.home_team_score>g.visitor_team_score;
    pick.result=(side==='home'===homeWon)?'correct':'wrong';
    if (pick.result==='correct') correct++;
  });

  // Grade prop picks using box score
  await Promise.all(propPicks.map(async ({pick,dir,line,stat,game})=>{
    if (!game) { pick.result='wrong'; return; } // can't verify = loss
    try {
      const paddedId=String(game.id).padStart(10,'0');
      const res=await fetch(`https://nba-prod-us-east-1-mediaops-stats.s3.amazonaws.com/NBA/liveData/boxscore/boxscore_${paddedId}.json?_=${Date.now()}`);
      const data=await res.json();
      const allPlayers=[...(data?.game?.homeTeam?.players||[]),...(data?.game?.awayTeam?.players||[])];
      const playerData=allPlayers.find(p=>
        p.name?.toLowerCase().includes(pick.label.split(' ').slice(-1)[0].toLowerCase())||
        pick.label.toLowerCase().includes((p.name||'').toLowerCase())
      );
      if (!playerData?.statistics) { pick.result='wrong'; return; }
      const s=playerData.statistics;
      const statMap={points:s.points,rebounds:s.reboundsTotal,assists:s.assists,blocks:s.blocks,steals:s.steals};
      const actual=statMap[stat]??null;
      if (actual===null) { pick.result='wrong'; return; }
      pick.result=(dir==='over'?actual>line:actual<line)?'correct':'wrong';
      if (pick.result==='correct') correct++;
    } catch { pick.result='wrong'; }
  }));

  const total=entry.picks.length;
  const allCorrect=correct===total;
  entry.status=allCorrect?'won':'lost';
  entry.correct=correct;

  // Cash out: all correct wins potentialPayout, otherwise lose the wager
  if (allCorrect) {
    await setCoins(getCoins()+entry.potentialPayout);
    showToast(`ALL CORRECT! +${fmtMoney(entry.potentialPayout)} credited!`,'success');
  } else {
    showToast(`Results in — ${correct}/${total} correct. ${fmtMoney(entry.wager)} lost.`);
  }

  await fbUpdateEntry(fbEntryId,{ status:entry.status, correct, picks:entry.picks });

  await fbSetUser(state.user.username,{
    correct: (state.user.correct||0)+correct,
    total:   (state.user.total||0)+total,
    streak:  allCorrect ? (state.user.streak||0)+1 : 0,
  });
  state.user.correct=(state.user.correct||0)+correct;
  state.user.total=(state.user.total||0)+total;
  state.user.streak=allCorrect?(state.user.streak||0)+1:0;
  localStorage.setItem('hoopp_entries', JSON.stringify(state.entries));

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
    if (!u || !u.username) return;
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
      <td class="lb-coins">${fmtMoney(u.coins||0)}</td>
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
  if (!container) return;
  if (!state.user) { container.innerHTML='<p class="empty-msg">Sign in to see your picks.</p>'; return; }
  if (!state.entries.length) { container.innerHTML='<p class="empty-msg">No entries yet. Make some picks!</p>'; return; }

  container.innerHTML='';
  state.entries.forEach((entry,entryIdx)=>{
    // Ensure picks array exists and every pick has a result
    if (!Array.isArray(entry.picks)) entry.picks=[];
    entry.picks.forEach(p=>{ if(!p.result) p.result='pending'; });

    const payout = entry.potentialPayout || 0;
    const wager  = entry.wager || 0;
    const sc=entry.status==='won'?'won':entry.status==='lost'?'lost':'pending';
    // Use index as fallback ID so the DOM id is always unique
    const cardId=entry.fbId||`local-${entryIdx}`;
    const entryNum=String(entry.createdAt||entry.fbId||'').slice(-4)||String(entryIdx+1);

    let resultBadge='';
    if (entry.status==='won') {
      resultBadge=`<span class="entry-result-money won">+${fmtMoney(payout)}</span>`;
    } else if (entry.status==='lost') {
      resultBadge=`<span class="entry-result-money lost">-${fmtMoney(wager)}</span>`;
    } else {
      const doneCount=entry.picks.filter(p=>p.result!=='pending').length;
      const pendingNote=doneCount>0?` · ${doneCount}/${entry.picks.length} graded`:' · awaiting results';
      resultBadge=`<span class="entry-result-money pending">${fmtMoney(wager)} wagered${pendingNote}</span>`;
    }

    const card=document.createElement('div'); card.className='entry-card';
    card.innerHTML=`
      <div class="entry-card-header">
        <div class="entry-card-meta">
          <strong class="entry-card-title">Entry #${entryNum}</strong>
          <span class="entry-card-date">${entry.date||''} · ${entry.submittedAt||''}</span>
        </div>
        <div class="entry-card-right">
          ${resultBadge}
          <span class="entry-status ${sc}">${sc==='won'?'Won':sc==='lost'?'Lost':'Pending'}</span>
        </div>
      </div>
      <div class="entry-footer-stats">
        <span>Wager: <strong>${fmtMoney(wager)}</strong></span>
        <span>Potential: <strong>${fmtMoney(payout)}</strong></span>
        <span>Multiplier: <strong>${entry.mult||1}×</strong></span>
        <span>Picks: <strong>${entry.picks.length}</strong></span>
      </div>
      <div class="entry-picks-list" id="picks-list-${cardId}"></div>`;
    container.appendChild(card);
    renderPickRows(entry, cardId);
  });
}

function renderPickRows(entry, cardId) {
  const id=cardId||entry.fbId;
  const list=document.getElementById(`picks-list-${id}`);
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
  const gameId=withoutPrefix.slice(0,-(side.length+1));

  let liveGame=state.games.find(g=>String(g.id)===String(gameId))||null;
  try {
    const res=await fetch(ESPN_SCOREBOARD+'?_='+Date.now());
    const data=await res.json();
    const found=(data?.events||[]).map(normalizeESPNGame).filter(Boolean).find(g=>String(g.id)===String(gameId));
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
  const lower = playerName.toLowerCase();
  // Check live props first (uses real active roster)
  const prop = state.props.find(p => p.name.toLowerCase() === lower);
  if (prop) return prop.team;
  // Fall back to TEAM_STARS
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

  loadingEl.classList.add('hidden');

  if (!games||!games.length) {
    noGamesEl.classList.remove('hidden');
    games=[];
  }

  state.games=games;
  renderGames(games);
  // Load props async — shows spinner then renders when rosters arrive
  document.getElementById('props-grid').innerHTML='<div class="loading-state" style="padding:40px"><div class="spinner"></div><p>Loading active rosters…</p></div>';
  state.props = await buildPropsFromGames(games);
  renderProps(state.props);
  updateSlip();

  // Auth init (may auto-login from saved username)
  initAuth();
  initLeaderboardBack();

  // Global leaderboard live listener
  renderLeaderboard('global');

  // Refresh live scores every 30s — NBA CDN always serves today's games automatically
  setInterval(refreshScores, 30000);
}

document.addEventListener('DOMContentLoaded', init);
