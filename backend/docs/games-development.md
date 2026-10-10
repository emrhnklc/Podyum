# Günlük podyum ve QR lobileri — çalışan API

10 Ekim 2026. Yol haritasının 19. adımı ve 20. adımın zamanlayıcı/state/canlı abonelik kısmı. `/v1` altında Bearer oturumu gerekir. [Tasarım ve kararlar](game-design.md), [HTTP örnekleri](../examples/games.http). Socket.IO aboneliği ve yenileme sinyalleri çalışır: [canlı bağlantı sözleşmesi](game-realtime-development.md). Mobil ekran henüz bağlanmadı; durum REST ile okunur. Oylama başlayınca ve sonuç açıklanınca etkin üyelere bildirim/push gider: [bildirim rehberi](notifications-development.md).

## Uygulanan kullanıcı kararları

- Değerlendirme **yalnız 1–5 yıldızdır**; "temaya uygun mu?" alanı yoktur.
- Etkinliğe/lobiye **katılan herkes oy verebilir**; fotoğraf göndermek şart değildir. Üye olmayan kimse oy veremez, fotoğrafları göremez.
- Özel lobiye **geçerli QR daveti + giriş yeterlidir**; lobi sahibiyle arkadaş olmak gerekmez. Güncel iki yönlü engel daveti geçersiz kılar.
- Günlük etkinliğin **saati ayarla verilir**; ayar yoksa sunucu kendiliğinden etkinlik oluşturmaz.

## İki mod

| Konu | Günlük etkinlik (`DAILY`) | Özel lobi (`PRIVATE`) |
| --- | --- | --- |
| Oluşturan | Sunucu, takvim ayarından; günde tek kayıt | Giriş yapmış kullanıcı; kendisi host ve ilk üye |
| Başlangıç aşaması | `SCHEDULED`, `startsAt` gelince `SUBMISSION` | `WAITING`, host `start` deyince `SUBMISSION` |
| Fotoğraf süresi | Sabit 1800 sn | `submissionSeconds`, 60–7200 sn, varsayılan 1800 |
| Oylama süresi | Sabit 1800 sn | `votingSeconds`, 60–7200 sn, varsayılan 1800 |
| Kapasite | Sınırsız (`maxMembers: null`) | `maxMembers`, 2–50, varsayılan 20 |
| Katılım | `POST /games/:id/join` | Davet token'ıyla `POST /games/join` |
| Erken geçiş | Yok; takvim sabit | Host `end-submission` ile fotoğraf aşamasını bitirir |

Aşamalar: `SCHEDULED` / `WAITING` → `SUBMISSION` → `VOTING` → `COMPLETED`; aktif aşamalardan `CANCELLED`. İptal gerekçeleri: `NOT_ENOUGH_SUBMISSIONS` (iki geçerli teslim yok), `LOBBY_EXPIRED` (24 saat içinde başlatılmadı), `HOST_LEFT` (host başlamadan ayrıldı).

## Uçlar

| Metot | Yol | Sözleşme |
| --- | --- | --- |
| GET | `/games/daily` | `{ scheduleConfigured, event }`; ayar yoksa `event: null` |
| POST | `/games/:id/join` | Günlük etkinliğe veya herkese açık lobiye davetsiz katıl; boş gövde; Idempotency-Key |
| GET | `/games/open` | Hızlı eşleş: katılınabilir herkese açık lobiler (bekleyen veya fotoğraf süresi süren, dolu olmayan, üyesi olmadığın), en fazla 20 |
| POST | `/games/lobbies` | `{ themeTitle, submissionSeconds?, votingSeconds?, maxMembers?, startsAt?, isPublic? }`; 201 state; Idempotency-Key |
| PUT | `/games/:id/settings` | Host, yalnız `WAITING`; tam ayar listesi + `expectedVersion`; Idempotency-Key |
| POST | `/games/:id/invite` | Host; `{ expectedVersion }` → `{ token, deepLink, expiresAt, version }`; eski token iptal |
| POST | `/games/:id/invite/revoke` | Host; daveti kapatır; Idempotency-Key |
| POST | `/games/invites/preview` | `{ token }` → lobi özeti; üyelik oluşturmaz |
| POST | `/games/join` | `{ token }` → state; Idempotency-Key |
| POST | `/games/:id/start` | Host, en az 2 aktif üye; `{ expectedVersion }`; Idempotency-Key |
| POST | `/games/:id/end-submission` | Host, yalnız `SUBMISSION`; `{ expectedVersion }`; Idempotency-Key |
| POST | `/games/:id/leave` | `SCHEDULED`/`WAITING`/`SUBMISSION` aşamasında; boş gövde; Idempotency-Key |
| GET | `/games/:id` | Üyeye özel state; yeniden bağlanınca tekrar okunur |
| PUT | `/games/:id/submission` | `{ mediaId }`; süre içinde değiştirilebilir tek teslim |
| GET | `/games/:id/ballot` | Henüz değerlendirilmemiş anonim kartlar; `limit`, `cursor` |
| GET | `/games/:id/turn` | Podyum Turu: o an herkese gösterilen yarışmacı, tur bitişi, oy sayısı, sıradaki ve kendi sıran |
| PUT | `/games/:id/submissions/:submissionId/rating` | `{ stars: 1–5 }`; tek değişmez değerlendirme |
| GET | `/games/:id/results` | Yalnız `COMPLETED`; sıraya göre sayfalı sonuç, yazar, oy sayısı; herkese açık defilede lig puanı |
| GET | `/me/league` | Herkese açık defilelerden toplam lig puanı ve kademe |
| GET | `/me/games` | Kendi katılım geçmişi; `joinedAt`/oturum kimliği cursor'ı |

