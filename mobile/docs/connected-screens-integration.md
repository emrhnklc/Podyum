# Diğer ekranların gerçek API bağlantısı

11 Ekim 2026. Keşfet ve kayıt bağlantısının devamı. Backend şeması değiştirilmedi; son pull ile gelen iki oyun migration'ı yerel DB'ye `npm run db:deploy` ile uygulandı. Güncel veritabanı 20 migration içeriyor. Reset veya seed çalıştırılmadı.

## Bağlanan akışlar

| Ekran | Gerçek davranış |
| --- | --- |
| Kişiler | Kullanıcı adıyla arama, sayfalama, gerçek profile geçiş |
| Arkadaşlar | Arkadaş listesi, gelen/giden istekler, gönderme/geri alma/kabul/red/arkadaşlıktan çıkarma |
| Profil | Kendi/başka kullanıcının bilgileri, arkadaş sayısı, paylaşımları, açık oylamaları; kendinde kaydedilenler ve defile geçmişi |
| Profil düzenle | Kullanıcı adı, görünen ad, biyografi, sunucudaki stil etiketleri, avatar yükleme/önizleme/onay/kaldırma |
| Paylaş | Sunucudaki görünürlük/yorum/blur varsayılanları; 2–4 fotoğrafı işle → son görüntüyü göster → açık onay → taslak oluştur → yayınla |
| Oylama detayı | Yayınlama, taslak silme, iptal, yorumları açma/kapatma; oy sonrası isteğe bağlı hazır neden ve gerçek neden sayıları |
| Yorumlar | Liste/ekle/sil bağlantısı korunur; yazarın profili ve yorum şikâyeti eklendi |
| Bildirimler | Liste, okunmamış sayısı, tek/tümünü okundu yapma, ilgili profil/oylama/defileye geçiş |
| Gizlilik ve tercihler | Bildirim bayrakları, yeni paylaşım varsayılanları, isteğe bağlı cinsiyet/yaş/şehir ve analiz izni |
| Engellenen kişiler | Liste, profil üzerinden engelleme, ayarlardan engeli kaldırma |
| Güvenlik | Şifre sıfırlama talebi ve anahtarla onay, tüm cihazlardan çıkış; kullanıcı adı ve açık onayla hesap silme |
| Şikâyet | Kullanıcı/oylama/yorum için gerekçe ve isteğe bağlı açıklama gönderme |
| Defile | Gerçek lig, açık oda/günlük etkinlik bulma, oda kurma/katılma, QR daveti, geçmiş ve sonuçlar |
| Defile odası | Fotoğraf önizleme/onay/teslim, host başlatma ve fotoğraf aşamasını erken bitirme, uygun aşamada ayrılma; mevcut 1–5 yıldız turu ve sonuç ekranı |

Defile ana ekranındaki canlı ve Sonbahar görselleri, kartları ve stilleri korundu. Sonbahar düğmesi aynı temadaki açık odaları gösterir; yeni oda formuna tema aktarılır. Ayrı bir haftalık yarışma API'si olmadığı için bu düğme haftalık yarışmaya kayıt/ödül üretmez. Arkadaş bölümü gerçek bağlantıları gösterir; haftalık puan sıralaması değildir.

## Sözleşmede dikkat edilecekler

