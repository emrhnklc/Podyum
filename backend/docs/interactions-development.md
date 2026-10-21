# Etkileşim API'si: beğeni, kaydetme, yorum, hazır neden, şikâyet

10 Ekim 2026. Yol haritası 11 ve 4. adımın kalan iki profil sekmesi çalışır: kaydet/kaldır, kaydedilenler, başkasının görünür paylaşımları, yorum ekleme/listeleme/kaldırma, oy sonrası hazır neden etiketi ve şikâyet kaydı. Yeni migration: `20261010210000_poll_interactions`. Yorum yanıtları (thread), yorum düzenleme, bildirim tüketicisi ve şikâyetin yönetim tarafı bu teslimde yoktur. `mobile/` değişmedi.

Tüm uçlar Bearer oturumu ister; kimlikler UUID'dir, bilinmeyen alanlar 400 `VALIDATION_ERROR` alır. Listeler `limit` (1–50, varsayılan 20) ve opaque `cursor` kullanır.

## Seçilen ürün kararları

| Konu | Karar |
| --- | --- |
| Hazır etiketler | Yorumdan ayrı. Oy verdikten sonra, kendi seçtiğin seçenek için tek neden; değiştirilebilir ve kaldırılabilir |
| Yorum düzenleme | Yok. Yalnız kaldırma; yanlış yorum silinip yeniden yazılır |
| Kim yorum kaldırır | Yorumu yazan ve paylaşımın sahibi |
| Kim yorum yazar | Yalnız oy verenler ve paylaşımın sahibi. Okumak için oy gerekmez |

## Uçlar

| Metot | Yol | Davranış |
| --- | --- | --- |
| PUT | `/polls/:id/save` | Görebildiğin yayını kaydet; tekrar aynı kaydı döndürür |
| DELETE | `/polls/:id/save` | Kaydı kaldır; kayıt yoksa da 200 |
| GET | `/me/saved-polls` | Hâlâ görebildiğin kayıtlar, son kaydedilen önce |
| GET | `/users/:id/polls` | O kullanıcının senin görebildiğin yayınları, son yayın önce |
| GET | `/polls/:id/comments` | Görünür yorumlar, yeniden eskiye |
| POST | `/polls/:id/comments` | Yorum ekle; `Idempotency-Key` zorunlu |
| DELETE | `/comments/:id` | Kendi yorumunu veya kendi paylaşımındaki yorumu kaldır |
| PUT | `/polls/:id/reason` | Oy verdiğin seçenek için nedenini seç/değiştir |
| DELETE | `/polls/:id/reason` | Nedenini kaldır |
| GET | `/polls/:id/reasons` | Seçenek başına neden sayıları |
| POST | `/reports` | Paylaşım, yorum veya kullanıcı şikâyeti |

Yalnız yorum oluşturma `Idempotency-Key` ister. Kaydetme, neden ve şikâyet doğal anahtarla (kullanıcı + hedef) tekildir; aynı isteğin tekrarı yeni kayıt açmaz.

## Kart alanları

Akış, kaydedilenler ve kullanıcı paylaşımları aynı kartı döndürür: [oylama detayı](polls-development.md) + `totalVotes`, `commentCount`, `isSaved`, `likeCount`, `isLiked`. Kaydedilenler kartında ayrıca `savedAt` vardır. `commentCount` yalnız görünür yorumları sayar; kaldırılmış yorumlar ile askıdaki/iki yönlü engelli yazarların yorumları sayılmaz. Seçenek sayıları ve kazanan bu kartta yoktur; [sonuç ucu](poll-votes-development.md) ayrı yetki denetler.

## Beğeni

21 Ekim 2026. `PUT /polls/:id/like` ve `DELETE /polls/:id/like`; yanıt `{ pollId, isLiked, likeCount }`.

