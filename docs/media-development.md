# Fotoğraf ve avatar — çalışan yerel API

10 Ekim 2026. Yerel özel dosya deposu ve gerçek JPEG/PNG/WebP işleme çalışır. Bütün uçlar Bearer oturumu ister. Örnekler: [media.http](../examples/media.http). Otomatik yüz tespiti, bulut deposu ve ayrı kuyruk işçisi henüz yoktur.

## İstemci akışı

1. `POST /v1/media/uploads`: `purpose: POLL | AVATAR`, `mimeType`, gerçek dosyanın `byteSize` değeri ve isteğe bağlı `blurRequested`. Gönderilmeyen blur tercihi `defaultBlurFace` ayarından gelir; varsayılan true.
2. Yanıttaki `upload.path` adresine `multipart/form-data` ile tek `file` gönder. Bearer yanında `X-Upload-Token: upload.token` gerekir. `path` zaten `/v1` içerir; API origin'ine eklenir.
3. `POST /v1/media/:id/complete`: yerel kaynak checksum'u, gerçek içerik türü ve decode/piksel sınırları doğrulanır. EXIF yönü uygulanır; EXIF/GPS/ICC taşımayan display ve thumbnail WebP dosyaları üretilir.
4. `GET /v1/media/:id` ile durum; `displayPath` ve `thumbnailPath` ile önizleme okunur. Bu adreslere de Bearer gönderilir.
5. Kullanıcı görüntüyü kontrol ettikten sonra `POST /v1/media/:id/accept-preview` ve `{ "confirmed": true }` gönderilir. Bu, sadece ekrandaki onay eyleminde çağrılır.
6. Avatar için `PUT /v1/me/avatar` ve `{ "mediaId": "..." }`; kombin için ilgili taslak/yayın modülü aynı transaction'da `requirePublishableAsset` çağıracak. Oylama API'si sonraki adımdır.

`POST /media/uploads` 201, diğer başarılı komutlar 200 döner. Dosya durum yanıtı depolama anahtarlarını, kaynak checksum'unu veya token hash'ini içermez. Yükleme token'ı yalnız izin oluşturma yanıtında görünür; DB'de SHA-256 hash'i saklanır.

## Sınırlar ve değişmezlik

- Kaynak en fazla 10 MiB; JPEG, PNG veya WebP; en fazla 25 milyon piksel, her kenar en fazla 10.000 piksel. Animasyon/çok kareli dosya, SVG, GIF ve HEIC desteklenmez. HEIC için istemci dönüştürmesi veya sonraki bir decoder entegrasyonu gerekir.
- Display uzun kenarı POLL için en fazla 1600, AVATAR için 800; thumbnail en fazla 320. Küçük görsel büyütülmez. Kaynak `mimeType/byteSize`, çıktı ise her zaman `image/webp` şeklindedir; width/height çıktı boyutudur.
- Yükleme izni 15 dakika ve tek başarılı yükleme içindir. Sahiplik/token/süre kontrolü multipart belleğe alınmadan yapılır; transaction içinde tekrar kontrol edilir. Formda tek dosya bulunur; ek dosya veya metin alanı reddedilir. İstemcinin dosya adı depolama yolunu belirlemez.
- ByteSize/MIME beyan uyuşmazlığında dosya yazılmaz; geçerli izinle tekrar yüklenebilir. Yükleme başarılıysa kaynak sabit sürüm/checksum ile kilitlenir; aynı upload adresinden değiştirilemez.
- Hesap başına kayan 24 saatte 100 izin, aynı anda en fazla 20 geçerli bekleyen/işlenen izin. Silinmiş kayıtlar günlük kotadan düşmez. Tek süreçte en fazla iki upload/complete isteği işlenir; kapasite doluysa `429 MEDIA_BUSY` ve istemci geri çekilerek tekrar dener. Bunlar yerel geliştirme sınırlarıdır, üretim kapasite ölçümü değildir.

