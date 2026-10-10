# Podyum — backend

Kombin tercihi oylamaları ve fotoğraflarla oynanan canlı tema yarışması için mimari taslak ve çalışan yerel veritabanı temeli.

**Hazır:** Ortak API doğrulama/hata/request ID/Swagger ve kalıcı işlem tekrarı altyapısı; e-posta/şifre kaydı, doğrulama, giriş, yenileme, çıkış ve şifre sıfırlama; Google/Apple geliştirme mock'u; profil/stiller/özel bilgiler/analiz izni ve ayarlar; kullanıcı arama, arkadaşlık/engel ve ortak erişim servisi; yerel özel fotoğraf yükleme/işleme/önizleme, manuel bölge bulanıklaştırma ve avatar; oylama taslağı/düzenleme/yayın/iptal/silme, elle ürün etiketleri, detay ve kendi liste uçları; tek tercih oyu, yetkili anlık/kesin sonuç, kalıcı kapanış tarayıcısı ve izinli analiz snapshot/geri alma; herkes/arkadaşlar organik akışı, kategori ve cursor; kaydet/kaldır ve kaydedilenler, başkasının görünür paylaşımları, yorum ekleme/listeleme/kaldırma, oy sonrası hazır neden etiketi ve şikâyet kaydı; olay kuyruğu işçisi, uygulama içi bildirimler, okundu/sayaç, cihaz kaydı ve push teslimi (yerel + Expo sağlayıcısı); günlük 30+30 etkinlik ve özel QR lobisi (davet, fotoğraf teslimi, 1–5 yıldız, aşama zamanlayıcısı, sonuç); health endpoint'leri; Prisma şeması (39 model), on dört migration, demo seed ve DB hedef koruması. **Planlanan:** Yönetim/şikâyet inceleme, katalog eşleştirme, ticari modüller, oyun için canlı bildirimler ve ödül/lig, otomatik yüz tespiti/bulut medya deposu, gerçek OAuth/e-posta gönderimi, Socket.IO ve gerçek cihazda push doğrulaması.

E-posta teslimi şimdilik yerel dosyadır. Gerçek Google/Apple girişi tamamlanmadı. Çalışan akış: [Auth geliştirme rehberi](docs/auth-development.md).

Çalışan profil/ayar uçları: [Profil rehberi](docs/users-development.md), [HTTP örnekleri](examples/users.http). Sosyal API: [Sosyal rehber](docs/social-development.md), [HTTP örnekleri](examples/social.http). Fotoğraf/avatar: [Medya rehberi](docs/media-development.md), [HTTP örnekleri](examples/media.http). Oylama oluşturma: [Oylama rehberi](docs/polls-development.md), [HTTP örnekleri](examples/polls.http). Oy/sonuç: [Rehber](docs/poll-votes-development.md), [HTTP örnekleri](examples/poll-votes.http). Ana akış: [Rehber](docs/feed-development.md), [HTTP örnekleri](examples/feed.http). Kaydetme/yorum/neden/şikâyet: [Rehber](docs/interactions-development.md), [HTTP örnekleri](examples/interactions.http). Bildirimler: [Rehber](docs/notifications-development.md), [HTTP örnekleri](examples/notifications.http). Günlük oyun/QR lobi: [Rehber](docs/games-development.md), [HTTP örnekleri](examples/games.http). Sonraki bizim işimiz oyunun canlı bildirimleri ve yönetim; arkadaş şu an mobile temasını ilerletir. Otomatik yüz tespiti henüz bağlı değildir.

## Belgeleri okuma sırası

Adım adım geliştirmede takip edeceğimiz ana iş listesi: [Backend çalışma planı](docs/backend-roadmap.md).

İki kişinin görevleri ve entegrasyon sınırları: [İki kişilik çalışma planı](docs/two-developer-plan.md). Güncel aktif iş: biz backend, arkadaş mobile tema. Önceki ürün/trend/gelir backend paylaşımı aynı belgede kayıtlıdır; yeniden başlanınca sahiplik netleştirilir. [Önceki katalog görev kaydı](docs/friend-claude-task.md).

