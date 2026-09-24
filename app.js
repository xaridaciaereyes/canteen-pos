'use strict';
/* =========================================================
   Canteen POS
   - Demo mode: saves to this device (localStorage)
   - Cloud mode: saves to Firebase Firestore (see README.md)
   ========================================================= */

// ---------- constants ----------
const DEFAULT_PASSWORD = 'akotosishypanget';
const USER_DOMAIN = 'canteen-pos.app'; // staff usernames become username@canteen-pos.app in Firebase (no emails are sent)
const LOCK_AFTER_MS = 15 * 60 * 1000; // owner pages lock again after 15 min of no tapping
const MEALS = ['Breakfast', 'Lunch', 'Merienda'];
const TABS = ['Breakfast', 'Lunch', 'Merienda', 'Snacks', 'Others'];
const LUNCH_TYPES = ['Beef', 'Pork', 'Chicken', 'Fish', 'Veggies'];
const TYPES_BY_MEAL = { Breakfast: ['Breakfast'], Lunch: LUNCH_TYPES, Merienda: ['Merienda'] };
const SNACK_KINDS = ['Chips', 'Drinks', 'Candies', 'Snacks', 'Groceries'];
const INV_CATS = [['Snacks', 'Snacks'], ['Others', 'Others'], ['Supplies', 'Supplies']];
const SUPPLY_ROLES = [['tissue', 'Tissue'], ['plate', 'Paper plate'], ['utensil', 'Spoon & fork'], ['plastic', 'Plastic / bag'], ['other', 'Other']];
const UNITS = ['pcs', 'pairs', 'packs', 'kg'];
const DEFAULT_SUPPLIES = [
  { name: 'Tissues', role: 'tissue', unit: 'pcs', threshold: 50 },
  { name: 'Paper plates', role: 'plate', unit: 'pcs', threshold: 30 },
  { name: 'Spoon & fork', role: 'utensil', unit: 'pairs', threshold: 30 },
  { name: 'Plastic (1kl)', role: 'plastic', unit: 'pcs', threshold: 20 },
  { name: 'Plastic sando bag (1kl)', role: 'plastic', unit: 'pcs', threshold: 20 },
  { name: 'Plastic (2kl)', role: 'plastic', unit: 'pcs', threshold: 20 },
];
const SERVICES = [['dinein', 'Dine-in'], ['nocontainer', 'No container'], ['container', 'With container']];
const PAY_METHODS = ['Cash', 'GCash', 'PayMaya', 'Bank Transfer', 'Other'];
const CASH_NOTES = [50, 100, 150, 200, 300, 400, 500, 1000];
const EXPENSE_CATS = ['Ingredients', 'Gas / LPG', 'Supplies', 'Utilities', 'Others'];
const EMP_CATS = ['Preparation', 'Operations'];
const STATUSES = [['present', 'Present'], ['late', 'Late'], ['absent', 'Absent']];
const ROLES = { cashier: ['pos', 'menu', 'orders'], staff: ['inventory'] };
const ROLE_LABEL = { owner: 'Owner', cashier: 'Cashier', staff: 'Staff', custom: 'Custom' };
const SMILEYS = [
  { v: 1, e: '😠', t: 'Very bad' }, { v: 2, e: '🙁', t: 'Bad' }, { v: 3, e: '😐', t: 'Okay' },
  { v: 4, e: '🙂', t: 'Good' }, { v: 5, e: '😄', t: 'Excellent' },
];
const PALETTE = ['#2563eb', '#f97316', '#16a34a', '#9333ea', '#e11d48', '#0891b2', '#ca8a04', '#4f46e5'];
const C = { sales: '#2563eb', exp: '#f97316', profit: '#16a34a', target: '#6b7280' };
const DEFAULT_SETTINGS = {
  shopName: 'XA IDA Catering',
  prices: { Breakfast: '', Beef: 100, Pork: 90, Chicken: 75, Fish: 75, Veggies: 65, Merienda: '' },
  adj: { noRice: -10, halfRice: -5, container: 5 },
  extraRice: { full: 15, half: 10 },
  incentives: { period: 'off', byRating: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, salesGoal: 0, salesBonus: 0, lateDeduct: 0 },
  supplyRules: { meals: ['Lunch'], modes: ['nocontainer', 'container'] },
  expiryWarnDays: 7,
};