Idempotency-Key 8–100 karakterdir; aynı komut ve gövde tekrarında aynı anahtar aynı makbuzu döndürür, 24 saat saklanır. Davet üretme, teslim ve değerlendirme anahtar istemez: davet yanıtı ham token içerdiği için makbuzda saklanmaz; teslim ve değerlendirme doğal anahtarla tekilleşir.

## State yanıtı

Özet alanları: `id`, `kind`, `phase`, `themeTitle`, `rulesVersion`, `version`, `hostId`, `maxMembers`, `submissionSeconds`, `votingSeconds`, `startsAt`, `submissionEndsAt`, `votingStartsAt`, `votingEndsAt`, `waitingExpiresAt`, `finishedAt`, `cancelReason`, `phaseEndsAt`, `serverNow`, `remainingSeconds`.

Üye state'i bunlara `membershipStatus`, `memberCount`, `submissionCount`, `myRatingCount`, `isHost`, `canSubmit`, `canVote`, `canEndSubmission` ve `mySubmission` ekler. `can*` alanları arayüz ipucudur; her komut kilit sonrası DB saatini ve gerçek aşamayı yeniden denetler. Geri sayım `serverNow` ve `phaseEndsAt` farkından hesaplanır; telefon saati kullanılmaz. Üye olmayan veya engelli kullanıcı `404 RESOURCE_NOT_FOUND` alır.

## QR daveti

- Token 32 rastgele bayttan üretilen 43 karakterlik base64url değerdir; veritabanında yalnız SHA-256 özeti durur. Ham token sadece `POST /games/:id/invite` yanıtında görünür; state, outbox ve loglara yazılmaz.
- `deepLink` biçimi `podyum://games/join?token=...`. QR görselini mobil üretir.
- Yeni davet eskisini geçersiz kılar. Davet `WAITING` aşamasında bekleme süresiyle, `SUBMISSION` aşamasında fotoğraf süresiyle biter; oylamaya geçişte, tamamlanmada ve iptalde silinir.
- Önizleme ve katılım token'ı gövdeden alır, URL'de taşımaz. Oda kimliğini bilmek daveti atlatmaz: özel lobiye `POST /games/:id/join` ile girilemez.
- Katılım `WAITING` ve `SUBMISSION` aşamalarında açıktır; kapasite doluysa `409 ROOM_FULL`, oylama başladıysa `409 GAME_JOIN_CLOSED`. Aktif üyenin tekrar katılımı mevcut state'i döndürür. Ayrılıp dönen üyenin eski teslimi geri gelmez.

## Fotoğraf teslimi ve erişim

Teslim için fotoğraf `purpose: "GAME"` ile [medya hattından](media-development.md) yüklenir, işlenir ve önizlemesi onaylanır; POLL ve AVATAR görselleri teslim edilemez. Üye başına tek teslim vardır; fotoğraf süresince başka bir onaylı GAME görseliyle değiştirilebilir, yarışmacı numarası (`number`) korunur. Aynı `mediaId` tekrarı aynı makbuzu döndürür. Süre dolunca `409 SUBMISSION_CLOSED`.

