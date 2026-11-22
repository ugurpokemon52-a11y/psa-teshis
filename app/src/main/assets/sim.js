'use strict';
/* PSA Teşhis — demo modu: ELM327 adaptörü ve PSA aracını taklit eder (gerçek ELM metin biçimiyle). */
(function (G) {
  const P = G.PSA = G.PSA || {};
  const h2 = n => (n & 0xFF).toString(16).toUpperCase().padStart(2, '0');
  const fromHex = s => { const o = []; for (let i = 0; i + 1 < s.length; i += 2) o.push(parseInt(s.substr(i, 2), 16)); return o; };
  const eq = (a, s) => a.map(h2).join('') === s;

  function makeCar() {
    return {
      // Motor: UDS. P0524 geçmiş, P0016 geçmiş, bir de "test tamamlanmadı" kaydı (listelenmemeli)
      '6A8': { rx: '688', proto: 'UDS', dtc: [[0x05, 0x24, 0x00, 0x28], [0x00, 0x16, 0x64, 0x2C], [0x01, 0x35, 0x00, 0x50]] },
      // Şanzıman: KWP
      '6A9': { rx: '689', proto: 'KWP', dtc: [[0x07, 0x15, 0x20]] },
      '6AD': { rx: '68D', proto: 'UDS', dtc: [] },
      // Airbag: FF maskesini reddeder, 2F ile okunur
      '744': { rx: '644', proto: 'UDS', dtc: [], rejectFF: true },
      // BSI: gösterge ile iletişim kaybı (geçmiş)
      '752': { rx: '652', proto: 'UDS', dtc: [[0xC1, 0x55, 0x87, 0x2C]] },
      '75F': { rx: '65F', proto: 'UDS', dtc: [] }
    };
  }

  class SimElm {
    constructor(onData, opt) {
      opt = opt || {};
      this.onData = onData;
      this.echo = true; this.hdrOn = false; this.spaces = true;
      this.sh = '7DF'; this.cra = null;
      this.fcSupported = opt.fcSupported !== false;
      this.fcUserBroken = !!opt.fcUserBroken; // mod 1 'OK' der ama çalışmaz (senin adaptör)
      this.psaBlocked = !!opt.psaBlocked;     // PSA tanı hattı pin 3/8'de: üretici adresleri cevap vermez
      this.fcMode = '0';
      this.car = makeCar();
      this.delay = opt.delay == null ? 25 : opt.delay;
      this.t0 = Date.now();
    }

    send(cmd) {
      const out = this.handle(String(cmd).trim().toUpperCase());
      setTimeout(() => this.onData(out + '\r\r>'), this.delay + Math.random() * this.delay);
    }

    handle(c) {
      const echo = this.echo ? c + '\r' : '';
      const s = c.replace(/\s/g, '');
      if (s.startsWith('AT')) return echo + this.at(s.slice(2));
      if (!/^[0-9A-F]+$/.test(s)) return echo + '?';
      const data = s.length % 2 === 1 ? s.slice(0, -1) : s;
      let resps = this.route(fromHex(data));
      if (this.cra) resps = resps.filter(r => r.h === this.cra);
      if (!resps.length) return echo + 'NO DATA';
      const lines = [];
      for (const r of resps) lines.push(...this.frames(r.h, r.d));
      return echo + lines.join('\r');
    }

    at(a) {
      if (a === 'Z') { this.echo = true; this.hdrOn = false; this.sh = '7DF'; this.cra = null; return '\r\rELM327 v1.5'; }
      if (a === 'I') return 'ELM327 v1.5';
      if (a === 'RV') return '12.6V';
      if (a === 'E0') { this.echo = false; return 'OK'; }
      if (a === 'H1') { this.hdrOn = true; return 'OK'; }
      if (a === 'H0') { this.hdrOn = false; return 'OK'; }
      if (a === 'S0') { this.spaces = false; return 'OK'; }
      if (a === 'S1') { this.spaces = true; return 'OK'; }
      if (a.startsWith('SH')) { this.sh = a.slice(2); return 'OK'; }
      if (a === 'CRA') { this.cra = null; return 'OK'; }
      if (a.startsWith('CRA')) { this.cra = a.slice(3); return 'OK'; }
      if (a.startsWith('FCSM')) { if (!this.fcSupported) return '?'; this.fcMode = a.slice(4); return 'OK'; }
      if (a.startsWith('FC')) return this.fcSupported ? 'OK' : '?';
      return 'OK';
    }

    fmt(h, bytes) {
      const b = bytes.map(h2);
      if (!this.hdrOn) return this.spaces ? b.join(' ') : b.join('');
      return this.spaces ? h + ' ' + b.join(' ') : h + b.join('');
    }

    frames(h, d) {
      const pad = a => { const x = a.slice(); while (x.length < 8) x.push(0x55); return x; };
      if (d.length <= 7) return [this.fmt(h, pad([d.length, ...d]))];
      const out = [this.fmt(h, [0x10 | (d.length >> 8), d.length & 0xFF, ...d.slice(0, 6)])];
      const obd = this.sh === '7DF' || this.sh === '7E0';
      if (!this.fcSupported && !obd) return out; // yanlış akış kontrolü: devamı gelmez
      if (this.fcUserBroken && this.fcMode === '1') return out;
      let sn = 1;
      for (let i = 6; i < d.length; i += 7) { out.push(this.fmt(h, pad([0x20 | (sn & 0x0F), ...d.slice(i, i + 7)]))); sn++; }
      return out;
    }

    route(req) {
      if (this.sh === '7DF') return this.obd(req);
      if (this.sh === '7E0') {
        if (req[0] === 0x3E || req[0] === 0x10 || req[0] === 0x22) return this.obdUds(req, '7E8', 'motor');
        return this.obd(req);
      }
      if (this.sh === '7E1') {
        if (req[0] === 0x3E || req[0] === 0x10 || req[0] === 0x22) return this.obdUds(req, '7E9', 'eat6');
        return [];
      }
      const e = this.car[this.sh];
      if (!e || this.psaBlocked) return [];
      const R = d => [{ h: e.rx, d }];
      const sid = req[0];
      if (e.proto === 'UDS') {
        if (eq(req, '1003')) return R([0x50, 0x03, 0x00, 0x32, 0x01, 0xF4]);
        if (eq(req, '3E00')) return R([0x7E, 0x00]);
        if (sid === 0x19 && req[1] === 0x02) {
          if (e.rejectFF && req[2] === 0xFF) return R([0x7F, 0x19, 0x31]);
          const out = [0x59, 0x02, 0xFF];
          for (const x of e.dtc) if (x[3] & req[2]) out.push(...x);
          return R(out);
        }
        if (eq(req, '14FFFFFF')) { e.dtc = []; return [{ h: e.rx, d: [0x7F, 0x14, 0x78] }, { h: e.rx, d: [0x54] }]; }
        if (sid === 0x22 && req.length === 3) {
          const did = req[1] * 256 + req[2];
          const t = (Date.now() - this.t0) / 1000;
          const v = this.did(did, t);
          return v ? R([0x62, req[1], req[2], ...v]) : R([0x7F, 0x22, 0x31]);
        }
        return R([0x7F, sid, 0x11]);
      }
      if (eq(req, '10C0')) return R([0x50, 0xC0]);
      if (eq(req, '3E')) return R([0x7E]);
      if (eq(req, '17FF00')) { const out = [0x57, e.dtc.length]; for (const x of e.dtc) out.push(...x); return R(out); }
      if (eq(req, '14FF00')) { e.dtc = []; return R([0x54, 0xFF, 0x00]); }
      if (sid === 0x21 && req.length === 2) {
        if (req[1] === 0x05) return R([0x61, 0x05, 40 + 78]);
        return R([0x7F, 0x21, 0x12]);
      }
      return R([0x7F, sid, 0x12]);
    }

    // Demo: OBD pin 6/14 üzerinden UDS 0x22 (Motor 7E0 & EAT6 7E1)
    obdUds(req, rx, kind) {
      const R = d => [{ h: rx, d }];
      if (eq(req, '3E00')) return R([0x7E, 0x00]);
      if (eq(req, '1003')) return R([0x50, 0x03, 0x00, 0x32, 0x01, 0xF4]);
      if (req[0] === 0x22 && req.length === 3) {
        const did = req[1] * 256 + req[2];
        const t = (Date.now() - this.t0) / 1000;
        if (kind === 'motor') {
          const op = Math.round(2600 + 250 * Math.sin(t)); // mbar
          if (did === 0xD40A) return R([0x62, req[1], req[2], op >> 8, op & 0xFF]);
          if (did === 0xD40B) return R([0x62, req[1], req[2], 0x0B, 0xB8]);
          if (did === 0xD412) return R([0x62, req[1], req[2], 0x63]);
          if (did === 0xF190) return R([0x62, req[1], req[2], ...'VF7NC5GZTFY000000'.split('').map(c => c.charCodeAt(0))]);
        } else if (kind === 'eat6') {
          const atf = 40 + Math.round(76 + 2 * Math.sin(t * 0.2)); // EAT6 yağ sıcaklığı (~76°C)
          if (did === 0xD401) return R([0x62, req[1], req[2], atf]);
          if (did === 0xD402) return R([0x62, req[1], req[2], 0x00, 0x01]); // Vites P/N/1
        }
        return R([0x7F, 0x22, 0x31]);
      }
      return R([0x7F, req[0], 0x11]);
    }

    // Demo: motor beyninde birkaç üretici tanımlayıcısı (gerçek PSA numaraları değil)
    did(did, t) {
      if (this.sh !== '6A8') return null;
      const op = Math.round(2600 + 250 * Math.sin(t)); // mbar
      if (did === 0xD40A) return [op >> 8, op & 0xFF];
      if (did === 0xD40B) return [0x0B, 0xB8];
      if (did === 0xD412) return [0x63];
      if (did === 0xF190) return 'VF7NC5GZTFY000000'.split('').map(c => c.charCodeAt(0));
      return null;
    }

    obd(req) {
      const E = d => ({ h: '7E8', d });
      const T = d => ({ h: '7E9', d });
      const t = (Date.now() - this.t0) / 1000;
      const rpm = 820 + Math.round(60 * Math.sin(t));
      const m = req[0], pid = req[1];
      if (m === 0x03) return [E([0x43, 0x00]), T([0x43, 0x00])];
      if (m === 0x07) return [E([0x47, 0x00])];
      if (m === 0x0A) return [E([0x4A, 0x00])];
      if (m === 0x04) return [E([0x44])];
      if (m === 0x09 && pid === 0x02) {
        const vin = 'VF7NC5GZTFY000000';
        return [E([0x49, 0x02, 0x01, ...vin.split('').map(c => c.charCodeAt(0))])];
      }
      if (m !== 0x01) return [];
      const cat = (430 + 40 + Math.round(12 * Math.sin(t * 0.4))) * 10;
      const v = {
        0x00: [0xBE, 0x3F, 0xB8, 0x13], 0x20: [0x80, 0x07, 0xA0, 0x11], 0x40: [0xFE, 0xD0, 0x00, 0x10],
        0x01: [0x00, 0x07, 0xE5, 0x00], 0x03: [0x02, 0x00],
        0x04: [Math.round(255 * (0.22 + 0.04 * Math.sin(t * 0.8)))],
        0x05: [40 + Math.round(88 + 2 * Math.sin(t * 0.25))],
        0x06: [128 + Math.round(2 + 2 * Math.sin(t * 0.6))], 0x07: [128 - 3],
        0x0B: [34 + Math.round(5 * Math.sin(t * 0.9))],
        0x0C: [(rpm * 4) >> 8, (rpm * 4) & 0xFF], 0x0D: [0],
        0x0E: [64 * 2 + 16 + Math.round(2 * Math.sin(t))], 0x0F: [40 + 24],
        0x10: [0x01, 0x90], 0x11: [Math.round(255 * (0.14 + 0.02 * Math.sin(t)))],
        0x14: [142 + Math.round(18 * Math.sin(t * 1.4)), 128], 0x15: [132, 128],
        0x1C: [6], 0x1F: [0x01, 0x2C + (Math.floor(t) & 0xFF)],
        0x21: [0x00, 0x00], 0x23: [0x0F, 0xA0], 0x2E: [Math.round(255 * 0.16)],
        0x2F: [148], 0x30: [12], 0x31: [0x01, 0x40], 0x33: [101],
        0x3C: [cat >> 8, cat & 0xFF],
        0x42: [0x37, 0x8C], 0x43: [0x00, Math.round(255 * 0.24)], 0x44: [0x80, 0x00],
        0x45: [Math.round(255 * 0.08)], 0x46: [40 + 14], 0x47: [Math.round(255 * 0.14)],
        0x49: [Math.round(255 * 0.15)], 0x4A: [Math.round(255 * 0.08)], 0x4C: [Math.round(255 * 0.14)],
        0x5C: [40 + Math.round(92 + 2 * Math.sin(t * 0.2))]
      }[pid];
      return v ? [E([0x41, pid, ...v])] : [];
    }
  }

  P.SimElm = SimElm;
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
