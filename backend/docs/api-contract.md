# API ve canlı bağlantı sözleşmesi — taslak

**Kapsam güncellemesi:** Günlük podyum/QR lobisi REST API'si ve yetkili Socket.IO aboneliği çalışır. [Oyun tasarımı](game-design.md), [canlı bağlantı sözleşmesi](game-realtime-development.md). Trend, affiliate ve reklam API'leri ilgili Faz 1 adımında tasarlanacak; henüz çalışan endpoint değildir. [Mentör görüşmesi](mentor-notes-2026-10-10.md).

Health, `/v1/auth/*`, profil/ayar, sosyal, yerel medya/avatar ve oylama endpoint'leri çalışır. Controller/DTO'lardan üretilen güncel OpenAPI `/v1/openapi.json`, Swagger `/v1/docs` altındadır. Çalışan akışlar: [Auth](auth-development.md), [profil/ayar](users-development.md), [sosyal](social-development.md), [medya](media-development.md), [oylama](polls-development.md), [tercih/sonuç](poll-votes-development.md), [akış](feed-development.md), [etkileşim/şikâyet](interactions-development.md), [bildirim](notifications-development.md), [oyun](games-development.md) ve [yönetim](moderation-development.md). Socket protokolü OpenAPI'nin dışında aşağıda belgelenir. Mobil tip üretimi teslim adımında yapılacak.

## 1. Ortak kurallar

- Prefix: `/v1`. JSON alanları camelCase; enum değerleri şemayla aynı büyük harf biçiminde.
- Giriş: `Authorization: Bearer ...`; şu anda DB'deki hash'le doğrulanan opaque token, süre ve aktif hesap kontrolü. Kullanıcı kimliği body'den alınmaz. Her endpoint varsayılan korumalıdır; `@Public()` açıkça muaf tutar.
- E-posta/şifre + Google/Apple seçildi. E-posta/şifre ve yerel oturumlar çalışır; gerçek dış sağlayıcı token doğrulaması henüz yok, ayrı mock vardır. Gerçek OAuth eklenince imza/issuer/audience/süre kontrolü ve güvenli bağlama zorunlu olacaktır.
- Liste: `limit` varsayılan 20, en fazla 50; opaque cursor ve `nextCursor`. Cursor filtre/sıralama bağlamıyla doğrulanır.
- Zamanlar UTC ISO-8601. Canlı yanıtlar `serverNow`, `version`, `phaseEndsAt` içerir.
- Görülemeyen özel kaynaklar `404 RESOURCE_NOT_FOUND`; erişim hakkı olmayan kişiye varlığı açıklanmaz.
- Sunucu kodları kararlıdır; kullanıcıya gösterilen metin mobilde yerelleştirilebilir.
- Oylama oluşturma/düzenleme/yayınlama/iptal/silme/yorum ayarı, yorum/şikâyet oluşturma yönetim yaptırımları/kararları ve ilgili oyun komutlarında `Idempotency-Key` zorunlu; kalıcı servis ve 24 saatlik makbuz çalışır. Auth endpoint'leri bu anahtarı istemez; kayıt doğal e-posta tekilliğini kullanır, refresh tek kullanımlıdır. PUT oy/değerlendirme/kaydet doğal tekil anahtar kullanır. Davet üretimi ham tokenı makbuzda saklamaz; [oyun sözleşmesi](games-development.md).
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
| GET | `/me` | Çalışır: `{ profile, profileSetupRequired }`; özel alanlar dahil değildir |
| PATCH | `/me` | Çalışır: kullanıcı adı, görünen ad, bio, stil etiketleri |
| GET / PATCH | `/me/private` | Çalışır: yalnız kendi demografik bilgilerin ve analiz iznin |
| GET / PATCH | `/me/settings` | Çalışır: kendi push tercihlerin (oyun dahil) ve paylaşım varsayılanların |
| GET | `/users/username-availability` | Çalışır: `username` query ile anlık uygunluk; rezervasyon değildir |
| GET | `/users/:id` | Çalışır: aktif/engelsiz kamusal profil; sayaçlar izleyiciye göre |
| GET | `/users/search` | Çalışır: `q` ile kullanıcı adı başlangıcı; sayfalı aktif/engelsiz kullanıcı özeti |
| GET | `/users/:userId/relationship` | Çalışır: izleyiciye göre SELF/NONE/OUTGOING_REQUEST/INCOMING_REQUEST/FRIENDS |
| GET | `/users/:id/polls` | Yalnızca izleyicinin görebildiği paylaşımlar |
| GET | `/me/friends` | Çalışır: kabul edilmiş aktif/engelsiz arkadaşlar; cursor |
| GET | `/me/friend-requests` | Çalışır: direction=incoming (varsayılan)/outgoing; cursor |
| POST | `/friend-requests` | Çalışır: `targetUserId`; yönsüz tek çift; karşı istek otomatik kabul sayılmaz |
| DELETE | `/friend-requests/:userId` | Çalışır: yalnız gönderdiğin isteği iptal et |
| POST | `/friend-requests/:userId/accept` | Çalışır: yalnızca isteğin alıcısı kabul eder |
| POST | `/friend-requests/:userId/decline` | Çalışır: gelen isteği reddet |
| DELETE | `/friends/:userId` | Çalışır: arkadaşlığı kaldır; ortak serviste özel yayın erişimi kapanır |
| GET | `/me/blocks` | Çalışır: yalnız kendi engellediklerin; cursor |
| PUT / DELETE | `/blocks/:userId` | Çalışır: engelle / kendi engelini kaldır; engel ilişkileri siler, unblock geri getirmez |
| GET | `/style-tags` | Çalışır: stil sözlüğü |

