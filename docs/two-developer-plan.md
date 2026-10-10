# İki kişilik Faz 1 çalışma planı

10 Ekim 2026. Güncel ana sıra: [backend planı](backend-roadmap.md). Oyun/podyum Faz 2'dir; önceki oyun görevi aktif değildir. Bu belge görev ve entegrasyon sözleşmesidir; adı geçen yeni servisler henüz uygulanmış değildir.

## Bölüşüm

**Biz:** Kullanıcının uygulamaya girip profil oluşturduğu, arkadaş eklediği, fotoğrafla kombin paylaştığı ve tercih aldığı akış.

**Arkadaş:** Paylaşımlardaki ürünlerin tanındığı, trendlerin hesaplandığı, ticari link/Plus haklarının ve reklamların yönetildiği kol.

| İş | Ana sahip | Plan adımı |
| --- | --- | --- |
| Ortak altyapı, auth, idempotency/outbox ve entegrasyon | Biz | 1–3 |
| Profil, özel bilgiler, tercihler ve izinler | Biz | 4 |
| Arkadaşlık, engel ve görünürlük | Biz | 5 |
| Medya yükleme/işleme/blur ve yetkili erişim | Biz | 6 |
| Ürün kataloğu, mağaza/ürün kimliği ve link çözümleme | Arkadaş | 7 |
| Oylama, seçenekler ve seçenek başına ürün etiketleri | Biz | 8 |
| Tercih, kapanış, sonuç ve trend veri kaynağı | Biz | 9 |
| Organik akış, yorum/tepki/kaydetme, bildirim | Biz | 10–12 |
| Trend hesabı, filtreleri ve trend API'leri | Arkadaş | 13 |
| Abonelik, haklar, affiliate kullanım hakkı ve hedefleme kotası | Arkadaş | 14 |
| Oylamada kitle uygunluğu ve izinli sonuç kırılımları | Biz; billing hak/kota servisini kullanırız | 14 |
| Kampanya, reklam seçimi ve reklam ölçümü | Arkadaş | 15 |
| Genel yönetici rolü, şikâyet, hesap silme/izin geri alma | Biz | 16 |
| Ürün/kampanya/abonelik yönetim API'leri | Arkadaş; bizim sağlayacağımız ortak yönetici yetkisini kullanır; ilk katalog tesliminde yok | 16 |
| Entegrasyon testi ve frontend teslimi | Birlikte | 17–18 |
| Oyun, eşleşme, lig ve yarışmalar | Faz 2'de yeniden atanacak | 19–23 |

Bu başlangıç dağılımıdır; modül sayısının eşit olması iş yükünün eşit olduğu anlamına gelmez. Tamamlanan küçük teslimlerden sonra kalan yük yeniden paylaşılabilir. Bir modülün sahibi değişirse belgede açıkça güncellenir.

## Dosya sahipliği

- Biz: `src/modules/auth`, `users`, `social`, `media`, `polls`, `notifications`; genel yönetim için ileride `moderation`.
- Arkadaş: ileride `src/modules/catalog`, `trends`, `billing`, `ads`. Bu dört modül şu anda mevcut değil; ilgili iş başladığında açılacak.
- Her geliştirici kendi özelliğinin DTO, test, fixture ve örnek HTTP dosyalarına sahip olur. Ortak `tests/api.test.ts` dosyasına herkes aynı anda ekleme yapmak yerine özellik testleri ayrı dosyalarda tutulur.
- `prisma/schema.prisma`, migration sırası, `src/common`, `src/database`, `src/app.module.ts`, `package.json`, `package-lock.json` ve ana plan belgelerinin entegrasyonunu biz yönetiriz.
- Arkadaş bu ortak dosyalar için gereken değişikliği küçük ve ayrı bir taslak commit/öneri olarak hazırlar. Aynı anda aynı ortak dosyada iki bağımsız düzenleme yapılmaz; entegrasyon sırası birlikte belirlenir. Bunun için bütün bir modülün bitmesi beklenmez.
- Şema tasarlamak arkadaşın da işidir: katalog/trend/billing/ads modellerinin taslağını o hazırlar; ortak şemaya ve migration'a tek koordinatör uygular. İlk ürün modeli erken birleştirilir ki arkadaş gerçek DB API'leriyle devam edebilsin.
- `src/generated/prisma` elle düzenlenmez veya Git'e eklenmez. Var olan migration değiştirilmez, ortak DB resetlenmez.

Başka modülün tablosuna yazmak yerine o modülün sunduğu servis kullanılır. Okuma gereken yerde de bağımlılık belgelenir; arkadaş kendi kodunda arkadaşlık/medya/auth kurallarını kopyalamaz.

