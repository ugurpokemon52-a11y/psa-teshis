'use strict';
/* PSA Teşhis — arayüz */
const P = window.PSA;
const N = window.Native || {
  // Tarayıcıda önizleme için boş köprü
  hasBtPermission: () => true, requestBtPermission() {}, btAvailable: () => false, btEnabled: () => false,
  btEnable() {}, openBtSettings() {}, openAppSettings() {}, btBonded: () => '[]', btScan() {}, btConnect() {},
  btSend() {}, btDisconnect() {}, btConnected: () => false, keepScreenOn() {},
  exportFile(n, c) { console.log(n, c); }, shareText(t) { console.log(t); }, version: () => 'önizleme'
};
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const S = {
  view: 'baglan', conn: false, demo: false, state: 'off', stateText: 'Bağlı değil',
  elm: null, sim: null, init: null, busy: false, scan: null, prog: null,
  live: { on: false, sup: null, vals: {}, sel: [], custom: [], loop: 0, inited: false },
  scanList: [], scanning: false, log: [],
  reports: load('psa_reports', []), km: load('psa_km', ''), devName: ''
};

function load(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* yer yok */ } }

function toast(t, ms) {
  const el = $('#toast'); el.textContent = t; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, ms || 2600);
}
function modal(title, html, btns) {
  return new Promise(res => {
    $('#mTitle').textContent = title; $('#mBody').innerHTML = html;
    const b = $('#mBtns'); b.innerHTML = '';
    (btns || [{ t: 'Tamam', v: true, cls: 'pri' }]).forEach(x => {
      const e = document.createElement('button'); e.className = 'btn ' + (x.cls || ''); e.textContent = x.t;
      e.onclick = () => { $('#modal').hidden = true; res(x.v); }; b.appendChild(e);
    });
    $('#modal').hidden = false;
  });
}
const ask = (title, html, yes, cls) => modal(title, html, [{ t: 'Vazgeç', v: false }, { t: yes || 'Evet', v: true, cls: cls || 'pri' }]);
window.onBack = () => { if (!$('#modal').hidden) { $('#modal').hidden = true; return true; } if (S.view !== 'baglan') { go('baglan'); return true; } return false; };

/* ---------- log ---------- */
function ts() { const d = new Date(); return d.toTimeString().slice(0, 8); }
function addLog(dir, text) {
  S.log.push(ts() + ' ' + dir + ' ' + text);
  if (S.log.length > 1500) S.log.splice(0, S.log.length - 1500);
  if (S.view === 'log') { const t = $('#term'); if (t) { t.textContent = S.log.join('\n'); t.scrollTop = t.scrollHeight; } }
}

function setState(state, text) {
  S.state = state; S.stateText = text;
  $('#led').className = 'led ' + (state === 'on' ? 'on' : state === 'busy' ? 'busy' : '');
  $('#connText').textContent = text;
}

/* ---------- bağlantı ---------- */
function makeElm(sendFn) {
  S.elm = new P.Elm(sendFn, addLog);
}

async function afterConnect() {
  setState('busy', 'Adaptör hazırlanıyor…');
  render();
  const r = await S.elm.init(t => { setState('busy', t); });
  S.init = r;
  if (!r.ok) {
    setState('off', 'Adaptör cevap vermiyor');
    modal('Adaptör cevap vermiyor', esc(r.msg));
  } else {
    setState('on', (S.demo ? 'Demo — ' : '') + (r.carOk ? 'Araca bağlı' : 'Adaptör bağlı, araç yok'));
    if (!r.carOk) toast('Araç cevap vermedi. Kontağı açıp "Tekrar dene"ye bas.', 4000);
  }
  render();
}

function connectDevice(addr, name, ble) {
  if (!N.hasBtPermission()) { N.requestBtPermission(); return; }
  stopLive();
  if (S.elm) S.elm.flush();
  S.demo = false; S.sim = null; S.devName = name;
  makeElm(c => N.btSend(c));
  setState('busy', name + ' bağlanıyor…');
  addLog('#', 'Bağlanılıyor: ' + name + ' (' + addr + ')' + (ble ? ' BLE' : ''));
  N.btConnect(addr, !!ble);
}

function startDemo() {
  stopLive();
  if (S.conn && !S.demo) N.btDisconnect();
  if (S.elm) S.elm.flush();
  S.demo = true; S.conn = true; S.devName = 'Demo';
  S.sim = new P.SimElm(t => S.elm && S.elm.onData(t));
  makeElm(c => S.sim.send(c));
  addLog('#', 'Demo modu başladı (gerçek araç değil)');
  afterConnect();
}

