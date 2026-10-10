# API ve canlı bağlantı sözleşmesi — taslak

**Kapsam güncellemesi:** Oyun ve Socket.IO bölümleri Faz 2 taslağıdır. Trend, affiliate ve reklam API'leri ilgili Faz 1 adımında tasarlanacak; henüz çalışan endpoint değildir. [Mentör görüşmesi](mentor-notes-2026-10-10.md).

Health ve `/v1/auth/*` endpoint'leri çalışır. Controller/DTO'lardan üretilen güncel OpenAPI `/v1/openapi.json`, Swagger `/v1/docs` altındadır. Çalışan auth ayrıntıları ve örnekleri: [Auth geliştirme rehberi](auth-development.md). Aşağıdaki profil/sosyal/medya/oylama/oyun endpoint'leri henüz uygulanmamış taslaktır; OpenAPI'de tamamlanmış gibi yer almazlar. Mobil tip üretimi teslim adımında yapılacak.

## 1. Ortak kurallar

- Prefix: `/v1`. JSON alanları camelCase; enum değerleri şemayla aynı büyük harf biçiminde.
- Giriş: `Authorization: Bearer ...`; şu anda DB'deki hash'le doğrulanan opaque token, süre ve aktif hesap kontrolü. Kullanıcı kimliği body'den alınmaz. Her endpoint varsayılan korumalıdır; `@Public()` açıkça muaf tutar.
- E-posta/şifre + Google/Apple seçildi. E-posta/şifre ve yerel oturumlar çalışır; gerçek dış sağlayıcı token doğrulaması henüz yok, ayrı mock vardır. Gerçek OAuth eklenince imza/issuer/audience/süre kontrolü ve güvenli bağlama zorunlu olacaktır.
- Liste: `limit` varsayılan 20, en fazla 50; opaque cursor ve `nextCursor`. Cursor filtre/sıralama bağlamıyla doğrulanır.
- Zamanlar UTC ISO-8601. Canlı yanıtlar `serverNow`, `version`, `phaseEndsAt` içerir.
- Görülemeyen özel kaynaklar `404 RESOURCE_NOT_FOUND`; erişim hakkı olmayan kişiye varlığı açıklanmaz.
- Sunucu kodları kararlıdır; kullanıcıya gösterilen metin mobilde yerelleştirilebilir.
- Planlanan paylaşım/oyun POST komutlarında `Idempotency-Key` gerekecek; kalıcı servis henüz uygulanmadı. Auth endpoint'leri bu anahtarı istemez; kayıt doğal e-posta tekilliğini kullanır, refresh tek kullanımlıdır. PUT oy/değerlendirme/kaydet işlemlerinin kendi doğal tekil anahtarı olacaktır.
- Taslak güncelleme/yayınlama ve oda başlatma için `expectedVersion` alınır. Oy ve değerlendirme için istemcinin tüm aggregate sürümünü eşleştirmesi istenmez; ilgili poll/round ve mevcut sunucu aşaması yeterlidir.

```json
{
  "error": {
    "code": "POLL_EXPIRED",
    "message": "Oylama sona erdi.",
    "requestId": "sunucu-korelasyon-kimligi"
  }
}
```

| HTTP | Örnek kodlar |
| --- | --- |
| 400 | VALIDATION_ERROR, UNSUPPORTED_AUDIENCE |
| 401 | AUTH_REQUIRED, TOKEN_EXPIRED |
| 403 | ACCOUNT_SUSPENDED, VOTER_NOT_ELIGIBLE, SELF_VOTE_NOT_ALLOWED |
| 404 | RESOURCE_NOT_FOUND |
| 409 | VERSION_CONFLICT, POLL_EXPIRED, VOTE_ALREADY_CAST, ROUND_CLOSED, ROOM_FULL, ALREADY_IN_GAME, IDEMPOTENCY_KEY_REUSED |
| 422 | MEDIA_NOT_READY, TOO_FEW_OPTIONS, NOT_ENOUGH_PLAYERS |
| 429 | RATE_LIMITED |
| 503 | DEPENDENCY_UNAVAILABLE |

