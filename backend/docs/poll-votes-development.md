# Tercih oyu, kapanış ve sonuç — çalışan API

10 Ekim 2026. Yol haritasının 9. adımı; `/v1` altında Bearer oturumu gerekir. [Oluşturma/yayın rehberi](polls-development.md), [HTTP örnekleri](../examples/poll-votes.http). Günlük podyum/QR oyunu farklı değerlendirme ve katılım kurallarına sahiptir; [aktif oyun tasarımı](game-design.md).

## Uygulanan geliştirme varsayımları

Normal oy kişinin tercihidir, profil puanı veya yıldız üretmez. Kendi paylaşımına oy kapalıdır. Kullanıcı/oylama başına tek tercih vardır; ilk oy değiştirilemez. Sonuçları yazar görebilir; diğer kullanıcılar oy verdikten sonra veya oylama kapanınca görebilir. Bu, ürün kuralları belgesindeki başlangıç önerisinin uygulanmış halidir; gerekirse ayrı değişiklikle revize edilir.

| Metot | Yol | Sözleşme |
| --- | --- | --- |
| PUT | `/polls/:id/vote` | `{ "optionId": "uuid" }`; 200 `{ pollId, optionId, acceptedAt }` |
| GET | `/polls/:id/results` | Yetkili toplu sonuç; başka kişilerin tercih kimliklerini/demografisini dönmez |
| GET | `/polls/:id` | Mevcut alanlara myOptionId, canVote, canViewResults eklendi |

Oy endpoint'i Idempotency-Key/expectedVersion istemez. Doğal anahtar `(pollId, voterId)` ve aynı oylama satırının kilidi tekilleştirir. Aynı seçeneğin tekrarı ilk acceptedAt ile aynı makbuzu döndürür; farklı seçenek `409 VOTE_ALREADY_CAST`. Önceden kabul edilmiş oy, süre dolduktan sonra da yeni oy yazmadan tekrar dönebilir. Erişim her tekrarda yeniden denetlenir; engel/arkadaşlıktan çıkarma/moderasyon veya iptal önceki makbuzu başkasına açmaz.

Her komutta oylama satırı FOR UPDATE, sonra oy veren User satırı kilitlenir. Aktif hesap, görünürlük, başka oylamanın seçeneği ve desteklenmeyen hedefleme kontrol edilir. Yeni oy için bütün beklemelerden sonra DB clock_timestamp okunur: status=OPEN ve now < closesAt zorunludur. createdAt kabul anıdır; mobil saat kullanılmaz. Süre dolduğu anda tarayıcı gecikmiş olsa bile yeni oy reddedilir.

Tercih, Poll.version artışı ve poll.vote.cast outbox olayı aynı transaction'dadır. Başarılı tekrar sürüm/olay/puan artırmaz. Yorum ayarı/yayın komutlarında beklenen sürüm, arada oy geldiyse güncel GET'ten alınmalıdır. Başarısız outbox yazımı oyu/sürümü geri alır.

## Sonuç sözleşmesi

Yanıt: pollId, status (süreye göre efektif), storedStatus (DB), isFinal, version, serverNow, closesAt, totalVotes, myOptionId, winningOptionIds ve options `{ id, position, label, votes, percentage }`.

Sonuç RepeatableRead transaction'ında PollVote GROUP BY ile hesaplanır; ayrı geçici sayaç yoktur. Açık oylamada isFinal=false ve winningOptionIds anlık liderleri anlatır. Süre dolmuş OPEN, işçi beklenmeden status=CLOSED/isFinal=true görünür; storedStatus tarayıcıya kadar OPEN kalabilir. Sıfır oyda bütün yüzdeler 0 ve kazanan dizisi boştur. Beraberlikte ham oyu eşit bütün liderler döner. Yüzdeler en büyük kalan yöntemiyle tam sayıya yuvarlanır ve oy varsa toplam 100 olur; eşit kalanların gösterim sırası position'dır, kazanan ham oyla belirlenir.

Taslak/iptal/gizlenmiş/kaldırılmış yayın sonuç endpoint'inden 404 verir; sahibi temel detaydan durumunu görebilir. FRIENDS sonuçları arkadaş olmayan kişiye kapanıştan sonra da açılmaz. Eski arkadaşın kabul edilmiş oyu toplamda kalır; yeniden erişim hakkı sağlamaz. Sonuç kapanışı oy sayısını sabitler; sonradan moderasyon/hesap silme/analiz politikası ayrı işlemdir. canVote/canViewResults UI ipucudur, API denetiminin yerine geçmez.

## Kalıcı kapanış tarayıcısı

API geliştirme ortamında açılışta ve varsayılan 15 saniyede bir en fazla 100 süresi dolmuş OPEN oylamayı tarar. `POLL_CLOSE_WORKER_ENABLED=false` kapatır; `POLL_CLOSE_INTERVAL_MS` 1000–300000 aralığında ayarlanabilir. NODE_ENV=test otomatik taramayı daima kapatır; testler hedefli servis çağrısıyla kendi fixture'larını kapatır. Medya cleanup/DB CLI ve bootstrap smoke oyun/oylama zamanlayıcısını yanlışlıkla başlatmaz.

