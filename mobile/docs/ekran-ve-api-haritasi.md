# Ekran ve API haritası

11 Ekim 2026. Expo + React Native + Expo Router. Keşfet, kayıt, profil, sosyal ekranlar, bildirim/tercihler, paylaşım ve Defile gerçek API kullanır. Trendler gerçek API ve katalog detayı kullanır; [bağlantı sözleşmesi](trends-api-integration.md). [Bağlantı ayrıntıları, sınırlar ve testler](connected-screens-integration.md), [ana ekran](home-api-integration.md), [kayıt](registration-api-integration.md), [backend API sözleşmesi](../../backend/docs/api-contract.md).

## Route ve feature

| Route | Feature | Davranış |
| --- | --- | --- |
| `/` | feed | Gerçek akış, tercih/sonuç/kaydetme, kategori ve arkadaş filtresi; kişi arama ve bildirim erişimi |
| `/trendler` | trends | Gerçek filtreli API, cursor/yenileme, boş/yetersiz/hata ve katalog detayı |
| `/paylas` | polls | Fotoğraf yükleme → son görüntü/onay → taslak → yayın; kullanıcı varsayılanları |
| `/polls/:id` | polls | Gerçek detay/sonuç/neden; sahibine taslak yayınla/sil, iptal ve yorum ayarı; diğerine şikâyet |
| `/comments/:pollId` | polls | Gerçek sayfalı yorumlar, ekle/sil, yazar profili, şikâyet |
| `/people` | people | Kullanıcı adı önekiyle gerçek arama, profil ve arkadaşlık işlemleri |
| `/friends` | friends | Arkadaşlar, gelen/giden istekler ve yönetimi |
| `/profil`, `/u/:username` | profile | Gerçek profil ve paylaşımlar; Gönderi/Takipçi/Takip sayıları, beğeni sayılı ızgara; kendinde kaydedilenler/arkadaşlar/defile geçmişi; diğerinde Takip Et, arkadaşlık/engel/şikâyet |
| `/follows?userId=&kind=` | people | Takipçiler / takip edilenler; satırdan takip et/bırak |
| `/profile/edit` | profile | Kullanıcı adı, ad, bio, stil, avatar onayı ve kalıcı kayıt |
| `/bildirimler` | notifications | Gerçek liste/okunmamış/okundu/ilgili içerik ve tercihler; sekme çubuğunda gizli |
| `/settings` | settings | Alt ayarlar ve gerçek çıkış |
| `/settings/preferences` | settings | `section=feed/privacy/location/notifications`: sunucuda kalıcı tercihler |
| `/settings/blocked` | settings | Gerçek engellenenler ve engeli kaldırma |
| `/settings/security` | settings | Şifre sıfırlama, tüm oturumlardan çıkış ve onaylı hesap silme |
| `/settings/info` | settings | Tema/dil/destek/hukuki içeriklerin mevcut durumu; henüz sunulmamış hizmet için başarı göstermez |
| `/reports/new` | moderation | USER/POLL/COMMENT hedefi ve gerekçesiyle gerçek şikâyet |
| `/defile` | games | Görseller korunur; gerçek lig, hızlı eşleş, davetli oda, Sonbahar temalı odalar, arkadaşlar ve geçmiş |
| `/games/browse` | games | Açık/günlük odalar, tema araması, katılım ve oda oluşturma |
| `/games/history`, `/games/league` | games | Katılım geçmişi ve gerçek lig puanları |
| `/games/new` | games | Tema, katılımcı sayısı, süre, planlı/elle başlangıç, herkese açık/davetli oda |
| `/games/:id` | games | Oda, QR, başlat/erken bitir/ayrıl, fotoğraf önizleme/onay/teslim, 1–5 yıldız turu, sonuç |
| `/games/join?token=` | games | Davet önizleme → giriş → davete dön → kullanıcı onayıyla katıl |
| `/games` | yönlendirme | `/defile` |
| `/auth`, `/auth/login` | auth | Karşılama ve gerçek e-posta girişi; Google/Apple kurulumu bekliyor |
| `/auth/register`, `/auth/verify-email` | auth | Gerçek kayıt/doğrulama/profil/avatar/stil kurulumu |
| `/auth/reset-password` | auth | Sıfırlama talebi ve anahtarla yeni şifre; e-posta teslimi yerel |
| bilinmeyen route | +not-found | Keşfet'e dönüş |

Alt menü Keşfet, Trendler, Paylaş, Defile, Profil. `src/app/` yalnız route/layout/parametre taşır. İş akışları feature'larda, oturum kontrollü HTTP `lib/api` altında, odak/iptal/sayfalama hook'ları `hooks/use-api-query.ts` içindedir.

Gerçek kartlarda sonucu ve erişimi sunucu belirler; demografi/puan uydurulmaz. FRIENDS görünürlüğünü backend uygular. Aşağıdaki demo kuralları eski örnek ekranlar içindir, gerçek işlemleri değiştirmez.

