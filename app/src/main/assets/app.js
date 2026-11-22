'use strict';
/* C4 B7 Teşhis (1.2 PureTech · EAT6) — kokpit arayüzü, özel canlı veri tabloları ve araç haritası */
const P = window.PSA;
const N = window.Native || {
  // Tarayıcıda önizleme için boş köprü
  hasBtPermission: () => true, requestBtPermission() {}, btAvailable: () => false, btEnabled: () => false,
  btEnable() {}, openBtSettings() {}, openAppSettings() {}, btBonded: () => '[]', btScan() {}, btConnect() {},
  btSend() {}, btDisconnect() {}, btConnected: () => false, keepScreenOn() {}, setBarColor() {},
  exportFile(n, c) { console.log(n, c); }, shareText(t) { console.log(t); }, version: () => 'önizleme'
};
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const THEMES = [
  { id: 'ice-blue', name: 'Buz Mavisi', dot: '#38C7F4', bar: '#0C121B' },
  { id: 'ice-white', name: 'Buz Beyazı', dot: '#E2E8F0', bar: '#111419' },
  { id: 'sapphire', name: 'Derin Safir', dot: '#5B9BFF', bar: '#0A1022' },
  { id: 'amber', name: 'Kehribar', dot: '#F5A623', bar: '#14161A' }
];

const MAINT_DEF = [
  { id: 'yag', name: 'Motor yağı & filtre', rec: '10.000 km · 0W-30 B71 2312', warnKm: 10000 },
  { id: 'triger', name: 'Yağlı triger kayışı', rec: '60.000 km / 5 yıl (PureTech)', warnKm: 60000 },
  { id: 'buji', name: 'İridyum bujiler', rec: '30.000 km (3 silindir)', warnKm: 30000 },
  { id: 'eat6', name: 'EAT6 şanzıman yağı', rec: '60.000 km · Aisin AW-1', warnKm: 60000 },
  { id: 'filtre', name: 'Hava & polen filtresi', rec: '15.000 km · Yıllık bakım', warnKm: 15000 },
  { id: 'aku', name: 'Akü (EFB / AGM)', rec: 'Start-Stop uyumlu akü', warnKm: 0 }
];

const S = {
  view: 'baglan', conn: false, demo: false, state: 'off', stateText: 'Bağlı değil',
  theme: load('psa_theme', 'ice-blue'),
  elm: null, sim: null, init: null, busy: false, scan: null, prog: null,
  arizaFilter: 'all',
  live: {
    on: false, sup: null, tcuSup: null, vals: {}, sel: [], custom: [],
    tables: [], activeTable: 'hararet', mode: 'kokpit', loop: 0, inited: false
  },
  scanList: [], scanning: false, log: [],
  reports: load('psa_reports', []), km: load('psa_km', ''), devName: '',
  maint: load('psa_maint', {})
};

function load(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* yer yok */ } }

/* ---------- C4 B7 Kadran Teması ---------- */
function applyTheme(id, silent) {
  const th = THEMES.find(t => t.id === id) || THEMES[0];
  S.theme = th.id;
  document.documentElement.dataset.theme = th.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', th.bar);
  try { if (N.setBarColor) N.setBarColor(th.bar); } catch (e) { /* */ }
  save('psa_theme', th.id);
  if (!silent) toast('C4 B7 kadran rengi: ' + th.name, 1700);
}
function setTheme(id) { applyTheme(id); if (S.view === 'baglan') render(); }
function cycleTheme() {
  const i = THEMES.findIndex(t => t.id === S.theme);
  const next = THEMES[(i + 1) % THEMES.length];
  applyTheme(next.id);
  if (S.view === 'baglan') render();
}
applyTheme(S.theme, true);

/* ---------- Toast & Modal ---------- */
function toast(t, ms) {
  const el = $('#toast'); el.textContent = t; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, ms || 2600);
}

let modalResolve = null;
function closeModal(val) {
  $('#modal').hidden = true;
  if (modalResolve) { const r = modalResolve; modalResolve = null; r(val === undefined ? false : val); }
}
$('#modal').addEventListener('click', e => { if (e.target === $('#modal')) closeModal(false); });

function modal(title, html, btns) {
  if (modalResolve) closeModal(false);
  return new Promise(res => {
    modalResolve = res;
    $('#mTitle').textContent = title;
    $('#mBody').innerHTML = html;
    const b = $('#mBtns'); b.innerHTML = '';
    (btns || [{ t: 'Tamam', v: true, cls: 'pri' }]).forEach(x => {
      const e = document.createElement('button');
      e.type = 'button';
      e.className = 'btn ' + (x.cls || '');
      e.textContent = x.t;
      e.onclick = () => {
        if (x.onClick && x.onClick() === false) return;
        closeModal(x.v);
      };
      b.appendChild(e);
    });
    $('#modal').hidden = false;
  });
}
const ask = (title, html, yes, cls) => modal(title, html, [{ t: 'Vazgeç', v: false }, { t: yes || 'Evet', v: true, cls: cls || 'pri' }]);
window.onBack = () => {
  if (!$('#modal').hidden) { closeModal(false); return true; }
  if (S.view !== 'baglan') { go('baglan'); return true; }
  return false;
};

/* ---------- SVG İkonlar ---------- */
const ICO = {
  phone: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
  obd: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h2M11 10h2M15 10h2M7 14h2M11 14h2M15 14h2"/></svg>',
  car: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14v-5l-2.3-4.6A2 2 0 0 0 14.9 6H9.1a2 2 0 0 0-1.8 1.4L5 12v5z"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
};

const ECU_ICO = {
  motor: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10V7h10v3h2l2 2v5h-3l-2 2H8l-2-2H3v-5l2-2h2z"/><path d="M9 4h6M12 4v3"/></svg>',
  sanziman: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><path d="M6 8v8M12 8v8M18 8v4H6"/></svg>',
  abs: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M4.2 7A10 10 0 0 0 4.2 17M19.8 7a10 10 0 0 1 0 10"/></svg>',
  airbag: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="6" r="2.2"/><circle cx="8" cy="11" r="3.5"/><path d="M16 10l-3 5h5l1 5"/><path d="M13 15l-2 4"/></svg>',
  bsi: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>',
  gosterge: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16a9 9 0 1 1 18 0"/><path d="M12 16l4-5"/><circle cx="12" cy="16" r="1.5"/></svg>',
  direksiyon: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M4 11h5.5M14.5 11H20M12 14.5V21"/></svg>',
  park: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18V6h5a4 4 0 0 1 0 8H5"/><path d="M16 9a5 5 0 0 1 0 6M19 6.5a8.5 8.5 0 0 1 0 11"/></svg>',
  klima: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M5 5l14 14M19 5L5 19"/></svg>',
  radyo: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  ekran: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="18" x2="12" y2="21"/></svg>',
  multimedya: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>'
};

/* ---------- Log ---------- */
function ts() { const d = new Date(); return d.toTimeString().slice(0, 8); }
function addLog(dir, text) {
  const entry = { t: ts(), d: dir, txt: String(text) };
  S.log.push(entry);
  if (S.log.length > 1500) S.log.splice(0, S.log.length - 1500);
  if (S.view === 'log') {
    const box = $('#term');
    if (box) {
      if (box.dataset.empty) { box.innerHTML = ''; delete box.dataset.empty; }
      box.insertAdjacentHTML('beforeend', logLineHtml(entry));
      box.scrollTop = box.scrollHeight;
    }
  }
}
function logText() { return S.log.map(x => x.t + ' ' + x.d + ' ' + x.txt).join('\n'); }
function logLineHtml(x) {
  const cls = x.d === '>' ? 'tx' : x.d === '<' ? 'rx' : x.d === '!' ? 'er' : 'in';
  return '<div class="term-line ' + cls + '">' + esc(x.t + ' ' + x.d + ' ' + x.txt) + '</div>';
}

function setState(state, text) {
  S.state = state; S.stateText = text;
  $('#led').className = 'led ' + (state === 'on' ? 'on' : state === 'busy' ? 'busy' : '');
  $('#connText').textContent = text;
}

/* ---------- Bağlantı ---------- */
function makeElm(sendFn) { S.elm = new P.Elm(sendFn, addLog); }

async function afterConnect() {
  setState('busy', 'Adaptör hazırlanıyor…');
  render();
  const r = await S.elm.init(t => { setState('busy', t); });
  S.init = r;
  if (!r.ok) {
    setState('off', 'Adaptör cevap vermiyor');
    modal('Adaptör cevap vermiyor', esc(r.msg));
  } else {
    setState('on', (S.demo ? 'Demo · ' : '') + (r.carOk ? 'C4 B7 bağlı' : 'Adaptör bağlı'));
    if (!r.carOk) toast('Araç cevap vermedi. Kontağı açıp "Tekrar dene"ye bas.', 4000);
  }
  render();
}

function connectDevice(addr, name, ble) {
  if (!N.hasBtPermission()) { N.requestBtPermission(); return; }
  stopLive();
  if (S.elm) S.elm.flush();
  S.demo = false; S.sim = null; S.devName = name;
  S.live.sup = null; S.live.tcuSup = null;
  makeElm(c => N.btSend(c));
  setState('busy', name + ' bağlanıyor…');
  addLog('#', 'Bağlanılıyor: ' + name + ' (' + addr + ')' + (ble ? ' BLE' : ''));
  N.btConnect(addr, !!ble);
  render();
}

function startDemo() {
  stopLive();
  if (S.conn && !S.demo) N.btDisconnect();
  if (S.elm) S.elm.flush();
  S.demo = true; S.conn = true; S.devName = 'C4 B7 Demo';
  S.live.sup = null; S.live.tcuSup = null;
  S.sim = new P.SimElm(t => S.elm && S.elm.onData(t));
  makeElm(c => S.sim.send(c));
  addLog('#', 'Demo modu başladı (C4 B7 simülasyonu)');
  afterConnect();
}

function disconnect() {
  stopLive();
  if (S.elm) S.elm.flush();
  if (!S.demo) N.btDisconnect();
  S.conn = false; S.demo = false; S.init = null; S.elm = null; S.sim = null;
  S.live.sup = null; S.live.tcuSup = null;
  setState('off', 'Bağlı değil');
  render();
}

window.NativeCb = (ev, p) => {
  if (ev === 'obd') { if (S.elm && !S.demo) S.elm.onData(p); return; }
  if (ev === 'btConnected') { S.conn = true; addLog('#', 'Bluetooth bağlandı (' + p + ')'); afterConnect(); return; }
  if (ev === 'btDisconnected') {
    if (S.demo) return;
    stopLive(); if (S.elm) S.elm.flush();
    S.conn = false; S.init = null; setState('off', 'Bağlantı koptu');
    addLog('#', 'Bağlantı kapandı (' + p + ')');
    if (p !== 'user') toast('Bluetooth bağlantısı koptu');
    render(); return;
  }
  if (ev === 'btError') { addLog('!', p); if (!S.conn) setState('off', 'Bağlanamadı'); toast(p, 4000); render(); return; }
  if (ev === 'scan') { try { const d = JSON.parse(p); if (!S.scanList.some(x => x.address === d.address)) S.scanList.push(d); } catch (e) { /* */ } if (S.view === 'baglan') render(); return; }
  if (ev === 'scanDone') { S.scanning = false; if (S.view === 'baglan') render(); return; }
  if (ev === 'perm') { if (p === 'bt:ok') toast('Bluetooth izni verildi'); else toast('Bluetooth izni verilmedi', 3500); render(); return; }
  if (ev === 'file') { if (p === 'exported') toast('Dosya kaydedildi'); else if (p.startsWith('error')) toast('Kaydedilemedi: ' + p.slice(6)); }
};

/* ---------- Sekmeler ---------- */
function go(v) {
  if (v !== 'canli') stopLive();
  S.view = v;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  render();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tabs button').forEach(b => { b.onclick = () => go(b.dataset.v); });

function render() {
  const v = S.view;
  const html = v === 'baglan' ? vBaglan() : v === 'ariza' ? vAriza() : v === 'canli' ? vCanli() : v === 'rapor' ? vRapor() : vLog();
  $('#view').innerHTML = html;
  if (v === 'log') { const t = $('#term'); if (t) t.scrollTop = t.scrollHeight; }
}

// Güvenli olay delegasyonu (cihaz adındaki tırnak vb. karakterleri bozmaz)
document.addEventListener('click', e => {
  const connBtn = e.target.closest('[data-conn-addr]');
  if (connBtn) {
    connectDevice(connBtn.dataset.connAddr, connBtn.dataset.connName || 'OBD', connBtn.dataset.connBle === '1');
    return;
  }
  const node = e.target.closest('[data-jump-ecu]');
  if (node) {
    const id = node.dataset.jumpEcu;
    const el = document.getElementById('ecu_' + id);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    S.arizaFilter = 'all'; render();
    const el2 = document.getElementById('ecu_' + id);
    if (el2) el2.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else toast('Bu beyin son taramada cevap vermedi');
  }
});

/* ---------- Bağlan ---------- */
function parseVoltage(vStr) {
  const m = String(vStr || '').replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!isFinite(v)) return null;
  let pct = Math.max(5, Math.min(100, Math.round((v - 11.0) / 3.8 * 100)));
  let color = 'var(--green)', label = 'İyi (kontak)';
  if (v < 11.9) { color = 'var(--red)'; label = 'Düşük!'; }
  else if (v < 12.3) { color = 'var(--orange)'; label = 'Zayıf'; }
  else if (v >= 13.3 && v <= 14.8) { color = 'var(--acc)'; label = 'Şarj ediyor'; }
  else if (v > 14.8) { color = 'var(--red)'; label = 'Yüksek!'; }
  return { v, pct, color, label };
}

