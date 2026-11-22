'use strict';
/* PSA Teşhis — standart OBD canlı veri tablosu (SAE J1979 mod 01). n = veri bayt sayısı. */
(function (G) {
  const P = G.PSA = G.PSA || {};
  const W = (a, b) => a * 256 + b;
  const pct = a => Math.round(a * 100 / 255);
  const trim = a => +((a - 128) * 100 / 128).toFixed(1);
  const lam = d => +(2 / 65536 * W(d[0], d[1])).toFixed(3);
  const FUEL_SYS = { 1: 'Açık döngü (ısınıyor)', 2: 'Kapalı döngü (normal)', 4: 'Açık döngü (yük / yakıt kesme)', 8: 'Açık döngü (arıza)', 16: 'Kapalı döngü (sensör arızalı)' };

  // g: grup. max: çubuk için üst sınır (0 = çubuk yok). warn: uyarı koşulu. txt: metin değer
  P.PIDS = [
    { pid: '0C', g: 'Motor', name: 'Motor devri', unit: 'dev/dk', n: 2, f: d => Math.round(W(d[0], d[1]) / 4), max: 7000 },
    { pid: '0D', g: 'Motor', name: 'Hız', unit: 'km/s', n: 1, f: d => d[0], max: 220 },
    { pid: '04', g: 'Motor', name: 'Hesaplanan motor yükü', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '43', g: 'Motor', name: 'Mutlak motor yükü', unit: '%', n: 2, f: d => Math.round(W(d[0], d[1]) * 100 / 255), max: 200 },
    { pid: '0E', g: 'Motor', name: 'Ateşleme avansı', unit: '°', n: 1, f: d => +(d[0] / 2 - 64).toFixed(1), max: 60 },
    { pid: '61', g: 'Motor', name: 'İstenen tork', unit: '%', n: 1, f: d => d[0] - 125, max: 100 },
    { pid: '62', g: 'Motor', name: 'Gerçek tork', unit: '%', n: 1, f: d => d[0] - 125, max: 100 },
    { pid: '63', g: 'Motor', name: 'Referans tork', unit: 'Nm', n: 2, f: d => W(d[0], d[1]), max: 0 },
    { pid: '8E', g: 'Motor', name: 'Sürtünme torku', unit: '%', n: 1, f: d => d[0] - 125, max: 0 },

    { pid: '11', g: 'Gaz / pedal', name: 'Gaz kelebeği', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '45', g: 'Gaz / pedal', name: 'Bağıl gaz kelebeği', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '47', g: 'Gaz / pedal', name: 'Gaz kelebeği B', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '4C', g: 'Gaz / pedal', name: 'Gaz kelebeği komutu', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '49', g: 'Gaz / pedal', name: 'Gaz pedalı D', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '4A', g: 'Gaz / pedal', name: 'Gaz pedalı E', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '5A', g: 'Gaz / pedal', name: 'Bağıl gaz pedalı', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },

    { pid: '0B', g: 'Hava / turbo', name: 'Emme basıncı (MAP)', unit: 'kPa', n: 1, f: d => d[0], max: 255 },
    { pid: '33', g: 'Hava / turbo', name: 'Atmosfer basıncı', unit: 'kPa', n: 1, f: d => d[0], max: 110 },
    { pid: '10', g: 'Hava / turbo', name: 'Hava akışı (MAF)', unit: 'g/s', n: 2, f: d => +(W(d[0], d[1]) / 100).toFixed(1), max: 150 },
    { pid: '0F', g: 'Hava / turbo', name: 'Emme havası sıcaklığı', unit: '°C', n: 1, f: d => d[0] - 40, max: 80 },
    { pid: '68', g: 'Hava / turbo', name: 'Emme havası sensörü 1', unit: '°C', n: 2, f: d => d[1] - 40, max: 80 },
    { pid: '6F', g: 'Hava / turbo', name: 'Turbo giriş basıncı', unit: 'kPa', n: 2, f: d => d[1], max: 255 },

    { pid: '03', g: 'Yakıt', name: 'Yakıt sistemi durumu', unit: '', n: 1, txt: true, f: d => FUEL_SYS[d[0]] || ('0x' + P.h2(d[0])), max: 0 },
    { pid: '06', g: 'Yakıt', name: 'Kısa yakıt düzeltme', unit: '%', n: 1, f: d => trim(d[0]), max: 25, warn: v => Math.abs(v) >= 20 },
    { pid: '07', g: 'Yakıt', name: 'Uzun yakıt düzeltme', unit: '%', n: 1, f: d => trim(d[0]), max: 25, warn: v => Math.abs(v) >= 15 },
    { pid: '23', g: 'Yakıt', name: 'Yakıt rayı basıncı', unit: 'bar', n: 2, f: d => +(W(d[0], d[1]) * 10 / 100).toFixed(1), max: 250 },
    { pid: '22', g: 'Yakıt', name: 'Yakıt rayı basıncı (vakuma göre)', unit: 'kPa', n: 2, f: d => +(W(d[0], d[1]) * 0.079).toFixed(1), max: 0 },
    { pid: '59', g: 'Yakıt', name: 'Yakıt rayı mutlak basıncı', unit: 'bar', n: 2, f: d => +(W(d[0], d[1]) * 10 / 100).toFixed(1), max: 250 },
    { pid: '0A', g: 'Yakıt', name: 'Yakıt basıncı', unit: 'kPa', n: 1, f: d => d[0] * 3, max: 765 },
    { pid: '5E', g: 'Yakıt', name: 'Anlık yakıt tüketimi', unit: 'L/sa', n: 2, f: d => +(W(d[0], d[1]) / 20).toFixed(2), max: 30 },
    { pid: '5D', g: 'Yakıt', name: 'Enjeksiyon zamanlaması', unit: '°', n: 2, f: d => +(W(d[0], d[1]) / 128 - 210).toFixed(1), max: 0 },
    { pid: '44', g: 'Yakıt', name: 'İstenen lambda', unit: 'λ', n: 2, f: lam, max: 2 },
    { pid: '2F', g: 'Yakıt', name: 'Yakıt seviyesi', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '52', g: 'Yakıt', name: 'Etanol oranı', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '2E', g: 'Yakıt', name: 'Kanister temizleme komutu', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },
    { pid: '2C', g: 'Yakıt', name: 'EGR komutu', unit: '%', n: 1, f: d => pct(d[0]), max: 100 },

    { pid: '14', g: 'Oksijen sensörü', name: 'Ön O2 sensörü voltajı (B1S1)', unit: 'V', n: 2, f: d => +(d[0] / 200).toFixed(3), max: 1.1 },
    { pid: '15', g: 'Oksijen sensörü', name: 'Arka O2 sensörü voltajı (B1S2)', unit: 'V', n: 2, f: d => +(d[0] / 200).toFixed(3), max: 1.1 },
    { pid: '24', g: 'Oksijen sensörü', name: 'Ön geniş bant lambda (B1S1)', unit: 'λ', n: 4, f: lam, max: 2 },
    { pid: '25', g: 'Oksijen sensörü', name: 'Arka geniş bant lambda (B1S2)', unit: 'λ', n: 4, f: lam, max: 2 },
    { pid: '34', g: 'Oksijen sensörü', name: 'Ön geniş bant lambda – akım (B1S1)', unit: 'λ', n: 4, f: lam, max: 2 },
    { pid: '35', g: 'Oksijen sensörü', name: 'Arka geniş bant lambda – akım (B1S2)', unit: 'λ', n: 4, f: lam, max: 2 },

    { pid: '05', g: 'Sıcaklık', name: 'Soğutma suyu', unit: '°C', n: 1, f: d => d[0] - 40, max: 130, warn: v => v >= 110 },
    { pid: '67', g: 'Sıcaklık', name: 'Soğutma suyu sensörü 1', unit: '°C', n: 3, f: d => d[1] - 40, max: 130, warn: v => v >= 110 },
    { pid: '5C', g: 'Sıcaklık', name: 'Motor yağı sıcaklığı', unit: '°C', n: 1, f: d => d[0] - 40, max: 150, warn: v => v >= 130 },
    { pid: '46', g: 'Sıcaklık', name: 'Dış hava', unit: '°C', n: 1, f: d => d[0] - 40, max: 60 },
    { pid: '3C', g: 'Sıcaklık', name: 'Katalizör sıcaklığı (B1S1)', unit: '°C', n: 2, f: d => Math.round(W(d[0], d[1]) / 10 - 40), max: 1000 },
    { pid: '3E', g: 'Sıcaklık', name: 'Katalizör sıcaklığı (B1S2)', unit: '°C', n: 2, f: d => Math.round(W(d[0], d[1]) / 10 - 40), max: 1000 },
    { pid: '78', g: 'Sıcaklık', name: 'Egzoz gazı sıcaklığı (B1)', unit: '°C', n: 9, f: d => Math.round(W(d[1], d[2]) / 10 - 40), max: 1000 },

    { pid: '42', g: 'Elektrik', name: 'Beyin (akü) voltajı', unit: 'V', n: 2, f: d => +(W(d[0], d[1]) / 1000).toFixed(2), max: 16, warn: v => v < 11.8 || v > 15 },

    { pid: 'A6', g: 'Sayaçlar', name: 'Kilometre (motor beyni)', unit: 'km', n: 4, f: d => Math.round((d[0] * 16777216 + d[1] * 65536 + d[2] * 256 + d[3]) / 10), max: 0 },
    { pid: '1F', g: 'Sayaçlar', name: 'Motor çalışma süresi', unit: 'sn', n: 2, f: d => W(d[0], d[1]), max: 0 },
    { pid: '31', g: 'Sayaçlar', name: 'Kod silindikten sonra yol', unit: 'km', n: 2, f: d => W(d[0], d[1]), max: 0 },
    { pid: '4E', g: 'Sayaçlar', name: 'Kod silindikten sonra süre', unit: 'dk', n: 2, f: d => W(d[0], d[1]), max: 0 },
    { pid: '30', g: 'Sayaçlar', name: 'Kod silindikten sonra ısınma', unit: 'kez', n: 1, f: d => d[0], max: 0 },
    { pid: '21', g: 'Sayaçlar', name: 'Arıza lambası yanıkken yol', unit: 'km', n: 2, f: d => W(d[0], d[1]), max: 0 },
    { pid: '4D', g: 'Sayaçlar', name: 'Arıza lambası yanıkken süre', unit: 'dk', n: 2, f: d => W(d[0], d[1]), max: 0 }
  ];
  P.PIDS.forEach(d => { d.key = 'obd:' + d.pid; });

  // Varsayılan canlı seçim
  P.DEFAULT_LIVE = ['0C', '0D', '05', '04', '11', '0B', '0E', '06', '07', '23', '42', '3C'].map(p => 'obd:' + p);

  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
