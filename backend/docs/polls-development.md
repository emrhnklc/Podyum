# Kombin oylaması — taslak ve yayın API'si

10 Ekim 2026. Yol haritasının 8. adımındaki yerel akış çalışır. Bütün yollar `/v1` altında ve Bearer oturumuyla korunur. [HTTP örnekleri](../examples/polls.http), Swagger `/v1/docs`, kaynak `src/modules/polls`.

Tercih/sonuç ve kapanış tarayıcısı artık çalışır; [oy/sonuç rehberi](poll-votes-development.md). Keşif akışı, yorum/kaydetme henüz yok. Günlük oyun/QR lobisi aktif plandadır; [oyun tasarımı](game-design.md). Katalog servisi bu çalışma kopyasında henüz yok; ürünler kullanıcı beyanı olarak saklanır, ortak ürün eşleşmesi tamamlanmış sayılmaz.

## Endpoint'ler

| Metot | Yol | Davranış |
| --- | --- | --- |
| POST | `/polls` | 201; eksik bilgiyle de DRAFT oluştur |
| PATCH | `/polls/:id` | 200; kendi taslağını düzenle |
| POST | `/polls/:id/publish` | 200; kendi taslağını atomik yayınla |
| POST | `/polls/:id/cancel` | 200; kendi taslağını/açık yayınını iptal et |
| DELETE | `/polls/:id?expectedVersion=0` | 200; kendi taslağını ve seçenek/etiket bağlarını sil |
| PATCH | `/polls/:id/comment-settings` | 200; yayın sonrası yorum iznini değiştir |
| GET | `/polls/:id` | Kendi taslağın/iptalin veya erişebildiğin yayın |
| GET | `/me/polls?status=DRAFT&limit=20` | Kendi paylaşımlarını sayfala; status isteğe bağlı |

Yazma uçlarının tamamında `Idempotency-Key` zorunludur. Oluşturma dışında `expectedVersion` zorunludur; DELETE için query'de, diğerlerinde JSON body'dedir. İstek aktörü CurrentUser'dan alınır; authorId, status, version veya sahte ürün kimliği kabul edilmez.

## Uygulanan geliştirme varsayımları

- Taslak 0–4 seçenekle ve boş soruyla kaydedilebilir. Soru en fazla 280 karakter; kategori varsayılan OUTFIT. Occasion serbest 1–60 karakter veya null; sabit etkinlik sözlüğü henüz yok.
- Süre yalnız 1800, 7200 veya 86400 saniyedir (30 dakika, 2 saat, 24 saat); varsayılan 1800. Oluştururken süre başlamaz. Görünürlük ve yorum izni gönderilmezse kullanıcının mevcut UserSettings varsayılanı alınır. Sonraki ayar değişikliği eski paylaşımı değiştirmez.
- Position 1–4, fotoğraflar birbirinden farklıdır. Taslakta eksik sıra geçerlidir; yayın için 1'den başlayan kesintisiz 2–4 seçenek gerekir. A/B/C/D etiketini sunucu üretir.
- Taslağa kendi POLL amaçlı, silinmemiş medyan bağlanabilir; yükleme/işleme/onay tamamlanmış olmak zorunda değildir. Yayın için her medya READY, önizlemesi kabul edilmiş ve display/thumbnail çıktıları mevcut olmalıdır. Otomatik yüz tespiti henüz yoktur; [medya rehberi](media-development.md).
- `PATCH` içinde options gönderilmezse mevcut seçenekler korunur. Gönderilirse **bütün seçenek ve ürün listesi değiştirilir**; yeni option/tag kimlikleri üretilir. `options: []` taslağı boşaltır. Yayından sonra bu kimlikler ve içerik sabittir.
- Yayın anı PostgreSQL `clock_timestamp()` ile alınır; closesAt = publishedAt + durationSeconds. Yayın sonrası soru, kategori, süre, görünürlük, seçenek ve ürünler değiştirilemez. Yorum izni ayrı endpoint'ten değişebilir; yorum yazma API'si henüz yoktur.
- Süresi dolmamış OPEN veya DRAFT iptal edilebilir. İptal sonrası başkalarının detay erişimi kapanır; fotoğraf başka erişilebilir içerikte de kullanılıyorsa o içerik kendi erişimini korur. Sahibinin geçmişi ve medya önizlemesi kalır. İptal oyları/ürünleri fiziksel silme değildir. Süresi dolan yayını iptal etme `409 POLL_EXPIRED` verir.
- Yalnız DRAFT fiziksel silinebilir. Seçenekler ve ProductTag'ler aynı transaction'da kaldırılır; dosya/MediaAsset silinmez. Artık bağlı olmayan dosya ayrıca medya API'si veya temizlik komutuyla kaldırılabilir.
- Geliştirme kaynak sınırı: aynı anda en fazla 50 taslak; son 24 saatte en fazla 100 başarılı oluşturma. Silinen taslakların oluşturma makbuzu süre boyunca sayılır. Bu sınırlar Plus kotası veya ücretli hak değildir.

