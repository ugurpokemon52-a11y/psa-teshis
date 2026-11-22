'use strict';
/* PSA Teşhis — arıza kodu açıklamaları (SAE J2012 + Citroën C4 B7 / PSA 1.2 PureTech & EAT6 sık görülen kodlar),
   hata tipi (FTB) tabloları ve PSA VIN (şase no) çözücü. */
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
    P0597: 'Elektronik termostat ısıtıcı kontrol devresi açık',
    P0598: 'Elektronik termostat ısıtıcı devresi düşük voltaj',
    P0599: 'Elektronik termostat ısıtıcı devresi yüksek voltaj',
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
    P0715: 'Şanzıman giriş / türbin devir sensörü devresi', P0717: 'Şanzıman giriş / türbin devir sensöründen sinyal yok',
    P0720: 'Şanzıman çıkış devir sensörü devresi', P0722: 'Şanzıman çıkış devir sensöründen sinyal yok',
    P0725: 'Şanzımana motor devri girişi devresi', P0730: 'Yanlış vites oranı',
    P0731: 'Yanlış vites oranı – 1. vites', P0732: 'Yanlış vites oranı – 2. vites', P0733: 'Yanlış vites oranı – 3. vites',
    P0734: 'Yanlış vites oranı – 4. vites', P0735: 'Yanlış vites oranı – 5. vites', P0736: 'Yanlış vites oranı – geri vites',
    P0740: 'Tork konvertörü kilitleme solenoidi devresi', P0741: 'Tork konvertörü kilitleme performansı / açık kalıyor',
    P0744: 'Tork konvertörü kilitleme devresi kesintili',
    P0750: 'Vites solenoidi A', P0755: 'Vites solenoidi B', P0760: 'Vites solenoidi C', P0765: 'Vites solenoidi D',
    P0770: 'Vites solenoidi E', P0776: 'Basınç kontrol solenoidi B performansı / takılı',
    P0796: 'Basınç kontrol solenoidi C performansı / takılı', P0850: 'Park / Nötr müşürü giriş devresi',
    P0868: 'Şanzıman hidrolik yağ basıncı düşük', P0944: 'Şanzıman hidrolik basınç ünitesi basınç kaybı',
    P2096: 'Katalizör sonrası karışım çok fakir (B1)', P2097: 'Katalizör sonrası karışım çok zengin (B1)',
    P2101: 'Gaz kelebeği motoru devresi aralık / performans',
    P2122: 'Gaz pedalı sensörü D düşük sinyal', P2123: 'Gaz pedalı sensörü D yüksek sinyal',
    P2127: 'Gaz pedalı sensörü E düşük sinyal', P2128: 'Gaz pedalı sensörü E yüksek sinyal',
    P2135: 'Gaz kelebeği sensörü A/B voltaj uyumsuzluğu', P2138: 'Gaz pedalı sensörü D/E voltaj uyumsuzluğu',
    P2177: 'Rölanti dışında karışım çok fakir (B1)', P2178: 'Rölanti dışında karışım çok zengin (B1)',
    P2187: 'Rölantide karışım çok fakir (B1)', P2188: 'Rölantide karışım çok zengin (B1)',
    P2191: 'Yüksek yükte karışım çok fakir (B1)', P2192: 'Yüksek yükte karışım çok zengin (B1)',
    P2195: 'Ön oksijen sensörü fakirde takılı (B1S1)', P2196: 'Ön oksijen sensörü zenginde takılı (B1S1)',
    P2237: 'Ön oksijen sensörü pozitif akım devresi açık (B1S1)', P2261: 'Turbo bypass valfi mekanik arıza',
    P2263: 'Turbo basınç sistemi performansı', P2270: 'Arka oksijen sensörü fakirde takılı (B1S2)',
    P2271: 'Arka oksijen sensörü zenginde takılı (B1S2)', P2279: 'Emme havası kaçağı',
    P2600: 'Yardımcı elektrikli soğutma / turbo su pompası devresi',
    P2A00: 'Ön oksijen sensörü aralık / performans (B1S1)',

    // --- PSA / Citroën C4 B7 Üreticiye Özel Kodlar (PureTech 1.2, EAT6, THP, HDi, BSI) ---
    P1336: 'Üreticiye özel (PSA): Birden fazla silindirde yüksek ateşleme hatası (yakıt kesme)',
    P1337: 'Üreticiye özel (PSA): Silindir 1 ateşleme hatası (yakıt kesme)',
    P1338: 'Üreticiye özel (PSA): Silindir 2 ateşleme hatası (yakıt kesme)',
    P1339: 'Üreticiye özel (PSA): Silindir 3 ateşleme hatası (yakıt kesme)',
    P1340: 'Üreticiye özel (PSA): Silindir 4 ateşleme hatası (yakıt kesme)',
    P1385: 'Üreticiye özel (PSA): Süper vuruntu (LSPI) tespiti — yakıt / kurum / buji kontrolü',
    P15A0: 'Üreticiye özel (PSA): Motor yağ basıncı regülasyonu — basınç beklenenden yüksek',
    P15A1: 'Üreticiye özel (PSA): Motor yağ basıncı regülasyonu — basınç beklenenden düşük',
    P15A3: 'Üreticiye özel (PSA): Yağ basınç kontrol elektrovanası devresi',
    P15A4: 'Üreticiye özel (PSA): Yağ basıncı mekanik arıza / düşük basınç uyarısı',
    P15A5: 'Üreticiye özel (PSA): Motor yağ basıncı uyumluluk hatası (sensör / pompa)',
    P15A6: 'Üreticiye özel (PSA): Yağ basıncı çok yüksek (elektrovana takılı)',
    P15A7: 'Üreticiye özel (PSA): Yağ basıncı alt sınırın altında (yağ süzgeci / pompa)',
    P15A8: 'Üreticiye özel (PSA): Yağ basıncı atmosferik / sensör makullük hatası',
    P1631: 'Üreticiye özel (PSA): Motor beyni (ECU) iç arıza',
    P1632: 'Üreticiye özel (PSA): Motor tork sınırlama / ECU iç güvenlik denetimi',
    P1701: 'Üreticiye özel (PSA): Otomatik şanzıman (EAT6) güvenlik / koruma modu',
    P1727: 'Üreticiye özel (PSA): Şanzıman – motor tork sinyali uyumsuzluğu',
    P1351: 'Üreticiye özel (PSA): Kızdırma bujisi rölesi / ısıtma devresi (HDi)',
    P1434: 'Üreticiye özel (PSA): DPF katkı (Eolys) pompası arızası',
    P1435: 'Üreticiye özel (PSA): DPF katkı (Eolys) sistemi iletişim / pompa arızası',
    P1445: 'Üreticiye özel (PSA): DPF katkı miktarı üst sınırda (filtre doluluk)',
    P1446: 'Üreticiye özel (PSA): DPF katkı (Eolys) deposu seviyesi çok düşük',
    P1490: 'Üreticiye özel (PSA): DPF aşırı dolu / rejenerasyon isteği',
    P1A9C: 'Üreticiye özel (PSA): Start-Stop enerji depolama (süperkapasitör) sağlık durumu',
    P20E8: 'Üreticiye özel (PSA): AdBlue / üre basınç çok düşük',
    P20EE: 'Üreticiye özel (PSA): SCR / NOx katalizör verimi düşük',
    B1003: 'Üreticiye özel (PSA): BSI güvenli telekodlama / yapılandırma hatası',
    B1805: 'Üreticiye özel (PSA): Marş motoru arızası / marş çekmiyor',
    B1808: 'Üreticiye özel (PSA): İmmobilizer / anahtar tanıma kilidi',
    C1380: 'Üreticiye özel (PSA): ABS / ESP devridaim pompası arızası',
    C1381: 'Üreticiye özel (PSA): ABS / ESP pompa besleme rölesi',
    C1391: 'Üreticiye özel (PSA): ESP motor torku onayı alınamadı',
    U1105: 'Üreticiye özel (PSA): Direksiyon açı sensörü ile iletişim yok',
    U1108: 'Üreticiye özel (PSA): Motor beyni ile CAN iletişim kaybı',
    U1118: 'Üreticiye özel (PSA): BSI ile iletişim kaybı',
    U1208: 'Üreticiye özel (PSA): Motor beyninden geçersiz tork/devir verisi',
    U1209: 'Üreticiye özel (PSA): Otomatik şanzımandan (EAT6) geçersiz veri',
    U1213: 'Üreticiye özel (PSA): ABS / ESP beyninden geçersiz araç hızı verisi',
    U1F00: 'Üreticiye özel (PSA): Arıza olayı kaydedilmedi (BSI olay günlüğü)',

    // --- Standart U0xxx Ağ / İletişim ---
    U0001: 'Yüksek hızlı CAN iletişim hattı', U0073: 'Kontrol modülü iletişim hattı kapalı (bus off)',
    U0100: 'Motor beyni ile iletişim kaybı', U0101: 'Şanzıman beyni ile iletişim kaybı',
    U0121: 'ABS / ESP beyni ile iletişim kaybı', U0126: 'Direksiyon açı sensörü ile iletişim kaybı',
    U0131: 'Elektrikli direksiyon beyni ile iletişim kaybı', U0140: 'BSI / gövde beyni ile iletişim kaybı',
    U0151: 'Airbag beyni ile iletişim kaybı', U0155: 'Gösterge paneli ile iletişim kaybı',
    U0164: 'Klima beyni ile iletişim kaybı', U0184: 'Radyo ile iletişim kaybı',
    U0401: 'Motor beyninden geçersiz veri alındı', U0415: 'ABS / ESP beyninden geçersiz veri alındı'
  };

  const HINT = {
    P0524: '1.2 PureTech kritik uyarı: Yağ seviyesi, yağ basınç müşürü, yağ basınç elektrovanası ve özellikle karterdeki yağ süzgecinin (yağlı triger kayışı parçacıklarıyla) tıkanıp tıkanmadığı acilen kontrol edilmeli. Yağ basıncı düşükken motoru zorlamayın.',
    P15A1: '1.2 PureTech kronik kontrol: Yağlı triger kayışı kauçuk döküntüleri karter yağ süzgecini veya vakum pompası filtresini tıkamış olabilir. Yağ dolum kapağından kayış yüzeyini (çatlak/şişme) kontrol edin ve manometre ile gerçek yağ basıncını ölçtürün.',
    P15A4: '1.2 PureTech yağ basıncı uyarısı: Yağ süzgeci tıkanıklığı, yağ basınç kontrol elektrovanası ve doğru yağ viskozitesi (PSA B71 2312 0W-30 / 2297) kontrol edilmeli.',
    P15A7: '1.2 PureTech acil kontrol: Yağ basıncı alt sınırın altında. Aracı zorlamadan karter süzgeci, yağ pompası ve triger kayışı kontrol edilmeli.',
    P15A8: 'Yağ basınç sensörü/müşürü, kablo soketi (yağ sızıntısı) ve yağ basınç elektrovanası kontrol edilmeli.',
    P0521: 'Yağ basınç müşürü, kablo soketi ve gerçek yağ basıncı (manometre ile) kontrol edilmeli.',
    P0016: '1.2 PureTech / THP kontrol: Yağlı triger kayışı uzaması/diş atlaması, VVT (kam mili ayar) elektrovanası filtresi ve kam/krank sensörleri kontrol edilmeli.',
    P0011: 'Emme VVT (kam mili faz ayar) elektrovanası süzgeci yağlı kayış kalıntılarıyla tıkanmış olabilir; VVT solenoidi ve yağ seviyesi kontrol edilmeli.',
    P0014: 'Egzoz VVT elektrovanası ve süzgeci, yağ kalitesi ve triger zamanlaması kontrol edilmeli.',
    P0087: 'Direkt enjeksiyon (PureTech / THP) yüksek basınç yakıt pompası (HPFP), yakıt rayı basınç sensörü ve depo içi alçak basınç pompası kontrol edilmeli.',
    P0597: 'C4 B7 kronik arıza: Elektronik kontrollü termostat gövdesinin ısıtıcı direnci veya soketindeki soğutma suyu sızıntısı kontrol edilmeli.',
    P0598: 'C4 B7 elektronik termostat gövdesi veya kablo tesisatı kısa devresi kontrol edilmeli.',
    P0599: 'C4 B7 elektronik termostat gövdesi ısıtıcı devresi açık/kısa devre; sokette antifriz nemi olup olmadığına bakın.',
    P0300: '1.2 PureTech (3 silindir): İridyum bujiler (PureTech buji ömrüne hassastır), ateşleme bobinleri, enjektörler ve emme supap kurumu kontrol edilmeli.',
    P1336: '1.2 PureTech tekleme (yakıt kesmeli): Bujiler, ateşleme bobinleri, yüksek basınç yakıt pompası (HPFP) ve emme supaplarında kurum birikimi kontrol edilmeli.',
    P1337: 'Silindir 1 (triger tarafından değil, PSA\'da genelde volan tarafından 1. silindir sayılır — ustaya hatırlatın): Buji, bobin ve enjektör kontrol edilmeli.',
    P1338: 'Silindir 2: Buji ve ateşleme bobini yer değiştirilerek test edilebilir; enjektör kontrol edilmeli.',
    P1339: 'Silindir 3: Buji, bobin ve enjektör kontrol edilmeli.',
    P1385: '1.2 PureTech süper vuruntu (LSPI): Düşük devirde yüksek gaz yüklemesinden kaçının; doğru PSA onaylı düşük küllü yağ, bujiler ve emme supap kurumu kontrol edilmeli.',
    P0171: 'Emme havası kaçağı (turbo hortumları / külbütör kapağı PCV diyaframı), yakıt basıncı ve MAP sensörü kontrol edilmeli.',
    P0299: 'Turbo hortum kelepçeleri, wastegate vakum aktüatörü, elektrovanası (N75) ve turbo bypass valfi kontrol edilmeli.',
    P0420: 'Katalizör, ön/arka oksijen sensörleri ve egzoz kaçağı kontrol edilmeli.',
    P0715: 'EAT6 (Aisin TF-71SC): Şanzıman giriş türbin hız sensörü, soketi ve şanzıman yağ durumu kontrol edilmeli.',
    P0741: 'EAT6 tork konvertörü kilitleme kavraması veya şanzıman yağı (AW-1) seviyesi/eskimesi kontrol edilmeli.',
    P2600: '1.2 PureTech / THP turbo yardımcı elektrikli su pompası (stop sonrası turboyu soğutan pompa) ve sigortası kontrol edilmeli.'
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

  // PSA / Citroën C4 B7 şase numarası (VIN) çözücü
  const PSA_ENGINES = {
    HNY: { name: '1.2 PureTech 130 (EB2DTS)', ecu: 'Valeo VD46 / VD56', fuel: 'Benzin Turbo' },
    HNZ: { name: '1.2 PureTech 110 (EB2DT)', ecu: 'Valeo VD46 / VD56', fuel: 'Benzin Turbo' },
    HNP: { name: '1.2 PureTech 110 (EB2ADT)', ecu: 'Valeo VD56', fuel: 'Benzin Turbo' },
    HNS: { name: '1.2 PureTech 130 (EB2ADTS)', ecu: 'Valeo VD56', fuel: 'Benzin Turbo' },
    HMZ: { name: '1.2 VTi / PureTech 82 (EB2)', ecu: 'Valeo V46', fuel: 'Benzin' },
    '5GZ': { name: '1.6 THP 165 (EP6FDT)', ecu: 'Bosch MED17.4.4', fuel: 'Benzin Turbo' },
    '5FV': { name: '1.6 THP 155 (EP6CDT)', ecu: 'Bosch MED17.4.2', fuel: 'Benzin Turbo' },
    '5FS': { name: '1.6 VTi 120 (EP6C)', ecu: 'Bosch MEV17.4.2', fuel: 'Benzin' },
    '5FW': { name: '1.6 VTi 120 (EP6)', ecu: 'Bosch MEV17.4', fuel: 'Benzin' },
    '8FP': { name: '1.4 VTi 95 (EP3C)', ecu: 'Bosch MEV17.4.2', fuel: 'Benzin' },
    '9HP': { name: '1.6 HDi 92 (DV6DTED)', ecu: 'Bosch EDC17C10', fuel: 'Dizel' },
    '9HR': { name: '1.6 e-HDi 112/115 (DV6C)', ecu: 'Continental SID807', fuel: 'Dizel' },
    '9HL': { name: '1.6 e-HDi 112 (DV6C)', ecu: 'Continental SID807', fuel: 'Dizel' },
    BHY: { name: '1.6 BlueHDi 100 (DV6FD)', ecu: 'Bosch EDC17C60', fuel: 'Dizel' },
    BHZ: { name: '1.6 BlueHDi 120 (DV6FC)', ecu: 'Delphi DCM6.2', fuel: 'Dizel' },
    RHE: { name: '2.0 HDi 150 (DW10CTED4)', ecu: 'Delphi DCM3.5', fuel: 'Dizel' },
    RHH: { name: '2.0 HDi 163 (DW10CTED4)', ecu: 'Delphi DCM3.5', fuel: 'Dizel' }
  };

  function decodeVin(vin) {
    const v = String(vin || '').trim().toUpperCase();
    if (v.length < 11) return null;
    const wmi = v.slice(0, 3);
    const brand = wmi === 'VF7' ? 'Citroën' : wmi === 'VF3' ? 'Peugeot' : wmi === 'VR7' ? 'Citroën / DS' : wmi === 'VR3' ? 'Peugeot' : 'PSA';
    const body = v.slice(3, 5);
    const model = body === 'NC' ? 'C4 II (B7)' : body === 'NX' ? 'DS4' : body === '3D' ? 'C4 Picasso II' : body === 'LC' ? 'C4 I' : ('Kasa ' + body);
    const engCode = v.slice(5, 8);
    const eng = PSA_ENGINES[engCode] || null;
    const isB7 = wmi === 'VF7' && body === 'NC';
    return {
      vin: v, brand, model, isB7, engCode,
      engine: eng ? eng.name : ('Motor kodu ' + engCode),
      ecu: eng ? eng.ecu : 'CAN2010',
      fuel: eng ? eng.fuel : ''
    };
  }

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

  Object.assign(P, { DTC_DESC: D, decodeVin, decode2, describe, ftbText, udsStatus, kwpStatus, mkDtc });
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
