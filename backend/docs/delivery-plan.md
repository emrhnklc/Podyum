# Geliştirme sırası ve kabul koşulları

Günlük uygulama sırası ve tüm ekran özelliklerini kapsayan ayrıntılı iş listesi [Backend çalışma planı](backend-roadmap.md) belgesindedir. Bu belge aşama ve doğrulama ölçütlerini destekler.

Adım kimlikleri korunur: 19–20 günlük podyum/QR lobi ve canlı durum artık aktif ilk teslimdir; 21–23 genişleme adaylarıdır. Buradaki aşamalar ayrıntılı adımları gruplar. [İki kişilik planda](two-developer-plan.md) biz kullanıcı/kombin, arkadaş katalog/trend/gelir kolunu paralel geliştirir; profil ve katalog aynı anda başlayabilir.

Bu plan iş sırasını verir; ekip büyüklüğü ve çalışma süresi bilinmediğinden takvim veya bütçe tahmini değildir. Her aşamada mobilin kullanabileceği bir akış tamamlanır. **Son kullanıcı kararıyla günlük podyum ve QR lobileri ilk teslim kapsamına geri alındı.** Sosyal kombin, oyun, trend ve gelir kolu birlikte doğrulanıp frontend’e teslim edilir. [Yeni oyun tasarımı](game-design.md). [Görüşme notu](mentor-notes-2026-10-10.md).

## Aşama 0 — mimari ve yerel veri temeli

**Bu depoda hazır:** NestJS bootstrap ve health modülü; common/database/modules düzeni; Prisma/PostgreSQL şeması; ilk tablolar, bütünlük kısıtları ve proje sahiplik işareti migration'ları; demo seed; DB istemcisi; hedef DB koruması; ilişkisel bütünlük testleri; mimari, oyun kuralları ve API taslağı.

API sunucusu sağlık endpoint'leri, ortak HTTP/idempotency altyapısı, Swagger, auth, users, social, media ve polls oluşturma uçlarıyla açılır. E-posta/şifre kaydı/girişi, doğrulama/reset, oturum dönüşümü ve çıkış çalışır; e-posta taşıyıcısı yerel dosya, Google/Apple mock'tur. Profil/stil, özel bilgiler/analiz izni/ayarlar, kullanıcı arama/arkadaşlık/engel, yerel fotoğraf/manuel blur/önizleme/avatar ve manuel ürün etiketleriyle taslak/yayın/iptal/silme/detay/kendi liste de çalışır. Tercih/sonuç/kalıcı kapanış/izinli snapshot da hazır. Akış/yorum/kaydetme, katalog eşleştirme, oyun, gerçek OAuth/e-posta, otomatik yüz tespiti/bulut medya/ayrı işçi ve bildirim gönderimi henüz yoktur.

10 Ekim 2026 başlangıç doğrulaması: üç temel migration, Prisma validate/generate, TypeScript, 13 DB testi, tekrar seed ve DB hedef koruması doğrulandı. Auth adımında dört yeni model ve profil kurulum alanı iki ek migration'la eklendi. Profil adımında UserSettings ve analiz tercih sürümü altıncı, sosyal adımda User.socialRevision yedinci, medya/avatar alanları sekizinci, ProductTag fiyat beyan zamanı dokuzuncu, PollVote izin tarihi/revision onuncu migration’la eklendi. Güncel kontroller: `npm run typecheck`, `npm run test:api` (95 HTTP), `npm run test:polls` (19), `npm run test:db` (14), `npm run test:votes` (15), `npm run test:smoke`, `npm run db:check`. Docker/gerçek çok bağlantılı PostgreSQL testleri yapılmadı. [Oylama teslimi ve kalan entegrasyon](polls-development.md), [organik ana akış teslimi](feed-development.md).

## Aşama 1 — kullanıcı, arkadaşlık ve fotoğraf

1. Hazır NestJS bootstrap/health temelini config doğrulama, hata formatı, request ID, DTO validation ve OpenAPI ile genişletme.
2. Giriş sağlayıcısı ve minimum yaş politikası seçimi; doğrulanmış kimliğin yerel hesaba bağlanması.
3. Profil/stil etiketleri; karşılıklı arkadaş isteği/kabul/red ve engel.
4. Özel medya deposu, upload intent/complete, boyut/tür/EXIF işlemleri, önizleme.
5. Yüz bulanıklaştırma ayrı iş olarak; başarısızsa yayınlanmayan, önizlemesi kabul edilen akış.

**Kabul:** İki hesap arkadaş olabilir; üçüncü hesap özel içeriğin metadata veya fotoğrafına erişemez. Engel ve arkadaşlık kaldırma sonraki istekleri kapatır. Başkasının asset ID'si paylaşımda kullanılamaz. Aynı dış kimlikle iki yerel profil oluşmaz. Yükleme URL'si tekrar kullanılarak yayınlanan dosya değiştirilemez.

