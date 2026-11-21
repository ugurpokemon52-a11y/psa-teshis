'use strict';
/* Protokol testleri: sahte ELM327 + PSA aracı ile uçtan uca. Çalıştır: node test/run.js */
const path = require('path');
const A = p => path.join(__dirname, '..', 'app', 'src', 'main', 'assets', p);
['elm.js', 'dtc.js', 'diag.js', 'sim.js'].forEach(f => require(A(f)));
const P = globalThis.PSA;

let fail = 0, pass = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('  HATA:', msg); } }
const ecu = id => P.ECUS.find(e => e.id === id);

function mkPair(opt) {
  const log = [];
  let elm;
  const sim = new P.SimElm(t => elm.onData(t), opt);
  elm = new P.Elm(c => sim.send(c), (d, t) => log.push(d + ' ' + t));
  return { elm, sim, log };
}

async function unit() {
  console.log('Birim: ISO-TP çözücü');
  let r = P.parseResponse('688 10 0F 59 02 FF 05 24 00\r688 21 28 00 16 64 2C 01 35\r688 22 00 50 55 55 55 55 55\r\r', { rx: '688' });
  ok(r.msgs.length === 1 && r.msgs[0].d.length === 15, 'çok çerçeveli birleştirme');
  ok(P.toHex(r.msgs[0].d) === '59 02 FF 05 24 00 28 00 16 64 2C 01 35 00 50', 'veri sırası: ' + P.toHex(r.msgs[0].d));
  r = P.parseResponse('688 03 7F 19 78\r688 03 59 02 FF\r', { rx: '688' });
  const ev = P.evalDiag(r, 0x19);
  ok(ev.pos && !ev.pending, '0x78 sonrası pozitif cevap');
  r = P.parseResponse('NO DATA', { rx: '688' });
  ok(r.err === 'NO DATA' && !r.msgs.length, 'NO DATA');
  r = P.parseResponse('00F\r0: 59 02 FF 05 24 00\r1: 28 00 16 64 2C 01 35\r2: 00 50 00 00 00 00 00', { headers: false });
  ok(r.msgs.length === 1 && r.msgs[0].d.length === 15, 'başlıksız mod');
  r = P.parseResponse('68810 0F 59 02 FF 05 24 00', { rx: '688' });
  ok(r.msgs[0] && r.msgs[0].partial, 'eksik çok çerçeve işaretlenir');
  r = P.parseResponse('7E8 06 41 00 BE 3F B8 13\r7E9 06 41 00 80 00 00 01\r6A8 02 10 03', { rxFilter: P.isObdRx });
  ok(r.msgs.length === 2, 'OBD başlık filtresi');

  console.log('Birim: DTC çözümü');
  ok(P.decode2(0x05, 0x24) === 'P0524', 'P0524');
  ok(P.decode2(0xC1, 0x55) === 'U0155', 'U0155');
  ok(P.decode2(0x41, 0x23) === 'C0123', 'C0123');
  ok(P.decode2(0x92, 0x10) === 'B1210', 'B1210');
  ok(P.udsStatus(0x28).label.startsWith('GEÇMİŞ'), 'UDS 0x28 geçmiş');
  ok(P.udsStatus(0x09).label === 'AKTİF', 'UDS 0x09 aktif');
  ok(P.kwpStatus(0x20).label.startsWith('GEÇMİŞ'), 'KWP 0x20 geçmiş');
  ok(P.kwpStatus(0x60).label === 'AKTİF', 'KWP 0x60 aktif');
  ok(/Üreticiye özel/.test(P.describe('P1336')), 'üretici kodu');
  ok(P.describe('P0524') === 'Motor yağ basıncı çok düşük', 'P0524 açıklama');
}

async function e2e(opt, label) {
  console.log('Uçtan uca: ' + label);
  const { elm, log } = mkPair(opt);
  const init = await elm.init();
  ok(init.ok && init.carOk, 'init + araç: ' + init.msg);
  ok(/ELM327 v1.5/.test(init.version), 'sürüm');
  ok(init.voltage === '12.6V', 'voltaj ' + init.voltage);
  ok(init.fcOk === (opt.fcSupported !== false), 'akış kontrolü tespiti');

  const res = {};
  for (const e of P.ECUS) res[e.id] = await P.readEcu(elm, e);

  const m = res.motor;
  if (opt.fcSupported === false) {
    ok(m.present && m.partial, 'akış kontrolü yokken motor cevabı eksik işaretlenir');
  } else {
    ok(m.present && m.read && m.proto === 'UDS', 'motor UDS okundu');
    ok(m.dtcs.length === 2, 'motor 2 kod (0x50 süzüldü): ' + m.dtcs.map(d => d.full).join(','));
    ok(m.dtcs[0].full === 'P0524-00' && m.dtcs[0].label.startsWith('GEÇMİŞ'), 'P0524 geçmiş');
    ok(m.dtcs[1].full === 'P0016-64', 'P0016-64');
    ok(res.bsi.dtcs.length === 1 && res.bsi.dtcs[0].code === 'U0155', 'BSI U0155');
  }
  const g = res.sanziman;
  ok(g.present && g.read && g.proto === 'KWP' && g.dtcs.length === 1 && g.dtcs[0].code === 'P0715', 'şanzıman KWP P0715');
  ok(res.abs.read && res.abs.dtcs.length === 0, 'ABS temiz');
  ok(res.airbag.read && res.airbag.dtcs.length === 0, 'airbag maske yedeği (2F)');
  ok(!res.radyo.present && res.radyo.error === 'Cevap yok', 'radyo cevap yok');

  const obd = await P.readObdCodes(elm);
  ok(obd.kayitliOk && obd.kayitli.length === 0 && obd.bekleyenOk, 'OBD mod 03/07');
  const vin = await P.readVin(elm);
  ok(vin === 'VF7NC5GZTFY000000', 'VIN ' + vin);
  const mil = await P.readMil(elm);
  ok(mil && mil.mil === false, 'MIL');

  if (opt.fcSupported !== false) {
    const c = await P.clearEcu(elm, ecu('motor'), 'UDS');
    ok(c.ok, 'motor silme (0x78 bekleme ile)');
    const again = await P.readEcu(elm, ecu('motor'));
    ok(again.read && again.dtcs.length === 0, 'silme sonrası motor temiz');
    const c2 = await P.clearEcu(elm, ecu('sanziman'), 'KWP');
    ok(c2.ok, 'şanzıman KWP silme');
  }

  const sup = await P.supportedPids(elm);
  ok(sup.has(0x0C) && sup.has(0x5C) && !sup.has(0x23), 'desteklenen PID listesi');
  const rpm = await P.readPid(elm, P.PIDS.find(p => p.pid === '0C'));
  ok(rpm > 700 && rpm < 950, 'devir ' + rpm);
  const vbat = await P.readPid(elm, P.PIDS.find(p => p.pid === '42'));
  ok(Math.abs(vbat - 14.22) < 0.01, 'voltaj ' + vbat);
  ok(elm.countOk === true, 'cevap sayısı eki destekleniyor');
  ok(!log.some(l => l.includes('geç gelen')), 'geç cevap karışması yok');
}

(async () => {
  await unit();
  await e2e({}, 'normal adaptör');
  await e2e({ fcSupported: false }, 'akış kontrolü desteklemeyen klon');
  console.log(`\n${pass} geçti, ${fail} hata`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
