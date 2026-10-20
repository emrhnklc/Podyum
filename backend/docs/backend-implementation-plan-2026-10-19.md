# Backend: mevcut durum ve sırayla uygulama planı

19 Ekim 2026; son revizyon 20 Ekim. Bu belge bundan sonraki **uygulama sırasıdır**. Eski [23 maddelik yol haritası](backend-roadmap.md) kapsam referansı olarak korunur; aşağıdaki numaralar yeni yürütme sırasıdır. Mimariyi yeniden kurmuyoruz, çalışan modülleri tamamlıyoruz. Depoda model/tablo veya mock bulunması, ilgili özelliğin tamamlandığı anlamına gelmez.

## Şu anda elimizde ne var?

| Alan | Kodda mevcut olan | Tamamlandı saymadığımız bölüm |
| --- | --- | --- |
| Temel | NestJS, Prisma, proje DB koruması, migration, DTO/hata/request ID, cursor, kalıcı idempotency ve outbox | Üretim ortamı ve çok bağlantılı yük kanıtı |
| Hesap | E-posta/8–128 şifreyle kayıt/giriş, yenileme, çıkış, doğrulama/reset, mock Google/Apple | Gerçek e-posta ve Google/Apple |
| Kullanıcı/sosyal | Profil/stil/avatar, özel bilgiler/analiz izni/tercihler, arama, arkadaşlık ve engel | Takip/DM/topluluk ayrı ürün işi |
| Fotoğraf | Özel yerel yükleme, işleme/EXIF temizliği, manuel blur, önizleme/onay ve erişim | Bulut deposu, ayrı işlemci, otomatik yüz tespiti ve mobil bölge seçimi |
| Kombin | 2–4 seçenek, taslak/yayın/iptal, manuel/katalog etiketi ve yayın snapshot'ı, tek tercih/sonuç, Herkes/Arkadaşlar akışı ve gerçek trend ilişkisi | Gelişmiş sonuç sunumu |
| Etkileşim | Kaydetme, yorum yönetimi, hazır neden, şikâyet | Profilde ayrı “beğenilenler” ürün kararı |
| Bildirim | Outbox, uygulama içi bildirim, okundu/sayaç, cihaz uçları, yerel/Expo sağlayıcı | Fiziksel cihaz kaydı ve gerçek push doğrulaması |
| Defile | Günlük etkinlik, açık/davetli lobi, QR, fotoğraf, yıldız, state/socket, sonuç/geçmiş, temel lig | Kesin günlük saat seçimi; büyük katılım/yük ve nihai ödül/sezon politikası |
| Yönetim/hesap silme | USER/ADMIN, şikâyet/karar/audit/yaptırım, oyun iptali, anonim geçmişi koruyan hesap kapatma/temizlik | Ticari modüllerin yönetimi ve saklama politikasının bütünü |
| Teknik bakım | DB + yerel mail/push + medya; zamanlayıcı/lease, imleç, rapor, tekrar ve admin durum ucu | Varsayılan yalnız rapor; nihai bildirim/audit/yedek süreleri ve harici alarm |
| Mobil bağlantı | Kayıt/Keşfet/profil/sosyal/paylaşım/yorum/bildirim/ayar/şikâyet, defile, Trendler ve katalog detayı gerçek API kullanır | Fiziksel cihaz/mağaza/harici sağlayıcı kabulü |
| Ürün ve gelir | Katalog/öneri/ADMIN, ProductTag/mobil, tekil tercih katkısı, izinli trend veri hattı, filtreli API ve mobil Trendler | Plus/affiliate ve reklam |

**Korunan ürün kararları:** normal oy tercih bildirir, +10/çoğunluğu tahmin puanı vermez. Herkes/Arkadaşlar görünürlüğünü backend uygular. Oyun ilk kapsamda kalır. Yalnız etkinlik üyeleri yıldız verir; fotoğraf göndermeyen üye de verebilir. Geçerli QR + giriş yeterli, arkadaşlık zorunlu değil. Geçmiş sonuçlar hesap silinince anonim korunur. Trend filtresi oy vereni anlatır. Kullanıcının ürün etiketi ortak katalog kaydını serbestçe değiştiremez.

## 1. Yarım kalan entegrasyonları sabitle — bu devamın başlangıcı

- [x] Taşınmış çalışma klasöründe mevcut değişiklikleri bul ve koru: `workSpace/Podyum`.
- [x] Backend ve mobil tip kontrolü, mobil lint; yerel DB'yi veri sıfırlamadan aç.
- [x] Son ekran bağlantılarının kodda bulunduğunu ve yeni teknik bakım adımını kontrol et.
- [x] Yerel servisle mobil gerçek API smoke'u ve güncel backend regresyon sonucunu bu belgenin doğrulama kaydına işle.
- [ ] Fiziksel telefonda kayıt/giriş, fotoğraf, özel içerik, QR ve arka plandan dönüşü tekrar dene.

**Çıkış:** mevcut sosyal kombin + özel defile akışı yeniden üretilebilir. Eski yapılan işleri baştan yazmayız; tespit edilen hatayı düzeltiriz. Bu, bütün backend'in veya cihaz testinin bittiği anlamına gelmez.