function vBaglan() {
  const r = S.init;
  const btOk = S.demo || (N.btAvailable() && N.hasBtPermission() && N.btEnabled());
  const adSt = S.conn && r && r.ok ? 'ok' : S.state === 'busy' ? 'busy' : (S.conn ? 'warn' : '');
  const carSt = S.conn && r && r.carOk ? 'ok' : S.state === 'busy' ? 'busy' : (S.conn && r ? 'warn' : '');

  let h = '<div class="card hero">' +
    '<div class="card-head"><h2>Citroën C4 B7 Bağlantı</h2>' +
    (S.demo ? '<span class="pill acc">DEMO</span>' : (S.conn && r && r.carOk ? '<span class="pill ok">HAZIR</span>' : '<span class="pill">1.2 PureTech · EAT6</span>')) +
    '</div>' +
    '<div class="link-chain">' +
      '<div class="lc-node ' + (btOk ? 'ok' : '') + '"><div class="lc-ico">' + ICO.phone + '</div><div class="lc-lbl">Telefon</div><div class="lc-sub">' + (S.demo ? 'Simülasyon' : btOk ? 'BT açık' : 'BT kapalı') + '</div></div>' +
      '<div class="lc-wire ' + (S.conn ? 'ok' : S.state === 'busy' ? 'busy' : '') + '"></div>' +
      '<div class="lc-node ' + adSt + '"><div class="lc-ico">' + ICO.obd + '</div><div class="lc-lbl">ELM327</div><div class="lc-sub">' + (r && r.version ? esc(r.version.replace(/ELM327\s*/i, '')) : (S.state === 'busy' ? 'Bağlanıyor' : 'Bekliyor')) + '</div></div>' +
      '<div class="lc-wire ' + (carSt === 'ok' ? 'ok' : S.state === 'busy' ? 'busy' : '') + '"></div>' +
      '<div class="lc-node ' + carSt + '"><div class="lc-ico">' + ICO.car + '</div><div class="lc-lbl">C4 B7 ECU</div><div class="lc-sub">' + (carSt === 'ok' ? 'CAN aktif' : carSt === 'warn' ? 'Kontak?' : 'Bekliyor') + '</div></div>' +
    '</div>';

  if (S.conn && r) {
    const vb = parseVoltage(r.voltage);
    h += '<div class="stat-grid">' +
      '<div class="stat-box"><div class="stat-k">Bağlı Cihaz</div><div class="stat-v">' + esc(S.devName) + '</div><div class="mute small">' + esc(r.version || 'ELM327') + '</div></div>' +
      '<div class="stat-box"><div class="stat-k">Akü Voltajı</div><div class="stat-v">' + esc(r.voltage || '?') + (vb ? ' <span class="pill" style="color:' + vb.color + '">' + vb.label + '</span>' : '') + '</div>' +
        (vb ? '<div class="volt-bar"><div style="width:' + vb.pct + '%;background:' + vb.color + '"></div></div>' : '') + '</div>' +
      '<div class="stat-box"><div class="stat-k">Araç İletişimi</div><div class="stat-v" style="color:' + (r.carOk ? 'var(--green)' : 'var(--orange)') + '">' + (r.carOk ? 'Cevap veriyor ✓' : 'Cevap yok') + '</div><div class="mute small">CAN 500 kbit · 11-bit</div></div>' +
      '<div class="stat-box"><div class="stat-k">PSA Akış Kontrolü</div><div class="stat-v" style="color:' + (r.fcOk ? 'var(--green)' : 'var(--orange)') + '">' + (r.fcOk ? 'Destekleniyor ✓' : 'Sınırlı') + '</div><div class="mute small">ISO-TP çok çerçeve</div></div>' +
    '</div>';
    if (!r.fcOk) h += '<div class="warn">Bu adaptör akış kontrolü komutlarını (AT FC) desteklemiyor. Çok kodlu beyinlerde liste eksik gelebilir. Kaliteli adaptör (Vgate iCar Pro, OBDLink) önerilir.</div>';
    if (!r.headers) h += '<div class="warn">Adaptör başlık gösterimini (AT H1) kabul etmedi. Sonuç güvenilir olmayabilir.</div>';
    h += '<div class="row" style="margin-top:10px">' +
      (r.carOk
        ? '<button class="btn pri sp" type="button" onclick="go(\'ariza\')">Arızaları Tara</button><button class="btn soft sp" type="button" onclick="go(\'canli\')">Canlı Kokpit</button>'
        : '<button class="btn pri sp" type="button" onclick="afterConnect()">Tekrar Dene</button>') +
      '<button class="btn red" type="button" onclick="disconnect()">Kes</button></div>';
  } else {
    h += '<div class="mute" style="text-align:center">' + esc(S.stateText) + '</div>';
  }
  h += '</div>';

  // C4 B7 Kadran Rengi Kartı
  h += '<div class="card"><div class="card-head"><h2>C4 B7 Kadran Rengi</h2><span class="mute small">Gösterge ambiyansı</span></div>' +
    '<div class="theme-strip">' +
    THEMES.map(t => '<button type="button" class="t-chip' + (S.theme === t.id ? ' on' : '') + '" onclick="setTheme(\'' + t.id + '\')"><span class="t-dot" style="background:' + t.dot + '"></span><span>' + t.name + '</span></button>').join('') +
    '</div></div>';

  if (!S.conn || !r) {
    h += '<div class="card"><h2>Adaptöre Bağlan</h2>';
    if (!N.btAvailable()) h += '<div class="warn">Bu cihazda Bluetooth bulunamadı. Aşağıdan Demo modunu deneyebilirsin.</div>';
    else if (!N.hasBtPermission()) h += '<div class="info">Adaptöre bağlanmak için Bluetooth izni gerekiyor.</div><button class="btn pri big" type="button" onclick="N.requestBtPermission()">Bluetooth İzni Ver</button>';
    else if (!N.btEnabled()) h += '<div class="info">Bluetooth kapalı.</div><button class="btn pri big" type="button" onclick="N.btEnable()">Bluetooth\'u Aç</button>';
    else {
      let dev = [];
      try { dev = JSON.parse(N.btBonded() || '[]'); } catch (e) { dev = []; }
      const isObd = n => /obd|elm|v-?link|vgate|icar|scan|konnwei|carista/i.test(String(n || ''));
      dev.sort((a, b) => (isObd(b.name) ? 1 : 0) - (isObd(a.name) ? 1 : 0));
      h += '<div class="mute small" style="margin-bottom:8px">Eşleşmiş cihazlar (klasik Bluetooth OBD adaptörleri):</div><div class="list">';
      if (!dev.length) h += '<div class="item mute">Eşleşmiş cihaz yok.</div>';
      dev.forEach(d => {
        const likely = isObd(d.name);
        h += '<div class="item' + (likely ? ' obd-hl' : '') + '"><div class="sp"><div><b>' + esc(d.name) + '</b>' + (likely ? ' <span class="pill acc">OBD</span>' : '') + '</div><div class="mute small mono">' + esc(d.address) + '</div></div>' +
          '<button type="button" class="btn sm ' + (likely ? 'pri' : '') + '" data-conn-addr="' + esc(d.address) + '" data-conn-name="' + esc(d.name) + '" data-conn-ble="0">Bağlan</button></div>';
      });
      h += '</div><div class="row" style="margin-top:10px"><button type="button" class="btn sm sp" onclick="N.openBtSettings()">Bluetooth Ayarları</button>' +
        '<button type="button" class="btn sm soft sp" onclick="bleScan()">' + (S.scanning ? 'BLE taranıyor…' : 'BLE Adaptör Tara') + '</button></div>';
      if (S.scanList.length) {
        h += '<div class="list" style="margin-top:8px">';
        S.scanList.forEach(d => {
          h += '<div class="item"><div class="sp"><div><b>' + esc(d.name) + '</b> <span class="pill acc">BLE</span></div><div class="mute small mono">' + esc(d.address) + '</div></div>' +
            '<button type="button" class="btn sm pri" data-conn-addr="' + esc(d.address) + '" data-conn-name="' + esc(d.name) + '" data-conn-ble="1">Bağlan</button></div>';
        });
        h += '</div>';
      }
    }
    h += '<div class="info" style="margin-top:10px"><b>C4 B7 İpucu:</b> OBD soketi orta konsol altındaki küllük/eşya gözünün kapağı arkasındadır. Adaptörü takıp kontağı açın (BT şifresi genelde 1234 veya 0000).</div>';
    h += '<button type="button" class="btn soft big" style="margin-top:4px" onclick="startDemo()">C4 B7 Demo Modunu Başlat</button></div>';
  }
  h += '<div class="mute small" style="text-align:center;margin-top:4px">C4 B7 Teşhis · Sürüm ' + esc(N.version()) + '</div>';
  return h;
}

function bleScan() {
  if (!N.hasBtPermission()) { N.requestBtPermission(); return; }
  S.scanList = []; S.scanning = true; N.btScan(); render();
}

/* ---------- Arızalar ---------- */
function ready() {
  if (!S.conn || !S.elm || !S.init || !S.init.ok) { toast('Önce adaptöre bağlan'); go('baglan'); return false; }
  if (S.busy) { toast('Bir işlem sürüyor, bekle'); return false; }
  return true;
}

function setProg(p, text) {
  S.prog = { p, text };
  if (S.view !== 'ariza') return;
  const bar = $('#scanProgBar'), txt = $('#scanProgTxt');
  if (bar && txt) {
    bar.style.width = Math.round(p * 100) + '%';
    txt.textContent = text;
  } else {
    render();
  }
}

async function fullScan() {
  if (!ready()) return;
  stopLive();
  S.busy = true; N.keepScreenOn(true);
  const km = ($('#km') && $('#km').value.trim()) || S.km;
  S.km = km; save('psa_km', km);
  S.prog = { p: 0, text: 'Başlatılıyor…' };
  render();
  const res = { date: Date.now(), km, demo: S.demo, adapter: S.init.version, voltage: S.init.voltage, fcOk: S.init.fcOk, vin: '', mil: null, ecus: [], obd: null };
  const steps = P.ECUS.length + 3;
  let n = 0;
  try {
    setProg(0.05, 'Şase numarası okunuyor…');
    res.vin = await P.readVin(S.elm);
    res.mil = await P.readMil(S.elm);
    setProg(++n / steps, 'Standart OBD kodları okunuyor…');
    res.obd = await P.readObdCodes(S.elm);
    n++;
    for (const e of P.ECUS) {
      setProg(n / steps, e.name + ' taranıyor…');
      const r = await P.readEcu(S.elm, e);
      res.ecus.push(r);
      S.scan = res;
      n++;
    }
    setProg(1, 'Tarama tamamlandı');
    res.psaBlocked = P.psaBlocked(res);
    S.scan = res;
    saveReport(res);
    const tot = res.ecus.reduce((a, e) => a + e.dtcs.length, 0);
    toast(res.psaBlocked ? 'PSA beyinlerine ulaşılamadı (pin 3/8)' : tot ? tot + ' arıza kodu bulundu' : 'Tüm taranan beyinler temiz ✓', 3500);
  } catch (e) {
    addLog('!', 'Tarama hatası: ' + e.message);
    toast('Tarama yarıda kaldı: ' + e.message, 4000);
  }
  S.busy = false; S.prog = null; N.keepScreenOn(false);
  render();
}

async function rescanEcu(id) {
  if (!ready()) return;
  const e = P.ECUS.find(x => x.id === id);
  S.busy = true; S.prog = { p: .5, text: e.name + ' okunuyor…' }; render();
  try {
    const r = await P.readEcu(S.elm, e);
    if (S.scan) { const i = S.scan.ecus.findIndex(x => x.id === id); if (i >= 0) S.scan.ecus[i] = r; else S.scan.ecus.push(r); }
  } catch (err) { toast(err.message); }
  S.busy = false; S.prog = null; render();
}

async function clearOne(id) {
  if (!ready() || !S.scan) return;
  const e = P.ECUS.find(x => x.id === id);
  const r = S.scan.ecus.find(x => x.id === id);
  let warn = 'Arıza hafızası silinir. Kodlar raporlara otomatik kaydedildi, istersen ustaya paylaşabilirsin.';
  if (e.critical) warn = '<div class="warn"><b>' + esc(e.name) + '</b> güvenlik sistemidir. Arıza giderilmeden silmek sorunu gizler ve uyarı lambası tekrar yanar.</div>';
  if (!await ask(e.name + ' — kodları sil', warn, 'Sil', 'red')) return;
  S.busy = true; S.prog = { p: .5, text: e.name + ' siliniyor…' }; render();
  try {
    const c = await P.clearEcu(S.elm, e, r && r.proto);
    if (c.ok) toast(e.name + ': silindi'); else toast(e.name + ': silinemedi — ' + c.msg, 4500);
    const again = await P.readEcu(S.elm, e);
    const i = S.scan.ecus.findIndex(x => x.id === id); if (i >= 0) S.scan.ecus[i] = again;
  } catch (err) { toast(err.message); }
  S.busy = false; S.prog = null; render();
}