## Aşama 2 — tam kombin oylaması

1. Taslak oluştur/düzenle/yayınla; 2–4 seçenek ve ürün bağlantıları.
2. Herkes/arkadaşlar akışı; kategori ve cursor sayfalama.
3. Tercih oyu ve anlık/kesin sonuçlar; kapanış işi ve süre tarayıcısı.
4. Yorum, yorumları kapatma, kişisel kaydetme.
5. Outbox, uygulama içi bildirim; push ikinci taşıma olarak.
6. Şikâyet ve yönetim denetim modelleri; hesap silme iş akışı.

**Kabul:** Mobilde paylaş → başka hesap oy versin → sonucu gör akışı tamamlanır. Normal tercih profil puanı üretmez. Oy verme/kapanış eşzamanlı olduğunda süre sonrası oy kabul edilmez. Oylama ID'si veya medya yolu değiştirilerek arkadaş içeriğine erişilemez. Yinelenen istek tek oy/yorum/bildirim üretir. Bir oylamada başka oylamanın seçeneği kullanılamaz.

## Aşama 3 — ürün kimliği ve trendler (Faz 1)

1. Ürün etiketlerini ortak ürün kimliğine bağlama; özgün/affiliate linkini ayrı koruma. Bu hazırlık oylama geliştirilirken başlar.
2. Link/isim çözümleme, belirsiz eşleşmeler, varyant ve fiyat zamanı/para birimi.
3. Günlük/haftalık/aylık trend ölçümü; seçilen kombinlerdeki ürünler ile doğrudan ürün tercihinin ayrımı.
4. Tercih yapanların cinsiyet/yaş ve ürün fiyat aralığı filtreleri; izin ve yeterli örneklem.
5. Tekil ölçüm, kaldırma/düzeltme, güncelleme ve boş/yetersiz veri durumları.

**Kabul:** Aynı ürün farklı paylaşımlarda doğru birleştirilir; aynı isimli farklı ürün zorla birleştirilmez. Dönem/filtre doğru örneklemi döndürür; özel içerik genel trendlerden sızmaz. Kombin tercihi satış veya bağımsız ürün oyu gibi sunulmaz.

## Aşama 4 — affiliate, reklam ve Plus (Faz 1)

1. Affiliate kullanan üretici için ücretli hakkın paketi/uygunluğu/limitleri; normal linkten ayrım.
2. Reklamsız Plus, önceki hedefleme/sonuç hakları ve sunucuda doğrulanmış abonelik olayları.
3. Akış reklamları: kampanya, açık sponsorlu işareti, yapılandırılabilir sıklık ve reklamsız hak kontrolü.
4. Gösterim/tıklama ölçümü ve izinli toplu rapor; organik trendden ayrı tutma.
5. Yönetim, hesap yaşam döngüsü, gerçek PostgreSQL kontrolleri ve Faz 1 frontend teslimi.

**Kabul:** Aynı abonelik/ölçüm olayı ikinci kayıt üretmez; Plus aktifken reklam sunulmaz. Affiliate ticari kullanım hakkı sunucuda kontrol edilir. Trend filtrelerinin ücretli olup olmadığı ayrıca seçilir. Mağaza talebi/komisyon/satış varsayımla üretilmez. Yaklaşık 10 kartlık reklam sıklığı kesinleşmiş kural değildir.

## Aktif oyun teslimi — günlük etkinlik ve QR lobisi (19–20)

1. Genel etkinliği seçilecek günlük saat/saat diliminde tekil oluştur: 30 dk fotoğraf + 30 dk oylama. Yalnız o etkinliğe katılanlar oy verir.
2. Hostun oluşturduğu özel lobide ayrı fotoğraf/oy süreleri; QR davet bağlantısı üret/yenile/iptal ve güvenilir katılım.
3. Kendi hazır/onaylı fotoğraf teslimi; süre veya hostun erken bitirme komutuyla teslimi kapatıp oylamaya tek kez geçiş.
4. Sayfalı/dengeli değerlendirme, son süre/kendine oy yasağı, kimlik gizleme ve sonuç/geçmiş.
5. İşçi ve DB’den kesinti toparlanması; yetkili Socket bildirimleri/REST state, host bağlantısından bağımsız süre.
6. Ödül/lig/matchmaking’i zorunlu kılmadan oyun dahil yönetim, gerçek PostgreSQL ve frontend kabulü.