Oylamaya geçişte ayrılmış üyenin, aktif olmayan hesabın veya hazır/onaylı olmayan görselin teslimi `WITHDRAWN` olur; kalanlar `FROZEN` ile sabitlenir. İkiden az geçerli teslim varsa oyun `NOT_ENOUGH_SUBMISSIONS` ile iptal edilir.

Oyun fotoğrafı oylama başlayana kadar yalnız sahibine açıktır. `VOTING` ve `COMPLETED` aşamalarında yalnız aktif üyelere, güncel engel ve hesap durumu denetlenerek `/v1/media/:id/content` üzerinden açılır. Medya temizliği teslimde kullanılan görseli korur.

## Oy kartları ve değerlendirme

`GET /games/:id/ballot` üyenin kendi teslimi dışındaki, henüz yıldız vermediği dondurulmuş teslimleri döndürür. Kart alanları yalnız `id`, `number`, `mediaId`, `displayPath`, `thumbnailPath` şeklindedir; kullanıcı adı, avatar veya puan taşımaz. Fotoğraftaki kişi tanınabilir; tam anonimlik iddia edilmez.

Her üye katılırken rastgele bir başlangıç noktası alır; kartlar o noktadan itibaren yarışmacı numarası sırasıyla döner. Böylece herkes aynı ilk kartlara yığılmaz. Cursor oda, kullanıcı ve liste türüne bağlıdır; başkasına taşınırsa `400 INVALID_CURSOR`.

Değerlendirme teslim başına tek ve değişmezdir: aynı yıldızın tekrarı ilk makbuzu döndürür, farklı yıldız `409 RATING_ALREADY_CAST`. Kendi fotoğrafına yıldız `403 SELF_RATING_NOT_ALLOWED`. Son süre DB saatine göre denetlenir; işçi henüz çalışmamış olsa bile süresi dolmuş oylamaya yeni yıldız `409 VOTING_CLOSED` alır. Oyun yıldızı normal A/B tercihinden ayrı tablodadır.

## Sonuç

Sonuçlar oylama tamamlanana kadar `409 RESULTS_NOT_AVAILABLE` döner. Tamamlanınca her teslim için `ratingCount`, `ratingSum`, `averageStars` (hiç oy yoksa `null`) ve yazarın `id`, `username`, `displayName` alanları açılır. Liste yarışmacı numarası sırasındadır; sunucu kazanan ilan etmez, eşitlik bozmaz. `official: false` ve `awardedPoints: 0` sabittir: profil puanı, lig ve ödül politikası seçilmediği için hiçbir sonuç PointsLedger kaydı üretmez.

## Zamanlayıcı ve toparlanma

`GameWorker` API açılışında ve `GAME_INTERVAL_MS` aralığıyla (varsayılan 5000, 1000–300000) çalışır; `GAME_WORKER_ENABLED=false` kapatır, `NODE_ENV=test` her zaman kapalıdır. Her turda günün etkinliğini oluşturmayı dener, sonra süresi gelmiş en fazla 100 oturumu ilerletir. Her oturum ayrı transaction'da `FOR UPDATE SKIP LOCKED` ile alınır.

İşçiye bağımlılık yoktur: her okuma ve komut da oturumu kilitleyip süresi gelmiş geçişleri uygular. İşçi geç kalırsa süreler uzamaz; fotoğraf ve oylama penceresi tamamen kaçmışsa geçişler sırayla işlenir, geçmişe teslim veya oy alınmaz. Host bağlantısı kopsa da oyun ilerler. Host'un erken bitirmesi oylama süresini kabul edildiği DB saatinden bir kez başlatır; tekrar çağrı süreyi yeniden başlatmaz.

Her geçiş `game-session` aggregate'i için outbox olayı yazar: `game.created`, `game.settings.changed`, `game.invite.rotated`, `game.invite.revoked`, `game.member.joined`, `game.member.left`, `game.submission.opened`, `game.submission.accepted`, `game.voting.opened`, `game.rating.cast`, `game.completed`, `game.cancelled`. Olay ve durum değişikliği aynı transaction'dadır. Olaylar mevcut outbox işçisi tarafından bildirim/push ve canlı socket tüketicilerine dağıtılır; ham payload istemciye açılmaz.

## Günlük takvim ayarı

Üç ortam değişkeni birlikte verilir; biri eksikse API açılmaz, hiçbiri yoksa günlük etkinlik kapalıdır:

```dotenv
DAILY_GAME_START_TIME="20:00"
DAILY_GAME_TIME_ZONE="Europe/Istanbul"
DAILY_GAME_THEME_SLUG="90lar"
```

Saat `HH:MM`, saat dilimi IANA adı, tema `Theme.slug` değeridir (etkin olmalı; demo seed `90lar` temasını ekler). Etkinlik o saat dilimindeki takvim günü başına tek kez oluşturulur; tema başlığı ve takvim oluşturulurken kopyalanır. Saat ileri/geri alınan günde seçilen saat yoksa ya da iki kez oluşuyorsa etkinlik oluşturulmaz. Yukarıdaki saat yalnız örnektir; ürün kararı olarak henüz seçilmedi.

## Sınırlar

Bir kullanıcı aynı anda en fazla 10 aktif lobinin hostu olabilir ve 24 saatte en fazla 100 lobi açabilir; aşımda `429 GAME_QUOTA_EXCEEDED`. Başlatılmayan lobi 24 saat sonra iptal olur. Bunlar yerel geliştirme varsayımlarıdır.

## Şema

On birinci migration `GameSession`, `GameMembership`, `GameSubmission`, `GameScore`, `GameOutcome` tablolarını ve `GAME` medya amacını ekler; on ikincisi kapasite kısıtını. Eski `GameRoom`/`GameRound` tabloları ve verileri korunur, yeni akış onları kullanmaz. Diğer bilgisayarda `npm ci`, `npm run db:deploy`, `npm run db:generate`; reset yok.

## Doğrulama ve kalanlar

`npm run test:games`: 24 HTTP/servis testi. Oturum/DTO, lobi oluşturma, davet yenileme/iptal/süre, QR ile katılım ve kapasite, engel, ayar/başlatma sürümü, teslim ve değiştirme, fotoğraf erişimi, erken geçiş, yetersiz teslimde iptal, günlük takvim tekilliği, fotoğrafsız üyenin oyu, değişmez değerlendirme, kart sayfalama, sonuç, geç işçi, teslim/geçiş yarışı, süre sonrası oy, hata sonrası geri alma, host ayrılması, geçmiş, takvim ayarı ve OpenAPI kontrol edilir. `npm run test:api` bütün modüllerle birlikte çalıştırır.

Henüz yok:

- Dağıtık Socket.IO fan-out. Tek API sürecindeki abonelik/güncelleme hazır; ayrı süreçler için ortak taşıyıcı henüz yok. "Oylama başladı" ve "sonuç açıklandı" bildirimleri bağlandı; QR daveti kişiye hedefli olmadığından davet bildirimi yoktur.
- Gerçek çok bağlantılı PostgreSQL'de iki işçi ve geçiş yarışı testleri. Yerel PGlite tek bağlantılıdır.
- Günlük saatin ürün kararı ve tema yönetimi API'si; tema şimdilik `Theme` tablosundan ayarla seçilir.
- Minimum oy eşiği, resmî kazanan, ödül/lig ve moderasyonla oyun iptali.
- Mobil oyun ekranı; `mobile/` hâlâ hazırlık ekranı gösterir.

## Yönetici yaptırımları

Ortak ADMIN yetkisiyle POST /v1/admin/games/:id/cancel, expectedVersion/Idempotency-Key/reason kullanır; MODERATION nedeni, davet kapanışı, game.cancelled ve audit atomiktir. Süre/sürüm ve bitmiş oyun koruması uygulanır. Hesap askıya alma mevcut oturum/cihaz/socket erişimini kapatır; hostun bütün oyunlarını otomatik iptal etmez. [Yönetim sözleşmesi](moderation-development.md).

Hesap silme aktif özel host lobisini HOST_ACCOUNT_DELETED ile iptal eder; DAILY etkinlik diğer üyelerle sürer. Üyelik/teslim erişimi kapanır, eski yıldızlar başkalarının toplamlarını değiştirmez. [Hesap yaşam döngüsü](accounts-development.md).

## Planlı başlangıç ve herkese açık lobi

11 Ekim 2026. Özel lobi oluştururken (ve `WAITING` iken ayar değiştirirken) iki isteğe bağlı alan:

- `startsAt` (ISO tarih, nullable): en erken 1 dakika, en geç bekleme süresi (24 saat) sonrası; aksi `422 INVALID_START_TIME`. Bu anda en az iki aktif üye varsa lobi kendiliğinden `SUBMISSION` aşamasına geçer; süreler planlı saatten hesaplanır, işçi gecikmesi pencereyi uzatmaz. İki üye yoksa `NOT_ENOUGH_PLAYERS` ile iptal olur. Host isterse saatten önce `start` ile başlatabilir. Bekleyen planlı lobide `phaseEndsAt` başlangıç saatidir.
- `isPublic` (varsayılan `false`): `true` ise lobi `GET /games/open` listesinde görünür ve `POST /games/:id/join` ile davetsiz katılınır. `false` lobiye yalnız QR davetiyle girilir; davet edilenin host ile arkadaş olması gerekmez. Engel kuralları iki durumda da aynıdır. State/özet yanıtları `isPublic` içerir.

Migration `20261011000200_game_public_scheduled_lobby` yalnız `GameSession.isPublic` sütununu ve `(isPublic, phase)` indeksini ekler; planlı başlangıç mevcut `startsAt` sütununu kullanır. Diğer bilgisayarda `npm run db:deploy` ve `npm run db:generate`; reset gerekmez. `npm run test:games` iki yeni test içerir.

## Sıralama, lig puanı ve erken bitiş

11 Ekim 2026. Oylama bittiğinde dondurulmuş teslimler sıralanır: ortalama yıldız (oy almayanlar sonda), eşitlikte oy sayısı, sonra yükleme sırası. Sıra `GameOutcome.rank` alanında saklanır; sonuçlar bu sıraya göre sayfalanır.

- **Herkese açık defile** (günlük etkinlik veya `isPublic` lobi): ilk üçe sırasıyla 50, 30, 20 lig puanı verilir; hiç oy almayan kombin puan almaz. Puan `GameLeaguePoint` tablosuna oyun başına kullanıcıya tek kayıt olarak yazılır ve `GameOutcome.awardedPoints` alanında da durur. Sonuç yanıtı `official: true`, isteyen kullanıcının `myRank`, `awardedPoints`, `totalPoints` ve `league` bilgisini içerir.
- **Davetli oda** (arkadaşlarla, `isPublic: false`): yalnız sıralama vardır; `official: false`, `awardedPoints: 0`, `totalPoints` ve `league` null. Puan yazılmaz.
- Lig kademeleri `league.ts`: Bronz 0, Gümüş 500, Altın 1000, Platin 2000, Elmas 3500 (mobil `features/games/data/league.ts` ile aynı). Eski `PointsLedger` eski `GameRoom` tablosuna bağlı olduğu için kullanılmaz.
- **Erken bitiş:** her yıldızdan sonra, odadaki her aktif üye kendi oy kartındaki bütün kombinleri oyladıysa oylama süreyi beklemeden kapanır ve sonuçlar açılır (`votingEndsAt` o an olur). Hiç oy vermemiş bir üye varsa süre beklenir.

Migration `20261011000300_game_ranking_league_points`: `GameOutcome.rank`, `GameOutcome.awardedPoints` ve `GameLeaguePoint` tablosu. Testlerin temizlik adımları önce `gameLeaguePoint` kayıtlarını siler.

## Podyum Turu (senkron oylama)

11 Ekim 2026. Oylama, herkesin aynı yarışmacıyı aynı anda gördüğü turlarla yapılır. Kombinler yarışmacı numarası sırasıyla gösterilir; her tur `TURN_SECONDS` (10 sn, `game-lifecycle.service.ts`). Oylama penceresi `kombin sayısı x 10 sn` olur ve oylamanın planlanan başlangıcından sayılır; `votingSeconds` ayarı artık oylama süresini belirlemez. İşçi geç kalırsa geçen turlar telafi edilmez (pencere uzamaz).

`GET /games/:id/turn` (yalnız `VOTING`, aksi `409 VOTING_CLOSED`): `index`, `total`, `turnSeconds`, `serverNow`, `turnEndsAt`, `current` (kart + `mine` + `myStars`; engelli yazarda null), `votedCount`, `voterCount` (yazar hariç aktif üye), `myTurnIn` (kendi kombinine kaç tur kaldı), `nextNumber`. Yıldız ucu değişmedi: değerlendirme tek ve değişmezdir, sunucu kartın turda olmasını zorlamaz. Herkes bütün kartları oyladıysa oylama erken biter. "Temaya uygun mu?" alanı yoktur.