function disconnect() {
  stopLive();
  if (S.elm) S.elm.flush();
  if (!S.demo) N.btDisconnect();
  S.conn = false; S.demo = false; S.init = null; S.elm = null; S.sim = null;
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

/* ---------- sekmeler ---------- */
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

/* ---------- Bağlan ---------- */
function vBaglan() {
  const r = S.init;
  let h = '<div class="card"><h2>Durum</h2>';
  if (S.conn && r) {
    h += '<div class="kv"><b>Cihaz</b><span>' + esc(S.devName) + '</span><b>Adaptör</b><span>' + esc(r.version || '?') + '</span>' +
      '<b>Akü</b><span>' + esc(r.voltage || '?') + '</span><b>Araç</b><span>' + (r.carOk ? 'Cevap veriyor ✓' : 'Cevap yok') + '</span>' +
      '<b>PSA erişimi</b><span>' + (r.fcOk ? 'Akış kontrolü destekleniyor ✓' : 'Sınırlı') + '</span></div>';
    if (!r.fcOk) h += '<div class="warn">Bu adaptör akış kontrolü komutlarını (AT FC) desteklemiyor. Kısa cevaplar okunur ama çok kodlu beyinlerde liste eksik gelebilir. Eksik gelirse kodun yanında uyarı çıkar. Kaliteli bir adaptör (Vgate iCar Pro, OBDLink) bu sorunu çözer.</div>';
    if (!r.headers) h += '<div class="warn">Adaptör başlık gösterimini (AT H1) kabul etmedi. Okuma yine denenir ama sonuç güvenilir olmayabilir.</div>';
    h += '<div class="row" style="margin-top:10px">' + (r.carOk ? '<button class="btn pri" onclick="go(\'ariza\')">Arızaları oku →</button>' : '<button class="btn pri" onclick="afterConnect()">Tekrar dene</button>') +
      '<span class="sp"></span><button class="btn red" onclick="disconnect()">Bağlantıyı kes</button></div>';
  } else if (S.conn) {
    h += '<div class="mute">' + esc(S.stateText) + '</div>';
  } else {
    h += '<div class="mute">' + esc(S.stateText) + '</div>';
  }
  h += '</div>';

  if (!S.conn || !r) {
    h += '<div class="card"><h2>Adaptöre bağlan</h2>';
    if (!N.btAvailable()) h += '<div class="warn">Bu cihazda Bluetooth bulunamadı. Demo modunu deneyebilirsin.</div>';
    else if (!N.hasBtPermission()) h += '<div class="info">Adaptöre bağlanmak için Bluetooth izni gerekiyor.</div><button class="btn pri big" onclick="N.requestBtPermission()">Bluetooth izni ver</button>';
    else if (!N.btEnabled()) h += '<div class="info">Bluetooth kapalı.</div><button class="btn pri big" onclick="N.btEnable()">Bluetooth\'u aç</button>';
    else {
      let dev = [];
      try { dev = JSON.parse(N.btBonded() || '[]'); } catch (e) { dev = []; }
      dev.sort((a, b) => (/obd|elm|v-?link|vgate|icar|scan/i.test(b.name) ? 1 : 0) - (/obd|elm|v-?link|vgate|icar|scan/i.test(a.name) ? 1 : 0));
      h += '<div class="mute">Eşleşmiş cihazlar (klasik Bluetooth adaptörler burada görünür):</div><div class="list">';
      if (!dev.length) h += '<div class="item mute">Eşleşmiş cihaz yok.</div>';
      dev.forEach(d => {
        const likely = /obd|elm|v-?link|vgate|icar|scan/i.test(d.name);
        h += '<div class="item"><div class="sp"><div>' + esc(d.name) + (likely ? ' <span class="pill ok">OBD</span>' : '') + '</div><div class="mute small">' + esc(d.address) + '</div></div>' +
          '<button class="btn sm pri" onclick="connectDevice(\'' + esc(d.address) + '\',\'' + esc(String(d.name).replace(/'/g, '')) + '\',false)">Bağlan</button></div>';
      });
      h += '</div><div class="row" style="margin-top:8px"><button class="btn sm" onclick="N.openBtSettings()">Bluetooth ayarları</button>' +
        '<button class="btn sm" onclick="bleScan()">' + (S.scanning ? 'BLE taranıyor…' : 'BLE adaptör tara') + '</button></div>';
      if (S.scanList.length) {
        h += '<div class="list" style="margin-top:8px">';
        S.scanList.forEach(d => {
          h += '<div class="item"><div class="sp"><div>' + esc(d.name) + ' <span class="pill">BLE</span></div><div class="mute small">' + esc(d.address) + '</div></div>' +
            '<button class="btn sm" onclick="connectDevice(\'' + esc(d.address) + '\',\'' + esc(String(d.name).replace(/'/g, '')) + '\',true)">Bağlan</button></div>';
        });
        h += '</div>';
      }
    }
    h += '<div class="info">Adaptörü önce telefonun Bluetooth ayarlarından eşleştir (şifre genelde 1234 veya 0000). Adaptörü direksiyon altındaki OBD soketine tak ve kontağı aç.</div>';
    h += '<button class="btn big" onclick="startDemo()">Demo modunu dene</button></div>';
  }
  h += '<div class="mute small" style="text-align:center">Sürüm ' + esc(N.version()) + '</div>';
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

function setProg(p, text) { S.prog = { p, text }; if (S.view === 'ariza') render(); }

async function fullScan() {
  if (!ready()) return;
  stopLive();
  S.busy = true; N.keepScreenOn(true);
  const km = ($('#km') && $('#km').value.trim()) || S.km;
  S.km = km; save('psa_km', km);
  const res = { date: Date.now(), km, demo: S.demo, adapter: S.init.version, voltage: S.init.voltage, fcOk: S.init.fcOk, vin: '', mil: null, ecus: [], obd: null };
  const steps = P.ECUS.length + 3;
  let n = 0;
  try {
    setProg(0, 'Şase numarası okunuyor…');
    res.vin = await P.readVin(S.elm);
    res.mil = await P.readMil(S.elm);
    setProg(++n / steps, 'Standart OBD kodları…');
    res.obd = await P.readObdCodes(S.elm);
    n++;
    for (const e of P.ECUS) {
      setProg(n / steps, e.name + ' okunuyor…');
      const r = await P.readEcu(S.elm, e);
      res.ecus.push(r);
      S.scan = res;
      n++;
    }
    setProg(1, 'Bitti');
    res.psaBlocked = P.psaBlocked(res);
    S.scan = res;
    saveReport(res);
    const tot = res.ecus.reduce((a, e) => a + e.dtcs.length, 0);
    toast(res.psaBlocked ? 'PSA beyinlerine ulaşılamadı (pin 3/8)' : tot ? tot + ' arıza kodu bulundu' : 'Arıza kodu yok', 3500);
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
  S.busy = true; setProg(.5, e.name + ' okunuyor…');
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
  let warn = 'Arıza hafızası silinir. Önce kodları rapora kaydettik, istersen ustaya gönderebilirsin.';
  if (e.critical) warn = '<div class="warn"><b>' + esc(e.name) + '</b> güvenlik sistemidir. Arıza giderilmeden silmek, sorunu gizler ve uyarı lambası yine yanar. Yalnızca onarımdan sonra sil.</div>';
  if (!await ask(e.name + ' — kodları sil', warn, 'Sil', 'red')) return;
  S.busy = true; setProg(.5, e.name + ' siliniyor…');
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
  let html = 'Kod bulunan ' + withCodes.length + ' beynin arıza hafızası silinecek. Mevcut liste raporlarda kayıtlı.';
  if (crit.length) html += '<div class="warn">' + crit.map(x => esc(x.name)).join(', ') + ' güvenlik sistemi. Arıza giderilmeden silme.</div>';
  if (!await ask('Tüm kodları sil', html, 'Hepsini sil', 'red')) return;
  S.busy = true;
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
  toast('Silme bitti, yeniden okunuyor…');
  fullScan();
}

function dtcHtml(d) {
  let h = '<div class="dtc ' + d.cls + '"><div><span class="c">' + esc(d.full) + '</span><span class="lbl">' + esc(d.label) + '</span></div>' +
    '<div class="d">' + esc(d.desc) + (d.ftbText ? ' — <i>' + esc(d.ftbText) + '</i>' : '') + '</div>' +
    '<div class="mute small">Durum ' + esc(d.statusHex) + ': ' + esc(d.flags.join(', ')) + '</div>';
  if (d.hint) h += '<div class="hint">💡 ' + esc(d.hint) + '</div>';
  return h + '</div>';
}

function ecuHtml(r) {
  let pill;
  if (!r.present) pill = '<span class="pill none">cevap yok</span>';
  else if (!r.read) pill = '<span class="pill bad">okunamadı</span>';
  else if (r.dtcs.length) pill = '<span class="pill bad">' + r.dtcs.length + ' kod</span>';
  else pill = '<span class="pill ok">temiz</span>';
  let h = '<div class="ecu"><div class="head"><div class="sp"><div class="nm">' + esc(r.name) + '</div><div class="mute small">' + esc(r.sub || '') +
    (r.proto ? ' · ' + r.proto : '') + ' · ' + r.tx + '/' + r.rx + '</div></div>' + pill + '</div>';
  if (r.error && r.present) h += '<div class="warn">' + esc(r.error) + '</div>';
  if (r.partial) h += '<div class="warn">Cevap eksik geldi (adaptör çok çerçeveli mesajı tamamlayamadı). Listede olmayan kodlar olabilir.</div>';
  r.dtcs.forEach(d => { h += dtcHtml(d); });
  if (r.present) {
    h += '<div class="row" style="margin-top:8px"><button class="btn sm" onclick="rescanEcu(\'' + r.id + '\')">Yeniden oku</button>';
    if (r.dtcs.length) h += '<button class="btn sm red" onclick="clearOne(\'' + r.id + '\')">Kodları sil</button>';
    h += '</div>';
  }
  return h + '</div>';
}

function vAriza() {
  let h = '<div class="card"><h2>Arıza hafızası</h2><div class="mute">Tüm PSA beyinlerini tarar. Generic uygulamaların göremediği geçmiş (kaçak) arızalar da listelenir.</div>' +
    '<div class="row" style="margin-top:10px"><input id="km" class="grow" inputmode="numeric" placeholder="Güncel km (rapor için, isteğe bağlı)" value="' + esc(S.km) + '"></div>' +
    '<button class="btn pri big" style="margin-top:10px" onclick="fullScan()" ' + (S.busy ? 'disabled' : '') + '>' + (S.busy ? 'Taranıyor…' : 'Tam tarama başlat') + '</button>';
  if (S.prog) h += '<div class="prog"><div style="width:' + Math.round(S.prog.p * 100) + '%"></div></div><div class="mute small">' + esc(S.prog.text) + '</div>';
  h += '</div>';
  const sc = S.scan;
  if (!sc) {
    h += '<div class="card mute">Henüz tarama yapılmadı. Kontak açık olsun; motor çalışırken de tarayabilirsin.</div>';
    return h;
  }
  const all = sc.ecus.flatMap(e => e.dtcs);
  const act = all.filter(d => d.cls === 'aktif').length;
  const past = all.length - act;
  const found = sc.ecus.filter(e => e.present).length;
  h += '<div class="card">' + (sc.demo ? '<div class="info">Demo verisi — gerçek araç değil.</div>' : '') +
    '<div class="sum"><div class="r"><b>' + act + '</b><span class="mute small">aktif</span></div><div class="o"><b>' + past + '</b><span class="mute small">geçmiş / bekleyen</span></div>' +
    '<div class="g"><b>' + found + '</b><span class="mute small">beyin cevap verdi</span></div></div>';
  h += '<div class="kv" style="margin-top:10px">' + (sc.vin ? '<b>Şase no</b><span>' + esc(sc.vin) + '</span>' : '') +
    (sc.mil ? '<b>Arıza lambası</b><span>' + (sc.mil.mil ? 'YANIYOR' : 'Kapalı') + ' (OBD: ' + sc.mil.count + ' kod)</span>' : '') +
    '<b>Tarih</b><span>' + new Date(sc.date).toLocaleString('tr-TR') + '</span></div>';
  if (!S.busy) h += '<div class="row" style="margin-top:10px"><button class="btn sm" onclick="shareScan()">Paylaş</button><span class="sp"></span><button class="btn sm red" onclick="clearAll()">Tüm kodları sil</button></div>';
  h += '</div>';

  if (sc.psaBlocked) {
    h += '<div class="card"><h2>PSA beyinlerine ulaşılamadı</h2>' +
      '<div class="warn">Araç standart OBD\'ye cevap verdi ama hiçbir PSA beyni cevap vermedi. Bu araçta PSA\'nın tanı hattı (Diagbox\'ın kullandığı hat) OBD soketinin <b>3 ve 8 numaralı pinlerinde</b>. Standart ELM327 adaptör ise sadece <b>6 ve 14</b>\'e bağlı. Bu donanım sınırı, uygulama ayarıyla aşılamaz.</div>' +
      '<div class="mute">Çözüm: soketin 3/8 pinlerini adaptörün 6/14 pinlerine yönlendiren bir ara kablo ya da PSA tanı hattını destekleyen bir arayüz. Bağlantı değişince bu uygulama aynen çalışır.</div></div>';
  }

  const order = sc.ecus.slice().sort((a, b) => (b.dtcs.length - a.dtcs.length) || ((b.present ? 1 : 0) - (a.present ? 1 : 0)));
  h += '<div class="card"><h2>Beyinler</h2>';
  order.filter(r => r.present).forEach(r => { h += ecuHtml(r); });
  const none = order.filter(r => !r.present);
  if (none.length) {
    h += '<details><summary>Cevap vermeyen ' + none.length + ' beyin</summary><div class="mute small" style="margin:6px 0">Araçta bu beyin olmayabilir ya da beyin, standart ELM327\'nin bağlı olmadığı PSA tanı hattındadır (OBD pin 3/8).</div>' +
      none.map(r => esc(r.name)).join(', ') + '</details>';
  }
  h += '</div>';

  if (sc.obd) {
    const o = sc.obd;
    h += '<div class="card"><h2>Standart OBD kodları</h2><div class="mute small">Generic uygulamaların gördüğü kısım (mod 03 / 07 / 0A).</div>';
    [['kayitli', 'Kayıtlı'], ['bekleyen', 'Bekleyen'], ['kalici', 'Kalıcı']].forEach(([k, t]) => {
      h += '<div style="margin-top:8px"><b>' + t + ':</b> ' + (!o[k + 'Ok'] ? '<span class="mute">cevap yok</span>' : !o[k].length ? '<span class="mute">yok</span>' :
        o[k].map(c => '<div class="mute small">' + esc(c.code) + ' (' + esc(c.src) + ') — ' + esc(c.desc) + '</div>').join('')) + '</div>';
    });
    h += '</div>';
  }
  return h;
}

/* ---------- Rapor ---------- */
function reportText(sc) {
  const L = [];
  L.push('PSA Teşhis raporu' + (sc.demo ? ' (DEMO)' : ''));
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

function vRapor() {
  let h = '<div class="card"><h2>Kayıtlı raporlar</h2><div class="mute">Her tam taramada otomatik kaydedilir (demo hariç). Ustaya göndermek için paylaşabilirsin.</div></div>';
  if (!S.reports.length) return h + '<div class="card mute">Henüz rapor yok.</div>';
  S.reports.forEach((r, i) => {
    const all = r.ecus.flatMap(e => e.dtcs);
    const codes = all.map(d => d.full).slice(0, 6).join(', ') + (all.length > 6 ? '…' : '');
    h += '<div class="card"><div class="row"><div class="sp"><h3>' + new Date(r.date).toLocaleString('tr-TR') + '</h3><div class="mute small">' +
      (r.km ? esc(r.km) + ' km · ' : '') + all.length + ' kod' + (codes ? ' · ' + esc(codes) : '') + '</div></div></div>' +
      '<details><summary>Raporu göster</summary><pre class="term" style="margin-top:6px">' + esc(reportText(r)) + '</pre></details>' +
      '<div class="row" style="margin-top:8px"><button class="btn sm" onclick="repShare(' + i + ')">Paylaş</button><button class="btn sm" onclick="repFile(' + i + ')">Dosyaya kaydet</button>' +
      '<button class="btn sm" onclick="repOpen(' + i + ')">Arızalar sekmesinde aç</button><span class="sp"></span><button class="btn sm red" onclick="repDel(' + i + ')">Sil</button></div></div>';
  });
  return h;
}
function repShare(i) { N.shareText(reportText(S.reports[i])); }
function repFile(i) {
  const r = S.reports[i]; const d = new Date(r.date);
  const nm = 'psa-rapor-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '.txt';
  N.exportFile(nm, reportText(r));
}
function repOpen(i) { S.scan = JSON.parse(JSON.stringify(S.reports[i])); go('ariza'); }
async function repDel(i) {
  if (!await ask('Raporu sil', 'Bu rapor silinsin mi?', 'Sil', 'red')) return;
  S.reports.splice(i, 1); save('psa_reports', S.reports); render();
}

/* ---------- Canlı veri ---------- */
const SID = k => 't_' + k.replace(/[^a-zA-Z0-9]/g, '_');
const DID_RANGES = [
  { id: 'onerilen', t: 'Önerilen aralıklar (≈1500 değer, 1-2 dk)', r: [[0xD000, 0xD0FF], [0xD400, 0xD4FF], [0x2000, 0x20FF], [0x0100, 0x01FF], [0xF100, 0xF1FF], [0xFD00, 0xFDFF]] },
  { id: 'd4', t: 'D400–D4FF', r: [[0xD400, 0xD4FF]] },
  { id: 'd0', t: 'D000–D0FF', r: [[0xD000, 0xD0FF]] },
  { id: '20', t: '2000–20FF', r: [[0x2000, 0x20FF]] },
  { id: '01', t: '0100–01FF', r: [[0x0100, 0x01FF]] },
  { id: 'f1', t: 'F100–F1FF (kimlik bilgileri)', r: [[0xF100, 0xF1FF]] },
  { id: 'ozel', t: 'Özel aralık…', r: null }
];
const DID_ECUS = ['motor', 'sanziman', 'abs', 'bsi'];

function liveInit() {
  const L = S.live;
  if (!L.inited) {
    L.inited = true;
    L.sel = load('psa_live_sel', P.DEFAULT_LIVE);
    L.custom = load('psa_custom', []);
    L.hist = {}; L.mm = {}; L.raw = {};
    L.scan = { running: false, stopReq: false, prog: null, result: load('psa_did_scan', null), ecu: 'motor', range: 'onerilen' };
  }
  return L;
}

function defOf(key) {
  if (key.startsWith('obd:')) return P.PIDS.find(d => d.key === key) || null;
  const c = S.live.custom.find(x => x.key === key);
  return c ? Object.assign({ unit: c.unit || '', max: 0, isPsa: true }, c) : null;
}

function fmtVal(v) {
  if (v == null) return '–';
  if (typeof v === 'number') return String(v).replace('.', ',');
  return esc(v);
}

function spark(key) {
  const h = S.live.hist[key];
  if (!h || h.length < 2) return '';
  let lo = Math.min(...h), hi = Math.max(...h);
  if (hi === lo) { hi += 1; lo -= 1; }
  const pts = h.map((v, i) => (i * 100 / 59).toFixed(1) + ',' + (22 - (v - lo) / (hi - lo) * 20).toFixed(1)).join(' ');
  return '<svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none"><polyline points="' + pts + '"/></svg>';
}

function tileInner(d) {
  const L = S.live, k = d.key, v = L.vals[k], mm = L.mm[k];
  let h = '<div class="n">' + esc(d.name) + (d.isPsa ? ' <span class="pill">PSA</span>' : '') + '</div>' +
    '<div class="v' + (d.txt ? ' txt' : '') + '">' + fmtVal(v) + '<span class="u">' + esc(d.unit) + '</span></div>';
  if (d.isPsa && L.raw[k]) h += '<div class="mute small">ham: ' + esc(P.toHex(L.raw[k])) + '</div>';
  if (mm && !d.txt) h += '<div class="mute small">en düşük ' + fmtVal(mm.min) + ' · en yüksek ' + fmtVal(mm.max) + '</div>';
  if (!d.txt) h += spark(k);
  return h;
}

function vCanli() {
  const L = liveInit();
  let h = '<div class="card"><h2>Canlı veri</h2>' +
    '<div class="row">' + (L.on ? '<button class="btn red" onclick="stopLive();render()">Durdur</button>' : '<button class="btn pri" onclick="startLive()">Başlat</button>') +
    '<button class="btn" onclick="pickLive()">Değerleri seç (' + L.sel.length + ')</button>' +
    (L.rec ? '<button class="btn red" onclick="recStop()">● Kaydı bitir (' + L.rec.rows.length + ')</button>' : '<button class="btn" onclick="recStart()">Kayıt başlat</button>') +
    '<button class="btn sm" onclick="resetMinMax()">Min/maks sıfırla</button></div>' +
    '<div class="mute small" style="margin-top:8px">Standart değerler doğrudan sokete takılı adaptörle gelir. PSA değerleri (yağ basıncı gibi) için pin 3/8 kablosu gerekir.</div></div>';
  const defs = L.sel.map(defOf).filter(Boolean);
  const shown = defs.filter(d => d.isPsa || !L.sup || L.sup.has(parseInt(d.pid, 16)));
  const hidden = defs.length - shown.length;
  if (!defs.length) h += '<div class="card mute">Hiç değer seçilmedi. "Değerleri seç"e bas.</div>';
  else {
    h += '<div class="tiles">';
    shown.forEach(d => {
      const v = L.vals[d.key];
      const w = typeof v === 'number' && d.warn && d.warn(v);
      h += '<div class="tile' + (w ? ' warnv' : '') + '" id="' + SID(d.key) + '">' + tileInner(d) + '</div>';
    });
    h += '</div>';
    if (hidden) h += '<div class="mute small" style="margin:8px 4px">' + hidden + ' seçili değeri bu araç desteklemiyor, gizlendi.</div>';
  }
  h += vDidCard();
  return h;
}

function pickLive() {
  const L = liveInit();
  const sel = new Set(L.sel);
  const groups = {};
  P.PIDS.forEach(d => {
    const sup = !L.sup || L.sup.has(parseInt(d.pid, 16));
    if (L.sup && !sup) return;
    (groups[d.g] = groups[d.g] || []).push(d);
  });
  let html = L.sup ? '' : '<div class="info">Aracın desteklediği değerler ilk "Başlat"tan sonra belli olur. Şimdilik hepsi listeleniyor.</div>';
  Object.keys(groups).forEach(g => {
    html += '<div class="grp">' + esc(g) + '</div>';
    groups[g].forEach(d => {
      html += '<label class="chk"><input type="checkbox" data-k="' + d.key + '"' + (sel.has(d.key) ? ' checked' : '') + '> ' + esc(d.name) + ' <span class="mute small">' + esc(d.unit) + '</span></label>';
    });
  });
  if (L.custom.length) {
    html += '<div class="grp">PSA özel (motor beyni vb.)</div>';
    L.custom.forEach(c => {
      html += '<label class="chk"><input type="checkbox" data-k="' + esc(c.key) + '"' + (sel.has(c.key) ? ' checked' : '') + '> ' + esc(c.name) + '</label>';
    });
  }
  html += '<div class="mute small" style="margin-top:8px">Az değer seçersen ekran daha hızlı yenilenir.</div>';
  modal('Canlı değerleri seç', '<div class="picker">' + html + '</div>', [{ t: 'Vazgeç', v: false }, { t: 'Varsayılan', v: 'def' }, { t: 'Kaydet', v: true, cls: 'pri' }]).then(v => {
    if (v === 'def') L.sel = P.DEFAULT_LIVE.slice();
    else if (v) {
      const keys = Array.from(document.querySelectorAll('#mBody input[type=checkbox]')).filter(x => x.checked).map(x => x.dataset.k);
      // seçim sırasını koru, yenileri sona ekle
      L.sel = L.sel.filter(k => keys.includes(k)).concat(keys.filter(k => !L.sel.includes(k)));
    } else return;
    save('psa_live_sel', L.sel);
    render();
  });
}

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
  el.innerHTML = tileInner(d);
  el.classList.toggle('warnv', !!(typeof v === 'number' && d.warn && d.warn(v)));
}

function resetMinMax() { S.live.mm = {}; S.live.hist = {}; render(); }

async function startLive() {
  if (!ready()) return;
  const L = liveInit();
  if (!L.sel.length) { pickLive(); return; }
  L.on = true; N.keepScreenOn(true);
  const my = ++L.loop;
  S.busy = true;
  render();
  try {
    if (!L.sup && L.sel.some(k => k.startsWith('obd:'))) { L.sup = await P.supportedPids(S.elm); render(); }
    let round = 0, fails = 0;
    while (L.on && L.loop === my && S.conn) {
      const defs = L.sel.map(defOf).filter(Boolean);
      const obd = defs.filter(d => !d.isPsa && L.sup && L.sup.has(parseInt(d.pid, 16)) && (d.max || round % 5 === 0));
      const psa = defs.filter(d => d.isPsa);
      if (!obd.length && !psa.length) break;
      let got = 0;
      if (obd.length) {
        await P.selectEngineObd(S.elm);
        for (const d of obd) {
          if (!L.on || L.loop !== my) break;
          const v = await P.readPid(S.elm, d);
          if (v != null) { setVal(d, v); got++; }
        }
      }
      for (const d of psa) {
        if (!L.on || L.loop !== my) break;
        const ecu = P.ECUS.find(e => e.id === d.ecu);
        const r = await P.readDid(S.elm, ecu, d.did, d.proto);
        if (r.ok) { setVal(d, P.rawNumber(r.data), r.data); got++; }
      }
      if (L.rec && got) recRow();
      fails = got ? 0 : fails + 1;
      if (fails >= 3) { toast('Değerler okunamıyor. Bağlantıyı kontrol et.', 4000); break; }
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
  L.rec = { t0: Date.now(), keys: L.sel.slice(), rows: [] };
  toast('Kayıt başladı. Canlı veri çalışırken her tur kaydedilir.');
  if (!L.on) startLive(); else render();
}
function recRow() {
  const L = S.live, r = L.rec;
  r.rows.push([((Date.now() - r.t0) / 1000).toFixed(1)].concat(r.keys.map(k => { const v = L.vals[k]; return v == null ? '' : String(v).replace('.', ','); })));
  if (r.rows.length % 10 === 0 && S.view === 'canli') { const b = document.querySelector('[onclick="recStop()"]'); if (b) b.textContent = '● Kaydı bitir (' + r.rows.length + ')'; }
}
function recStop() {
  const L = S.live, r = L.rec;
  L.rec = null;
  if (!r || !r.rows.length) { toast('Kayıtta veri yok'); render(); return; }
  const head = ['zaman_sn'].concat(r.keys.map(k => { const d = defOf(k); return d ? d.name + (d.unit ? ' (' + d.unit + ')' : '') : k; }));
  const csv = '﻿' + [head].concat(r.rows).map(row => row.map(c => /[;"\n]/.test(c) ? '"' + String(c).replace(/"/g, '""') + '"' : c).join(';')).join('\n');
  const d = new Date(r.t0);
  const nm = 'psa-canli-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '.csv';
  N.exportFile(nm, csv);
  render();
}

/* ---------- PSA özel değer tarayıcı ---------- */
function vDidCard() {
  const sc = S.live.scan;
  let h = '<div class="card"><h2>PSA özel değerler</h2>' +
    '<div class="mute">Yağ basıncı gibi değerler standart OBD\'de yok, motor beyninin kendi numaralarıyla okunur. PSA bu numaraları yayınlamıyor. Bu tarayıcı beyne sadece <b>okuma</b> isteği gönderir, hiçbir şey yazmaz. Cevap veren numaraları bulur, sen de canlıya ekleyip değerlerine bakarsın.</div>' +
    '<div class="warn">Pin 3/8 ara kablosu gerekir. Kablo yoksa beyin cevap vermez.</div>';
  if (sc.running) {
    const p = sc.prog || { i: 0, total: 1, found: 0 };
    h += '<div class="prog"><div id="didBar" style="width:' + Math.round(p.i / p.total * 100) + '%"></div></div><div class="mute small" id="didTxt">' + p.i + ' / ' + p.total + ' · bulunan: ' + p.found + '</div>' +
      '<button class="btn red" style="margin-top:8px" onclick="S.live.scan.stopReq=true">Durdur</button>';
  } else {
    h += '<div class="row" style="margin-top:8px"><select id="dEcu">' + DID_ECUS.map(id => { const e = P.ECUS.find(x => x.id === id); return '<option value="' + id + '"' + (sc.ecu === id ? ' selected' : '') + '>' + esc(e.name) + '</option>'; }).join('') + '</select>' +
      '<select id="dRange" class="grow" onchange="S.live.scan.range=this.value;render()">' + DID_RANGES.map(r => '<option value="' + r.id + '"' + (sc.range === r.id ? ' selected' : '') + '>' + esc(r.t) + '</option>').join('') + '</select></div>';
    if (sc.range === 'ozel') h += '<div class="row" style="margin-top:8px"><input id="dS" class="grow" placeholder="Başlangıç (ör. D400)" value="' + esc(sc.s || '') + '" autocapitalize="characters"><input id="dE" class="grow" placeholder="Bitiş (ör. D4FF)" value="' + esc(sc.e || '') + '" autocapitalize="characters"></div>';
    h += '<button class="btn pri big" style="margin-top:8px" onclick="didScan()">Tara</button>';
  }
  const res = sc.result;
  if (res) {
    const e = P.ECUS.find(x => x.id === res.ecu);
    h += '<div style="margin-top:12px"><b>' + esc(e ? e.name : res.ecu) + '</b> <span class="mute small">' + (res.proto || '') + ' · ' + new Date(res.date).toLocaleString('tr-TR') + '</span></div>';
    if (res.error) h += '<div class="warn">' + esc(res.error) + '</div>';
    else if (!res.found.length) h += '<div class="mute">Bu aralıkta cevap veren değer yok. Başka aralık dene.</div>';
    else {
      h += '<div class="mute small" style="margin:6px 0">' + res.found.length + ' değer bulundu. Yağ basıncını bulmak için: rölantide "Değişenleri bul"a bas, sonra devri 2500\'e çıkarıp tekrar bas. Devirle birlikte değişen değerlere bak. Sıcak motorda yağ basıncı rölantide yaklaşık 1-2 bar olur.</div>' +
        '<div class="row"><button class="btn sm" onclick="didChanges()">Değişenleri bul</button><button class="btn sm" onclick="didShare()">Listeyi paylaş</button></div><div class="list" style="margin-top:6px">';
      res.found.forEach((f, i) => {
        const n = P.rawNumber(f.data);
        const added = S.live.custom.some(c => c.key === didKey(res, f));
        h += '<div class="item' + (f.changed ? ' chg' : '') + '"><div class="sp"><div><b class="mono">' + f.hex + '</b>' + (f.changed ? ' <span class="pill bad">değişti</span>' : '') + '</div>' +
          '<div class="mono small">' + esc(P.toHex(f.data)) + (n != null ? ' = ' + n : '') + (f.prevN != null && f.changed ? ' <span class="mute">(önce ' + f.prevN + ')</span>' : '') + '</div></div>' +
          (added ? '<span class="pill ok">canlıda</span>' : '<button class="btn sm" onclick="didAdd(' + i + ')">+ Canlı</button>') + '</div>';
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
  const ecu = P.ECUS.find(e => e.id === sc.ecu);
  sc.running = true; sc.stopReq = false; sc.prog = null;
  S.busy = true; N.keepScreenOn(true);
  render();
  let last = 0;
  try {
    const res = await P.scanDids(S.elm, ecu, ranges, {
      stop: () => sc.stopReq,
      onProgress: (i, total, found) => {
        sc.prog = { i, total, found };
        if (Date.now() - last < 250 && i < total) return;
        last = Date.now();
        const bar = document.getElementById('didBar'), txt = document.getElementById('didTxt');
        if (bar) bar.style.width = Math.round(i / total * 100) + '%';
        if (txt) txt.textContent = i + ' / ' + total + ' · bulunan: ' + found;
      }
    });
    sc.result = { ecu: ecu.id, proto: res.proto, date: Date.now(), error: res.error ? res.error + (res.error === 'Beyin cevap vermedi' ? '. Pin 3/8 ara kablosu takılı mı?' : '') : null,
      found: res.found.map(f => ({ did: f.did, hex: f.hex, data: f.data })) };
    save('psa_did_scan', sc.result);
    addLog('#', 'PSA tarama: ' + ecu.name + ' ' + (res.proto || '-') + ', ' + res.found.length + ' değer' + (res.stopped ? ' (durduruldu)' : ''));
    res.found.forEach(f => addLog('#', '  ' + f.hex + ' = ' + P.toHex(f.data)));
  } catch (e) { addLog('!', 'PSA tarama: ' + e.message); }
  sc.running = false; S.busy = false; N.keepScreenOn(false);
  render();
}

async function didChanges() {
  if (!ready()) return;
  const res = S.live.scan.result;
  if (!res || !res.found.length) return;
  const ecu = P.ECUS.find(e => e.id === res.ecu);
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
  toast(n ? n + ' değer değişti' : 'Değişen değer yok');
  render();
}

function didAdd(i) {
  const L = liveInit(), res = L.scan.result, f = res.found[i];
  const key = didKey(res, f);
  const ecu = P.ECUS.find(e => e.id === res.ecu);
  modal('Canlıya ekle', '<div class="mute">Bu değere bir ad ver (ör. "Yağ basıncı?"). Değer ham sayı olarak gösterilir.</div><input id="mInput" class="grow" style="width:100%;margin-top:10px" value="' + esc(ecu.name + ' ' + f.hex) + '">',
    [{ t: 'Vazgeç', v: false }, { t: 'Ekle', v: true, cls: 'pri' }]).then(ok => {
    if (!ok) return;
    const name = ($('#mInput').value || '').trim() || (ecu.name + ' ' + f.hex);
    L.custom = L.custom.filter(c => c.key !== key).concat([{ key, ecu: res.ecu, did: f.did, proto: res.proto, hex: f.hex, name }]);
    if (!L.sel.includes(key)) L.sel.push(key);
    save('psa_custom', L.custom); save('psa_live_sel', L.sel);
    toast('Canlıya eklendi');
    render();
  });
}

function didShare() {
  const res = S.live.scan.result;
  if (!res) return;
  const e = P.ECUS.find(x => x.id === res.ecu);
  N.shareText('PSA özel değerler — ' + (e ? e.name : res.ecu) + ' (' + res.proto + ')\n' + res.found.map(f => f.hex + ' = ' + P.toHex(f.data) + (P.rawNumber(f.data) != null ? ' (' + P.rawNumber(f.data) + ')' : '') + (f.changed ? '  DEĞİŞTİ' : '')).join('\n'));
}

/* ---------- Log / terminal ---------- */
const BLOCK = /^(27|2E|2F|31|34|35|36|37|3B|3D|11|28|85)/;
function vLog() {
  return '<div class="card"><h2>Ham log</h2><div class="mute">Adaptöre giden (&gt;) ve gelen (&lt;) her şey. Sorun olursa "Paylaş" ile gönder.</div>' +
    '<div class="row" style="margin:10px 0"><button class="btn sm" onclick="N.shareText(S.log.join(\'\\n\'))">Paylaş</button><button class="btn sm" onclick="logFile()">Dosyaya kaydet</button>' +
    '<span class="sp"></span><button class="btn sm" onclick="S.log=[];render()">Temizle</button></div>' +
    '<pre class="term" id="term">' + esc(S.log.join('\n') || '(boş)') + '</pre>' +
    '<div class="row" style="margin-top:10px"><input id="cmd" class="grow" placeholder="Komut (ör. ATRV, 0100)" autocapitalize="characters" onkeydown="if(event.key===\'Enter\')sendCmd()"><button class="btn pri" onclick="sendCmd()">Gönder</button></div>' +
    '<div class="mute small" style="margin-top:6px">Beyne yazma, programlama, güvenlik açma ve sıfırlama komutları güvenlik için engellidir.</div></div>';
}
function logFile() { N.exportFile('psa-log-' + Date.now() + '.txt', S.log.join('\n')); }
async function sendCmd() {
  const el = $('#cmd'); const c = el.value.trim().toUpperCase().replace(/\s+/g, '');
  if (!c) return;
  if (!S.conn || !S.elm) { toast('Bağlı değil'); return; }
  if (S.busy) { toast('Bir işlem sürüyor'); return; }
  if (!c.startsWith('AT') && BLOCK.test(c)) { toast('Bu komut engelli (beyne yazma / programlama riski)', 4000); return; }
  if (c.startsWith('AT') && /^AT(SH|CRA|FC|ST|SP|H|E|S|Z|D|WS)/.test(c)) { S.elm.tx = S.elm.rx = null; S.elm.stCur = null; S.elm.fcMode = S.elm.fcHdr = null; }
  el.value = '';
  await S.elm.cmd(c, 8000);
}

window.onAppResume = () => { if (S.view === 'baglan' && !S.busy) render(); };

render();