## 2. Teknik saklama ve temizliği tamamla — teknik teslim hazır

- [x] Süresi dolmuş oturum/token/idempotency ve eski başarıyla yayımlanmış outbox kayıtları için sınırlı, transaction'lı bakım.
- [x] Varsayılan yalnız rapor; açık `--apply`, FK sırası, DB saati, tekrar ve aktif kayıt koruması. [Kullanım ve sınırlar](technical-retention.md).
- [x] Süresi dolmuş yerel doğrulama/reset/push dosyalarını güvenli biçimde kapsa.
- [x] Mevcut boşta medya temizliğiyle bakım sırasını ve yeniden denemeyi birleştir.
- [x] Bildirim/audit/yedeği bu teknik toplu silmenin dışında koru; alan bazında ayır. Nihai süre ve yedek/restore kabulü 16/19. adımda seçilecek.
- [x] Zamanlayıcı, kalıcı lease/imleç, son başarı/hata ve artan hata sayacı, ADMIN durum ucu ve redakte hata logu. Harici alarm sağlayıcısı 19. adımda.

**Çıkış:** bekleyen iş veya aktif oturum/medya silinmez; hata sonrası yeniden çalışır. Gerçek geçmiş oy/oyun sonuçları değişmez. Teknik DB/dosya/medya otomasyonu hazır; varsayılan rapor modundadır. Ürün kayıtlarının nihai süreleri ve üretim alarm/yedek kabulü ayrıca açıktır.

## 3. Defile süre sözleşmesini ve açık kuralları düzelt

**20 Ekim düzeltmesi:** Toplam oy süresi artık teslim sayısından bağımsız. 10 sn sunum kartı döngü yapar; günlük tam 30 dk, lobi seçilen `votingSeconds` ile çalışır. Önceden açılmış oturumların süreleri geriye dönük değiştirilmez.

- [x] Günlük 30 dakikalık oy penceresini ve özel lobide seçilen oylama süresini gerçekten uygula. Sunum/tur süresiyle son oy zamanını ayır; günlük ve özel mod için ayrı test yaz.
- [x] Mobilde aynı yarışmacıyı gösterme, geç katılan/arka plandan dönen kişi ve kalan süreyi bu sözleşmeyle uyumlu tut. Canlı/Sonbahar kart tasarımını değiştirme.
- [x] Herkes oy verdiğinde erken sonuç açılmasının hangi modda geçerli olduğunu açıklaştır; hostun fotoğrafı erken bitirmesiyle karıştırma.
- [x] Günlük saat/saat dilimi ve tema düzenleme uçlarını tamamla; saat seçilmeden rastgele etkinlik başlatma.
- [x] Herkese açık ve davetli oda ödül farkını koru. Kodda bulunan 50/30/20 ve lig eşiklerini geliştirme politikası olarak görünür tut; sezon, asgari oy ve beraberlik kararını sonuçları sessizce değiştirerek uygulama.
- [x] API regresyonunda tek aktif üyelik/kapasite/host/engel/yönetici iptali; mobil API smoke'unda QR/fotoğraf/host erken geçiş/yıldız/sonuç. Fiziksel cihaz kabulü 1/12/20. adımda kalır.

**Çıkış:** ekranın vaat ettiği süre ile DB'nin kabul ettiği oy süresi aynıdır. Tema/takvim ADMIN API'si hazır; kesin günlük saat seçilmedi. Kod, test ve oyun belgeleri tek sözleşme anlatır. Günlük saat ve ödül ayrıntıları gerektiği noktada kullanıcıyla netleştirilir.

## 4. Ortak ürün kataloğunu kur

- [x] Ortak ürün, mağaza/marka, kaynak, URL/harici ürün kimliği ve gerekiyorsa varyant alanlarını tamamla.
- [x] Link veya isimle çözümleme; kesin eşleşme, olası aday ve eşleşmedi durumlarını ayır.
- [x] Aynı isimli farklı ürünleri zorla birleştirme; desteklenen mağazalarda güvenilir ürün kimliğini kullan.
- [x] Normalleştirilmiş ürün adresini özgün paylaşım/affiliate linkinden ayır; takip parametrelerini ürün kimliği sayma.
- [x] Kullanıcı beyanı/önerisi için doğrulanma durumunu tut. Ortak düzeltme/birleştirme yalnız ADMIN, gerekçe ve kayıt ile yapılır.
- [x] Fiyatı tutar + para birimi + kaydedilme tarihiyle sakla; farklı para birimlerini sessizce karşılaştırma.

**Çıkış:** katalogda ortak kimlik ve güvenli çözümleme hazırdır; gönderilere bağlama 5. adımdadır. [Sözleşme ve sınırlar](catalog-development.md). Bir kullanıcı başkasının kullandığı ortak kaydı değiştiremez. Bir ürün linki çözmek için sunucudan keyfî URL alma yolu açılmaz; varsa dış adres alma işi izin verilen kaynaklarla sınırlandırılır.

## 5. Kombin etiketlerini kataloğa bağla