function mergeDefaults(doc) {
  doc = doc || {};
  const D = DEFAULT_SETTINGS, i = doc.incentives || {};
  return {
    ...D, ...doc,
    prices: { ...D.prices, ...(doc.prices || {}) },
    adj: { ...D.adj, ...(doc.adj || {}) },
    extraRice: { ...D.extraRice, ...(doc.extraRice || {}) },
    incentives: { ...D.incentives, ...i, byRating: { ...D.incentives.byRating, ...(i.byRating || {}) } },
    supplyRules: { ...D.supplyRules, ...(doc.supplyRules || {}) },
  };
}

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const round2 = n => Math.round(n * 100) / 100;
const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
function peso(n) {
  n = Number(n) || 0;
  const s = Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
  return (n < 0 ? '−' : '') + '₱' + s;
}
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const addMonths = (k, n) => { const d = parseKey(k); return dkey(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const todayKey = () => dkey(new Date());
const weekStart = k => { const d = parseKey(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dkey(d); }; // Monday
const monthStart = k => k.slice(0, 8) + '01';
const monthEnd = k => { const d = parseKey(k); return dkey(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
const attFrom = from => weekStart(monthStart(from)); // enough attendance history to compute weekly/monthly incentives
function daysIn(from, to) { const out = []; for (let k = from; k <= to && out.length < 400; k = addDays(k, 1)) out.push(k); return out; }
const fmtDate = (k, opts) => parseKey(k).toLocaleDateString('en-PH', opts || { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const fmtShort = k => parseKey(k).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
const fmtMonth = k => parseKey(k).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
const fmtTime = ms => new Date(ms).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
const hourLabel = h => (h % 12 || 12) + (h < 12 ? ' AM' : ' PM');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const riceLabel = r => r === 'half' ? 'Half rice' : r === 'none' ? 'No rice' : r === 'full' ? 'With rice' : '';
const serviceLabel = s => (SERVICES.find(x => x[0] === s) || [, ''])[1];
function lineDesc(l) {
  const p = [];
  if (l.rice && l.rice !== 'full') p.push(riceLabel(l.rice));
  if (l.service === 'dinein') p.push('Dine-in');
  if (l.service === 'container' || (!l.service && l.container)) p.push('+ Container');
  return p.join(', ');
}
const lineKey = l => [l.category, l.type, l.name, l.base, l.rice, l.service, l.container, l.invId].join('|');
const payGroup = m => (m === 'Cash' || m === 'GCash') ? m : 'Others';
const cardTitle = t => `<h2 class="card-title">${t}</h2>`;
const face = avg => SMILEYS[Math.min(4, Math.max(0, Math.round(avg) - 1))];
const toEmail = login => { login = String(login || '').trim(); return login.includes('@') ? login : login.toLowerCase() + '@' + USER_DOMAIN; };

async function hashPw(pw) {
  const txt = 'canteen-pos:' + pw;
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261;
  for (const c of txt) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return 'f' + h.toString(16);
}

function clean(data) { const { id, ...rest } = data || {}; return JSON.parse(JSON.stringify(rest)); }

// ---------- storage: demo (this device only) ----------
const LocalStore = {
  mode: 'local',
  listeners: [],
  _load(col) { try { return JSON.parse(localStorage.getItem('canteen:' + col)) || {}; } catch (e) { return {}; } },
  _save(col, all) {
    try { localStorage.setItem('canteen:' + col, JSON.stringify(all)); }
    catch (e) { toast('Could not save — this device storage is full.'); }
    this.listeners.filter(l => l.col === col).forEach(l => setTimeout(() => this._run(l)));
  },
  _match(doc, f) { if (!f) return true; if (f.date) return doc.date === f.date; return doc.date >= f.from && doc.date <= f.to; },
  _run(l) {
    if (!this.listeners.includes(l)) return;
    const all = this._load(l.col);
    if (l.id) { const d = all[l.id]; l.cb(d ? { id: l.id, ...d } : null, { fromCache: false }); }
    else l.cb(Object.entries(all).map(([id, d]) => ({ id, ...d })).filter(d => this._match(d, l.filter)));
  },
  _sub(l) { this.listeners.push(l); setTimeout(() => this._run(l)); return () => { this.listeners = this.listeners.filter(x => x !== l); }; },
  _session() { try { return localStorage.getItem('canteen:session'); } catch (e) { return null; } },
  async init() {
    const users = this._load('users');
    if (!users.owner) {
      users.owner = { name: 'Owner', username: 'owner', role: 'owner', pwHash: S.defaultHash, active: true, createdAt: Date.now() };
      localStorage.setItem('canteen:users', JSON.stringify(users));
    }
    const id = this._session();
    return id && users[id] && users[id].active !== false ? { uid: id } : null;
  },
  async signIn(login, pw) {
    const h = await hashPw(pw), name = String(login || '').trim().toLowerCase();
    const hit = Object.entries(this._load('users')).find(([, u]) => u.username === name && u.active !== false && u.pwHash === h);
    if (!hit) throw new Error('wrong');
    localStorage.setItem('canteen:session', hit[0]);
    return hit[0];
  },
  async signOut() { localStorage.removeItem('canteen:session'); },
  currentUid() { return this._session(); },
  email() { const u = this._load('users')[this._session()]; return u ? u.username : ''; },
  async createAccount(username) {
    if (Object.values(this._load('users')).some(u => u.username === username)) { const e = new Error('taken'); e.code = 'auth/email-already-in-use'; throw e; }
    return uid();
  },
  listen(col, filter, cb) { return this._sub({ col, filter, cb }); },
  listenDoc(col, id, cb) { return this._sub({ col, id, cb }); },
  async query(col, filter) { return Object.entries(this._load(col)).map(([id, d]) => ({ id, ...d })).filter(d => this._match(d, filter)); },
  async get(col, id) { const d = this._load(col)[id]; return d ? { id, ...d } : null; },
  set(col, id, data) { const all = this._load(col); all[id] = clean(data); this._save(col, all); },
  add(col, data) { const id = uid(); this.set(col, id, data); return id; },
  update(col, id, patch) { const all = this._load(col); if (!all[id]) return; Object.assign(all[id], clean(patch)); this._save(col, all); },
  inc(col, id, field, delta) { const all = this._load(col); if (!all[id]) return; all[id][field] = round2(num(all[id][field]) + delta); this._save(col, all); },
  remove(col, id) { const all = this._load(col); delete all[id]; this._save(col, all); },
};

// ---------- storage: cloud (Firebase) ----------
const FirebaseStore = {
  mode: 'cloud',
  async init(config) {
    const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
    const [A, F, Au] = await Promise.all([
      import(base + 'firebase-app.js'), import(base + 'firebase-firestore.js'), import(base + 'firebase-auth.js'),
    ]);
    this.A = A; this.F = F; this.Au = Au; this.config = config;
    const app = A.initializeApp(config);
    try {
      this.db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
    } catch (e) { this.db = F.getFirestore(app); }
    this.auth = Au.getAuth(app);
    return new Promise(res => { const off = Au.onAuthStateChanged(this.auth, u => { off(); res(u); }); });
  },
  async signIn(login, pw) { const c = await this.Au.signInWithEmailAndPassword(this.auth, toEmail(login), pw); return c.user.uid; },
  signOut() { return this.Au.signOut(this.auth); },
  currentUid() { return this.auth.currentUser && this.auth.currentUser.uid; },
  email() { return (this.auth && this.auth.currentUser && this.auth.currentUser.email) || ''; },
  async createAccount(username, pw) {
    // A second, in-memory Firebase login creates the account without signing the owner out.
    if (!this.auth2) {
      const app2 = this.A.initializeApp(this.config, 'account-maker');
      this.auth2 = this.Au.initializeAuth(app2, { persistence: this.Au.inMemoryPersistence });
    }
    const c = await this.Au.createUserWithEmailAndPassword(this.auth2, toEmail(username), pw);
    await this.Au.signOut(this.auth2);
    return c.user.uid;
  },
  _q(col, f) {
    const F = this.F, ref = F.collection(this.db, col);
    if (!f) return ref;
    if (f.date) return F.query(ref, F.where('date', '==', f.date));
    return F.query(ref, F.where('date', '>=', f.from), F.where('date', '<=', f.to));
  },
  _docs(snap) { return snap.docs.map(d => ({ id: d.id, ...d.data() })); },
  listen(col, f, cb) { return this.F.onSnapshot(this._q(col, f), s => cb(this._docs(s)), onDbError); },
  listenDoc(col, id, cb) {
    return this.F.onSnapshot(this.F.doc(this.db, col, id),
      s => cb(s.exists() ? { id: s.id, ...s.data() } : null, { fromCache: s.metadata.fromCache }), onDbError);
  },
  async query(col, f) { return this._docs(await this.F.getDocs(this._q(col, f))); },
  async get(col, id) { const s = await this.F.getDoc(this.F.doc(this.db, col, id)); return s.exists() ? { id: s.id, ...s.data() } : null; },
  // Writes are not awaited: Firebase saves them on the tablet first and sends them when online.
  set(col, id, data) { this.F.setDoc(this.F.doc(this.db, col, id), clean(data)).catch(onDbError); },
  add(col, data) { const ref = this.F.doc(this.F.collection(this.db, col)); this.F.setDoc(ref, clean(data)).catch(onDbError); return ref.id; },
  update(col, id, patch) { this.F.updateDoc(this.F.doc(this.db, col, id), clean(patch)).catch(onDbError); },
  inc(col, id, field, delta) { this.F.updateDoc(this.F.doc(this.db, col, id), { [field]: this.F.increment(delta) }).catch(onDbError); },
  remove(col, id) { this.F.deleteDoc(this.F.doc(this.db, col, id)).catch(onDbError); },
};

function onDbError(e) {
  console.error(e);
  if (e && e.code === 'permission-denied') toast('Not allowed to save. Check the account access or the Firestore rules (see README).', { ms: 8000 });
  else toast('Problem saving data: ' + ((e && (e.code || e.message)) || 'unknown'), { ms: 6000 });
}

// ---------- app state ----------
let Store;
const S = {
  me: null, logo: null,
  view: 'pos', tab: 'Lunch', today: todayKey(),
  settings: mergeDefaults({}), defaultHash: '',
  dishes: [], inventory: [], employees: [], users: [], targets: {}, menu: { items: [] }, todayOrders: [],
  cart: [],
  sidebarOpen: window.innerWidth >= 1000,
  unlockedUntil: 0,
  ordersDate: null, otherOrders: [],
  invTab: 'Snacks',
  expMonth: null, expenses: [], expAtt: [], expOrders: [],
  empDate: null, empTab: 'sheet', empPeriod: 'week', empData: { att: [], orders: [] },
  dash: { period: 'day', anchor: null }, dashData: { orders: [], expenses: [], ratings: [], att: [] },
  libOpen: new Set(['cat-Breakfast', 'cat-Lunch', 'cat-Merienda', 'type-Beef', 'type-Pork', 'type-Chicken', 'type-Fish', 'type-Veggies']),
  libSearch: '',
  charts: [], pendingCharts: [], viewSubs: [], todaySubs: [],
};

const getDashHash = () => S.settings.dashHash || S.defaultHash;
const getEditHash = () => S.settings.editPwOff ? '' : (S.settings.editHash || S.defaultHash);
const isUnlocked = () => Date.now() < S.unlockedUntil;
function unlock() { S.unlockedUntil = Date.now() + LOCK_AFTER_MS; renderSidebar(); }
const canSee = v => !!(S.me && S.me.access.includes(v));
const needsPw = v => VIEWS[v].locked && S.me && S.me.isOwner && !isUnlocked();

// ---------- views ----------
const VIEWS = {
  pos: { title: 'Take Order', group: 'Daily', deps: ['menu', 'inventory', 'settings', 'cart', 'orders'], render: renderPOS },
  menu: { title: "Today's Menu", group: 'Daily', deps: ['menu', 'dishes', 'inventory', 'settings'], render: renderMenu, after: filterLib },
  orders: { title: 'Orders & Sales', group: 'Daily', deps: ['orders', 'settings'], render: renderOrders, enter: enterOrders },
  inventory: { title: 'Inventory', group: 'Daily', deps: ['inventory', 'settings', 'orders'], render: renderInventory },
  employees: { title: 'Employees', group: 'Owner', locked: true, deps: ['employees', 'attendance', 'settings', 'orders'], render: renderEmployees, enter: enterEmployees },
  expenses: { title: 'Expenses', group: 'Owner', locked: true, deps: ['expenses', 'settings'], render: renderExpenses, enter: enterExpenses },
  dashboard: { title: 'Dashboard', group: 'Owner', locked: true, deps: ['dash', 'targets', 'settings', 'employees'], render: renderDashboard, enter: enterDashboard },
  settings: { title: 'Settings', group: 'Owner', locked: true, deps: ['settings'], render: renderSettings },
  accounts: { title: 'Accounts', group: 'Owner', locked: true, ownerOnly: true, deps: ['users'], render: renderAccounts },
};
const ALL_VIEWS = Object.keys(VIEWS);

// ---------- boot / login ----------
async function boot() {
  registerSW();
  if (window.Chart) { Chart.defaults.font.size = 14; Chart.defaults.font.family = getComputedStyle(document.body).fontFamily; Chart.defaults.color = '#555'; }
  S.defaultHash = await hashPw(DEFAULT_PASSWORD);
  S.logo = await loadLogo();
  const cfg = window.FIREBASE_CONFIG;
  let user;
  if (cfg && cfg.apiKey) {
    Store = FirebaseStore;
    renderSplash('Connecting…');
    try { user = await Store.init(cfg); }
    catch (e) {
      console.error(e);
      renderSplash('Could not connect. Please check the internet connection, then close and open the app again.', true);
      return;
    }
  } else {
    Store = LocalStore;
    user = await Store.init();
  }
  if (!user) { renderLogin(); return; }
  afterLogin();
}

function registerSW() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Loads logo.png and trims the white space around it.
function loadLogo() {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, w, h).data;
        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
          const p = (y * w + i) * 4;
          if (d[p + 3] > 30 && (d[p] < 225 || d[p + 1] < 225 || d[p + 2] < 225)) {
            if (i < minX) minX = i; if (i > maxX) maxX = i; if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
        if (maxX < 0) { res('logo.png'); return; }
        const padPx = Math.round(Math.max(w, h) * 0.01);
        minX = Math.max(0, minX - padPx); minY = Math.max(0, minY - padPx); maxX = Math.min(w - 1, maxX + padPx); maxY = Math.min(h - 1, maxY + padPx);
        const out = document.createElement('canvas'); out.width = maxX - minX + 1; out.height = maxY - minY + 1;
        out.getContext('2d').drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
        res(out.toDataURL('image/png'));
      } catch (e) { res('logo.png'); } // e.g. opened by double-click: show it uncropped
    };
    img.onerror = () => res(null);
    img.src = 'logo.png';
  });
}
const logoHtml = cls => S.logo ? `<img class="${cls}" src="${S.logo}" alt="${esc(S.settings.shopName)}">` : `<span class="brand-text">${esc(S.settings.shopName)}</span>`;

function renderSplash(msg, isErr) { $('#app').innerHTML = `<div class="splash ${isErr ? 'err' : ''}">${esc(msg)}</div>`; }

function renderLogin(err) {
  $('#app').innerHTML = `<div class="login"><form class="login-card" id="loginForm">
    <div class="login-logo-wrap">${logoHtml('login-logo')}</div>
    <h1>Sign in</h1>
    <label>Username${Store.mode === 'cloud' ? ' or email' : ''}<input class="input big" name="login" required autocomplete="username" autocapitalize="none"></label>
    <label>Password<input class="input big" type="password" name="pw" required autocomplete="current-password"></label>
    <p class="err">${esc(err || '')}</p>
    <button class="btn primary big full" type="submit">Sign in</button>
  </form></div>`;
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try { await Store.signIn(f.login.value, f.pw.value); afterLogin(); }
    catch (ex) { renderLogin('Wrong username or password. Please try again.'); }
  });
}

async function afterLogin() {
  renderSplash('Loading…');
  const me = await resolveProfile();
  if (!me) {
    $('#app').innerHTML = `<div class="login"><div class="login-card"><h1>No access</h1>
      <p>This account has no access yet, or it was turned off. Please ask the owner.</p>
      <button class="btn primary big full" id="soBtn">Sign out</button></div></div>`;
    $('#soBtn').onclick = () => Promise.resolve(Store.signOut()).then(() => location.reload());
    return;
  }
  S.me = me;
  startApp();
}

async function resolveProfile() {
  const id = Store.currentUid();
  if (Store.mode === 'cloud') {
    const owner = String(window.OWNER_EMAIL || '').trim().toLowerCase();
    if (!owner || Store.email().toLowerCase() === owner) return { uid: id, name: 'Owner', role: 'owner', isOwner: true, access: ALL_VIEWS };
  }
  let doc = null;
  try { doc = await Store.get('users', id); } catch (e) { console.error(e); }
  if (!doc || doc.active === false) return null;
  if (doc.role === 'owner') return { uid: id, name: doc.name || 'Owner', role: 'owner', isOwner: true, access: ALL_VIEWS };
  const access = ROLES[doc.role] || (doc.access || []).filter(v => VIEWS[v] && !VIEWS[v].ownerOnly);
  return { uid: id, name: doc.name || doc.username, role: doc.role, isOwner: false, access };
}

function signOutNow() { Promise.resolve(Store.signOut()).then(() => location.reload()); }

let started = false;
function startApp() {
  if (started) return;
  started = true;
  renderShell();
  subscribeGlobal();
  subscribeToday();
  document.addEventListener('click', onClick);
  document.addEventListener('toggle', onToggle, true);
  document.addEventListener('input', onInput);
  window.addEventListener('online', renderNet);
  window.addEventListener('offline', renderNet);
  setInterval(tick, 20000);
  go(ALL_VIEWS.find(canSee));
}

function subscribeGlobal() {
  Store.listenDoc('settings', 'main', (doc, meta) => {
    if (doc) S.settings = mergeDefaults(doc);
    else if (S.me.isOwner && (!meta || !meta.fromCache)) {
      // First time ever: create settings with the default passwords.
      const d = { ...mergeDefaults({}), dashHash: S.defaultHash, editHash: S.defaultHash, editPwOff: false, createdAt: Date.now() };
      S.settings = d;
      Store.set('settings', 'main', d);
    }
    renderBrand();
    refresh(['settings']);
  });
  Store.listen('dishes', null, list => { S.dishes = list.sort((a, b) => a.name.localeCompare(b.name)); refresh(['dishes']); });
  Store.listen('inventory', null, list => { S.inventory = list.sort((a, b) => a.name.localeCompare(b.name)); renderAlertsBtn(); refresh(['inventory']); });
  Store.listen('targets', null, list => { S.targets = Object.fromEntries(list.map(t => [t.id, num(t.amount)])); refresh(['targets']); });
  if (canSee('employees') || canSee('dashboard') || canSee('expenses')) {
    Store.listen('employees', null, list => { S.employees = list.sort((a, b) => a.name.localeCompare(b.name)); refresh(['employees']); });
  }
  if (S.me.isOwner) Store.listen('users', null, list => { S.users = list.sort((a, b) => (a.name || '').localeCompare(b.name || '')); refresh(['users']); });
}

function subscribeToday() {
  S.todaySubs.forEach(u => u());
  S.today = todayKey();
  S.menu = { date: S.today, items: [] };
  S.todayOrders = [];
  S.todaySubs = [
    Store.listenDoc('menus', S.today, doc => { S.menu = doc || { date: S.today, items: [] }; if (!S.menu.items) S.menu.items = []; refresh(['menu']); }),
    Store.listen('orders', { date: S.today }, list => { S.todayOrders = list; refresh(['orders', 'cart']); }),
  ];
  updateTopDate();
}

function tick() {
  if (todayKey() !== S.today) {
    // A new day started: the menu starts fresh.
    subscribeToday();
    if (S.view === 'orders') { S.ordersDate = S.today; subOrdersDate(); }
    renderAlertsBtn();
    refresh();
  }
  if (S.unlockedUntil && !isUnlocked()) {
    S.unlockedUntil = 0;
    renderSidebar();
    if (VIEWS[S.view].locked && S.me.isOwner) { go(ALL_VIEWS.find(v => canSee(v) && !VIEWS[v].locked)); toast('Owner pages locked again for safety.'); }
  }
}

// ---------- shell / navigation ----------
function renderShell() {
  $('#app').innerHTML = `
  <div class="shell" id="shell">
    <header class="topbar">
      <button class="menu-btn" data-act="toggleSide" aria-label="Open or close menu"><span></span><span></span><span></span></button>
      <div class="brand" id="brand"></div>
      <div class="top-date" id="topDate"></div>
      <div id="alertSlot"></div>
      <div id="net"></div>
    </header>
    <nav class="sidebar" id="sidebar"></nav>
    <div class="scrim" data-act="toggleSide"></div>
    <main class="view" id="view"></main>
  </div>`;
  renderBrand();
  renderNet();
  updateTopDate();
  renderAlertsBtn();
}

function renderBrand() { const b = $('#brand'); if (b) b.innerHTML = logoHtml('logo'); }

function updateTopDate() {
  const t = $('#topDate');
  if (t) t.textContent = fmtDate(S.today, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function renderNet() {
  const n = $('#net'); if (!n) return;
  if (Store.mode === 'local') n.innerHTML = '<span class="pill">Demo</span>';
  else n.innerHTML = navigator.onLine ? '<span class="pill">Online</span>' : '<span class="pill off">Offline – will save later</span>';
}

function renderAlertsBtn() {
  const s = $('#alertSlot'); if (!s) return;
  const n = invAlerts().length;
  s.innerHTML = n ? `<button class="alert-btn" data-act="alerts">Alerts <span class="badge">${n}</span></button>` : '';
}

function renderSidebar() {
  const sb = $('#sidebar'); if (!sb) return;
  let group = '';
  const items = ALL_VIEWS.filter(canSee).map(k => {
    const v = VIEWS[k];
    const label = v.group !== group ? `<div class="nav-label">${v.group}</div>` : '';
    group = v.group;
    return label + `<button class="nav-btn ${S.view === k ? 'active' : ''}" data-act="go" data-view="${k}"><span>${v.title}</span>${needsPw(k) ? '<span class="nav-lock">Locked</span>' : ''}</button>`;
  }).join('');
  sb.innerHTML = items
    + (S.me.isOwner && isUnlocked() ? '<button class="nav-btn lock-now" data-act="lockNow">Lock owner pages</button>' : '')
    + `<div class="sb-foot"><div><b>${esc(S.me.name)}</b> · ${ROLE_LABEL[S.me.role] || 'Custom'}</div>
        <div class="muted small">${Store.mode === 'local' ? 'Demo mode' : 'Saving to cloud'}</div>
        <button class="btn sm full" data-act="signOut">Sign out / switch user</button></div>`;
}

function applySidebar() { const sh = $('#shell'); if (sh) sh.classList.toggle('side-closed', !S.sidebarOpen); }

function go(view) {
  const v = VIEWS[view]; if (!v || !canSee(view)) return;
  if (needsPw(view)) { askPassword('dash', () => { unlock(); go(view); }); return; }
  S.viewSubs.forEach(u => u()); S.viewSubs = [];
  S.view = view;
  if (v.enter) v.enter();
  if (window.innerWidth < 1000) S.sidebarOpen = false;
  renderSidebar();
  applySidebar();
  renderView();
  const el = $('#view'); if (el) el.scrollTop = 0;
}

let renderQueued = false;
function refresh(keys) {
  const v = VIEWS[S.view]; if (!v) return;
  if (keys && !keys.some(k => v.deps.includes(k))) return;
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderView(); });
}

function renderView() {
  const el = $('#view'); if (!el) return;
  const v = VIEWS[S.view];
  const scrolls = {};
  $$('[data-scroll]', el).forEach(s => { scrolls[s.dataset.scroll] = s.scrollTop; });
  const mainTop = el.scrollTop;
  S.charts.forEach(c => { try { c.destroy(); } catch (e) { /* ignore */ } });
  S.charts = []; S.pendingCharts = [];
  el.className = 'view view-' + S.view;
  el.innerHTML = v.render();
  $$('[data-scroll]', el).forEach(s => { if (scrolls[s.dataset.scroll] != null) s.scrollTop = scrolls[s.dataset.scroll]; });
  el.scrollTop = mainTop;
  S.pendingCharts.forEach(([id, cfg]) => mkChart(id, cfg));
  if (v.after) v.after();
}

function mkChart(id, cfg) {
  const canvas = document.getElementById(id); if (!canvas) return;
  if (!window.Chart) { canvas.parentElement.innerHTML = '<p class="muted">Chart needs internet the first time it loads.</p>'; return; }
  S.charts.push(new Chart(canvas, cfg));
}

// ---------- events ----------
function onClick(e) {
  if (isUnlocked()) S.unlockedUntil = Date.now() + LOCK_AFTER_MS;
  const el = e.target.closest('[data-act]');
  if (!el || el.closest('#modals')) return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
}
function onToggle(e) {
  const d = e.target;
  if (d.tagName !== 'DETAILS' || !d.dataset.key) return;
  if (d.open) S.libOpen.add(d.dataset.key); else S.libOpen.delete(d.dataset.key);
}
function onInput(e) { if (e.target.id === 'libSearch') { S.libSearch = e.target.value; filterLib(); } }

const ACT = {
  go: el => go(el.dataset.view),
  toggleSide: () => { S.sidebarOpen = !S.sidebarOpen; applySidebar(); },
  lockNow: () => { S.unlockedUntil = 0; renderSidebar(); if (VIEWS[S.view].locked) go(ALL_VIEWS.find(v => canSee(v) && !VIEWS[v].locked)); toast('Owner pages locked'); },
  signOut: () => confirmBox('Sign out?', 'The next person will sign in with their own username and password.', 'Sign out', signOutNow, false),
  alerts: () => openAlerts(),
  // take order
  tab: el => { S.tab = el.dataset.tab; renderView(); },
  pick: el => pickItem(el.dataset.src, el.dataset.id),
  rice: el => addExtraRice(el.dataset.size),
  cqty: el => changeCartQty(+el.dataset.i, +el.dataset.d),
  cdel: el => { S.cart.splice(+el.dataset.i, 1); renderView(); },
  cclear: () => confirmBox('Clear this order?', 'All items in the current order will be removed.', 'Yes, clear', () => { S.cart = []; renderView(); }),
  pay: el => { if (el.dataset.method === 'Cash') openCashPay(); else afterPayToast(pay(el.dataset.method)); },
  payOther: () => openPayOther(),
  gotoMenu: () => go('menu'),
  gotoInv: () => go('inventory'),
  // today's menu
  newDish: () => openDishForm(null),
  libAdd: el => addDishToToday(el.dataset.id),
  dishEdit: el => openDishForm(S.dishes.find(d => d.id === el.dataset.id)),
  dishDel: el => deleteDish(el.dataset.id),
  mRemove: el => removeFromToday(el.dataset.key),
  mPrice: el => openMenuPrice(el.dataset.key),
  copyLast: () => copyLastMenu(),
  // orders
  oDay: el => setOrdersDate(el.dataset.d === 'today' ? S.today : addDays(S.ordersDate, +el.dataset.d)),
  oEdit: el => requireEdit(() => openOrderEdit(el.dataset.id)),
  oHist: el => openHistory(el.dataset.id),
  // inventory
  invTab: el => { S.invTab = el.dataset.v; renderView(); },
  invAdd: () => openInvForm(null, S.invTab),
  invEdit: el => openInvForm(S.inventory.find(i => i.id === el.dataset.id)),
  invStock: el => openAddStock(S.inventory.find(i => i.id === el.dataset.id)),
  invSeed: () => seedSupplies(),
  eod: () => openEodReport(),
  // employees
  empTab: el => { S.empTab = el.dataset.v; empSubscribe(); renderView(); },
  empDay: el => { const d = el.dataset.d; S.empDate = d === 'today' ? S.today : addDays(S.empDate, +d); if (S.empDate > S.today) S.empDate = S.today; empSubscribe(); renderView(); },
  empPeriod: el => { S.empPeriod = el.dataset.v; empSubscribe(); renderView(); },
  empNav: el => {
    const d = +el.dataset.d;
    if (d === 0) S.empDate = S.today;
    else S.empDate = S.empPeriod === 'week' ? addDays(S.empDate, 7 * d) : addMonths(S.empDate, d);
    empSubscribe(); renderView();
  },
  empStatus: el => setEmpStatus(el.dataset.id, el.dataset.v),
  empRate: el => setEmpRating(el.dataset.id, +el.dataset.v),
  empRemoveDay: el => removeEmpFromDay(el.dataset.id),
  empAdd: () => openAddPerson(),
  empManage: () => openStaffManager(),
  empCsvDay: () => exportAttendanceCSV(S.empDate, S.empDate),
  empCsvAtt: () => { const r = empRange(); exportAttendanceCSV(r.from, r.to); },
  empCsvPay: () => exportPayrollCSV(),
  // expenses
  expMonth: el => { S.expMonth = addMonths(S.expMonth + '-01', +el.dataset.d).slice(0, 7); subExpenses(); renderView(); },
  expNew: () => openExpenseForm(null),
  expNewDay: () => openExpenseForm(null, S.dash.anchor),
  expEdit: el => openExpenseForm(S.expenses.find(x => x.id === el.dataset.id)),
  expDel: el => deleteExpense(el.dataset.id),
  // dashboard
  dPeriod: el => { S.dash.period = el.dataset.p; dashSubscribe(); renderView(); },
  dNav: el => { dashMove(+el.dataset.d); dashSubscribe(); renderView(); },
  dTarget: () => openTargetForm(),
  dRate: el => addRating(+el.dataset.v),
  dCsv: () => exportSalesCSV(),
  dCsvExp: () => exportExpensesCSV(),
  // settings
  saveName: () => { const v = $('#sName').value.trim(); if (!v) return toast('Please type a name'); saveSettings({ shopName: v }, 'Name saved'); },
  saveDashPw: () => changePassword('dp1', 'dp2', 'dashHash', 'Owner password changed'),
  saveEditPw: () => changePassword('ep1', 'ep2', 'editHash', 'Edit password saved', { editPwOff: false }),
  editPwOff: () => confirmBox('Turn off the edit password?', 'Anyone using the tablet will be able to edit or void orders.', 'Turn off', () => saveSettings({ editPwOff: true }, 'Edit password turned off')),
  savePrices: () => savePrices(),
  saveIncentives: () => saveIncentives(),
  saveSupplyRules: () => saveSupplyRules(),
  eraseDemo: () => confirmBox('Erase all demo data?', 'Everything saved on this device will be deleted.', 'Erase everything', () => {
    Object.keys(localStorage).filter(k => k.startsWith('canteen:')).forEach(k => localStorage.removeItem(k));
    location.reload();
  }),
  // accounts
  accAdd: () => openAccountForm(null),
  accEdit: el => openAccountForm(S.users.find(u => u.id === el.dataset.id)),
  accToggle: el => toggleAccount(el.dataset.id),
  accPw: el => openResetPassword(S.users.find(u => u.id === el.dataset.id)),
};

// ---------- modals, confirm, toast, password ----------
function openModal({ title, html, onMount, wide, onClose }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
    <div class="modal-head"><h2>${esc(title)}</h2><button class="modal-x" data-m="close" aria-label="Close">✕</button></div>
    <div class="modal-body"></div></div>`;
  $('#modals').appendChild(wrap);
  const body = $('.modal-body', wrap);
  body.innerHTML = html || '';
  let closed = false;
  const api = {
    el: wrap, body,
    close() { if (closed) return; closed = true; wrap.remove(); if (onClose) onClose(); },
    set(h) { body.innerHTML = h; },
    title(t) { $('.modal-head h2', wrap).textContent = t; },
  };
  wrap.addEventListener('click', e => { if (e.target.closest('[data-m="close"]')) api.close(); });
  if (onMount) onMount(api);
  return api;
}

function confirmBox(title, msg, okLabel, onOk, danger = true) {
  openModal({
    title,
    html: `<p class="big-text">${esc(msg)}</p><div class="modal-actions"><button class="btn big" data-m="close">Cancel</button><button class="btn big ${danger ? 'danger' : 'primary'}" data-m="ok">${esc(okLabel)}</button></div>`,
    onMount(m) { m.el.addEventListener('click', e => { if (e.target.closest('[data-m="ok"]')) { m.close(); onOk(); } }); },
  });
}

function toast(msg, opts = {}) {
  const box = $('#toasts'); if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>${esc(msg)}</span>${opts.action ? `<button>${esc(opts.action)}</button>` : ''}`;
  box.appendChild(t);
  const timer = setTimeout(() => t.remove(), opts.ms || 3500);
  if (opts.action) t.querySelector('button').onclick = () => { clearTimeout(timer); t.remove(); opts.onAction(); };
}

function askPassword(kind, onOk) {
  const isDash = kind === 'dash';
  openModal({
    title: isDash ? 'Owner password' : 'Password to edit orders',
    html: `<p class="muted">${isDash ? 'Enter the owner password to open this page.' : 'Enter the password to edit or void an order.'}</p>
      <input type="password" class="input big" id="pwIn" autocomplete="off" placeholder="Password">
      <label class="check"><input type="checkbox" id="pwShow"> Show password</label>
      <p class="err" id="pwErr"></p>
      <div class="modal-actions"><button class="btn big" data-m="close">Cancel</button><button class="btn primary big" data-m="ok">Open</button></div>`,
    onMount(m) {
      const inp = $('#pwIn', m.el);
      setTimeout(() => inp.focus(), 60);
      $('#pwShow', m.el).onchange = e => { inp.type = e.target.checked ? 'text' : 'password'; };
      const submit = async () => {
        const h = await hashPw(inp.value);
        const ok = isDash ? h === getDashHash() : (h === getEditHash() || h === getDashHash());
        if (ok) { m.close(); onOk(); }
        else { $('#pwErr', m.el).textContent = 'Wrong password. Please try again.'; inp.select(); }
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      m.el.addEventListener('click', e => { if (e.target.closest('[data-m="ok"]')) submit(); });
    },
  });
}

function requireEdit(fn) { if (!getEditHash() || isUnlocked()) fn(); else askPassword('edit', fn); }

function dayNav(act, date, extra) {
  const isToday = date === S.today;
  return `<div class="daynav"><button class="btn big" data-act="${act}" data-d="-1">‹ Previous day</button>
    ${isToday ? '' : `<button class="btn big" data-act="${act}" data-d="today">Today</button>`}
    <button class="btn big" data-act="${act}" data-d="1" ${isToday ? 'disabled' : ''}>Next day ›</button>${extra || ''}</div>`;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (x) { /* ignore */ }
    ta.remove(); return ok;
  }
}

/* =========================================================
   INVENTORY helpers (used by Take Order too)
   ========================================================= */
const invActive = () => S.inventory.filter(i => i.active !== false);
const invItems = cat => invActive().filter(i => i.category === cat);
const invLeft = i => Math.max(0, round2(num(i.qty)));
const fmtCount = i => `${i.approx ? 'about ' : ''}${invLeft(i)}${i.category === 'Supplies' && i.unit ? ' ' + i.unit : ''}`;
const isLow = i => num(i.qty) <= num(i.threshold);

function invAlerts() {
  const warn = num(S.settings.expiryWarnDays) || 7, lim = addDays(S.today, warn), out = [];
  invActive().forEach(i => {
    if (isLow(i)) out.push({ kind: num(i.qty) <= 0 ? 'out' : 'low', i, text: num(i.qty) <= 0 ? `${i.name}: none left` : `${i.name}: only ${fmtCount(i)} left` });
    if (i.category !== 'Supplies' && i.hasExpiry && i.expiry) {
      if (i.expiry < S.today) out.push({ kind: 'expired', i, text: `${i.name}: expired on ${fmtShort(i.expiry)}` });
      else if (i.expiry <= lim) { const d = daysBetween(S.today, i.expiry); out.push({ kind: 'expiring', i, text: `${i.name}: expires ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : 'in ' + d + ' days'} (${fmtShort(i.expiry)})` }); }
    }
  });
  const order = { out: 0, expired: 1, low: 2, expiring: 3 };
  return out.sort((a, b) => order[a.kind] - order[b.kind]);
}
const ALERT_LABEL = { out: 'Out of stock', low: 'Low stock', expired: 'Expired', expiring: 'Expiring soon' };

function alertList(list) {
  return list.length ? `<ul class="alert-list">${list.map(a => `<li class="al-${a.kind}"><span class="al-tag">${ALERT_LABEL[a.kind]}</span>${esc(a.text)}</li>`).join('')}</ul>` : '<p class="muted">No alerts.</p>';
}

function openAlerts() {
  openModal({
    title: 'Stock alerts', html: alertList(invAlerts()) + `<div class="modal-actions">${canSee('inventory') ? '<button class="btn big" data-m="inv">Open Inventory</button>' : ''}<button class="btn primary big" data-m="close">OK</button></div>`,
    onMount(m) { m.el.addEventListener('click', e => { if (e.target.closest('[data-m="inv"]')) { m.close(); go('inventory'); } }); },
  });
}

// How much stock an order uses: sold items + paper plates / spoon & fork for plated meals.
function stockUse(items) {
  const m = {}, add = (id, n) => { if (id && n) m[id] = round2((m[id] || 0) + n); };
  items.forEach(l => { if (l.invId) add(l.invId, num(l.qty)); });
  const R = S.settings.supplyRules;
  const plates = sum(items.filter(l => R.meals.includes(l.category) && l.type !== 'Extra Rice' && R.modes.includes(l.service || 'nocontainer')), l => l.qty);
  if (plates) {
    const sup = role => invItems('Supplies').find(i => i.role === role);
    const p = sup('plate'), u = sup('utensil');
    if (p) add(p.id, plates);
    if (u) add(u.id, plates);
  }
  return m;
}
function applyStock(map, sign) { Object.entries(map || {}).forEach(([id, n]) => { if (S.inventory.some(i => i.id === id)) Store.inc('inventory', id, 'qty', sign * n); }); }

/* =========================================================
   TAKE ORDER
   ========================================================= */
const todayItems = cat => (S.menu.items || []).filter(i => i.category === cat);
const hasOptions = i => (i.riceMeal && (i.allowNoRice || i.allowHalfRice)) || i.allowContainer;
const nextOrderNo = () => S.todayOrders.reduce((m, o) => Math.max(m, o.no || 0), 0) + 1;
const cartTotal = () => round2(sum(S.cart, l => l.total));

function renderPOS() {
  const tabs = TABS.map(t => {
    const n = (t === 'Snacks' || t === 'Others') ? invItems(t).length : todayItems(t).length;
    return `<button class="tab ${S.tab === t ? 'active' : ''}" data-act="tab" data-tab="${t}">${t}<span class="tab-n">${n}</span></button>`;
  }).join('');
  return `<div class="pos">
    <section class="pos-main"><div class="tabs">${tabs}</div><div class="pos-items" data-scroll="pos-${S.tab}">${renderPosItems()}</div></section>
    ${renderCart()}
  </div>`;
}

function renderPosItems() {
  const t = S.tab;
  let groups;
  if (t === 'Snacks') {
    groups = SNACK_KINDS.map(k => ({ title: k, items: invItems('Snacks').filter(s => s.kind === k).map(s => ({ ...s, src: 'inv', key: s.id, type: s.kind })) }));
  } else if (t === 'Others') {
    groups = [{ title: null, items: invItems('Others').map(s => ({ ...s, src: 'inv', key: s.id, type: 'Others' })) }];
  } else if (t === 'Lunch') {
    const items = todayItems('Lunch').map(i => ({ ...i, src: 'menu' }));
    groups = LUNCH_TYPES.map(ty => ({ title: ty, items: items.filter(i => i.type === ty) }));
    const other = items.filter(i => !LUNCH_TYPES.includes(i.type));
    if (other.length) groups.push({ title: 'Others', items: other });
  } else {
    groups = [{ title: null, items: todayItems(t).map(i => ({ ...i, src: 'menu' })) }];
  }
  let html;
  if (!groups.some(g => g.items.length)) {
    html = (t === 'Snacks' || t === 'Others')
      ? `<div class="empty"><h3>No ${t.toLowerCase()} in the inventory yet.</h3><p>Items added in Inventory appear here automatically.</p>${canSee('inventory') ? '<button class="btn primary big" data-act="gotoInv">Go to Inventory</button>' : ''}</div>`
      : `<div class="empty"><h3>No ${t} menu yet today.</h3><p>Add today's dishes in Today's Menu.</p><button class="btn primary big" data-act="gotoMenu">Go to Today's Menu</button></div>`;
  } else {
    html = groups.filter(g => g.items.length).map(g =>
      `${g.title ? `<h3 class="grp">${esc(g.title)}</h3>` : ''}<div class="grid">${g.items.map(itemCard).join('')}</div>`
    ).join('');
  }
  if (t === 'Breakfast' || t === 'Lunch') html += extraRiceBar();
  return html;
}

function itemCard(i) {
  const inv = i.src === 'inv', left = inv ? invLeft(i) : 0, out = inv && left <= 0;
  return `<button class="item-card ${out ? 'sold-out' : ''}" data-act="pick" data-src="${i.src}" data-id="${esc(i.key)}">
    <span class="eyebrow">${esc(i.type)}</span>
    <span class="ic-name">${esc(i.name)}</span>
    <span class="ic-price">${peso(i.price)}${i.riceMeal ? '<small> with rice</small>' : ''}</span>
    ${inv ? `<span class="stock ${isLow(i) ? 'low' : ''}">${out ? 'Sold out' : fmtCount(i) + ' left'}</span>` : ''}</button>`;
}

function extraRiceBar() {
  const r = S.settings.extraRice;
  return `<h3 class="grp">Extra rice</h3><div class="grid">
    <button class="item-card rice" data-act="rice" data-size="full"><span class="ic-name">+ 1 Rice</span><span class="ic-price">${peso(r.full)}</span></button>
    <button class="item-card rice" data-act="rice" data-size="half"><span class="ic-name">+ ½ Rice</span><span class="ic-price">${peso(r.half)}</span></button></div>`;
}

function pickItem(src, id) {
  let item, category;
  if (src === 'inv') {
    const inv = S.inventory.find(s => s.id === id); if (!inv) return;
    item = { ...inv, invId: inv.id, type: inv.category === 'Snacks' ? inv.kind : 'Others' };
    category = inv.category;
    const go2 = () => { if (hasOptions(item)) openItemOptions(item, category); else addToCart(makeLine(item, {}, category)); };
    if (invLeft(inv) <= 0) confirmBox(`${inv.name} – sold out?`, 'The inventory shows none left. Sell anyway?', 'Sell anyway', go2, false);
    else go2();
    return;
  }
  item = (S.menu.items || []).find(i => i.key === id); if (!item) return;
  category = item.category;
  if (hasOptions(item)) openItemOptions(item, category);
  else addToCart(makeLine(item, {}, category));
}

function makeLine(item, opts, category) {
  const { rice = 'full', service = 'nocontainer', qty = 1 } = opts || {};
  const adj = S.settings.adj, base = num(item.price), riceMeal = !!item.riceMeal;
  const svc = item.allowContainer ? service : (service === 'container' ? 'nocontainer' : service);
  let unit = base;
  if (riceMeal && rice === 'half') unit += num(adj.halfRice);
  if (riceMeal && rice === 'none') unit += num(adj.noRice);
  if (svc === 'container') unit += num(adj.container);
  unit = round2(unit);
  const line = { name: item.name, category, type: item.type, base, rice: riceMeal ? rice : null, service: svc, container: svc === 'container', qty, unit, total: round2(unit * qty) };
  if (item.invId) line.invId = item.invId;
  return line;
}

function addToCart(line) {
  const ex = S.cart.find(l => lineKey(l) === lineKey(line));
  if (ex) { ex.qty += line.qty; ex.total = round2(ex.unit * ex.qty); }
  else S.cart.push(line);
  renderView();
}

function changeCartQty(i, d) {
  const l = S.cart[i]; if (!l) return;
  l.qty += d;
  if (l.qty <= 0) S.cart.splice(i, 1); else l.total = round2(l.unit * l.qty);
  renderView();
}

function addExtraRice(size) {
  const r = S.settings.extraRice, half = size === 'half';
  addToCart(makeLine({ name: half ? 'Extra ½ Rice' : 'Extra Rice', type: 'Extra Rice', price: half ? r.half : r.full, riceMeal: false }, { service: null }, S.tab));
}

function openItemOptions(item, category) {
  const st = { rice: 'full', service: 'nocontainer', qty: 1 };
  const adj = S.settings.adj;
  const draw = () => {
    const riceOpts = item.riceMeal ? [['full', 'With rice', 0]] : [];
    if (item.riceMeal && item.allowHalfRice) riceOpts.push(['half', 'Half rice', num(adj.halfRice)]);
    if (item.riceMeal && item.allowNoRice) riceOpts.push(['none', 'No rice', num(adj.noRice)]);
    const services = SERVICES.filter(([v]) => v !== 'container' || item.allowContainer);
    const line = makeLine(item, st, category);
    return `
      ${riceOpts.length > 1 ? `<div class="opt-label">Rice</div><div class="seg">${riceOpts.map(([v, l, a]) =>
        `<button class="seg-btn ${st.rice === v ? 'on' : ''}" data-m="rice" data-v="${v}">${l}<small>${peso(num(item.price) + a)}</small></button>`).join('')}</div>` : ''}
      <div class="opt-label">Dine-in or take-out</div><div class="seg">${services.map(([v, l]) =>
        `<button class="seg-btn ${st.service === v ? 'on' : ''}" data-m="svc" data-v="${v}">${l}${v === 'container' ? `<small>+${peso(adj.container)}</small>` : ''}</button>`).join('')}</div>
      <div class="opt-label">How many?</div>
      <div class="qty big"><button data-m="q" data-d="-1" aria-label="Less">−</button><span>${st.qty}</span><button data-m="q" data-d="1" aria-label="More">+</button></div>
      <div class="modal-actions"><button class="btn big" data-m="close">Cancel</button><button class="btn primary big grow" data-m="add">Add to order — ${peso(line.total)}</button></div>`;
  };
  openModal({
    title: item.name, html: draw(),
    onMount(m) {
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const a = b.dataset.m;
        if (a === 'rice') st.rice = b.dataset.v;
        else if (a === 'svc') st.service = b.dataset.v;
        else if (a === 'q') st.qty = Math.max(1, st.qty + Number(b.dataset.d));
        else if (a === 'add') { addToCart(makeLine(item, st, category)); m.close(); return; }
        else return;
        m.set(draw());
      });
    },
  });
}