Şikâyet kaydı (`POST /reports`) çalışır: [etkileşim rehberi](interactions-development.md). Yönetici kuyruğu, inceleme/karar, içerik/hesap yaptırımları, oyun iptali ve denetim API'leri çalışır; ortak ADMIN rolü gerekir. DELETE /me/account ile yeni giriş/onay gerektiren hesap silme ve kalıcı temizlik işi çalışır; genel saklama işleri açıktır. [Yönetim sözleşmesi](moderation-development.md).

Sosyal komutlar doğal çift tekilliği ve transaction ile tekrarları ele alır; bu aşamada Idempotency-Key istemez. Erişim servisi profil, medya, oylama detay, yorum, kaydetme ve şikâyet tarafından kullanılır. Olay sözleşmesi, hata/tekrar davranışları ve liste biçimi: [sosyal rehber](social-development.md).

## 3. Medya

| Metot | Yol | Davranış |
| --- | --- | --- |
| POST | `/media/uploads` | Dosya türü/boyutu ve blur tercihiyle yükleme izni |
| POST | `/media/:id/upload` | Çalışır: Bearer + X-Upload-Token ile tek multipart file, en fazla 10 MiB |
| POST | `/media/:id/complete` | Yüklemeyi doğrula, sabit sürüm/checksum ile işleme al |
| GET | `/media/:id` | Sahibi için işleme/önizleme durumu |
| POST | `/media/:id/accept-preview` | Kullanıcı gösterilecek görüntüyü kabul eder |
| GET | `/media/:id/content` | Yetkili işlenmiş görsel; private cache/no-store politikası |
| DELETE | `/media/:id` | Çalışır: kendi kullanılmayan medyanı kapat/sil |
| PUT / DELETE | `/me/avatar` | Çalışır: kendi onaylı AVATAR medyanı bağla / bağlantıyı kaldır |

Bu bölümün yerel endpoint'leri çalışır. Complete manuel blur bölgelerini veya açık yüz-yok doğrulamasını tüketir; otomatik yüz tespiti henüz yok. `content?variant=thumbnail` küçük sürümdür; orijinal sürüm açılmaz. Durum/tekrar/erişim/limit sözleşmesi: [medya rehberi](media-development.md), [HTTP örnekleri](../examples/media.http).

Upload izni dosyanın uygun olduğu veya paylaşımın tamamlandığı anlamına gelmez. Body'deki ownerId/storageKey kullanılmaz; sunucu üretir. Sahibi taslak önizlemesine erişebilir; başkaları sadece erişebildikleri yayınlanmış içeriğin işlenmiş görseline erişir. Oyun sırasında başka oyuncunun dosya kaydı/metadata endpoint'i açılmaz.

## 4. Oylama ve etkileşim