- [x] Mevcut ProductTag ile ortak ürün ilişkisini ekle; eski elle girilmiş etiketler çalışmaya devam etsin.
- [x] Taslakta ürün ara/seç/öner/düzelt; seçenek başına sınır ve çift etiket davranışı.
- [x] Yayın anındaki ürün, fiyat ve kaynak bağlamını koru; sonradan katalog değişince eski tercih başka ürüne taşınmasın.
- [x] Özgün normal/affiliate yönlendirme linkini koru; yayın sonrası ortak içerik kurallarını uygula.
- [x] Mobil Paylaş ve kombin detayındaki ürün tuşlarını gerçek kataloğa bağla.

**Çıkış:** fotoğraf + ürün seçimi → yayın → başka hesaptan tercih akışı ortak ürün kimliğiyle çalışır. [Uygulanan sözleşme ve örnekler](poll-catalog-integration.md). Sıradaki iş 6. adım trend veri hattıdır.

## 6. Trend ölçümünün veri hattını tamamla

- [x] İlk ölçüm: **seçilen kombinlerde yer alan ürünler**. Doğrudan ürün oyu/satış olarak adlandırma.
- [x] Tekil oy/ürün katkısı kur: aynı seçenekte tekrarlanan etiket, yinelenen olay veya retry toplamı şişirmesin.
- [x] Başlangıçta uygun PUBLIC içerik; FRIENDS paylaşımlarını genel trendlerden çıkar.
- [x] İzinli oy anı yaş/cinsiyet bağlamı ve ürün/fiyat snapshot'ını tüket; izin geri alınca demografik katkıyı da geri al.
- [x] İptal, gizleme, hesap silme, katalog birleştirme ve veri düzeltmesinde yeniden hesaplama kuralları.
- [x] Olay kaçarsa DB'den güvenli backfill/yeniden oluşturma; işlem tekilliği.

**Çıkış:** aynı veriden tekrar hesaplanan trend aynı sonucu verir; özel içerik ve izinsiz demografi genel toplama sızmaz. [Uygulanan veri hattı](trend-pipeline-development.md). Kullanıcı seçimi: kişi/ürün/İstanbul günü başına en fazla 1 katkı. Takvim günü/haftası/ayı ve genel API için en az 5 ayrı hesap geliştirme politikası; HTTP toplama/filtreler 7. adımda uygulanır.

## 7. Trendler API'sini ve filtrelerini bitir — teknik teslim hazır

- [x] Günlük/haftalık/aylık dönem, kategori/marka, oy verenin cinsiyeti/yaşı ve fiyat aralığı.
- [x] Küçük örneklemde gizleme; yeterli veri yok/ürün yok durumlarını ayır.
- [x] Sabit sıralama/cursor, aynı puanda sıra, ölçüm adı, para birimi ve güncellenme zamanı.
- [x] Genel tercih ile demografik alt örneklemi karıştırma; analiz izni olmayan oy için kişisel kırılım üretme.
- [x] Gerçek sorgu için EXPLAIN ANALYZE/buffer ölçümü; mevcut indekslerle başlangıç, ayrı servis kurmadan. Temsili büyük veri/çok bağlantılı yük 18. adımda.

**Çıkış:** “bu hafta 18–24 yaş grubundaki kadınların seçtiği kombinlerdeki ürünler, şu fiyat aralığında” sorusu gerçek, izinli ve açıklanabilir veri döndürür. [İstek/yanıt ve fiyat/sayfalama sözleşmesi](trends-api-development.md). Mobil örnek veri 8. adımda değişir.

## 8. Gerçek Trendler ekranına geç — teknik teslim hazır

- [x] Mobil örnek veri kaynağını API ile değiştir; filtre, sayfalama, yenileme, boş/hata/yetersiz örneklem durumları.
- [x] Üründen gerçek katalog detayına ve mevcut gerçek mağaza bağlantısına geçiş; kombin etiketinin özgün bağlantısı kendi detayında korunur.
- [x] Demo trend üretimini ve örnek veri bandını kaldır; sayıları/sırayı yalnız sunucudan al.
- [x] Trend filtrelerini kullanıcı kararı olmadan Plus'a kilitleme.

**Çıkış:** kataloglu kombin → gerçek tercih → filtreli trend → ürün detayı/mağaza hattı çalışır. [Mobil sözleşme](../../mobile/docs/trends-api-integration.md). Fiziksel cihaz kabulü ayrıca durur.

## 9. Gerçek e-posta teslimini bağla

**20 Ekim kullanıcı yönlendirmesi:** E-posta çalışmasına şimdilik geçilmeyecek; bu adım bekliyor. Kullanıcının istediği logo ayrıca mobil uygulama ikonu, açılış/giriş ve ana ekran markasına eklendi. E-posta sağlayıcısı veya teslim akışına bu devamda kod değişikliği yapılmadı.

- [ ] Doğrulama/reset taşıyıcısı için sağlayıcı arayüzü ve kalıcı teslim/yeniden deneme.
- [ ] Doğrulanmış gönderen/uygulama dönüş linki, süreli tek kullanımlık anahtar; anahtarı loglama.
- [ ] Aynı olayın tekrar teslimi, reddedilen/geciken posta, e-posta değişimi ve numaralandırma/hesap varlığı sızıntısı testleri.
- [ ] Geliştirmede yerel mailbox, dış testte gerçek taşıyıcı açıkça ayrılır.