Bu davranışlar yerelde ilerlemek için seçilmiştir. Tek değişmez tercih ve oy sonrası/kapanışta sonuç erişimi 9. adımda uygulandı; gelişmiş hedefleme ve ticari haklar 14. adımda ele alınır. audienceGender/audienceAgeBand/styleMatchRequired giriş alanı değildir; mevcut DB kaydında gelişmiş hedefleme varsa yayın da reddedilir. Ücretli haklar varsayımla açılmaz.

## Ürün etiketleri ve katalog sınırı

Bir seçenekte en fazla 10 ürün. Title ve özgün externalUrl zorunlu; brand ve priceMinor null olabilir; currency varsayılan TRY, üç harfli büyük harfe normalize edilen kullanıcı beyanıdır. En küçük para biriminde tamsayı kullanılır (TRY için kuruş); dönüşüm veya güncel fiyat garantisi yoktur.

Sunucu `http/https` protokolünü, URL biçimini ve uzunluğu doğrular; linki açmaz/taramaz. Query ve affiliate parametreleri korunur. Başında/sonunda boşluk kırpılır, URL içinde boşluk, kontrol karakteri ve kullanıcı/parola reddedilir. Bağlantının gerçek ürün olduğunu doğrulama ve yönlendirme/affiliate tespiti katalog entegrasyonunda yapılacaktır.

ProductTag.priceRecordedAt, fiyat varsa sunucunun beyanı kaydettiği zamandır. Eski etikete sahte tarih atanmaz; eski kayıtlar null kalır. Seçenek listesi değiştirildiğinde yeniden gönderilen fiyat yeni beyan sayılır. Yanıtta source=USER_ENTERED bulunur. productId istemciden kabul edilmez; bu aşamada katalog kaydı oluşturulmaz/düzeltilmez.

Dokuzuncu migration yalnız nullable priceRecordedAt ekler. Diğer bilgisayarda `npm ci`, `npm run db:deploy`, `npm run db:generate` çalıştırılır; reset gerekmez. Arkadaşın ortak ürün/store/eşleşme şeması ayrıca koordine edilecek. Billing servisi henüz yok; ticari affiliate kullanımı doğrulanmış/ücretlendirilmiş sayılmaz.

## Sürüm, tekrar ve atomiklik

Yeni taslak version=0. Kabul edilen düzenleme/yayın/iptal/yorum ayarı değişikliği sürümü artırır; güncel sürümle etkisiz yorum ayarı veya zaten iptal edilmiş içeriğe iptal yeni olay üretmez. Eski expectedVersion `409 VERSION_CONFLICT` verir. Güncel GET yanıtını alıp kullanıcı değişikliğini değerlendirerek yeni anahtarla tekrar gönder.

Anahtar 8–100 karakterdir (`A–Z`, `a–z`, `0–9`, `_ . : -`; ilk karakter harf/rakam). Her **yeni** işlem için yeni UUID üret; ağ hatasındaki aynı işlemin tekrarında anahtarı ve normalize edilmiş gövdeyi koru. Aynı anahtarın farklı gövdesi `409 IDEMPOTENCY_KEY_REUSED` verir.

`common/idempotency` kapsamı kullanıcı + komut + kaynak + anahtardır. DTO'nun normalize edilmiş JSON alanları sıralanıp SHA-256 ile hash'lenir; array sırası anlamlıdır. Aynı anahtarlı işlemler transaction advisory lock üzerinden geçer. Başarılı yanıt JSON olarak 24 saat DB'de saklanır; süreç yeniden başlasa da ilk yanıt döner. Süre dolunca aynı anahtar yeni işlem olabilir. Eksik alan ile açıkça gönderilen varsayılan değer aynı payload sayılmaz.

Makbuz ilk işlem anının **sahibine ait snapshot'ıdır**; güncel durum değildir. Örneğin yayın makbuzu süre geçince de ilk OPEN yanıtını, taslak silindikten sonra eski oluşturma makbuzu eski taslağı döndürebilir; kaynak yeniden oluşturulmaz. Güncel ekran için GET kullanılır. Bearer/aktif hesap denetimi her HTTP tekrarında yapılır. Bu servis yalnız sahibin kendi komut yanıtlarında kullanılır; üçüncü kişinin kaynağına veya değişebilen sosyal yetkilere bağlı komutlarda ayrıca yeniden erişim doğrulaması gerekir.

Makbuz soru, elle girilmiş ürün bilgisi ve yetki denetimli medya yollarını içerir; dosya byte'ı, özel profil, upload token veya depolama anahtarı içermez. HTTP/log/olay üzerinden başkasına yayınlanmaz. Süresi dolan makbuz aynı anahtar tekrarında kaldırılır; toplu retention/temizlik işi henüz yoktur ve dış kullanıcı öncesi tamamlanacaktır.

