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
  live: { on: false, sup: null, vals: {}, sel: null, loop: 0 },
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
    S.scan = res;
    saveReport(res);
    const tot = res.ecus.reduce((a, e) => a + e.dtcs.length, 0);
    toast(tot ? tot + ' arıza kodu bulundu' : 'Arıza kodu yok', 3000);
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

  const order = sc.ecus.slice().sort((a, b) => (b.dtcs.length - a.dtcs.length) || ((b.present ? 1 : 0) - (a.present ? 1 : 0)));
  h += '<div class="card"><h2>Beyinler</h2>';
  order.filter(r => r.present).forEach(r => { h += ecuHtml(r); });
  const none = order.filter(r => !r.present);
  if (none.length) {
    h += '<details><summary>Cevap vermeyen ' + none.length + ' beyin</summary><div class="mute small" style="margin:6px 0">Araçta bu beyin olmayabilir ya da standart ELM327\'nin bağlanamadığı konfor CAN hattındadır (OBD pin 3/8).</div>' +
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
function vCanli() {
  const L = S.live;
  let h = '<div class="card"><h2>Canlı veri</h2><div class="mute">Motor beyninden standart değerler. Yağ basıncı standart OBD verileri arasında yok; yağ basıncı arızaları Arızalar sekmesinde görünür.</div>' +
    '<div class="row" style="margin-top:10px">' + (L.on ? '<button class="btn red big" onclick="stopLive();render()">Durdur</button>' : '<button class="btn pri big" onclick="startLive()">Başlat</button>') + '</div></div>';
  if (!L.sup) return h + '<div class="card mute">Başlata basınca araç hangi değerleri destekliyorsa onlar gösterilir.</div>';
  const defs = P.PIDS.filter(d => L.sup.has(parseInt(d.pid, 16)));
  if (!defs.length) return h + '<div class="card warn">Motor beyni standart canlı veri vermedi.</div>';
  h += '<div class="tiles">';
  defs.forEach(d => {
    const v = L.vals[d.pid];
    const w = v != null && d.warn && d.warn(v);
    const pct = d.max && v != null ? Math.max(0, Math.min(100, Math.abs(v) / d.max * 100)) : 0;
    h += '<div class="tile' + (w ? ' warnv' : '') + '" id="t' + d.pid + '"><div class="n">' + esc(d.name) + '</div><div class="v">' + (v == null ? '–' : v) + '<span class="u">' + esc(d.unit) + '</span></div>' +
      (d.max ? '<div class="bar"><div style="width:' + pct + '%"></div></div>' : '') + '</div>';
  });
  return h + '</div>';
}

async function startLive() {
  if (!ready()) return;
  const L = S.live;
  L.on = true; N.keepScreenOn(true); render();
  const my = ++L.loop;
  S.busy = true;
  try {
    if (!L.sup) L.sup = await P.supportedPids(S.elm);
    else await P.selectEngineObd(S.elm);
    render();
    const defs = P.PIDS.filter(d => L.sup.has(parseInt(d.pid, 16)));
    const fast = defs.filter(d => d.max);
    const slow = defs.filter(d => !d.max);
    let round = 0;
    while (L.on && L.loop === my && S.conn) {
      const set = round % 5 === 0 ? fast.concat(slow) : fast;
      for (const d of set) {
        if (!L.on || L.loop !== my) break;
        const v = await P.readPid(S.elm, d);
        if (v != null) { L.vals[d.pid] = v; updTile(d); }
      }
      if (!defs.length) break;
      round++;
    }
  } catch (e) { addLog('!', 'Canlı veri: ' + e.message); }
  if (L.loop === my) { L.on = false; S.busy = false; N.keepScreenOn(false); if (S.view === 'canli') render(); }
}
function updTile(d) {
  if (S.view !== 'canli') return;
  const el = document.getElementById('t' + d.pid);
  if (!el) { render(); return; }
  const v = S.live.vals[d.pid];
  el.querySelector('.v').innerHTML = v + '<span class="u">' + esc(d.unit) + '</span>';
  el.classList.toggle('warnv', !!(d.warn && d.warn(v)));
  const b = el.querySelector('.bar > div');
  if (b && d.max) b.style.width = Math.max(0, Math.min(100, Math.abs(v) / d.max * 100)) + '%';
}
function stopLive() {
  const L = S.live;
  if (!L.on) return;
  L.on = false; L.loop++;
  S.busy = false;
  N.keepScreenOn(false);
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
  if (c.startsWith('AT') && /^AT(SH|CRA|FC|ST|SP|H|E|S|Z|D|WS)/.test(c)) { S.elm.tx = S.elm.rx = null; S.elm.stCur = null; }
  el.value = '';
  await S.elm.cmd(c, 8000);
}

window.onAppResume = () => { if (S.view === 'baglan' && !S.busy) render(); };

render();