**Çıkış:** gerçek kullanıcı gelen bağlantıyla hesabını doğrular/şifresini sıfırlar. Sağlayıcı hesabı ve gönderen ayarı gerektiğinde ayrıca sağlanır.

## 10. Google ve Apple girişlerini gerçek sağlayıcıya geçir

- [ ] Mobil client kimlikleri, imza/issuer/audience/süre/nonce doğrulaması ve güvenli callback.
- [ ] Aynı dış kimliğe tek hesap; mevcut e-posta hesabına güvenli bağlama, gizli e-posta ve sağlayıcı iptal davranışı.
- [ ] Mock yalnız geliştirmede açık kalabilir; doğrulanmamış token gerçek oturum açmaz.
- [ ] iOS/Android gerçek veya sağlayıcı sandbox akışlarıyla kabul.

**Çıkış:** iki tuş da gerçek sağlayıcıdan doğrulanmış kimlikle mevcut oturum sistemini kullanır. Client ID/Apple yapılandırması gelmeden canlı OAuth tamamlandı sayılmaz.

## 11. Medyayı dış test için hazırla

- [ ] Özel bulut deposu/yerel adaptör ayrımı; orijinalleri genel URL ile açma.
- [ ] Upload, işleme, blur, preview ve silme işlerinin yeniden denenmesi; bozuk dosya/limit/yarım upload.
- [ ] Mobil yüz bölgesi seçimi; otomatik tespit seçilecekse başarısızlık/yüz bulunamadı davranışı.
- [ ] Hesap silme, kullanılmayan fotoğraf ve depodaki artık dosyalar için yaşam döngüsü.
- [ ] Yetki her okumada geçerli; arkadaşlıktan çıkarma/engel/hesap silme eski fotoğraf adresini açmasın.

**Çıkış:** iki farklı cihazda fotoğraf kalıcı çalışır ve silme/özel erişim korunur.

## 12. Telefona push ve canlı dönüşünü tamamla

- [ ] Mobil cihaz token kaydı, izin isteme, yenilenen token ve çıkışta cihaz ilişkisinin kapatılması.
- [ ] Gerçek telefonda Expo push; geçersiz token, tercih kapalı, sessiz/okunmuş/eski bildirim.
- [ ] Bildirime dokununca ilgili oylama/defile/profil; giriş gerekiyorsa hedefe güvenli dönüş.
- [ ] Socket kopması/arka plan/ağ değişiminde REST snapshot ve sunucu saati; tekrar olay aynı işlemi üretmesin.

**Çıkış:** API'de “gönderildi” demenin yanında gerçek cihaz teslimi ve hedefe dönüş kanıtı vardır.

## 13. Plus ve üretici haklarını kur

- [ ] Tüketici reklamsız hakkı ile üreticinin ticari link hakkını ayrı tanımla; tek paketse bile haklar ayrı izlenir.
- [ ] Paket/ücretsiz limit/son kullanım/iptal/iade durumları; fiyat ve hangi hakların ücretli olduğu ürün kararıdır.
- [ ] Mağaza satın alma doğrulaması ve imzalı webhook, replay/çift teslim, sona erme ve geri alma.
- [ ] Mobil istemciden gelen `isPlus=true` veya mock ödeme gerçek hak açmaz.
- [ ] Hak tüketimi atomik; tekrar istek fazladan kota tüketmez.

**Çıkış:** gerçek doğrulanmış satın alma sunucuda hak açar; iptal/iade güvenle kapatır. Fiyat/sağlayıcı/mağaza ürün kimliği gerektiği aşamada alınır.

## 14. Affiliate kullanımını haklara bağla

- [ ] Kullanıcı beyanı ve desteklenen sağlayıcıyla affiliate ayrımı; sadece URL parametresinden kesin gelir varsayma.
- [ ] Normal ürün paylaşımı çalışırken ticari link ekleme/güncelleme yayınında üretici hakkını denetle.
- [ ] Abonelik bitince mevcut linklerin ve yeni yayınların davranışını belirle.
- [ ] Dış yönlendirme, tıklama ve varsa sağlayıcı doğrulamalı dönüşü ayrı ölç.

**Çıkış:** ücretli ticari kullanım denetlenir; tıklama satış/komisyon gibi raporlanmaz. Uygulama içinde alışveriş/sepet bu işin zorunlu kapsamı değildir.

## 15. Reklam kampanyalarını ve reklamsız akışı bitir

- [ ] Mağaza/sponsor, kreatif, dönem, hedef linki, kampanya durumu ve ADMIN yönetimi.
- [ ] Akışta açık sponsorlu işareti; yaklaşık 10 kart örneğini yapılandırılabilir sıklık/kota yap.
- [ ] Aktif reklamsız hakta reklam sunma; reklam yoksa organik akış devam etsin.
- [ ] Tekil gösterim/tıklama ve izinli toplu rapor; reklam organik trend sırasını değiştirmesin.
- [ ] Cursor/yenileme/geri dönüş aynı gösterimi iki kez ücretlendirmesin.