## 2. Profil ve sosyal

| Metot | Yol | Davranış |
| --- | --- | --- |
| POST | `/auth/oauth/:provider` | Planlanan gerçek sağlayıcı girişi; doğrulanmış dış kimlikten yerel profil/oturum; mevcut mock ile karıştırılmaz |
| GET | `/me` | Kendi profilin; izin verilen özel alanlar ayrı nesnede |
| PATCH | `/me` | Görünen ad, bio, stil etiketleri |
| GET | `/users/:id` | İzin verilen kamusal profil |
| GET | `/users/:id/polls` | Yalnızca izleyicinin görebildiği paylaşımlar |
| GET | `/me/friends` | Kabul edilmiş arkadaşlar |
| GET | `/me/friend-requests` | Gelen/giden istekler |
| POST | `/friend-requests` | `targetUserId`; yönsüz tek çift; karşı istek otomatik kabul sayılmaz |
| POST | `/friend-requests/:userId/accept` | Yalnızca isteğin alıcısı kabul eder |
| POST | `/friend-requests/:userId/decline` | Gelen isteği reddet |
| DELETE | `/friends/:userId` | Arkadaşlığı kaldır; özel içerik için yeni erişim durur |
| PUT / DELETE | `/blocks/:userId` | Engelle / engeli kaldır |
| GET | `/style-tags` | Stil sözlüğü |

Hesap silme, şikâyet ve yönetim endpoint'leri ilk dış kullanıcı testinden önce eklenecek; normal kullanıcıya admin endpoint'i açılmayacak.

## 3. Medya

| Metot | Yol | Davranış |
| --- | --- | --- |
| POST | `/media/uploads` | Dosya türü/boyutu ve blur tercihiyle yükleme izni |
| POST | `/media/:id/complete` | Yüklemeyi doğrula, sabit sürüm/checksum ile işleme al |
| GET | `/media/:id` | Sahibi için işleme/önizleme durumu |
| POST | `/media/:id/accept-preview` | Kullanıcı gösterilecek görüntüyü kabul eder |
| GET | `/media/:id/content` | Yetkili işlenmiş görsel; private cache/no-store politikası |

Upload izni dosyanın uygun olduğu veya paylaşımın tamamlandığı anlamına gelmez. Body'deki ownerId/storageKey kullanılmaz; sunucu üretir. Sahibi taslak önizlemesine erişebilir; başkaları sadece erişebildikleri yayınlanmış içeriğin işlenmiş görseline erişir. Oyun sırasında başka oyuncunun dosya kaydı/metadata endpoint'i açılmaz.

## 4. Oylama ve etkileşim

| Metot | Yol | Davranış |
| --- | --- | --- |
| POST | `/polls` | DRAFT oluştur; seçenekler ve ürün bilgileri |
| PATCH | `/polls/:id` | Yalnızca kendi taslağını sürümle güncelle |
| POST | `/polls/:id/publish` | 2–4 hazır seçenek + süre/erişim doğrulaması; atomik yayın |
| POST | `/polls/:id/cancel` | Kendi oylamasını iptal |
| PATCH | `/polls/:id/comment-settings` | Yayın sonrası yorum kabulünü yönet |
| GET | `/feed?scope=everyone\|friends&category=...` | Görünür ve oy verilebilir adaylar; uygunluk ayrıca döner |
| GET | `/polls/:id` | Detay, seçenekler, ürünler, kullanıcının mevcut tercihi |
| PUT | `/polls/:id/vote` | Tek tercih; aynı oy tekrarında aynı kabul |
| GET | `/polls/:id/results` | Yetkili toplu sonuç; anlık/kesin ayrımı |
| PUT / DELETE | `/polls/:id/save` | Kişisel kaydet/kaldır |
| GET | `/me/saved-polls` | Hâlâ görünür kayıtlar |
| GET / POST | `/polls/:id/comments` | Yetkili yorum listesi / yorum ekleme |
| DELETE | `/comments/:id` | Kendi yorumunu kaldırma |

