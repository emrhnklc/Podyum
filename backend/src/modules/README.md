# Özellik modülleri

`health`, `auth`, `users`, `social`, `media`, `polls`, `feed`, `games`, `moderation` ve `notifications` uçları çalışır. Auth: e-posta/şifre, yerel doğrulama/reset mesajları, opaque oturumlar ve Google/Apple mock. Users: profil/stil, özel bilgiler/analiz izni ve ayarlar. Social: arama, arkadaş isteği/kabul/red/iptal, arkadaş/engel listeleri ve ortak erişim servisi. Media: özel yerel yükleme, gerçek görsel işleme/EXIF temizliği, manuel bölge blur, önizleme onayı, erişim ve avatar. Polls: taslak/düzenle/yayın/iptal/silme, elle ürün etiketleri, detay/kendi liste ve yayın sonrası yorum izni. Tek tercih, toplu sonuç ve periyodik kalıcı kapanış da hazır. Organik ana akış herkes/arkadaşlar, kategori ve publishedAt/id cursor ile çalışır. Kaydet/kaldır, kaydedilenler, başkasının paylaşımları, yorum, oy sonrası hazır neden ve şikâyet kaydı da çalışır: [etkileşim rehberi](../../docs/interactions-development.md). Katalog eşleştirme, otomatik yüz tespiti/bulut deposu henüz yoktur. Diğer özellik klasörleri henüz controller/service içermezler. [Auth rehberi](../../docs/auth-development.md), [profil rehberi](../../docs/users-development.md), [sosyal rehber](../../docs/social-development.md), [medya rehberi](../../docs/media-development.md), [oylama rehberi](../../docs/polls-development.md).

Güncel aktif görev paylaşımı: biz `backend/`, arkadaş `mobile/` tema ve ekranları. Önceki katalog/trend/gelir backend kolu işe dönüşte yeniden paylaştırılır. `games` günlük podyum ve QR lobisi API'sini, aşama zamanlayıcısını ve oyun fotoğrafı erişimini içerir; Socket.IO bildirimleri henüz yok. `notifications` olay kuyruğundan uygulama içi bildirim üretir ve push teslim eder: [bildirim rehberi](../../docs/notifications-development.md). `rewards` formül/uygunluk kararını bekler. [Oyun rehberi](../../docs/games-development.md), [oyun tasarımı](../../docs/game-design.md). Ticari modüller henüz yazılmadı. Sahiplik, ortak şema ve servis sınırları: [iki kişilik plan](../../docs/two-developer-plan.md).

| Klasör | Sorumluluk |
| --- | --- |
| auth | Kimlik doğrulama, token doğrulama, auth guard/decorator/strategy |
| users | Profil, özel profil alanları ve stil etiketleri |
| social | Arkadaş isteği, kabul, arkadaşlık ve engelleme |
| media | Yükleme, işleme, önizleme ve yetkili görsel erişimi |
| polls | Kombin oylaması, tercih, sonuç, yorum, hazır neden ve kaydetme |
| moderation | Şikâyet kaydı; yönetici inceleme/yaptırım API'leri 16. adımda |
| feed | Herkes/arkadaşlar organik ana akışı, kategori ve cursor |
| games | Günlük etkinlik, özel QR lobisi, fotoğraf teslimi, yıldız değerlendirmesi, aşama zamanlayıcısı ve sonuç |
| notifications | Olaylardan uygulama içi bildirim, okundu/sayaç, cihaz kaydı ve push teslimi |
| rewards | Profil puan hareketleri; ödül politikası seçilince etkinleşir |
| health | Süreç ve veritabanı sağlık kontrolleri |

Her modül ihtiyaç duyduğu `*.module.ts`, `*.controller.ts`, `*.service.ts` ve `dto/` dosyalarını kendi içinde tutar. Guard/strategy gibi alt klasörler yalnızca ilgili modülün ihtiyacı varsa açılır. Oda, matchmaking ve puanlama kodu büyürse `games` içinde alt servisler oluşturulur.

Controller HTTP giriş/çıkışını yönetir; service iş kurallarını ve transaction'ları yürütür; DTO istek/yanıt sözleşmesidir. Prisma modeli doğrudan kamusal yanıt DTO'su olarak kullanılmaz.

Başka modülün işlemi gerekiyorsa onun export ettiği servis kullanılır. DatabaseModule ortak DB istemcisini sağlar; domain yetkilendirmesini üstlenmez.

SocialModule, SocialAccessService'i export eder; UsersModule, MediaModule, PollsModule ve ModerationModule onu kullanır. Yorum, kaydetme, neden ve şikâyet uçları aynı görünürlük servisine bağlıdır. Taslak seçenekleri MediaService.requireAttachableAsset, yayın MediaService.requirePublishableAsset ile aynı transaction'da sahiplik/amaç ve gerektiğinde onay denetimi yapar. IdempotencyModule kalıcı işlem makbuzunu sunar. Oylama değişikliği/makbuz/outbox ve sosyal ilişki/sürüm/outbox kendi transaction'larında atomiktir. Modüller NotificationsModule'ü çağırmaz; `common/outbox` işçisi olayları tüketicilere dağıtır ve yeni tüketici OutboxRegistry'ye kaydolur. Tercih/kapanış/izinli snapshot sözleşmesi: [oy rehberi](../../docs/poll-votes-development.md). FeedService aynı SocialAccessService sorgu kurallarını ve oylama detayının ortak salt okunur sunumunu kullanır; N kart için N ayrı detay servisi çağırmaz. Akış, kaydedilenler ve kullanıcı paylaşımları aynı kart sunumunu (`polls/poll-card.ts`) paylaşır. [Akış sözleşmesi](../../docs/feed-development.md). Sonraki bizim adımımız oyunun canlı bildirimleridir.