**Çıkış:** reklam sunumu, tüketici Plus'ı ve üretici affiliate hakkı bağımsız ve doğru çalışır.

## 16. Yeni alanların yönetimini ve operasyonunu tamamla

- [ ] Katalog önerisi/düzeltme/birleştirme, temalar/stiller, kampanya, hak/abonelik ve raporlar için ortak ADMIN yetkisi.
- [ ] Her kritik değişiklikte gerekçe/audit; kullanıcı kayıt/profil isteğinden rol yükseltemesin.
- [ ] Başarısız outbox/medya/silme işleri için inceleme, tekrar çalıştırma ve alarm.
- [ ] Gerekliyse kullanıcı verisi dışa aktarımı ve audit redaksiyonu; geçmiş anonimliğini bozma.

**Çıkış:** yalnız veritabanından elle değişiklik yaparak yönetilen bir sistem kalmaz. Yönetim UI'si ayrı teslim olabilir, çalışan API ve audit gerekir.

## 17. Haftalık/sponsorlu yarışmaları ayrı teslim et

- [ ] Canlı günlük oyundan ayrı etkinlik, tema, kapak, katılım/oy/bitiş saatleri ve kurallar.
- [ ] Tekil katılım/oy, beraberlik/yetersiz katılım, sonuç/geçmiş/bildirim.
- [ ] Sponsor ürünü, sınırlı indirim/ödül envanteri ve tekil hak dağıtımı; kurallar yayın anında sabitlensin.
- [ ] Sonbahar kartı gerçek etkinlik API'sine ancak bu adım hazır olunca bağlanır. Şu anda temalı oda araması açar.

**Çıkış:** haftalık ve sponsorlu kartlar gerçek etkinliktir; oyun lobisiyle aynı şey gibi gösterilmez. İlk dış testten önce zorunlu olup olmayacağı ayrı öncelik seçimidir.

## 18. Backend doğruluğunu ve performansı çok bağlantıyla kanıtla

- [ ] Ayrı gerçek PostgreSQL ortamı ve test isolation; tek bağlantılı yerel DB'yi yarış testi kanıtı sayma.
- [ ] Eşzamanlı oy/kapanış, son oda yeri, host/zamanlayıcı geçişi, izin geri alma/trend ve hak tüketimi yarışları.
- [ ] API/worker yeniden başlatma, rollback, outbox tekrarı, medya/ödeme sağlayıcısı kesintisi.
- [ ] Akış/trend/oy/yükleme/podyum için ölçülmüş gecikme, DB bağlantı/kilit ve indeks kontrolü.
- [ ] Gerçek kişi verisi olmayan, tekrar üretilebilir demo/smoke paketi; negatif yetki ve medya erişim testleri.

**Çıkış:** aynı olay iki kez işlense de çift oy/puan/bildirim/hak tüketimi oluşmaz; ölçüm raporu vardır.

## 19. Test ortamını ve yayın kontrolünü kur

- [ ] CI: format/tip/test/build, migration kontrolü ve harici sağlayıcı sandbox testleri.
- [ ] Ayrı geliştirme/test/canlı ayarları; secret yönetimi, kontrollü migration ve geri düzeltme prosedürü.
- [ ] Sağlık/readiness, hata/iş gecikmesi/başarısız iş takibi; loglarda parola/token/özel içerik olmaması.
- [ ] DB ve medya yedeği; gerçekten geri yükleme denemesi ve gerekli saklama kararları.
- [ ] OpenAPI/istemci tipleri, ekran-hata haritası, kurulum ve geliştirici teslim notları.

**Çıkış:** başka bilgisayarda kurulabilen ve gerçek mobil uygulamayla denenebilen test sürümü. Mevcut üretim açılış engeli yalnız gerçek gereksinimler tamamlanınca kaldırılır; bu plan dağıtım yapıldığı anlamına gelmez.

## 20. Son kabul ve kontrollü ilk kullanıcı teslimi

- [ ] İki hesap ve üçüncü yetkisiz hesapla kayıt → arkadaşlık → fotoğraf/ürün → paylaşım → tercih → yorum/kaydetme → trend → bildirim → QR/günlük defile → sonuç → hesap silme.
- [ ] Plus/affiliate/reklam varsa sandbox satın alma/iade ve haklara bağlı akışın kabulü.
- [ ] iOS/Android izinler, cihaz dönüşü, düşük ağ, yeniden giriş, arka plan ve erişimi sonradan kaldırılmış içerik.
- [ ] Açık hata listesini önem sırasıyla kapat; hangi özelliklerin örnek/kapalı olduğunu net göster.

**Çıkış:** üzerinde anlaşılmış sürüm kapsamı denenmiş olur. İlk 1000 kullanıcıya erişim kanalı/pilot topluluklar bu teknik plandan ayrı ürün/dağıtım işidir.

## Kaybolmayacak sonraki fikirler

