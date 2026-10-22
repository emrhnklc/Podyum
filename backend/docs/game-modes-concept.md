# Defile yeni mod konseptleri

22 Ekim 2026. Durum: **konsept**. Mobilde örnek veriyle tıklanabilir ekranlar vardır (`/games/modes/budget`, `/games/modes/sponsored`); backend'de karşılığı yoktur, katılım kapalıdır. Mevcut günlük Podyum ve QR lobileri değişmez: [oyun tasarımı](game-design.md).

## Bütçe meydan okuması

Kullanıcı haftanın temasına, katalogdan seçtiği ve toplamı bütçeyi aşmayan parçalarla kombin kurar, fotoğrafını gönderir; topluluk 1–5 yıldızla oylar.

- Katalog ve fiyat altyapısı hazırdır; parça fiyatı yayın anındaki katalog fiyatından alınır, toplam sunucuda doğrulanır.
- Sanal deneme (Plus) ile birleşebilir: seçilen parçalar kullanıcının fotoğrafında denenir.
- Gerekenler: oyun oturumuna `budgetMinor` ve tema kuralı, teslimde parça listesi (`GameSubmission` + katalog ürün kimlikleri), fiyat snapshot'ı ve bütçe denetimi.
- Açık kararlar: fiyatı değişen ürün, para birimi, kampanya/indirim fiyatı, katalogda olmayan parça.

## Sponsorlu yarışma

Marka bir tema ve ödül açar; kombinde markanın kataloğundan en az N parça kullanılır. Kazanan kombin markanın Podyum vitrininde yayınlanır, parçalar affiliate bağlantıyla satılır.

- Gelir: yarışma başına sponsorluk ücreti + vitrin satışlarından komisyon.
- Gerekenler: sponsor/kampanya kaydı (marka, ödül, tarih, kural), teslimde marka parçası denetimi, vitrin sayfası, affiliate link ve komisyon takibi, ödül teslimi ve yasal metin (çekiliş/yarışma mevzuatı).
- Gizlilik: markaya yalnız toplu ve izinli sonuç verilir; bireysel tercih kaydı paylaşılmaz.

## Diğer adaylar

Kafa kafaya düello (iki kişi, 10 dk oylama), sezon/rozet sistemi (lig eşikleri hazır), özel gün temaları.