## Bulanıklaştırma ve onay

Bu sürüm **otomatik yüz bulmaz**. İstemci, yönü düzeltilmiş fotoğrafta bulanıklaştırılacak bölgeleri kullanıcıya seçtirir. `complete.blurRegions` en fazla 10 adet `{ x, y, width, height }` içerir; değerler 0–1 aralığında, bölge tamamen fotoğraf içinde olmalıdır. Thumbnail aynı maskelenmiş görüntüden üretilir; üst üste gelen maskeler ilk maskeyi açmaz.

Blur açıksa bölge seçilmeden veya kullanıcı açıkça `{ "confirmNoFaces": true }` demeden işleme başlamaz. Bu doğrulama otomatik tahmin edilmez veya istemci tarafından koşulsuz gönderilmez. Bölge ile `confirmNoFaces` birlikte kullanılamaz. Blur kapalıyken bölge gönderilemez. Kullanıcı bütün yüzleri seçmeli ve son görüntüyü incelemelidir; blur işlemi anonimlik garantisi değildir.

Onaylanan veya READY olmuş fotoğrafın işleme tercihleri değişmez. Başka maske/fotoğraf için yeni upload oluşturulur. Otomatik yüz tespit sağlayıcısı, model değerlendirmesi ve mobil bölge seçme/önizleme ekranı dış kullanıcı tesliminden önce ayrıca tamamlanacak.

## Durum ve hata davranışı

`PENDING_UPLOAD → PROCESSING → READY | REJECTED`; silme sonrası `DELETED`.

Başarılı dosya yüklemesi sırasında durum PENDING_UPLOAD kalır ve `uploaded=true` olur. Complete yerelde HTTP isteği içinde çalışır; ayrı worker yoktur. İşleme başlaması atomik ve sürümlüdür. İşlenirken GET durumunda PROCESSING görülür. Aynı complete parametrelerinin tekrarı READY sonucunu veya PROCESSING durumunu döndürür; farklı parametre `409 MEDIA_IMMUTABLE` olur. İzin oluşturma için genel Idempotency-Key henüz yoktur; yanıt kaybolursa oluşan boş kayıt temizlikle kaldırılır.

Bozuk/yanlış tür/piksel sınırı aşımı `422 INVALID_IMAGE`; checksum değişimi `422 SOURCE_CHECKSUM_MISMATCH`; disk/işleme bağımlılığı hatası `503 MEDIA_PROCESSING_FAILED`. Başarısız iş REJECTED ve kararlı `rejectionCode` bırakır. Orijinale geri dönülmez, kısmi çıktı açılmaz. Geçici hata aynı kaynakla complete tekrarına uygundur; bozuk kaynak için yeni yükleme gerekir. Silinmiş/eski sürümün geç tamamlanması kaydı yeniden READY yapamaz.

`accept-preview` aynı onayı/tarihi tekrar döndürür. Önizleme onayından önce bağlama `409 MEDIA_NOT_APPROVED`, amaç uyumsuzluğu `409 MEDIA_PURPOSE_MISMATCH`, kullanımda medya silme `409 MEDIA_IN_USE` olur.

## Erişim ve avatar

`.local/media` veya `LOCAL_MEDIA_DIR` sadece sunucu içindir; static servis edilmez. Orijinal HTTP'den açılmaz. `/media/:id` metadata yalnız sahibine açıktır. Başkasına ait/görünmeyen kaynak `404 RESOURCE_NOT_FOUND` olur.

Sahibi READY görüntüyü onay öncesinde görebilir. Başkası yalnız onaylanmış ve güncel profile bağlı avatarı veya erişebildiği VISIBLE + OPEN/CLOSED oylamaya bağlı görseli görebilir. SocialAccessService güncel engel, aktif hesap ve PUBLIC/FRIENDS kuralını her içerik isteğinde denetler. Avatar arkadaşlara özel değildir; kamusal profil erişimiyle açılır. Eski avatar yenisiyle değişince başkasına kapanır. Oyun görselleri için erişim henüz açılmadı.