function renderCart() {
  const has = S.cart.length > 0;
  const lines = S.cart.map((l, i) => `<div class="cline">
      <div class="cl-info"><b>${esc(l.name)}</b><small>${esc([lineDesc(l), peso(l.unit) + ' each'].filter(Boolean).join(' · '))}</small></div>
      <div class="qty"><button data-act="cqty" data-i="${i}" data-d="-1" aria-label="Less">−</button><span>${l.qty}</span><button data-act="cqty" data-i="${i}" data-d="1" aria-label="More">+</button></div>
      <div class="cl-total">${peso(l.total)}</div>
      <button class="cl-x" data-act="cdel" data-i="${i}" aria-label="Remove">✕</button></div>`).join('');
  const dis = has ? '' : 'disabled';
  return `<aside class="cart">
    <div class="cart-head"><h2>Order</h2><span class="muted">No. ${nextOrderNo()}</span></div>
    <div class="cart-lines" data-scroll="cart">${has ? lines : '<p class="cart-empty">Tap the food on the left to add it here.</p>'}</div>
    <div class="cart-foot">
      <div class="cart-total"><span>Total</span><b>${peso(cartTotal())}</b></div>
      <button class="pay cash" data-act="pay" data-method="Cash" ${dis}>Paid – Cash</button>
      <button class="pay gcash" data-act="pay" data-method="GCash" ${dis}>Paid – GCash</button>
      <button class="pay other" data-act="payOther" ${dis}>Paid – Others</button>
      ${has ? '<button class="link-btn" data-act="cclear">Clear order</button>' : ''}
    </div></aside>`;
}

function openCashPay() {
  if (!S.cart.length) return;
  const total = cartTotal();
  let res = null;
  const drawPick = () => `
    <div class="cash-total"><span>Total</span><b>${peso(total)}</b></div>
    <div class="opt-label">Amount received</div>
    <div class="cash-grid">
      <button class="cash-btn exact" data-m="amt" data-v="${total}">Exact</button>
      ${CASH_NOTES.map(v => `<button class="cash-btn" data-m="amt" data-v="${v}" ${v < total ? 'disabled' : ''}>${peso(v)}</button>`).join('')}
    </div>
    <div class="opt-label">Or type the amount received</div>
    <div class="row-inline"><input class="input big" id="cashIn" type="number" inputmode="decimal" min="0" placeholder="e.g. 250"><button class="btn primary big" data-m="ok">OK</button></div>
    <p class="err" id="cashErr"></p>`;
  const drawChange = given => `
    <div class="change-box"><span>Change</span><b>${peso(round2(given - total))}</b></div>
    <p class="center muted">Received ${peso(given)} · Total ${peso(total)}</p>
    <div class="modal-actions"><button class="btn primary big grow" data-m="next">OK – next order</button></div>`;
  openModal({
    title: 'Paid – Cash', html: drawPick(),
    onClose: () => { if (res) afterPayToast(res); },
    onMount(m) {
      const err = t => { const e = $('#cashErr', m.el); if (e) e.textContent = t; };
      const finish = given => {
        given = round2(given);
        if (given < total) return err(`That is less than the total (${peso(total)}).`);
        res = pay('Cash', { given, change: round2(given - total) });
        m.title('Change');
        m.set(drawChange(given));
      };
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b || res && b.dataset.m !== 'next') return;
        const a = b.dataset.m;
        if (a === 'amt') finish(num(b.dataset.v));
        else if (a === 'ok') { const v = $('#cashIn', m.el).value; if (!v) err('Please type the amount received.'); else finish(num(v)); }
        else if (a === 'next') m.close();
      });
      m.el.addEventListener('keydown', e => { if (e.target.id === 'cashIn' && e.key === 'Enter') { const v = e.target.value; if (v) finish(num(v)); } });
    },
  });
}

function openPayOther() {
  if (!S.cart.length) return;
  openModal({
    title: `Paid with… (${peso(cartTotal())})`,
    html: `<div class="pay-big">
      <button class="pay other" data-m="p" data-v="PayMaya">PayMaya / Maya</button>
      <button class="pay other" data-m="p" data-v="Bank Transfer">Bank Transfer</button>
      <button class="pay other" data-m="p" data-v="Other">Other</button></div>
      <div class="modal-actions"><button class="btn big" data-m="close">Cancel</button></div>`,
    onMount(m) {
      m.el.addEventListener('click', e => { const b = e.target.closest('[data-m="p"]'); if (b) { m.close(); afterPayToast(pay(b.dataset.v)); } });
    },
  });
}

function pay(method, cash) {
  if (!S.cart.length) return null;
  if (todayKey() !== S.today) subscribeToday();
  const items = S.cart.map(l => ({ ...l }));
  const order = {
    date: S.today, no: nextOrderNo(), createdAt: Date.now(), by: S.me.name,
    items, total: cartTotal(), payment: method, payGroup: payGroup(method), cash: cash || null,
    stock: stockUse(items), edits: [], voided: false,
  };
  const id = Store.add('orders', order);
  applyStock(order.stock, -1);
  // Warn when a snack / others item is running low.
  const used = {};
  items.forEach(l => { if (l.invId) used[l.invId] = (used[l.invId] || 0) + l.qty; });
  Object.entries(used).forEach(([iid, n]) => {
    const inv = S.inventory.find(i => i.id === iid); if (!inv) return;
    const left = round2(num(inv.qty) - n);
    if (left <= num(inv.threshold)) toast(left <= 0 ? `${inv.name}: none left` : `Only ${left} ${inv.name} left`, { ms: 5000 });
  });
  const saved = S.cart;
  S.cart = [];
  renderView();
  return { id, order, saved };
}

function afterPayToast(res) {
  if (!res) return;
  const { id, order, saved } = res;
  toast(`Order ${order.no} saved — ${peso(order.total)} (${order.payment})`, {
    action: 'Undo', ms: 7000,
    onAction: () => { Store.remove('orders', id); applyStock(order.stock, +1); S.cart = saved; renderView(); toast('Order cancelled. The items are back.'); },
  });
}

/* =========================================================
   TODAY'S MENU
   ========================================================= */
function optText(i) {
  if (!i.riceMeal) return i.allowContainer ? 'Container option' : '';
  const o = ['Rice meal'];
  if (i.allowHalfRice) o.push('half rice');
  if (i.allowNoRice) o.push('no rice');
  if (i.allowContainer) o.push('container');
  return o.join(' · ');
}

function renderMenu() {
  const items = S.menu.items || [];
  const menuRow = i => `<div class="mrow">
    <div class="mr-info"><b>${esc(i.name)}</b><small>${esc(optText(i))}</small></div>
    <b class="mr-price">${peso(i.price)}</b>
    <button class="btn sm" data-act="mPrice" data-key="${esc(i.key)}">Change price</button>
    <button class="btn sm danger-o" data-act="mRemove" data-key="${esc(i.key)}">Remove</button></div>`;
  const section = meal => {
    const list = items.filter(i => i.category === meal);
    let inner;
    if (!list.length) inner = '<p class="muted pad">Nothing yet. Pick from <b>Saved Dishes</b>, or tap <b>New Dish</b>.</p>';
    else if (meal === 'Lunch') {
      inner = [...LUNCH_TYPES, 'Others'].map(ty => {
        const l = list.filter(i => ty === 'Others' ? !LUNCH_TYPES.includes(i.type) : i.type === ty);
        return l.length ? `<div class="subgrp">${ty}</div>${l.map(menuRow).join('')}` : '';
      }).join('');
    } else inner = list.map(menuRow).join('');
    return `<section class="card"><h2 class="card-title">${meal} <span class="count">${list.length}</span></h2>${inner}</section>`;
  };
  const invRow = i => `<div class="mrow"><div class="mr-info"><b>${esc(i.name)}</b><small>${esc(i.category === 'Snacks' ? i.kind : 'Others')}</small></div>
    <span class="stock ${isLow(i) ? 'low' : ''}">${invLeft(i) <= 0 ? 'Sold out' : fmtCount(i) + ' left'}</span><b class="mr-price">${peso(i.price)}</b></div>`;
  const inv = [...invItems('Snacks'), ...invItems('Others')];
  return `<div class="split">
    <div class="split-main" data-scroll="menu-main">
      <div class="page-head"><div><h1>Today's Menu</h1><p class="muted">${fmtDate(S.today)} · The menu starts empty every new day.</p></div>
        <button class="btn big" data-act="copyLast">Copy last menu</button></div>
      ${MEALS.map(section).join('')}
      <section class="card"><div class="card-title-row"><h2 class="card-title">Snacks & Others <span class="muted small">from inventory, always on sale while in stock</span></h2>
        ${canSee('inventory') ? '<button class="btn" data-act="gotoInv">Open Inventory</button>' : ''}</div>
        ${inv.length ? inv.map(invRow).join('') : '<p class="muted pad">Nothing in the inventory yet.</p>'}</section>
    </div>
    ${renderLibrary()}
  </div>`;
}

function renderLibrary() {
  const onToday = new Set((S.menu.items || []).map(i => i.dishId).filter(Boolean));
  const row = d => `<div class="lrow" data-name="${esc(d.name.toLowerCase())}">
    <div class="lr-info"><b>${esc(d.name)}</b><small>${peso(d.price)}${d.riceMeal ? ' · with rice' : ''}</small></div>
    ${onToday.has(d.id) ? '<span class="on-menu">On menu</span>' : `<button class="btn sm primary" data-act="libAdd" data-id="${d.id}">Add</button>`}
    <button class="btn sm" data-act="dishEdit" data-id="${d.id}">Edit</button>
    <button class="icon-btn" data-act="dishDel" data-id="${d.id}" aria-label="Delete">✕</button></div>`;
  const rows = l => l.length ? l.map(row).join('') : '<p class="muted pad-s">No saved dishes yet.</p>';
  const det = (key, cls, label, count, inner) =>
    `<details class="${cls}" data-key="${key}" ${S.libOpen.has(key) ? 'open' : ''}><summary>${label} <span class="count">${count}</span></summary>${inner}</details>`;
  const byCat = c => S.dishes.filter(d => d.category === c);
  const lunch = byCat('Lunch');
  const lunchInner = LUNCH_TYPES.map(t => { const l = lunch.filter(d => d.type === t); return det('type-' + t, 'lib-type', t, l.length, rows(l)); }).join('');
  return `<aside class="side-panel lib" data-scroll="lib">
    <h2>Saved Dishes</h2>
    <p class="muted small">Dishes you added before are kept here. Tap <b>Add</b> to put one on today's menu.</p>
    <button class="btn primary big full" data-act="newDish">New Dish</button>
    <input id="libSearch" class="input" type="search" placeholder="Search saved dishes" value="${esc(S.libSearch)}">
    ${det('cat-Breakfast', 'lib-cat', 'Breakfast', byCat('Breakfast').length, rows(byCat('Breakfast')))}
    ${det('cat-Lunch', 'lib-cat', 'Lunch', lunch.length, lunchInner)}
    ${det('cat-Merienda', 'lib-cat', 'Merienda', byCat('Merienda').length, rows(byCat('Merienda')))}
  </aside>`;
}

function filterLib() {
  const q = S.libSearch.trim().toLowerCase();
  $$('.lrow').forEach(r => { r.hidden = !!q && !r.dataset.name.includes(q); });
  if (q) $$('.lib details').forEach(d => { d.open = true; });
}

function saveMenu(items) {
  S.menu = { date: S.today, items };
  Store.set('menus', S.today, { date: S.today, items });
  refresh(['menu']);
}

function snapFromDish(d) {
  return {
    key: uid(), dishId: d.id, name: d.name, category: d.category, type: d.type, price: num(d.price),
    riceMeal: !!d.riceMeal, allowNoRice: !!d.allowNoRice, allowHalfRice: !!d.allowHalfRice, allowContainer: !!d.allowContainer,
  };
}

function addDishToToday(id) {
  const d = S.dishes.find(x => x.id === id); if (!d) return;
  if ((S.menu.items || []).some(i => i.dishId === id)) { toast("Already on today's menu"); return; }
  saveMenu([...(S.menu.items || []), snapFromDish(d)]);
  toast(`${d.name} added to today's ${d.category}`);
}

function removeFromToday(key) {
  const it = (S.menu.items || []).find(i => i.key === key); if (!it) return;
  confirmBox(`Remove ${it.name}?`, "It will be taken off today's menu. It stays in Saved Dishes for next time.", 'Remove',
    () => saveMenu(S.menu.items.filter(i => i.key !== key)));
}

async function copyLastMenu() {
  let list;
  try { list = await Store.query('menus', { from: addDays(S.today, -30), to: addDays(S.today, -1) }); }
  catch (e) { toast('Could not load past menus. Please check the internet.'); return; }
  list = list.filter(m => m.items && m.items.length).sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) { toast('No menu found in the last 30 days.'); return; }
  const last = list[0];
  const have = new Set((S.menu.items || []).map(i => i.dishId || i.name));
  const add = last.items.filter(i => !have.has(i.dishId || i.name)).map(i => ({ ...i, key: uid() }));
  if (!add.length) { toast("Those dishes are already on today's menu."); return; }
  confirmBox(`Copy the menu from ${fmtDate(last.date, { weekday: 'long', month: 'short', day: 'numeric' })}?`,
    `${add.length} dish(es) will be added to today's menu. You can remove the ones you are not serving.`, 'Copy',
    () => saveMenu([...(S.menu.items || []), ...add]), false);
}

function openMenuPrice(key) {
  const it = (S.menu.items || []).find(i => i.key === key); if (!it) return;
  const dish = it.dishId && S.dishes.find(d => d.id === it.dishId);
  openModal({
    title: `Change price – ${it.name}`,
    html: `<label class="field">New price for today (₱)<input class="input big" type="number" inputmode="decimal" min="0" id="npr" value="${esc(it.price)}"></label>
      ${dish ? '<label class="check big"><input type="checkbox" id="nprSave"> Also use this price next time</label>' : ''}
      <p class="err" id="nprErr"></p>
      <div class="modal-actions"><button class="btn big" data-m="close">Cancel</button><button class="btn primary big" data-m="ok">Save price</button></div>`,
    onMount(m) {
      m.el.addEventListener('click', e => {
        if (!e.target.closest('[data-m="ok"]')) return;
        const p = num($('#npr', m.el).value);
        if (p <= 0) { $('#nprErr', m.el).textContent = 'Please type a valid price.'; return; }
        saveMenu(S.menu.items.map(i => i.key === key ? { ...i, price: p } : i));
        const save = $('#nprSave', m.el);
        if (dish && save && save.checked) Store.set('dishes', dish.id, { ...dish, price: p, updatedAt: Date.now() });
        m.close();
        toast(`${it.name} is now ${peso(p)}`);
      });
    },
  });
}

const defPrice = t => { const p = S.settings.prices[t]; return p === undefined || p === null ? '' : p; };

// Rice / container options — shared by the dish form and the "Others" inventory form.
function riceOptionsHtml(st) {
  const adj = S.settings.adj;
  return `<div class="opt-label">Rice meal? (comes with rice)</div>
    <div class="seg"><button class="seg-btn ${st.riceMeal ? 'on' : ''}" data-m="rm" data-v="1">Yes, with rice</button><button class="seg-btn ${!st.riceMeal ? 'on' : ''}" data-m="rm" data-v="0">No</button></div>
    <div class="opt-label">Options the customer can choose</div>
    <div class="checks">
      ${st.riceMeal ? `<label class="check big"><input type="checkbox" data-f="allowNoRice" ${st.allowNoRice ? 'checked' : ''}> No rice (${peso(adj.noRice)})</label>
      <label class="check big"><input type="checkbox" data-f="allowHalfRice" ${st.allowHalfRice ? 'checked' : ''}> Half rice (${peso(adj.halfRice)})</label>` : ''}
      <label class="check big"><input type="checkbox" data-f="allowContainer" ${st.allowContainer ? 'checked' : ''}> With container (+${peso(adj.container)})</label>
    </div>`;
}