Akışta açık PUBLIC oylamalar ile izleyicinin görebildiği FRIENDS oylamalar vardır; Friends sekmesi yazarın arkadaş olmasını da zorunlu kılar. Kapanmış oylamalar profil/kaydedilenler üzerinden görülebilir. `Geç` ilk sürümde oturum içi UI davranışıdır; kalıcı ilgi modeli gerektirmez.

```json
{
  "question": "Cuma akşamı ilk buluşma. Hangisi?",
  "category": "OUTFIT",
  "occasion": "FIRST_DATE",
  "visibility": "FRIENDS",
  "durationSeconds": 1800,
  "commentsEnabled": true,
  "options": [
    { "position": 1, "mediaId": "uuid-a", "products": [] },
    { "position": 2, "mediaId": "uuid-b", "products": [] }
  ]
}
```

`PUT /polls/:id/vote` body: `{ "optionId": "uuid-a" }`. Yanıt bir kabul makbuzudur; profil puanı içermez. İlk kabul `200`, aynı tercih tekrarında `200`, farklı tercih tekrarında `409 VOTE_ALREADY_CAST`. Kabul sonrası kapanan oylamaya aynı kabulün tekrarını istemek yeni oy sayılmaz; erişim kontrolü yine yapılır.

```json
{
  "pollId": "uuid-poll",
  "status": "OPEN",
  "isFinal": false,
  "totalVotes": 186,
  "myOptionId": "uuid-a",
  "winningOptionIds": ["uuid-a"],
  "options": [
    { "id": "uuid-a", "votes": 119, "percentage": 64 },
    { "id": "uuid-b", "votes": 67, "percentage": 36 }
  ]
}
```

Bu örnekte kazanan anlık liderdir; `isFinal=false` gösterilmelidir. Oy sayısı sıfırsa kazanan dizisi boştur. Demografik kırılımlar bu ilk sözleşmeye dahil değildir.

## 5. Canlı oyun komutları

| Metot | Yol | Davranış |
| --- | --- | --- |
| POST | `/game-rooms` | Arkadaş odası oluştur; host üyeliği + aktif hak atomik |
| POST | `/matchmaking/tickets` | Hızlı eşleşme talebi; tek aktif talep/oda |
| DELETE | `/matchmaking/tickets/:id` | Bekleyen talebi iptal |
| POST | `/game-rooms/:id/join` | Arkadaşlık/davet/kapasite kontrolüyle katıl |
| PUT | `/game-rooms/:id/readiness` | WAITING aşamasında hazır olma |
| POST | `/game-rooms/:id/start` | Host veya sunucu başlatır; tema ve kurallar dondurulur |
| PUT | `/game-rooms/:id/entry` | Süresinde tamamlanmış kendi fotoğraf teslimini bağla |
| PUT | `/game-rooms/:id/rounds/:roundId/rating` | `{stars: 4, themeFits: true}`; tek değerlendirme |
| GET | `/game-rooms/:id/state` | Çağıran kişiye özel güncel durum |
| GET | `/game-rooms/:id/results` | Yalnızca sonuç aşamasında açılan kimlikler ve sıralama |
| POST | `/game-rooms/:id/leave` | WAITING'de üyelikten çık; başladıysa ayrılma davranışını uygula |
| GET | `/me/games` | Kendi katılım geçmişi |

Matchmaking'in kalıcı ticket tablosu henüz şemada yok; gerçek eşleştirme implementasyonunda eklenecek. Redis aday kuyruğu tek başına katılım kaydı değildir. Eşleştirme oda kilidi ve kullanıcı aktif üyelik tekilliğiyle sonlandırılır; iptal/eşleştirme yarışında tek sonuç oluşur.

Örnek durum yanıtı:

```json
{
  "roomId": "uuid-room",
  "version": 12,
  "status": "VOTING",
  "serverNow": "2026-10-10T17:30:00.000Z",
  "phaseEndsAt": "2026-10-10T17:30:20.000Z",
  "theme": { "title": "90'lar" },
  "qualifiedCount": 8,
  "round": {
    "id": "uuid-round",
    "position": 3,
    "total": 8,
    "mediaPath": "/v1/media/uuid-media/content",
    "isMine": false,
    "canRate": true,
    "myRating": null,
    "receivedRatingCount": 6,
    "expectedRatingCount": 7
  }
}
```