## İlk ortak teslim: küçük sözleşme ve ürün modeli

Paralel kodlama öncesinde şu sınırlar kayda girer:

1. Auth mevcut `CurrentUser` ile iç kullanıcı kimliği sağlar; herkes bunu kullanır.
2. Katalog ortak ürünün sahibidir. Bir seçenekteki ProductTag, özgün link, beyan edilen fiyat ve ürüne bağlama oylama modülünün sahibidir.
3. Ürün kimliği/normalizasyon ile affiliate linkinin yönlendirmesi ayrıdır. Katalog, kullanıcının affiliate parametrelerini silip onun yönlendirme linkini değiştirmez.
4. Tercih kaydı ile trend tüketimi arasında sürümlü bir veri sözleşmesi hazırlanır. Demografik verinin hangi izinle ve nasıl taşınacağı ayrıca netleştirilir.
5. Plus rozeti bir istemci kararı değildir; hakları billing hesaplar. Reklamlar bu hakkı kullanır, akış reklam seçme kurallarını yeniden yazmaz.

Profil/ayar adımı şimdi çalışır. İzin/demografi değişikliği için uygulanan ilk kaynak olayı `user.analytics-preferences.changed`, aggregate `user-analytics` ve kullanıcı başına monoton `analyticsRevision`'dır. Tam payload ve henüz olmayan işçi/tüketim sınırı: [profil rehberi](users-development.md). Arkadaş trend entegrasyonunda bu sözleşmeyi kullanır; tercih olayı ayrıca hazırlanacak.

Sosyal adım da çalışır: SocialAccessService ortak profil/yayın görünürlüğü kaynağıdır. Sosyal değişiklikler `social.relationship.changed`, aggregate `user-social` ve kullanıcı başına `socialRevision` taşır; bunlar iç olaylardır ve ham payload bildirim olarak yayınlanmaz. User.socialRevision yedinci migration'la eklenir; yönetici rolü/katalog alanı eklenmedi. [Sosyal rehber](social-development.md).

İlk şema teslimi: arkadaş ortak ürün/mağaza kimliği, belirsiz eşleşme ve fiyat bağlamı için önerisini yazar; biz ProductTag bağlantısıyla birlikte migration'ı sıraya alırız. Şema hazır olana kadar arkadaş URL normalizasyonunu, eşleştirme davranışını ve test fixture'larını geliştirebilir. Ancak gerçek DB entegrasyonunu yapılmış sayamaz.

## Paralel teslimler

| Teslim | Biz | Arkadaş | Birleştirme ölçütü |
| --- | --- | --- | --- |
| 1 | Profil, ayarlar ve sosyal erişim | Ürün modeli önerisi, link eşleştirme ve katalog API'si | Ortak ürün/etiket sözleşmesi + kayıt/girişle korunan ürün API'si |
| 2 | Medya ve oylama taslağı/yayınlama | Katalog doğruluğu; sentetik tercihyle trend hesabı/filtreler | Seçenek–ürün bağlantısı, özgün link ve fiyat bağlamı korunur |
| 3 | Tercih/sonuç/akış ve kalıcı tercih olayı | Trend tüketimi ve gerçek oy verisiyle trendler | Bir oy bir etki üretir; FRIENDS içeriği genel trende katılmaz |
| 4 | Yorum/kaydetme/bildirim ve genel yönetim | Hak/affiliate paketi, kampanya ve reklam API'leri | Reklamsız hak ve affiliate kullanım kontrolü doğru yerde uygulanır |
| 5 | İzin/hesap silme, erişim ve bütün akış doğrulaması | Trend geri hesaplama, hak/ölçüm tekrarları ve modül örnekleri | Faz 1 testleri ve frontend teslim paketi birlikte geçer |

Arkadaşın trend hesabı için bizim gerçek oylamaları bitirmemizi beklemesi gerekmez; önceden belirlenen sözleşmeyle test verisi kullanır. Gerçek trend sonuçlarının doğrulanması ise oylama entegrasyonunu bekler. Paket/sağlayıcı seçimi gecikirse arkadaş testleri ve API sözleşmeleriyle ilerler; sahte satın alma gerçek ücretli hak açmaz.

## Modüller arasındaki sözleşmeler

Aşağıdakiler planlanan sınırlar; kesin TypeScript isimleri ilgili ilk teslimde sürümlenir. Ürün politikası henüz seçilmemiş alanlar varsayımla etkinleştirilmez.