function openDishForm(dish) {
  const isNew = !dish;
  const st = dish ? { ...dish } : {
    name: '', category: 'Lunch', type: 'Beef', price: defPrice('Beef'),
    riceMeal: true, allowNoRice: true, allowHalfRice: true, allowContainer: true, addToday: true,
  };
  const draw = () => `
    <label class="field">Dish name<input class="input big" id="dName" value="${esc(st.name)}" placeholder="e.g. Beef Caldereta" autocomplete="off"></label>
    <div class="opt-label">Meal</div>
    <div class="seg">${MEALS.map(c => `<button class="seg-btn ${st.category === c ? 'on' : ''}" data-m="cat" data-v="${c}">${c}</button>`).join('')}</div>
    ${TYPES_BY_MEAL[st.category].length > 1 ? `<div class="opt-label">Type</div>
      <div class="seg">${TYPES_BY_MEAL[st.category].map(t => `<button class="seg-btn ${st.type === t ? 'on' : ''}" data-m="type" data-v="${t}">${t}</button>`).join('')}</div>` : ''}
    <label class="field">Price (₱)<input class="input big" id="dPrice" type="number" inputmode="decimal" min="0" value="${esc(st.price)}"></label>
    ${riceOptionsHtml(st)}
    ${isNew ? `<label class="check big hl"><input type="checkbox" data-f="addToday" ${st.addToday ? 'checked' : ''}> Put on today's menu now</label>` : ''}
    <p class="muted small">Other meals like katsu? Add them in Inventory under “Others”.</p>
    <p class="err" id="dErr"></p>
    <div class="modal-actions"><button class="btn big" data-m="close">Cancel</button><button class="btn primary big grow" data-m="save">Save dish</button></div>`;
  openModal({
    title: isNew ? 'New Dish' : 'Edit Dish', html: draw(),
    onMount(m) {
      m.el.addEventListener('input', e => {
        if (e.target.id === 'dName') st.name = e.target.value;
        if (e.target.id === 'dPrice') st.price = e.target.value;
      });
      m.el.addEventListener('change', e => { if (e.target.dataset.f) st[e.target.dataset.f] = e.target.checked; });
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const a = b.dataset.m;
        const oldDefault = defPrice(st.type);
        const priceUntouched = st.price === '' || String(st.price) === String(oldDefault);
        if (a === 'cat') {
          st.category = b.dataset.v;
          st.type = TYPES_BY_MEAL[st.category][0];
          st.riceMeal = st.category !== 'Merienda';
          if (priceUntouched) st.price = defPrice(st.type);
        } else if (a === 'type') {
          st.type = b.dataset.v;
          if (priceUntouched) st.price = defPrice(st.type);
        } else if (a === 'rm') {
          st.riceMeal = b.dataset.v === '1';
          if (st.riceMeal && st.allowNoRice === undefined) { st.allowNoRice = true; st.allowHalfRice = true; }
        } else if (a === 'save') {
          saveDish(); return;
        } else return;
        m.set(draw());
      });
      function saveDish() {
        const name = String(st.name || '').trim(), price = num(st.price);
        const err = t => { $('#dErr', m.el).textContent = t; };
        if (!name) return err('Please type the dish name.');
        if (price <= 0) return err('Please type the price.');
        const data = {
          name, category: st.category, type: st.type, price, riceMeal: !!st.riceMeal,
          allowNoRice: !!st.riceMeal && !!st.allowNoRice, allowHalfRice: !!st.riceMeal && !!st.allowHalfRice,
          allowContainer: !!st.allowContainer, updatedAt: Date.now(),
        };
        if (isNew) {
          const dup = S.dishes.find(d => d.name.toLowerCase() === name.toLowerCase() && d.category === data.category);
          let id;
          if (dup) { id = dup.id; Store.set('dishes', id, { ...dup, ...data }); }
          else { data.createdAt = Date.now(); id = Store.add('dishes', data); }
          if (st.addToday && !(S.menu.items || []).some(i => i.dishId === id)) saveMenu([...(S.menu.items || []), snapFromDish({ ...data, id })]);
          toast(`${name} saved${st.addToday ? " and added to today's menu" : ''}`);
        } else {
          Store.set('dishes', dish.id, { ...dish, ...data });
          if ((S.menu.items || []).some(i => i.dishId === dish.id)) {
            saveMenu(S.menu.items.map(i => i.dishId === dish.id ? { ...snapFromDish({ ...data, id: dish.id }), key: i.key } : i));
          }
          toast(`${name} updated`);
        }
        m.close();
      }
      setTimeout(() => { if (isNew) { const n = $('#dName', m.el); if (n) n.focus(); } }, 60);
    },
  });
}

function deleteDish(id) {
  const d = S.dishes.find(x => x.id === id); if (!d) return;
  confirmBox(`Delete “${d.name}”?`, "It will be removed from Saved Dishes. Today's menu and past sales are not affected.", 'Delete', () => {
    Store.remove('dishes', id);
    toast(`${d.name} deleted`);
  });
}

/* =========================================================
   ORDERS & SALES
   ========================================================= */
function enterOrders() { S.ordersDate = S.ordersDate || S.today; subOrdersDate(); }

function subOrdersDate() {
  S.viewSubs.forEach(u => u()); S.viewSubs = [];
  if (S.ordersDate !== S.today) {
    S.otherOrders = [];
    S.viewSubs.push(Store.listen('orders', { date: S.ordersDate }, l => { S.otherOrders = l; refresh(['orders']); }));
  }
}

function setOrdersDate(k) { if (k > S.today) k = S.today; S.ordersDate = k; subOrdersDate(); renderView(); }
const ordersForView = () => S.ordersDate === S.today ? S.todayOrders : S.otherOrders;
const findOrder = id => ordersForView().find(o => o.id === id) || S.todayOrders.find(o => o.id === id);

function renderOrders() {
  const all = ordersForView().slice().sort((a, b) => b.createdAt - a.createdAt);
  const act = all.filter(o => !o.voided);
  const byGroup = g => sum(act.filter(o => payGroup(o.payment) === g), o => o.total);
  const others = ['PayMaya', 'Bank Transfer', 'Other'].map(m => [m, sum(act.filter(o => o.payment === m), o => o.total)]).filter(x => x[1] > 0);
  const isToday = S.ordersDate === S.today;
  return `<div class="page">
    <div class="page-head"><div><h1>Orders & Sales</h1><p class="muted">${isToday ? '<b>Today</b> – ' : ''}${fmtDate(S.ordersDate)}</p></div>
      ${dayNav('oDay', S.ordersDate)}</div>
    <div class="tiles">
      <div class="tile big-tile"><span>Total sales</span><b>${peso(sum(act, o => o.total))}</b><small>${act.length} order(s)</small></div>
      <div class="tile"><span>Cash</span><b>${peso(byGroup('Cash'))}</b></div>
      <div class="tile"><span>GCash</span><b>${peso(byGroup('GCash'))}</b></div>
      <div class="tile"><span>Others</span><b>${peso(byGroup('Others'))}</b><small>${others.map(([m, v]) => `${m}: ${peso(v)}`).join(' · ') || '—'}</small></div>
    </div>
    ${all.length ? all.map(orderCard).join('') : '<div class="empty"><h3>No orders for this day.</h3></div>'}
  </div>`;
}

function orderCard(o) {
  const n = (o.edits || []).length;
  return `<article class="ocard ${o.voided ? 'voided' : ''}">
    <div class="oc-head"><b class="oc-no">No. ${o.no}</b><span class="muted">${fmtTime(o.createdAt)}${o.by ? ' · ' + esc(o.by) : ''}</span>
      <span class="paytag p-${payGroup(o.payment)}">${esc(o.payment)}</span>
      ${n && !o.voided ? '<span class="tag">Edited</span>' : ''}${o.voided ? '<span class="tag solid">Voided</span>' : ''}
      <b class="oc-total">${peso(o.total)}</b></div>
    <ul class="oc-items">${(o.items || []).map(l => `<li><span>${l.qty} × ${esc(l.name)}${lineDesc(l) ? ` <small>(${esc(lineDesc(l))})</small>` : ''}</span><span>${peso(l.total)}</span></li>`).join('')}</ul>
    ${o.cash && o.payment === 'Cash' ? `<p class="muted small">Received ${peso(o.cash.given)} · Change ${peso(o.cash.change)}</p>` : ''}
    <div class="oc-actions">${o.voided ? '' : `<button class="btn" data-act="oEdit" data-id="${o.id}">Edit</button>`}
      ${n ? `<button class="btn" data-act="oHist" data-id="${o.id}">History (${n})</button>` : ''}</div>
  </article>`;
}

function openOrderEdit(id) {
  const o = findOrder(id); if (!o) return;
  const st = { items: (o.items || []).map(l => ({ ...l })), payment: o.payment, reason: '' };
  const draw = () => {
    const total = round2(sum(st.items, l => l.total));
    return `<p class="muted">Order No. ${o.no} · ${fmtDate(o.date, { month: 'short', day: 'numeric' })}, ${fmtTime(o.createdAt)}</p>
      <div>${st.items.map((l, i) => `<div class="cline">
        <div class="cl-info"><b>${esc(l.name)}</b><small>${esc([lineDesc(l), peso(l.unit) + ' each'].filter(Boolean).join(' · '))}</small></div>
        <div class="qty"><button data-m="q" data-i="${i}" data-d="-1">−</button><span>${l.qty}</span><button data-m="q" data-i="${i}" data-d="1">+</button></div>
        <div class="cl-total">${peso(l.total)}</div><button class="cl-x" data-m="del" data-i="${i}" aria-label="Remove">✕</button></div>`).join('')
        || '<p class="muted">All items removed. Use “Void order” to cancel the whole order.</p>'}</div>
      <div class="cart-total"><span>New total</span><b>${peso(total)}</b></div>
      <div class="opt-label">Paid with</div>
      <div class="seg">${PAY_METHODS.map(p => `<button class="seg-btn ${st.payment === p ? 'on' : ''}" data-m="pay" data-v="${p}">${esc(p)}</button>`).join('')}</div>
      <label class="field">Reason for the change (required)<input class="input big" id="eReason" value="${esc(st.reason)}" placeholder="e.g. Wrong item, customer changed order"></label>
      <p class="err" id="eErr"></p>
      <div class="modal-actions"><button class="btn big danger-o" data-m="void">Void order</button><span class="grow"></span>
        <button class="btn big" data-m="close">Cancel</button><button class="btn primary big" data-m="save">Save changes</button></div>`;
  };
  openModal({
    title: 'Edit order', html: draw(), wide: true,
    onMount(m) {
      m.el.addEventListener('input', e => { if (e.target.id === 'eReason') st.reason = e.target.value; });
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const a = b.dataset.m;
        const err = t => { $('#eErr', m.el).textContent = t; };
        const before = { items: o.items, total: o.total, payment: o.payment };
        if (a === 'q') { const l = st.items[+b.dataset.i]; l.qty = Math.max(1, l.qty + Number(b.dataset.d)); l.total = round2(l.unit * l.qty); }
        else if (a === 'del') st.items.splice(+b.dataset.i, 1);
        else if (a === 'pay') st.payment = b.dataset.v;
        else if (a === 'save') {
          if (!st.items.length) return err('The order has no items. Use “Void order” instead.');
          if (!st.reason.trim()) return err('Please type the reason for the change.');
          const changed = JSON.stringify(st.items) !== JSON.stringify(o.items) || st.payment !== o.payment;
          if (!changed) return err('Nothing was changed.');
          const total = round2(sum(st.items, l => l.total));
          const edit = { at: Date.now(), by: S.me.name, action: 'edit', reason: st.reason.trim(), before, after: { items: st.items, total, payment: st.payment } };
          // Put back / take out stock for the difference.
          const oldStock = o.stock || {}, newStock = stockUse(st.items), diff = {};
          new Set([...Object.keys(oldStock), ...Object.keys(newStock)]).forEach(k => { const d = round2((oldStock[k] || 0) - (newStock[k] || 0)); if (d) diff[k] = d; });
          applyStock(diff, +1);
          const cash = st.payment === 'Cash' && o.cash ? { given: o.cash.given, change: round2(Math.max(0, o.cash.given - total)) } : null;
          Store.update('orders', o.id, { items: st.items, total, payment: st.payment, payGroup: payGroup(st.payment), cash, stock: newStock, edits: [...(o.edits || []), edit] });
          m.close();
          toast(`Order ${o.no} updated`);
          return;
        } else if (a === 'void') {
          if (!st.reason.trim()) return err('Please type the reason for voiding first.');
          const reason = st.reason.trim();
          m.close();
          confirmBox(`Void order No. ${o.no}?`, `${peso(o.total)} will be removed from sales and the items go back to the inventory. This is kept in the order history.`, 'Yes, void it', () => {
            const edit = { at: Date.now(), by: S.me.name, action: 'void', reason, before, after: null };
            applyStock(o.stock, +1);
            Store.update('orders', o.id, { voided: true, stock: {}, edits: [...(o.edits || []), edit] });
            toast(`Order ${o.no} voided`);
          });
          return;
        } else return;
        m.set(draw());
      });
    },
  });
}

function itemDiff(a, b) {
  const m = new Map();
  (a || []).forEach(l => m.set(lineKey(l), { name: l.name, d: lineDesc(l), a: l.qty, b: 0 }));
  (b || []).forEach(l => { const k = lineKey(l); const e = m.get(k) || { name: l.name, d: lineDesc(l), a: 0, b: 0 }; e.b = l.qty; m.set(k, e); });
  const out = [];
  m.forEach(e => {
    const nm = e.name + (e.d ? ` (${e.d})` : '');
    if (e.a === e.b) return;
    if (e.b === 0) out.push(`Removed: ${e.a} × ${nm}`);
    else if (e.a === 0) out.push(`Added: ${e.b} × ${nm}`);
    else out.push(`${nm}: ${e.a} → ${e.b}`);
  });
  return out;
}

function openHistory(id) {
  const o = findOrder(id); if (!o) return;
  const edits = (o.edits || []).slice().reverse();
  const list = edits.map(ed => {
    const when = new Date(ed.at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const ch = [];
    if (ed.action === 'void') ch.push(`Order voided (was ${peso(ed.before.total)})`);
    else {
      if (ed.before.total !== ed.after.total) ch.push(`Total: ${peso(ed.before.total)} → ${peso(ed.after.total)}`);
      if (ed.before.payment !== ed.after.payment) ch.push(`Payment: ${ed.before.payment} → ${ed.after.payment}`);
      ch.push(...itemDiff(ed.before.items, ed.after.items));
    }
    return `<div class="hist"><div class="hist-head"><b>${ed.action === 'void' ? 'Voided' : 'Edited'}${ed.by ? ' by ' + esc(ed.by) : ''}</b><span class="muted">${when}</span></div>
      <div class="hist-reason">Reason: “${esc(ed.reason)}”</div><ul>${ch.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`;
  }).join('');
  const orig = o.edits && o.edits[0] ? o.edits[0].before : null;
  const origHtml = orig ? `<div class="hist orig"><b>Original order</b> — ${fmtTime(o.createdAt)}, ${esc(orig.payment)}, ${peso(orig.total)}
    <ul>${(orig.items || []).map(l => `<li>${l.qty} × ${esc(l.name)}${lineDesc(l) ? ' (' + esc(lineDesc(l)) + ')' : ''} — ${peso(l.total)}</li>`).join('')}</ul></div>` : '';
  openModal({ title: `History – Order No. ${o.no}`, html: list + origHtml + '<div class="modal-actions"><button class="btn big primary" data-m="close">Close</button></div>' });
}

/* =========================================================
   INVENTORY
   ========================================================= */
function renderInventory() {
  const tab = S.invTab, alerts = invAlerts();
  const tabs = `<div class="seg seg-inline">${INV_CATS.map(([k, l]) => `<button class="seg-btn ${tab === k ? 'on' : ''}" data-act="invTab" data-v="${k}">${l} <small>${invItems(k).length}</small></button>`).join('')}</div>`;
  const row = i => {
    const exp = i.category !== 'Supplies' && i.hasExpiry && i.expiry
      ? ` · ${i.expiry < S.today ? '<b class="neg">Expired</b> ' : 'Expires '}${fmtShort(i.expiry)}` : '';
    const sub = i.category === 'Supplies'
      ? `${(SUPPLY_ROLES.find(r => r[0] === i.role) || [, 'Other'])[1]}${i.role === 'plate' || i.role === 'utensil' ? ' · counted automatically from orders' : i.role === 'tissue' ? ' · asked at end of day' : ''}`
      : `${esc(i.category === 'Snacks' ? i.kind : 'Others')} · ${peso(i.price)}${exp}`;
    return `<div class="inv-row">
      <div class="mr-info"><b>${esc(i.name)}</b><small>${sub}</small></div>
      <div class="inv-qty ${isLow(i) ? 'low' : ''}"><b>${fmtCount(i)}</b><small>${isLow(i) ? 'Restock now' : 'Restock at ' + num(i.threshold)}</small></div>
      <button class="btn sm primary" data-act="invStock" data-id="${i.id}">${i.category === 'Supplies' ? 'Update count' : 'Add stock'}</button>
      <button class="btn sm" data-act="invEdit" data-id="${i.id}">Edit</button></div>`;
  };
  let list = invItems(tab), body;
  if (tab === 'Snacks') {
    body = SNACK_KINDS.map(k => { const l = list.filter(i => i.kind === k); return l.length ? `<div class="subgrp">${k}</div>${l.map(row).join('')}` : ''; }).join('');
  } else body = list.map(row).join('');
  if (!list.length) {
    body = tab === 'Supplies'
      ? '<p class="muted">No supplies yet.</p><button class="btn primary big" data-act="invSeed">Add the usual supplies (tissues, plates, spoon & fork, plastics)</button>'
      : `<p class="muted">No ${tab.toLowerCase()} yet. Tap “Add item”.</p>`;
  }
  return `<div class="page">
    <div class="page-head"><div><h1>Inventory</h1><p class="muted">Snacks and Others are sold from here. Stock goes down with every order.</p></div>
      <div class="daynav"><button class="btn big" data-act="eod">End of day report</button><button class="btn primary big" data-act="invAdd">Add item</button></div></div>
    ${alerts.length ? `<section class="card alert-card">${cardTitle('Alerts')}${alertList(alerts)}</section>` : ''}
    <div class="toolbar">${tabs}</div>
    <section class="card">${body}</section>
    ${tab === 'Supplies' ? `<p class="muted small">Paper plates and spoon & fork go down by 1 for each ${esc(S.settings.supplyRules.meals.join(' / '))} meal served ${esc(S.settings.supplyRules.modes.map(serviceLabel).join(' / ').toLowerCase())} (change this in Settings). Other supplies are updated in the end of day report.</p>` : ''}
  </div>`;
}

function seedSupplies() {
  DEFAULT_SUPPLIES.forEach(s => Store.add('inventory', { ...s, category: 'Supplies', kind: 'Supplies', qty: 0, approx: true, hasExpiry: false, active: true, createdAt: Date.now() }));
  toast('Usual supplies added. Tap “Update count” to enter how many you have.');
}

function openInvForm(item, presetCat) {
  const isNew = !item;
  const cat0 = presetCat && presetCat !== 'Supplies' ? presetCat : (presetCat || 'Snacks');
  const st = item ? { ...item } : {
    category: cat0, name: '', kind: 'Chips', price: '', qty: '', approx: cat0 === 'Supplies', hasExpiry: false, expiry: '',
    threshold: cat0 === 'Supplies' ? 20 : 2, unit: 'pcs', role: 'other',
    riceMeal: false, allowNoRice: true, allowHalfRice: true, allowContainer: false,
  };
  const draw = () => {
    const c = st.category, sellable = c !== 'Supplies';
    return `
    ${isNew ? `<div class="opt-label">What are you adding?</div>
      <div class="seg">${[['Snacks', 'Snack (for sale)'], ['Others', 'Other meal (for sale)'], ['Supplies', 'Supplies (not for sale)']].map(([k, l]) => `<button class="seg-btn ${c === k ? 'on' : ''}" data-m="cat" data-v="${k}">${l}</button>`).join('')}</div>` : ''}
    <label class="field">Name<input class="input big" id="iName" value="${esc(st.name)}" autocomplete="off" placeholder="${c === 'Snacks' ? 'e.g. Milo' : c === 'Others' ? 'e.g. Chicken Katsu' : 'e.g. Tissues'}"></label>
    ${c === 'Snacks' ? `<div class="opt-label">Kind</div><div class="seg">${SNACK_KINDS.map(k => `<button class="seg-btn ${st.kind === k ? 'on' : ''}" data-m="kind" data-v="${k}">${k}</button>`).join('')}</div>` : ''}
    ${c === 'Supplies' ? `<div class="opt-label">Type</div><div class="seg">${SUPPLY_ROLES.map(([k, l]) => `<button class="seg-btn ${st.role === k ? 'on' : ''}" data-m="role" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="opt-label">Counted in</div><div class="seg">${UNITS.map(u => `<button class="seg-btn ${st.unit === u ? 'on' : ''}" data-m="unit" data-v="${u}">${u}</button>`).join('')}</div>` : ''}
    ${sellable ? `<label class="field">Selling price (₱)<input class="input big" id="iPrice" type="number" inputmode="decimal" min="0" value="${esc(st.price)}"></label>` : ''}
    ${c === 'Others' ? riceOptionsHtml(st) : ''}
    <div class="row2">
      <label class="field">${isNew ? 'Quantity' : 'Quantity now'}<input class="input big" id="iQty" type="number" inputmode="decimal" min="0" value="${esc(st.qty)}"></label>
      <div><div class="opt-label">Count</div><div class="seg"><button class="seg-btn ${!st.approx ? 'on' : ''}" data-m="approx" data-v="0">Exact</button><button class="seg-btn ${st.approx ? 'on' : ''}" data-m="approx" data-v="1">Approximate</button></div></div>
    </div>
    ${sellable ? `<div class="opt-label">Expiry date</div>
      <div class="seg"><button class="seg-btn ${st.hasExpiry ? 'on' : ''}" data-m="exp" data-v="1">With expiry</button><button class="seg-btn ${!st.hasExpiry ? 'on' : ''}" data-m="exp" data-v="0">No expiry</button></div>
      ${st.hasExpiry ? `<label class="field">Expires on<input class="input big" type="date" id="iExp" value="${esc(st.expiry)}"></label>` : ''}` : ''}
    <label class="field">Remind me to restock when only this many are left<input class="input big" id="iTh" type="number" inputmode="decimal" min="0" value="${esc(st.threshold)}"></label>
    <p class="err" id="iErr"></p>
    <div class="modal-actions">${isNew ? '' : '<button class="btn big danger-o" data-m="del">Delete item</button><span class="grow"></span>'}
      <button class="btn big" data-m="close">Cancel</button><button class="btn primary big" data-m="save">Save</button></div>`;
  };
  openModal({
    title: isNew ? 'Add to inventory' : `Edit ${item.name}`, html: draw(), wide: true,
    onMount(m) {
      const ids = { iName: 'name', iPrice: 'price', iQty: 'qty', iExp: 'expiry', iTh: 'threshold' };
      m.el.addEventListener('input', e => { if (ids[e.target.id]) st[ids[e.target.id]] = e.target.value; });
      m.el.addEventListener('change', e => { if (e.target.dataset.f) st[e.target.dataset.f] = e.target.checked; });
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const a = b.dataset.m, v = b.dataset.v;
        const err = t => { $('#iErr', m.el).textContent = t; };
        if (a === 'cat') {
          st.category = v; st.approx = v === 'Supplies'; st.threshold = v === 'Supplies' ? 20 : 2;
          st.hasExpiry = v === 'Snacks' && st.kind === 'Snacks';
        } else if (a === 'kind') { st.kind = v; if (v === 'Snacks') st.hasExpiry = true; }
        else if (a === 'role') st.role = v;
        else if (a === 'unit') st.unit = v;
        else if (a === 'approx') st.approx = v === '1';
        else if (a === 'exp') st.hasExpiry = v === '1';
        else if (a === 'rm') st.riceMeal = v === '1';
        else if (a === 'del') {
          confirmBox(`Delete ${item.name}?`, 'It will be removed from the inventory and from Take Order. Past sales are not affected.', 'Delete', () => { Store.remove('inventory', item.id); m.close(); });
          return;
        } else if (a === 'save') {
          const name = String(st.name || '').trim(), sellable = st.category !== 'Supplies';
          if (!name) return err('Please type the name.');
          if (sellable && num(st.price) <= 0) return err('Please type the selling price.');
          if (String(st.qty).trim() === '' || num(st.qty) < 0) return err('Please type the quantity (0 if none yet).');
          if (sellable && st.hasExpiry && !st.expiry) return err('Please choose the expiry date, or tap “No expiry”.');
          const data = {
            name, category: st.category, qty: num(st.qty), approx: !!st.approx, threshold: num(st.threshold), active: true, updatedAt: Date.now(),
            kind: st.category === 'Snacks' ? st.kind : st.category,
          };
          if (sellable) Object.assign(data, { price: num(st.price), hasExpiry: !!st.hasExpiry, expiry: st.hasExpiry ? st.expiry : '' });
          else Object.assign(data, { role: st.role, unit: st.unit, hasExpiry: false });
          if (st.category === 'Others') Object.assign(data, {
            riceMeal: !!st.riceMeal, allowNoRice: !!st.riceMeal && !!st.allowNoRice, allowHalfRice: !!st.riceMeal && !!st.allowHalfRice, allowContainer: !!st.allowContainer,
          });
          if (isNew) { data.createdAt = Date.now(); Store.add('inventory', data); }
          else Store.set('inventory', item.id, { ...item, ...data });
          S.invTab = st.category;
          m.close();
          toast(`${name} saved`);
          refresh(['inventory']);
          return;
        } else return;
        m.set(draw());
      });
      setTimeout(() => { if (isNew) { const n = $('#iName', m.el); if (n) n.focus(); } }, 60);
    },
  });
}

