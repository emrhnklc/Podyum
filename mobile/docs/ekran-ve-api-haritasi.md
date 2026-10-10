# Ekran ve API haritası

10 Ekim 2026. Mobile artık Expo + React Native + Expo Router kullanır. [Çalıştırma ve sınırlar](../README.md). Ekranlar demo verisinden beslenir; aşağıdaki API eşleştirmeleri entegrasyon planıdır, çalışan frontend HTTP çağrısı değildir. Backend'in gerçek uçları [API sözleşmesinde](../../backend/docs/api-contract.md) belgelenir.

## Route ve feature

| Route | Feature ekranı | Şimdiki davranış |
| --- | --- | --- |
| `/` | feed/FeedScreen | İçerik odaklı akış; Herkes/Arkadaşlar, filtre tuşuyla açılan kategoriler, kombindeki parçalar; üstte Kişiler ve Bildirimler düğmeleri |
| `/trendler` | trends/TrendsScreen | Dönem, kategori, tercih yapanlar ve fiyat filtreleri |
| `/paylas` | polls/CreatePollScreen | Form tasarımı (2–4 seçenek, kitle seçimi; yaş grubunda birden fazla seçim); galeriden fotoğraf seçimi; yayın henüz yok |
| `/bildirimler` | notifications/NotificationsScreen | Boş durum; sekme çubuğunda gizli, Keşfet'teki zil düğmesinden ve Ayarlar'dan açılır |
| `/defile` | games/GamesScreen | Defile: lig, canlı Podyum, haftalık tema, arkadaş sıralaması, Podyum Turu (demo) |
| `/profil` | profile/ProfileScreen | "Profilim": konum, takipçi/takip, Profili Düzenle, öne çıkanlar, Gönderiler/Kombinler/Oylamalar/Kaydedilenler (demo) |
| `/u/:username` | profile/ProfileScreen | "Profil": lig rozeti, Takip Et/Mesaj, öne çıkanlar; bilinmeyen kullanıcı için boş durum |
| `/polls/:id` | polls/PollDetailScreen | Demo kombin detayı; aynı tercih state'i |
| `/profile/edit` | profile/EditProfileScreen | Profili Düzenle: kapak/avatar seçimi, ad, bio, konum, stil etiketleri, sosyal hesaplar; Kaydet bellekte tutar |
| `/settings` | settings/SettingsScreen | Ayarlar: Bildirimler ekranına gider, Çıkış karşılama ekranına döner; diğer satırlar henüz bağlı değil |
| `/people` | people/PeopleScreen | Kişiler: arama, stil filtreleri, öne çıkanlar, önerilen profiller (demo) |
| `/friends` | friends/FriendsScreen | Örnek arkadaş listesi |
| `/games` | → `/defile` | Eski bağlantılar Defile sekmesine yönlenir |
| `/auth` | auth/AuthScreen | Karşılama/giriş: açılışta bir kez gösterilir, Başla ile Keşfet'e geçer; Apple/Google/e-posta girişi bağlı değil |
| bilinmeyen route | +not-found | Güvenli Keşfet'e dönüş |

Alt menü Keşfet, Trendler, Paylaş, Defile, Profil içerir. Günlük podyum ve oyunlar Defile sekmesindedir; `/bildirimler` rotası sekmede gizlidir, Keşfet'teki zil düğmesinden açılır. `src/app/` dosyaları route/layout/parametreyle sınırlı, UI ve davranış feature'ların içindedir.

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
| Fotoğraf | Medya upload/process/approve API'leri | Backend hazır; Paylaş'ta galeriden seçim çalışır (yalnız cihazda). Yükleme hattı oturum, blur bölgesi seçimi ve önizleme onayı ekranlarını bekliyor |
| Taslak/yayın | Polls oluştur/düzenle/publish API'leri | Backend hazır; form henüz API kullanmaz |
| Kaydet/yorum/bildirim | Sosyal etkileşim uçları | İlgili backend adımları bekleniyor |
| Trendler | Trend API | Arkadaşın backend kolu; henüz yok |
| Günlük oyun/QR lobi | Games API | Aktif backend 19–20. adım; henüz yok |

Gerçek oy bağlanınca sunucu `myOptionId`, `canVote`, `canViewResults` ve toplamları belirler. İstemci tahmin/puan üretmez. FRIENDS görünürlüğü istemci filtresiyle güvenceye alınmaz; backend erişimi şarttır. Demo arkadaş filtresi yalnız örnek listeden seçim yapar, gerçek arkadaşlık veya özel içerik yetkisi vermez.

## Demo davranışı ve ürün kararları