| Metot | Yol | Davranış |
| --- | --- | --- |
| POST | `/polls` | Çalışır: eksik DRAFT oluştur; 0–4 seçenek ve manuel ürün bilgileri |
| PATCH | `/polls/:id` | Çalışır: yalnızca kendi taslağını expectedVersion ile güncelle |
| POST | `/polls/:id/publish` | Çalışır: soru + 2–4 onaylı seçenek; atomik yayın/süre başlatma |
| POST | `/polls/:id/cancel` | Çalışır: kendi taslağını/süresi dolmamış yayınını iptal |
| DELETE | `/polls/:id?expectedVersion=0` | Çalışır: kendi taslağını ve seçenek/etiket bağlarını sil; medyayı koru |
| PATCH | `/polls/:id/comment-settings` | Çalışır: yayın sonrası yorum kabulünü sürümle yönet |
| GET | `/me/polls` | Çalışır: kendi taslak/yayın/iptal özetleri; status/limit/cursor |
| GET | `/feed?scope=everyone\|friends&category=...` | Çalışır: açık, erişilebilir, kendine ait olmayan ve oy verilmemiş adaylar; limit/cursor, kalan süre ve uygunluk |
| GET | `/polls/:id` | Çalışır: yetkili detay, seçenekler, manuel ürünler; myOptionId/canVote/canViewResults dahil |
| PUT | `/polls/:id/vote` | Çalışır: tek tercih; aynı oy tekrarında ilk kabul, farklı tercih 409 |
| GET | `/polls/:id/results` | Çalışır: yazar/oy veren veya kapanış sonrası yetkili izleyici; toplu anlık/kesin sonuç |
| PUT / DELETE | `/polls/:id/save` | Çalışır: kişisel kaydet/kaldır; doğal tekrar, erişim vermez |
| GET | `/me/saved-polls` | Çalışır: hâlâ görünür kayıtlar; limit/cursor |
| GET | `/users/:id/polls` | Çalışır: o kullanıcının izleyiciye görünür yayınları; limit/cursor |
| GET / POST | `/polls/:id/comments` | Çalışır: yetkili yorum listesi / yalnız oy veren veya sahip yorum ekler (Idempotency-Key) |
| DELETE | `/comments/:id` | Çalışır: yazan veya paylaşım sahibi kaldırır; düzenleme yok |
| PUT / DELETE | `/polls/:id/reason` | Çalışır: oy sonrası seçilen seçenek için tek hazır neden |
| GET | `/polls/:id/reasons` | Çalışır: seçenek başına neden sayıları; sonuçla aynı görünürlük |
| POST | `/reports` | Çalışır: görünen paylaşım/yorum/kullanıcı şikâyeti; hedef başına tek kayıt |

Taslak/yayın yönetim yazma uçları Idempotency-Key ister; PUT oy doğal kullanıcı/oylama anahtarıyla çalışır, bu başlığı istemez; oluşturma dışındaki komutlarda expectedVersion gerekir (DELETE query, diğerleri body). options gönderilirse bütün liste ve ürünler değiştirilir, yeni kimlikler üretilir; yayın sonrası bu alanlar sabittir. Süre 1800/7200/86400 saniye; yayın anında başlar. Ürünler USER_ENTERED beyanıdır, ortak katalog eşleşmesi henüz yoktur. Detay status yanında serverNow/closesAt/effectiveStatus/remainingSeconds içerir; süresi dolan OPEN okuma sırasında CLOSED görünür, kalıcı kapanış tarayıcısı API açılışında ve varsayılan 15 saniyede bir çalışır; oy son sürede doğrudan durur. [Çalışan sözleşme](polls-development.md), [HTTP örnekleri](../examples/polls.http).

Tercih/sonuç, organik akış ve yorum/kaydetme/neden/şikâyet davranışları uygulanmıştır: [etkileşim rehberi](interactions-development.md), [örnek HTTP](../examples/interactions.http). Akışta açık PUBLIC oylamalar ile izleyicinin görebildiği FRIENDS oylamalar vardır; Friends sekmesi yazarın arkadaş olmasını da zorunlu kılar. Kapanmış oylamalar profil (`/users/:id/polls`) ve kaydedilenler üzerinden görülür. `Geç` ilk sürümde oturum içi UI davranışıdır; kalıcı ilgi modeli gerektirmez. [Akış sözleşmesi ve sayfalama davranışı](feed-development.md), [örnek HTTP](../examples/feed.http).

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

Sonuç yanıtında ayrıca version/serverNow/closesAt/storedStatus ve seçenek position/label alanları vardır. Bu örnekte kazanan anlık liderdir; `isFinal=false` gösterilmelidir. Oy sayısı sıfırsa kazanan dizisi boştur. Demografik kırılımlar bu ilk sözleşmeye dahil değildir.

## 5. Günlük oyun ve QR lobi