function openAddStock(item) {
  if (!item) return;
  const supplies = item.category === 'Supplies';
  const st = { add: '', count: invLeft(item), expiry: item.expiry || '', price: item.price || '' };
  openModal({
    title: supplies ? `Update count – ${item.name}` : `Add stock – ${item.name}`,
    html: supplies
      ? `<p class="muted">Now: ${fmtCount(item)}</p>
        <label class="field">About how many are left now?<input class="input big" id="sCount" type="number" inputmode="decimal" min="0" value="${esc(st.count)}"></label>
        <label class="field">Or add new stock (+)<input class="input big" id="sAdd" type="number" inputmode="decimal" min="0" placeholder="e.g. 100"></label>
        <p class="err" id="sErr"></p>
        <div class="modal-actions"><button class="btn big" data-m="close">Cancel</button><button class="btn primary big" data-m="save">Save</button></div>`
      : `<p class="muted">Now: ${fmtCount(item)} left</p>
        <label class="field">How many are you adding?<input class="input big" id="sAdd" type="number" inputmode="decimal" min="0" placeholder="e.g. 24"></label>
        ${item.hasExpiry ? `<label class="field">Expiry date of the new stock<input class="input big" type="date" id="sExp" value="${esc(st.expiry)}"></label>` : ''}
        <label class="field">Selling price (₱)<input class="input big" id="sPrice" type="number" inputmode="decimal" min="0" value="${esc(st.price)}"></label>
        <p class="err" id="sErr"></p>
        <div class="modal-actions"><button class="btn big" data-m="close">Cancel</button><button class="btn primary big" data-m="save">Add stock</button></div>`,
    onMount(m) {
      m.el.addEventListener('click', e => {
        if (!e.target.closest('[data-m="save"]')) return;
        const err = t => { $('#sErr', m.el).textContent = t; };
        const addV = $('#sAdd', m.el).value;
        if (supplies) {
          const countV = $('#sCount', m.el).value;
          if (addV && num(addV) > 0) Store.inc('inventory', item.id, 'qty', num(addV));
          else if (countV !== '' && num(countV) >= 0) Store.update('inventory', item.id, { qty: num(countV), countedAt: Date.now() });
          else return err('Please type a number.');
        } else {
          if (!addV || num(addV) <= 0) return err('Please type how many you are adding.');
          const patch = { updatedAt: Date.now() };
          const exp = $('#sExp', m.el); if (exp && exp.value) patch.expiry = exp.value;
          const pr = $('#sPrice', m.el); if (pr && num(pr.value) > 0) patch.price = num(pr.value);
          Store.update('inventory', item.id, patch);
          Store.inc('inventory', item.id, 'qty', num(addV));
        }
        m.close();
        toast(`${item.name} updated`);
      });
      setTimeout(() => { const f = $('#sAdd', m.el); if (f && !supplies) f.focus(); }, 60);
    },
  });
}

function openEodReport() {
  const supplies = invItems('Supplies');
  const st = { used: {}, left: {} };
  supplies.forEach(s => { st.left[s.id] = invLeft(s); });
  const drawCheck = () => `
    <p class="muted">Before the report, check the supplies. The numbers below are already computed — change them if they are not right.</p>
    ${supplies.map(s => s.role === 'tissue'
      ? `<div class="eod-row"><div class="mr-info"><b>${esc(s.name)}</b><small>Now: ${fmtCount(s)}</small></div>
          <label class="field">How many were used today?<input class="input big" data-used="${s.id}" type="number" inputmode="decimal" min="0" value="${esc(st.used[s.id] || '')}"></label></div>`
      : `<div class="eod-row"><div class="mr-info"><b>${esc(s.name)}</b><small>${s.role === 'plate' || s.role === 'utensil' ? 'Computed from today\'s orders' : 'Last count'}</small></div>
          <label class="field">About how many are left?<input class="input big" data-left="${s.id}" type="number" inputmode="decimal" min="0" value="${esc(st.left[s.id])}"></label></div>`).join('')}
    <p class="err" id="eodErr"></p>
    <div class="modal-actions"><button class="btn big" data-m="close">Cancel</button><button class="btn primary big grow" data-m="make">Make the report</button></div>`;
  const drawReport = text => `
    <p class="muted">Copy this and paste it in your group chat.</p>
    <textarea class="report" id="repText" readonly>${esc(text)}</textarea>
    <div class="modal-actions"><button class="btn big" data-m="close">Close</button><button class="btn primary big grow" data-m="copy">Copy report</button></div>`;
  openModal({
    title: 'End of day report', html: supplies.length ? drawCheck() : drawReport(buildReport({})), wide: true,
    onMount(m) {
      m.el.addEventListener('input', e => {
        if (e.target.dataset.used) st.used[e.target.dataset.used] = e.target.value;
        if (e.target.dataset.left) st.left[e.target.dataset.left] = e.target.value;
      });
      m.el.addEventListener('click', async e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        if (b.dataset.m === 'make') {
          const newQty = {};
          supplies.forEach(s => {
            if (s.role === 'tissue') newQty[s.id] = Math.max(0, round2(num(s.qty) - num(st.used[s.id])));
            else newQty[s.id] = Math.max(0, num(st.left[s.id]));
            Store.update('inventory', s.id, { qty: newQty[s.id], countedAt: Date.now() });
          });
          const text = buildReport(newQty, st.used);
          Store.set('reports', S.today, { date: S.today, text, by: S.me.name, createdAt: Date.now() });
          m.set(drawReport(text));
        }
        if (b.dataset.m === 'copy') {
          const ok = await copyText($('#repText', m.el).value);
          toast(ok ? 'Report copied. You can paste it now.' : 'Could not copy. Press and hold the text to copy it.');
        }
      });
    },
  });
}

function buildReport(newQty, used) {
  used = used || {};
  const qtyOf = i => newQty[i.id] !== undefined ? newQty[i.id] : invLeft(i);
  const cnt = i => `${i.approx ? 'about ' : ''}${qtyOf(i)}${i.category === 'Supplies' && i.unit ? ' ' + i.unit : ''}`;
  const L = [];
  L.push(`${S.settings.shopName} — End of day report`);
  L.push(fmtDate(S.today));
  L.push(`Prepared by: ${S.me.name}`);
  L.push('');
  const sell = [...invItems('Snacks'), ...invItems('Others')];
  const low = sell.filter(i => qtyOf(i) <= num(i.threshold));
  L.push('LOW STOCK – please restock');
  L.push(...(low.length ? low.map(i => `- ${i.name} (${i.category === 'Snacks' ? i.kind : 'Others'}): ${qtyOf(i) <= 0 ? 'none left' : cnt(i) + ' left'}`) : ['- None']));
  L.push('');
  const warn = num(S.settings.expiryWarnDays) || 7, lim = addDays(S.today, warn);
  const exp = sell.filter(i => i.hasExpiry && i.expiry && i.expiry <= lim).sort((a, b) => a.expiry.localeCompare(b.expiry));
  L.push(`EXPIRED / EXPIRING (next ${warn} days)`);
  L.push(...(exp.length ? exp.map(i => {
    const d = daysBetween(S.today, i.expiry);
    return `- ${i.name}: ${d < 0 ? 'EXPIRED on ' + fmtShort(i.expiry) : 'expires ' + fmtShort(i.expiry) + (d === 0 ? ' (today)' : ` (in ${d} day${d === 1 ? '' : 's'})`)} – ${cnt(i)} left`;
  }) : ['- None']));
  L.push('');
  const others = invItems('Others');
  L.push('OTHERS');
  L.push(...(others.length ? others.map(i => `- ${i.name}: ${cnt(i)} left${i.hasExpiry && i.expiry ? ', expires ' + fmtShort(i.expiry) : ''}`) : ['- None']));
  const supplies = invItems('Supplies');
  if (supplies.length) {
    L.push('');
    L.push('SUPPLIES (approximate)');
    const plateUse = sum(S.todayOrders.filter(o => !o.voided), o => { const p = supplies.find(s => s.role === 'plate'); return p && o.stock ? num(o.stock[p.id]) : 0; });
    supplies.forEach(s => {
      const extra = s.role === 'tissue' && num(used[s.id]) ? `${num(used[s.id])} used today, ` : s.role === 'plate' && plateUse ? `${plateUse} used today, ` : '';
      L.push(`- ${s.name}: ${extra}${cnt(s)} left${qtyOf(s) <= num(s.threshold) ? ' – RESTOCK' : ''}`);
    });
  }
  return L.join('\n');
}

/* =========================================================
   EMPLOYEES: attendance, rating, pay
   ========================================================= */
const inc = () => S.settings.incentives;
const worked = e => e.status === 'present' || e.status === 'late';
function wageFor(e) {
  if (e.status === 'present') return num(e.wage);
  if (e.status === 'late') return Math.max(0, num(e.wage) - num(inc().lateDeduct));
  return 0;
}
function ratingPay(avg) { return avg ? num(inc().byRating[Math.min(5, Math.max(1, Math.round(avg)))]) : 0; }
const personKey = e => e.oneDay ? 'n:' + String(e.name).trim().toLowerCase() : e.id;

// Staff pay for [from, to]. attDocs must include attendance from attFrom(from) for weekly/monthly incentives.
function computePay(attDocs, orders, from, to) {
  const I = inc();
  const sales = {};
  orders.forEach(o => { if (!o.voided && o.date >= from && o.date <= to) sales[o.date] = (sales[o.date] || 0) + num(o.total); });
  const docs = attDocs.filter(a => Array.isArray(a.entries));
  const people = new Map(), byDay = {};
  const P = e => {
    const k = personKey(e);
    if (!people.has(k)) people.set(k, { key: k, name: e.name, category: e.category, oneDay: !!e.oneDay, present: 0, late: 0, absent: 0, ratings: [], wages: 0, ratingInc: 0, bonus: 0 });
    return people.get(k);
  };
  const D = d => byDay[d] || (byDay[d] = { wages: 0, ratingInc: 0, bonus: 0 });
  const bonusOn = num(I.salesGoal) > 0 && num(I.salesBonus) > 0;
  docs.forEach(a => {
    if (a.date < from || a.date > to) return;
    const hitGoal = bonusOn && (sales[a.date] || 0) >= num(I.salesGoal);
    a.entries.forEach(e => {
      if (!e.status) return;
      const p = P(e), day = D(a.date);
      p[e.status]++;
      if (!worked(e)) return;
      const w = wageFor(e);
      p.wages += w; day.wages += w;
      if (e.rating) p.ratings.push(num(e.rating));
      if (I.period === 'daily' && e.rating) { const r = ratingPay(e.rating); p.ratingInc += r; day.ratingInc += r; }
      if (hitGoal) { p.bonus += num(I.salesBonus); day.bonus += num(I.salesBonus); }
    });
  });
  if (I.period === 'weekly' || I.period === 'monthly') {
    // Paid on the last day of each week (Sunday) or month, based on the average smiley in that period.
    const ends = daysIn(from, to).filter(k => I.period === 'weekly' ? parseKey(k).getDay() === 0 : k === monthEnd(k));
    ends.forEach(end => {
      const start = I.period === 'weekly' ? addDays(end, -6) : monthStart(end);
      const m = new Map();
      docs.forEach(a => {
        if (a.date < start || a.date > end) return;
        a.entries.forEach(e => {
          if (!worked(e) || !e.rating) return;
          const k = personKey(e);
          if (!m.has(k)) m.set(k, { e, rs: [] });
          m.get(k).rs.push(num(e.rating));
        });
      });
      m.forEach(({ e, rs }) => {
        const amt = ratingPay(sum(rs, v => v) / rs.length);
        if (!amt) return;
        P(e).ratingInc += amt;
        D(end).ratingInc += amt;
      });
    });
  }
  const list = [...people.values()];
  list.forEach(p => { p.avg = p.ratings.length ? sum(p.ratings, v => v) / p.ratings.length : 0; p.total = round2(p.wages + p.ratingInc + p.bonus); });
  list.sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));
  const days = Object.values(byDay);
  const wages = round2(sum(days, d => d.wages)), ratingInc = round2(sum(days, d => d.ratingInc)), bonus = round2(sum(days, d => d.bonus));
  return { people: list, byDay, wages, ratingInc, bonus, total: round2(wages + ratingInc + bonus), sales };
}
const dayStaffTotal = d => d ? round2(d.wages + d.ratingInc + d.bonus) : 0;

function describeIncentives() {
  const I = inc(), out = [];
  if (I.period === 'off') out.push('Rating incentive: off.');
  else out.push(`Rating incentive (${I.period}, by average smiley): ` + [5, 4, 3, 2, 1].map(v => `${v} = ${peso(I.byRating[v])}`).join(', ') + '.');
  if (num(I.salesGoal) > 0 && num(I.salesBonus) > 0) out.push(`Sales bonus: when daily sales reach ${peso(I.salesGoal)}, each person who worked gets ${peso(I.salesBonus)}.`);
  if (num(I.lateDeduct) > 0) out.push(`Late: ${peso(I.lateDeduct)} less from the daily wage.`);
  return out.join(' ');
}

function enterEmployees() { S.empDate = S.empDate || S.today; empSubscribe(); }

function empRange() {
  const a = S.empDate;
  if (S.empPeriod === 'week') { const f = weekStart(a), t = addDays(f, 6); return { from: f, to: t, label: `Week of ${fmtShort(f)} – ${fmtShort(t)}` }; }
  const f = monthStart(a);
  return { from: f, to: monthEnd(a), label: fmtMonth(f) };
}

function empSubscribe() {
  S.viewSubs.forEach(u => u()); S.viewSubs = [];
  S.empData = { att: [], orders: [] };
  const r = S.empTab === 'sheet' ? { from: S.empDate, to: S.empDate } : empRange();
  S.viewSubs.push(Store.listen('attendance', { from: attFrom(r.from), to: r.to }, l => { S.empData.att = l; refresh(['attendance']); }));
  if (!(S.empTab === 'sheet' && S.empDate === S.today)) {
    S.viewSubs.push(Store.listen('orders', { from: r.from, to: r.to }, l => { S.empData.orders = l; refresh(['attendance']); }));
  }
}
const empOrders = () => (S.empTab === 'sheet' && S.empDate === S.today) ? S.todayOrders : S.empData.orders;
const attDoc = date => S.empData.att.find(a => a.date === date);

// Everyone on the sheet for a day: saved entries + regular staff not yet marked (unless removed for that day).
function dayRows(date) {
  const doc = attDoc(date);
  const entries = (doc && doc.entries) || [];
  const removed = new Set((doc && doc.removed) || []);
  const ids = new Set(entries.map(e => e.id));
  const regular = S.employees
    .filter(e => e.active !== false && !ids.has(e.id) && !removed.has(e.id) && (!e.createdAt || dkey(new Date(e.createdAt)) <= date))
    .map(e => ({ id: e.id, name: e.name, category: e.category, wage: num(e.wage), status: null, rating: null, oneDay: false }));
  return [...entries, ...regular];
}
const findRow = id => dayRows(S.empDate).find(r => r.id === id);

function saveAtt(date, mutate) {
  const doc = attDoc(date) || {};
  const next = { date, entries: (doc.entries || []).map(e => ({ ...e })), removed: [...(doc.removed || [])] };
  mutate(next);
  const i = S.empData.att.findIndex(a => a.date === date);
  if (i >= 0) S.empData.att[i] = { id: date, ...next }; else S.empData.att.push({ id: date, ...next });
  Store.set('attendance', date, next);
  refresh(['attendance']);
}

function upsertEntry(next, row, patch) {
  let e = next.entries.find(x => x.id === row.id);
  if (!e) { e = { id: row.id, name: row.name, category: row.category, wage: num(row.wage), status: null, rating: null, oneDay: !!row.oneDay }; next.entries.push(e); }
  Object.assign(e, patch);
}

function setEmpStatus(id, v) {
  const row = findRow(id); if (!row) return;
  const status = row.status === v ? null : v; // tap again to clear
  saveAtt(S.empDate, n => upsertEntry(n, row, { status, rating: status && status !== 'absent' ? row.rating : null }));
}

function setEmpRating(id, v) {
  const row = findRow(id); if (!row) return;
  if (row.status === 'absent') { toast(`${row.name} is marked Absent.`); return; }
  saveAtt(S.empDate, n => upsertEntry(n, row, { rating: row.rating === v ? null : v, status: row.status || 'present' }));
}

function removeEmpFromDay(id) {
  const row = findRow(id); if (!row) return;
  const msg = row.oneDay ? `${row.name} will be removed from this day.` : `${row.name} will be taken off this day only. They stay in Regular staff.`;
  confirmBox(`Remove ${row.name}?`, msg, 'Remove', () => saveAtt(S.empDate, n => {
    n.entries = n.entries.filter(e => e.id !== id);
    if (!row.oneDay && !n.removed.includes(id)) n.removed.push(id);
  }));
}

function renderEmployees() {
  const tabs = `<div class="seg seg-inline">${[['sheet', 'Attendance'], ['pay', 'Payroll']].map(([k, l]) =>
    `<button class="seg-btn ${S.empTab === k ? 'on' : ''}" data-act="empTab" data-v="${k}">${l}</button>`).join('')}</div>`;
  return `<div class="page">${S.empTab === 'sheet' ? renderEmpSheet(tabs) : renderPayroll(tabs)}</div>`;
}