Yanıt `Cache-Control: no-store`, `Content-Type: image/webp`, `X-Content-Type-Options: nosniff` taşır. Önceden indirilmiş dosya cihazdan geri alınamaz. `DELETE /me/avatar` sadece profil bağlantısını kaldırır; fotoğrafı silmek için ayrıca `DELETE /media/:id` kullanılır. Bağlı medya önce ilgili içerikten ayrılmalıdır. Gizli/kaldırılmış içeriklerin dosya retention politikası moderasyon/hesap silme aşamasında ayrıca ele alınacak.

GET `/me` ve `/users/:id` artık nullable `avatarMediaId` ve `avatarPath` içerir. Profil PATCH'i bu alanları kabul etmez; avatar uçları kullanılır.

## Temizlik ve başka modüllerle sözleşme

`npm run media:cleanup`: hedef DB koruması altında süresi dolmuş yüklenmemiş izinleri ve 24 saati geçmiş kullanılmayan medyayı DELETED yapıp dosyaları kaldırır. Avatar/PollOption/GameEntry bağlantısı olan kayıt korunur. İşleme 60 dakikadan uzun takılırsa REJECTED/PROCESSING_TIMEOUT olur ve yeniden denenebilir. Tombstone önce yazıldığı için disk silme hatasında erişim kapalı kalır; sonraki çalıştırma tamamlar. Tam silinen kayıt `filesPurgedAt` ile işaretlenir; tekrar tekrar temizlik adaylarını doldurmaz. DB satırları günlük kota ve ilişkiler için korunur. DB'siz veya DELETED eski asset dizinleri de kaldırılır.

Komut henüz cron/worker'a bağlı değildir; yerelde ihtiyaç halinde çalıştırılır. Canlıya geçmeden zamanlama, retention, özel bulut deposu, kuyruk/izleme ve çok instance kaynak sınırları gerekir.

Oylama modülü MediaModule import edip **aynı transaction içinde** `requirePublishableAsset(tx, actorId, mediaId, "POLL")` çağırmalı ve sonra PollOption ilişkisini yazmalıdır. Bu servis medya satırını kilitler; cleanup/silme ile aynı kilidi kullanır. Birden fazla medya için UUID sırasıyla çağrılır. Ham Prisma ilişki yazımı tek başına sahiplik veya onay kontrolü sağlamaz. Arkadaşın catalog/trends/billing/ads modüllerine yeni bağımlılık eklenmedi.

Sekizinci migration MediaPurpose, yükleme/hash/işleme/thumbnail/temizlik alanları ve User.avatarMediaId FK'sini ekler. Model sayısı 32 kalır. Diğer bilgisayarda `npm ci`, `npm run db:deploy`, `npm run db:generate` çalıştırılır; DB resetlenmez.

## Kontrol

`npm run test:media`: gerçek HTTP upload, tür/piksel/animasyon reddi, EXIF yönü/temizliği, JPEG/WebP decode, manuel maskelerin display/thumbnail'a uygulanması, önizleme onayı, avatar, özel yayın erişimi, hatadan tekrar, kapasite, geç işlem/silme ve dosya temizliği. `npm run test:api` auth/users/social/media testlerini birlikte çalıştırır. Tek bağlantılı yerel PGlite ortamı çok bağlantılı PostgreSQL yarış testi yerine geçmez; HTTP'de birden çok in-flight iş ve geç tamamlanma ayrıca kontrol edilir.

Uygulama kaynakları: [Nest dosya yükleme](https://docs.nestjs.com/techniques/file-upload), [Sharp giriş sınırları](https://sharp.pixelplumbing.com/api-constructor/), [Sharp metadata/çıktı davranışı](https://sharp.pixelplumbing.com/api-output/).