Tarayıcı kısa transaction'da `FOR UPDATE SKIP LOCKED` ile adayları alır; CLOSED, closedAt=önceden kayıtlı closesAt, sürüm artışı ve poll.closed olayı birlikte yazılır. Aynı satır oy komutuyla da kilitlenir. Tekrar tarama yeni olay üretmez; hata rollback olur ve sonraki taramada yeniden denenir. Aynı süreçte taramalar üst üste binmez; kapatılırken devam eden iş bitirilir. Yeniden açılış DB'deki kaçırılmış kapanışları tarar. Kuyruk/Redis bu adım için gerekmez; bildirim göndericisi henüz yoktur.

`npm run polls:close` elle en fazla 100 kaydı kapatır; backlog varsa yeniden çalıştır. `npm run polls:close -- <poll-uuid>` hedefli bakım için yalnız o kaydı denetler. İç servis closeExpiredBatch(limit, onlyPollId?) sunar; normal kullanıcıya keyfî kapatma HTTP ucu açılmaz. Yerel DB hedef koruması uygulama açılışında uygulanır. Genel worker gizli/inaktif yazarlı OPEN kayıtların da süre durumunu kapatabilir; bu onlara okuma erişimi veya bildirim hakkı vermez.

## Ürün/trend ve analiz izni sınırı

İç olay poll.vote.cast, aggregateType=poll, aggregateVersion=oy sonrası sürüm taşır. Ortak poll kimlik/durum payload'una voterId, optionId, votedAt, category ve measurement=OPTION_PREFERENCE eklenir. Bu **seçenek tercihidir**; kombindeki üç ürün üç bağımsız ürün oyu veya satış değildir. Olay ham demografi/link/fiyat içermez ve mobil/push'a doğrudan yayınlanmaz. Trend tüketicisi eventId veya `(pollId,voterId)` ile tekilleştirmeli, sabit PollOption/ProductTag ilişkisini okumalı ve aynı ürünü aynı seçenekte iki kez saymamalıdır. Ortak productId henüz yok; manual etiketten doğrulanmış trend ürünü uydurulmaz.

Oy anında User satırı, profil izin değişikliğiyle aynı kilidi kullanır. Aktif analyticsConsentAt varsa UserPrivate.gender/ageBand oya snapshot olarak, izin tarihi/revision ise analyticsConsentAtVote/analyticsRevisionAtVote alanlarına kaydedilir. İzin yoksa hepsi null'dır. Daha sonra profil değişince geçmiş snapshot yeniden sınıflandırılmaz. Geri alma aynı User transaction'ında kişinin bütün oy snapshot'larını temizler; oy ve zamanı korunur. UsersModule bu işlem için PollsModule'ün sunduğu clearAnalyticsSnapshots servisini kullanır, PollVote tablosuna kendisi yazmaz. İzin tekrar verilince eski oylar geriye dönük doldurulmaz.

Onuncu migration yalnız iki nullable izin alanı ve izin tarihi/revision çiftinin tutarlılık CHECK'ini ekler; eski oylara izin uydurmaz. Diğer bilgisayarda `npm ci`, `npm run db:deploy`, `npm run db:generate`; reset yok. İzin geri alma olayı user.analytics-preferences.changed olarak kalır. Arkadaşın trend servisi daha önce üretilmiş toplu katkıları da geri almalıdır; bu tüketici henüz yoktur. FRIENDS oyları genel trend/mağaza raporuna sessizce katılmaz. Örneklem/demografik filtre API'si ve trend formülü bu adımla açılmadı.

## Doğrulama ve kalanlar

`npm run test:votes`: 15 HTTP/servis testi; tek tercih/tekrar/çatışma/kendine oy, sonuç izni, sıfır oy/yuvarlama/eşitlik, geç oy/kapanış, sosyal erişim, moderasyon, izin snapshot/geri alma, iç olay kaynağı, eşzamanlı HTTP, hata enjeksiyonu rollback, tarayıcı tekrar/hata toparlanması ve OpenAPI. Fotoğraf/yayın gerçek akışı önceki polls/media testlerindedir; bu testler oy davranışına odaklı DB fixture'ları kullanır. `npm run test:api` bütün modülleri birlikte çalıştırır.

Yerel PGlite tek bağlantılıdır; HTTP tekrarları test edilir fakat gerçek çok bağlantılı PostgreSQL'de kilitte beklerken son sürenin geçmesi, iki işçi SKIP LOCKED ve vote/close yarışları ayrıca doğrulanmalıdır. Dağıtık rate limit, bildirim tüketicisi, trend hesapları ve gerçek sağlayıcı entegrasyonları tamamlanmış sayılmaz.

Sıradaki sıra: **10 ana akış → 19 günlük podyum/QR lobileri → 20 oyun zamanlama/canlı durum**. Katalog/trend/gelir tarafı arkadaşta paralel ilerler.