function renderEmpSheet(tabs) {
  const d = S.empDate, rows = dayRows(d);
  const pay = computePay(S.empData.att, empOrders(), d, d);
  const pm = new Map(pay.people.map(p => [p.key, p]));
  const count = s => rows.filter(r => r.status === s).length;
  const I = inc();
  const salesDay = round2(sum(empOrders().filter(o => !o.voided && o.date === d), o => o.total));
  let bonusLine = '';
  if (num(I.salesGoal) > 0 && num(I.salesBonus) > 0) {
    bonusLine = salesDay >= num(I.salesGoal)
      ? `<p class="notice good">Sales goal reached (${peso(salesDay)} of ${peso(I.salesGoal)}). Everyone who worked gets ${peso(I.salesBonus)} bonus.</p>`
      : `<p class="notice">Sales ${peso(salesDay)} of ${peso(I.salesGoal)} — ${peso(round2(num(I.salesGoal) - salesDay))} more for a ${peso(I.salesBonus)} bonus each.</p>`;
  }
  const row = r => {
    const p = pm.get(personKey(r));
    return `<div class="emp-row">
      <div class="emp-name"><b>${esc(r.name)}</b><small>${esc(r.category)} · ${peso(r.wage)} a day${r.oneDay ? ' · <span class="tag">This day only</span>' : ''}</small></div>
      <div class="seg emp-status">${STATUSES.map(([v, l]) => `<button class="seg-btn ${r.status === v ? 'on' : ''}" data-act="empStatus" data-id="${esc(r.id)}" data-v="${v}">${l}</button>`).join('')}</div>
      <div class="faces ${r.status === 'absent' ? 'off' : ''}">${SMILEYS.map(s => `<button class="face ${r.rating === s.v ? 'on' : ''}" data-act="empRate" data-id="${esc(r.id)}" data-v="${s.v}" title="${s.t}" aria-label="${s.t}">${s.e}</button>`).join('')}</div>
      <div class="emp-pay"><b>${peso(p ? p.total : 0)}</b><small>pay</small></div>
      <button class="link-btn" data-act="empRemoveDay" data-id="${esc(r.id)}">Remove</button>
    </div>`;
  };
  const groups = [...EMP_CATS, 'Others'].map(c => {
    const l = rows.filter(r => c === 'Others' ? !EMP_CATS.includes(r.category) : r.category === c);
    return l.length ? `<section class="card"><h2 class="card-title">${c} <span class="count">${l.length}</span></h2>${l.map(row).join('')}</section>` : '';
  }).join('');
  return `
    <div class="page-head"><div><h1>Employees</h1><p class="muted">${d === S.today ? '<b>Today</b> – ' : ''}${fmtDate(d)}</p></div>${tabs}</div>
    <div class="page-head sub-head">${dayNav('empDay', d)}
      <div class="daynav"><button class="btn big" data-act="empManage">Regular staff</button><button class="btn primary big" data-act="empAdd">Add person</button></div></div>
    <div class="tiles">
      <div class="tile"><span>Present</span><b>${count('present')}</b></div>
      <div class="tile"><span>Late</span><b>${count('late')}</b></div>
      <div class="tile"><span>Absent</span><b>${count('absent')}</b></div>
      <div class="tile"><span>Not marked yet</span><b>${rows.filter(r => !r.status).length}</b></div>
      <div class="tile big-tile"><span>Staff pay this day</span><b>${peso(pay.total)}</b><small>Wages ${peso(pay.wages)} · Incentives ${peso(round2(pay.ratingInc + pay.bonus))}</small></div>
    </div>
    ${bonusLine}
    ${rows.length ? groups : '<div class="empty"><h3>No staff yet.</h3><p>Tap “Add person” to add the first name.</p></div>'}
    <p class="muted small">Tap Present, Late or Absent, then tap a face to rate. Tap again to undo. ${esc(describeIncentives())}</p>
    <div class="toolbar"><button class="btn" data-act="empCsvDay">Download this day (CSV)</button></div>`;
}

function renderPayroll(tabs) {
  const r = empRange();
  const pay = computePay(S.empData.att, S.empData.orders, r.from, r.to);
  const unfinished = r.to >= S.today;
  const rows = pay.people.map(p => `<tr><td><b>${esc(p.name)}</b>${p.oneDay ? ' <small class="muted">(day helper)</small>' : ''}</td><td class="muted">${esc(p.category)}</td>
    <td class="r">${p.present}</td><td class="r">${p.late}</td><td class="r">${p.absent}</td>
    <td class="r">${p.avg ? `${face(p.avg).e} ${p.avg.toFixed(1)}` : '—'}</td>
    <td class="r">${peso(p.wages)}</td><td class="r">${peso(p.ratingInc)}</td><td class="r">${peso(p.bonus)}</td><td class="r"><b>${peso(p.total)}</b></td></tr>`).join('');
  return `
    <div class="page-head"><div><h1>Employees</h1><p class="muted"><b>${esc(r.label)}</b></p></div>${tabs}</div>
    <div class="page-head sub-head">
      <div class="daynav"><div class="seg seg-inline">${[['week', 'Weekly'], ['month', 'Monthly']].map(([k, l]) => `<button class="seg-btn ${S.empPeriod === k ? 'on' : ''}" data-act="empPeriod" data-v="${k}">${l}</button>`).join('')}</div>
        <button class="btn big" data-act="empNav" data-d="-1" aria-label="Previous">‹</button><button class="btn big" data-act="empNav" data-d="0">This ${S.empPeriod}</button>
        <button class="btn big" data-act="empNav" data-d="1" aria-label="Next" ${unfinished ? 'disabled' : ''}>›</button></div>
      <div class="daynav"><button class="btn" data-act="empCsvAtt">Download attendance (CSV)</button><button class="btn" data-act="empCsvPay">Download payroll (CSV)</button></div></div>
    <div class="tiles">
      <div class="tile big-tile"><span>Total staff pay</span><b>${peso(pay.total)}</b>${unfinished ? '<small>So far — period not finished</small>' : ''}</div>
      <div class="tile"><span>Wages</span><b>${peso(pay.wages)}</b></div>
      <div class="tile"><span>Rating incentives</span><b>${peso(pay.ratingInc)}</b></div>
      <div class="tile"><span>Sales bonus</span><b>${peso(pay.bonus)}</b></div>
    </div>
    <section class="card">
      ${pay.people.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Category</th><th class="r">Present</th><th class="r">Late</th><th class="r">Absent</th><th class="r">Avg rating</th>
        <th class="r">Wages</th><th class="r">Rating incentive</th><th class="r">Sales bonus</th><th class="r">Total pay</th></tr></thead>
        <tbody>${rows}</tbody><tfoot><tr><td colspan="6"><b>Total</b></td><td class="r">${peso(pay.wages)}</td><td class="r">${peso(pay.ratingInc)}</td><td class="r">${peso(pay.bonus)}</td><td class="r"><b>${peso(pay.total)}</b></td></tr></tfoot></table></div>`
        : '<p class="muted">No attendance marked in this period.</p>'}
    </section>
    <p class="muted small">${esc(describeIncentives())} Weekly and monthly rating incentives are counted on the last day of the week (Sunday) or month. Staff pay is included in Expenses and the Dashboard.</p>`;
}

function openAddPerson() {
  const date = S.empDate, isToday = date === S.today;
  const doc = attDoc(date);
  const removedHere = S.employees.filter(e => e.active !== false && doc && (doc.removed || []).includes(e.id));
  const st = { name: '', category: 'Preparation', wage: '' };
  const draw = () => `
    <label class="field">Name<input class="input big" id="pn" value="${esc(st.name)}" autocomplete="off" placeholder="e.g. Maria"></label>
    <div class="opt-label">Category</div>
    <div class="seg">${EMP_CATS.map(c => `<button class="seg-btn ${st.category === c ? 'on' : ''}" data-m="cat" data-v="${c}">${c}</button>`).join('')}</div>
    <label class="field">Daily wage (₱)<input class="input big" id="pw" type="number" inputmode="decimal" min="0" value="${esc(st.wage)}"></label>
    <p class="err" id="pErr"></p>
    <p class="muted">Is this person working just ${isToday ? 'today' : 'on this day'}, or are they regular staff?</p>
    <div class="modal-actions"><button class="btn big" data-m="close">Cancel</button>
      <button class="btn big" data-m="day">Just for ${isToday ? 'today' : 'this day'}</button>
      <button class="btn primary big" data-m="regular">Add to regular staff</button></div>
    ${removedHere.length ? `<hr><h3 class="sub">Put back on this day</h3>${removedHere.map(e => `<div class="mrow"><div class="mr-info"><b>${esc(e.name)}</b><small>${esc(e.category)}</small></div><button class="btn sm" data-m="back" data-id="${e.id}">Put back</button></div>`).join('')}` : ''}`;
  openModal({
    title: 'Add person', html: draw(),
    onMount(m) {
      m.el.addEventListener('input', e => { if (e.target.id === 'pn') st.name = e.target.value; if (e.target.id === 'pw') st.wage = e.target.value; });
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const a = b.dataset.m;
        const err = t => { $('#pErr', m.el).textContent = t; };
        if (a === 'cat') { st.category = b.dataset.v; m.set(draw()); return; }
        if (a === 'back') {
          const id = b.dataset.id;
          saveAtt(date, n => { n.removed = n.removed.filter(x => x !== id); });
          m.close(); toast('Put back on this day'); return;
        }
        if (a !== 'day' && a !== 'regular') return;
        const name = String(st.name || '').trim();
        if (!name) return err('Please type the name.');
        if (String(st.wage).trim() === '' || num(st.wage) < 0) return err('Please type the daily wage (0 if none).');
        const wage = num(st.wage);
        if (a === 'day') {
          saveAtt(date, n => n.entries.push({ id: 'tmp-' + uid(), name, category: st.category, wage, status: null, rating: null, oneDay: true }));
          toast(`${name} added for ${isToday ? 'today' : fmtShort(date)}`);
        } else {
          const same = S.employees.find(x => x.name.trim().toLowerCase() === name.toLowerCase());
          if (same && same.active !== false) return err(`${same.name} is already regular staff.`);
          if (same) Store.set('employees', same.id, { ...same, name, category: st.category, wage, active: true, updatedAt: Date.now() });
          else Store.add('employees', { name, category: st.category, wage, active: true, createdAt: Date.now() });
          if (same && doc && (doc.removed || []).includes(same.id)) saveAtt(date, n => { n.removed = n.removed.filter(x => x !== same.id); });
          toast(`${name} added to regular staff`);
        }
        m.close();
      });
      setTimeout(() => { const n = $('#pn', m.el); if (n) n.focus(); }, 60);
    },
  });
}

function openStaffManager() {
  const draw = () => {
    const list = S.employees.filter(e => e.active !== false);
    return `<p class="muted">Regular staff appear on the attendance sheet every day. Removing someone here is permanent (their past records stay).</p>
      ${list.length ? list.map(e => `<div class="mrow"><div class="mr-info"><b>${esc(e.name)}</b><small>${esc(e.category)} · ${peso(e.wage)} a day</small></div>
        <button class="btn sm" data-m="edit" data-id="${e.id}">Edit</button><button class="btn sm danger-o" data-m="del" data-id="${e.id}">Remove permanently</button></div>`).join('')
        : '<p class="muted">No regular staff yet.</p>'}
      <div class="modal-actions"><button class="btn big primary" data-m="close">Done</button></div>`;
  };
  openModal({
    title: 'Regular staff', html: draw(), wide: true,
    onMount(m) {
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const emp = S.employees.find(x => x.id === b.dataset.id);
        if (b.dataset.m === 'edit' && emp) openStaffEdit(emp, () => m.set(draw()));
        if (b.dataset.m === 'del' && emp) {
          confirmBox(`Remove ${emp.name} permanently?`, 'They will no longer appear on the attendance sheet. Past attendance and pay records are kept.', 'Remove permanently', () => {
            emp.active = false;
            Store.update('employees', emp.id, { active: false, removedAt: Date.now() });
            m.set(draw());
            toast(`${emp.name} removed from regular staff`);
          });
        }
      });
    },
  });
}

function openStaffEdit(emp, done) {
  const st = { name: emp.name, category: emp.category, wage: emp.wage };
  const draw = () => `
    <label class="field">Name<input class="input big" id="en" value="${esc(st.name)}" autocomplete="off"></label>
    <div class="opt-label">Category</div>
    <div class="seg">${EMP_CATS.map(c => `<button class="seg-btn ${st.category === c ? 'on' : ''}" data-m="cat" data-v="${c}">${c}</button>`).join('')}</div>
    <label class="field">Daily wage (₱)<input class="input big" id="ew" type="number" inputmode="decimal" min="0" value="${esc(st.wage)}"></label>
    <p class="muted small">A new wage applies to days not yet marked. Days already marked keep the old wage.</p>
    <p class="err" id="eeErr"></p>
    <div class="modal-actions"><button class="btn big" data-m="close">Cancel</button><button class="btn primary big" data-m="save">Save</button></div>`;
  openModal({
    title: `Edit ${emp.name}`, html: draw(),
    onMount(m) {
      m.el.addEventListener('input', e => { if (e.target.id === 'en') st.name = e.target.value; if (e.target.id === 'ew') st.wage = e.target.value; });
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        if (b.dataset.m === 'cat') { st.category = b.dataset.v; m.set(draw()); return; }
        if (b.dataset.m !== 'save') return;
        const name = String(st.name || '').trim();
        if (!name) { $('#eeErr', m.el).textContent = 'Please type the name.'; return; }
        Object.assign(emp, { name, category: st.category, wage: num(st.wage), updatedAt: Date.now() });
        Store.set('employees', emp.id, emp);
        m.close();
        done();
        toast(`${name} saved`);
      });
    },
  });
}

function exportAttendanceCSV(from, to) {
  const I = inc();
  const sales = {};
  empOrders().forEach(o => { if (!o.voided) sales[o.date] = (sales[o.date] || 0) + num(o.total); });
  const bonusOn = num(I.salesGoal) > 0 && num(I.salesBonus) > 0;
  const docs = S.empData.att.filter(a => a.date >= from && a.date <= to && Array.isArray(a.entries)).sort((a, b) => a.date.localeCompare(b.date));
  const rows = [['Date', 'Name', 'Category', 'Type', 'Status', 'Rating (1-5)', 'Rating', 'Daily wage', 'Wage paid', 'Daily rating incentive', 'Sales bonus']];
  docs.forEach(a => a.entries.filter(e => e.status).forEach(e => {
    const ok = worked(e);
    rows.push([
      a.date, e.name, e.category, e.oneDay ? 'Day helper' : 'Regular',
      e.status.charAt(0).toUpperCase() + e.status.slice(1), e.rating || '', e.rating ? SMILEYS[e.rating - 1].t : '',
      num(e.wage), wageFor(e), ok && I.period === 'daily' && e.rating ? ratingPay(e.rating) : 0,
      ok && bonusOn && (sales[a.date] || 0) >= num(I.salesGoal) ? num(I.salesBonus) : 0,
    ]);
  }));
  if (rows.length === 1) { toast('No attendance marked for this period.'); return; }
  downloadCSV(`attendance_${from === to ? from : from + '_to_' + to}.csv`, rows);
}

function exportPayrollCSV() {
  const r = empRange();
  const pay = computePay(S.empData.att, S.empData.orders, r.from, r.to);
  if (!pay.people.length) { toast('No attendance marked for this period.'); return; }
  const rows = [['Period', 'Name', 'Category', 'Type', 'Present', 'Late', 'Absent', 'Average rating', 'Wages', 'Rating incentive', 'Sales bonus', 'Total pay']];
  pay.people.forEach(p => rows.push([`${r.from} to ${r.to}`, p.name, p.category, p.oneDay ? 'Day helper' : 'Regular', p.present, p.late, p.absent,
    p.avg ? p.avg.toFixed(2) : '', round2(p.wages), round2(p.ratingInc), round2(p.bonus), p.total]));
  downloadCSV(`payroll_${r.from}_to_${r.to}.csv`, rows);
}

/* =========================================================
   EXPENSES
   ========================================================= */
function enterExpenses() { S.expMonth = S.expMonth || S.today.slice(0, 7); subExpenses(); }

function subExpenses() {
  S.viewSubs.forEach(u => u());
  const f = S.expMonth + '-01', t = monthEnd(f);
  S.expenses = []; S.expAtt = []; S.expOrders = [];
  S.viewSubs = [
    Store.listen('expenses', { from: f, to: t }, l => { S.expenses = l; refresh(['expenses']); }),
    Store.listen('attendance', { from: attFrom(f), to: t }, l => { S.expAtt = l; refresh(['expenses']); }),
    Store.listen('orders', { from: f, to: t }, l => { S.expOrders = l; refresh(['expenses']); }),
  ];
}

function renderExpenses() {
  const f = S.expMonth + '-01', t = monthEnd(f);
  const list = S.expenses.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const staff = computePay(S.expAtt, S.expOrders, f, t);
  const staffDays = Object.keys(staff.byDay).filter(k => dayStaffTotal(staff.byDay[k]) > 0);
  const days = [...new Set([...list.map(e => e.date), ...staffDays])].sort((a, b) => b.localeCompare(a));
  const cats = EXPENSE_CATS.map(c => [c, sum(list.filter(e => e.category === c), e => e.amount)]).filter(x => x[1] > 0);
  const thisMonth = S.expMonth === S.today.slice(0, 7);
  const items = round2(sum(list, e => e.amount));
  const todayTotal = round2(sum(list.filter(e => e.date === S.today), e => e.amount) + dayStaffTotal(staff.byDay[S.today]));
  return `<div class="page">
    <div class="page-head"><div><h1>Expenses</h1><p class="muted">${fmtMonth(f)}</p></div>
      <div class="daynav"><button class="btn big" data-act="expMonth" data-d="-1">‹ Previous month</button>
        <button class="btn big" data-act="expMonth" data-d="1" ${thisMonth ? 'disabled' : ''}>Next month ›</button>
        <button class="btn primary big" data-act="expNew">Add expense</button></div></div>
    <div class="tiles">
      <div class="tile big-tile"><span>Total this month</span><b>${peso(round2(items + staff.total))}</b><small>Items ${peso(items)} + Staff ${peso(staff.total)}</small></div>
      ${thisMonth ? `<div class="tile"><span>Today</span><b>${peso(todayTotal)}</b></div>` : ''}
      <div class="tile"><span>Staff pay</span><b>${peso(staff.total)}</b><small>Wages ${peso(staff.wages)} · Incentives ${peso(round2(staff.ratingInc + staff.bonus))}</small></div>
      ${cats.map(([c, v]) => `<div class="tile"><span>${esc(c)}</span><b>${peso(v)}</b></div>`).join('')}
    </div>
    ${days.length ? days.map(d => {
      const l = list.filter(e => e.date === d);
      const sp = staff.byDay[d], spt = dayStaffTotal(sp);
      return `<section class="card"><div class="card-title-row"><h2 class="card-title">${fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}</h2><b>${peso(round2(sum(l, e => e.amount) + spt))}</b></div>
        ${l.map(e => `<div class="mrow"><div class="mr-info"><b>${esc(e.item)}</b><small>${esc(e.category)}</small></div><b class="mr-price">${peso(e.amount)}</b>
          <button class="btn sm" data-act="expEdit" data-id="${e.id}">Edit</button><button class="btn sm danger-o" data-act="expDel" data-id="${e.id}">Delete</button></div>`).join('')}
        ${spt ? `<div class="mrow auto"><div class="mr-info"><b>Staff pay</b><small>Automatic from Employees · Wages ${peso(sp.wages)}${sp.ratingInc ? ' · Rating incentive ' + peso(sp.ratingInc) : ''}${sp.bonus ? ' · Sales bonus ' + peso(sp.bonus) : ''}</small></div><b class="mr-price">${peso(spt)}</b></div>` : ''}
      </section>`;
    }).join('') : '<div class="empty"><h3>No expenses recorded this month.</h3><p>Tap “Add expense” to record what you bought. Staff pay is added automatically from Employees.</p></div>'}
  </div>`;
}

function openExpenseForm(exp, date) {
  const isNew = !exp;
  const st = exp ? { ...exp } : { date: date || S.today, item: '', category: 'Ingredients', amount: '' };
  const draw = () => `
    <label class="field">Date<input class="input big" type="date" id="xd" value="${esc(st.date)}" max="${S.today}"></label>
    <label class="field">What did you buy / pay for?<input class="input big" id="xi" value="${esc(st.item)}" placeholder="e.g. Rice 25kg, LPG refill" autocomplete="off"></label>
    <div class="opt-label">Kind of expense</div>
    <div class="seg">${EXPENSE_CATS.map(c => `<button class="seg-btn ${st.category === c ? 'on' : ''}" data-m="cat" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <label class="field">Amount (₱)<input class="input big" id="xa" type="number" inputmode="decimal" min="0" value="${esc(st.amount)}"></label>
    <p class="muted small">Staff wages are added automatically from Employees — no need to type them here.</p>
    <p class="err" id="xErr"></p>
    <div class="modal-actions"><button class="btn big" data-m="close">Cancel</button><button class="btn primary big grow" data-m="save">Save expense</button></div>`;
  openModal({
    title: isNew ? 'Add expense' : 'Edit expense', html: draw(),
    onMount(m) {
      m.el.addEventListener('input', e => {
        if (e.target.id === 'xd') st.date = e.target.value;
        if (e.target.id === 'xi') st.item = e.target.value;
        if (e.target.id === 'xa') st.amount = e.target.value;
      });
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        if (b.dataset.m === 'cat') { st.category = b.dataset.v; m.set(draw()); return; }
        if (b.dataset.m !== 'save') return;
        const item = String(st.item || '').trim(), amount = num(st.amount);
        const err = t => { $('#xErr', m.el).textContent = t; };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(st.date || '')) return err('Please choose the date.');
        if (!item) return err('Please type what the expense is for.');
        if (amount <= 0) return err('Please type the amount.');
        const data = { date: st.date, item, category: st.category, amount, createdAt: exp ? exp.createdAt : Date.now() };
        if (isNew) Store.add('expenses', data); else Store.set('expenses', exp.id, data);
        m.close();
        toast(`Expense saved: ${item} ${peso(amount)}`);
      });
    },
  });
}

function deleteExpense(id) {
  const x = S.expenses.find(e => e.id === id); if (!x) return;
  confirmBox(`Delete “${x.item}”?`, `${peso(x.amount)} on ${fmtShort(x.date)} will be removed from expenses.`, 'Delete', () => Store.remove('expenses', id));
}

/* =========================================================
   DASHBOARD
   ========================================================= */
function enterDashboard() { S.dash.anchor = S.dash.anchor || S.today; dashSubscribe(); }

function dashRange() {
  const { period, anchor } = S.dash;
  if (period === 'day') {
    const y = addDays(anchor, -1);
    return { from: anchor, to: anchor, prevFrom: y, prevTo: y, prevLabel: 'the day before', label: fmtDate(anchor) + (anchor === S.today ? ' (Today)' : '') };
  }
  if (period === 'week') {
    const f = weekStart(anchor), t = addDays(f, 6);
    return { from: f, to: t, prevFrom: addDays(f, -7), prevTo: addDays(f, -1), prevLabel: 'last week', label: `Week of ${fmtShort(f)} – ${fmtShort(t)}, ${parseKey(t).getFullYear()}` };
  }
  // Monthly: no previous-month comparison, to keep cloud reads within the free plan.
  const f = monthStart(anchor);
  return { from: f, to: monthEnd(anchor), label: fmtMonth(f) };
}