**Bu uçlar artık çalışır.** Güncel yollar, gövdeler, hata kodları ve sınırlar [oyun rehberinde](games-development.md) ve OpenAPI'dedir; aşağıdaki tablo ilk taslağın özetidir. Uygulanan değerlendirme yalnız 1–5 yıldızdır. Eski per-round matchmaking sözleşmesi yerine [güncel oyun tasarımı](game-design.md) uygulandı.

| Alan | Planlanan uç / davranış |
| --- | --- |
| Günlük etkinlik | Güncel etkinlik/takvim/durum, katılma, kendi fotoğraf teslimi |
| Genel oylama | 30 dakikalık pencerede yalnız etkinlik üyesine sayfalı adaylar/değerlendirme |
| Özel lobi | Oluştur/düzenle/başlat; ayrı fotoğraf ve oylama süreleri |
| QR daveti | Token üret/yenile/iptal, daveti çöz ve girişten sonra katıl |
| Erken geçiş | Yalnız host, fotoğraf aşamasını atomik bitir; oy süresini bir kez başlat |
| Sonuç/geçmiş | Yetkili sonuç, değerlendirme sayıları, kendi katılımları |

Durum yanıtı kind/phase/version/serverNow ve submissionEndsAt/votingEndsAt taşır. İstemcinin saati veya QR'ı var demesi yetki oluşturmaz. Teslim kartları sonuç öncesinde yazar kimliği/avatar/toplam puanı açmaz; kendi fotoğrafına oy kapalıdır. Yalnız 1–5 yıldız kullanılır; fotoğraf göndermemiş aktif üye de oy verebilir. Resmî kazanan/ödül politikası seçilmedi. Genel etkinlik için 3–8 kişilik ortak 20 saniyelik tur kuralı yoktur.

## 6. Socket.IO

İlk sürümde kalıcı komutlar REST ile gider. Socket.IO yalnızca sunucu değişiklikleri ve yeniden okuma uyarıları içindir; aynı oyun davranışı iki ayrı komut hattında uygulanmaz.

Çalışan namespace `/games`, transport yolu `/socket.io`; yalnız websocket transport. `auth: { accessToken }` ile mevcut oturum doğrulanır. `game.subscribe` / `game.unsubscribe` gövdesi yalnız `{ sessionId }`. Subscribe ack'i `{ ok: true, data: { state } }` şeklinde kişisel REST snapshot'ı taşır; hatası `{ ok: false, error: { code, message } }`. QR tokenı veya oda ID'si üyelik vermez. Her mesaj/teslimde güncel oturum ve kaynak erişimi denetlenir; token süresi dolunca bağlantı kapanır. Browser origin'i `CORS_ORIGINS` içinde olmalıdır.

```json
{
  "eventId": "uuid-event",
  "sessionId": "uuid-session",
  "version": 13,
  "serverNow": "2026-10-10T18:00:00.000Z"
}
```

| Olay | İçerik |
| --- | --- |
| `game.changed` | Yukarıdaki gövde; güncel kişisel REST state yeniden okunur |
| `game.access-revoked` | `{ sessionId }`; abonelik kaldırıldı / yerel görünümü kapat |
| `game.error` | `{ code, message }`; oturum hatasında yeniden giriş/refresh ve reconnect |

Gateway, outbox'ın iç payload'unu doğrudan istemciye yayınlamaz. Hassas içerik olay gövdesine girmez. Yinelenen/eski olaylar `version` ile atlanır. Olayların ulaşması garanti kabul edilmez: reconnect, uygulamanın ön plana gelmesi ve faz sonlarında güncel durum yeniden okunur; canlı ekranda periyodik hafif kontrol de yapılır.

Yeniden bağlanma sırası: listener'ları ekle → abone ol → ack snapshot'ını uygula. Okuma sürerken daha yüksek version olayı gelirse son yanıtla kıyasla ve REST'i yeniden oku. Cache'ten başkasının state'i döndürülmez. Şimdilik tek API sürecinde çalışır; dağıtık fan-out, poll/bildirim socket abonelikleri ve mobil bağlantı henüz yoktur. [Limitler, oturum/engel kesme ve çalışan örnek](game-realtime-development.md).

## 7. Bildirim ve puan

| Metot | Yol | Davranış |
| --- | --- | --- |
| GET | `/me/notifications` | Çalışır: kişisel bildirimler, okunmamış sayısı; limit/cursor |
| GET | `/me/notifications/unread-count` | Çalışır: sekme rozeti sayısı |
| PUT | `/me/notifications/:id/read` | Çalışır: kendi bildirimini okundu yap |
| POST | `/me/notifications/read-all` | Çalışır: verilen ana kadarkileri okundu yap |
| PUT / DELETE | `/me/devices/:installationId` | Çalışır: kuruluma ve oturuma bağlı push kaydı / kaldırma; çıkış da kaldırır |
| GET | `/me/points` | Sunucudaki ledger toplamı; alpha'da ödül yazılmaz |