- Ortak API sorguları ekran odaklanınca yenilenir; hesap/arama değişince eski veri gösterilmez. İstekler iptal edilir, eski yanıtlar yeni ekran verisini ezemez. Sayfalı listelerde sunucunun cursor'ı kullanılır.
- `/me/polls` küçük özet döndürür: `thumbnailPath` vardır, `options` yoktur. Kaydedilenler ve başka kullanıcının paylaşımları tam kart döndürür. Profil bu farkı karşılar.
- `/users/search` kullanıcı adı önekiyle çalışır. Görünen ada göre arama veya öneri algoritması varmış gibi gösterilmez.
- Özel profil/medya/paylaşım erişimine backend karar verir. Kimlik ve erişim token'ı genel URL/cache'e yazılmaz. Görsel yüklenemezse tekrar deneme gösterilir.
- Medya önizlemesindeki onay düğmesi, sunucudaki görüntü yüklenmeden açılmaz. Fotoğraf hazırlamak paylaşımı yayınlamaz veya defileye teslim etmez.
- Form yayınında ağ hatasında aynı taslak/yayın idempotency anahtarları korunur. Form değişince fotoğraf/taslak ilerlemesi yeniden başlar. Yönetim komutları güncel `expectedVersion` gönderir; çakışmada veri yenilenir.
- Normal tercih değişmez ve yıldız kazandırmaz. Neden seçmek tercihi değiştirmez; neden değiştirilebilir/kaldırılabilir.
- Bildirimlerin tümünü okuma, liste yanıtındaki `serverNow` öncesini kapsar. Sonradan gelen bildirimi yanlışlıkla okundu yapmaz.
- QR/paylaşım adresi `expo-linking` ile çalışma ortamına göre üretilir: Expo Go geliştirme adresi, web adresi veya kurulu uygulamanın şeması.
- Özel oda “Davetle” demektir; geçerli QR ve oturum yeterlidir, arkadaşlık zorunlu değildir. Günlük/açık oda için davetsiz katılım sunucudan yapılır.
- Lig puanları `/me/league` üzerinden okunur. Davetli odalar lig puanı vermez. Sonuçtaki puanı istemci hesaplamaz.
- Hesap silme taze giriş gerektirir. Backend `RECENT_LOGIN_REQUIRED` döndürürse kullanıcı yeniden giriş yapmalıdır; onay atlanmaz. Geçmiş sonuçlar anonim kalır.

## Gerçekten bekleyenler

- Affiliate/Plus/reklam ve ayrı haftalık yarışma API’leri. Katalog, mobil ürün seçimi ve Trendler gerçek API’ye bağlıdır; ödeme/abonelik hakkı oluşturulmaz.
- Google/Apple sağlayıcı kurulumu; gerçek e-posta ve telefona push teslimi. Şifre sıfırlama iletisi geliştirmede backend'in yerel posta kutusundadır; token frontend'den okunmaz.
- Otomatik yüz bulma. Bölgeleri şimdilik kullanıcı elle işaretler (aşağıda).
- Kapak fotoğrafı, konum, DM, öne çıkanlar ve topluluklar. Bunlar için çalışan API yoksa başarı makbuzu üretilmez. Takip ve beğeni 21 Ekim'de bağlandı (aşağıda).
- Günlük defile saati ürün kararıdır. Ayarlanmamışsa ekranda belirtilir; istemci rastgele günlük etkinlik yaratmaz.
- Fiziksel iOS/Android cihazında galeri/kamera izinleri, QR ile uygulamaya dönüş ve paylaşım menüsü testi. Web testi ve native export bu kontrolün yerine geçmez.

## Tekrar kontrol

Backend'i yerel DB ile açtıktan sonra `mobile/` içinde:

```bash
npm run typecheck
npm run lint
npm run check:expo
npx tsx --test tests/login.test.ts tests/registration.test.ts tests/session-manager.test.ts
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000/v1 npm run test:connected-api
npm run build
```

API smoke yalnız açıkça seçilmiş localhost `/v1` adresinde çalışır. Yerel e-posta doğrulaması kapalı olmalı. İki benzersiz test hesabı oluşturur; özel oylama, medya, arkadaşlık, yorum/şikâyet, QR defilesi, yıldız/sonuç/geçmiş, tercihler, bildirim okuma ve engelleme sözleşmelerini kontrol eder. Oturumları kapatır; test kayıtları yerel DB'de kalır. Gerçek kullanıcıları, şemayı veya DB'yi sıfırlamaz; parola/token basmaz.

Ayrıca Chrome web önizlemesinde iki ayrı oturumla sosyal işlemler, profil düzenleme, tercihler, bildirim ekranı, Sonbahar oda bağlantısı ve fotoğraflı yayın ve iki katılımcılı özel defile (QR yenileme, giriş sonrası davete dönüş, fotoğraf onayı, host erken bitirme, yıldız ve sonuç) akışı düğmelere basılarak kontrol edildi. Önizleme görüntüsü geçici ağ hatası verdiğinde yayın düğmesinin kapalı kaldığı ve görüntünün yeniden yüklenebildiği ayrıca doğrulandı.

## 20 Ekim: toplam oy süresi ve sunum döngüsü

