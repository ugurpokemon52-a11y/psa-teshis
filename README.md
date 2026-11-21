# PSA Teşhis

Citroën / Peugeot (PSA) araçlar için Android teşhis uygulaması. ELM327 Bluetooth adaptörle:

- Tüm PSA beyinlerini tarar (motor, EAT6 şanzıman, ABS/ESP, airbag, BSI, gösterge, direksiyon, park, klima, radyo, ekran)
- UDS (0x19) ve KWP2000 (0x17/0x18) ile **üretici arıza hafızasını** okur, geçmiş (kaçak) arızaları da gösterir
- Arıza silme (UDS 0x14 / KWP 0x14), güvenlik sistemleri için ek uyarı
- Standart OBD kodları (mod 03/07/0A), şase no, arıza lambası durumu
- Canlı veri (standart PID)
- Raporlar: her tarama km ve tarihle kaydedilir, paylaşılır
- Ham log ve komut terminali (yazma/programlama komutları engelli)
- Demo modu

APK her `main` push'unda GitHub Actions ile derlenir, **Releases** bölümünden indirilir.

Testler: `node test/run.js`