function dashMove(d) {
  const p = S.dash.period;
  if (d === 0) S.dash.anchor = S.today;
  else if (p === 'day') S.dash.anchor = addDays(S.dash.anchor, d);
  else if (p === 'week') S.dash.anchor = addDays(S.dash.anchor, 7 * d);
  else S.dash.anchor = addMonths(S.dash.anchor, d);
}

function dashSubscribe() {
  S.viewSubs.forEach(u => u());
  const r = dashRange();
  const from = r.prevFrom || r.from;
  S.dashData = { orders: [], expenses: [], ratings: [], att: [] };
  S.viewSubs = [
    Store.listen('orders', { from, to: r.to }, l => { S.dashData.orders = l; refresh(['dash']); }),
    Store.listen('expenses', { from, to: r.to }, l => { S.dashData.expenses = l; refresh(['dash']); }),
    Store.listen('attendance', { from: attFrom(from), to: r.to }, l => { S.dashData.att = l; refresh(['dash']); }),
    Store.listen('ratings', { from: r.from, to: r.to }, l => { S.dashData.ratings = l; refresh(['dash']); }),
  ];
}

function summarize(D, from, to) {
  const os = D.orders.filter(o => !o.voided && o.date >= from && o.date <= to);
  const es = D.expenses.filter(e => e.date >= from && e.date <= to);
  const staff = computePay(D.att, D.orders, from, to);
  const sales = round2(sum(os, o => o.total)), items = round2(sum(es, e => e.amount));
  const exp = round2(items + staff.total);
  return { os, es, staff, sales, items, exp, profit: round2(sales - exp), count: os.length, avg: os.length ? sales / os.length : 0 };
}

function itemStats(os) {
  const m = new Map();
  os.forEach(o => (o.items || []).forEach(l => {
    const k = l.category + '|' + l.type + '|' + l.name;
    const e = m.get(k) || { name: l.name, category: l.category, type: l.type, qty: 0, sales: 0 };
    e.qty += num(l.qty); e.sales += num(l.total);
    m.set(k, e);
  }));
  return [...m.values()].sort((a, b) => b.qty - a.qty || b.sales - a.sales);
}
const catStats = os => TABS.map(c => [c, sum(os, o => sum((o.items || []).filter(l => l.category === c), l => l.total))]);
const payStats = os => PAY_METHODS.map(p => [p, sum(os.filter(o => o.payment === p), o => o.total)]).filter(x => x[1] > 0);
const expKinds = cur => [
  ...EXPENSE_CATS.map(c => [c, sum(cur.es.filter(e => e.category === c), e => e.amount)]),
  ['Staff wages', cur.staff.wages], ['Staff incentives', round2(cur.staff.ratingInc + cur.staff.bonus)],
].filter(x => x[1] > 0);

function renderDashboard() {
  const r = dashRange(), p = S.dash.period, D = S.dashData;
  const cur = summarize(D, r.from, r.to);
  const prev = r.prevFrom ? summarize(D, r.prevFrom, r.prevTo) : null;
  const head = `<div class="page-head"><div><h1>Dashboard</h1><p class="muted"><b>${esc(r.label)}</b></p></div>
    <div class="daynav">
      <div class="seg seg-inline">${[['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']].map(([k, l]) => `<button class="seg-btn ${p === k ? 'on' : ''}" data-act="dPeriod" data-p="${k}">${l}</button>`).join('')}</div>
      <button class="btn big" data-act="dNav" data-d="-1" aria-label="Previous">‹</button>
      <button class="btn big" data-act="dNav" data-d="0">Today</button>
      <button class="btn big" data-act="dNav" data-d="1" aria-label="Next" ${r.to >= S.today ? 'disabled' : ''}>›</button>
    </div></div>
    <div class="toolbar"><button class="btn" data-act="dTarget">Set sales targets</button>
      <button class="btn" data-act="dCsv">Download sales data (CSV)</button>
      <button class="btn" data-act="dCsvExp">Download expenses (CSV)</button></div>`;
  const tiles = `<div class="tiles">
    ${tile('Sales', cur.sales, prev && prev.sales, r.prevLabel, true)}
    ${tile('Expenses', cur.exp, prev && prev.exp, r.prevLabel, false, `Items ${peso(cur.items)} + Staff ${peso(cur.staff.total)}`)}
    ${tile('Profit', cur.profit, prev && prev.profit, r.prevLabel, true, 'Sales minus expenses')}
    <div class="tile"><span>Orders</span><b>${cur.count}</b><small>Average ${peso(round2(cur.avg))} per order</small></div></div>`;
  return `<div class="page">${head}${tiles}${p === 'day' ? dashDaily(r, cur) : dashPeriod(r, cur)}</div>`;
}

function tile(label, v, pv, pl, upGood, note) {
  let small = note ? `<small>${note}</small>` : '';
  if (pv !== null && pv !== undefined) {
    if (pv) {
      const d = (v - pv) / Math.abs(pv), good = (d >= 0) === upGood;
      small += `<small class="${good ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(d * 100))}% vs ${pl} (${peso(pv)})</small>`;
    } else small += `<small>${pl}: ${peso(pv)}</small>`;
  }
  return `<div class="tile"><span>${label}</span><b class="${v < 0 ? 'neg' : ''}">${peso(v)}</b>${small}</div>`;
}

function gauge(value, target, label) {
  const pct = target > 0 ? value / target : 0, p = Math.min(Math.max(pct, 0), 1);
  const a = Math.PI * (1 - p), x = 100 + 80 * Math.cos(a), y = 100 - 80 * Math.sin(a);
  const fg = p > 0.001 ? `<path class="g-fg ${pct >= 1 ? 'ok' : ''}" d="M20 100 A80 80 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}"/>` : '';
  return `<div class="gauge"><svg viewBox="0 0 200 118" role="img" aria-label="${Math.round(pct * 100)}% of target">
      <path class="g-bg" d="M20 100 A80 80 0 0 1 180 100"/>${fg}<text x="100" y="94" class="g-pct">${Math.round(pct * 100)}%</text></svg>
    <div class="g-cap">${peso(value)} of ${peso(target)} target ${esc(label)}</div>
    ${pct >= 1 ? '<div class="reached">Target reached</div>' : `<div class="muted">${peso(round2(target - value))} more to reach the target</div>`}</div>`;
}

function noTarget(label) {
  return `<div class="no-target"><p>No target set for ${esc(label)}.</p><button class="btn primary" data-act="dTarget">Set a target</button></div>`;
}

function hbars(rows, color) {
  if (!rows.length) return '<p class="muted">No data yet.</p>';
  const max = Math.max(1, ...rows.map(r => r[1])), tot = sum(rows, r => r[1]);
  return `<div class="hbars">${rows.map(([l, v], i) => `<div class="hb"><span class="hb-l">${esc(l)}</span>
    <div class="hb-track"><div class="hb-fill" style="width:${v / max * 100}%;background:${color || PALETTE[i % PALETTE.length]}"></div></div>
    <span class="hb-v">${peso(v)}<small>${tot ? Math.round(v / tot * 100) : 0}%</small></span></div>`).join('')}</div>`;
}

function versus(s, e) {
  const max = Math.max(s, e, 1);
  const bar = (l, v, c) => `<div class="hb"><span class="hb-l">${l}</span><div class="hb-track"><div class="hb-fill" style="width:${v / max * 100}%;background:${c}"></div></div><span class="hb-v">${peso(v)}</span></div>`;
  return `<div class="hbars">${bar('Sales', s, C.sales)}${bar('Expenses', e, C.exp)}</div>
    <p class="profit-line">Profit: <b class="${s - e < 0 ? 'neg' : 'pos-num'}">${peso(round2(s - e))}</b></p>`;
}

function itemTable(items, limit) {
  if (!items.length) return '<p class="muted">No orders yet.</p>';
  const list = limit ? items.slice(0, limit) : items;
  const maxQ = Math.max(1, ...list.map(i => i.qty));
  const catColor = c => PALETTE[Math.max(0, TABS.indexOf(c)) % PALETTE.length];
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Item</th><th>Meal · Type</th><th class="r">Qty sold</th><th class="r">Sales</th></tr></thead><tbody>
    ${list.map(i => `<tr><td><b>${esc(i.name)}</b></td><td class="muted">${esc(i.category)} · ${esc(i.type)}</td>
      <td class="r"><div class="qbar"><div class="qb-track"><div class="qb-fill" style="width:${i.qty / maxQ * 100}%;background:${catColor(i.category)}"></div></div><b>${i.qty}</b></div></td>
      <td class="r">${peso(i.sales)}</td></tr>`).join('')}</tbody></table></div>`;
}

function staffTable(people) {
  if (!people.length) return '<p class="muted">No attendance marked. Use the Employees page.</p>';
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Category</th><th class="r">Days worked</th><th class="r">Absent</th><th class="r">Avg rating</th><th class="r">Pay</th></tr></thead><tbody>
    ${people.map(p => `<tr><td><b>${esc(p.name)}</b></td><td class="muted">${esc(p.category)}</td><td class="r">${p.present + p.late}${p.late ? ` <small class="muted">(${p.late} late)</small>` : ''}</td>
      <td class="r">${p.absent}</td><td class="r">${p.avg ? `${face(p.avg).e} ${p.avg.toFixed(1)}` : '—'}</td><td class="r">${peso(p.total)}</td></tr>`).join('')}</tbody></table></div>`;
}

function hourChart(id, os) {
  const counts = new Array(24).fill(0);
  let lo = 6, hi = 18;
  os.forEach(o => { const h = new Date(o.createdAt).getHours(); counts[h]++; lo = Math.min(lo, h); hi = Math.max(hi, h); });
  const labels = [], data = [];
  for (let h = lo; h <= hi; h++) { labels.push(hourLabel(h)); data.push(counts[h]); }
  S.pendingCharts.push([id, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Orders', data, backgroundColor: PALETTE[3], borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eee' } }, x: { grid: { display: false } } } },
  }]);
}

