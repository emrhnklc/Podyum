# Kombin uygulaması — backend temeli

Kombin tercihi oylamaları ve fotoğraflarla oynanan canlı tema yarışması için mimari taslak ve çalışan yerel veritabanı temeli.

**Hazır:** Ortak API doğrulama/hata/request ID/Swagger ve kalıcı işlem tekrarı altyapısı; e-posta/şifre kaydı, doğrulama, giriş, yenileme, çıkış ve şifre sıfırlama; Google/Apple geliştirme mock'u; profil/stiller/özel bilgiler/analiz izni ve ayarlar; kullanıcı arama, arkadaşlık/engel ve ortak erişim servisi; yerel özel fotoğraf yükleme/işleme/önizleme, manuel bölge bulanıklaştırma ve avatar; oylama taslağı/düzenleme/yayın/iptal/silme, elle ürün etiketleri, detay ve kendi liste uçları; health endpoint'leri; Prisma şeması (32 model), dokuz migration, demo seed ve DB hedef koruması. **Planlanan:** Tercih oyu/sonuç/akış/yorum/kaydetme, katalog eşleştirme, ticari modüller, Faz 2 oyun API'leri, otomatik yüz tespiti/bulut medya deposu, gerçek OAuth/e-posta gönderimi, Socket.IO ve push.

E-posta teslimi şimdilik yerel dosyadır. Gerçek Google/Apple girişi tamamlanmadı. Çalışan akış: [Auth geliştirme rehberi](docs/auth-development.md).

Çalışan profil/ayar uçları: [Profil rehberi](docs/users-development.md), [HTTP örnekleri](examples/users.http). Sosyal API: [Sosyal rehber](docs/social-development.md), [HTTP örnekleri](examples/social.http). Fotoğraf/avatar: [Medya rehberi](docs/media-development.md), [HTTP örnekleri](examples/media.http). Oylama oluşturma: [Oylama rehberi](docs/polls-development.md), [HTTP örnekleri](examples/polls.http). Sonraki bizim işimiz tercih oyu/kapanış/sonuç; arkadaş katalogla paralel ilerleyebilir. Otomatik yüz tespiti henüz bağlı değildir.

## Belgeleri okuma sırası

Adım adım geliştirmede takip edeceğimiz ana iş listesi: [Backend çalışma planı](docs/backend-roadmap.md).

İki kişinin görevleri ve entegrasyon sınırları: [İki kişilik çalışma planı](docs/two-developer-plan.md). Biz kullanıcı/sosyal/medya/oylama, arkadaş ürün kataloğu/trend/Plus/affiliate/reklam kolunu geliştirir. Başlangıç: biz profil, arkadaş katalog. [Arkadaşın Claude'una verilecek güncel görev](docs/friend-claude-task.md).

**10 Ekim öncelik güncellemesi:** İlk sürüm sosyal kombin, ürün trendleri ve affiliate/reklam/Plus gelir özelliklerine odaklanır. Oyun/podyum **Faz 2**'ye ertelendi. Yeni fikirler, açık kararlar ve yapılacaklar: [Mentör görüşmesi notu](docs/mentor-notes-2026-10-10.md). Bunlar planlanan özelliklerdir.

İlk adımın seçilmiş/varsayılan/açık kararları: [Geliştirme kararları](docs/implementation-decisions.md).

1. [Mimari ve teknoloji kararları](docs/architecture.md)
2. [Ürün kuralları ve podyum durum makinesi](docs/product-rules.md)
3. [Veri modeli ve DB/servis sorumlulukları](docs/data-model.md)
4. [REST ve canlı bağlantı sözleşmesi](docs/api-contract.md)
5. [Geliştirme aşamaları ve kabul koşulları](docs/delivery-plan.md)

## Kod düzeni

```text
src/
  common/                  ortak teknik altyapı
  database/                DatabaseModule ve PrismaService
  generated/prisma/        otomatik üretilen Prisma istemcisi
  modules/
    auth/                  giriş, guard, decorator, strategy
    users/                 profil ve stil
    social/                arkadaşlık ve engelleme
    media/                 fotoğraf hattı
    polls/                 kombin oylaması ve etkileşim
    games/                 canlı podyum
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

Mevcut proje kökü backend köküdür. Her özellik kendi module/controller/service/dto dosyalarını taşır. `common` iş kurallarının toplandığı bir klasör değildir; auth'a özgü guard/decorator'lar `modules/auth` altında kalır. Ayrıntı: [modül sınırları](src/modules/README.md).

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

NestJS uygulamasını başlatmak için `npm start` kullanın; önce Prisma istemcisini üretir ve TypeScript'i derler. Varsayılan adres `http://127.0.0.1:3000`; port doluysa `PORT=3100 npm start` ile ayrı port seçin. Health, `/v1/auth/*`, profil/ayar, sosyal, medya/avatar ve oylama oluşturma/detay/kendi liste endpoint'leri çalışır. Açılışta ortam ve hedef DB doğrulanır; kapanışta Prisma bağlantısı bırakılır.

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

Prisma validation/client üretimi, TypeScript kontrolü, migration uygulaması, tekrar çalışabilen seed, 13 DB testi ve auth/ortak API HTTP testleri yerelde kontrol edilir. DB testleri rollback kullanır; HTTP testleri yalnızca kendi benzersiz test hesaplarını ve geçici posta kutularını temizler. Demo verileri silinmez.

DB testleri tek oy, doğru seçenek FK'sı, arkadaşlık çifti, süre alanı, seçenek sınırı, kendine yıldız, yıldız aralığı, oda üyeliği, tur sahibi, tek aktif oyun ve ödül tekilliğini kapsar. Auth HTTP testleri kayıt/doğrulama/giriş, token dönüşümü/tekrar kullanımı, çıkış, reset, hesap durumu, mock kapatma, hata/limit ve Swagger davranışlarını kapsar. Profil testleri özel alan ayrımı, kurulum, atomik stil/isim güncellemesi, izin/olay kaydı, ayarlar, görünür sayaçlar ve iki yönlü engeli kapsar; yalnız bunlar için `npm run test:users`. Oylama/oyun yetkileri ve çok bağlantılı yarış testleri ilgili adımlarda yapılacak.

Sosyal testler kullanıcı arama, çift/ters istek, alıcı/gönderen yetkisi, kabul/red/iptal tekrarı, arkadaşlıktan çıkarma, iki yönlü engel, özel yayın erişimi, cursor ve olay hatasında rollback'i kapsar; yalnız bunlar için `npm run test:social`. Medya testleri gerçek dosya işleme/blur/erişim/temizliği, `npm run test:polls` ise 18 taslak/yayın/tekrar/sürüm/erişim/kota/rollback testini çalıştırır. `test:api` auth, profil, sosyal, medya ve oylama oluşturmayı birlikte çalıştırır (64 HTTP testi). Medya ve oylama detay uçları ortak sosyal erişim servisine bağlıdır.

Bağımlılıklarda `deepmerge-ts` ve `mysql2` overrides, Prisma araç zincirindeki bildirilen açıkların düzeltilmiş sürümlerini kullanır; kurulum/config/migration/generate kontrolleriyle doğrulanır. Sürüm yükseltirken bu pin'leri ve `npm audit` sonucunu birlikte gözden geçirin.
