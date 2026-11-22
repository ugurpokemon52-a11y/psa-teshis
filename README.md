# C4 B7 Teşhis (Citroën C4 II · 1.2 PureTech EAT6)

Citroën C4 II (B7) — özellikle **1.2 PureTech + EAT6** başta olmak üzere PSA araçlar için Android teşhis ve canlı kokpit uygulaması. ELM327 Bluetooth (Klasik / BLE) adaptörle tamamen çevrimdışı çalışır:

- **C4 B7 Kokpit Arayüzü & 4 Değiştirilebilir Kadran Rengi:** Buz Mavisi, Buz Beyazı, Derin Safir ve Kehribar temaları (C4 B7'nin gösterge renk tuşundan ilhamla)
- **İnteraktif C4 B7 Araç ECU Haritası:** Tüm PSA beyinlerini (Motor, EAT6 Şanzıman, ABS/ESP, Airbag, BSI, Gösterge, Direksiyon, Park, Klima, Radyo, Ekran, Multimedya) tarar, üstten görünüm araç şemasında durumlarını gösterir
- **C4 B7 1.2 PureTech & EAT6 Arıza Sözlüğü:** UDS (`0x19`) ve KWP2000 (`0x17`/`0x18`) üretici arıza hafızası, geçmiş (kaçak) arızalar, PureTech yağ basıncı/kayış/tekleme (`P15A1`, `P1336`, `P0524`, `P0016`, `P0597`) ve EAT6 ipuçları, otomatik VIN (`VF7NC...`) çözücü
- **Kapsamlı Canlı Veri (92+ Standart OBD PID + Bilinmeyen Desteklenen PID Keşfi + Özel UDS/KWP DID):**
  - **Özel Canlı Veri Tabloları:** Kendi tablolarını oluştur, isimlendir, parametre ara, sırasını (`▲`/`▼`) düzenle, CSV olarak dışa aktar
  - **3 Canlı Görünüm:** **Kokpit** (C4 B7 yarım daire kadranlar + dolgulu grafikler), **Tablo** (tek ekranda çoklu canlı veri okuma tablosu) ve **Kart**
  - **Hazır C4 B7 Profilleri:** Hararet & Günlük (göstergede olmayan su & yağ sıcaklığı), 1.2 PureTech Turbo & Yakıt, EAT6 & Tork, Katalizör & Oksijen, Desteklenen Tümü
  - **Formüllü Özel Sensörler:** Hem pin 6/14 standart OBD CAN (`7E0` Motor / `7E1` EAT6) hem pin 3/8 PSA tanı hattı için UDS `0x22` / KWP `0x21` tarayıcı + çarpan/ofset formülü
- **Raporlar & C4 B7 Bakım Takibi:** Tarama geçmişi, önceki taramayla fark (`+yeni` / `✓ düzeldi`), 0W-30 yağ / yağlı triger / buji / EAT6 yağı km takibi
- **Renkli ELM327 Terminali:** Güvenli hızlı komut çipleri (beyne yazma/programlama komutları engelli)
- **Demo Modu**

APK her `main` push'unda GitHub Actions ile derlenir, **Releases** bölümünden indirilir.

Testler: `node test/run.js`