**Kabul:** 30+30 sınırında veya özel host/zamanlayıcı yarışında geç teslim/oy ve çift geçiş olmaz. QR yenilenince eski davet katılım sağlamaz; üçüncü kişi etkinlik üyeliği olmadan oy veremez. API yeniden başlasa da günlük etkinlik/oy/sonuç çoğalmaz. Eski 600/30/20 saniyelik tur ve 3–8 kişi önerisi uygulanmaz. [Açık kararlar ve şema ihtiyacı](game-design.md).

## Faz 2 / Aşama 7 — rekabet ve yarışma ödülleri

- Profil puanı formülü, uygun oyunlar, sezon ve ödül tekrarını engelleme; özel odalardaki puan üretiminin istismar koşulları.
- Haftalık tema: ayrı Challenge/Entry/Vote tabloları ve sonucu kesinleştirme.
- Sponsorlu etkinlik ve ürün ilişkilendirmeleri; mevcut ürün linkleri ödeme sistemi değildir.

**Kabul:** Aynı sonuç işi iki kez çalışınca çift puan çıkmaz. Puan politikası değişikliği eski oyunu sessizce yeniden ödüllendirmez. Sponsorlu yarışma ödülleri tekil dağıtılır. Faz 1 abonelik/hak kontrolleri de korunur.

## Gerçek PostgreSQL'de zorunlu doğruluk testleri

Yerel Prisma Postgres tek bağlantılıdır. Aşağıdaki testler ayrıca gerçek, çok bağlantılı PostgreSQL üzerinde yapılacak:

Günlük etkinlik, QR lobi, faz/host yarışı ve oyun değerlendirmesi ilk teslimde test edilir. Hızlı eşleşme/ödül testleri ilgili genişlemede gelir. Oy/kapanış/erişim/idempotency, abonelik/affiliate hak tüketimi, trend/reklam ölçüm tekilliği de korunur.

| Senaryo | Beklenen |
| --- | --- |
| Aynı kullanıcıdan aynı oylamaya 20 eşzamanlı oy | Bir kalıcı tercih; aynı tercih tekrarları aynı kabul |
| Oy işlemi kilitte beklerken son sürenin geçmesi | Kilit alındıktan sonra DB saati kontrolü, yeni oy reddi |
| Vote / close işi çakışması | Tek tutarlı kapanış; kapanıştan sonra yeni oy yok |
| Son oda yeri için 10 kişi aynı anda katılır | Kapasite aşılmaz; tek aktif oda hakkı korunur |
| İki işçi aynı tur sonunu işler | Tek geçiş; tek sürüm artışı; sonraki tur atlanmaz |
| Commit sonrası olay yayını öncesi işçi ölür | Outbox tekrar işler; sonuç/bildirim/ödül çoğalmaz |
| Redis tamamen temizlenir | DB'den yeniden kurulum; oylar ve üyelikler korunur |
| Tur sırasında API/işçi yeniden başlar | Kısa kesinti için toparlanma; uzun kesintide açıklamalı iptal |
| Arkadaşlık kaldırma / görsel okuma | Sonraki yetkisiz istekte erişim yok; ortak cache sızıntısı yok |
| Aynı idempotency key farklı body ile gelir | 409; ikinci işlem uygulanmaz |

## Yük testi ve işletim

Akış/oy/fotoğraf/katalog/trend/reklam ile günlük etkinlikte aynı anda fotoğraf yükleme, 30. dakikada oylamaya geçiş ve özel lobi bağlantıları ölçülür. Genel etkinlik eski 8 kişi sınırına bağlanmaz; desteklenen kapasite ölçümle seçilir. Reconnect ve süre sınırındaki istek patlamaları ayrıca test edilir.

İzlenecekler: API gecikmesi/hata oranı, DB pool ve kilit beklemeleri, faz geçiş gecikmesi, outbox/kuyruk yaşı, iş tekrarları, upload başarısızlığı, reconnect sayısı, sonuç hesabı süresi. Loglarda token, dosya imzaları, özel fotoğraf ve kişisel demografik alanlar tutulmaz.

Üretim öncesi: ayrı geliştirme/test/üretim ortamları; secrets yönetimi; DB yedekleme ve gerçek geri yükleme denemesi; medya lifecycle/silme; migration deploy prosedürü ve rollback yerine ileri düzeltme planı. Mevcut yerel komutlar uzak veritabanına yazmayı bilinçli olarak reddeder; üretim deploy yolu ayrı tasarlanacak.

## İlk kodlama hedefi

**Kullanıcı + arkadaşlık + fotoğraf + normal oylama için baştan sona çalışan REST API.** Ürün kimliği ve tercih ölçümü bu temel geliştirilirken planlanır; ardından trendler, affiliate/Plus ve reklamlar gelir. Normal tercih/ana akışın ardından günlük etkinlik ve QR lobisi geliştirilir; ilk yönetim/test/frontend teslimine dahil edilir. Sosyal oylamanın erişim ve medya hatları sonraki podyuma da temel olur.