- Beğeni tercih oyundan ayrıdır: oy sayısını, sonucu, trend katkısını veya `Poll.version` değerini değiştirmez. Kendi paylaşımını beğenmek serbesttir.
- Kaydetme gibi doğal anahtarla (kullanıcı + paylaşım) tekildir. Göremediğin yayın 404 alır; erişimi kapanan beğeni `DELETE` ile kaldırılabilir ve o durumda `likeCount` 0 döner.
- `likeCount` aktif ve izleyiciyle iki yönlü engelsiz kullanıcıların beğenilerini sayar. Kimin beğendiği listelenmez.
- Hesap silme kullanıcının beğenilerini temizler. Beğeni bildirim üretmez.

## Kaydetme

`PUT` yanıtı `{ pollId, isSaved: true, savedAt }`, `DELETE` yanıtı `{ pollId, isSaved: false, savedAt: null }`.

- Kaydetmek görüntüleme izni vermez. Göremediğin veya var olmayan yayın 404 alır.
- Kendi paylaşımını, oy verdiğin veya kapanmış paylaşımı kaydedebilirsin.
- Paylaşım sonradan gizlenir, kaldırılır, FRIENDS olup arkadaşlık biterse veya engel oluşursa kayıt silinmez ama listede görünmez; erişim geri gelirse yeniden görünür. Bu durumdaki kaydı `DELETE` ile kaldırabilirsin.
- Kaydetme sayısı başkasına gösterilmez; yazar kimin kaydettiğini göremez.

## Başkasının paylaşımları

`GET /users/:id/polls` profil sekmesidir. Yalnız yayınlanmış ve izleyicinin görebildiği paylaşımlar gelir: PUBLIC herkese, FRIENDS yalnız kabul edilmiş arkadaşa. Açık ve kapanmış paylaşımlar birlikte listelenir (`effectiveStatus` ile ayrılır); taslak, iptal, gizlenmiş içerik gelmez. Akıştan farklı olarak oy verdiğin paylaşımlar da listelenir ve `myOptionId` dolu gelir. Engel veya pasif hesapta 404 döner. Kendi kimliğinle çağırırsan yalnız yayınlarını görürsün; taslaklar `GET /me/polls` ucundadır.

## Yorumlar

Liste yanıtı:

```json
{
  "items": [{
    "id": "uuid", "pollId": "uuid", "body": "Renkler çok uyumlu", "createdAt": "2026-10-10T18:00:00.000Z",
    "author": { "id": "uuid", "username": "ada", "displayName": "Ada", "avatarPath": null },
    "isMine": false, "canRemove": true
  }],
  "commentsEnabled": true, "canComment": true, "serverNow": "2026-10-10T18:00:05.000Z", "nextCursor": null
}
```

- `canComment`: yorumlar açık **ve** izleyici oy vermiş ya da paylaşımın sahibi. Mobil yorum kutusunu buna göre açar; `false` iken oy vermemiş kullanıcıya "önce tercihini yap" gösterir.
- `canRemove`: yorum senin ya da paylaşım senin. Mobil sil seçeneğini buna göre gösterir.
- Gövde 1–1000 karakter, baştaki/sondaki boşluk kırpılır. Yalnız boşluk 400 alır.
- Oluşturma yanıtı 201 `{ id, pollId, createdAt }` makbuzudur; metin yanıtta ve işlem tekrarı kaydında saklanmaz. Mobil yazdığı metni kendi elindeki değerle listeye ekler veya listeyi yeniler.
- Aynı `Idempotency-Key` + aynı gövde ilk makbuzu döndürür; aynı anahtar farklı gövdeyle 409 `IDEMPOTENCY_KEY_REUSED`.
- Oylama kapandıktan sonra da yorum yazılabilir (yorumlar açıksa ve yazan oy vermişse/sahipse).
- Kaldırma yanıtı `{ id, removed: true }`; tekrar aynı yanıtı verir. Yorumu yazan ve paylaşım sahibi dışındakiler 404 alır. Kaldırılan yorum silinmez; `REMOVED` olur, kim/ne zaman kaldırdığı saklanır ve hiçbir listede görünmez.
- Yorum eklemek/kaldırmak `Poll.version` değerini ve oy sonucunu değiştirmez.