async function clearAll() {
  if (!ready() || !S.scan) return;
  const withCodes = S.scan.ecus.filter(x => x.dtcs.length);
  if (!withCodes.length && !(S.scan.obd && S.scan.obd.kayitli.length)) { toast('Silinecek kod yok'); return; }
  const crit = withCodes.filter(x => P.ECUS.find(e => e.id === x.id).critical);
  let html = 'Kod bulunan <b>' + withCodes.length + '</b> beynin arıza hafızası silinecek. Mevcut liste raporlarda saklı.';
  if (crit.length) html += '<div class="warn">' + crit.map(x => esc(x.name)).join(', ') + ' güvenlik sistemidir. Onarım yapılmadan silmeyin.</div>';
  if (!await ask('Tüm kodları sil', html, 'Hepsini sil', 'red')) return;
  S.busy = true; S.prog = { p: 0, text: 'Siliniyor…' }; render();
  let i = 0;
  for (const r of withCodes) {
    const e = P.ECUS.find(x => x.id === r.id);
    setProg(i++ / (withCodes.length + 1), e.name + ' siliniyor…');
    const c = await P.clearEcu(S.elm, e, r.proto);
    addLog('#', e.name + ' silme: ' + (c.ok ? 'tamam' : c.msg));
  }
  setProg(.95, 'OBD kodları siliniyor…');
  await P.clearObd(S.elm);
  S.busy = false; S.prog = null;
  toast('Silme bitti, yeniden taranıyor…');
  fullScan();
}

// C4 B7 üstten görünüm interaktif araç ECU haritası
const ECU_POS = {
  motor: [98, 62, 'Motor'],
  sanziman: [62, 68, 'EAT6'],
  abs: [80, 40, 'ABS'],
  direksiyon: [56, 102, 'EPS'],
  gosterge: [56, 122, 'Göst.'],
  bsi: [42, 144, 'BSI'],
  ekran: [80, 114, 'Ekran'],
  klima: [80, 134, 'Klima'],
  radyo: [104, 124, 'Radyo'],
  multimedya: [104, 144, 'Medya'],
  airbag: [80, 166, 'Airbag'],
  park: [80, 224, 'Park']
};

function ecuStatusClass(r) {
  if (!r || !r.present) return 'st-none';
  if (!r.read || r.dtcs.some(d => d.cls === 'aktif')) return 'st-bad';
  if (r.dtcs.length) return 'st-warn';
  return 'st-ok';
}

function carMapSvg(sc) {
  const byId = {};
  (sc.ecus || []).forEach(e => { byId[e.id] = e; });
  let nodes = '';
  Object.keys(ECU_POS).forEach(id => {
    const [x, y, lbl] = ECU_POS[id];
    const r = byId[id];
    const st = ecuStatusClass(r);
    nodes += '<g class="ecu-node ' + st + '" data-jump-ecu="' + id + '">' +
      '<circle class="halo" cx="' + x + '" cy="' + y + '" r="10"/>' +
      '<circle class="core" cx="' + x + '" cy="' + y + '" r="4.8" stroke="#080C12" stroke-width="1.3"/>' +
      '<title>' + esc((r ? r.name : lbl) + (r && r.dtcs.length ? ' (' + r.dtcs.length + ' kod)' : '')) + '</title></g>';
  });
  return '<div class="car-svg-box"><svg viewBox="0 0 160 260" aria-label="Citroën C4 B7 beyin haritası">' +
    // C4 B7 Hatchback stilize üst gövde
    '<path d="M52,18 C65,10 95,10 108,18 C124,27 132,52 132,82 L133,190 C133,218 124,238 108,244 C95,248 65,248 52,244 C36,238 27,218 27,190 L28,82 C28,52 36,27 52,18 Z" fill="rgba(255,255,255,0.04)" stroke="var(--line-hi)" stroke-width="1.6"/>' +
    // Ön cam & arka cam
    '<path d="M44,86 C60,76 100,76 116,86 L112,114 C98,108 62,108 48,114 Z" fill="rgba(56,199,244,0.08)" stroke="var(--line)" stroke-width="1"/>' +
    '<path d="M48,194 C62,200 98,200 112,194 L115,216 C98,224 62,224 45,216 Z" fill="rgba(56,199,244,0.07)" stroke="var(--line)" stroke-width="1"/>' +
    // Kaput & tavan hatları + aynalar
    '<path d="M46,24 L54,78 M114,24 L106,78" stroke="var(--line)" stroke-width="0.9"/>' +
    '<path d="M27,92 L16,97 L18,106 L28,104 M133,92 L144,97 L142,106 L132,104" fill="none" stroke="var(--line-hi)" stroke-width="1.3"/>' +
    // Tekerlek yuvaları
    '<rect x="21" y="42" width="6" height="34" rx="3" fill="var(--line-hi)" opacity=".45"/>' +
    '<rect x="133" y="42" width="6" height="34" rx="3" fill="var(--line-hi)" opacity=".45"/>' +
    '<rect x="21" y="182" width="6" height="34" rx="3" fill="var(--line-hi)" opacity=".45"/>' +
    '<rect x="133" y="182" width="6" height="34" rx="3" fill="var(--line-hi)" opacity=".45"/>' +
    // Çift çavuş ön izi
    '<path d="M72,22 L80,17 L88,22 M72,27 L80,22 L88,27" fill="none" stroke="var(--acc)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>' +
    nodes + '</svg></div>';
}

function dtcHtml(d) {
  let h = '<div class="dtc ' + d.cls + '"><div><span class="c">' + esc(d.full) + '</span><span class="lbl">' + esc(d.label) + '</span></div>' +
    '<div class="d">' + esc(d.desc) + (d.ftbText ? ' — <i>' + esc(d.ftbText) + '</i>' : '') + '</div>' +
    '<div class="mute small" style="margin-top:3px">Durum ' + esc(d.statusHex) + ': ' + esc(d.flags.join(', ')) + '</div>';
  if (d.hint) h += '<div class="hint"><b>C4 B7 Teşhis İpucu:</b> ' + esc(d.hint) + '</div>';
  return h + '</div>';
}

function ecuHtml(r) {
  const def = P.ECUS.find(x => x.id === r.id) || {};
  let pill;
  if (!r.present) pill = '<span class="pill none">cevap yok</span>';
  else if (!r.read) pill = '<span class="pill bad">okunamadı</span>';
  else if (r.dtcs.length) pill = '<span class="pill bad">' + r.dtcs.length + ' kod</span>';
  else pill = '<span class="pill ok">temiz ✓</span>';

  const hasAct = r.dtcs.some(d => d.cls === 'aktif');
  const cls = 'ecu' + (hasAct ? ' has-aktif' : r.dtcs.length ? ' has-gecmis' : '');
  let h = '<div class="' + cls + '" id="ecu_' + r.id + '"><div class="head">' +
    '<div class="ecu-ico">' + (ECU_ICO[r.id] || ICO.obd) + '</div>' +
    '<div class="sp"><div class="nm">' + esc(r.name) +
    (def.critical ? ' <span class="pill warnp" title="Güvenlik sistemi">' + ICO.shield + '</span>' : '') +
    '</div><div class="mute small">' + esc(r.sub || '') +
    (r.proto ? ' · <span class="mono">' + r.proto + '</span>' : '') + ' · <span class="mono">' + r.tx + '/' + r.rx + '</span></div></div>' +
    pill + '</div>';
  if (r.error && r.present) h += '<div class="warn">' + esc(r.error) + '</div>';
  if (r.partial) h += '<div class="warn">Cevap eksik geldi (çok çerçeveli mesaj tamamlanamadı). Listede olmayan kodlar olabilir.</div>';
  r.dtcs.forEach(d => { h += dtcHtml(d); });
  if (r.present) {
    h += '<div class="row" style="margin-top:9px"><button type="button" class="btn sm" onclick="rescanEcu(\'' + r.id + '\')">Yeniden Oku</button>';
    if (r.dtcs.length) h += '<button type="button" class="btn sm red" onclick="clearOne(\'' + r.id + '\')">Kodları Sil</button>';
    h += '</div>';
  }
  return h + '</div>';
}

function vAriza() {
  let h = '<div class="card hero"><div class="card-head"><h2>Arıza Hafızası Taraması</h2><span class="pill acc">12 Beyin · UDS/KWP</span></div>' +
    '<div class="mute">C4 B7 üzerindeki tüm PSA beyinlerini tarar; standart uygulamaların göremediği geçmiş (kaçak) arızaları ve PureTech/EAT6 ipuçlarını listeler.</div>' +
    '<div class="row" style="margin-top:10px"><input id="km" class="grow" inputmode="numeric" placeholder="Güncel km (rapor için, isteğe bağlı)" value="' + esc(S.km) + '"></div>' +
    '<button type="button" class="btn pri big" style="margin-top:10px" onclick="fullScan()" ' + (S.busy ? 'disabled' : '') + '>' + (S.busy ? 'Taranıyor…' : 'Tam Tarama Başlat') + '</button>';
  if (S.prog) {
    h += '<div class="prog"><div id="scanProgBar" style="width:' + Math.round(S.prog.p * 100) + '%"></div></div>' +
      '<div class="mute small" id="scanProgTxt">' + esc(S.prog.text) + '</div>';
  }
  h += '</div>';

  const sc = S.scan;
  if (!sc) {
    h += '<div class="card mute">Henüz tarama yapılmadı. Kontak açık veya motor çalışır durumdayken "Tam Tarama Başlat"a basabilirsin.</div>';
    return h;
  }

  const all = sc.ecus.flatMap(e => e.dtcs);
  const act = all.filter(d => d.cls === 'aktif').length;
  const past = all.length - act;
  const found = sc.ecus.filter(e => e.present).length;
  const vinInfo = sc.vin && P.decodeVin ? P.decodeVin(sc.vin) : null;

  h += '<div class="card">' +
    (sc.demo ? '<div class="info">Demo simülasyonu — gerçek araç verisi değildir.</div>' : '') +
    (vinInfo ? '<div class="row" style="margin-bottom:8px"><span class="pill acc">' + esc(vinInfo.brand + ' ' + vinInfo.model) + '</span><span class="pill">' + esc(vinInfo.engine) + '</span><span class="pill">' + esc(vinInfo.ecu) + '</span></div>' : '') +
    '<div class="car-map-wrap">' + carMapSvg(sc) +
      '<div class="map-legend">' +
        '<div class="sum-mini r"><span class="mute small">Aktif Arıza</span><b>' + act + '</b></div>' +
        '<div class="sum-mini o"><span class="mute small">Geçmiş / Bekleyen</span><b>' + past + '</b></div>' +
        '<div class="sum-mini g"><span class="mute small">Cevap Veren Beyin</span><b>' + found + '/' + sc.ecus.length + '</b></div>' +
        '<div class="mute small" style="padding:2px 4px">Noktalara dokunup doğrudan o beyne geçebilirsin.</div>' +
      '</div>' +
    '</div>' +
    '<div class="kv" style="margin-top:12px">' +
      (sc.vin ? '<b>Şase No (VIN)</b><span class="mono">' + esc(sc.vin) + '</span>' : '') +
      (sc.mil ? '<b>Arıza Lambası</b><span style="color:' + (sc.mil.mil ? 'var(--red)' : 'var(--green)') + ';font-weight:700">' + (sc.mil.mil ? 'YANIYOR' : 'Kapalı') + ' (OBD: ' + sc.mil.count + ' kod)</span>' : '') +
      '<b>Tarama Tarihi</b><span>' + new Date(sc.date).toLocaleString('tr-TR') + '</span>' +
    '</div>';
  if (!S.busy) h += '<div class="row" style="margin-top:11px"><button type="button" class="btn sm soft" onclick="shareScan()">Raporu Paylaş</button><span class="sp"></span><button type="button" class="btn sm red" onclick="clearAll()">Tüm Kodları Sil</button></div>';
  h += '</div>';

  if (sc.psaBlocked) {
    h += '<div class="card"><h2>PSA Beyinlerine Ulaşılamadı</h2>' +
      '<div class="warn">Araç standart OBD\'ye cevap verdi ama hiçbir PSA üretici beyni cevap vermedi. Bu araçta PSA tanı hattı (Diagbox hattı) OBD soketinin <b>3 ve 8 numaralı pinlerinde</b>; standart ELM327 ise sadece <b>6 ve 14</b>\'e bağlıdır.</div>' +
      '<div class="mute">Çözüm: 3/8 pinlerini 6/14\'e yönlendiren PSA ara kablosu. Not: Canlı veri sekmesinde standart OBD ve <b>7E0/7E1 UDS tarayıcısı</b> ara kablo olmadan da çalışır!</div></div>';
  }

  const order = sc.ecus.slice().sort((a, b) => (b.dtcs.length - a.dtcs.length) || ((b.present ? 1 : 0) - (a.present ? 1 : 0)));
  const present = order.filter(r => r.present);
  const badList = present.filter(r => r.dtcs.length > 0 || !r.read);
  const okList = present.filter(r => r.read && !r.dtcs.length);
  const none = order.filter(r => !r.present);

  const f = S.arizaFilter;
  const shown = f === 'bad' ? badList : f === 'ok' ? okList : f === 'none' ? none : present;

  h += '<div class="card"><div class="card-head"><h2>Beyin Detayları</h2><span class="mute small">' + shown.length + ' modül</span></div>' +
    '<div class="chips" style="margin-bottom:6px">' +
      '<button type="button" class="chip' + (f === 'all' ? ' on' : '') + '" onclick="S.arizaFilter=\'all\';render()">Cevap Verenler (' + present.length + ')</button>' +
      '<button type="button" class="chip' + (f === 'bad' ? ' on' : '') + '" onclick="S.arizaFilter=\'bad\';render()">Arızalı (' + badList.length + ')</button>' +
      '<button type="button" class="chip' + (f === 'ok' ? ' on' : '') + '" onclick="S.arizaFilter=\'ok\';render()">Temiz (' + okList.length + ')</button>' +
      '<button type="button" class="chip' + (f === 'none' ? ' on' : '') + '" onclick="S.arizaFilter=\'none\';render()">Cevap Yok (' + none.length + ')</button>' +
    '</div>';

  if (!shown.length) h += '<div class="mute" style="padding:10px 2px">Bu filtrede beyin yok.</div>';
  shown.forEach(r => { h += ecuHtml(r); });

  if (f === 'all' && none.length) {
    h += '<details><summary>Cevap vermeyen ' + none.length + ' beyin</summary><div class="mute small" style="margin:6px 0">Araçta bu donanım olmayabilir ya da beyin pin 3/8 PSA tanı hattındadır.</div>' +
      '<div class="small">' + none.map(r => esc(r.name)).join(' · ') + '</div></details>';
  }
  h += '</div>';

  if (sc.obd) {
    const o = sc.obd;
    h += '<div class="card"><h2>Standart OBD Kodları</h2><div class="mute small">Genel OBD-II mod 03 / 07 / 0A yanıtı.</div>';
    [['kayitli', 'Kayıtlı (03)'], ['bekleyen', 'Bekleyen (07)'], ['kalici', 'Kalıcı (0A)']].forEach(([k, t]) => {
      h += '<div style="margin-top:8px"><b>' + t + ':</b> ' + (!o[k + 'Ok'] ? '<span class="mute">cevap yok</span>' : !o[k].length ? '<span class="pill ok">temiz</span>' :
        o[k].map(c => '<div class="dtc gecmis" style="margin-top:6px"><span class="c">' + esc(c.code) + '</span> <span class="pill">' + esc(c.src) + '</span><div class="d">' + esc(c.desc) + '</div></div>').join('')) + '</div>';
    });
    h += '</div>';
  }
  return h;
}