| Sözleşme | Sağlayan → kullanan | Girdi / çıktı ve sorumluluk |
| --- | --- | --- |
| Ürün çözümleme | Katalog → oylama | URL/ad/marka bilgisi → eşleşti/belirsiz/eşleşmedi, varsa productId ve kaynak bilgisi. İsim eşitliği kesin ürün kimliği sayılmaz. |
| Ürün etiketi | Oylama → trend kaynağı | optionId, varsa productId, özgün link, fiyat/para birimi ve zaman bağlamı. Oylama etiketi yönetir; katalog ana ürün kaydını yönetir. |
| Tercih olayı | Oylama → trendler | Sürüm, eventId/voteId, pollId/optionId, kabul zamanı, görünürlük, tekilleştirilmiş ürün/fiyat bağlamı ve ölçüm türü. Gerekli demografik snapshot sadece uygun izinle; ham özel profil açılmaz. |
| İzin/kaldırma/silme değişikliği | Kullanıcı/moderasyon → trendler | Kapsam ve gerekçe; hangi katkıların çıkarılacağı ve yeniden hesaplama. Sonradan izin geri alma olayları kaybolmaz. |
| Kullanıcı hakları | Billing → profil/oylama/reklam | Güvenilir kullanıcı kimliği → reklamsız kullanım, ticari affiliate kullanım ve seçilmiş diğer haklar/süreleri. Mobil body'deki isPlus kabul edilmez. |
| Kota tüketimi | Billing ↔ oylama | Kullanıcı + işlem kimliği + seçilmiş hak → tekil tüketim. Başarısız yayın hak tüketmez; eşzamanlı tüketim kotayı aşmaz. |
| Reklam yerleşimi | Ads → akış | Kullanıcı hakları ve akış konumu/oturum bağlamı → sponsorlu kart veya boş. Yaklaşık 10 kart örneği ayarlanabilir kuraldır. |
| Bildirim isteği | Ticari modüller → notifications | Kaynak olay ve hedef kullanıcı; arkadaş kendi push/cihaz yönetim sistemini kurmaz. |

Tercih olayı yalnızca kabul edilmiş oyun dışı tercihten üretilir. Kaynak oy ve outbox kaydı aynı transaction'da yazılır; trend tüketicisi aynı olayın tekrarını eventId ile tekilleştirir. Bu ortak outbox/teslim altyapısını biz sağlar, arkadaş kendi trend tüketicisini yazar. Teslim sırası/yeniden başlatma/çıkarma olaylarının davranışı birlikte test edilir. İlk trend fixture'ı bu sözleşmeyi taklit eder; uygulama açılışında sahte olay üretilmez.

Kullanıcıya ham voterId, küçük grupların kişisel tercihleri veya özel içerik döndüren bir trend API'si açılmaz. Genel trend için başlangıç önerisi uygun PUBLIC kaynaklardır. Bir kombine oy verildiğinde içindeki ürünler bağımsız ürün oyu/satış gibi adlandırılmaz. Trend formülü, dönem ve eşikler ürün kararı seçilmeden resmi sıralama kuralı gibi sunulmaz.

## Arkadaşın ilk görevi: katalog

İlk iş bütün ticari tarafı bir kerede yapmak değil, küçük bir katalog teslimidir:

- [ ] Ortak Product/mağaza/URL kimliği ihtiyacını ve ProductTag ile sınırını öner.
- [ ] Kendi `catalog` modülünü controller/service/DTO düzeninde kur.
- [ ] Ürün listesi/detayı ve URL veya elle verilen bilgilerle ürün çözümleme sözleşmesini oluştur. Önerilen yollar: `GET /products`, `GET /products/:id`, `POST /products/resolve`; henüz mevcut endpoint değildir.
- [ ] Desteklenmeyen mağaza veya belirsiz isimde açık sonuç dön; manuel bilgi girişini ele al. Her linki otomatik tarayabileceğini varsayma.
- [ ] Kullanıcının mevcut ürünü çözümlemesini veya belirsiz/eşleşmedi sonucuna manuel bilgi eklemesini sağla. Kullanıcı girdisi ortak doğrulanmış ürünü değiştiremez, birleştiremez veya doğrulanmış hale getiremez; kaynağı korunur.
- [ ] Manuel düzeltmenin kişinin kendi taslak ürün etiketine/eşleşmesine ait olduğunu belirt. ProductTag ve kullanıcı beyanı fiyatı bizim oylama modülündedir; ortak kataloğa veya başka paylaşıma yazılmaz.
- [ ] İlk teslimde ayrı öneri tablosu zorunlu değildir; eşleşmedi yanıtı manuel bilgiyi taşıyabilir. Kalıcı öneri gerekiyorsa doğrulanmış katalogdan ayrı kaynak/durum olarak erken model taslağında öner.
- [ ] Ortak ürün düzeltme/birleştirme ve admin API'sini sonraya bırak. Yönetici yetkisini biz 16. adımda sağlar, arkadaş bu yetkiyle katalog yönetimini bağlar. İlk teslimde ihtiyaç notu yeterlidir; bağımsız rol sistemi veya açık admin yolu eklenmez.
- [ ] Mevcut auth, ApiError, doğrulama, sayfalama ve Swagger altyapısını kullan.
- [ ] Eşleşen/eşleşmeyen/belirsiz link; ürün kimliğini bozmayan normalizasyon; affiliate linkin korunması ve fiyat/para birimi davranışlarını test et.
- [ ] Yetkisiz istek, bozuk DTO, tekrar çözümleme ve kullanıcı girdisinin mevcut ortak ürünü değiştirmemesini test et. Admin düzeltme yetkisi testi yönetim adımında yapılır.
- [ ] API örnekleri, gerekli şema taslağı ve çalışan/eksik entegrasyonları teslim et.