**Son kullanıcı güncellemesi:** Günlük podyum ve QR lobileri aktif backend kapsamına geri alındı. Genel oyun 30 dk fotoğraf + 30 dk oylama ve yalnız etkinlik katılımcılarına oy; özel lobi ayarlanabilir süre/host erken geçişiyle çalışır. [Oyun rehberi](docs/games-development.md), [oyun tasarımı](docs/game-design.md). Sosyal kombin, trend ve gelir işleri korunur. Yeni fikirler, açık kararlar ve yapılacaklar: [Mentör görüşmesi notu](docs/mentor-notes-2026-10-10.md). Bunlar planlanan özelliklerdir.

İlk adımın seçilmiş/varsayılan/açık kararları: [Geliştirme kararları](docs/implementation-decisions.md).

1. [Mimari ve teknoloji kararları](docs/architecture.md)
2. [Ürün kuralları ve podyum durum makinesi](docs/product-rules.md)
3. [Veri modeli ve DB/servis sorumlulukları](docs/data-model.md)
4. [REST ve canlı bağlantı sözleşmesi](docs/api-contract.md)
5. [Geliştirme aşamaları ve kabul koşulları](docs/delivery-plan.md)

## Kod düzeni

```text
src/
  common/                  ortak teknik altyapı (outbox: olay kuyruğu işçisi)
  database/                DatabaseModule ve PrismaService
  generated/prisma/        otomatik üretilen Prisma istemcisi
  modules/
    auth/                  giriş, guard, decorator, strategy
    users/                 profil ve stil
    social/                arkadaşlık ve engelleme
    media/                 fotoğraf hattı
    polls/                 kombin oylaması ve etkileşim
    moderation/            şikâyet kaydı
    feed/                  organik ana akış
    games/                 günlük podyum ve QR lobileri
    notifications/         bildirimler
    rewards/               profil puanı
    health/                çalışan ilk modül
  app.module.ts
  create-app.ts            ortak HTTP ve Swagger ayarları
  main.ts
prisma/                    şema, migration ve seed
scripts/                   geliştirme ve doğrulama komutları
tests/
```

Bu rehberdeki yollar ve komutlar `Podyum/backend/` klasörüne göredir; önce `cd backend` çalıştırın. Projenin genel düzeni ve kökten çalıştırma komutları: [Podyum rehberi](../README.md). Her özellik kendi module/controller/service/dto dosyalarını taşır. `common` iş kurallarının toplandığı bir klasör değildir; auth'a özgü guard/decorator'lar `modules/auth` altında kalır. Ayrıntı: [modül sınırları](src/modules/README.md).

Onaylı ürün kuralları: normal oy tercihtir ve çoğunluğu seçme ödülü yoktur; arkadaş paylaşımı sadece arkadaşlara görünür; podyum ortak temaya fotoğraf hazırlayıp birbirini değerlendirme oyunudur. Profil puanı formülü henüz seçilmedi; otomatik ödül kapalıdır. Diğer öneriler belgelerde ayrıca işaretlendi.

## Yerel kurulum

Node.js 24.11+ ve npm gerekir. Prisma CLI, Client ve PostgreSQL adapter birlikte `7.10.0` sürümüne sabittir. Bu makinede kurulum ve demo verileri hazırlanmıştır.

Yeni kurulumda:

```bash
npm ci
cp .env.example .env
npm run db:start
npm run db:generate
npm run db:deploy
npm run db:seed
npm run db:check
```

`.env` zaten varsa üzerine kopyalamayın; bağlantı portlarını kontrol edin. `db:start` yalnızca bu projeye ait `kombin-proje2` sunucusunu 51221 (servis), 51222 (DB), 51223 (shadow DB) portlarında çalıştırır. Port doluysa başka sunucuyu durdurmayın; komut ve `.env` portlarını birlikte değiştirin ve bağlantıyı doğrulayın. Sunucunun bastığı bağlantı adresi `.env` ile eşleşmelidir.