/* ---------- Raporlar & C4 B7 Bakım Takibi ---------- */
function reportText(sc) {
  const L = [];
  L.push('Citroën C4 B7 Teşhis Raporu' + (sc.demo ? ' (DEMO)' : ''));
  L.push('Tarih: ' + new Date(sc.date).toLocaleString('tr-TR'));
  if (sc.km) L.push('Km: ' + sc.km);
  if (sc.vin) L.push('Şase no: ' + sc.vin);
  L.push('Adaptör: ' + (sc.adapter || '?') + (sc.voltage ? ', akü ' + sc.voltage : '') + (sc.fcOk ? '' : ', akış kontrolü yok'));
  if (sc.mil) L.push('Arıza lambası: ' + (sc.mil.mil ? 'YANIYOR' : 'kapalı') + ' (OBD kod sayısı ' + sc.mil.count + ')');
  L.push('');
  sc.ecus.filter(e => e.present).forEach(e => {
    L.push('[' + e.name + '] ' + (e.proto || '') + ' — ' + (!e.read ? 'okunamadı' + (e.error ? ': ' + e.error : '') : e.dtcs.length ? e.dtcs.length + ' kod' : 'temiz') + (e.partial ? ' (eksik cevap)' : ''));
    e.dtcs.forEach(d => {
      L.push('  ' + d.full + '  ' + d.label + '  ' + d.desc + (d.ftbText ? ' — ' + d.ftbText : ''));
      L.push('     durum ' + d.statusHex + ': ' + d.flags.join(', '));
    });
  });
  const none = sc.ecus.filter(e => !e.present).map(e => e.name);
  if (none.length) L.push('Cevap vermeyen: ' + none.join(', '));
  if (sc.psaBlocked) L.push('NOT: PSA beyinlerine ulaşılamadı. Tanı hattı OBD pin 3/8, adaptör pin 6/14.');
  if (sc.obd) {
    const f = k => !sc.obd[k + 'Ok'] ? 'cevap yok' : sc.obd[k].length ? sc.obd[k].map(c => c.code).join(', ') : 'yok';
    L.push('');
    L.push('OBD standart — kayıtlı: ' + f('kayitli') + ' | bekleyen: ' + f('bekleyen') + ' | kalıcı: ' + f('kalici'));
  }
  return L.join('\n');
}

function saveReport(sc) {
  if (sc.demo) return;
  S.reports.unshift(JSON.parse(JSON.stringify(sc)));
  if (S.reports.length > 60) S.reports.length = 60;
  save('psa_reports', S.reports);
}

function shareScan() { if (S.scan) N.shareText(reportText(S.scan)); }

function editMaint(id) {
  const def = MAINT_DEF.find(x => x.id === id);
  const cur = S.maint[id] || { km: '', date: '', note: '' };
  modal(def.name,
    '<div class="mute small" style="margin-bottom:8px">Öneri: ' + esc(def.rec) + '</div>' +
    '<label class="small mute">Yapılan km</label><input id="mkKm" class="grow" style="width:100%;margin:4px 0 8px" inputmode="numeric" placeholder="Ör. 95000" value="' + esc(cur.km || '') + '">' +
    '<label class="small mute">Tarih</label><input id="mkDate" class="grow" style="width:100%;margin:4px 0 8px" placeholder="Ör. 11.2026" value="' + esc(cur.date || '') + '">' +
    '<label class="small mute">Not</label><input id="mkNote" class="grow" style="width:100%;margin:4px 0" placeholder="Marka / usta notu" value="' + esc(cur.note || '') + '">',
    [{ t: 'Vazgeç', v: false }, { t: 'Kaydet', v: true, cls: 'pri' }]
  ).then(ok => {
    if (!ok) return;
    S.maint[id] = { km: $('#mkKm').value.trim(), date: $('#mkDate').value.trim(), note: $('#mkNote').value.trim() };
    save('psa_maint', S.maint);
    toast('Bakım kaydı güncellendi');
    render();
  });
}

function vRapor() {
  const curKm = parseInt(String(S.km || '').replace(/\D/g, ''), 10) || 0;
  let h = '<div class="card hero"><div class="card-head"><h2>C4 B7 1.2 PureTech Bakım Takibi</h2><span class="pill acc">Dokun & Kaydet</span></div>' +
    '<div class="mute small">Yağlı triger kayışı, 0W-30 yağ, buji ve EAT6 yağı km kayıtlarını burada tutabilirsin.</div>' +
    '<div class="maint-grid">';
  MAINT_DEF.forEach(m => {
    const rec = S.maint[m.id] || {};
    const mKm = parseInt(String(rec.km || '').replace(/\D/g, ''), 10) || 0;
    const diff = curKm && mKm && curKm >= mKm ? (curKm - mKm) : null;
    const due = diff != null && m.warnKm && diff >= m.warnKm;
    h += '<div class="maint-item" onclick="editMaint(\'' + m.id + '\')" style="' + (due ? 'border-color:rgba(240,82,82,.55)' : '') + '">' +
      '<div class="mt">' + esc(m.name) + '</div>' +
      '<div class="mv">' + (rec.km ? esc(rec.km) + ' km' : '<span class="mute">Girilmedi</span>') + '</div>' +
      '<div class="mute small">' + (diff != null ? (due ? '<span style="color:var(--red);font-weight:700">+' + diff.toLocaleString('tr-TR') + ' km (zamanı!)</span>' : '+' + diff.toLocaleString('tr-TR') + ' km geçti') : esc(rec.date || m.rec)) + '</div>' +
    '</div>';
  });
  h += '</div></div>';

  h += '<div class="card"><h2>Kayıtlı Tarama Raporları</h2><div class="mute">Her tam taramada otomatik kaydedilir (demo hariç). Ustaya göndermek için paylaşabilirsin.</div></div>';
  if (!S.reports.length) return h + '<div class="card mute">Henüz kayıtlı tarama raporu yok.</div>';

  S.reports.forEach((r, i) => {
    const all = r.ecus.flatMap(e => e.dtcs);
    const codes = all.map(d => d.full);
    let diffHtml = '';
    const prev = S.reports[i + 1];
    if (prev) {
      const pSet = new Set(prev.ecus.flatMap(e => e.dtcs).map(d => d.full));
      const cSet = new Set(codes);
      const added = codes.filter(c => !pSet.has(c));
      const fixed = Array.from(pSet).filter(c => !cSet.has(c));
      if (added.length || fixed.length) {
        diffHtml = '<div class="diff-box">' +
          added.slice(0, 4).map(c => '<span class="pill bad">+ ' + esc(c) + '</span>').join('') +
          fixed.slice(0, 4).map(c => '<span class="pill ok">✓ ' + esc(c) + '</span>').join('') +
        '</div>';
      }
    }
    h += '<div class="card"><div class="row"><div class="sp"><h3>' + new Date(r.date).toLocaleString('tr-TR') + '</h3>' +
      '<div class="mute small">' + (r.km ? esc(r.km) + ' km · ' : '') + all.length + ' kod' + (codes.length ? ' · <span class="mono">' + esc(codes.slice(0, 6).join(', ') + (codes.length > 6 ? '…' : '')) + '</span>' : '') + '</div></div>' +
      '<span class="pill ' + (all.length ? 'bad' : 'ok') + '">' + (all.length ? all.length + ' arıza' : 'temiz') + '</span></div>' +
      diffHtml +
      '<details><summary>Tam metin raporu göster</summary><pre class="term" style="margin-top:6px">' + esc(reportText(r)) + '</pre></details>' +
      '<div class="row" style="margin-top:9px"><button type="button" class="btn sm soft" onclick="repShare(' + i + ')">Paylaş</button><button type="button" class="btn sm" onclick="repFile(' + i + ')">Kaydet</button>' +
      '<button type="button" class="btn sm" onclick="repOpen(' + i + ')">Haritada Aç</button><span class="sp"></span><button type="button" class="btn sm red" onclick="repDel(' + i + ')">Sil</button></div></div>';
  });
  return h;
}
function repShare(i) { N.shareText(reportText(S.reports[i])); }
function repFile(i) {
  const r = S.reports[i]; const d = new Date(r.date);
  const nm = 'c4b7-rapor-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '.txt';
  N.exportFile(nm, reportText(r));
}
function repOpen(i) { S.scan = JSON.parse(JSON.stringify(S.reports[i])); go('ariza'); }
async function repDel(i) {
  if (!await ask('Raporu sil', 'Bu tarama raporu kalıcı olarak silinsin mi?', 'Sil', 'red')) return;
  S.reports.splice(i, 1); save('psa_reports', S.reports); render();
}

/* ---------- Canlı Veri & Özel Tablolar ---------- */
const SID = k => 't_' + k.replace(/[^a-zA-Z0-9]/g, '_');
const DID_RANGES = [
  { id: 'onerilen', t: 'Önerilen PSA aralıkları (≈1500 değer, 1-2 dk)', r: [[0xD000, 0xD0FF], [0xD400, 0xD4FF], [0x2000, 0x20FF], [0x0100, 0x01FF], [0xF000, 0xF0FF], [0xF100, 0xF1FF]] },
  { id: 'd4', t: 'D400–D4FF (PSA motor/yağ/sensör)', r: [[0xD400, 0xD4FF]] },
  { id: 'd0', t: 'D000–D0FF', r: [[0xD000, 0xD0FF]] },
  { id: 'f0', t: 'F000–F0FF (Valeo/Bosch canlı)', r: [[0xF000, 0xF0FF]] },
  { id: 'f1', t: 'F100–F1FF (kimlik & yazılım)', r: [[0xF100, 0xF1FF]] },
  { id: 'ce', t: 'CE00–CEFF / DE00–DEFF', r: [[0xCE00, 0xCEFF], [0xDE00, 0xDEFF]] },
  { id: '20', t: '2000–20FF', r: [[0x2000, 0x20FF]] },
  { id: '01', t: '0100–01FF', r: [[0x0100, 0x01FF]] },
  { id: 'ozel', t: 'Özel aralık…', r: null }
];
const DID_TARGET_IDS = ['obd_motor', 'obd_eat6', 'motor', 'sanziman', 'abs', 'bsi'];