Katalog tamamlanınca sıradaki iş sentetik veriyle trendlerdir. Reklam, abonelik ve affiliate ücretlendirmesi kendi adımlarında gelir. Ücret, komisyon yüzdesi, ücretsiz kullanım limiti veya affiliate sağlayıcısı uydurulmaz.

## Git ve yerel ortam

Her bilgisayar aynı depodan kendi kopyasını ve DB'sini kullanır. `.env`, posta kutuları, token'lar ve gerçek sağlayıcı anahtarları paylaşılmaz. Aynı bilgisayarda başka proje DB'sine bağlanılmaz; mevcut hedef koruması korunur.

Örnek branch'ler:

- Biz: `feature/user-profile`, ardından küçük sosyal/medya/oylama branch'leri.
- Arkadaş: `feature/catalog`, ardından `feature/trends`, `feature/billing`, `feature/ads`.

Güncel main'den branch açılır. Küçük tamamlanmış parçalar PR ile birleştirilir; main'e iki kişi doğrudan push yaparak ortak dosya yarışı oluşturmaz. Birleştirme sonrası diğer taraf güncel main'i kendi branch'ine alır; büyük kapsamlı ve aylarca ayrık iki branch tutulmaz. Force-push ile başkasının işi veya uygulanmış migration geçmişi silinmez.

Kendi bilgisayarında README kurulumunu uygula. Bir migration entegrasyona girdikten sonra diğer bilgisayarda `npm run db:deploy` ve `npm run db:generate` çalıştırılır. Şema kaynağı değişmeden yalnızca generate yapmak yeni tablo oluşturmaz. Değişiklik olmayan DB'yi resetlemek gerekmez.

Her PR: değişen sözleşmeler, migration/bağımlılık ihtiyacı, HTTP örnekleri, anlamlı test sonucu ve açık kalan gerçek entegrasyonları içerir. Ortak dosya değişiklikleri ayrıca işaretlenir. Yalnızca gerekli kontroller yapılır; belge değişikliği için tüm DB testlerini yeniden çalıştırmak gerekmez.

## Gerçekte ne kadar bağımsızız?

Ayrı modüllerin içini bağımsız geliştirebiliriz. Ortak ürün modeli, tercih/izin olayı, ücretli haklar ve reklam–akış bağlantısında küçük entegrasyon teslimleri gerekir. Bu noktalar sözleşmeyle ve tek sahiplikle yönetilir; tamamen bağlantısız iki backend yapılmaz.

Temel profil/ayar, sosyal, yerel medya/avatar ve oylama taslağı/yayın/iptal/silme/detay/kendi liste API'leri şimdi hazır. **Sonraki bizim işimiz tercih oyu/kapanış/sonuç; arkadaşın ilk işi hâlâ katalog/ürün linkleri.** Ürün etiketleri USER_ENTERED; ortak ürün eşleşmesi/productId henüz yoktur. Dokuzuncu migration yalnız nullable ProductTag.priceRecordedAt ekler: kullanıcı fiyat beyanının sunucu zamanı, eski veride null. Arkadaş ortak ürün/store/eşleşme şemasını önerirken bu alanı ve özgün linki korur; biz schema/migration entegrasyonunu yaparız. Güncel kod alınınca `npm ci`, `npm run db:deploy`, `npm run db:generate`; reset yok. Otomatik yüz tespiti/bulut depo, başkasının profil listesi ve kaydedilenler bekliyor. [Medya sözleşmesi](media-development.md), [oylama/ürün etiketi sözleşmesi](polls-development.md). Oyun geliştirmesi yok. Güncel Claude görevi: [arkadaş için metin](friend-claude-task.md).