function moneyOpts() {
  return {
    responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${peso(c.parsed.y)}` } } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#eee' }, ticks: { callback: v => '₱' + Number(v).toLocaleString('en-PH') } } },
  };
}

function ratingCard(ratings, canRate) {
  const avg = ratings.length ? sum(ratings, x => x.score) / ratings.length : 0;
  const f = avg ? face(avg) : null;
  return `${cardTitle('Overall staff rating')}
    ${canRate ? `<p class="muted">How did the team do${S.dash.anchor === S.today ? ' today' : ' on this day'}? Tap a face. Rate each person on the Employees page.</p>
      <div class="smileys">${SMILEYS.map(s => `<button class="smiley" data-act="dRate" data-v="${s.v}"><span>${s.e}</span><small>${s.t}</small></button>`).join('')}</div>` : ''}
    <div class="rating-sum">${f ? `<span class="big-face">${f.e}</span><div><b>${avg.toFixed(1)} / 5</b> — ${f.t}<br><small class="muted">From ${ratings.length} rating(s)</small></div>` : '<span class="muted">No ratings yet.</span>'}</div>`;
}

function expList(cur) {
  const list = cur.es.slice().sort((a, b) => a.createdAt - b.createdAt);
  const st = cur.staff;
  const staffRows = [['Staff wages', st.wages], ['Rating incentives', st.ratingInc], ['Sales bonus', st.bonus]].filter(x => x[1] > 0)
    .map(([l, v]) => `<div class="mrow auto"><div class="mr-info"><b>${l}</b><small>Automatic from Employees</small></div><b>${peso(v)}</b></div>`).join('');
  return `<div class="exp-list">${list.map(e => `<div class="mrow"><div class="mr-info"><b>${esc(e.item)}</b><small>${esc(e.category)}</small></div><b>${peso(e.amount)}</b></div>`).join('')}${staffRows}
    ${!list.length && !staffRows ? '<p class="muted">No expenses recorded for this day.</p>' : ''}
    <button class="btn" data-act="expNewDay">Add expense for this day</button></div>`;
}

function dashDaily(r, cur) {
  const t = S.targets['d-' + r.from];
  const ratings = S.dashData.ratings.filter(x => x.date === r.from);
  hourChart('chHour', cur.os);
  return `<div class="dgrid">
    <section class="card">${cardTitle('Sales target')}${t ? gauge(cur.sales, t, r.from === S.today ? 'today' : 'for this day') : noTarget(r.from === S.today ? 'today' : 'this day')}</section>
    <section class="card">${cardTitle('Sales vs expenses')}${versus(cur.sales, cur.exp)}${expList(cur)}</section>
    <section class="card span2">${cardTitle('Orders per menu item')}${itemTable(itemStats(cur.os))}</section>
    <section class="card">${cardTitle('Sales by meal')}${hbars(catStats(cur.os))}</section>
    <section class="card">${cardTitle('Payments')}${hbars(payStats(cur.os))}</section>
    <section class="card span2">${cardTitle('Orders by hour')}<div class="chart-box"><canvas id="chHour"></canvas></div></section>
    <section class="card span2"><div class="card-title-row">${cardTitle('Staff this day')}<button class="btn sm" data-act="go" data-view="employees">Open Employees</button></div>${staffTable(cur.staff.people)}</section>
    <section class="card span2">${ratingCard(ratings, true)}</section>
  </div>`;
}

function dashPeriod(r, cur) {
  const p = S.dash.period;
  const perDay = daysIn(r.from, r.to).map(k => ({
    k, sales: round2(sum(cur.os.filter(o => o.date === k), o => o.total)),
    exp: round2(sum(cur.es.filter(e => e.date === k), e => e.amount) + dayStaffTotal(cur.staff.byDay[k])),
    target: S.targets['d-' + k] || 0,
  }));
  const pastDays = perDay.filter(d => d.k <= S.today);
  const withT = pastDays.filter(d => d.target > 0), hit = withT.filter(d => d.sales >= d.target);
  const dailySum = sum(perDay, d => d.target);

  let gaugeHtml;
  if (p === 'month') {
    const mt = S.targets['m-' + r.from.slice(0, 7)];
    gaugeHtml = mt ? gauge(cur.sales, mt, 'this month') : dailySum ? gauge(cur.sales, dailySum, 'this month (daily targets added up)') : noTarget('this month');
  } else {
    gaugeHtml = dailySum ? gauge(cur.sales, dailySum, 'this week (daily targets added up)') : noTarget('this week');
  }
  const dots = withT.length ? `<p class="kpi-line"><b>${hit.length} of ${withT.length}</b> day(s) reached the daily target</p>
    <div class="daydots">${pastDays.map(d => `<span class="dd ${d.target ? (d.sales >= d.target ? 'hit' : 'miss') : 'none'}" title="${fmtShort(d.k)}: ${peso(d.sales)}${d.target ? ' / ' + peso(d.target) : ''}">${parseKey(d.k).getDate()}</span>`).join('')}</div>
    <p class="legend"><span class="dd hit">✓</span> reached <span class="dd miss">✗</span> missed <span class="dd none">–</span> no target</p>` : '';

  const items = itemStats(cur.os);
  const open = perDay.filter(d => d.sales > 0);
  const best = open.slice().sort((a, b) => b.sales - a.sales)[0];
  const hours = new Array(24).fill(0);
  cur.os.forEach(o => { hours[new Date(o.createdAt).getHours()]++; });
  const peak = hours.indexOf(Math.max(...hours));
  const topStaff = cur.staff.people.filter(x => x.avg).sort((a, b) => b.avg - a.avg)[0];
  const insights = `<ul class="insights">
    <li><span>Best day</span><b>${best ? `${fmtDate(best.k, { weekday: 'short', month: 'short', day: 'numeric' })} – ${peso(best.sales)}` : '—'}</b></li>
    <li><span>Top seller</span><b>${items[0] ? `${esc(items[0].name)} (${items[0].qty} sold)` : '—'}</b></li>
    <li><span>Busiest time</span><b>${cur.os.length ? `${hourLabel(peak)} – ${hourLabel((peak + 1) % 24)}` : '—'}</b></li>
    <li><span>Average sales per open day</span><b>${open.length ? peso(round2(cur.sales / open.length)) : '—'}</b></li>
    <li><span>Profit margin</span><b>${cur.sales ? Math.round(cur.profit / cur.sales * 100) + '%' : '—'}</b></li>
    <li><span>Best rated staff</span><b>${topStaff ? `${esc(topStaff.name)} (${topStaff.avg.toFixed(1)})` : '—'}</b></li>
  </ul>`;

  const labels = perDay.map(d => p === 'week' ? parseKey(d.k).toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric' }) : String(parseKey(d.k).getDate()));
  const datasets = [
    { label: 'Sales', data: perDay.map(d => d.sales), backgroundColor: C.sales, borderRadius: 3 },
    { label: 'Expenses', data: perDay.map(d => d.exp), backgroundColor: C.exp, borderRadius: 3 },
  ];
  if (perDay.some(d => d.target)) datasets.push({ type: 'line', label: 'Daily target', data: perDay.map(d => d.target || null), borderColor: C.target, borderDash: [6, 4], pointRadius: 0, borderWidth: 2, fill: false });
  S.pendingCharts.push(['chDaily', { type: 'bar', data: { labels, datasets }, options: moneyOpts() }]);
  hourChart('chHour', cur.os);

  let monthExtra = '';
  if (p === 'month') {
    const weeks = [];
    perDay.forEach(d => {
      const ws = weekStart(d.k);
      let w = weeks.find(x => x.ws === ws);
      if (!w) { w = { ws, from: d.k, to: d.k, sales: 0, exp: 0 }; weeks.push(w); }
      w.to = d.k; w.sales += d.sales; w.exp += d.exp;
    });
    S.pendingCharts.push(['chWeekly', {
      type: 'bar',
      data: {
        labels: weeks.map(w => `${fmtShort(w.from)}–${parseKey(w.to).getDate()}`),
        datasets: [
          { label: 'Sales', data: weeks.map(w => round2(w.sales)), backgroundColor: C.sales, borderRadius: 3 },
          { label: 'Expenses', data: weeks.map(w => round2(w.exp)), backgroundColor: C.exp, borderRadius: 3 },
        ],
      },
      options: moneyOpts(),
    }]);
    const dowNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dowAvg = dowNames.map((_, i) => {
      const ds = open.filter(d => (parseKey(d.k).getDay() + 6) % 7 === i);
      return ds.length ? round2(sum(ds, d => d.sales) / ds.length) : 0;
    });
    S.pendingCharts.push(['chDow', {
      type: 'bar',
      data: { labels: dowNames, datasets: [{ label: 'Average sales', data: dowAvg, backgroundColor: dowNames.map((_, i) => PALETTE[i % PALETTE.length]), borderRadius: 4 }] },
      options: { ...moneyOpts(), plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `Average: ${peso(c.parsed.y)}` } } } },
    }]);
    monthExtra = `<section class="card span2">${cardTitle('Sales vs expenses per week')}<div class="chart-box"><canvas id="chWeekly"></canvas></div></section>
      <section class="card">${cardTitle('Best day of the week')}<p class="muted small">Average sales on days with orders</p><div class="chart-box"><canvas id="chDow"></canvas></div></section>`;
  }

  const ratings = S.dashData.ratings;
  const byDay = {};
  ratings.forEach(x => { (byDay[x.date] = byDay[x.date] || []).push(num(x.score)); });
  const dayChips = Object.keys(byDay).sort().map(k => {
    const a = sum(byDay[k], v => v) / byDay[k].length;
    return `<span>${fmtDate(k, { weekday: 'short', day: 'numeric' })} ${face(a).e} ${a.toFixed(1)}</span>`;
  }).join('');

  return `<div class="dgrid">
    <section class="card span2">${cardTitle('Quick summary')}${insights}</section>
    <section class="card">${cardTitle('Did we reach the target?')}${gaugeHtml}${dots}</section>
    <section class="card">${cardTitle('Sales vs expenses')}${versus(cur.sales, cur.exp)}</section>
    <section class="card span2">${cardTitle('Sales vs expenses per day')}<div class="chart-box"><canvas id="chDaily"></canvas></div></section>
    ${monthExtra}
    <section class="card">${cardTitle('Busiest hours')}<p class="muted small">Number of orders per hour</p><div class="chart-box"><canvas id="chHour"></canvas></div></section>
    <section class="card">${cardTitle('Sales by meal')}${hbars(catStats(cur.os))}</section>
    <section class="card">${cardTitle('Payments')}${hbars(payStats(cur.os))}</section>
    <section class="card">${cardTitle('Expenses by kind')}${hbars(expKinds(cur))}</section>
    <section class="card span2">${cardTitle('Best sellers (top 10)')}${itemTable(items, 10)}</section>
    <section class="card span2"><div class="card-title-row">${cardTitle('Staff')}<button class="btn sm" data-act="go" data-view="employees">Open Employees</button></div>${staffTable(cur.staff.people)}</section>
    <section class="card span2">${ratingCard(ratings, false)}${dayChips ? `<div class="day-ratings">${dayChips}</div>` : ''}</section>
  </div>`;
}

function addRating(v) {
  const id = Store.add('ratings', { date: S.dash.anchor, score: v, createdAt: Date.now() });
  const s = SMILEYS[v - 1];
  toast(`Rated “${s.t}”`, { action: 'Undo', ms: 5000, onAction: () => Store.remove('ratings', id) });
}

function openTargetForm() {
  const base = S.dash.anchor, ym = base.slice(0, 7);
  const st = { amount: S.targets['d-' + base] || '', scope: 'day', from: base, to: base, skipSun: false, month: S.targets['m-' + ym] || '' };
  const targetDays = () => {
    let f, t;
    if (st.scope === 'day') { f = t = base; }
    else if (st.scope === 'week') { f = weekStart(base); t = addDays(f, 6); }
    else if (st.scope === 'month') { f = monthStart(base); t = monthEnd(base); }
    else { f = st.from; t = st.to; }
    if (!f || !t || f > t) return [];
    let days = daysIn(f, t);
    if (st.skipSun && st.scope !== 'day') days = days.filter(k => parseKey(k).getDay() !== 0);
    return days;
  };
  const scopeText = () => {
    const d = targetDays();
    return d.length ? `Will apply to ${d.length} day(s): ${fmtShort(d[0])} – ${fmtShort(d[d.length - 1])}.` : 'Please choose valid dates (From must be before To).';
  };
  const draw = () => `
    <h3 class="sub">Daily sales target</h3>
    <label class="field">Target per day (₱)<input class="input big" id="tAmt" type="number" inputmode="decimal" min="0" value="${esc(st.amount)}" placeholder="e.g. 5000"></label>
    <div class="opt-label">Apply to</div>
    <div class="seg">${[['day', base === S.today ? 'Just today' : 'Just ' + fmtShort(base)], ['week', 'Whole week'], ['month', 'Whole month'], ['custom', 'Custom dates']]
      .map(([k, l]) => `<button class="seg-btn ${st.scope === k ? 'on' : ''}" data-m="scope" data-v="${k}">${l}</button>`).join('')}</div>
    ${st.scope === 'custom' ? `<div class="row2"><label class="field">From<input class="input big" type="date" id="tFrom" value="${esc(st.from)}"></label>
      <label class="field">To<input class="input big" type="date" id="tTo" value="${esc(st.to)}"></label></div>` : ''}
    ${st.scope !== 'day' ? `<label class="check big"><input type="checkbox" id="tSun" ${st.skipSun ? 'checked' : ''}> Skip Sundays</label>` : ''}
    <p class="muted" id="tScope">${scopeText()}</p>
    <p class="err" id="tErr"></p>
    <div class="modal-actions"><button class="btn big danger-o" data-m="dClear">Remove daily target</button><span class="grow"></span>
      <button class="btn primary big" data-m="dSave">Save daily target</button></div>
    <hr>
    <h3 class="sub">Monthly sales target – ${fmtMonth(base)}</h3>
    <label class="field">Target for the whole month (₱) — optional<input class="input big" id="tMonth" type="number" inputmode="decimal" min="0" value="${esc(st.month)}" placeholder="e.g. 120000"></label>
    <p class="err" id="mErr"></p>
    <div class="modal-actions"><button class="btn big danger-o" data-m="mClear">No monthly target</button><span class="grow"></span>
      <button class="btn primary big" data-m="mSave">Save monthly target</button></div>
    <hr>
    <div class="modal-actions"><button class="btn big" data-m="close">Close</button></div>`;
  openModal({
    title: 'Sales targets', html: draw(), wide: true,
    onMount(m) {
      const upd = () => { const s = $('#tScope', m.el); if (s) s.textContent = scopeText(); };
      m.el.addEventListener('input', e => {
        const id = e.target.id;
        if (id === 'tAmt') st.amount = e.target.value;
        else if (id === 'tMonth') st.month = e.target.value;
        else if (id === 'tFrom') { st.from = e.target.value; upd(); }
        else if (id === 'tTo') { st.to = e.target.value; upd(); }
      });
      m.el.addEventListener('change', e => { if (e.target.id === 'tSun') { st.skipSun = e.target.checked; upd(); } });
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const a = b.dataset.m;
        if (a === 'scope') { st.scope = b.dataset.v; m.set(draw()); return; }
        if (a === 'dSave' || a === 'dClear') {
          const days = targetDays();
          if (!days.length) { $('#tErr', m.el).textContent = 'Please choose valid dates.'; return; }
          if (a === 'dSave') {
            const amt = num(st.amount);
            if (amt <= 0) { $('#tErr', m.el).textContent = 'Please type the target amount.'; return; }
            days.forEach(k => Store.set('targets', 'd-' + k, { amount: amt, date: k }));
            toast(`Daily target ${peso(amt)} set for ${days.length} day(s)`);
          } else {
            days.forEach(k => Store.remove('targets', 'd-' + k));
            toast(`Daily target removed for ${days.length} day(s)`);
          }
          m.close();
        }
        if (a === 'mSave') {
          const amt = num(st.month);
          if (amt <= 0) { $('#mErr', m.el).textContent = 'Please type the monthly target, or tap “No monthly target”.'; return; }
          Store.set('targets', 'm-' + ym, { amount: amt, month: ym });
          toast(`Monthly target ${peso(amt)} set for ${fmtMonth(base)}`);
          m.close();
        }
        if (a === 'mClear') { Store.remove('targets', 'm-' + ym); toast('Monthly target removed'); m.close(); }
      });
    },
  });
}

// ---------- CSV export ----------
function csvCell(v) { v = String(v == null ? '' : v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function downloadCSV(name, rows) {
  const text = rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
  toast('Downloading ' + name);
}
function rangeName(r) { return r.from === r.to ? r.from : `${r.from}_to_${r.to}`; }

function exportSalesCSV() {
  const r = dashRange();
  const os = S.dashData.orders.filter(o => o.date >= r.from && o.date <= r.to).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  if (!os.length) { toast('No orders to download for this period.'); return; }
  const rows = [['Date', 'Time', 'Order No', 'Order', 'Category', 'Type', 'Rice', 'Dine-in / Take-out', 'Qty', 'Unit Price', 'Line Total', 'Order Total', 'Payment', 'Cash Received', 'Change', 'Cashier', 'Status']];
  os.forEach(o => (o.items || []).forEach(l => rows.push([
    o.date, fmtTime(o.createdAt), o.no, l.name, l.category, l.type, riceLabel(l.rice), serviceLabel(l.service) || (l.container ? 'With container' : ''),
    l.qty, l.unit, l.total, o.total, o.payment, o.cash ? o.cash.given : '', o.cash ? o.cash.change : '', o.by || '',
    o.voided ? 'Voided' : (o.edits || []).length ? 'Edited' : 'OK',
  ])));
  downloadCSV(`sales_${rangeName(r)}.csv`, rows);
}

function exportExpensesCSV() {
  const r = dashRange();
  const es = S.dashData.expenses.filter(e => e.date >= r.from && e.date <= r.to);
  const staff = computePay(S.dashData.att, S.dashData.orders, r.from, r.to);
  const rows = es.map(e => [e.date, e.item, e.category, e.amount]);
  Object.keys(staff.byDay).forEach(k => {
    const d = staff.byDay[k];
    if (d.wages) rows.push([k, 'Staff wages', 'Staff', round2(d.wages)]);
    if (d.ratingInc) rows.push([k, 'Rating incentives', 'Staff', round2(d.ratingInc)]);
    if (d.bonus) rows.push([k, 'Sales bonus', 'Staff', round2(d.bonus)]);
  });
  if (!rows.length) { toast('No expenses to download for this period.'); return; }
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  downloadCSV(`expenses_${rangeName(r)}.csv`, [['Date', 'Description', 'Kind', 'Amount'], ...rows]);
}

/* =========================================================
   SETTINGS
   ========================================================= */
function renderSettings() {
  const s = S.settings, I = s.incentives, R = s.supplyRules;
  const nField = (id, label, v) => `<label class="field">${label}<input class="input" type="number" inputmode="decimal" min="0" id="${id}" value="${esc(v)}"></label>`;
  return `<div class="page narrow"><h1>Settings</h1>
    <section class="card">${cardTitle('Canteen name')}
      <p class="muted small">Used in reports. To change the logo, replace the file logo.png.</p>
      <div class="row-inline"><input class="input big" id="sName" value="${esc(s.shopName)}"><button class="btn primary big" data-act="saveName">Save</button></div></section>

    <section class="card">${cardTitle('Staff incentives')}
      <h3 class="sub">Rating incentive</h3>
      <p class="muted">Paid to each employee based on their average smiley rating.</p>
      <div class="radios">${[['off', 'Off'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([v, l]) =>
        `<label class="radio"><input type="radio" name="incPeriod" value="${v}" ${I.period === v ? 'checked' : ''}> ${l}</label>`).join('')}</div>
      <div class="rate-grid">${[5, 4, 3, 2, 1].map(v => `<label class="rate-row"><span class="mini-face">${SMILEYS[v - 1].e}</span><span>${v} – ${SMILEYS[v - 1].t}</span>
        <input class="input" type="number" inputmode="decimal" min="0" id="inc${v}" value="${esc(I.byRating[v])}" placeholder="₱"></label>`).join('')}</div>
      <p class="muted small">Weekly: paid on Sunday for Monday–Sunday. Monthly: paid on the last day of the month. The average is rounded (e.g. 4.5 counts as 5).</p>
      <h3 class="sub">Sales bonus</h3>
      <div class="row2">
        ${nField('incGoal', 'If sales for the day reach (₱)', I.salesGoal || '')}
        ${nField('incBonus', 'Each person who worked gets (₱)', I.salesBonus || '')}
      </div>
      <h3 class="sub">Late</h3>
      <div class="row2">${nField('incLate', 'Less from daily wage when Late (₱)', I.lateDeduct || '')}</div>
      <button class="btn primary big" data-act="saveIncentives">Save incentives</button>
      <p class="muted small">Staff pay is added to Expenses and the Dashboard automatically.</p></section>

    <section class="card">${cardTitle('Inventory')}
      <h3 class="sub">Paper plates and spoon & fork</h3>
      <p class="muted">Take 1 paper plate and 1 spoon & fork out of the inventory for each meal from:</p>
      <div class="radios">${[...MEALS, 'Others'].map(c => `<label class="radio"><input type="checkbox" name="supMeal" value="${c}" ${R.meals.includes(c) ? 'checked' : ''}> ${c}</label>`).join('')}</div>
      <p class="muted">…when the customer chose:</p>
      <div class="radios">${SERVICES.map(([v, l]) => `<label class="radio"><input type="checkbox" name="supMode" value="${v}" ${R.modes.includes(v) ? 'checked' : ''}> ${l}</label>`).join('')}</div>
      <div class="row2">${nField('expWarn', 'Warn about expiry this many days before', s.expiryWarnDays)}</div>
      <button class="btn primary big" data-act="saveSupplyRules">Save inventory settings</button></section>

    <section class="card">${cardTitle('Owner password')}
      <p class="muted">Asked again before the owner pages open, in case the owner leaves the tablet signed in.</p>
      <div class="row2"><label class="field">New password<input class="input big" type="password" id="dp1" autocomplete="new-password"></label>
        <label class="field">Type it again<input class="input big" type="password" id="dp2" autocomplete="new-password"></label></div>
      <button class="btn primary big" data-act="saveDashPw">Change owner password</button></section>

    <section class="card">${cardTitle('Password for editing orders')}
      <p class="muted">${s.editPwOff ? '<b>Off</b> — anyone can edit or void orders.' : '<b>On</b> — needed to edit or void an order. The owner password also works.'}</p>
      <div class="row2"><label class="field">New password<input class="input big" type="password" id="ep1" autocomplete="new-password"></label>
        <label class="field">Type it again<input class="input big" type="password" id="ep2" autocomplete="new-password"></label></div>
      <div class="btn-row"><button class="btn primary big" data-act="saveEditPw">${s.editPwOff ? 'Turn on with this password' : 'Change edit password'}</button>
        ${s.editPwOff ? '' : '<button class="btn big danger-o" data-act="editPwOff">Turn off</button>'}</div></section>

    <section class="card">${cardTitle('Usual prices')}
      <p class="muted">Filled in automatically when you add a new dish. You can still change the price of each dish.</p>
      <div class="grid-fields">${['Breakfast', ...LUNCH_TYPES, 'Merienda'].map(t => nField('pr-' + t, t, s.prices[t])).join('')}</div>
      <h3 class="sub">Rice & container</h3>
      <div class="grid-fields">
        ${nField('adjNo', 'No rice – less (₱)', Math.abs(num(s.adj.noRice)))}
        ${nField('adjHalf', 'Half rice – less (₱)', Math.abs(num(s.adj.halfRice)))}
        ${nField('adjCont', 'Container – add (₱)', num(s.adj.container))}
        ${nField('erFull', 'Extra rice – 1 (₱)', num(s.extraRice.full))}
        ${nField('erHalf', 'Extra rice – ½ (₱)', num(s.extraRice.half))}
      </div>
      <button class="btn primary big" data-act="savePrices">Save prices</button>
      <p class="muted small">Changes apply to new orders only. Past sales stay the same.</p></section>

    <section class="card">${cardTitle('Where data is saved')}
      ${Store.mode === 'local'
        ? '<p><b>Demo mode.</b> Data is saved only on this device. To save in the cloud and use several tablets, set up Firebase (see README.md).</p><button class="btn big danger-o" data-act="eraseDemo">Erase all demo data</button>'
        : `<p>Saving to the cloud (Firebase). Signed in as <b>${esc(Store.email())}</b>.</p>`}
    </section>
  </div>`;
}

function saveSettings(patch, msg) {
  S.settings = { ...S.settings, ...patch };
  Store.set('settings', 'main', S.settings);
  toast(msg || 'Saved');
  renderBrand();
  refresh(['settings']);
}

async function changePassword(id1, id2, field, msg, extra) {
  const a = $('#' + id1).value, b = $('#' + id2).value;
  if (a.length < 4) { toast('Password must be at least 4 characters.'); return; }
  if (a !== b) { toast('The two passwords do not match. Please type again.'); return; }
  saveSettings({ [field]: await hashPw(a), ...(extra || {}) }, msg);
}

function savePrices() {
  const prices = {};
  ['Breakfast', ...LUNCH_TYPES, 'Merienda'].forEach(t => { const v = $('#pr-' + t).value.trim(); prices[t] = v === '' ? '' : num(v); });
  saveSettings({
    prices,
    adj: { noRice: -Math.abs(num($('#adjNo').value)), halfRice: -Math.abs(num($('#adjHalf').value)), container: Math.abs(num($('#adjCont').value)) },
    extraRice: { full: num($('#erFull').value), half: num($('#erHalf').value) },
  }, 'Prices saved');
}

function saveIncentives() {
  const checked = $('input[name="incPeriod"]:checked');
  const byRating = {};
  [1, 2, 3, 4, 5].forEach(v => { byRating[v] = Math.abs(num($('#inc' + v).value)); });
  saveSettings({
    incentives: {
      period: checked ? checked.value : 'off', byRating,
      salesGoal: Math.abs(num($('#incGoal').value)), salesBonus: Math.abs(num($('#incBonus').value)), lateDeduct: Math.abs(num($('#incLate').value)),
    },
  }, 'Incentives saved');
}

function saveSupplyRules() {
  saveSettings({
    supplyRules: { meals: $$('input[name="supMeal"]:checked').map(x => x.value), modes: $$('input[name="supMode"]:checked').map(x => x.value) },
    expiryWarnDays: Math.max(1, Math.round(num($('#expWarn').value)) || 7),
  }, 'Inventory settings saved');
}

/* =========================================================
   ACCOUNTS (owner only)
   ========================================================= */
const accessText = u => u.role === 'owner' ? 'Everything' : (ROLES[u.role] || u.access || []).map(v => VIEWS[v] ? VIEWS[v].title : v).join(', ') || 'Nothing';

function renderAccounts() {
  const cloudOwner = Store.mode === 'cloud' && S.me.isOwner && !S.users.some(u => u.id === S.me.uid);
  const row = u => `<div class="acc-row ${u.active === false ? 'off' : ''}">
    <div class="mr-info"><b>${esc(u.name || u.username)}</b><small>Username: ${esc(u.username)} · ${esc(accessText(u))}</small></div>
    <span class="tag">${ROLE_LABEL[u.role] || 'Custom'}${u.active === false ? ' · Off' : ''}</span>
    ${u.role === 'owner' ? '' : `<button class="btn sm" data-act="accEdit" data-id="${u.id}">Edit access</button>
      <button class="btn sm ${u.active === false ? '' : 'danger-o'}" data-act="accToggle" data-id="${u.id}">${u.active === false ? 'Turn on' : 'Turn off'}</button>`}
    ${Store.mode === 'local' ? `<button class="btn sm" data-act="accPw" data-id="${u.id}">Reset password</button>` : ''}</div>`;
  return `<div class="page narrow">
    <div class="page-head"><div><h1>Accounts</h1><p class="muted">Give each person their own username and password.</p></div>
      <button class="btn primary big" data-act="accAdd">Add account</button></div>
    <section class="card">
      ${cloudOwner ? `<div class="acc-row"><div class="mr-info"><b>Owner (you)</b><small>${esc(Store.email())} · Everything</small></div><span class="tag">Owner</span></div>` : ''}
      ${S.users.map(row).join('') || (cloudOwner ? '' : '<p class="muted">No accounts yet.</p>')}
    </section>
    <section class="card">${cardTitle('What each role can open')}
      <p><b>Cashier</b> — Take Order, Today's Menu, Orders & Sales.</p>
      <p><b>Staff</b> — Inventory (including the end of day report).</p>
      <p><b>Custom</b> — you choose the pages.</p>
      <p><b>Owner</b> — everything.</p>
      ${Store.mode === 'cloud' ? '<p class="muted small">Forgot password? Turn the old account off and make a new one (Firebase does not let the app reset other people\'s passwords).</p>' : ''}
    </section>
  </div>`;
}

function openAccountForm(user) {
  const isNew = !user;
  const st = user ? { ...user, access: [...(user.access || ROLES[user.role] || [])] } : { name: '', username: '', password: '', role: 'cashier', access: [] };
  const pages = ALL_VIEWS.filter(v => !VIEWS[v].ownerOnly);
  const draw = () => `
    <label class="field">Name<input class="input big" id="aName" value="${esc(st.name)}" autocomplete="off" placeholder="e.g. Ana"></label>
    ${isNew ? `<div class="row2"><label class="field">Username<input class="input big" id="aUser" value="${esc(st.username)}" autocomplete="off" autocapitalize="none" placeholder="e.g. ana"></label>
      <label class="field">Password (at least 6 characters)<input class="input big" id="aPw" type="text" value="${esc(st.password)}" autocomplete="off"></label></div>` : `<p class="muted">Username: <b>${esc(user.username)}</b></p>`}
    <div class="opt-label">Role</div>
    <div class="seg">${[['cashier', 'Cashier'], ['staff', 'Staff'], ['custom', 'Custom']].map(([k, l]) => `<button class="seg-btn ${st.role === k ? 'on' : ''}" data-m="role" data-v="${k}">${l}</button>`).join('')}</div>
    ${st.role === 'custom'
      ? `<div class="opt-label">Pages this person can open</div><div class="radios">${pages.map(v => `<label class="radio"><input type="checkbox" data-page="${v}" ${st.access.includes(v) ? 'checked' : ''}> ${VIEWS[v].title}</label>`).join('')}</div>`
      : `<p class="muted">Can open: ${esc((ROLES[st.role] || []).map(v => VIEWS[v].title).join(', '))}</p>`}
    <p class="err" id="aErr"></p>
    <div class="modal-actions"><button class="btn big" data-m="close">Cancel</button><button class="btn primary big" data-m="save">${isNew ? 'Create account' : 'Save'}</button></div>`;
  openModal({
    title: isNew ? 'Add account' : `Edit ${user.name || user.username}`, html: draw(),
    onMount(m) {
      m.el.addEventListener('input', e => {
        if (e.target.id === 'aName') st.name = e.target.value;
        if (e.target.id === 'aUser') st.username = e.target.value;
        if (e.target.id === 'aPw') st.password = e.target.value;
      });
      m.el.addEventListener('change', e => {
        const p = e.target.dataset.page; if (!p) return;
        st.access = e.target.checked ? [...new Set([...st.access, p])] : st.access.filter(x => x !== p);
      });
      m.el.addEventListener('click', async e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const err = t => { $('#aErr', m.el).textContent = t; };
        if (b.dataset.m === 'role') { st.role = b.dataset.v; m.set(draw()); return; }
        if (b.dataset.m !== 'save') return;
        const name = String(st.name || '').trim();
        if (!name) return err('Please type the name.');
        const access = st.role === 'custom' ? st.access : ROLES[st.role];
        if (!access.length) return err('Choose at least one page.');
        if (!isNew) {
          Store.set('users', user.id, { ...user, name, role: st.role, access, updatedAt: Date.now() });
          m.close(); toast(`${name} saved`); return;
        }
        const username = String(st.username || '').trim().toLowerCase();
        if (!/^[a-z0-9._-]{3,30}$/.test(username)) return err('Username: at least 3 letters or numbers, no spaces.');
        if (String(st.password).length < 6) return err('Password must be at least 6 characters.');
        b.disabled = true; b.textContent = 'Creating…';
        try {
          const newId = await Store.createAccount(username, st.password);
          const doc = { name, username, role: st.role, access, active: true, createdAt: Date.now() };
          if (Store.mode === 'local') doc.pwHash = await hashPw(st.password);
          Store.set('users', newId, doc);
          m.close();
          toast(`Account created. ${name} signs in with “${username}”.`, { ms: 6000 });
        } catch (ex) {
          b.disabled = false; b.textContent = 'Create account';
          err(ex && ex.code === 'auth/email-already-in-use' ? 'That username is already taken.' : 'Could not create the account: ' + ((ex && (ex.code || ex.message)) || 'unknown'));
        }
      });
    },
  });
}

function toggleAccount(id) {
  const u = S.users.find(x => x.id === id); if (!u) return;
  const on = u.active === false;
  confirmBox(on ? `Turn on ${u.name}?` : `Turn off ${u.name}?`, on ? 'They will be able to sign in again.' : 'They will not be able to use the app anymore.', on ? 'Turn on' : 'Turn off',
    () => Store.update('users', id, { active: on }), !on);
}

function openResetPassword(u) {
  if (!u) return;
  openModal({
    title: `New password – ${u.name || u.username}`,
    html: `<label class="field">New password (at least 6 characters)<input class="input big" id="rp" type="text" autocomplete="off"></label><p class="err" id="rpErr"></p>
      <div class="modal-actions"><button class="btn big" data-m="close">Cancel</button><button class="btn primary big" data-m="ok">Save</button></div>`,
    onMount(m) {
      m.el.addEventListener('click', async e => {
        if (!e.target.closest('[data-m="ok"]')) return;
        const v = $('#rp', m.el).value;
        if (v.length < 6) { $('#rpErr', m.el).textContent = 'At least 6 characters.'; return; }
        Store.update('users', u.id, { pwHash: await hashPw(v) });
        m.close(); toast('Password changed');
      });
    },
  });
}

boot();