## Demo davranışı ve ürün kararları

Bu bölüm demo ekranlar içindir. Gerçek kartta tercih değişmez; gerçek sonuçta demografi üretilmez.

Normal oy kişisel tercihtir. +10/çoğunluğu bil tahmini kaldırıldı. Aynı paylaşımda tekrar gezinmek yeniden oy üretmez; kendi paylaşımı ve bitmiş oylamada oy kapalıdır. Gösterilen oranlar örnek oy sayılarına tek demo tercih eklenerek hesaplanır. Tercih/kaydetme yalnız bellekte, yenilemeyle sıfırlanır.

**Açık ürün kararı — tercih değiştirme:** Ürün sahibi, yanlışlıkla dokunmaya karşı oylama açıkken tercihin değiştirilebilmesini istiyor. Demo artık böyle davranır: diğer seçeneğe dokunmak önceki tercihin yerine geçer, toplam oy değişmez. Backend bugün ilk oyu sabit tutar (`PUT /v1/polls/:id/vote` farklı seçenekte `409 VOTE_ALREADY_CAST`). Gerçek ekran sunucunun değişmez tercih kuralını uygular; kural değişikliği ayrıca ürün/backend kararı gerektirir; trend tarafındaki tercih olayının tekilleştirilmesi de bundan etkilenir.

**Sonuç detayları:** Oy verildikten sonra detay ekranı toplam oyu, seçenek başına oyu ve oy verenlerin cinsiyet/yaş dağılımını gösterir. Dağılımlar gönderi kimliğinden türetilen mock değerlerdir (`features/polls/data/demo-demographics.ts`). Backend'in ilk sonuç sözleşmesinde demografik kırılım yoktur; bağlanırken izin ve küçük grup eşiği sunucuda uygulanmalıdır.

**Kombindeki parçalar ve trendler:** Her seçenek, parça kimliklerinin listesini taşır (`products: string[]`); parça adı, kategori, örnek fiyat, küçük görsel ve arama sorgusu `features/polls/data/demo-products.ts` içindedir. Gerçek bağlantıda bunların karşılığı seçenek başına ProductTag ve katalogdaki ortak ürün kimliğidir; "Benzerlerini gör" yerine etiketin `externalUrl` adresi açılır. Demo trend listesi aynı parçalardan hesaplanır: parçanın etiketlendiği seçeneklere verilen oyların toplamı. Bu, mentör notundaki "seçilen kombinlerde yer alan ürünler" ölçümüdür; ürün oyu ya da satış değildir.

**Keşfet düzeni:** Kırmızı-siyah tasarım: tek satırlık üst çubukta Podyum, altı çizili Herkes/Arkadaşlar sekmeleri ve filtre/Kişiler/Bildirim ikonları. Oylama çerçevesizdir; 9:16 seçenekler ekran genişliğini kullanır. Kaydet/yorum/sonuç ikon, sıradaki kombin kırmızı yuvarlak düğmedir. Etiketli parçalar kartın altında liste olarak görünür. "Senin oylaman" şeridi Keşfet'te yoktur; kendi oylamalarına Profil'den ulaşılır.

Trend sayıları ürünün seçilen kombinlerde yer almasını anlatır; doğrudan ürün oyu veya satış değildir. Filtre uygulandığında genel sıra değişimi gösterilmez. Demo eşik/formül gerçek trend ve gizlilik kararı sayılmaz. Günlük/yaş/marka/para birimi filtreleri ve gerçek katalog kimliği 20 Ekim’de bağlandı; mevcut ekran demo hesap kullanmaz.

Günlük oyun 30 dakika fotoğraf + 30 dakika oy, yalnız etkinlik üyeleri oy verebilir. Özel QR lobisinde süreler ayarlanır ve host fotoğraf aşamasını erken bitirebilir. Saat, puan/lig ve diğer açık kararlar [oyun tasarımında](../../backend/docs/game-design.md); gerçek mobil oda/QR/yıldız/sonuç akışı bağlıdır. Günlük saat ayarlanmamışsa yalnız açık/davetli odalar kullanılabilir.

## Sonraki sıra

1. Fiziksel cihazda kayıt, galeri/kamera, QR, paylaşım ve oturum dönüşünü kontrol et.
2. Trendler ve katalog detayının gerçek API bağlantısı tamamlandı; fiziksel cihaz kabulünü yap.
3. Gerçek e-posta/push, OAuth, Plus/ödeme ve haftalık etkinlik uçlarını hazır oldukça bağla.

20 Ekim 2026: Defile turn yanıtı `cycle`, `votingEndsAt`, `remainingSeconds` taşır; kartlar 10 sn döner, toplam süre günlükte 30 dk, lobide seçilen süredir. Backend katalog ve ADMIN tema/takvim/bakım uçları hazır; mobil ürün seçimi/kombin etiketi de bağlandı. [Güncel sözleşme](connected-screens-integration.md).
