'use strict';
/* PSA Teşhis — kapsamlı standart OBD canlı veri tablosu (SAE J1979 mod 01) + C4 B7 1.2 PureTech EAT6 profilleri.
   n = minimum veri bayt sayısı. */
(function (G) {
  const P = G.PSA = G.PSA || {};
  const W = (a, b) => a * 256 + b;
  const SW = (a, b) => { const v = W(a, b); return v >= 32768 ? v - 65536 : v; };
  const D4 = d => d[0] * 16777216 + d[1] * 65536 + d[2] * 256 + d[3];
  const pct = a => Math.round(a * 100 / 255);
  const pct1 = a => +(a * 100 / 255).toFixed(1);
  const trim = a => +((a - 128) * 100 / 128).toFixed(1);
  const lam = d => +(2 / 65536 * W(d[0], d[1])).toFixed(3);
  const FUEL_SYS = {
    0: 'Kapalı (motor durdu)',
    1: 'Açık döngü (ısınıyor)',
    2: 'Kapalı döngü (normal)',
    4: 'Açık döngü (yük / yakıt kesme)',
    8: 'Açık döngü (arıza)',
    16: 'Kapalı döngü (sensör arızalı)'
  };
  const OBD_STD = {
    1: 'OBD-II (CARB)', 2: 'OBD (EPA)', 3: 'OBD + OBD-II', 4: 'OBD-I', 5: 'OBD yok',
    6: 'EOBD (Avrupa)', 7: 'EOBD + OBD-II', 8: 'EOBD + OBD', 9: 'EOBD + OBD + OBD-II',
    10: 'JOBD', 13: 'EOBD + JOBD', 17: 'EMD', 28: 'OBD-II / EOBD (Euro 6)', 33: 'WWH-OBD'
  };
  const FUEL_TYPE = {
    1: 'Benzin', 2: 'Metanol', 3: 'Etanol', 4: 'Dizel', 5: 'LPG', 6: 'CNG', 8: 'Elektrik',
    9: 'Bifuel Benzin', 14: 'Bifuel LPG', 17: 'Hibrit Benzin', 19: 'Hibrit Dizel'
  };
  const SEC_AIR = { 1: 'Katalizör öncesi', 2: 'Katalizör sonrası', 4: 'Atmosfer / kapalı', 8: 'Test için açık' };

  // g: grup. max: kadran/çubuk üst sınırı (0 = sınırsız). min: kadran alt sınırı (varsayılan 0). warn: uyarı koşulu. txt: metin değer
  P.PIDS = [
    // --- Motor & Devir ---
    { pid: '0C', g: 'Motor', name: 'Motor devri', unit: 'dev/dk', n: 2, f: d => Math.round(W(d[0], d[1]) / 4), max: 6500, warn: v => v >= 5800 },
    { pid: '0D', g: 'Motor', name: 'Hız', unit: 'km/s', n: 1, f: d => d[0], max: 220 },
    { pid: '04', g: 'Motor', name: 'Hesaplanan motor yükü', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '43', g: 'Motor', name: 'Mutlak motor yükü', unit: '%', n: 2, f: d => Math.round(W(d[0], d[1]) * 100 / 255), max: 200 },
    { pid: '0E', g: 'Motor', name: 'Ateşleme avansı', unit: '°', n: 1, f: d => +(d[0] / 2 - 64).toFixed(1), min: -20, max: 60 },
    { pid: '61', g: 'Motor', name: 'İstenen tork', unit: '%', n: 1, f: d => d[0] - 125, min: -25, max: 100 },
    { pid: '62', g: 'Motor', name: 'Gerçek tork', unit: '%', n: 1, f: d => d[0] - 125, min: -25, max: 100 },
    { pid: '63', g: 'Motor', name: 'Referans tork', unit: 'Nm', n: 2, f: d => W(d[0], d[1]), max: 300 },
    { pid: '8E', g: 'Motor', name: 'Sürtünme torku', unit: '%', n: 1, f: d => d[0] - 125, min: 0, max: 50 },
    { pid: '64', g: 'Motor', name: 'Rölanti tork oranı', unit: '%', n: 5, f: d => d[0] - 125, min: -25, max: 100 },
    { pid: 'A4', g: 'Şanzıman', name: 'Şanzıman vites oranı (EAT6)', unit: ':1', n: 4, f: d => +((W(d[2], d[3]) / 1000)).toFixed(3), max: 5 },

    // --- Sıcaklık (C4 B7'de gösterge olmadığı için kritik!) ---
    { pid: '05', g: 'Sıcaklık', name: 'Soğutma suyu (Hararet)', unit: '°C', n: 1, f: d => d[0] - 40, min: 0, max: 125, warn: v => v >= 105 },
    { pid: '67', g: 'Sıcaklık', name: 'Soğutma suyu sensörü 1', unit: '°C', n: 3, f: d => d[1] - 40, min: 0, max: 125, warn: v => v >= 105 },
    { pid: '5C', g: 'Sıcaklık', name: 'Motor yağı sıcaklığı', unit: '°C', n: 1, f: d => d[0] - 40, min: 0, max: 150, warn: v => v >= 128 },
    { pid: '46', g: 'Sıcaklık', name: 'Dış hava sıcaklığı', unit: '°C', n: 1, f: d => d[0] - 40, min: -20, max: 55 },
    { pid: '0F', g: 'Sıcaklık', name: 'Emme havası sıcaklığı', unit: '°C', n: 1, f: d => d[0] - 40, min: -10, max: 90, warn: v => v >= 70 },
    { pid: '68', g: 'Sıcaklık', name: 'Emme havası sensörü 1', unit: '°C', n: 2, f: d => d[1] - 40, min: -10, max: 90 },
    { pid: '77', g: 'Sıcaklık', name: 'Intercooler (şarj havası) sıcaklığı', unit: '°C', n: 5, f: d => d[1] - 40, min: 0, max: 100, warn: v => v >= 75 },
    { pid: '3C', g: 'Sıcaklık', name: 'Katalizör sıcaklığı (B1S1)', unit: '°C', n: 2, f: d => Math.round(W(d[0], d[1]) / 10 - 40), max: 1000, warn: v => v >= 920 },
    { pid: '3E', g: 'Sıcaklık', name: 'Katalizör sıcaklığı (B1S2)', unit: '°C', n: 2, f: d => Math.round(W(d[0], d[1]) / 10 - 40), max: 1000, warn: v => v >= 920 },
    { pid: '3D', g: 'Sıcaklık', name: 'Katalizör sıcaklığı (B2S1)', unit: '°C', n: 2, f: d => Math.round(W(d[0], d[1]) / 10 - 40), max: 1000 },
    { pid: '3F', g: 'Sıcaklık', name: 'Katalizör sıcaklığı (B2S2)', unit: '°C', n: 2, f: d => Math.round(W(d[0], d[1]) / 10 - 40), max: 1000 },
    { pid: '75', g: 'Sıcaklık', name: 'Turbo sıcaklığı A', unit: '°C', n: 7, f: d => d[1] - 40, max: 1000 },
    { pid: '76', g: 'Sıcaklık', name: 'Turbo sıcaklığı B', unit: '°C', n: 7, f: d => d[1] - 40, max: 1000 },
    { pid: '78', g: 'Sıcaklık', name: 'Egzoz gazı sıcaklığı (B1)', unit: '°C', n: 9, f: d => Math.round(W(d[1], d[2]) / 10 - 40), max: 1000 },
    { pid: '79', g: 'Sıcaklık', name: 'Egzoz gazı sıcaklığı (B2)', unit: '°C', n: 9, f: d => Math.round(W(d[1], d[2]) / 10 - 40), max: 1000 },
    { pid: '7C', g: 'Sıcaklık', name: 'Partikül filtresi sıcaklığı', unit: '°C', n: 9, f: d => Math.round(W(d[1], d[2]) / 10 - 40), max: 850 },

    // --- Hava / Turbo ---
    { pid: '0B', g: 'Hava / turbo', name: 'Emme basıncı (MAP)', unit: 'kPa', n: 1, f: d => d[0], max: 255 },
    { pid: '33', g: 'Hava / turbo', name: 'Atmosfer basıncı', unit: 'kPa', n: 1, f: d => d[0], min: 80, max: 110 },
    { pid: '10', g: 'Hava / turbo', name: 'Hava akışı (MAF)', unit: 'g/s', n: 2, f: d => +(W(d[0], d[1]) / 100).toFixed(1), max: 150 },
    { pid: '66', g: 'Hava / turbo', name: 'Hava akışı sensörü A (MAF)', unit: 'g/s', n: 5, f: d => +(W(d[1], d[2]) / 32).toFixed(1), max: 150 },
    { pid: '6F', g: 'Hava / turbo', name: 'Turbo giriş basıncı', unit: 'kPa', n: 2, f: d => d[1], max: 255 },
    { pid: '70', g: 'Hava / turbo', name: 'Turbo boost basıncı (gerçek)', unit: 'kPa', n: 9, f: d => +(W(d[3], d[4]) * 0.03125).toFixed(1), max: 260 },
    { pid: '72', g: 'Hava / turbo', name: 'Wastegate komutu', unit: '%', n: 5, f: d => pct1(d[1]), max: 100 },
    { pid: '73', g: 'Hava / turbo', name: 'Egzoz basıncı', unit: 'kPa', n: 5, f: d => +(W(d[1], d[2]) * 0.01).toFixed(1), max: 300 },
    { pid: '74', g: 'Hava / turbo', name: 'Turbo devri', unit: 'dev/dk', n: 5, f: d => W(d[1], d[2]) * 10, max: 220000 },
    { pid: '12', g: 'Hava / turbo', name: 'İkincil hava durumu', unit: '', n: 1, txt: true, f: d => SEC_AIR[d[0]] || ('0x' + P.h2(d[0])), max: 0 },

    // --- Gaz / Pedal ---
    { pid: '11', g: 'Gaz / pedal', name: 'Gaz kelebeği', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '45', g: 'Gaz / pedal', name: 'Bağıl gaz kelebeği', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '47', g: 'Gaz / pedal', name: 'Gaz kelebeği B', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '48', g: 'Gaz / pedal', name: 'Gaz kelebeği C', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '4C', g: 'Gaz / pedal', name: 'Gaz kelebeği komutu', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '49', g: 'Gaz / pedal', name: 'Gaz pedalı D', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '4A', g: 'Gaz / pedal', name: 'Gaz pedalı E', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '4B', g: 'Gaz / pedal', name: 'Gaz pedalı F', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '5A', g: 'Gaz / pedal', name: 'Bağıl gaz pedalı', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '8D', g: 'Gaz / pedal', name: 'Gaz kelebeği konumu G', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },

    // --- Yakıt & Enjeksiyon ---
    { pid: '03', g: 'Yakıt', name: 'Yakıt sistemi durumu', unit: '', n: 1, txt: true, f: d => FUEL_SYS[d[0]] || ('0x' + P.h2(d[0])), max: 0 },
    { pid: '51', g: 'Yakıt', name: 'Yakıt tipi', unit: '', n: 1, txt: true, f: d => FUEL_TYPE[d[0]] || ('Tip #' + d[0]), max: 0 },
    { pid: '06', g: 'Yakıt', name: 'Kısa yakıt düzeltme (STFT)', unit: '%', n: 1, f: d => trim(d[0]), min: -25, max: 25, warn: v => Math.abs(v) >= 18 },
    { pid: '07', g: 'Yakıt', name: 'Uzun yakıt düzeltme (LTFT)', unit: '%', n: 1, f: d => trim(d[0]), min: -25, max: 25, warn: v => Math.abs(v) >= 12 },
    { pid: '08', g: 'Yakıt', name: 'Kısa yakıt düzeltme B2', unit: '%', n: 1, f: d => trim(d[0]), min: -25, max: 25, warn: v => Math.abs(v) >= 18 },
    { pid: '09', g: 'Yakıt', name: 'Uzun yakıt düzeltme B2', unit: '%', n: 1, f: d => trim(d[0]), min: -25, max: 25, warn: v => Math.abs(v) >= 12 },
    { pid: '23', g: 'Yakıt', name: 'Yakıt rayı basıncı (HPFP)', unit: 'bar', n: 2, f: d => +(W(d[0], d[1]) * 10 / 100).toFixed(1), max: 250, warn: v => v < 15 && v > 0 },
    { pid: '22', g: 'Yakıt', name: 'Yakıt rayı basıncı (vakuma göre)', unit: 'kPa', n: 2, f: d => +(W(d[0], d[1]) * 0.079).toFixed(1), max: 0 },
    { pid: '59', g: 'Yakıt', name: 'Yakıt rayı mutlak basıncı', unit: 'bar', n: 2, f: d => +(W(d[0], d[1]) * 10 / 100).toFixed(1), max: 250 },
    { pid: '0A', g: 'Yakıt', name: 'Yakıt basıncı', unit: 'kPa', n: 1, f: d => d[0] * 3, max: 765 },
    { pid: '5E', g: 'Yakıt', name: 'Anlık yakıt tüketimi', unit: 'L/sa', n: 2, f: d => +(W(d[0], d[1]) / 20).toFixed(2), max: 30 },
    { pid: '9D', g: 'Yakıt', name: 'Motor yakıt akışı', unit: 'g/s', n: 4, f: d => +(W(d[0], d[1]) * 0.02).toFixed(2), max: 30 },
    { pid: 'A2', g: 'Yakıt', name: 'Silindir yakıt miktarı', unit: 'mg/st', n: 2, f: d => +(W(d[0], d[1]) / 32).toFixed(2), max: 80 },
    { pid: '5D', g: 'Yakıt', name: 'Enjeksiyon zamanlaması', unit: '°', n: 2, f: d => +(W(d[0], d[1]) / 128 - 210).toFixed(1), min: -60, max: 60 },
    { pid: '44', g: 'Yakıt', name: 'İstenen lambda', unit: 'λ', n: 2, f: lam, min: 0.6, max: 1.5 },
    { pid: '2F', g: 'Yakıt', name: 'Yakıt deposu seviyesi', unit: '%', n: 1, f: d => pct(d[0]), max: 100, warn: v => v <= 12 },
    { pid: '52', g: 'Yakıt', name: 'Etanol oranı', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '2E', g: 'Yakıt', name: 'Kanister temizleme (EVAP)', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '32', g: 'Yakıt', name: 'EVAP buhar basıncı', unit: 'Pa', n: 2, f: d => +(SW(d[0], d[1]) / 4).toFixed(1), min: -1000, max: 1000 },
    { pid: '53', g: 'Yakıt', name: 'Mutlak EVAP basıncı', unit: 'kPa', n: 2, f: d => +(W(d[0], d[1]) / 200).toFixed(2), max: 120 },
    { pid: '2C', g: 'Yakıt', name: 'EGR komutu', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '2D', g: 'Yakıt', name: 'EGR hatası', unit: '%', n: 1, f: d => trim(d[0]), min: -50, max: 50, warn: v => Math.abs(v) >= 20 },

    // --- Oksijen / Lambda Sensörleri ---
    { pid: '14', g: 'Oksijen sensörü', name: 'Ön O2 voltajı (B1S1)', unit: 'V', n: 2, f: d => +(d[0] / 200).toFixed(3), max: 1.1 },
    { pid: '15', g: 'Oksijen sensörü', name: 'Arka O2 voltajı (B1S2)', unit: 'V', n: 2, f: d => +(d[0] / 200).toFixed(3), max: 1.1 },
    { pid: '16', g: 'Oksijen sensörü', name: 'O2 sensörü 3 voltajı', unit: 'V', n: 2, f: d => +(d[0] / 200).toFixed(3), max: 1.1 },
    { pid: '17', g: 'Oksijen sensörü', name: 'O2 sensörü 4 voltajı', unit: 'V', n: 2, f: d => +(d[0] / 200).toFixed(3), max: 1.1 },
    { pid: '24', g: 'Oksijen sensörü', name: 'Ön geniş bant lambda (B1S1)', unit: 'λ', n: 4, f: lam, min: 0.6, max: 1.6 },
    { pid: '25', g: 'Oksijen sensörü', name: 'Arka geniş bant lambda (B1S2)', unit: 'λ', n: 4, f: lam, min: 0.6, max: 1.6 },
    { pid: '34', g: 'Oksijen sensörü', name: 'Ön lambda – akım (B1S1)', unit: 'λ', n: 4, f: lam, min: 0.6, max: 1.6 },
    { pid: '35', g: 'Oksijen sensörü', name: 'Arka lambda – akım (B1S2)', unit: 'λ', n: 4, f: lam, min: 0.6, max: 1.6 },
    { pid: '55', g: 'Oksijen sensörü', name: 'İkincil kısa O2 düzeltme', unit: '%', n: 1, f: d => trim(d[0]), min: -25, max: 25 },
    { pid: '56', g: 'Oksijen sensörü', name: 'İkincil uzun O2 düzeltme', unit: '%', n: 1, f: d => trim(d[0]), min: -25, max: 25 },

    // --- Elektrik ---
    { pid: '42', g: 'Elektrik', name: 'Beyin (akü) voltajı', unit: 'V', n: 2, f: d => +(W(d[0], d[1]) / 1000).toFixed(2), min: 10, max: 16, warn: v => v < 11.9 || v > 15.0 },
    { pid: '5B', g: 'Elektrik', name: 'Yardımcı akü / kapasitör durumu', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },

    // --- Sayaçlar & Teşhis Bilgisi ---
    { pid: 'A6', g: 'Sayaçlar', name: 'Kilometre (motor beyni)', unit: 'km', n: 4, f: d => Math.round(D4(d) / 10), max: 0 },
    { pid: '1F', g: 'Sayaçlar', name: 'Motor çalışma süresi', unit: 'sn', n: 2, f: d => W(d[0], d[1]), max: 0 },
    { pid: '7F', g: 'Sayaçlar', name: 'Toplam çalışma süresi', unit: 'sa', n: 5, f: d => Math.round(D4(d.slice(1)) / 3600), max: 0 },
    { pid: '31', g: 'Sayaçlar', name: 'Kod silindikten sonra yol', unit: 'km', n: 2, f: d => W(d[0], d[1]), max: 0 },
    { pid: '4E', g: 'Sayaçlar', name: 'Kod silindikten sonra süre', unit: 'dk', n: 2, f: d => W(d[0], d[1]), max: 0 },
    { pid: '30', g: 'Sayaçlar', name: 'Kod silindikten sonra ısınma', unit: 'kez', n: 1, f: d => d[0], max: 0 },
    { pid: '21', g: 'Sayaçlar', name: 'Arıza lambası yanıkken yol', unit: 'km', n: 2, f: d => W(d[0], d[1]), max: 0 },
    { pid: '4D', g: 'Sayaçlar', name: 'Arıza lambası yanıkken süre', unit: 'dk', n: 2, f: d => W(d[0], d[1]), max: 0 },
    { pid: '01', g: 'Sayaçlar', name: 'Arıza lambası & OBD kod sayısı', unit: '', n: 4, txt: true, f: d => ((d[0] & 0x80) ? 'Lamba YANIYOR' : 'Lamba kapalı') + ' · ' + (d[0] & 0x7F) + ' kod', max: 0 },
    { pid: '02', g: 'Sayaçlar', name: 'Freeze Frame arıza kodu', unit: '', n: 2, txt: true, f: d => (!d[0] && !d[1]) ? 'Yok' : (P.decode2 ? P.decode2(d[0], d[1]) : P.toHex(d)), max: 0 },
    { pid: '1C', g: 'Sayaçlar', name: 'OBD standardı', unit: '', n: 1, txt: true, f: d => OBD_STD[d[0]] || ('Kod ' + d[0]), max: 0 }
  ];
  P.PIDS.forEach(d => { d.key = 'obd:' + d.pid; });

  // Bilinmeyen ama aracın desteklediği ham OBD PID'lerini dinamik oluşturur (hiçbir desteklenen PID kaçmaz)
  const BITMAP_PIDS = new Set([0x00, 0x20, 0x40, 0x60, 0x80, 0xA0, 0xC0, 0x13, 0x1D, 0x41]);
  P.makeRawPid = function (pidNum, ecuTag) {
    const hex = P.h2 ? P.h2(pidNum) : pidNum.toString(16).toUpperCase().padStart(2, '0');
    const isTcu = ecuTag === 'eat6';
    return {
      key: (isTcu ? 'obd_tcu:' : 'obd:') + hex,
      pid: hex,
      g: isTcu ? 'EAT6 OBD (7E1)' : 'Aracın diğer OBD PID\'leri',
      name: (isTcu ? 'EAT6 OBD PID ' : 'OBD PID 0x') + hex,
      unit: '',
      n: 1,
      rawObd: true,
      tcu: isTcu,
      txt: true,
      max: 0,
      f: d => {
        const hx = P.toHex ? P.toHex(d) : Array.from(d).map(x => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        if (d.length <= 2) {
          const val = d.length === 1 ? d[0] : (d[0] * 256 + d[1]);
          return val + '  [' + hx + ']';
        }
        return hx;
      }
    };
  };
  P.isBitmapPid = n => BITMAP_PIDS.has(n);

  // Varsayılan canlı seçim (C4 B7 1.2 PureTech EAT6 odaklı: hararet + yağ + devir + akü + yakıt)
  P.DEFAULT_LIVE = ['05', '5C', '0C', '0D', '42', '04', '11', '0B', '0E', '06', '07', '23'].map(p => 'obd:' + p);

  // C4 B7 1.2 PureTech EAT6 hazır tablo şablonları
  P.C4_PRESETS = [
    {
      id: 'hararet',
      name: 'C4 B7 Hararet & Günlük',
      desc: 'Göstergede olmayan su & yağ sıcaklığı, devir, hız, akü',
      keys: ['05', '5C', '0C', '0D', '42', '04', '46', '2F'].map(p => 'obd:' + p)
    },
    {
      id: 'puretech',
      name: '1.2 PureTech Turbo & Yakıt',
      desc: 'HPFP yakıt rayı, turbo/MAP basıncı, trim, lambda, avans',
      keys: ['23', '0B', '70', '0F', '77', '06', '07', '44', '0E', '11', '3C'].map(p => 'obd:' + p)
    },
    {
      id: 'eat6',
      name: 'EAT6 & Tork / Yük',
      desc: 'Devir, hız, istenen/gerçek tork, vites oranı, gaz pedalı',
      keys: ['0C', '0D', '61', '62', '63', '8E', 'A4', '49', '5A', '04'].map(p => 'obd:' + p)
    },
    {
      id: 'egzoz',
      name: 'Katalizör & Oksijen',
      desc: 'O2 sensörleri, katalizör sıcaklığı, EVAP ve karışım',
      keys: ['03', '14', '15', '24', '25', '34', '35', '3C', '3E', '2E', '06', '07'].map(p => 'obd:' + p)
    },
    {
      id: 'sayac',
      name: 'Akü & Teşhis Sayaçları',
      desc: 'Voltaj, ECU km, çalışma süresi, silme sonrası yol/ısınma',
      keys: ['42', '01', 'A6', '1F', '31', '4E', '30', '21', '4D'].map(p => 'obd:' + p)
    }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
