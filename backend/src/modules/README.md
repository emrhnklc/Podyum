# Özellik modülleri

`health`, `auth`, `accounts`, `users`, `social`, `media`, `polls`, `feed`, `games`, `moderation`, `notifications`, `catalog`, `trends` ve `maintenance` uçları çalışır. Auth: e-posta/şifre, yerel doğrulama/reset mesajları, opaque oturumlar ve Google/Apple mock. Users: profil/stil, özel bilgiler/analiz izni ve ayarlar. Social: arama, arkadaş isteği/kabul/red/iptal, arkadaş/engel listeleri ve ortak erişim servisi. Media: özel yerel yükleme, gerçek görsel işleme/EXIF temizliği, manuel bölge blur, önizleme onayı, erişim ve avatar. Polls: taslak/düzenle/yayın/iptal/silme, elle ürün etiketleri, detay/kendi liste ve yayın sonrası yorum izni. Tek tercih, toplu sonuç ve periyodik kalıcı kapanış da hazır. Organik ana akış herkes/arkadaşlar, kategori ve publishedAt/id cursor ile çalışır. Kaydet/kaldır, kaydedilenler, başkasının paylaşımları, yorum, oy sonrası hazır neden ve şikâyet kaydı da çalışır: [etkileşim rehberi](../../docs/interactions-development.md). Katalog çözümleme ve özel öneri/ADMIN yönetimi hazırdır; ProductTag bağlantısı ve mobil ürün seçimi de hazırdır. Otomatik yüz tespiti/bulut deposu henüz yoktur. Diğer özellik klasörleri henüz controller/service içermezler. [Auth rehberi](../../docs/auth-development.md), [profil rehberi](../../docs/users-development.md), [sosyal rehber](../../docs/social-development.md), [medya rehberi](../../docs/media-development.md), [oylama rehberi](../../docs/polls-development.md).

Güncel aktif görev paylaşımı: biz `backend/`, arkadaş `mobile/` tema ve ekranları. Önceki katalog/trend/gelir backend kolu işe dönüşte yeniden paylaştırılır. `games` günlük podyum ve QR lobisi API'sini, aşama zamanlayıcısını ve oyun fotoğrafı erişimini içerir; yetkili Socket.IO aboneliği, kişisel snapshot ve outbox yenileme sinyalleri de hazır: [canlı bağlantı rehberi](../../docs/game-realtime-development.md). `notifications` olay kuyruğundan uygulama içi bildirim üretir ve push teslim eder: [bildirim rehberi](../../docs/notifications-development.md). `rewards` formül/uygunluk kararını bekler. [Oyun rehberi](../../docs/games-development.md), [oyun tasarımı](../../docs/game-design.md). Ticari modüller henüz yazılmadı. Sahiplik, ortak şema ve servis sınırları: [iki kişilik plan](../../docs/two-developer-plan.md).

| Klasör | Sorumluluk |
| --- | --- |
| auth | Kimlik doğrulama, auth guard/decorator/strategy ve ortak AdminGuard/AdminAccessService |
| accounts | Kendi hesabını kapatma, kimlik/özel veri silme, kalıcı içerik/dosya temizlik işi |
| users | Profil, özel profil alanları ve stil etiketleri |
| social | Arkadaş isteği, kabul, arkadaşlık ve engelleme |
| media | Yükleme, işleme, önizleme ve yetkili görsel erişimi |
| polls | Kombin oylaması, tercih, sonuç, yorum, hazır neden ve kaydetme |
| moderation | Şikâyet, ADMIN inceleme/karar, içerik/hesap yaptırımları, oyun iptali ve denetim |
| feed | Herkes/arkadaşlar organik ana akışı, kategori ve cursor |
| catalog | Ortak mağaza/ürün/URL; özel öneri ve ADMIN düzeltme/birleştirme |
| maintenance | Teknik DB/mail/push/medya bakım sırası, lease/imleç/rapor, zamanlayıcı ve ADMIN durum |
| games | Günlük etkinlik, özel QR lobisi, fotoğraf teslimi, yıldız değerlendirmesi, aşama zamanlayıcısı ve sonuç |
| trends | Tercih/katalog katkı projeksiyonu, günlük tekil sinyal/onarım ve dönem/ürün/demografi/fiyat filtreli, eşik korumalı Trendler API'si |
| notifications | Olaylardan uygulama içi bildirim, okundu/sayaç, cihaz kaydı ve push teslimi |
| rewards | Profil puan hareketleri; ödül politikası seçilince etkinleşir |
| health | Süreç ve veritabanı sağlık kontrolleri |