| Durum | Yanıt |
| --- | --- |
| Paylaşım görülemiyor (özel, engel, gizli, yok) | 404 `RESOURCE_NOT_FOUND` |
| Yorumlar kapalı | 409 `COMMENTS_DISABLED`; eski yorumlar okunmaya devam eder |
| Oy vermemiş ve sahibi değil | 403 `COMMENT_REQUIRES_VOTE` |
| Aynı paylaşıma 24 saatte 30'dan fazla yorum | 429 `COMMENT_RATE_LIMITED` |
| `Idempotency-Key` yok | 400 `IDEMPOTENCY_KEY_REQUIRED` |

Görünürlük her istekte yeniden değerlendirilir: iki yönlü engelli veya askıdaki yazarın yorumu izleyiciye gösterilmez ve sayaca girmez. Paylaşım sahibi oy vereni engellerse oy toplamda kalır, ama o kişi yorumları okuyamaz ve yazamaz. Yorumları kapatmak [yorum ayarı ucuyla](polls-development.md) yapılır.

## Hazır neden etiketi

Kodlar sabittir; metni mobil çevirir:

| Kod | Önerilen etiket |
| --- | --- |
| `COLOR_HARMONY` | Renk uyumu |
| `MORE_STYLISH` | Daha şık |
| `MORE_COMFORTABLE` | Daha rahat |
| `FITS_OCCASION` | Ortama uygun |
| `BETTER_FIT` | Daha iyi duruyor |

`PUT /polls/:id/reason` gövdesi `{ "reason": "COLOR_HARMONY" }`. Yanıt `{ pollId, optionId, reason, updatedAt }`; `optionId` kişinin oy verdiği seçenektir, istekte gönderilmez. Oy yoksa 409 `VOTE_REQUIRED`. Kişi başına paylaşımda tek kayıt vardır; ikinci `PUT` nedeni değiştirir. `DELETE` nedeni kaldırır ve `reason: null` döndürür; kayıt yoksa da 200.

`GET /polls/:id/reasons` her seçenek için beş kodun tamamını sayısıyla döndürür (sıfırlar dahil) ve `myReason` alanını verir. Kimin hangi nedeni seçtiği dönmez. Görünürlük sonuçla aynıdır: paylaşımın sahibi, oy veren veya oylama kapandıktan sonra erişebilen herkes; diğerleri 403 `RESULTS_NOT_AVAILABLE`. Neden seçmek oyu, sonucu veya sürümü değiştirmez ve puan üretmez.

## Şikâyet

```json
{ "targetType": "POLL", "targetId": "uuid", "reason": "INAPPROPRIATE", "note": "İsteğe bağlı kısa açıklama" }
```

`targetType`: `POLL`, `COMMENT`, `USER`. `reason`: `SPAM`, `HARASSMENT`, `INAPPROPRIATE`, `IMPERSONATION`, `OTHER`. `note` isteğe bağlı, 1–500 karakter. Yanıt 201 `{ id, targetType, targetId, reason, status: "OPEN", createdAt }`.

- Yalnız görebildiğin içerik şikâyet edilir; göremediğin veya olmayan hedef 404.
- Kendi paylaşımın, yorumun veya hesabın: 400 `SELF_REPORT_NOT_ALLOWED`.
- Aynı hedefi ikinci kez şikâyet etmek yeni kayıt açmaz; ilk kayıt (ilk neden ile) döner.
- Engellediğin kullanıcıyı şikâyet edebilirsin; seni engelleyen kullanıcı sana görünmediği için 404.
- 24 saatte en fazla 50 yeni şikâyet: 429 `REPORT_RATE_LIMITED`.
- Şikâyet içeriği kendiliğinden gizlemez veya hesabı kısıtlamaz. İnceleme, kaldırma ve yaptırım 16. adımdaki yönetim API'sindedir; `status` alanını yalnız o taraf değiştirir.