Normal oy kişisel tercihtir. +10/çoğunluğu bil tahmini kaldırıldı. Aynı paylaşımda tekrar gezinmek yeniden oy üretmez; kendi paylaşımı ve bitmiş oylamada oy kapalıdır. Gösterilen oranlar örnek oy sayılarına tek demo tercih eklenerek hesaplanır. Tercih/kaydetme yalnız bellekte, yenilemeyle sıfırlanır.

**Açık ürün kararı — tercih değiştirme:** Ürün sahibi, yanlışlıkla dokunmaya karşı oylama açıkken tercihin değiştirilebilmesini istiyor. Demo artık böyle davranır: diğer seçeneğe dokunmak önceki tercihin yerine geçer, toplam oy değişmez. Backend bugün ilk oyu sabit tutar (`PUT /v1/polls/:id/vote` farklı seçenekte `409 VOTE_ALREADY_CAST`). Gerçek oy bağlanmadan önce kuralın değişmesi ya da arayüzün eski davranışa dönmesi gerekir; trend tarafındaki tercih olayının tekilleştirilmesi de bundan etkilenir.

**Sonuç detayları:** Oy verildikten sonra detay ekranı toplam oyu, seçenek başına oyu ve oy verenlerin cinsiyet/yaş dağılımını gösterir. Dağılımlar gönderi kimliğinden türetilen mock değerlerdir (`features/polls/data/demo-demographics.ts`). Backend'in ilk sonuç sözleşmesinde demografik kırılım yoktur; bağlanırken izin ve küçük grup eşiği sunucuda uygulanmalıdır.

**Kombindeki parçalar ve trendler:** Her seçenek, parça kimliklerinin listesini taşır (`products: string[]`); parça adı, kategori, örnek fiyat, küçük görsel ve arama sorgusu `features/polls/data/demo-products.ts` içindedir. Gerçek bağlantıda bunların karşılığı seçenek başına ProductTag ve katalogdaki ortak ürün kimliğidir; "Benzerlerini gör" yerine etiketin `externalUrl` adresi açılır. Demo trend listesi aynı parçalardan hesaplanır: parçanın etiketlendiği seçeneklere verilen oyların toplamı. Bu, mentör notundaki "seçilen kombinlerde yer alan ürünler" ölçümüdür; ürün oyu ya da satış değildir.

**Keşfet düzeni:** Görseller 9:16 oranındadır, altında parçalar listelenir. Fotoğraflar ekranı doldurur; filtreler üst satırdaki sekmelere ve tek bir ikona indirildi, eylemler alt satırda ikonlardır. Üst satırdaki kişi düğmesi Kişiler ekranına, zil düğmesi Bildirimler'e gider. "Senin oylaman" şeridi Keşfet'te yoktur; kendi oylamalarına Profil'den ulaşılır.

**Tasarım dili:** Bütün ekranlar tek paleti kullanır: beyaz zemin, `#D00A26` kırmızı, nötr gri yüzeyler ve Hanken Grotesk (`theme` içindeki `colors`/`fonts`). Pembe/krem paletler ve serif başlıklar kaldırıldı; pastel kırmızı için `colors.accentSoft` vardır. Vurgulu yazı ve simgeler kırmızıdır, gölgeler nötrdür. Karşılama ekranının arka planı kodla çizilen pastel "pin duvarı"dır (görsel dosyası yok); fotoğraf ve çıkartma görselleri hâlâ kahve tonludur ve değiştirilecektir.

Trend sayıları ürünün seçilen kombinlerde yer almasını anlatır; doğrudan ürün oyu veya satış değildir. Filtre uygulandığında genel sıra değişimi gösterilmez. Demo eşik/formül gerçek trend ve gizlilik kararı sayılmaz. Günlük/yaş filtreleri ve gerçek katalog kimliği ayrıca bağlanacak.

Günlük oyun 30 dakika fotoğraf + 30 dakika oy, yalnız etkinlik üyeleri oy verebilir. Özel QR lobisinde süreler ayarlanır ve host fotoğraf aşamasını erken bitirebilir. Saat, puan/lig ve diğer açık kararlar [oyun tasarımında](../../backend/docs/game-design.md); bu önizlemede katılım/QR veya ödül açılmaz.

## Sonraki sıra

1. Ana ekran/kombin detayının tasarımını cihazda gözden geçir.
2. Backend ana akışı tamamla; auth/profil, akış ve gerçek tercih/sonucu bağla.
3. Medya seçme/önizleme/onay ve gerçek paylaş formunu bağla.
4. Sosyal uçlar, trend kolu ve oyun/QR teslimleriyle entegrasyona devam et.