Sunucu bu aşamada `targetUserId`, username, avatar, entry owner veya başkalarının yıldızlarını dönmez. Kendi turunda `isMine=true`, `canRate=false`. Sonuç yanıtında her katılımcının ham sayısı, toplamı, ortalaması, quorum durumu ve varsa eşit derecesi bulunur. `official=false` alpha sonuçlarının profil puanı üretmediğini belirtir.

## 6. Socket.IO

İlk sürümde kalıcı komutlar REST ile gider. Socket.IO yalnızca sunucu değişiklikleri ve yeniden okuma uyarıları içindir; aynı oyun davranışı iki ayrı komut hattında uygulanmaz.

İstemci bağlantı açar, token doğrulanır, `room.subscribe` isteğinde oda erişimi kontrol edilir. İstemci keyfî sunucu oda adı vererek başkasına abone olamaz. Token süresi dolunca yeniden doğrulama/bağlantı kapatma uygulanır; reconnect'te de yetki tekrar kontrol edilir.

```json
{
  "eventId": "uuid-event",
  "type": "room.changed",
  "resourceId": "uuid-room",
  "version": 13
}
```

| Olay | İçerik |
| --- | --- |
| `room.changed` | Kaynak ID ve sürüm; oyuncuya özel state yeniden okunur |
| `poll.changed` | Yetkili aboneye ID ve sürüm; oy detayları taşınmaz |
| `notification.created` | Kendi bildirim ID'si |
| `access.revoked` | Aboneliği bırak / yerel görünümü kapat uyarısı |

Gateway, outbox'ın iç payload'unu doğrudan istemciye yayınlamaz. Hassas içerik olay gövdesine girmez. Yinelenen/eski olaylar `version` ile atlanır. Olayların ulaşması garanti kabul edilmez: reconnect, uygulamanın ön plana gelmesi ve faz sonlarında güncel durum yeniden okunur; canlı ekranda periyodik hafif kontrol de yapılır.

Yeniden bağlanma sırası: abone ol → state oku. Okuma sürerken daha yüksek version olayı gelirse son yanıtın version'ıyla kıyasla ve yeniden oku. Bu, snapshot ile abonelik arasındaki değişikliği kaçırmayı önler. Cache'ten başkasının state'i döndürülmez.

## 7. Bildirim ve puan

| Metot | Yol | Davranış |
| --- | --- | --- |
| GET | `/me/notifications` | Kişisel bildirimler |
| PUT | `/me/notifications/:id/read` | Kendi bildirimini okundu yap |
| PUT / DELETE | `/me/devices/:installationId` | Push kaydı / çıkışta kaldırma; installationId alanı entegrasyonda eklenecek |
| GET | `/me/points` | Sunucudaki ledger toplamı; alpha'da ödül yazılmaz |

Lig, Plus, demografik sonuç, haftalık yarışma ve sponsor API'leri ilk sözleşmeden ayrı eklenecek. Profil toplamı mobil tarafından artırılamaz.

## 8. Idempotency ayrıntısı

Anahtar kapsamı `(userId, HTTP method + route template + resourceId, key)`; body normalize edilip hash'lenir. Aynı anahtar farklı body ile kullanılırsa `409`. Saklama önerisi 24 saat; süre sonra kaynak oluşturma komutlarında aynı anahtarın yeni işlem olabileceği istemciye belgelenir.

Eşzamanlı aynı komutları tekilleştirmek için kapsam anahtarına transaction advisory lock alınır; sonra kayıt okunur. İş, başarılı yanıt makbuzu ve outbox aynı DB transaction'ında yazılır. Başarısız transaction anahtar tüketmez. Saklanan yanıt hassas fotoğraf/yorum verisi içermez; tekrar döndürmeden aktif hesap ve kaynak erişimi kontrol edilir.

Komut tekrarlarının tam bir kez işlenmiş etkisi domain tekilliği ve transaction ile sağlanır; ağdan yanıtın tam bir kez ulaşacağı garanti edilmez.