function defaultTables() {
  return (P.C4_PRESETS || []).map(x => ({ id: x.id, name: x.name, desc: x.desc || '', keys: x.keys.slice(), builtin: true }));
}

function liveInit() {
  const L = S.live;
  if (!L.inited) {
    L.inited = true;
    L.custom = load('psa_custom', []);
    L.tables = load('psa_live_tables', null);
    if (!Array.isArray(L.tables) || !L.tables.length) {
      L.tables = defaultTables();
      // Eski sürümde kullanıcının özel seçimi varsa ayrı tablo olarak koru
      const oldSel = load('psa_live_sel', null);
      if (Array.isArray(oldSel) && oldSel.length) {
        L.tables.unshift({ id: 'ozel_eski', name: 'Özel Tablom', desc: 'Önceki seçimin', keys: oldSel });
      }
      save('psa_live_tables', L.tables);
    }
    L.activeTable = load('psa_active_table', L.tables[0].id);
    if (L.activeTable !== '__all__' && !L.tables.some(t => t.id === L.activeTable)) L.activeTable = L.tables[0].id;
    L.mode = load('psa_live_mode', 'kokpit');
    L.rawDefs = {};
    L.hist = {}; L.mm = {}; L.raw = {};
    L.scan = { running: false, stopReq: false, prog: null, result: load('psa_did_scan', null), ecu: 'obd_motor', range: 'd4' };
    syncActiveSel();
  }
  return L;
}

function getAllSupportedKeys() {
  const L = S.live;
  const keys = [];
  const knownNums = new Set(P.PIDS.map(d => parseInt(d.pid, 16)));
  if (L.sup) {
    P.PIDS.forEach(d => { if (L.sup.has(parseInt(d.pid, 16))) keys.push(d.key); });
    Array.from(L.sup).sort((a, b) => a - b).forEach(n => {
      if (knownNums.has(n) || P.isBitmapPid(n)) return;
      const d = P.makeRawPid(n);
      L.rawDefs[d.key] = d;
      keys.push(d.key);
    });
  } else {
    P.PIDS.forEach(d => keys.push(d.key));
  }
  if (L.tcuSup) {
    Array.from(L.tcuSup).sort((a, b) => a - b).forEach(n => {
      if (P.isBitmapPid(n)) return;
      const d = P.makeRawPid(n, 'eat6');
      L.rawDefs[d.key] = d;
      keys.push(d.key);
    });
  }
  L.custom.forEach(c => { if (!keys.includes(c.key)) keys.push(c.key); });
  return keys;
}

function syncActiveSel() {
  const L = S.live;
  if (L.activeTable === '__all__') {
    L.sel = getAllSupportedKeys();
    return;
  }
  const tbl = L.tables.find(t => t.id === L.activeTable) || L.tables[0];
  L.sel = tbl ? tbl.keys.slice() : P.DEFAULT_LIVE.slice();
}

function selectTable(id) {
  const L = liveInit();
  L.activeTable = id;
  save('psa_active_table', id);
  syncActiveSel();
  render();
}

function setLiveMode(mode) {
  const L = liveInit();
  L.mode = mode;
  save('psa_live_mode', mode);
  render();
}

function defOf(key) {
  if (!key) return null;
  if (key.startsWith('obd:')) {
    const found = P.PIDS.find(d => d.key === key);
    if (found) return found;
    if (S.live.rawDefs && S.live.rawDefs[key]) return S.live.rawDefs[key];
    const num = parseInt(key.slice(4), 16);
    if (!isNaN(num)) { const d = P.makeRawPid(num); if (S.live.rawDefs) S.live.rawDefs[key] = d; return d; }
    return null;
  }
  if (key.startsWith('obd_tcu:')) {
    if (S.live.rawDefs && S.live.rawDefs[key]) return S.live.rawDefs[key];
    const num = parseInt(key.slice(8), 16);
    if (!isNaN(num)) { const d = P.makeRawPid(num, 'eat6'); if (S.live.rawDefs) S.live.rawDefs[key] = d; return d; }
    return null;
  }
  const c = S.live.custom.find(x => x.key === key);
  if (!c) return null;
  return Object.assign({
    unit: c.unit || '',
    min: c.min != null && c.min !== '' ? +c.min : 0,
    max: c.max != null && c.max !== '' ? +c.max : 0,
    isPsa: true,
    warn: (c.warnHi != null && c.warnHi !== '') || (c.warnLo != null && c.warnLo !== '')
      ? (v => ((c.warnHi != null && c.warnHi !== '' && v >= +c.warnHi) || (c.warnLo != null && c.warnLo !== '' && v <= +c.warnLo)))
      : null
  }, c);
}

function fmtVal(v) {
  if (v == null) return '–';
  if (typeof v === 'number') return String(v).replace('.', ',');
  return esc(v);
}

function normPct(d, v) {
  if (typeof v !== 'number' || !isFinite(v) || !d.max) return null;
  const lo = d.min || 0, hi = d.max;
  if (hi <= lo) return null;
  return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
}

function sparkSvg(key, mini) {
  const h = S.live.hist[key];
  if (!h || h.length < 2) {
    return mini ? '<svg class="mini-spark" viewBox="0 0 60 20"><polyline points=""/></svg>' : '<svg class="spark" viewBox="0 0 100 26" preserveAspectRatio="none"><polygon class="sp-area" points=""/><polyline class="sp-line" points=""/></svg>';
  }
  let lo = Math.min(...h), hi = Math.max(...h);
  if (hi === lo) { hi += 1; lo -= 1; }
  const maxN = Math.max(1, h.length - 1);
  if (mini) {
    const pts = h.map((v, i) => (i * 60 / maxN).toFixed(1) + ',' + (18 - (v - lo) / (hi - lo) * 16).toFixed(1)).join(' ');
    return '<svg class="mini-spark" viewBox="0 0 60 20" preserveAspectRatio="none"><polyline points="' + pts + '"/></svg>';
  }
  const pts = h.map((v, i) => (i * 100 / maxN).toFixed(1) + ',' + (23 - (v - lo) / (hi - lo) * 20).toFixed(1)).join(' ');
  const area = '0,25 ' + pts + ' 100,25';
  return '<svg class="spark" viewBox="0 0 100 26" preserveAspectRatio="none"><polygon class="sp-area" points="' + area + '"/><polyline class="sp-line" points="' + pts + '"/></svg>';
}

// Yarım daire C4 B7 kokpit kadranı (arc length = ~150.8)
const ARC_LEN = 150.8;
function gaugeCardHtml(d) {
  const L = S.live, k = d.key, v = L.vals[k], mm = L.mm[k];
  const w = typeof v === 'number' && d.warn && d.warn(v);
  const p = normPct(d, v);
  const tag = d.isPsa ? '<span class="pill acc">ÖZEL</span>' : d.tcu ? '<span class="pill acc">EAT6</span>' : d.rawObd ? '<span class="pill">HAM</span>' : '';
  let body;
  if (!d.txt && d.max) {
    const off = p == null ? ARC_LEN : (ARC_LEN * (1 - p)).toFixed(1);
    body = '<div class="g-arc">' +
      '<svg viewBox="0 0 120 72"><path class="g-track" d="M 12 62 A 48 48 0 0 1 108 62"/>' +
      '<path class="g-fill" d="M 12 62 A 48 48 0 0 1 108 62" stroke-dasharray="' + ARC_LEN + '" stroke-dashoffset="' + off + '"/></svg>' +
      '<div class="g-val"><span class="val-num">' + fmtVal(v) + '</span><span class="g-unit">' + esc(d.unit) + '</span></div></div>';
  } else {
    body = '<div class="g-num' + (d.txt ? ' txt' : '') + '"><span class="val-num">' + fmtVal(v) + '</span><span class="g-u">' + esc(d.unit) + '</span></div>';
  }
  const rawHtml = (d.isPsa && L.raw[k]) ? '<div class="mute small mono val-raw">ham: ' + esc(P.toHex(L.raw[k])) + '</div>' : '';
  const mmHtml = !d.txt ? '<div class="g-mm"><span class="val-min">min ' + (mm ? fmtVal(mm.min) : '–') + '</span><span class="val-max">maks ' + (mm ? fmtVal(mm.max) : '–') + '</span></div>' : '';
  const spHtml = !d.txt ? sparkSvg(k, false) : '';
  return '<div class="gcard' + (w ? ' warnv' : '') + '" id="' + SID(k) + '">' +
    '<div class="ghead"><div class="gn">' + esc(d.name) + '</div>' + tag + '</div>' +
    body + rawHtml + mmHtml + spHtml + '</div>';
}

function tileCardHtml(d) {
  const L = S.live, k = d.key, v = L.vals[k], mm = L.mm[k];
  const w = typeof v === 'number' && d.warn && d.warn(v);
  const p = normPct(d, v);
  const tag = d.isPsa ? ' <span class="pill acc">ÖZEL</span>' : d.tcu ? ' <span class="pill acc">EAT6</span>' : '';
  return '<div class="tile' + (w ? ' warnv' : '') + '" id="' + SID(k) + '">' +
    '<div class="n">' + esc(d.name) + tag + '</div>' +
    '<div class="v' + (d.txt ? ' txt' : '') + '"><span class="val-num">' + fmtVal(v) + '</span><span class="u">' + esc(d.unit) + '</span></div>' +
    (d.isPsa && L.raw[k] ? '<div class="mute small mono val-raw">ham: ' + esc(P.toHex(L.raw[k])) + '</div>' : '') +
    (!d.txt && d.max ? '<div class="bar"><div class="val-bar" style="width:' + (p == null ? 0 : Math.round(p * 100)) + '%"></div></div>' : '') +
    (!d.txt ? '<div class="mute small" style="margin-top:4px"><span class="val-min">min ' + (mm ? fmtVal(mm.min) : '–') + '</span> · <span class="val-max">maks ' + (mm ? fmtVal(mm.max) : '–') + '</span></div>' + sparkSvg(k, false) : '') +
  '</div>';
}

function tableRowHtml(d) {
  const L = S.live, k = d.key, v = L.vals[k], mm = L.mm[k];
  const w = typeof v === 'number' && d.warn && d.warn(v);
  const sub = d.isPsa ? ((d.hex || '') + (L.raw[k] ? ' · ' + P.toHex(L.raw[k]) : '')) : (d.pid ? 'PID 0x' + d.pid : '');
  return '<tr class="' + (w ? 'warnv' : '') + '" id="' + SID(k) + '">' +
    '<td><div><b>' + esc(d.name) + '</b></div><div class="t-sub mono val-raw">' + esc(sub) + '</div></td>' +
    '<td class="num val"><span class="val-num">' + fmtVal(v) + '</span><span class="u">' + esc(d.unit) + '</span></td>' +
    '<td class="num small mute"><div class="val-min">' + (mm ? fmtVal(mm.min) : '–') + '</div><div class="val-max">' + (mm ? fmtVal(mm.max) : '–') + '</div></td>' +
    '<td class="num">' + (!d.txt ? sparkSvg(k, true) : '<span class="mute small">metin</span>') + '</td>' +
  '</tr>';
}

