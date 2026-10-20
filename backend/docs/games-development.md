# Günlük podyum ve QR lobileri — çalışan API

10 Ekim 2026. Yol haritasının 19. adımı ve 20. adımın zamanlayıcı/state/canlı abonelik kısmı. `/v1` altında Bearer oturumu gerekir. [Tasarım ve kararlar](game-design.md), [HTTP örnekleri](../examples/games.http). Socket.IO aboneliği ve yenileme sinyalleri çalışır: [canlı bağlantı sözleşmesi](game-realtime-development.md). Mobil Defile ekranları REST/state ve yetkili canlı bağlantıyı kullanır. Oylama başlayınca ve sonuç açıklanınca etkin üyelere bildirim/push gider: [bildirim rehberi](notifications-development.md).

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

Sonuçlar oylama tamamlanana kadar `409 RESULTS_NOT_AVAILABLE` döner. Tamamlanınca `ratingCount`, `ratingSum`, `averageStars` (oy yoksa null) ve yazar kimliği açılır. Sonuçlar aşağıdaki temel lig/sıralama kurallarına göre döner; genel/davetli oda ayrımı korunur. Eski PointsLedger kullanılmaz.

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

`npm run test:games`: oyun ve yönetim HTTP/servis testleri; süre döngüsü ve takvim yönetimi dahil. Oturum/DTO, lobi oluşturma, davet yenileme/iptal/süre, QR ile katılım ve kapasite, engel, ayar/başlatma sürümü, teslim ve değiştirme, fotoğraf erişimi, erken geçiş, yetersiz teslimde iptal, günlük takvim tekilliği, fotoğrafsız üyenin oyu, değişmez değerlendirme, kart sayfalama, sonuç, geç işçi, teslim/geçiş yarışı, süre sonrası oy, hata sonrası geri alma, host ayrılması, geçmiş, takvim ayarı ve OpenAPI kontrol edilir. `npm run test:api` bütün modüllerle birlikte çalıştırır.

Henüz yok:

- Dağıtık Socket.IO fan-out. Tek API sürecindeki abonelik/güncelleme hazır; ayrı süreçler için ortak taşıyıcı henüz yok. "Oylama başladı" ve "sonuç açıklandı" bildirimleri bağlandı; QR daveti kişiye hedefli olmadığından davet bildirimi yoktur.
- Gerçek çok bağlantılı PostgreSQL'de iki işçi ve geçiş yarışı testleri. Yerel PGlite tek bağlantılıdır.
- Günlük kesin saatin ürün kararı. Tema/takvim yönetim API'si aşağıda hazırdır; saat otomatik seçilmez.
- Nihai minimum oy, beraberlik ve sezon/ödül politikası. Temel 50/30/20 lig puanı ve yönetici iptali aşağıdaki geliştirme kurallarıyla hazırdır.
- Fiziksel telefonda arka plan/ağ değişimi ve büyük katılım kabulü.

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
- **Erken bitiş (20 Ekim):** yalnız `PRIVATE` türündeki lobilerde (açık veya davetli), bütün aktif üyeler bütün uygun kartlarını oyladıysa sonuç erken açılır. Günlük `DAILY` etkinlik herkes oy verse bile sabit 30 dakikayı bekler. Hostun `end-submission` komutu yalnız fotoğraf aşamasını bitirir; keyfî oy bitirme komutu değildir.

Migration `20261011000300_game_ranking_league_points`: `GameOutcome.rank`, `GameOutcome.awardedPoints` ve `GameLeaguePoint` tablosu. Testlerin temizlik adımları önce `gameLeaguePoint` kayıtlarını siler.

## Podyum Turu (senkron oylama)

20 Ekim 2026. Kombinler yarışmacı numarası sırasıyla 10 saniyelik sunum turlarında gösterilir. **10 saniye toplam oy süresi değildir.** Günlük oylama 1800 sn; lobide `votingSeconds` geçerlidir. Son karttan sonra ilk karta dönülür; aynı teslimin ikinci kez yıldızlanması mümkün değildir. Geç çalışan işçi planlı pencereyi uzatmaz. Önceden açılmış oy pencereleri geriye dönük yeniden yazılmaz.

`GET /games/:id/turn` yalnız VOTING aşamasında döner: `index` (0 tabanlı), `total`, `cycle` (1 tabanlı gösterim döngüsü), `turnSeconds`, `serverNow`, `turnEndsAt`, `votingEndsAt`, `remainingSeconds` (toplam oy penceresi), `current` (kart + `mine` + `myStars`; engelli yazarda null), `votedCount`, `voterCount`, `myTurnIn`, `nextNumber`. Tur sonu toplam bitişe kırpılır; son pencerede `nextNumber: null`, diğer döngülerde ilk karta sarar. Boş uygun liste 409 döndürür.

Telefon `serverNow` ile zamanı eşler; arka plandan dönünce güncel state/turn alır. Küçük sayaç toplam kalan süreyi ve döngüyü gösterir. Canlı ve Sonbahar ana kartlarının tasarımı korunmuştur. Sunucu oyu yalnız gösterilen kartla sınırlamaz; son süre, üyelik ve tek değişmez yıldız kuralını her istekte denetler.

## Günlük tema ve takvim yönetimi

ADMIN uçları (tümü `/v1`):

| Metot | Yol | İş |
| --- | --- | --- |
| GET/POST | `/admin/games/themes` | Temaları listele / `{ slug, title, reason }` yarat |
| PUT | `/admin/games/themes/:id` | `{ expectedVersion, title, active, reason }` |
| GET | `/admin/games/daily-schedule` | version, enabled, source, startTime, timeZone, themeSlug |
| PUT | `/admin/games/daily-schedule` | `{ expectedVersion, enabled, startTime?, timeZone?, themeSlug?, reason }` |

Yazmalarda `Idempotency-Key`, sürüm ve gerekçe zorunlu; audit/outbox/ayar aynı transaction'dadır. Etkinleştirmek için geçerli HH:MM, IANA saat dilimi ve aktif tema gerekir. Aktif takvimin teması önce takvim değiştirilmeden/kapatılmadan pasifleştirilemez.

DB ayarı varsa ENV'nin önüne geçer; DB `enabled: false` ise ENV tekrar açamaz. DB satırı yoksa eski `DAILY_GAME_*` ayarları çalışır. İkisi de yoksa UNCONFIGURED ve günlük oyun oluşturulmaz. Yönetim ayarı önceden oluşturulmuş günün tema/saat snapshot'ını değiştirmez; değişiklik ilk henüz oluşturulmamış etkinlik içindir. Kesin günlük saat bu teslimde seçilmedi.

Migration'lar `20261020000200_daily_schedule_management` ve öncesindeki oyun migration'ları `db:deploy` ile uygulanır; reset gerekmez.