Yerel Prisma Postgres, PGlite üzerinde çalışır; Docker gerektirmez. Veriler Prisma'nın yerel instance alanında saklanır; proje klasöründeki `.env` bağlantı ayarıdır. Instance silme verileri de siler. Tek bağlantı sınırı nedeniyle bu ortam eşzamanlı oyun/DB kilit testi için kullanılmaz. [Resmi yerel geliştirme belgesi](https://www.prisma.io/docs/local-development/postgres)

## Günlük kullanım

```bash
npm run db:start
npm run db:studio
```

Studio tarayıcıdan tablo/kayıt incelemek içindir. Terminalde gösterdiği yerel adresi açın. Başka bir terminalde kontroller:

```bash
npm run db:validate
npm run typecheck
npm run test:db
npm run test:api
npm run db:check
```

NestJS uygulamasını başlatmak için `npm start` kullanın; önce Prisma istemcisini üretir ve TypeScript'i derler. Varsayılan adres `http://127.0.0.1:3000`; port doluysa `PORT=3100 npm start` ile ayrı port seçin. Health, `/v1/auth/*`, profil/ayar, sosyal, medya/avatar ve oylama oluşturma/detay/kendi liste/tercih/sonuç ve organik akış endpoint'leri çalışır. Açılışta ortam ve hedef DB doğrulanır; kapanışta Prisma bağlantısı bırakılır.

Yerel fotoğraflar `.local/media` altında, HTTP'den doğrudan açılmayan özel dosyalardır; `LOCAL_MEDIA_DIR` ile ayrı dizin seçilebilir. `npm run test:media` fotoğraf hattını kontrol eder; `npm run media:cleanup` süresi dolan/boşta dosyaları temizler. Otomatik cron henüz yoktur.

Swagger `http://127.0.0.1:3000/v1/docs`, OpenAPI `/v1/openapi.json` adresindedir. [Örnek HTTP istekleri](examples/auth.http) ile kayıt/giriş denenebilir. Doğrulama/reset mesajları `.local/mailbox` altında oluşur. Google/Apple mock için `.env` dosyasında `AUTH_MOCK_ENABLED="true"` gerekir; varsayılan kapalıdır.

`npm run test:smoke` uygulamayı geçici boş portta açıp gerçek HTTP/DB sağlık akışını kontrol eder ve kendi açtığı süreci kapatır. Başka çalışan sunucuları durdurmaz.

`db:seed` tekrar çalıştırılabilir: 3 demo profil, 2 oylama, 1 arkadaşlık ve 1 bekleyen oda oluşturur. Görsel dosyası içermez; medya kayıtları demo yer tutucularıdır. Tekrar seed mevcut oylamanın süresini veya oyun durumunu sıfırlamaz.

`db:stop` yalnızca `kombin-proje2` instance'ını durdurur; Prisma onay isteyebilir. Veriyi silmek için `dev rm` veya migrate reset kullanmak günlük iş akışının parçası değildir.

## Şemayı değiştirme

**Düzenlenecek kaynak:** [prisma/schema.prisma](prisma/schema.prisma). `src/generated/prisma/` altındaki `User.ts` gibi dosyalar otomatik üretilir; doğrudan düzenlenmez.

```bash
npm run db:format
npm run db:validate
npm run db:migrate -- --name degisikligin_adi
npm run db:generate
npm run typecheck
npm run test:db
```

Geliştirme migration'ı için shadow DB bağlantısı `.env` içinde bulunur. Ana DB ve shadow DB aynı hedef olamaz. Migration, seed ve DB testleri yerel hedefi ve proje geçmişini kontrol eder; başka projeye ait DB'de durur. Bu korumayı atlamak için doğrudan Prisma CLI kullanmayın.

CHECK kısıtları ikinci migration'dadır; `db push` bunların yerine geçmez. Sahiplik işareti üçüncü migration'dadır. `db:deploy`, depodaki mevcut migration'ları uygular; yeni migration üretmez. Uzak/üretim DB komutları bu yerel başlangıç projesinde kapalıdır.

## Gerçek PostgreSQL alternatifi

Docker kurulu olduğunda `compose.yaml` ile çok bağlantılı PostgreSQL açılabilir:

```bash
docker compose up -d postgres
```

Bu ortam için `.env` içindeki `DATABASE_URL`:

```dotenv
DATABASE_URL="postgresql://kombin:local_kombin_only@127.0.0.1:54329/kombin?sslmode=disable"
```

`SHADOW_DATABASE_URL` satırını kaldırın; yerel container kullanıcısı geliştirme migration'ı için ayrı shadow DB oluşturabilir. Sonra `db:deploy`, `db:generate`, `db:seed` çalıştırın. Bu alternatif bu makinede Docker bulunmadığından denenmedi. PostgreSQL 18 volume yolu compose dosyasında tanımlıdır. Yalnızca geliştirme şifresidir.

## Doğrulananlar ve sınırlar

Prisma validation/client üretimi, TypeScript kontrolü, migration uygulaması, tekrar çalışabilen seed, 14 DB testi ve 148 auth/profil/sosyal/medya/oylama/akış/etkileşim/bildirim/oyun HTTP testi yerelde kontrol edilir. DB testleri rollback kullanır; HTTP testleri yalnızca kendi benzersiz test hesaplarını ve geçici posta kutularını temizler. Demo verileri silinmez.

DB testleri tek oy, doğru seçenek FK'sı, arkadaşlık çifti, süre alanı, seçenek sınırı, kendine yıldız, yıldız aralığı, oda üyeliği, tur sahibi, tek aktif oyun ve ödül tekilliğini kapsar. Auth HTTP testleri kayıt/doğrulama/giriş, token dönüşümü/tekrar kullanımı, çıkış, reset, hesap durumu, mock kapatma, hata/limit ve Swagger davranışlarını kapsar. Profil testleri özel alan ayrımı, kurulum, atomik stil/isim güncellemesi, izin/olay kaydı, ayarlar, görünür sayaçlar ve iki yönlü engeli kapsar; yalnız bunlar için `npm run test:users`. Oylama/oyun yetkileri ve çok bağlantılı yarış testleri ilgili adımlarda yapılacak.

Sosyal testler kullanıcı arama, çift/ters istek, alıcı/gönderen yetkisi, kabul/red/iptal tekrarı, arkadaşlıktan çıkarma, iki yönlü engel, özel yayın erişimi, cursor ve olay hatasında rollback'i kapsar; yalnız bunlar için `npm run test:social`. Medya testleri gerçek dosya işleme/blur/erişim/temizliği, `npm run test:polls` ise 19 taslak/yayın/tekrar/sürüm/erişim/kota/rollback ve gerçek fotoğraf→akış→tercih→sonuç testini çalıştırır. `test:api` auth, profil, sosyal, medya, oylama, akış, etkileşim, bildirim ve oyun testlerini birlikte çalıştırır (148 HTTP testi; 15 tercih/kapanış/izin, 15 akış, 16 etkileşim, 13 bildirim ve 24 oyun testi dahil). `npm run test:feed` 15 akış testini, `npm run test:interactions` 16 kaydetme/yorum/neden/şikâyet testini, `npm run test:notifications` 13 bildirim/cihaz/olay kuyruğu testini çalıştırır. Medya, oylama detay, tercih, sonuç ve akış uçları ortak sosyal erişim servisine bağlıdır. Olay kuyruğu API açılışında ve varsayılan 3 saniyede bir işlenir; `OUTBOX_WORKER_ENABLED=false` kapatır (kapalıyken bildirim oluşmaz). Kapanış API açılışında ve varsayılan 15 saniyede bir taranır; `POLL_CLOSE_WORKER_ENABLED=false` kapatır. Elle `npm run polls:close -- <poll-uuid>` ile yalnız hedef kaydın süresini denetleyebilirsin; son süreden önce kapatmaz.

Bağımlılıklarda `deepmerge-ts` ve `mysql2` overrides, Prisma araç zincirindeki bildirilen açıkların düzeltilmiş sürümlerini kullanır; kurulum/config/migration/generate kontrolleriyle doğrulanır. Sürüm yükseltirken bu pin'leri ve `npm audit` sonucunu birlikte gözden geçirin.