İlk sürümün bitişini uzatmamak için bunları ayrıca seçip sıraya alacağız: profilde tercih edilen/beğenilen kombinler (kaydetmeden ayrı kural), giyilenler/highlights, Halloween/özel gün içerikleri, moda toplulukları, rozet/seri/sezon ve arkadaş/genel sıralamaları; ileride AI ile ürün/tasarım talebi test eden üretici araçları. Beğeni, tercih, kaydetme ve satış aynı ölçüm değildir. [Asıl fikir notları](mentor-notes-2026-10-10.md).

## Biz nasıl ilerleyeceğiz?

Her adımda önce uç/alan ve iş kuralını belirle, çalışan kodu tamamla, uygun negatif/tekrar testini çalıştır, mobile bağlanacaksa sözleşmeyi güncelle, sonra sonraki maddeye geç. Tamamlanmamış sağlayıcıyı mock ile “bitti” sayma. Arkadaş frontend temasını aynı anda geliştirebilir; ortak DTO/şema değişikliklerini teslim notuyla paylaşırız. İkinci backend geliştiricisi yeniden katılırsa **4–8 katalog/trend** ile **9–12 sağlayıcı/medya/push** kolları, ortak dosya sınırları belirlenerek ayrılabilir.

**Bundan sonraki yakın sıra:** 2–6 bakım/oyun/katalog/ürün etiketi/trend veri hattı hazır → **7 filtreli Trendler API** → 8 gerçek Trendler ekranı. Sağlayıcı kurulumu gereken 9–12 işleri paralel hazırlığa uygun; gelir 13–15 katalog/trend ve hak sözleşmelerinden sonra gelir.

## Bu devamda doğrulama kaydı

- Backend ve mobil TypeScript; mobil lint geçti.
- Yerel DB mevcut kayıtlarla açıldı; reset/seed yok.
- Teknik bakımın 6 rollback testi ve gerçek DB üzerinde silmeyen dry-run geçti.
- `npm run test:api`: **203/203**, teknik bakımın 6 rollback testi dahil.
- `npm run test:db`: **14/14**. Mobil giriş/kayıt/oturum testleri: **16/16**.
- Mobil `test:connected-api`: gerçek yerel API üzerinde profil/arkadaşlık/özel bilgiler/ayar, fotoğraf/oylama/tercih/neden/yorum/kaydetme/şikâyet, QR/oda/fotoğraf/erken geçiş/yıldız/sonuç/geçmiş/lig, bildirim okuma ve engelleme akışı geçti. Benzersiz test hesapları yerel DB'de kalır, oturumları kapatıldı.
- API readiness: `status=ok`, `database=connected`.
- Bu ilk kayıt 19 Ekim doğrulamasıdır. 20 Ekim ek teslimi: teknik dosya otomasyonu, 30+30 düzeltmesi ve katalog; güncel test sonucu aşağıda. Fiziksel cihaz, çok bağlantılı yarış/yük ve üretim kabulü yapılmış sayılmaz.

### 20 Ekim — sonraki üç adımın teslimi

- 2: DB/mail/push/medya ortak bakım, zamanlayıcı, kalıcı lease/imleç ve ADMIN durum raporu hazır. Gerçek yerel DB'de birleşik dry-run `SUCCEEDED`; silinen kayıt/dosya 0. Varsayılan `MAINTENANCE_APPLY=false`.
- 3: günlük sabit 30 dk oy, özel seçilen süre, döngüsel 10 sn sunum; ADMIN tema/takvim yönetimi ve mobil süre sözleşmesi hazır. Kesin günlük saat seçilmedi, etkinlik otomatik açılmadı.
- 4: mağaza/ortak ürün/URL, kesin/aday/eşleşmedi çözümlemesi, özel öneri ve ADMIN düzeltme/birleştirme hazır. Gerçek mağaza taraması veya yeni bir Plus/affiliate hakkı açılmadı.
- Dört ek migration mevcut DB'ye reset/seed olmadan uygulandı; Prisma validate/build ve backend TypeScript geçti.
- Genel regresyon **231 senaryo** çalıştırdı: 230 geçti; yeni medya imleci testinin READY fixture'ında `displayKey` eksikti. Fixture düzeltildi; sonrasında katalog/takvim/bakım **26/26** geçti (başarısız senaryo ve ek NUL/boş gerekçe doğrulamaları dahil). Diğer genel regresyon senaryolarında hata yoktu.
- DB bütünlük testi **14/14**; gerçek mobil → API bağlı ekran smoke'u geçti: sosyal/profil/tercihler, fotoğraf/yayın/oy/yorum/kaydetme/şikâyet ve QR/teslim/erken geçiş/yıldız/sonuç/geçmiş/bildirim/engel.
- API readiness `status=ok`, `database=connected`. Yerel bakım raporu başarılı; kullanıcı verisine fiziksel toplu temizlik uygulanmadı.
- Mobil iOS/Android/web export geçti. Expo uyumluluk kontrolündeki yama sürümü farkları `expo install` ile eşitlendi; güncel kontrol kaydı aşağıdadır.

