# Ekran ve API haritası

10 Ekim 2026. Mobile artık Expo + React Native + Expo Router kullanır. [Çalıştırma ve sınırlar](../README.md). Ekranlar demo verisinden beslenir; aşağıdaki API eşleştirmeleri entegrasyon planıdır, çalışan frontend HTTP çağrısı değildir. Backend'in gerçek uçları [API sözleşmesinde](../../backend/docs/api-contract.md) belgelenir.

## Route ve feature

| Route | Feature ekranı | Şimdiki davranış |
| --- | --- | --- |
| `/` | feed/FeedScreen | Herkes/arkadaş ve kategori filtreleri, sıradaki kombin |
| `/trendler` | trends/TrendsScreen | Dönem, kategori, tercih yapanlar ve fiyat filtreleri |
| `/paylas` | polls/CreatePollScreen | Form tasarımı; fotoğraf/yayın henüz yok |
| `/bildirimler` | notifications/NotificationsScreen | Boş durum |
| `/profil` | profile/ProfileScreen | Demo kendi profili; paylaşım/kaydedilenler |
| `/u/:username` | profile/ProfileScreen | Demo hedef profil; bilinmeyen kullanıcı için boş durum |
| `/polls/:id` | polls/PollDetailScreen | Demo kombin detayı; aynı tercih state'i |
| `/friends` | friends/FriendsScreen | Örnek arkadaş listesi |
| `/games` | games/GamesScreen | Günlük 30+30 ve özel QR lobisi hazırlık ekranı |
| `/auth` | auth/AuthScreen | Giriş entegrasyonuna kadar açıklama/Keşfet'e dönüş |
| bilinmeyen route | +not-found | Güvenli Keşfet'e dönüş |

Alt menü Keşfet, Trendler, Paylaş, Bildirim, Profil içerir. Günlük podyum Keşfet üstündeki Podyum düğmesinden açılır. `src/app/` dosyaları route/layout/parametreyle sınırlı, UI ve davranış feature'ların içindedir.

## İlk gerçek API bağlantısı

| Kullanım | Backend karşılığı | Durum |
| --- | --- | --- |
| Oturum | `/auth/*` | Backend hazır; frontend bağlanmadı |
| Kendi/başka profil | Users API | Backend hazır; frontend bağlanmadı |
| Arkadaş/engel | Social API | Backend hazır; frontend bağlanmadı |
| Keşfet listesi | Ana akış endpoint'i | Backend yol haritası 10. adım; henüz yok |
| Kombin detayı | `GET /v1/polls/:id` | Backend hazır |
| Tercih | `PUT /v1/polls/:id/vote` `{ optionId }` | Backend hazır; demo label gerçek UUID değildir |
| Sonuç | `GET /v1/polls/:id/results` | Backend hazır |
| Fotoğraf | Medya upload/process/approve API'leri | Backend hazır; picker ve frontend hattı bağlanmadı |
| Taslak/yayın | Polls oluştur/düzenle/publish API'leri | Backend hazır; form henüz API kullanmaz |
| Kaydet/yorum/bildirim | Sosyal etkileşim uçları | İlgili backend adımları bekleniyor |
| Trendler | Trend API | Arkadaşın backend kolu; henüz yok |
| Günlük oyun/QR lobi | Games API | Aktif backend 19–20. adım; henüz yok |

Gerçek oy bağlanınca sunucu `myOptionId`, `canVote`, `canViewResults` ve toplamları belirler. İstemci tahmin/puan üretmez. FRIENDS görünürlüğü istemci filtresiyle güvenceye alınmaz; backend erişimi şarttır. Demo arkadaş filtresi yalnız örnek listeden seçim yapar, gerçek arkadaşlık veya özel içerik yetkisi vermez.

## Demo davranışı ve ürün kararları

Normal oy kişisel tercihtir. +10/çoğunluğu bil tahmini kaldırıldı. Aynı paylaşımda tekrar gezinmek yeniden oy üretmez; kendi paylaşımı ve bitmiş oylamada oy kapalıdır. Gösterilen oranlar örnek oy sayılarına tek demo tercih eklenerek hesaplanır. Tercih/kaydetme yalnız bellekte, yenilemeyle sıfırlanır.

Trend sayıları ürünün seçilen kombinlerde yer almasını anlatır; doğrudan ürün oyu veya satış değildir. Filtre uygulandığında genel sıra değişimi gösterilmez. Demo eşik/formül gerçek trend ve gizlilik kararı sayılmaz. Günlük/yaş filtreleri ve gerçek katalog kimliği ayrıca bağlanacak.

Günlük oyun 30 dakika fotoğraf + 30 dakika oy, yalnız etkinlik üyeleri oy verebilir. Özel QR lobisinde süreler ayarlanır ve host fotoğraf aşamasını erken bitirebilir. Saat, puan/lig ve diğer açık kararlar [oyun tasarımında](../../backend/docs/game-design.md); bu önizlemede katılım/QR veya ödül açılmaz.

## Sonraki sıra

1. Ana ekran/kombin detayının tasarımını cihazda gözden geçir.
2. Backend ana akışı tamamla; auth/profil, akış ve gerçek tercih/sonucu bağla.
3. Medya seçme/önizleme/onay ve gerçek paylaş formunu bağla.
4. Sosyal uçlar, trend kolu ve oyun/QR teslimleriyle entegrasyona devam et.
