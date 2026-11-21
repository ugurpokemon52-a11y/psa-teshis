'use strict';
/* PSA Teşhis — beyin listesi, arıza hafızası okuma/silme, OBD standart kodlar, canlı veri */
(function (G) {
  const P = G.PSA = G.PSA || {};

  // CAN tanı adresleri (istek:cevap). Kaynak: ludwig-v/arduino-psa-diag ECU_LIST
  P.ECUS = [
    { id: 'motor', name: 'Motor beyni', sub: 'Enjeksiyon', tx: '6A8', rx: '688' },
    { id: 'sanziman', name: 'Şanzıman', sub: 'EAT6 / AM6 otomatik', tx: '6A9', rx: '689' },
    { id: 'abs', name: 'ABS / ESP', sub: 'Fren ve denge kontrol', tx: '6AD', rx: '68D', critical: true },
    { id: 'airbag', name: 'Airbag', sub: 'Hava yastığı', tx: '744', rx: '644', critical: true },
    { id: 'bsi', name: 'BSI', sub: 'Ana elektrik / konfor beyni', tx: '752', rx: '652' },
    { id: 'gosterge', name: 'Gösterge paneli', sub: 'Kombine', tx: '75F', rx: '65F' },
    { id: 'direksiyon', name: 'Elektrikli direksiyon', sub: 'EPS', tx: '6B5', rx: '695', critical: true },
    { id: 'park', name: 'Park sensörü', sub: 'AAS', tx: '75D', rx: '65D' },
    { id: 'klima', name: 'Klima', sub: 'Otomatik klima', tx: '76D', rx: '66D' },
    { id: 'radyo', name: 'Radyo', sub: 'Ses sistemi', tx: '760', rx: '660' },
    { id: 'ekran', name: 'Ekran', sub: 'Çok fonksiyonlu ekran', tx: '765', rx: '665' },
    { id: 'multimedya', name: 'Multimedya', sub: 'Navigasyon / telematik', tx: '764', rx: '664' }
  ];

  const OBD_SRC = { '7E8': 'Motor', '7E9': 'Şanzıman', '7EA': 'Hibrit / diğer', '7EB': 'Diğer' };

  /* ---------- PSA beyni: arıza hafızası ---------- */

  async function openSession(elm, R) {
    const s = await elm.diag('1003');
    if (s.pos) { R.present = true; R.proto = 'UDS'; return; }
    if (s.any) R.present = true;
    const k = await elm.diag('10C0');
    if (k.pos) { R.present = true; R.proto = 'KWP'; return; }
    if (k.any) R.present = true;
    const k2 = await elm.diag('81');
    if (k2.pos) { R.present = true; R.proto = 'KWP'; return; }
    if (k2.any) R.present = true;
  }

  function parseUds(d) {
    // 59 02 <maske> [DTC_H DTC_M FTB DURUM] ...
    const out = [];
    for (let i = 3; i + 3 < d.length; i += 4) {
      const st = d[i + 3];
      if (!(st & 0xAF)) continue; // sadece "test tamamlanmadı" bitleri: arıza değil
      if (!d[i] && !d[i + 1] && !d[i + 2]) continue;
      out.push(P.mkDtc(d[i], d[i + 1], d[i + 2], st, 'UDS'));
    }
    return out;
  }

  function parseKwp(d) {
    // 57/58 <adet> [DTC_H DTC_L DURUM] ... (bazı beyinlerde 4 baytlık kayıt)
    const n = d[1], body = d.slice(2);
    const size = n > 0 && body.length === n * 4 ? 4 : 3;
    const out = [];
    for (let i = 0; i + size <= body.length; i += size) {
      const b = body.slice(i, i + size);
      if (!b[0] && !b[1]) continue;
      out.push(P.mkDtc(b[0], b[1], size === 4 ? b[2] : null, b[size - 1], 'KWP'));
    }
    return out;
  }

  async function readUds(elm, R) {
    for (const mask of ['FF', '2F', '09']) {
      const r = await elm.diag('1902' + mask);
      if (r.pos && r.pos[1] === 0x02) { R.partial = r.partial; return parseUds(r.pos); }
      if (r.nrc != null) R.lastNrc = r.nrc;
      if (r.nrc === 0x11 || !r.any) return null;
    }
    return null;
  }

  async function readKwp(elm, R) {
    for (const req of ['17FF00', '1802FF00', '1800FF00']) {
      const r = await elm.diag(req);
      if (r.pos) { R.partial = r.partial; return parseKwp(r.pos); }
      if (r.nrc != null) R.lastNrc = r.nrc;
    }
    return null;
  }

  async function readEcu(elm, ecu) {
    const R = { id: ecu.id, name: ecu.name, sub: ecu.sub, tx: ecu.tx, rx: ecu.rx, present: false, proto: null,
      dtcs: [], read: false, partial: false, error: null, lastNrc: null };
    if (!await elm.select(ecu.tx, ecu.rx)) {
      R.error = 'Adaptör bu adresi kabul etmedi (ATSH). Adaptör PSA beyinlerine erişemiyor.';
      return R;
    }
    await openSession(elm, R);
    if (!R.present) { R.error = 'Cevap yok'; return R; }
    let list = null;
    if (R.proto !== 'KWP') {
      list = await readUds(elm, R);
      if (list) R.proto = 'UDS';
    }
    if (!list) {
      list = await readKwp(elm, R);
      if (list) R.proto = 'KWP';
    }
    if (!list) {
      R.error = 'Beyin cevap verdi ama arıza hafızası okunamadı' + (R.lastNrc != null ? ' — ' + P.nrcText(R.lastNrc) : '');
      return R;
    }
    R.read = true;
    R.dtcs = list;
    return R;
  }

  async function clearEcu(elm, ecu, proto) {
    if (!await elm.select(ecu.tx, ecu.rx)) return { ok: false, msg: 'Adres ayarlanamadı' };
    if (proto === 'KWP') {
      const s = await elm.diag('10C0');
      if (!s.pos) await elm.diag('81');
      const r = await elm.diag('14FF00');
      if (r.pos) return { ok: true };
      return { ok: false, msg: r.nrc != null ? 'Beyin reddetti: ' + P.nrcText(r.nrc) : 'Cevap yok' };
    }
    await elm.diag('1003');
    const r = await elm.diag('14FFFFFF');
    if (r.pos) return { ok: true };
    return { ok: false, msg: r.nrc != null ? 'Beyin reddetti: ' + P.nrcText(r.nrc) : 'Cevap yok' };
  }

  /* ---------- Standart OBD (mod 03 / 07 / 0A) ---------- */

  async function readObdCodes(elm) {
    await elm.selectFunctional();
    const out = {};
    for (const [mode, key] of [['03', 'kayitli'], ['07', 'bekleyen'], ['0A', 'kalici']]) {
      const r = await elm.request(mode, { rx: null, rxFilter: P.isObdRx, timeout: 7000 });
      const want = parseInt(mode, 16) + 0x40;
      const list = [];
      let answered = false;
      for (const m of r.msgs) {
        if (m.d[0] !== want) continue;
        answered = true;
        let d = m.d.slice(1);
        if (d.length % 2 === 1) d = d.slice(1); // CAN'de ilk bayt kod sayısı
        for (let i = 0; i + 1 < d.length; i += 2) {
          if (!d[i] && !d[i + 1]) continue;
          const code = P.decode2(d[i], d[i + 1]);
          list.push({ code, desc: P.describe(code), src: OBD_SRC[m.h] || (m.h || 'Motor') });
        }
      }
      out[key] = list;
      out[key + 'Ok'] = answered;
    }
    return out;
  }

  async function clearObd(elm) {
    await elm.selectFunctional();
    const r = await elm.request('04', { rx: null, rxFilter: P.isObdRx, timeout: 7000 });
    return r.msgs.some(m => m.d[0] === 0x44);
  }

  async function readVin(elm) {
    await elm.selectFunctional();
    const r = await elm.request('0902', { rx: null, rxFilter: P.isObdRx, timeout: 7000 });
    for (const m of r.msgs) {
      if (m.d[0] === 0x49 && m.d[1] === 0x02) {
        const s = m.d.slice(3).filter(b => b >= 0x20 && b < 0x7F).map(b => String.fromCharCode(b)).join('').trim();
        if (s.length >= 11) return s;
      }
    }
    return '';
  }

  async function readMil(elm) {
    await elm.selectFunctional();
    const r = await elm.request('0101', { rx: null, rxFilter: P.isObdRx, timeout: 6000 });
    for (const m of r.msgs) {
      if (m.d[0] === 0x41 && m.d[1] === 0x01 && m.d.length >= 3) return { mil: !!(m.d[2] & 0x80), count: m.d[2] & 0x7F };
    }
    return null;
  }

  /* ---------- Canlı veri (motor beyni, standart PID) ---------- */

  const W = (a, b) => a * 256 + b;
  P.PIDS = [
    { pid: '0C', name: 'Motor devri', unit: 'dev/dk', f: d => Math.round(W(d[0], d[1]) / 4), max: 7000 },
    { pid: '0D', name: 'Hız', unit: 'km/s', f: d => d[0], max: 220 },
    { pid: '05', name: 'Soğutma suyu', unit: '°C', f: d => d[0] - 40, max: 130, warn: v => v >= 110 },
    { pid: '5C', name: 'Motor yağı sıcaklığı', unit: '°C', f: d => d[0] - 40, max: 150, warn: v => v >= 130 },
    { pid: '0F', name: 'Emme havası', unit: '°C', f: d => d[0] - 40, max: 80 },
    { pid: '04', name: 'Motor yükü', unit: '%', f: d => Math.round(d[0] * 100 / 255), max: 100 },
    { pid: '11', name: 'Gaz kelebeği', unit: '%', f: d => Math.round(d[0] * 100 / 255), max: 100 },
    { pid: '0B', name: 'Emme basıncı (MAP)', unit: 'kPa', f: d => d[0], max: 255 },
    { pid: '10', name: 'Hava akışı (MAF)', unit: 'g/s', f: d => +(W(d[0], d[1]) / 100).toFixed(1), max: 150 },
    { pid: '0E', name: 'Ateşleme avansı', unit: '°', f: d => +(d[0] / 2 - 64).toFixed(1), max: 60 },
    { pid: '06', name: 'Kısa yakıt düzeltme', unit: '%', f: d => +((d[0] - 128) * 100 / 128).toFixed(1), max: 25, warn: v => Math.abs(v) >= 20 },
    { pid: '07', name: 'Uzun yakıt düzeltme', unit: '%', f: d => +((d[0] - 128) * 100 / 128).toFixed(1), max: 25, warn: v => Math.abs(v) >= 15 },
    { pid: '23', name: 'Yakıt rayı basıncı', unit: 'bar', f: d => +(W(d[0], d[1]) * 10 / 100).toFixed(1), max: 250 },
    { pid: '42', name: 'Beyin voltajı', unit: 'V', f: d => +(W(d[0], d[1]) / 1000).toFixed(2), max: 16, warn: v => v < 11.8 || v > 15 },
    { pid: '33', name: 'Atmosfer basıncı', unit: 'kPa', f: d => d[0], max: 110 },
    { pid: '46', name: 'Dış hava', unit: '°C', f: d => d[0] - 40, max: 60 },
    { pid: '2F', name: 'Yakıt seviyesi', unit: '%', f: d => Math.round(d[0] * 100 / 255), max: 100 },
    { pid: '1F', name: 'Çalışma süresi', unit: 'sn', f: d => W(d[0], d[1]), max: 0 },
    { pid: '31', name: 'Kod silindikten sonra yol', unit: 'km', f: d => W(d[0], d[1]), max: 0 },
    { pid: '30', name: 'Kod silindikten sonra ısınma', unit: 'kez', f: d => d[0], max: 0 },
    { pid: '21', name: 'Arıza lambası yanıkken yol', unit: 'km', f: d => W(d[0], d[1]), max: 0 }
  ];

  async function selectEngineObd(elm) {
    return elm.select('7E0', '7E8');
  }

  async function obdQuery(elm, pid) {
    let cmd = '01' + pid;
    if (elm.countOk === null) {
      const r = await elm.request(cmd + '1', { timeout: 3000 });
      const ok = r.msgs.some(m => m.d[0] === 0x41 && m.d[1] === parseInt(pid, 16));
      elm.countOk = ok;
      if (ok) return r;
      return elm.request(cmd, { timeout: 3000 });
    }
    return elm.request(cmd + (elm.countOk ? '1' : ''), { timeout: 3000 });
  }

  async function supportedPids(elm) {
    await selectEngineObd(elm);
    const sup = new Set();
    for (const base of [0x00, 0x20, 0x40]) {
      if (base && !sup.has(base)) break;
      const r = await obdQuery(elm, P.h2(base));
      const m = r.msgs.find(x => x.d[0] === 0x41 && x.d[1] === base && x.d.length >= 6);
      if (!m) break;
      for (let i = 0; i < 32; i++) if (m.d[2 + (i >> 3)] & (0x80 >> (i & 7))) sup.add(base + i + 1);
    }
    return sup;
  }

  async function readPid(elm, def) {
    const id = parseInt(def.pid, 16);
    const r = await obdQuery(elm, def.pid);
    const m = r.msgs.find(x => x.d[0] === 0x41 && x.d[1] === id && x.d.length >= 3);
    if (!m) return null;
    try { return def.f(m.d.slice(2)); } catch (e) { return null; }
  }

  Object.assign(P, { readEcu, clearEcu, readObdCodes, clearObd, readVin, readMil, supportedPids, readPid, selectEngineObd, parseUds, parseKwp });
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