Bildirim türleri, gruplama, push ve olay kuyruğu: [bildirim rehberi](notifications-development.md), [örnek HTTP](../examples/notifications.http). Lig, Plus, demografik sonuç, haftalık yarışma ve sponsor API'leri ilk sözleşmeden ayrı eklenecek. Profil toplamı mobil tarafından artırılamaz.

## 8. Idempotency ayrıntısı

Kalıcı servis oylama yazma uçlarında çalışır. Anahtar kapsamı `(userId, command scope + resourceId, key)`; DTO sonrası normalize JSON sıralanıp hash'lenir. Aynı anahtar farklı payload ile kullanılırsa `409 IDEMPOTENCY_KEY_REUSED`. Başarılı yanıt 24 saat saklanır; süre sonra kaynak oluşturma komutlarında aynı anahtar yeni işlem olabilir. Her yeni işlemde yeni UUID, yalnız aynı ağ isteği tekrarında aynı anahtar/body kullanılmalıdır.

Eşzamanlı aynı komutları tekilleştirmek için kapsam anahtarına transaction advisory lock alınır; sonra kayıt okunur. İş, başarılı yanıt makbuzu ve outbox aynı DB transaction'ında yazılır. Başarısız transaction anahtar tüketmez. Bearer/aktif hesap kontrolü her HTTP tekrarında uygulanır.

Saklanan yanıt yalnız sahibinin kendi komut snapshot'ıdır; ilk soruyu, kullanıcı beyanı ürün bilgisini ve yetki denetimli medya yollarını içerebilir. Fotoğraf byte'ı/upload token/depolama anahtarı/özel profil içermez. Başkasına açık bir kaynak okuması veya güncel GET yerine kullanılamaz. Kaynak silinmiş/durum değişmiş olsa da ilk makbuz dönebilir; yeni kayıt oluşmaz. Başkasının kaynağına bağlı gelecekteki komutlar tekrar öncesi güncel erişim kontrolü eklemelidir. Süresi dolan aynı anahtar tekrarında eski kayıt kaldırılır; toplu makbuz retention işi henüz yoktur. [Ayrıntılı tekrar sözleşmesi](polls-development.md).

Komut tekrarlarının tam bir kez işlenmiş etkisi domain tekilliği ve transaction ile sağlanır; ağdan yanıtın tam bir kez ulaşacağı garanti edilmez.

## 9. Yönetim — çalışan ilk teslim

Tüm yollar aktif Bearer + DB'den güncel ADMIN ister. GET /admin/me, /admin/reports, /admin/reports/:id, /admin/reports/:id/media/:mediaId/content ve /admin/audit; PUT /admin/reports/:id/decision, /admin/polls/:id/visibility, /admin/users/:id/status; POST /admin/comments/:id/remove ve /admin/games/:id/cancel çalışır. Yazma uçlarında Idempotency-Key ve reason zorunlu; paylaşım/şikâyet/oyun ayrıca expectedVersion ister. Yanıtlar ve hedef türüne bağlı inceleme şemaları OpenAPI'dedir.

Karar ile hedef yaptırımı/audit/outbox/makbuz aynı transaction'dadır. Rol atama API'si yoktur; ilk atama yerel denetimli araçladır. Hesap silme ayrı AccountsModule içinde çalışır; genel saklama işleri açıktır. [Yetki, özel hedef/görsel erişimi, hata ve tekrar sözleşmesi](moderation-development.md), [HTTP örnekleri](../examples/moderation.http).

## 10. Hesap silme — çalışan yerel teslim

DELETE /me/account yalnız {confirmDeletion:true} ve son 15 dakika içinde yeni giriş ister; 202 silme kabulü/erişim kapanışıdır. İşlem sonrası oturumlar kaldırıldığı için replay endpoint'i veya Idempotency-Key zorunluluğu yoktur; userId doğal tekilliktir. GET /admin/users/:id/deletion yalnız yöneticiye PENDING/COMPLETED ve pendingMedia verir. [Kimlik/içerik/dosya temizliği, mobil timeout davranışı ve geçmiş sonuç politikası](accounts-development.md), [HTTP örnekleri](../examples/accounts.http).