function vCanli() {
  const L = liveInit();
  syncActiveSel();
  const isAll = L.activeTable === '__all__';
  const curTbl = isAll ? { id: '__all__', name: 'Aracın Desteklediği Tümü', desc: 'Motor + EAT6 desteklenen tüm PID\'ler ve özel sensörler' }
    : (L.tables.find(t => t.id === L.activeTable) || L.tables[0]);

  const defs = L.sel.map(defOf).filter(Boolean);
  const shown = defs.filter(d => d.isPsa || d.tcu || !L.sup || L.sup.has(parseInt(d.pid, 16)));
  const hidden = defs.length - shown.length;

  let h = '<div class="card hero">' +
    '<div class="card-head"><h2>Canlı Veri & Özel Tablolar</h2>' +
      '<div class="seg">' +
        '<button type="button" class="' + (L.mode === 'kokpit' ? 'on' : '') + '" onclick="setLiveMode(\'kokpit\')">Kokpit</button>' +
        '<button type="button" class="' + (L.mode === 'tablo' ? 'on' : '') + '" onclick="setLiveMode(\'tablo\')">Tablo</button>' +
        '<button type="button" class="' + (L.mode === 'kart' ? 'on' : '') + '" onclick="setLiveMode(\'kart\')">Kart</button>' +
      '</div>' +
    '</div>' +
    // Özel Tablo Seçim Şeridi
    '<div class="chips" style="margin-bottom:10px">' +
      L.tables.map(t => '<button type="button" class="chip' + (L.activeTable === t.id ? ' on' : '') + '" onclick="selectTable(\'' + esc(t.id) + '\')">' + esc(t.name) + ' (' + t.keys.length + ')</button>').join('') +
      '<button type="button" class="chip' + (isAll ? ' on' : '') + '" onclick="selectTable(\'__all__\')">Desteklenen Tümü</button>' +
      '<button type="button" class="chip add" onclick="editTableModal(null)">+ Yeni Tablo</button>' +
    '</div>' +
    '<div class="row">' +
      (L.on ? '<button type="button" class="btn red" onclick="stopLive();render()">■ Durdur</button>' : '<button type="button" class="btn pri" onclick="startLive()">▶ Başlat</button>') +
      (!isAll ? '<button type="button" class="btn soft" onclick="editTableModal(\'' + esc(curTbl.id) + '\')">Tabloyu Düzenle</button>' : '') +
      (L.rec ? '<button type="button" class="btn red" id="recBtn" onclick="recStop()">● Kaydı Bitir (' + L.rec.rows.length + ')</button>' : '<button type="button" class="btn" onclick="recStart()">CSV Kaydet</button>') +
    '</div>' +
    '<div class="row" style="margin-top:8px">' +
      '<button type="button" class="btn sm soft sp" onclick="discoverAllPids()">Tümünü Keşfet</button>' +
      '<button type="button" class="btn sm sp" onclick="addManualSensorModal()">+ Özel Sensör</button>' +
      '<button type="button" class="btn sm" onclick="resetMinMax()">Sıfırla</button>' +
    '</div>';

  if (L.sup) {
    const tcuCnt = L.tcuSup ? L.tcuSup.size : 0;
    h += '<div class="mute small" style="margin-top:8px">Keşfedilen: <b>Motor ' + L.sup.size + ' PID</b>' + (tcuCnt ? ' · <b>EAT6 ' + tcuCnt + ' PID</b>' : '') + ' · <b>' + L.custom.length + ' özel sensör</b></div>';
  } else {
    h += '<div class="mute small" style="margin-top:8px">' + esc(curTbl.desc || 'Başlat\'a bastığında aracın desteklediği tüm canlı PID\'ler otomatik algılanır.') + '</div>';
  }
  h += '</div>';

  if (!defs.length) {
    h += '<div class="card mute">Bu tabloda henüz parametre yok. "Tabloyu Düzenle" ile istediğin verileri ekleyebilirsin.</div>';
  } else if (!shown.length) {
    h += '<div class="card warn">Bu tablodaki ' + defs.length + ' parametreyi araç desteklemiyor. "Desteklenen Tümü" sekmesine geçebilir veya tabloyu düzenleyebilirsin.</div>';
  } else {
    if (L.mode === 'tablo') {
      h += '<div class="live-table-wrap"><table class="live-table"><thead><tr>' +
        '<th>Parametre</th><th class="num">Anlık</th><th class="num">Min/Maks</th><th class="num">Trend</th>' +
        '</tr></thead><tbody>' + shown.map(tableRowHtml).join('') + '</tbody></table></div>';
    } else if (L.mode === 'kart') {
      h += '<div class="tiles kart">' + shown.map(tileCardHtml).join('') + '</div>';
    } else {
      h += '<div class="tiles kokpit">' + shown.map(gaugeCardHtml).join('') + '</div>';
    }
    if (hidden) {
      h += '<div class="mute small" style="margin:6px 4px 12px">' + hidden + ' parametre bu araç tarafından desteklenmediği için gizlendi.</div>';
    }
  }

  h += vDidCard();
  return h;
}

/* ---------- Aracın Desteklediği Bütün OBD PID'lerini Keşfet (Motor 7E0 + EAT6 7E1) ---------- */
async function discoverAllPids() {
  if (!ready()) return;
  const L = liveInit();
  stopLive();
  S.busy = true;
  toast('Motor ve EAT6 desteklenen tüm PID\'ler taranıyor…', 3000);
  try {
    L.sup = await P.supportedPids(S.elm);
    // EAT6 (7E1/7E9) üzerinde standart OBD Mode 01 desteği var mı kontrol et
    try {
      const tcu = await P.supportedPids(S.elm, '7E1', '7E9');
      L.tcuSup = tcu && tcu.size ? tcu : new Set();
    } catch (e) { L.tcuSup = new Set(); }
    syncActiveSel();
    const total = L.sup.size + (L.tcuSup ? L.tcuSup.size : 0);
    toast('Keşif tamamlandı: ' + L.sup.size + ' motor + ' + (L.tcuSup ? L.tcuSup.size : 0) + ' EAT6 PID bulundu! (' + total + ')', 4000);
  } catch (e) {
    addLog('!', 'PID keşif hatası: ' + e.message);
    toast('Keşif hatası: ' + e.message);
  }
  S.busy = false;
  render();
}

/* ---------- Özel Canlı Veri Tablosu Oluşturucu / Düzenleyici ---------- */
function editTableModal(tableId) {
  const L = liveInit();
  const existing = tableId ? L.tables.find(t => t.id === tableId) : null;
  const draft = {
    id: existing ? existing.id : ('tbl_' + Date.now()),
    name: existing ? existing.name : ('Özel Tablo ' + (L.tables.length + 1)),
    keys: existing ? existing.keys.slice() : ['obd:05', 'obd:5C', 'obd:0C', 'obd:42'],
    onlySup: !!L.sup,
    q: '',
    cat: 'Tümü'
  };

  // Tüm mevcut parametreleri topla (standart + bilinmeyen desteklenen ham OBD + EAT6 OBD + özel PSA/UDS)
  const catalog = [];
  const knownNums = new Set(P.PIDS.map(d => parseInt(d.pid, 16)));
  P.PIDS.forEach(d => catalog.push(d));
  if (L.sup) {
    Array.from(L.sup).sort((a, b) => a - b).forEach(n => {
      if (knownNums.has(n) || P.isBitmapPid(n)) return;
      const d = P.makeRawPid(n); L.rawDefs[d.key] = d; catalog.push(d);
    });
  }
  if (L.tcuSup) {
    Array.from(L.tcuSup).sort((a, b) => a - b).forEach(n => {
      if (P.isBitmapPid(n)) return;
      const d = P.makeRawPid(n, 'eat6'); L.rawDefs[d.key] = d; catalog.push(d);
    });
  }
  L.custom.forEach(c => catalog.push(Object.assign({ g: 'Özel PSA / UDS', unit: c.unit || '', isPsa: true }, c)));

  const cats = ['Tümü'].concat(Array.from(new Set(catalog.map(d => d.g))));

  const bodyHtml =
    '<label class="small mute">Tablo Adı</label>' +
    '<input id="tbName" class="grow" style="width:100%;margin:4px 0 8px" value="' + esc(draft.name) + '" placeholder="Ör. Uzun Yol / Rölanti">' +
    '<div class="row" style="margin-bottom:8px">' +
      '<input id="tbSearch" class="grow" placeholder="Parametre ara (hararet, turbo, yakıt, 05…)">' +
    '</div>' +
    '<div class="chips" id="tbCats" style="margin-bottom:8px"></div>' +
    '<div class="row" style="margin-bottom:6px">' +
      (L.sup ? '<label class="small sp" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="tbOnlySup"' + (draft.onlySup ? ' checked' : '') + '> Sadece desteklenenler</label>' : '<span class="mute small sp">Önce "Keşfet"le desteklenenleri süz</span>') +
      '<button type="button" class="btn xs soft" id="tbAllBtn">Tümünü Seç</button>' +
      '<button type="button" class="btn xs" id="tbClrBtn">Temizle</button>' +
    '</div>' +
    '<div id="tbOrdWrap"></div>' +
    '<div class="picker" id="tbList" style="margin-top:8px"></div>';

  const btns = [{ t: 'Vazgeç', v: false }];
  if (existing && L.tables.length > 1) btns.push({ t: 'Tabloyu Sil', v: 'del', cls: 'red' });
  btns.push({ t: 'Kaydet', v: 'save', cls: 'pri' });

  const p = modal(existing ? 'Tabloyu Düzenle' : 'Yeni Özel Tablo Oluştur', bodyHtml, btns);

  function isSup(d) {
    if (d.isPsa || d.tcu || !L.sup) return true;
    return L.sup.has(parseInt(d.pid, 16));
  }

  function filtered() {
    const q = draft.q.toLowerCase();
    return catalog.filter(d => {
      if (draft.onlySup && !isSup(d)) return false;
      if (draft.cat !== 'Tümü' && d.g !== draft.cat) return false;
      if (q && !(d.name.toLowerCase().includes(q) || (d.pid || '').toLowerCase().includes(q) || (d.hex || '').toLowerCase().includes(q) || d.g.toLowerCase().includes(q))) return false;
      return true;
    });
  }

  function paintEditor() {
    // Kategori çipleri
    $('#tbCats').innerHTML = cats.map(c => '<button type="button" class="chip' + (draft.cat === c ? ' on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>').join('');
    // Seçili sıralama listesi
    const ordEl = $('#tbOrdWrap');
    if (draft.keys.length) {
      ordEl.innerHTML = '<div class="small mute" style="margin-top:4px"><b>Seçili Sıra (' + draft.keys.length + ')</b> — yukarı/aşağı taşıyabilirsin:</div>' +
        '<div class="sel-ord-list">' + draft.keys.map((k, idx) => {
          const d = defOf(k);
          return '<div class="sel-ord-row"><span class="sp">' + (idx + 1) + '. ' + esc(d ? d.name : k) + '</span>' +
            '<button type="button" class="ord-btn" data-mv="-1" data-idx="' + idx + '"' + (idx === 0 ? ' disabled' : '') + '>▲</button>' +
            '<button type="button" class="ord-btn" data-mv="1" data-idx="' + idx + '"' + (idx === draft.keys.length - 1 ? ' disabled' : '') + '>▼</button>' +
            '<button type="button" class="ord-btn" data-rm="' + idx + '">✕</button></div>';
        }).join('') + '</div>';
    } else {
      ordEl.innerHTML = '<div class="mute small">Henüz parametre seçilmedi.</div>';
    }
    // Katalog listesi
    const list = filtered();
    const groups = {};
    list.forEach(d => { (groups[d.g] = groups[d.g] || []).push(d); });
    const sel = new Set(draft.keys);
    let lh = '';
    Object.keys(groups).forEach(g => {
      lh += '<div class="grp">' + esc(g) + '</div>';
      groups[g].forEach(d => {
        const sup = isSup(d);
        lh += '<label class="chk"><input type="checkbox" data-k="' + esc(d.key) + '"' + (sel.has(d.key) ? ' checked' : '') + '>' +
          '<span class="sp">' + esc(d.name) + ' <span class="mute small">' + esc(d.unit || '') + (d.pid ? ' · 0x' + d.pid : '') + '</span></span>' +
          (L.sup && !sup ? '<span class="pill none">yok</span>' : '') + '</label>';
      });
    });
    $('#tbList').innerHTML = lh || '<div class="mute small" style="padding:10px 0">Aramana uygun parametre bulunamadı.</div>';
  }

  paintEditor();

  $('#tbSearch').addEventListener('input', e => { draft.q = e.target.value.trim(); paintEditor(); });
  if ($('#tbOnlySup')) $('#tbOnlySup').addEventListener('change', e => { draft.onlySup = e.target.checked; paintEditor(); });
  $('#tbCats').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    draft.cat = b.dataset.cat; paintEditor();
  });
  $('#tbAllBtn').addEventListener('click', () => {
    filtered().forEach(d => { if (!draft.keys.includes(d.key)) draft.keys.push(d.key); });
    paintEditor();
  });
  $('#tbClrBtn').addEventListener('click', () => { draft.keys = []; paintEditor(); });
  $('#tbOrdWrap').addEventListener('click', e => {
    const mv = e.target.closest('[data-mv]');
    if (mv) {
      const i = +mv.dataset.idx, dir = +mv.dataset.mv, j = i + dir;
      if (j >= 0 && j < draft.keys.length) { const tmp = draft.keys[i]; draft.keys[i] = draft.keys[j]; draft.keys[j] = tmp; paintEditor(); }
      return;
    }
    const rm = e.target.closest('[data-rm]');
    if (rm) { draft.keys.splice(+rm.dataset.rm, 1); paintEditor(); }
  });
  $('#tbList').addEventListener('change', e => {
    const cb = e.target.closest('input[type=checkbox]'); if (!cb) return;
    const k = cb.dataset.k;
    if (cb.checked) { if (!draft.keys.includes(k)) draft.keys.push(k); }
    else draft.keys = draft.keys.filter(x => x !== k);
    paintEditor();
  });

  p.then(act => {
    if (act === 'del' && existing) {
      L.tables = L.tables.filter(t => t.id !== existing.id);
      if (!L.tables.length) L.tables = defaultTables();
      L.activeTable = L.tables[0].id;
      save('psa_live_tables', L.tables); save('psa_active_table', L.activeTable);
      syncActiveSel(); toast('Tablo silindi'); render();
    } else if (act === 'save') {
      const nm = ($('#tbName').value || '').trim() || draft.name;
      if (existing) { existing.name = nm; existing.keys = draft.keys.slice(); }
      else { L.tables.push({ id: draft.id, name: nm, desc: 'Özel kullanıcı tablosu', keys: draft.keys.slice() }); }
      L.activeTable = existing ? existing.id : draft.id;
      save('psa_live_tables', L.tables); save('psa_active_table', L.activeTable);
      syncActiveSel(); toast('"' + nm + '" kaydedildi (' + draft.keys.length + ' veri)'); render();
    }
  });
}