Oylama satırı FOR UPDATE kilitlenir; çoklu medya UUID sırasıyla kilitlenir. İçerik değişikliği, başarılı makbuz ve outbox aynı transaction'dadır. Herhangi birinin hatası hepsini geri alır; başarısız işlem anahtarı tüketmez. Eşzamanlı farklı anahtarlı oluşturmalarda kota ayrı kullanıcı-kapsamlı advisory lock ile korunur. [PostgreSQL kilitleri](https://www.postgresql.org/docs/current/explicit-locking.html).

## Okuma, zaman ve görünürlük

PUBLIC ilk sürümde giriş yapmış aktif/engelsiz kullanıcılara açıktır. FRIENDS sadece yazar ve kabul edilmiş arkadaşları içindir. Taslak ve iptal başkasına açılmaz. Gizlenen/kaldırılan içerik veya inaktif/engelli yazar başkasına 404 verir. Detay ve fotoğraf aynı SocialAccessService kurallarını uygular; arkadaşlıktan çıkarma/engel sonraki okumaları kapatır.

Yanıtta status DB durumudur. Kapanış taramaları arasında süresi dolan OPEN, effectiveStatus=CLOSED ve remainingSeconds=0 döner. Mobil saat veya status tek başına süre kararı vermez; serverNow/closesAt/effectiveStatus kullanılır. OPEN/CLOSED liste filtreleri de gerçek kapanış saatini dikkate alır. Bu okuma kendisi yazma yapmaz; 9. adımın tarayıcısı CLOSED/sürüm/poll.closed olayını kalıcılaştırır. Detay myOptionId/canVote/canViewResults içerir; [oy sözleşmesi](poll-votes-development.md).

`GET /me/polls` status gönderilmezse bütün kendi durumlarını kapsar. Yanıt `{ items, serverNow, nextCursor }`; limit varsayılan 20/en fazla 50. Özet öğede kimlik/soru/kategori/görünürlük/durum/sürüm/zamanlar, optionCount ve ilk seçeneğin thumbnailPath alanları bulunur. Ayrıntılı ürünler detay endpoint'inden alınır. `(createdAt DESC, id DESC)` cursor kullanıcı ve status'a bağlıdır; yetki kanıtı değildir. Liste değişirken sayfalar arası sabit snapshot garantisi yoktur. Başkasının profil paylaşım listesi ve kaydedilenler henüz yoktur.

## Olaylar, hatalar ve doğrulama

Outbox: aggregateType=poll, aggregateId=pollId, aggregateVersion=version. Tipler poll.draft.created, poll.draft.updated, poll.published, poll.cancelled, poll.draft.deleted, poll.comment-settings.changed. Payload `{ schemaVersion: 1, pollId, authorId, version, status, visibility }`; soru/ürün/medya/ham demografi yoktur. Taslak silme olayının sürümü son sürüm +1'dir; kaynak silinmiş olabilir. Outbox göndericisi/bildirim henüz yok; publishedAt=null kalır. Tüketiciler olayları doğrudan mobil/push'a yayınlamaz, güncel erişimi tekrar denetler.

Başlıca hatalar: 400 VALIDATION_ERROR/EMPTY_UPDATE/UNSUPPORTED_AUDIENCE/işlem anahtarı hataları; 404 RESOURCE_NOT_FOUND; 409 VERSION_CONFLICT/POLL_NOT_DRAFT/POLL_UNAVAILABLE/POLL_EXPIRED/MEDIA_NOT_APPROVED/MEDIA_PURPOSE_MISMATCH/IDEMPOTENCY_KEY_REUSED; 422 QUESTION_REQUIRED/INVALID_OPTION_COUNT/INVALID_OPTION_ORDER; 429 POLL_QUOTA_EXCEEDED. MEDIA_NOT_APPROVED hem tamamlanmamış işleme hem eksik önizleme onayı için yayın kapısını kapatır.

`npm run test:polls` 19 HTTP testi çalıştırır. Gerçek upload/işleme/onay, taslak varsayılanları, eksik medya/yayın koşulları, manual ürünler, atomik seçenek değişimi, üç süre/dört seçenek, sürüm/tekrar/yeniden başlatma, sosyal görünürlük/fotoğraf erişimi, iptal/silme, cursor, kota, hata enjeksiyonuyla rollback ve OpenAPI kapsanır. Gerçek fotoğraf → özel yayın → arkadaş akışı → tercih → sonuç zinciri de kontrol edilir. `npm run test:api` önceki modüllerle birlikte çalıştırır. Yerel tek bağlantılı PGlite eşzamanlı HTTP kabulünü doğrular; gerçek çok bağlantılı PostgreSQL yarış testi yapılmış sayılmaz.

9. adım tercih/kapanış/sonuç ve [10. adım organik ana akış](feed-development.md) tamamlandı; sıradaki bizim işimiz aktif **19–20 günlük oyun/QR lobileri**. Katalog eşleştirmesi 7. adımda ayrıca tamamlanacak. Arkadaşın güncel işi mobil temadır.