**Sıradaki adım 5:** Mevcut ürün etiketlerini ortak kataloğa bağla; yayın anındaki ürün/fiyat bağlamı ve özgün yönlendirme linkini koru, mobil Paylaş/ürün seçimini bağla. Sonra gerçek trend katkısı/API/ekranı (6–8).

Son mobil doğrulama: Expo 57 uyumlu yama sürümleriyle `check:expo`, TypeScript, lint ve **16/16** giriş/kayıt/oturum testi geçti. Güncellenmiş bağımlılıklarla iOS/Android/web export tekrar başarılı. Fiziksel telefon ve çok bağlantılı yük kabulü ayrıca duruyor.

### 20 Ekim — 5. adım tamamlandı

ProductTag katalog FK'sı ve yayın snapshot'ı, özgün bağlantı, kaynak/tekrar sınırları ve mobil ürün arama/seçme/elle ekleme/öneri bağlantısı hazır. Eski etiketler USER_ENTERED kalır. Katalog düzeltme/birleştirme eski yayınların kimlik/fiyatını değiştirmez. [Sözleşme](poll-catalog-integration.md).

- 25. migration reset/seed olmadan uygulandı; backend Prisma/build/TypeScript kontrolleri başarılı.
- Güncel tam backend regresyonu **243/243**; yeni 12 katalog-etiket senaryosu ve gerçek fotoğraf → katalog → yayın → tercih akışı dahil. Önceki bakım fixture hatası da bu tam koşuda yoktur.
- DB bütünlük testleri **14/14**. Mobil ürün payload/fiyat/sınır testi **3/3**, TypeScript/lint/Expo uyumluluk ve iOS/Android/web export başarılı.
- Gerçek API üzerinde mobil bağlı ekran smoke'u tekrar geçti. Fiziksel cihaz ve çok bağlantılı yük doğrulaması ayrı durur.
- Chrome web arayüzünde gerçek API ile giriş → link çözümleme → katalog seçimi/çift ürün reddi → elle ürün önerme → iki fotoğraf/önizleme/onay → ürünlerle yayın akışı düğmelere basılarak geçti. İstemcinin yalnız katalog ID/özgün link göndermesi ve DB'deki snapshot doğrulandı; geçici arayüz hesap/ürün/fotoğraf kayıtları temizlendi.

**Aktif sıradaki adım 6:** Donmuş ürün kimliklerinden, uygun PUBLIC tercihlerin tekil trend katkısını üret; izin geri alma/iptal/silme ve yeniden hesaplama kurallarını uygula. 7'de filtreli trend API'si, 8'de gerçek Trendler ekranı gelir.

### 20 Ekim — 6. adım tamamlandı

[Trend veri hattı](trend-pipeline-development.md): Outbox tercih tüketicisi, tekil katalog katkıları, güncel görünürlük/izin/katalog birleşmesi denetleyen SQL görünümleri ve sınırlı dry-run/apply onarımı hazırdır. Kullanıcı tarafından seçildi: hesap/ürün/İstanbul takvim günü başına en fazla 1 katkı; asıl tercihler korunur. Demografi ayrıca kopyalanmaz, izin geri alma genel tercihi silmeden demografik bağlamı kapatır.

- 26. migration mevcut DB'ye reset/seed olmadan uygulandı; Prisma/build/TypeScript ve format kontrolleri başarılı.
- Yeni 18 trend senaryosu dahil tam backend regresyonu **261/261** geçti. Özel içerik, izin geri alma/yeniden izin, hesap silme/askı, katalog birleşmesi, günlük sınır ve İstanbul gece yarısı, kaynak onarımı ve outbox rollback/yeniden deneme dahil.
- DB bütünlük testleri **14/14**. Yerel `trends:rebuild` dry-run 9 mevcut tercihi inceledi; uygun katalog snapshot'lı katkı 0, bozuk snapshot 0, devam batch'i yok. Mevcut eski etiketlere katalog kimliği veya sahte trend atanmadı; asıl oylar/etiketler değiştirilmedi.
- Güncel API yeniden açıldı; readiness `ok/connected`. Mobil bağlı ekran smoke'u gerçek API üzerinde tekrar geçti: profil/sosyal, yayın/tercih/yorum/kaydetme, QR/teslim/yıldız/sonuç ve bildirim/engel. Fiziksel cihaz ve çok bağlantılı yük kanıtı bu teslim değildir.
- Bu teslim yeni genel HTTP endpoint'i veya mobil Trendler bağlantısı eklemez. Minimum 5 farklı hesap ve dönem/filtre/sıralama API'si 7. adımda uygulanacak; mobilde hâlâ örnek veri vardır.

**Aktif sıradaki adım 7:** Gün/hafta/ay, oy verenin yaş/cinsiyet grubu, ürün kategori/marka/fiyat/para birimi filtreleri; küçük örneklem koruması, kararlı sıralama/cursor ve ölçüm açıklaması taşıyan gerçek Trendler API'sini tamamla. Sonra 8. adımda mobil örnek veriyi kaldır.

### 20 Ekim — 7. adım tamamlandı