/* ---------- Özel PSA / UDS / KWP Sensör & Formül Ekleme ---------- */
function addManualSensorModal(prefill) {
  const L = liveInit();
  const pf = prefill || {};
  const targets = DID_TARGET_IDS.map(id => P.findAnyEcu(id)).filter(Boolean);
  const sample = pf.sampleData || null;

  const html =
    '<div class="mute small" style="margin-bottom:8px">PSA veya OBD UDS (0x22) / KWP (0x21) adresini kendi formülünle canlı tablolara ekle. Örnek: <b>mbar → bar</b> için Çarpan <code>0.001</code>, sıcaklık için Ofset <code>-40</code>.</div>' +
    '<label class="small mute">Sensör Adı</label><input id="csName" style="width:100%;margin:3px 0 8px" value="' + esc(pf.name || '') + '" placeholder="Ör. Yağ Basıncı / EAT6 Sıcaklık">' +
    '<div class="row" style="margin-bottom:8px">' +
      '<div class="sp"><label class="small mute">Hedef Beyin</label><select id="csEcu" style="width:100%;margin-top:3px">' +
        targets.map(e => '<option value="' + e.id + '"' + ((pf.ecu || 'obd_motor') === e.id ? ' selected' : '') + '>' + esc(e.name) + '</option>').join('') +
      '</select></div>' +
      '<div style="width:92px"><label class="small mute">Protokol</label><select id="csProto" style="width:100%;margin-top:3px"><option value="UDS"' + ((pf.proto || 'UDS') === 'UDS' ? ' selected' : '') + '>UDS 22</option><option value="KWP"' + (pf.proto === 'KWP' ? ' selected' : '') + '>KWP 21</option></select></div>' +
    '</div>' +
    '<div class="row" style="margin-bottom:8px">' +
      '<div class="sp"><label class="small mute">DID (Hex)</label><input id="csHex" class="mono" style="width:100%;margin-top:3px" value="' + esc(pf.hex || 'D40A') + '" autocapitalize="characters"></div>' +
      '<div class="sp"><label class="small mute">Birim</label><input id="csUnit" style="width:100%;margin-top:3px" value="' + esc(pf.unit || '') + '" placeholder="bar, °C, V…"></div>' +
    '</div>' +
    '<div class="row" style="margin-bottom:8px">' +
      '<div class="sp"><label class="small mute">Bayt Başl.</label><input id="csStart" type="number" min="0" max="16" style="width:100%;margin-top:3px" value="' + (pf.byteStart || 0) + '"></div>' +
      '<div class="sp"><label class="small mute">Bayt Sayısı</label><select id="csLen" style="width:100%;margin-top:3px"><option value="0">Otomatik</option><option value="1">1 bayt</option><option value="2">2 bayt</option><option value="4">4 bayt</option></select></div>' +
      '<div class="sp"><label class="small mute">Çarpan</label><input id="csScale" style="width:100%;margin-top:3px" value="' + (pf.scale != null ? pf.scale : '1') + '" placeholder="1 / 0.001"></div>' +
      '<div class="sp"><label class="small mute">Ofset</label><input id="csOff" style="width:100%;margin-top:3px" value="' + (pf.offset != null ? pf.offset : '0') + '" placeholder="0 / -40"></div>' +
    '</div>' +
    '<div class="row" style="margin-bottom:8px">' +
      '<div class="sp"><label class="small mute">Kadran Maks (ops.)</label><input id="csMax" style="width:100%;margin-top:3px" value="' + (pf.max || '') + '" placeholder="Ör. 6 veya 130"></div>' +
      '<div class="sp"><label class="small mute">Uyarı Üst ≥ (ops.)</label><input id="csWarnHi" style="width:100%;margin-top:3px" value="' + (pf.warnHi || '') + '" placeholder="Ör. 115"></div>' +
    '</div>' +
    (sample ? '<div class="info mono small" id="csPrev"></div>' : '');

  const p = modal('Özel Sensör / Formül', html, [{ t: 'Vazgeç', v: false }, { t: 'Kaydet & Ekle', v: true, cls: 'pri' }]);

  function updatePrev() {
    if (!sample) return;
    const prev = $('#csPrev'); if (!prev) return;
    const v = P.scaleDid(sample, {
      byteStart: +$('#csStart').value || 0,
      byteLen: +$('#csLen').value || 0,
      scale: $('#csScale').value,
      offset: $('#csOff').value
    });
    prev.textContent = 'Ham: ' + P.toHex(sample) + '  →  Hesaplanan: ' + fmtVal(v) + ' ' + ($('#csUnit').value || '');
  }
  if (sample) {
    ['csStart', 'csLen', 'csScale', 'csOff', 'csUnit'].forEach(id => { const e = $('#' + id); if (e) e.addEventListener('input', updatePrev); });
    updatePrev();
  }

  p.then(ok => {
    if (!ok) return;
    const ecu = $('#csEcu').value;
    const proto = $('#csProto').value;
    const hex = ($('#csHex').value || '').trim().toUpperCase().replace(/[^0-9A-F]/g, '');
    const did = parseInt(hex, 16);
    if (!hex || isNaN(did)) { toast('Geçerli bir hex DID girin (ör. D40A)'); return; }
    const normHex = P.didHex(did, proto);
    const key = 'psa:' + ecu + ':' + proto + ':' + normHex;
    const ecuObj = P.findAnyEcu(ecu);
    const name = ($('#csName').value || '').trim() || ((ecuObj ? ecuObj.name : ecu) + ' ' + normHex);
    const entry = {
      key, ecu, did, proto, hex: normHex, name,
      unit: ($('#csUnit').value || '').trim(),
      byteStart: +$('#csStart').value || 0,
      byteLen: +$('#csLen').value || 0,
      scale: $('#csScale').value.trim() || '1',
      offset: $('#csOff').value.trim() || '0',
      max: $('#csMax').value.trim(),
      warnHi: $('#csWarnHi').value.trim()
    };
    L.custom = L.custom.filter(c => c.key !== key).concat([entry]);
    // Aktif tabloya otomatik ekle (özel tablo açıksa)
    const tbl = L.tables.find(t => t.id === L.activeTable);
    if (tbl && !tbl.keys.includes(key)) tbl.keys.push(key);
    save('psa_custom', L.custom);
    save('psa_live_tables', L.tables);
    syncActiveSel();
    toast('"' + name + '" eklendi');
    render();
  });
}

/* ---------- Akıcı Yerinde DOM Güncelleme (Sıçramasız Kadran & Tablo) ---------- */
function setVal(d, v, raw) {
  const L = S.live, k = d.key;
  L.vals[k] = v;
  if (raw) L.raw[k] = raw;
  if (typeof v === 'number' && isFinite(v)) {
    const h = L.hist[k] = L.hist[k] || [];
    h.push(v); if (h.length > 60) h.shift();
    const mm = L.mm[k];
    if (!mm) L.mm[k] = { min: v, max: v }; else { if (v < mm.min) mm.min = v; if (v > mm.max) mm.max = v; }
  }
  if (S.view !== 'canli') return;
  const el = document.getElementById(SID(k));
  if (!el) return;
  const w = !!(typeof v === 'number' && d.warn && d.warn(v));
  el.classList.toggle('warnv', w);

  const vEl = el.querySelector('.val-num');
  if (vEl) vEl.textContent = fmtVal(v);

  const p = normPct(d, v);
  const arc = el.querySelector('.g-fill');
  if (arc && p != null) arc.setAttribute('stroke-dashoffset', (ARC_LEN * (1 - p)).toFixed(1));
  const bar = el.querySelector('.val-bar');
  if (bar && p != null) bar.style.width = Math.round(p * 100) + '%';

  const mm = L.mm[k];
  if (mm) {
    const minEl = el.querySelector('.val-min');
    const maxEl = el.querySelector('.val-max');
    if (minEl) minEl.textContent = (L.mode === 'tablo' ? '' : 'min ') + fmtVal(mm.min);
    if (maxEl) maxEl.textContent = (L.mode === 'tablo' ? '' : 'maks ') + fmtVal(mm.max);
  }
  if (raw && d.isPsa) {
    const rawEl = el.querySelector('.val-raw');
    if (rawEl) rawEl.textContent = (L.mode === 'tablo' ? (d.hex + ' · ') : 'ham: ') + P.toHex(raw);
  }
  // Sparkline yerinde güncelle
  const hArr = L.hist[k];
  if (hArr && hArr.length >= 2) {
    let lo = Math.min(...hArr), hi = Math.max(...hArr);
    if (hi === lo) { hi += 1; lo -= 1; }
    const maxN = Math.max(1, hArr.length - 1);
    const mini = el.querySelector('.mini-spark polyline');
    if (mini) {
      mini.setAttribute('points', hArr.map((x, i) => (i * 60 / maxN).toFixed(1) + ',' + (18 - (x - lo) / (hi - lo) * 16).toFixed(1)).join(' '));
    } else {
      const line = el.querySelector('.sp-line'), area = el.querySelector('.sp-area');
      if (line) {
        const pts = hArr.map((x, i) => (i * 100 / maxN).toFixed(1) + ',' + (23 - (x - lo) / (hi - lo) * 20).toFixed(1)).join(' ');
        line.setAttribute('points', pts);
        if (area) area.setAttribute('points', '0,25 ' + pts + ' 100,25');
      }
    }
  }
}

function resetMinMax() { S.live.mm = {}; S.live.hist = {}; render(); toast('Min/maks ve grafikler sıfırlandı', 1600); }

async function startLive() {
  if (!ready()) return;
  const L = liveInit();
  syncActiveSel();
  if (!L.sel.length) { editTableModal(L.activeTable === '__all__' ? null : L.activeTable); return; }
  L.on = true; N.keepScreenOn(true);
  const my = ++L.loop;
  S.busy = true;
  render();
  try {
    if (!L.sup && (L.activeTable === '__all__' || L.sel.some(k => k.startsWith('obd:')))) {
      L.sup = await P.supportedPids(S.elm);
      syncActiveSel();
      render();
    }
    let round = 0, fails = 0;
    while (L.on && L.loop === my && S.conn) {
      syncActiveSel();
      const defs = L.sel.map(defOf).filter(Boolean);
      const obd = defs.filter(d => !d.isPsa && !d.tcu && L.sup && L.sup.has(parseInt(d.pid, 16)) && (d.max || d.rawObd || round % 5 === 0));
      const tcuObd = defs.filter(d => d.tcu);
      const psa = defs.filter(d => d.isPsa);
      if (!obd.length && !tcuObd.length && !psa.length) break;
      let got = 0;
      if (obd.length) {
        await P.selectEngineObd(S.elm);
        for (const d of obd) {
          if (!L.on || L.loop !== my) break;
          const v = await P.readPid(S.elm, d);
          if (v != null) { setVal(d, v); got++; }
        }
      }
      if (tcuObd.length) {
        await P.selectTcuObd(S.elm);
        for (const d of tcuObd) {
          if (!L.on || L.loop !== my) break;
          const v = await P.readPid(S.elm, d);
          if (v != null) { setVal(d, v); got++; }
        }
      }
      for (const d of psa) {
        if (!L.on || L.loop !== my) break;
        const ecu = P.findAnyEcu(d.ecu);
        const r = await P.readDid(S.elm, ecu, d.did, d.proto);
        if (r.ok) {
          const val = P.scaleDid ? P.scaleDid(r.data, d) : P.rawNumber(r.data);
          setVal(d, val != null ? val : P.toHex(r.data), r.data);
          got++;
        }
      }
      if (L.rec && got) recRow();
      fails = got ? 0 : fails + 1;
      if (fails >= 3) { toast('Değerler okunamıyor. Bağlantıyı ve kontağı kontrol et.', 4000); break; }
      round++;
    }
  } catch (e) { addLog('!', 'Canlı veri: ' + e.message); }
  if (L.loop === my) { L.on = false; S.busy = false; N.keepScreenOn(false); if (S.view === 'canli') render(); }
}

function stopLive() {
  const L = S.live;
  if (!L.on) return;
  L.on = false; L.loop++;
  S.busy = false;
  N.keepScreenOn(false);
}