Günlük etkinlik 30 dk fotoğraf + tam 30 dk oy; lobi `votingSeconds` süresini kullanır. Lobi bütün uygun oylar tamamlanınca erken sonuç açabilir; günlük etkinlik erken kapanmaz. 10 sn kart sunumu toplam pencereyi belirlemez, son karttan sonra döngü yapar. Turn sözleşmesinde `cycle`, `votingEndsAt`, `remainingSeconds` vardır; küçük sayaç toplam kalan süreyi de gösterir. Yeniden bağlanma güncel REST state/turn alır. Canlı/Sonbahar kart tasarımı korunmuştur.

Tema/takvim ADMIN API'si backend'de hazır; yönetim UI'si eklenmedi. Katalog arama/öneri ve mobil ürün seçiminin güncel bağlantısı aşağıdadır. Ayrıntılar backend'in güncel uygulama planında.

## 20 Ekim: kombin ürünleri ve katalog bağlantısı

Paylaş ekranında fotoğraf başına ürün etiketleme açılır: isim/link ile katalogda ara, sonuçtan seç, elle ekle veya özel ürün önerisini gönder. Bir seçenekte en fazla 10 ürün vardır; listeden kaldırıp değiştirilebilir. Katalog seçimi yalnız `catalogProductId` ve varsa özgün URL gönderir; ad/fiyat alanlarını sunucu alır. Elle etiketler de çalışır. Öneri onaylanınca eski etiket kendiliğinden katalog ürünü sayılmaz.

Yayın anında katalog kimliği/sürüm/ad/fiyat/kaynak sabitlenir; eski yayındaki bilgiler sonradan katalog düzeltmesi veya birleştirmeyle değişmez. Detay/kartın ürün düğmesi özgün dış linki açar. Paylaşım görünürlüğü ve medya yetkileri korunur. Fotoğraf önizleme/onay, yayın tekrarları ve ürün payload'ı aynı akıştadır; ürün düzenlemek istek imzasını yeniler.

[Backend sözleşmesi](../../backend/docs/poll-catalog-integration.md). Mobil `npm run test:product-tags` sınır/fiyat ve katalog alanlarının istemciden taşınmamasını denetler. Trendler ekranı da 20 Ekim’de gerçek API’ye bağlandı; [sözleşme](trends-api-integration.md). Defile tasarımı bu adımda değiştirilmedi.

## 20 Ekim — telefonda Yayına al yükleme düzeltmesi

Expo 57 global fetch, React Native `{ uri, name, type }` nesnesini multipart dosya olarak kodlamıyor. Bu hata ortak istemcide ağ hatasına çevrildiğinden, sunucu yükleme iznini oluşturduğu halde kullanıcı “Sunucuya ulaşılamadı” görüyordu. Yerel SDK kodlayıcısıyla eski biçimin reddedildiği yeniden üretildi.

Ortak `uploadMedia` artık native/web üzerinde Blob gönderir; `readPhoto` okuduğu Blob'u URI nesnesine geri çevirmez. Kayıt avatarı gibi eski URI çağıranlar da ortak yükleyicide Blob'a çevrilir. Okuma ve boyut denetimi yükleme izninden önce yapılır; yerel dosya hatası bağlantı hatasından ayrılır. Oturum koruması, MIME/boyut eşleşmesi ve açık yüz-yok onayı korunur.

- `npm run test:media-upload`: kurulu Expo multipart kodlayıcısında eski hata/yeni gerçek baytlar, URI/Blob, hesap değişimi, dosya okuma/boyut ve POLL/AVATAR/GAME için **8/8**.
- Bütün mobil testler **37/37**; TypeScript/lint ve iOS/Android/web export başarılı.
- Gerçek yerel API'de Expo'nun kodladığı multipart ile iki fotoğraf → işleme → önizleme/onay → taslak → `OPEN` yayın doğrulandı; yalnız testin kendi özel yayın/hesap/fotoğraf fixture'ları temizlendi.
- Kullanıcı Expo'da tekrar deneyerek fotoğraf önizlemesi/yayın akışının açıldığını onayladı. E-posta adımı hâlâ kullanıcının isteğiyle bekliyor.

## Takip ve beğeni (21 Ekim 2026)