Her modül ihtiyaç duyduğu `*.module.ts`, `*.controller.ts`, `*.service.ts` ve `dto/` dosyalarını kendi içinde tutar. Guard/strategy gibi alt klasörler yalnızca ilgili modülün ihtiyacı varsa açılır. Oda, matchmaking ve puanlama kodu büyürse `games` içinde alt servisler oluşturulur.

Controller HTTP giriş/çıkışını yönetir; service iş kurallarını ve transaction'ları yürütür; DTO istek/yanıt sözleşmesidir. Prisma modeli doğrudan kamusal yanıt DTO'su olarak kullanılmaz.

Başka modülün işlemi gerekiyorsa onun export ettiği servis kullanılır. DatabaseModule ortak DB istemcisini sağlar; domain yetkilendirmesini üstlenmez.

SocialModule, SocialAccessService'i export eder; UsersModule, MediaModule, PollsModule ve ModerationModule onu kullanır. Yorum, kaydetme, neden ve şikâyet uçları aynı görünürlük servisine bağlıdır. Taslak seçenekleri MediaService.requireAttachableAsset, yayın MediaService.requirePublishableAsset ile aynı transaction'da sahiplik/amaç ve gerektiğinde onay denetimi yapar. IdempotencyModule kalıcı işlem makbuzunu sunar. Oylama değişikliği/makbuz/outbox ve sosyal ilişki/sürüm/outbox kendi transaction'larında atomiktir. Modüller NotificationsModule'ü çağırmaz; `common/outbox` işçisi olayları tüketicilere dağıtır ve yeni tüketici OutboxRegistry'ye kaydolur. Tercih/kapanış/izinli snapshot sözleşmesi: [oy rehberi](../../docs/poll-votes-development.md). FeedService aynı SocialAccessService sorgu kurallarını ve oylama detayının ortak salt okunur sunumunu kullanır; N kart için N ayrı detay servisi çağırmaz. Akış, kaydedilenler ve kullanıcı paylaşımları aynı kart sunumunu (`polls/poll-card.ts`) paylaşır. [Akış sözleşmesi](../../docs/feed-development.md). Yönetim ilk teslimi [moderation rehberinde](../../docs/moderation-development.md). AuthModule ortak admin yetkisini export eder; ModerationModule iptal için GameLifecycleService kullanır. AccountsModule kalıcı hesap silme işini outbox üzerinden yürütür: [hesap rehberi](../../docs/accounts-development.md). Teknik DB/dosya bakım otomasyonu, oyun süre uyumu/tema-takvim yönetimi ve katalog ilk teslimi hazır. ProductTag, mobil ürün seçimi ve filtreli Trendler API’si hazır; mobil Trendler bağlantısı sıradadır. Bakımın varsayılanı yalnız rapordur; nihai saklama/alarm/yedek ayrı iştir. [Güncel sıra](../../docs/backend-implementation-plan-2026-10-19.md).

MaintenanceModule teknik bakım adımlarını ve MediaService temizliğini birleştirir; common/maintenance domain modülü import etmez. CatalogModule ortak AuthModule ADMIN kontrolü ve IdempotencyModule kullanır. AccountsModule hesap silmede özel katalog önerisini de temizler.

20 Ekim güncellemesi: trend veri hattı ve `GET /trends` hazır. TrendsModule tercih outbox olayını tüketir; ham tablo genel API toplamı değildir. HTTP toplaması güncel uygunluk/günlük sinyal görünümünü kullanır, ürün/filtre başına en az 5 ayrı hesap ister. İzin/görünürlük değişirse sonraki sayfa yenilenir; güncel kart ile yayın anı fiyat filtresi ayrıdır. [HTTP sözleşmesi](../../docs/trends-api-development.md). Mobil Trendler örnek verisi de gerçek API ile değiştirildi; [mobil sözleşme](../../../mobile/docs/trends-api-integration.md).
