# Arkadaşın Claude'una verilecek güncel görev

Aşağıdaki metin eski oyun görevinin yerine geçer. Projenin güncel main dalı alınarak kullanılmalıdır.

```text
Podyum adlı kombin uygulamasının backend'ini iki kişi geliştiriyoruz.
Sen ürün/trend/gelir kolundan sorumlusun. Günlük 30+30 podyum ve QR lobisi
aktif backend kapsamına geri alındı; games ve canlı durumun sahibi diğer geliştirici.
docs/game-design.md güncel kaynaktır. Sen games/Socket.IO/matchmaking/lig geliştirme.

Önce varsa AGENTS.md, ardından README.md, docs/backend-roadmap.md,
docs/two-developer-plan.md, docs/mentor-notes-2026-10-10.md,
docs/implementation-decisions.md, docs/api-contract.md,
docs/auth-development.md, docs/users-development.md ve prisma/schema.prisma dosyalarını incele.
Bu belgelerde onaylı kararlar ve henüz seçilmemiş kurallar ayrılıyor.

Mevcut proje NestJS + TypeScript, PostgreSQL + Prisma. Health, ortak
API altyapısı, auth, temel profil/ayarlar, sosyal ve yerel medya/avatar çalışıyor.
Oylama taslak/düzenleme/yayın/iptal/silme/detay/kendi liste ve kalıcı işlem tekrarı da hazır;
tek tercih/sonuç/kalıcı kapanış da hazır, ana akış henüz yok.
Onuncu migration PollVote izin tarihi/revision ekler; docs/poll-votes-development.md
oy olayı ve izin geri alma/trend katkısı sözleşmesidir. Trendleri OPTION_PREFERENCE
olayından üret, özel oyu genel trende katma, geri alınan iznin eski katkısını kaldır. Ürün etiketleri USER_ENTERED, productId henüz yok.
Dokuzuncu migration ProductTag.priceRecordedAt ekler (fiyat beyanının sunucu zamanı,
eski veride null); ortak şema önerisinde alanı ve özgün linki koru.
docs/polls-development.md sözleşmesini incele. E-posta/şifre ve opaque oturumlar
gerçek yerel akış; e-posta teslimi dosya, Google/Apple mock.
Yeni ürün/trend/billing/ads servisleri henüz uygulanmış değil.

Diğer geliştirici şunları yapıyor:
- Auth ve ortak API/DB/idempotency/outbox altyapısı.
- Kullanıcı profili/ayarları, özel bilgiler ve izinler.
- Arkadaşlık/engel, medya yükleme/işleme/blur.
- Oylama/seçenek/ürün etiketleri, tercih/sonuç/akış.
- Yorum/kaydetme/bildirim ve genel moderasyon/hesap yaşam döngüsü.

Senin modüllerin sırayla:
1. catalog: ortak ürün kimliği, mağaza/link eşleştirme.
2. trends: günlük/haftalık/aylık trendler; tercih yapanların
   cinsiyet/yaş ve ürün fiyat aralığı filtreleri.
3. billing: Plus, affiliate ticari kullanım hakkı ve seçilen kotalar.
4. ads: kampanya/reklam seçimi, gösterim/tıklama ölçümü.

İlk teslimi yalnızca KATALOG olarak tut:
- Ortak ürün modeli ile mevcut seçenek başına ProductTag'in ayrımını yaz.
- Ürün/mağaza kimliği ve gerekli şema değişikliğini küçük bir taslak
  olarak hazırla; ortak şema entegrasyonunu diğer geliştirici koordine ediyor.
- src/modules/catalog altında module/controller/service/dto düzeninde ilerle.
- Ürün liste/detay ve URL/manuel bilgiyle çözümleme API'lerini tasarla.
  Önerilen yollar GET /products, GET /products/:id, POST /products/resolve.
- Eşleşti/belirsiz/eşleşmedi durumları olsun. İsim eşitliğini kesin
  ürün kimliği sayma; desteklenmeyen linkte manuel fallback sağla.
- Ürün ana kimliği ile kullanıcının özgün/affiliate linkini ayır.
  Affiliate parametrelerini temizleyerek kişinin yönlendirmesini bozma.
- Fiyat, para birimi ve fiyatın zaman/kaynak bağlamını ele al.
- İlk teslimde kullanıcı mevcut ürünü çözümler veya eşleşmedi/belirsiz
  sonucuyla manuel bilgi girer. Kullanıcı girdisi doğrulanmış ortak
  ürün kaydını oluşturma, üzerine yazma veya birleştirme yetkisi vermez.
- Manuel seçim/düzeltme kişinin kendi taslak ürün etiketine ve seçtiği
  eşleşmeye aittir; ProductTag kaydını diğer geliştiricinin oylama modülü yönetir.
  Fiyat da etiketin zaman/para birimi bağlamındadır; ortak ürün fiyatını ezmez.
- Önerilen ürün bilgisini eşleşmedi yanıtında taşıyabilirsin; ilk teslim
  için ayrı bir öneri tablosu zorunlu değil. Kalıcı öneri kaydı gerekiyorsa
  doğrulanmış katalogdan ayrı durum/kaynak olarak model taslağında belirt.
- Ortak ürün düzeltme/birleştirme ve admin endpoint'leri ilk teslimin
  dışında. Ortak yönetici yetkisini diğer geliştirici 16. adımda sağlar;
  ihtiyacı not et, kendi rol sistemi veya geçici açık admin yolu kurma.
- Mevcut CurrentUser/AuthGuard, PrismaService, ApiError,
  validation, pagination ve Swagger altyapısını kullan.
- Tekrar çözümleme, belirsiz ürün, affiliate linkin korunması,
  kullanıcı verisinin ortak kaydı değiştirmemesi, yetkisiz erişim ve
  bozuk DTO gibi anlamlı davranışları test et. Admin düzeltme testi ilk teslimde yok.

Ortak Product modelinin ve ProductTag bağlantısının erken birleşmesi
gerekiyor; tüm katalog modülünün bitmesini beklemeden bu küçük
şema/sözleşme teslimini paylaş. O sırada resolver ve test verilerini
geliştirebilirsin. Gerçek DB entegrasyonu yapılmadıysa tamamlandı deme.

Dosya sınırları:
- Kendi kodun catalog/trends/billing/ads ve ilgili ayrı test/örnek dosyalarında.
- Diğer geliştiricinin modüllerini yeniden yazma; kendi auth/sosyal/medya
  veya push altyapını oluşturma.
- prisma/schema.prisma, migrations, common, database, app.module.ts,
  package.json/lock ve ana plan dosyalarının ortak entegrasyonu
  diğer geliştiricide. İhtiyaçlarını küçük ayrı taslak/commit olarak belirt;
  aynı ortak dosyada habersiz paralel düzenleme yapma.
- generated Prisma dosyalarını elle düzenleme. Migration geçmişini
  değiştirme, DB resetleme ve hedef DB korumasını atlama.

Katalog sonrası trend hesabını, birlikte tanımlanan sürümlü tercih
sözleşmesine uygun sentetik fixture'larla geliştirebilirsin. Gerçek
tercih olayını diğer geliştirici oy transaction'ı/outbox ile sağlayacak.
Oylama tablolarına yazma. Aynı olayın tekrarını tekilleştir; izin geri
alma ve içerik kaldırma katkılarını çıkarma davranışını planla.
İlk mevcut izin/demografi kaynağı user.analytics-preferences.changed
outbox olayıdır; kullanıcı başına analyticsRevision taşır. Payload ve
henüz olmayan işçi sınırını users-development rehberinden oku.

Bir kombinin seçilmesi içindeki bütün ürünlere ayrı ayrı oy verilmesi
değildir; satış/satın alma da değildir. Ölçüm türlerini ayır.
FRIENDS içeriklerini genel trendlere sessizce katma. Demografik filtre
ürünü paylaşanı değil tercih yapanları anlatır; yalnızca izinli, yeterli
örneklemli toplu sonuç dön. Özel kullanıcı alanlarını API'ye açma.

Plus/affiliate fiyatı, paket ilişkisi, trend sıralama formülü, dönem
sınırları, filtrelerin ücretli olması ve reklam sıklığı henüz seçilmedi.
Yaklaşık 10 kart sonrası reklam bir örnektir, kesin sabit kural değil.
Gerçek mağaza anlaşması, otomatik Zara entegrasyonu veya satın alma
doğrulaması varmış gibi davranma. Test fake'leri yalnızca testte olsun;
uygulama açılışında herkese ücretli hak veren fallback kurma.

Kendi branch'in feature/catalog ve kendi yerel DB'nle çalış.
Küçük teslimleri PR ile birleştirelim. .env ve token paylaşma.
Yerel Prisma Postgres tek bağlantılı; sıralı testleri gerçek eşzamanlılık
testi gibi raporlama. README kurulumunu ve mevcut kontrolleri kullan.

Önce ilk katalog tesliminin kısa kapsamını ve gereken ortak
model/sözleşme değişikliğini yaz, ardından bu kapsamda geliştirmeye başla.
Teslimde endpoint örnekleri, testler, ortak dosya ihtiyaçları ve
tamamlanmamış gerçek entegrasyonları açıkça belirt.
```