- Profil sayıları Gönderi / Takipçi / Takip'tir; Takipçi ve Takip `/follows?userId=&kind=followers|following` listesini açar. Arkadaş sayısı kendi profilinde "Arkadaşlar" düğmesindedir.
- Başkasının profilinde `FollowButton` `PUT/DELETE /users/:id/follow` çağırır; durum `GET /users/:id/relationship` yanıtındaki `isFollowing`/`followsYou` alanından okunur. Arkadaşlık düğmeleri takipten ayrıdır ve altında kalır. Takip FRIENDS paylaşımlarını açmaz.
- Keşfet kartındaki kalp `PUT/DELETE /polls/:id/like` çağırır; sayı ve durum sunucu makbuzundan güncellenir. Beğeni tercih oyundan ayrıdır.
- Profil ızgarasında kartta `likeCount` varsa kalp ve sayı görünür. Kendi `/me/polls` özetinde bu alan yoktur; orada soru metni kalır.
- Yeni takipçi bildirimi `user.follow.received` türüyle "seni takip etmeye başladı" metnini gösterir.

## Yüz bulanıklaştırma (22 Ekim 2026)

- Paylaş'ta bulanıklaştırma açıkken her fotoğrafın altında "Yüzleri işaretle" düğmesi vardır. `FaceRegionEditor` fotoğrafı oranını bozmadan gösterir; dokunulan yere kare ekler, seçili kare büyütülür/küçültülür/silinir. En fazla 10 bölge.
- Dokunma noktası fotoğrafın ekrandaki konumu ölçülerek hesaplanır (`measure` + `pageX/pageY`); web'de `locationX` gelmez.
- Bölgeler 0–1 oranlarıyla `complete.blurRegions` olarak gider; bölge varken `confirmNoFaces` gönderilmez. İşaretlenmemiş fotoğraf için kullanıcı "İşaretlemediğim fotoğraflarda yüz yok" onayını açıkça verir. Fotoğraf değişince bölgeler sıfırlanır.
- Bulanıklaştırmayı sunucu yapar; sonuç mevcut onay ekranında görünür. `npm run test:media-upload` gönderim kuralını denetler.

## Üzerimde dene — Plus konsepti, DEMO (22 Ekim 2026)

- Keşfet kartındaki her etiketli parçanın yanında "Dene · PLUS" düğmesi `/try-on` ekranını açar (ürün adı, marka, fiyat, bağlantı parametreyle gelir).
- Ekran yalnız konsepttir: ödeme veya Plus hakkı denetimi yoktur, fotoğraf sunucuya gönderilmez, yapay zekâ görsel üretmez. Sonuç seçilen fotoğrafın kendisidir ve üzerinde "KONSEPT ÖNİZLEME" yazar.
- Gerçek akış için gerekenler: Plus abonelik/hak denetimi, bir sanal deneme (virtual try-on) servisi ve ürün görseli. Katalogdaki ürünlerin henüz görseli yoktur.

### Hazır mock sonuçlu demo (Zara polo ve jean)

- Demo ürünleri `features/try-on/data/demo-results.ts` içinde mağaza ürün kimliğiyle eşleşir: Zara çizgili polo (`p00526325`) ve Zara çan paça jean (`p00840333`). Trendler ve ürün detayı ürün görselini gösterir; ürün detayında "Üzerimde dene · PLUS" vardır.
- "Üzerimde dene"de "Profilimdeki kombinlerden seç" kullanıcının yayındaki kombinlerini listeler. Demo ürünü "Bugünkü kombinim nasıl?" kombininin A fotoğrafında denenirse önceden hazırlanmış görsel "MOCK SONUÇ" etiketiyle görünür; diğer seçimlerde konsept önizleme kalır.
- Ürün ve mock sonuç görselleri uygulamaya gömülüdür (`assets/images/try-on/`); ek ortam değişkeni gerekmez. Kullanıcının kombin fotoğrafları `backend/demo/try-on/outfit-a.jpg` ve `outfit-b.jpg` dosyalarıdır. Bu görseller gerçek kişi fotoğraflarıdır ve kullanıcının isteğiyle herkese açık repoya eklenmiştir.
- Kurulum: backend çalışırken `backend` klasöründe `npm run preview:mobile`, sonra `npm run demo:try-on`. Script Zara mağazasını ve iki ürünü (fiyat boş), kullanıcının iki fotoğraflı kombin oylamasını ve ürünleri trende sokacak oyları kurar; tekrar çalıştırılabilir. Eski tek fotoğraflı demo oylaması varsa iptal edilip yenisi açılır.