/* ---------- Kayıt (CSV) ---------- */
function recStart() {
  const L = liveInit();
  syncActiveSel();
  L.rec = { t0: Date.now(), keys: L.sel.slice(), rows: [] };
  toast('CSV kaydı başladı. Her canlı okuma turu kaydedilecek.');
  if (!L.on) startLive(); else render();
}
function recRow() {
  const L = S.live, r = L.rec;
  r.rows.push([((Date.now() - r.t0) / 1000).toFixed(1)].concat(r.keys.map(k => { const v = L.vals[k]; return v == null ? '' : String(v).replace('.', ','); })));
  if (r.rows.length % 5 === 0 && S.view === 'canli') {
    const b = $('#recBtn');
    if (b) b.textContent = '● Kaydı Bitir (' + r.rows.length + ')';
  }
}
function recStop() {
  const L = S.live, r = L.rec;
  L.rec = null;
  if (!r || !r.rows.length) { toast('Kayıtta veri yok'); render(); return; }
  const head = ['zaman_sn'].concat(r.keys.map(k => { const d = defOf(k); return d ? d.name + (d.unit ? ' (' + d.unit + ')' : '') : k; }));
  const csv = '\uFEFF' + [head].concat(r.rows).map(row => row.map(c => /[;"\n]/.test(c) ? '"' + String(c).replace(/"/g, '""') + '"' : c).join(';')).join('\n');
  const d = new Date(r.t0);
  const nm = 'c4b7-canli-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '.csv';
  N.exportFile(nm, csv);
  render();
}

/* ---------- PSA & OBD-CAN Özel Değer (DID) Tarayıcı ---------- */
function vDidCard() {
  const sc = S.live.scan;
  const targets = DID_TARGET_IDS.map(id => P.findAnyEcu(id)).filter(Boolean);
  const curTarget = P.findAnyEcu(sc.ecu) || targets[0];

  let h = '<div class="card" style="margin-top:12px"><div class="card-head"><h2>Özel Sensör (UDS DID) Tarayıcı</h2><span class="pill acc">Salt Okuma</span></div>' +
    '<div class="mute small">Yağ basıncı veya EAT6 şanzıman yağı sıcaklığı gibi standart OBD\'de görünmeyen üretici verilerini tarar. <b>Motor (OBD 7E0)</b> ve <b>EAT6 (OBD 7E1)</b> standart pin 6/14 üzerinden ara kablosuz denenebilir; diğer PSA beyinleri için pin 3/8 kablosu gerekir.</div>';

  if (sc.running) {
    const p = sc.prog || { i: 0, total: 1, found: 0 };
    h += '<div class="prog"><div id="didBar" style="width:' + Math.round(p.i / p.total * 100) + '%"></div></div>' +
      '<div class="mute small" id="didTxt">' + p.i + ' / ' + p.total + ' · bulunan: ' + p.found + '</div>' +
      '<button type="button" class="btn red" style="margin-top:8px" onclick="S.live.scan.stopReq=true">Durdur</button>';
  } else {
    h += '<div class="row" style="margin-top:10px">' +
      '<select id="dEcu" class="grow" onchange="S.live.scan.ecu=this.value;render()">' +
        targets.map(e => '<option value="' + e.id + '"' + (sc.ecu === e.id ? ' selected' : '') + '>' + esc(e.name) + (e.obdCan ? ' ★' : ' (Pin 3/8)') + '</option>').join('') +
      '</select></div>' +
      '<div class="row" style="margin-top:8px"><select id="dRange" class="grow" onchange="S.live.scan.range=this.value;render()">' +
        DID_RANGES.map(r => '<option value="' + r.id + '"' + (sc.range === r.id ? ' selected' : '') + '>' + esc(r.t) + '</option>').join('') +
      '</select></div>';
    if (curTarget && !curTarget.obdCan) h += '<div class="warn" style="margin-top:8px">Bu beyin adresi (' + curTarget.tx + '/' + curTarget.rx + ') PSA pin 3/8 ara kablosu gerektirir. Kablo yoksa üstten <b>OBD 7E0 / 7E1</b> seçebilirsin.</div>';
    if (sc.range === 'ozel') h += '<div class="row" style="margin-top:8px"><input id="dS" class="grow mono" placeholder="Başlangıç (ör. D400)" value="' + esc(sc.s || '') + '" autocapitalize="characters"><input id="dE" class="grow mono" placeholder="Bitiş (ör. D4FF)" value="' + esc(sc.e || '') + '" autocapitalize="characters"></div>';
    h += '<button type="button" class="btn soft big" style="margin-top:10px" onclick="didScan()">DID Taramasını Başlat</button>';
  }

  const res = sc.result;
  if (res) {
    const e = P.findAnyEcu(res.ecu);
    h += '<div style="margin-top:12px"><b>' + esc(e ? e.name : res.ecu) + '</b> <span class="mute small">' + (res.proto || '') + ' · ' + new Date(res.date).toLocaleString('tr-TR') + '</span></div>';
    if (res.error) h += '<div class="warn">' + esc(res.error) + '</div>';
    else if (!res.found.length) h += '<div class="mute small" style="margin-top:6px">Bu aralıkta cevap veren değer yok. Başka aralık dene.</div>';
    else {
      h += '<div class="mute small" style="margin:6px 0"><b>' + res.found.length + ' değer bulundu.</b> Yağ basıncını bulmak için rölantide "Değişenleri Bul"a bas, sonra devri 2500\'e çıkarıp tekrar bas. Devirle artan değerleri "+ Formüllü Ekle" ile canlı tablona al.</div>' +
        '<div class="row"><button type="button" class="btn sm soft" onclick="didChanges()">Değişenleri Bul</button><button type="button" class="btn sm" onclick="didShare()">Listeyi Paylaş</button></div><div class="list" style="margin-top:6px">';
      res.found.forEach((f, i) => {
        const n = P.rawNumber(f.data);
        const added = S.live.custom.some(c => c.key === didKey(res, f));
        h += '<div class="item' + (f.changed ? ' chg' : '') + '"><div class="sp"><div><b class="mono">' + f.hex + '</b>' + (f.changed ? ' <span class="pill bad">değişti</span>' : '') + '</div>' +
          '<div class="mono small">' + esc(P.toHex(f.data)) + (n != null ? ' = ' + n : '') + (f.prevN != null && f.changed ? ' <span class="mute">(önce ' + f.prevN + ')</span>' : '') + '</div></div>' +
          (added ? '<span class="pill ok">canlıda</span>' : '<button type="button" class="btn sm soft" onclick="didAdd(' + i + ')">+ Ekle</button>') + '</div>';
      });
      h += '</div>';
    }
  }
  return h + '</div>';
}

const didKey = (res, f) => 'psa:' + res.ecu + ':' + res.proto + ':' + f.hex;
function parseHex4(s) { const v = parseInt(String(s || '').trim(), 16); return isNaN(v) ? null : v; }

async function didScan() {
  if (!ready()) return;
  const L = liveInit(), sc = L.scan;
  stopLive();
  sc.ecu = $('#dEcu').value;
  sc.range = $('#dRange').value;
  let ranges;
  if (sc.range === 'ozel') {
    sc.s = $('#dS').value.trim().toUpperCase(); sc.e = $('#dE').value.trim().toUpperCase();
    const a = parseHex4(sc.s), b = parseHex4(sc.e);
    if (a == null || b == null || b < a || a > 0xFFFF || b > 0xFFFF) { toast('Aralığı onaltılık yaz: ör. D400 – D4FF'); return; }
    if (b - a > 4095) { toast('Tek seferde en fazla 4096 değer taranabilir'); return; }
    ranges = [[a, b]];
  } else ranges = DID_RANGES.find(r => r.id === sc.range).r;
  const ecu = P.findAnyEcu(sc.ecu);
  sc.running = true; sc.stopReq = false; sc.prog = null;
  S.busy = true; N.keepScreenOn(true);
  render();
  let last = 0;
  try {
    const res = await P.scanDids(S.elm, ecu, ranges, {
      stop: () => sc.stopReq,
      onProgress: (i, total, found) => {
        sc.prog = { i, total, found };
        if (Date.now() - last < 220 && i < total) return;
        last = Date.now();
        const bar = $('#didBar'), txt = $('#didTxt');
        if (bar) bar.style.width = Math.round(i / total * 100) + '%';
        if (txt) txt.textContent = i + ' / ' + total + ' · bulunan: ' + found;
      }
    });
    const extraErr = res.error === 'Beyin cevap vermedi' ? (ecu.obdCan ? '. Kontak açık mı?' : '. Pin 3/8 ara kablosu takılı mı?') : '';
    sc.result = { ecu: ecu.id, proto: res.proto, date: Date.now(), error: res.error ? res.error + extraErr : null,
      found: res.found.map(f => ({ did: f.did, hex: f.hex, data: f.data })) };
    save('psa_did_scan', sc.result);
    addLog('#', 'DID tarama: ' + ecu.name + ' ' + (res.proto || '-') + ', ' + res.found.length + ' değer' + (res.stopped ? ' (durduruldu)' : ''));
  } catch (e) { addLog('!', 'DID tarama: ' + e.message); }
  sc.running = false; S.busy = false; N.keepScreenOn(false);
  render();
}

async function didChanges() {
  if (!ready()) return;
  const res = S.live.scan.result;
  if (!res || !res.found.length) return;
  const ecu = P.findAnyEcu(res.ecu);
  S.busy = true; toast('Değerler tekrar okunuyor…');
  let n = 0;
  for (const f of res.found) {
    const r = await P.readDid(S.elm, ecu, f.did, res.proto);
    if (!r.ok) continue;
    const before = P.toHex(f.data);
    f.prevN = P.rawNumber(f.data);
    f.changed = before !== P.toHex(r.data);
    if (f.changed) n++;
    f.data = r.data;
  }
  S.busy = false;
  save('psa_did_scan', res);
  toast(n ? n + ' değer değişti!' : 'Değişen değer yok');
  render();
}

function didAdd(i) {
  const L = liveInit(), res = L.scan.result, f = res.found[i];
  const ecu = P.findAnyEcu(res.ecu);
  addManualSensorModal({
    ecu: res.ecu, proto: res.proto, hex: f.hex,
    name: (ecu ? ecu.name : res.ecu) + ' ' + f.hex,
    sampleData: f.data
  });
}

function didShare() {
  const res = S.live.scan.result;
  if (!res) return;
  const e = P.findAnyEcu(res.ecu);
  N.shareText('C4 B7 Özel DID Değerleri — ' + (e ? e.name : res.ecu) + ' (' + res.proto + ')\n' +
    res.found.map(f => f.hex + ' = ' + P.toHex(f.data) + (P.rawNumber(f.data) != null ? ' (' + P.rawNumber(f.data) + ')' : '') + (f.changed ? '  DEĞİŞTİ' : '')).join('\n'));
}

/* ---------- Terminal / Ham Log ---------- */
const BLOCK = /^(27|2E|2F|31|34|35|36|37|3B|3D|11|28|85)/;
const QUICK_CMDS = [
  { c: 'ATRV', t: 'Akü Volt' },
  { c: 'ATI', t: 'ELM Sürüm' },
  { c: '0100', t: 'PID Destek' },
  { c: '0105', t: 'Hararet' },
  { c: '015C', t: 'Yağ Sıcaklık' },
  { c: '0902', t: 'Şase (VIN)' }
];

function vLog() {
  const linesHtml = S.log.length ? S.log.map(logLineHtml).join('') : '<div class="term-line in">(Henüz iletişim kaydı yok)</div>';
  return '<div class="card"><div class="card-head"><h2>ELM327 Terminal & Ham Log</h2><span class="pill">' + S.log.length + ' satır</span></div>' +
    '<div class="mute small">Giden (<span style="color:var(--acc)">&gt;</span>), gelen (<span style="color:#7EE787">&lt;</span>) ve hata (<span style="color:var(--red)">!</span>) satırları renkli gösterilir.</div>' +
    '<div class="row" style="margin:10px 0">' +
      '<button type="button" class="btn sm soft" onclick="N.shareText(logText())">Paylaş</button>' +
      '<button type="button" class="btn sm" onclick="logFile()">Dosyaya Kaydet</button>' +
      '<span class="sp"></span>' +
      '<button type="button" class="btn sm red" onclick="S.log=[];render()">Temizle</button>' +
    '</div>' +
    '<div class="term-box" id="term"' + (S.log.length ? '' : ' data-empty="1"') + '>' + linesHtml + '</div>' +
    '<div class="chips" style="margin-top:10px">' +
      QUICK_CMDS.map(q => '<button type="button" class="chip" onclick="quickCmd(\'' + q.c + '\')"><span class="mono">' + q.c + '</span> · ' + q.t + '</button>').join('') +
    '</div>' +
    '<div class="row" style="margin-top:10px"><input id="cmd" class="grow mono" placeholder="Komut (ör. ATRV, 0105, 22D40A)" autocapitalize="characters" onkeydown="if(event.key===\'Enter\')sendCmd()">' +
    '<button type="button" class="btn pri" onclick="sendCmd()">Gönder</button></div>' +
    '<div class="mute small" style="margin-top:6px">Beyne yazma, programlama, güvenlik erişimi ve sıfırlama komutları güvenlik için engellidir.</div></div>';
}

function logFile() { N.exportFile('c4b7-log-' + Date.now() + '.txt', logText()); }
function quickCmd(c) { const el = $('#cmd'); if (el) { el.value = c; sendCmd(); } }

async function sendCmd() {
  const el = $('#cmd'); const c = el.value.trim().toUpperCase().replace(/\s+/g, '');
  if (!c) return;
  if (!S.conn || !S.elm) { toast('Önce adaptöre bağlan'); return; }
  if (S.busy) { toast('Bir işlem sürüyor'); return; }
  if (!c.startsWith('AT') && BLOCK.test(c)) { toast('Bu komut engelli (beyne yazma / programlama riski)', 4000); return; }
  if (c.startsWith('AT') && /^AT(SH|CRA|FC|ST|SP|H|E|S|Z|D|WS)/.test(c)) { S.elm.tx = S.elm.rx = null; S.elm.stCur = null; S.elm.fcMode = S.elm.fcHdr = null; }
  el.value = '';
  await S.elm.cmd(c, 8000);
}

window.onAppResume = () => { if (S.view === 'baglan' && !S.busy) render(); };

render();
