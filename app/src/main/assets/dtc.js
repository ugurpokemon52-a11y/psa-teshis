'use strict';
/* PSA Teşhis — arıza kodu açıklamaları (SAE J2012 genel kodlar) ve hata tipi (FTB) tabloları.
   Üreticiye özel kodlar (P1xxx, B1xxx, C1xxx, U1xxx…) için resmi PSA tablosu yok; bunlar "üreticiye özel" olarak gösterilir. */
(function (G) {
  const P = G.PSA = G.PSA || {};

  const D = {
    P0010: 'Emme kam mili (A) ayar aktüatörü devresi', P0011: 'Emme kam mili (A) zamanlaması fazla avans / performans',
    P0012: 'Emme kam mili (A) zamanlaması fazla rötar', P0013: 'Egzoz kam mili (B) ayar aktüatörü devresi',
    P0014: 'Egzoz kam mili (B) zamanlaması fazla avans / performans', P0015: 'Egzoz kam mili (B) zamanlaması fazla rötar',
    P0016: 'Krank – emme kam mili konum uyumsuzluğu', P0017: 'Krank – egzoz kam mili konum uyumsuzluğu',
    P0030: 'Ön oksijen sensörü ısıtıcı devresi (B1S1)', P0036: 'Arka oksijen sensörü ısıtıcı devresi (B1S2)',
    P0068: 'Emme basıncı / hava akışı ile gaz kelebeği konumu uyumsuz', P0087: 'Yakıt rayı basıncı çok düşük',
    P0088: 'Yakıt rayı basıncı çok yüksek', P0089: 'Yakıt basınç regülatörü performansı',
    P0090: 'Yakıt basınç regülatörü kontrol devresi',
    P0100: 'Hava akış (MAF) sensörü devresi', P0101: 'Hava akış (MAF) sensörü aralık / performans',
    P0102: 'Hava akış (MAF) sensörü düşük sinyal', P0103: 'Hava akış (MAF) sensörü yüksek sinyal',
    P0105: 'Emme manifoldu basınç (MAP) sensörü devresi', P0106: 'Emme manifoldu basınç (MAP) sensörü aralık / performans',
    P0107: 'MAP sensörü düşük sinyal', P0108: 'MAP sensörü yüksek sinyal',
    P0110: 'Emme havası sıcaklık sensörü devresi', P0111: 'Emme havası sıcaklık sensörü aralık / performans',
    P0112: 'Emme havası sıcaklık sensörü düşük sinyal', P0113: 'Emme havası sıcaklık sensörü yüksek sinyal',
    P0115: 'Soğutma suyu sıcaklık sensörü devresi', P0116: 'Soğutma suyu sıcaklık sensörü aralık / performans',
    P0117: 'Soğutma suyu sıcaklık sensörü düşük sinyal', P0118: 'Soğutma suyu sıcaklık sensörü yüksek sinyal',
    P0120: 'Gaz kelebeği konum sensörü A devresi', P0121: 'Gaz kelebeği konum sensörü A aralık / performans',
    P0122: 'Gaz kelebeği konum sensörü A düşük sinyal', P0123: 'Gaz kelebeği konum sensörü A yüksek sinyal',
    P0125: 'Kapalı devre yakıt kontrolü için motor yeterince ısınmıyor', P0128: 'Termostat: soğutma suyu sıcaklığı olması gerekenin altında',
    P0130: 'Ön oksijen sensörü devresi (B1S1)', P0131: 'Ön oksijen sensörü düşük voltaj (B1S1)',
    P0132: 'Ön oksijen sensörü yüksek voltaj (B1S1)', P0133: 'Ön oksijen sensörü yavaş cevap (B1S1)',
    P0134: 'Ön oksijen sensöründe hareket yok (B1S1)', P0135: 'Ön oksijen sensörü ısıtıcı devresi (B1S1)',
    P0136: 'Arka oksijen sensörü devresi (B1S2)', P0137: 'Arka oksijen sensörü düşük voltaj (B1S2)',
    P0138: 'Arka oksijen sensörü yüksek voltaj (B1S2)', P0140: 'Arka oksijen sensöründe hareket yok (B1S2)',
    P0141: 'Arka oksijen sensörü ısıtıcı devresi (B1S2)',
    P0170: 'Yakıt düzeltmesi (trim) arızası (B1)', P0171: 'Karışım çok fakir (B1)', P0172: 'Karışım çok zengin (B1)',
    P0190: 'Yakıt rayı basınç sensörü devresi', P0191: 'Yakıt rayı basınç sensörü aralık / performans',
    P0192: 'Yakıt rayı basınç sensörü düşük sinyal', P0193: 'Yakıt rayı basınç sensörü yüksek sinyal',
    P0201: 'Enjektör devresi – silindir 1', P0202: 'Enjektör devresi – silindir 2', P0203: 'Enjektör devresi – silindir 3',
    P0204: 'Enjektör devresi – silindir 4', P0217: 'Motor aşırı ısınma', P0219: 'Motor aşırı devir',
    P0221: 'Gaz kelebeği konum sensörü B aralık / performans', P0222: 'Gaz kelebeği konum sensörü B düşük sinyal',
    P0223: 'Gaz kelebeği konum sensörü B yüksek sinyal',
    P0234: 'Turbo aşırı basınç (overboost)', P0236: 'Turbo basınç sensörü A aralık / performans',
    P0237: 'Turbo basınç sensörü A düşük sinyal', P0238: 'Turbo basınç sensörü A yüksek sinyal',
    P0243: 'Turbo wastegate solenoidi A devresi', P0299: 'Turbo basıncı düşük (underboost)',
    P0300: 'Rastgele / birden fazla silindirde ateşleme hatası', P0301: 'Ateşleme hatası – silindir 1',
    P0302: 'Ateşleme hatası – silindir 2', P0303: 'Ateşleme hatası – silindir 3', P0304: 'Ateşleme hatası – silindir 4',
    P0315: 'Krank konum varyasyonu öğrenilmemiş',
    P0325: 'Vuruntu sensörü 1 devresi', P0326: 'Vuruntu sensörü 1 aralık / performans',
    P0327: 'Vuruntu sensörü 1 düşük sinyal', P0328: 'Vuruntu sensörü 1 yüksek sinyal',
    P0335: 'Krank konum sensörü devresi', P0336: 'Krank konum sensörü aralık / performans',
    P0337: 'Krank konum sensörü düşük sinyal', P0338: 'Krank konum sensörü yüksek sinyal', P0339: 'Krank konum sensörü kesintili',
    P0340: 'Kam mili konum sensörü A devresi', P0341: 'Kam mili konum sensörü A aralık / performans',
    P0342: 'Kam mili konum sensörü A düşük sinyal', P0343: 'Kam mili konum sensörü A yüksek sinyal',
    P0351: 'Ateşleme bobini A devresi', P0352: 'Ateşleme bobini B devresi', P0353: 'Ateşleme bobini C devresi',
    P0365: 'Kam mili konum sensörü B devresi', P0366: 'Kam mili konum sensörü B aralık / performans',
    P0420: 'Katalizör verimi eşiğin altında (B1)',
    P0441: 'Yakıt buharı (EVAP) temizleme akışı hatalı', P0443: 'Kanister temizleme valfi devresi',
    P0444: 'Kanister temizleme valfi devresi açık', P0445: 'Kanister temizleme valfi devresi kısa devre',
    P0480: 'Soğutma fanı 1 kontrol devresi',
    P0500: 'Araç hız sensörü', P0501: 'Araç hız sensörü aralık / performans',
    P0505: 'Rölanti kontrol sistemi', P0506: 'Rölanti devri beklenenden düşük', P0507: 'Rölanti devri beklenenden yüksek',
    P0520: 'Motor yağ basınç sensörü / müşürü devresi', P0521: 'Motor yağ basınç sensörü / müşürü aralık / performans',
    P0522: 'Motor yağ basınç sensörü / müşürü düşük voltaj', P0523: 'Motor yağ basınç sensörü / müşürü yüksek voltaj',
    P0524: 'Motor yağ basıncı çok düşük',
    P0532: 'Klima gaz basınç sensörü düşük sinyal', P0533: 'Klima gaz basınç sensörü yüksek sinyal',
    P0560: 'Sistem (akü) voltajı', P0562: 'Sistem (akü) voltajı düşük', P0563: 'Sistem (akü) voltajı yüksek',
    P0571: 'Fren müşürü A devresi',
    P0600: 'Seri iletişim bağlantısı', P0601: 'Motor beyni iç hafıza sağlama (checksum) hatası',
    P0602: 'Motor beyni programlama hatası', P0603: 'Motor beyni kalıcı hafıza (KAM) hatası',
    P0604: 'Motor beyni RAM hatası', P0605: 'Motor beyni ROM hatası', P0606: 'Motor beyni işlemci hatası',
    P0615: 'Marş rölesi devresi', P0627: 'Yakıt pompası kontrol devresi açık',
    P0638: 'Gaz kelebeği aktüatörü kontrol aralık / performans', P0641: 'Sensör besleme voltajı A devresi açık',
    P0650: 'Arıza lambası kontrol devresi', P0651: 'Sensör besleme voltajı B devresi açık',
    P0685: 'Motor beyni güç rölesi kontrol devresi açık',
    P0700: 'Şanzıman kontrol sistemi (şanzıman beyninde arıza var)', P0705: 'Vites konum sensörü (PRND) devresi',
    P0710: 'Şanzıman yağ sıcaklık sensörü devresi', P0711: 'Şanzıman yağ sıcaklık sensörü aralık / performans',
    P0712: 'Şanzıman yağ sıcaklık sensörü düşük sinyal', P0713: 'Şanzıman yağ sıcaklık sensörü yüksek sinyal',
    P0715: 'Şanzıman giriş / türbin devir sensörü devresi', P0720: 'Şanzıman çıkış devir sensörü devresi',
    P0725: 'Şanzımana motor devri girişi devresi', P0730: 'Yanlış vites oranı',
    P0731: 'Yanlış vites oranı – 1. vites', P0732: 'Yanlış vites oranı – 2. vites', P0733: 'Yanlış vites oranı – 3. vites',
    P0734: 'Yanlış vites oranı – 4. vites', P0735: 'Yanlış vites oranı – 5. vites', P0736: 'Yanlış vites oranı – geri vites',
    P0740: 'Tork konvertörü kilitleme solenoidi devresi', P0741: 'Tork konvertörü kilitleme performansı / açık kalıyor',
    P0750: 'Vites solenoidi A', P0755: 'Vites solenoidi B', P0760: 'Vites solenoidi C', P0765: 'Vites solenoidi D',
    P0770: 'Vites solenoidi E', P0850: 'Park / Nötr müşürü giriş devresi',
    P2096: 'Katalizör sonrası karışım çok fakir (B1)', P2097: 'Katalizör sonrası karışım çok zengin (B1)',
    P2101: 'Gaz kelebeği motoru devresi aralık / performans',
    P2122: 'Gaz pedalı sensörü D düşük sinyal', P2123: 'Gaz pedalı sensörü D yüksek sinyal',
    P2127: 'Gaz pedalı sensörü E düşük sinyal', P2128: 'Gaz pedalı sensörü E yüksek sinyal',
    P2135: 'Gaz kelebeği sensörü A/B voltaj uyumsuzluğu', P2138: 'Gaz pedalı sensörü D/E voltaj uyumsuzluğu',
    P2177: 'Rölanti dışında karışım çok fakir (B1)', P2178: 'Rölanti dışında karışım çok zengin (B1)',
    P2187: 'Rölantide karışım çok fakir (B1)', P2188: 'Rölantide karışım çok zengin (B1)',
    P2195: 'Ön oksijen sensörü fakirde takılı (B1S1)', P2196: 'Ön oksijen sensörü zenginde takılı (B1S1)',
    P2237: 'Ön oksijen sensörü pozitif akım devresi açık (B1S1)', P2261: 'Turbo bypass valfi mekanik arıza',
    P2263: 'Turbo basınç sistemi performansı', P2270: 'Arka oksijen sensörü fakirde takılı (B1S2)',
    P2271: 'Arka oksijen sensörü zenginde takılı (B1S2)', P2279: 'Emme havası kaçağı',
    P2A00: 'Ön oksijen sensörü aralık / performans (B1S1)',
    U0001: 'Yüksek hızlı CAN iletişim hattı', U0073: 'Kontrol modülü iletişim hattı kapalı (bus off)',
    U0100: 'Motor beyni ile iletişim kaybı', U0101: 'Şanzıman beyni ile iletişim kaybı',
    U0121: 'ABS / ESP beyni ile iletişim kaybı', U0126: 'Direksiyon açı sensörü ile iletişim kaybı',
    U0131: 'Elektrikli direksiyon beyni ile iletişim kaybı', U0140: 'BSI / gövde beyni ile iletişim kaybı',
    U0151: 'Airbag beyni ile iletişim kaybı', U0155: 'Gösterge paneli ile iletişim kaybı',
    U0164: 'Klima beyni ile iletişim kaybı', U0184: 'Radyo ile iletişim kaybı',
    U0401: 'Motor beyninden geçersiz veri alındı', U0415: 'ABS / ESP beyninden geçersiz veri alındı'
  };

  const HINT = {
    P0524: 'Yağ seviyesi, yağ basınç müşürü ve soketi, yağ pompası ve yağ süzgecinin tıkanıp tıkanmadığı (PureTech motorlarda yağlı kayış parçaları süzgeci tıkayabilir) kontrol edilmeli. Yağ basıncı düşükken motoru zorlamamak gerekir.',
    P0521: 'Yağ basınç müşürü, kablo ve soketi ile gerçek yağ basıncı (manometre ile) kontrol edilmeli.',
    P0016: 'Triger kayışı / zamanlama, kam ve krank sensörleri kontrol edilmeli. PureTech motorlarda yıpranmış yağlı kayış bu koda yol açabilir.',
    P0300: 'Buji, bobin, enjektör ve kompresyon kontrol edilmeli.',
    P0171: 'Emme havası kaçağı, yakıt basıncı ve hava akış/MAP sensörü kontrol edilmeli.',
    P0299: 'Turbo hortumları, wastegate ve turbo basınç sensörü kontrol edilmeli.',
    P0420: 'Katalizör, oksijen sensörleri ve egzoz kaçağı kontrol edilmeli.'
  };

  const SYS = { P: 'Motor / şanzıman', C: 'Şasi (fren, süspansiyon, direksiyon)', B: 'Gövde (airbag, konfor, aydınlatma)', U: 'Ağ / iletişim' };

  // SAE J2012 hata tipi baytı (FTB) — en sık görülenler
  const FTB = {
    0x00: '', 0x01: 'genel elektrik arızası', 0x02: 'genel sinyal arızası', 0x04: 'sistem iç arızası',
    0x07: 'mekanik arıza', 0x08: 'veri yolu sinyali / mesaj arızası', 0x09: 'bileşen arızası',
    0x11: 'şaseye kısa devre', 0x12: 'aküye (+) kısa devre', 0x13: 'açık devre', 0x14: 'şaseye kısa devre veya açık devre',
    0x15: 'aküye kısa devre veya açık devre', 0x16: 'devre voltajı eşiğin altında', 0x17: 'devre voltajı eşiğin üstünde',
    0x19: 'devre akımı eşiğin üstünde', 0x1C: 'devre voltajı aralık dışında', 0x1D: 'devre akımı aralık dışında',
    0x21: 'sinyal genliği minimumun altında', 0x22: 'sinyal genliği maksimumun üstünde', 0x24: 'sinyal takılı (düşük)',
    0x25: 'sinyal takılı (yüksek)', 0x26: 'sinyal değişim hızı düşük', 0x27: 'sinyal değişim hızı yüksek',
    0x28: 'sinyal kayması (bias)', 0x29: 'sinyal geçersiz', 0x2F: 'sinyal düzensiz', 0x31: 'sinyal yok',
    0x62: 'sinyal karşılaştırma hatası', 0x64: 'sinyal mantık (makullük) hatası', 0x67: 'sinyal yanlış (açılıştan sonra)',
    0x71: 'aktüatör takılı', 0x72: 'aktüatör açık konumda takılı', 0x73: 'aktüatör kapalı konumda takılı',
    0x81: 'geçersiz seri veri alındı', 0x82: 'canlılık sayacı hatalı', 0x83: 'mesaj koruma (checksum) hatası',
    0x84: 'sinyal izin verilen aralığın altında', 0x85: 'sinyal izin verilen aralığın üstünde', 0x86: 'sinyal geçersiz',
    0x87: 'mesaj gelmiyor', 0x88: 'veri yolu kapalı (bus off)', 0x92: 'performans veya hatalı çalışma',
    0x94: 'beklenmeyen çalışma', 0x96: 'bileşen iç arızası', 0x97: 'bileşen veya sistem çalışması engellendi',
    0x98: 'bileşen veya sistem aşırı ısınma'
  };

  function decode2(b0, b1) {
    return 'PCBU'[b0 >> 6] + ((b0 >> 4) & 3) + (b0 & 0x0F).toString(16).toUpperCase() + P.h2(b1);
  }

  function describe(code) {
    const d = D[code];
    if (d) return d;
    const sys = code[0], d1 = code[1];
    const own = (sys === 'P' && (d1 === '1' || d1 === '3')) || (sys !== 'P' && (d1 === '1' || d1 === '2'));
    if (own) return 'Üreticiye özel kod (' + SYS[sys] + ') — anlamı için PSA servis tablosu / Diagbox gerekir';
    return SYS[sys] + ' kodu — bu kod için açıklama listede yok';
  }

  function ftbText(f) {
    if (f == null) return '';
    if (f in FTB) return FTB[f];
    return 'hata tipi 0x' + P.h2(f);
  }

  // UDS (ISO 14229) DTC durum baytı
  function udsStatus(s) {
    const flags = [];
    if (s & 0x01) flags.push('şu an hatalı');
    if (s & 0x02) flags.push('bu sürüşte hata oldu');
    if (s & 0x04) flags.push('beklemede');
    if (s & 0x08) flags.push('onaylanmış / kayıtlı');
    if (s & 0x20) flags.push('son silmeden beri oluştu');
    if (s & 0x80) flags.push('arıza lambası istiyor');
    let cls, label;
    if (s & 0x01) { cls = 'aktif'; label = 'AKTİF'; }
    else if (s & 0x08 || s & 0x20) { cls = 'gecmis'; label = 'GEÇMİŞ (kaçak)'; }
    else if (s & 0x04 || s & 0x02) { cls = 'bekleme'; label = 'BEKLEMEDE'; }
    else { cls = 'gecmis'; label = 'KAYITLI'; }
    return { cls, label, flags };
  }

  // KWP2000 (ISO 14230-3) DTC durum baytı — PSA'da çözüm yaklaşıktır
  function kwpStatus(s) {
    const flags = [];
    const st = (s >> 5) & 3;
    let cls, label;
    if (st === 3) { cls = 'aktif'; label = 'AKTİF'; flags.push('istek anında mevcut'); }
    else if (st === 1) { cls = 'gecmis'; label = 'GEÇMİŞ (kaçak)'; flags.push('şu an yok, hafızada kayıtlı'); }
    else if (st === 2) { cls = 'bekleme'; label = 'ARALIKLI'; flags.push('olgunlaşıyor / aralıklı'); }
    else { cls = 'gecmis'; label = 'KAYITLI'; }
    if (s & 0x80) flags.push('arıza lambası istiyor');
    flags.push('KWP durumu, yaklaşık çözüm');
    return { cls, label, flags };
  }

  function mkDtc(b0, b1, ftb, status, proto) {
    const code = decode2(b0, b1);
    const st = proto === 'KWP' ? kwpStatus(status) : udsStatus(status);
    return {
      code, ftb: ftb == null ? null : ftb, full: code + (ftb == null ? '' : '-' + P.h2(ftb)),
      desc: describe(code), ftbText: ftbText(ftb), hint: HINT[code] || '',
      status, statusHex: '0x' + P.h2(status), cls: st.cls, label: st.label, flags: st.flags, proto
    };
  }

  Object.assign(P, { DTC_DESC: D, decode2, describe, ftbText, udsStatus, kwpStatus, mkDtc });
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