## Olaylar

Değişiklikle aynı transaction'da `OutboxEvent` yazılır. Yorum olayları paylaşım sahibine gruplu bildirim üretir: [bildirim rehberi](notifications-development.md).

| Olay | Aggregate | İçerik |
| --- | --- | --- |
| `poll.comment.created` | comment / sürüm 1 | commentId, pollId, pollAuthorId, authorId, createdAt |
| `poll.comment.removed` | comment / sürüm 2 | commentId, pollId, removedById, byPollOwner |
| `report.created` | report / sürüm 1 | reportId, targetType, reason, createdAt |

Olaylar yorum metnini veya şikâyet açıklamasını taşımaz. Kaydetme ve neden seçimi olay üretmez.

## Veri modeli

- `Comment`: `removedAt`, `removedById` eklendi; ikisi birlikte dolu ya da birlikte boştur (CHECK).
- `PollVoteReason`: `(pollId, voterId)` birincil anahtar ve aynı çiftle `PollVote` kaydına bağlı; oyu olmayan kişinin nedeni veritabanında da olamaz. Şemanın geri kalanı gibi silme `Restrict`'tir: oy kaydı silinecekse önce nedeni silinir (hesap silme 16. adımda bunu kapsar).
- `Report`: hedef türüne göre `pollId`, `commentId` veya `targetUserId` alanlarından tam biri dolu (CHECK); kişi kendini şikâyet edemez (CHECK); şikâyet eden + hedef tekildir.

Başka makinede: `npm run db:deploy` ve `npm run db:generate`.

## Doğrulama

`npm run test:interactions`: 16 gerçek HTTP/DB testi. Oturum/DTO/işlem anahtarı; kaydet/kaldır tekrarı ve erişim; kaydedilenlerde görünürlük ve cursor; yalnız oy veren/sahip yorum yazar; işlem tekrarı ve makbuzda metin olmaması; kapalı yorumlar; yazan/sahip kaldırma; engel, askı ve özel görünürlük; yorum sayfalama ve cursor bağlamı; günlük yorum sınırı; neden için oy şartı, tek kayıt, değiştirme/kaldırma; neden sayıları ve görünürlüğü; başkasının paylaşımları; şikâyet hedefleri, tekrar, kendi içeriği, engel; şikâyet sınırı ve DB kısıtları; OpenAPI. `npm run test:api` bu dosyayı da çalıştırır.

Yerel PGlite tek bağlantılıdır; eşzamanlı yorum/şikâyet yarışı çok bağlantılı PostgreSQL'de ayrıca denenmelidir.

Kod: [PollInteractionsService](../src/modules/polls/poll-interactions.service.ts), [kart sunumu](../src/modules/polls/poll-card.ts), [ReportsService](../src/modules/moderation/reports.service.ts). [HTTP örnekleri](../examples/interactions.http).

## Mobil ekranlarla eşleşme

| Ekran / düğme | Uç |
| --- | --- |
| Akış kartı: Kaydet / Kaydedildi | `PUT` / `DELETE /polls/:id/save`; ilk durum karttaki `isSaved` |
| Akış kartı: yorum sayısı ve yorum ekranı | karttaki `commentCount`; `GET` / `POST /polls/:id/comments` |
| Yorum satırı: sil | `DELETE /comments/:id`; `canRemove` true ise göster |
| Oy sonrası neden çipleri | `PUT` / `DELETE /polls/:id/reason`; dağılım `GET /polls/:id/reasons` |
| Profil: Kaydedilenler sekmesi | `GET /me/saved-polls` |
| Başkasının profili: paylaşımlar | `GET /users/:id/polls` |
| Paylaşım/yorum/profil menüsü: Şikâyet et | `POST /reports` |
