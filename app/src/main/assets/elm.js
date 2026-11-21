'use strict';
/* PSA Teşhis — ELM327 sürücüsü, ISO-TP çözücü, UDS / KWP2000 istekleri.
   Tarayıcıda (WebView) ve Node testlerinde aynı kod çalışır: her şey globalThis.PSA altında. */
(function (G) {
  const P = G.PSA = G.PSA || {};

  const h2 = n => (n & 0xFF).toString(16).toUpperCase().padStart(2, '0');
  const toHex = a => Array.from(a || []).map(h2).join(' ');
  const fromHex = s => {
    s = String(s || '').replace(/[^0-9A-Fa-f]/g, '');
    const o = [];
    for (let i = 0; i + 1 < s.length; i += 2) o.push(parseInt(s.substr(i, 2), 16));
    return o;
  };

  const ERRS = ['NO DATA', 'CAN ERROR', 'BUS ERROR', 'BUS BUSY', 'UNABLE TO CONNECT', 'STOPPED',
    'BUFFER FULL', 'FB ERROR', 'DATA ERROR', 'RX ERROR', 'ACT ALERT', 'LV RESET', 'ERR'];
  const DEFAULT_ST = '64'; // 100 x 4 ms ≈ 400 ms

  function lines(text) {
    return String(text || '').replace(/\r/g, '\n').split('\n')
      .map(l => l.trim()).filter(l => l && l !== '>' && !/^SEARCHING/i.test(l));
  }

  /* ELM327 metin cevabını CAN mesajlarına çevirir (ISO-TP birleştirme dahil).
     opt.headers: ATH1 açık mı; opt.rx: sadece bu başlık; opt.rxFilter: başlık filtresi fonksiyonu */
  function parseResponse(text, opt) {
    opt = opt || {};
    const out = { msgs: [], err: null, raw: lines(text).join('\n') };
    const asm = {};
    let pend = null; // başlıksız modda çok çerçeveli mesaj
    const headers = opt.headers !== false;
    for (const line of lines(text)) {
      const up = line.toUpperCase();
      const compact = up.replace(/\s+/g, '');
      const isHex = /^[0-9A-F:]+$/.test(compact);
      if (!isHex) {
        if (up === '?') out.err = out.err || '?';
        else {
          const e = ERRS.find(k => up.includes(k));
          if (e) out.err = out.err || e;
        }
        continue;
      }
      if (!headers) {
        if (/^[0-9A-F]{3}$/.test(compact)) { pend = { len: parseInt(compact, 16), d: [] }; continue; }
        const m = compact.match(/^([0-9A-F]):([0-9A-F]+)$/);
        if (m) {
          if (!pend) continue;
          pend.d.push(...fromHex(m[2]));
          if (pend.d.length >= pend.len) { out.msgs.push({ h: null, d: pend.d.slice(0, pend.len) }); pend = null; }
          continue;
        }
        if (compact.length % 2 === 0) out.msgs.push({ h: null, d: fromHex(compact) });
        continue;
      }
      if (compact.includes(':') || compact.length < 5 || (compact.length - 3) % 2 !== 0) continue;
      const hdr = compact.slice(0, 3);
      if (opt.rx && hdr !== opt.rx) continue;
      if (opt.rxFilter && !opt.rxFilter(hdr)) continue;
      const b = fromHex(compact.slice(3));
      if (!b.length) continue;
      const pci = b[0] >> 4;
      if (pci === 0) {
        const len = b[0] & 0x0F;
        if (len > 0 && len <= b.length - 1) out.msgs.push({ h: hdr, d: b.slice(1, 1 + len) });
      } else if (pci === 1 && b.length >= 2) {
        const len = ((b[0] & 0x0F) << 8) | b[1];
        asm[hdr] = { len, d: b.slice(2), sn: 1 };
      } else if (pci === 2) {
        const a = asm[hdr];
        if (!a) continue;
        a.d.push(...b.slice(1));
        if (a.d.length >= a.len) { out.msgs.push({ h: hdr, d: a.d.slice(0, a.len) }); delete asm[hdr]; }
      }
      // pci 3 = akış kontrolü, yok say
    }
    for (const hdr of Object.keys(asm)) out.msgs.push({ h: hdr, d: asm[hdr].d, partial: true, want: asm[hdr].len });
    if (pend && pend.d.length) out.msgs.push({ h: null, d: pend.d, partial: true, want: pend.len });
    return out;
  }

  /* Bir tanı isteğinin cevabını değerlendirir: pozitif / negatif (NRC) / bekleme (0x78) */
  function evalDiag(res, sid) {
    let pos = null, nrc = null, pending = false, partial = false;
    for (const m of res.msgs) {
      const d = m.d;
      if (!d.length) continue;
      if (d[0] === 0x7F && d[1] === sid) {
        if (d[2] === 0x78) pending = true; else nrc = d[2];
      } else if (d[0] === ((sid + 0x40) & 0xFF)) {
        pos = d; partial = !!m.partial;
      }
    }
    if (pos || nrc != null) pending = false;
    return { pos, nrc, pending, partial, any: res.msgs.length > 0 };
  }

  const NRC = {
    0x10: 'genel ret', 0x11: 'servis desteklenmiyor', 0x12: 'alt fonksiyon desteklenmiyor',
    0x13: 'yanlış mesaj uzunluğu', 0x21: 'meşgul, tekrar dene', 0x22: 'koşullar uygun değil',
    0x24: 'istek sırası hatalı', 0x31: 'istek aralık dışı', 0x33: 'güvenlik erişimi reddedildi',
    0x35: 'geçersiz anahtar', 0x78: 'cevap bekleniyor', 0x7E: 'bu oturumda alt fonksiyon yok',
    0x7F: 'bu oturumda servis yok'
  };
  const nrcText = c => c == null ? '' : '0x' + h2(c) + ' (' + (NRC[c] || 'bilinmeyen') + ')';

  class Elm {
    constructor(send, log) {
      this.send = send;
      this.log = log || (() => {});
      this.q = [];
      this.cur = null;
      this.quietUntil = 0;
      this.headers = true;
      this.tx = null;
      this.rx = null;
      this.version = '';
      this.voltage = '';
      this.fcOk = false;
      this.countOk = null;
      this.stCur = null;
      this.fcMode = null;
      this.fcHdr = null;
    }

    onData(t) {
      const txt = String(t == null ? '' : t);
      const show = txt.replace(/\r/g, '\n').replace(/\n+/g, '\n').trim();
      const it = this.cur;
      if (!it) { if (show) this.log('<', show + '   (geç gelen cevap, atlandı)'); return; }
      if (show) this.log('<', show);
      clearTimeout(it.timer);
      this.cur = null;
      it.res(txt);
      this.pump();
    }

    cmd(c, timeout) {
      return new Promise(res => {
        this.q.push({ c, res, timeout: timeout || 5000 });
        this.pump();
      });
    }

    pump() {
      if (this.cur || !this.q.length) return;
      const wait = this.quietUntil - Date.now();
      if (wait > 0) { if (!this.pumpTimer) this.pumpTimer = setTimeout(() => { this.pumpTimer = null; this.pump(); }, wait); return; }
      const it = this.cur = this.q.shift();
      this.log('>', it.c);
      it.timer = setTimeout(() => {
        if (this.cur !== it) return;
        this.log('!', 'yanıt yok (zaman aşımı)');
        this.cur = null;
        this.quietUntil = Date.now() + 500; // geç gelen cevap bir sonraki komuta karışmasın
        it.res(null);
        this.pump();
      }, it.timeout);
      try { this.send(it.c); } catch (e) { this.log('!', 'gönderilemedi: ' + e.message); }
    }

    flush() {
      if (this.cur) { clearTimeout(this.cur.timer); const c = this.cur; this.cur = null; c.res(null); }
      while (this.q.length) this.q.shift().res(null);
      this.tx = this.rx = null;
      this.stCur = null;
      this.fcMode = this.fcHdr = null;
    }

    async at(c, timeout) {
      const r = await this.cmd(c, timeout || 2500);
      return { ok: r != null && /OK/i.test(r), r };
    }

    async init(progress) {
      const pr = progress || (() => {});
      this.tx = this.rx = null;
      this.stCur = null;
      pr('Adaptör sıfırlanıyor…');
      let r = await this.cmd('ATZ', 4000);
      if (r == null) r = await this.cmd('ATZ', 4000);
      if (r == null) return { ok: false, msg: 'Adaptör cevap vermiyor. Bluetooth bağlantısını ve kontağı kontrol et.' };
      const vm = r.match(/ELM327\s*v?[\d.]+[a-z]?/i);
      this.version = vm ? vm[0] : '';
      pr('Ayarlar yapılıyor…');
      await this.at('ATE0');
      await this.at('ATL0');
      await this.at('ATS1');
      const hh = await this.at('ATH1');
      this.headers = hh.ok;
      await this.at('ATSP6');   // ISO 15765-4 CAN, 11 bit, 500 kbit
      await this.at('ATCAF1');
      await this.at('ATAT1');
      await this.setSt(DEFAULT_ST);
      if (!this.version) {
        const ri = await this.cmd('ATI', 2000);
        const m = (ri || '').match(/ELM327\s*v?[\d.]+[a-z]?/i);
        this.version = m ? m[0] : (ri || '').trim();
      }
      const rv = await this.cmd('ATRV', 2000);
      const vv = (rv || '').match(/\d{1,2}[.,]\d\s*V/i);
      this.voltage = vv ? vv[0].replace(',', '.') : '';
      // PSA beyinlerinden çok çerçeveli cevap almak için akış kontrolü elle ayarlanmalı
      const f1 = await this.at('ATFCSH7E0');
      const f2 = await this.at('ATFCSD300000');
      const f3 = await this.at('ATFCSM1');
      this.fcOk = f1.ok && f2.ok && f3.ok;
      // Standart OBD için adaptörün kendi akış kontrolü (mod 0) kullanılır; bazı klonlar mod 1'i kabul edip uygulamıyor
      await this.at('ATFCSM0');
      this.fcMode = '0';
      this.fcHdr = '7E0';
      pr('Araçla bağlantı deneniyor…');
      await this.selectFunctional();
      const r0 = await this.request('0100', { timeout: 8000, rx: null, rxFilter: isObdRx });
      let carOk = r0.msgs.some(m => m.d[0] === 0x41 && m.d[1] === 0x00);
      if (!carOk) {
        const r1 = await this.request('0100', { timeout: 8000, rx: null, rxFilter: isObdRx });
        carOk = r1.msgs.some(m => m.d[0] === 0x41 && m.d[1] === 0x00);
      }
      return {
        ok: true, carOk, version: this.version, voltage: this.voltage, fcOk: this.fcOk, headers: this.headers,
        msg: carOk ? 'Araç bağlantısı tamam' : 'Adaptör hazır ama araç cevap vermedi (kontak açık mı?)'
      };
    }

    async setSt(v) {
      if (this.stCur === v) return;
      await this.at('ATST' + v);
      this.stCur = v;
    }

    async setFc(mode, hdr) {
      if (!this.fcOk) return;
      if (mode === '1' && this.fcHdr !== hdr) { await this.at('ATFCSH' + hdr); this.fcHdr = hdr; }
      if (this.fcMode !== mode) { await this.at('ATFCSM' + mode); this.fcMode = mode; }
    }

    // PSA beyni (üretici adresi): elle akış kontrolü
    async select(tx, rx) {
      if (this.tx === tx && this.rx === rx) return true;
      const a = await this.at('ATSH' + tx);
      if (!a.ok) return false;
      await this.at('ATCRA' + rx);
      await this.setFc('1', tx);
      this.tx = tx;
      this.rx = rx;
      return true;
    }

    // Standart OBD (7E0 / 7DF): adaptörün otomatik akış kontrolü
    async selectObd(tx, rx) {
      if (this.tx === tx && this.rx === rx) return true;
      await this.at('ATSH' + tx);
      await this.at(rx ? 'ATCRA' + rx : 'ATCRA');
      await this.setFc('0');
      this.tx = tx;
      this.rx = rx;
      return true;
    }

    selectFunctional() {
      return this.selectObd('7DF', null);
    }

    async request(hex, o) {
      o = o || {};
      const r = await this.cmd(String(hex).replace(/\s/g, '').toUpperCase(), o.timeout || 6000);
      if (r == null) return { msgs: [], err: 'TIMEOUT', raw: '' };
      return parseResponse(r, { headers: this.headers, rx: o.rx === undefined ? this.rx : o.rx, rxFilter: o.rxFilter });
    }

    /* UDS / KWP isteği: pozitif cevap, NRC veya hiçbir şey döner. 0x78 gelirse uzun zaman aşımıyla tekrar dener. */
    async diag(hex, o) {
      const sid = fromHex(hex)[0];
      let res = await this.request(hex, o);
      let ev = evalDiag(res, sid);
      if (ev.pending) {
        this.log('!', 'beyin meşgul (0x78), uzun bekleme ile tekrar');
        await this.setSt('FF');
        res = await this.request(hex, Object.assign({}, o, { timeout: 10000 }));
        ev = evalDiag(res, sid);
        await this.setSt(DEFAULT_ST);
      }
      ev.raw = res.raw;
      ev.err = res.err;
      return ev;
    }
  }

  const isObdRx = h => /^7E[89A-F]$/.test(h);

  Object.assign(P, { h2, toHex, fromHex, parseResponse, evalDiag, nrcText, Elm, isObdRx, DEFAULT_ST });
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