Oturumlu `GET /trends`, İstanbul gün/hafta/ay, yayın anı kategori/marka/fiyatı ve tek para birimi, izinli oy anı yaş/cinsiyet filtreleriyle çalışır. Günlük ilk uygun katkı filtrelerden önce seçilir. Her ürün filtre sonrasında en az 5 ayrı hesap gerektirir; NO_DATA / INSUFFICIENT_SAMPLE / READY ayrıdır. Güncel katalog kartı ile geçmiş fiyat filtresi açıkça ayrılır. [HTTP sözleşmesi](trends-api-development.md), [örnek istekler](../examples/trends.http).

- Sabit puan/ayrı hesap/UUID sırası, dönem geneli rank, filtre/hesap kapsamlı cursor ve ilk sayfanın oy zamanı üst sınırı hazır. Yeni oy sayfaları kaydırmaz; izin/görünürlük/katalog toplamı değişince 409 ile yenileme, 15 dk sonunda kesit süresi biter. Her sayfada güncel uygunluk yeniden okunur; no-store.
- 18 yeni Trendler API testi dahil tam backend regresyonu **279/279** geçti. Trend veri hattı + HTTP toplamı 36 testtir. Genel ve izinli örneklem, fiyat/para birimi, eşik, tarih, tekrar, arşiv/gizleme/birleştirme, sayfalama ve izin geri alma dahil. DB bütünlük testleri **14/14**; TypeScript/build ve yeni kaynakların format kontrolü başarılı.
- Gerçek sıralama SQL'i EXPLAIN ANALYZE ile ölçüldü: 3 ürün/5 hesap/15 katkı fixture'ında tam koşuda planlama **35,7 ms**, çalışma **1,3 ms**, 320 buffer hit / 27 read. Bu küçük yerel ölçümdür; temsili büyük veri ve çok bağlantılı yük 18. adımda kalır. Ek servis/önbellek veya ölçümsüz indeks eklenmedi.
- Yeni migration/seed/reset yok; 26 migration korunuyor. Test fixture'ları temizlendi; API yeniden açıldı, readiness `ok/connected`, OpenAPI Trendler endpoint/DTO'sunu içeriyor ve oturumsuz istek 401 alıyor.
- Mobil Trendler hâlâ örnek veri kullanır. Bu teslim tasarımı değiştirmez, filtreleri Plus'a kilitlemez veya affiliate/reklam hakkı açmaz.

**Aktif sıradaki adım 8:** Mobil Trendler örnek veri kaynağını gerçek API ile değiştir; filtre/sayfalama/yenileme, boş/yetersiz/hata durumları, gerçek ürün bağlantısı ve açıklanabilir puan gösterimi. 409 durumunda eski sayfaları temizleyip ilk sayfadan yenile; demo yüzdeleri/sıra değişimleri gerçekmiş gibi kalmasın.

### 20 Ekim — 8. adım tamamlandı

Mobil Trendler gerçek oturumla filtreli API kullanır. Bugün/hafta/ay, kategori, oy verenin izinli yaş/cinsiyeti, marka, para birimi ve yayın fiyatı filtreleri bağlıdır. Sunucu puanı/sırası ve farklı hesap sayısı gösterilir; demo trend üretimi, örnek fiyat/arama ve örnek veri bandı kaldırıldı. Ürün satırı gerçek katalog detayını, orası mevcut mağaza bağlantısını açar. [Mobil sözleşme](../../mobile/docs/trends-api-integration.md).

- Hesap/filtre/odak/arka plan değişiminde istek iptal ve sayfa temizliği; geç yanıt koruması, tek sonraki sayfa isteği ve 409/sona erme sonrası cursorsuz tek yenileme. Hata halinde eski cohort toplamı geri getirilmez. Boş/yetersiz/hata durumları ayrıdır; Plus kilidi yoktur.
- Bütün mobil testler **29/29** (10 yeni Trendler/bağlantı/sayfalama senaryosu dahil). Mobil TypeScript/lint ve Expo paket uyumu başarılı; iOS/Android/web export başarılı.
- Chrome web üzerinde gerçek yerel Nest/Prisma, 21 katalog ürünü ve 5 ayrı izinli tercih sahibiyle giriş → filtre/sayfalama → katalog detayı/mağaza bağlantısı → izin geri alma/409 → yetersiz/boş → hata/tekrar akışı geçti. Mağaza sayfası ve geçici hata kontrollü tarayıcı cevabıdır; trend/katalog/izin sonucu gerçek API'dir. Testin kendi hesap/katalog/oy fixture'ları temizlendi; gerçek kullanıcı verisine demo trend eklenmedi.
- Backend şeması veya API iş kuralı değiştirilmedi; 7. adımın 279/279 backend + 14/14 DB kaydı geçerlidir. API yeniden açıldı. Fiziksel iOS/Android, gerçek harici mağaza erişimi ve çok bağlantılı yük kabulü ayrıca durur.

**Aktif sıradaki adım 9:** Gerçek e-posta teslimini bağla. Yerel mailbox korunurken doğrulama/reset için sağlayıcı arayüzü, kalıcı teslim/yeniden deneme ve dönüş bağlantılarını tamamla; gerçek sağlayıcı hesabı/gönderen ve mobil dönüş yapılandırması gerektiğinde alınır.
