# Backend çalışma planı

10 Ekim 2026. Amaç: Faz 1 sosyal kombin, ürün trendleri ve gelir özelliklerinin backend'ini tamamlayıp frontend'e teslim etmek; ardından Faz 2 oyun/rekabet kapsamına geçmek. Bu belge yapılacak iş listesidir; kutuların boş olması işlevin henüz tamamlanmadığı anlamına gelir. Mimari ayrıntılar ayrı belgelerde kalır.

**Mentör görüşmesiyle güncellenen öncelik:** Oyun/podyum en sona, **Faz 2**'ye alındı. Günlük/haftalık/aylık ürün trendleri, cinsiyet/yaş/fiyat filtreleri, affiliate kullanan üreticilere ücretli hak, akış reklamları ve reklamsız Plus Faz 1 ürün planına eklendi. Ayrıntılı not ve açık kararlar: [mentör görüşmesi](mentor-notes-2026-10-10.md).

**Plan artık gerçek geliştirme sırasıyla yeniden numaralandırıldı:** 1–18 Faz 1, 19–23 Faz 2. Eski 7A/11A/11B numaraları kaldırıldı. 4–6 ve 8–12 ile ürün/trend/gelir kolu paralel ilerleyebilir; aşağıdaki sıra entegrasyon bağımlılıklarını gösterir. Faz 1'in test ve frontend teslimi Faz 2'yi beklemez.

## İki kişinin paralel çalışma özeti

| Alan | Biz: kullanıcı ve kombin | Arkadaş: ürün, trend ve gelir |
| --- | --- | --- |
| İlk iş | 4: profil ve ayarlar | 7: ürün kataloğu ve link eşleştirme |
| Devam | 5–6: sosyal/medya, 8–12: oylama/akış/etkileşim/bildirim | 13: trendler, 14: Plus/affiliate hakları, 15: reklamlar |
| Ortak teslim | 1–3 ortak temel, 16 yönetim sınırları, 17 test ve 18 frontend teslimi | Kendi modüllerinin yönetim API'leri, testleri ve sözleşmeleri |
| Faz 2 | 19–23 oyun kapsamı; şu anda başlanmayacak | Önceki oyun görevinin yerine Faz 1 ürün kolu |

Dosya sahipliği, servis sözleşmeleri, ilk görev ve Claude'a verilecek güncel metin: [iki kişilik çalışma planı](two-developer-plan.md), [arkadaş için görev metni](friend-claude-task.md).

## Mevcut durum

- [x] NestJS başlangıcı, health endpoint'leri ve özellik klasörleri.
- [x] Prisma şeması, yerel veritabanı, sekiz migration ve demo kayıtları.
- [x] Veritabanı hedef kontrolü, 13 ilişkisel bütünlük testi ve HTTP sağlık kontrolü.
- [x] Yerel e-posta/şifre ve oturum akışları; Google/Apple mock.
- [x] Auth/ortak API, profil/ayar ve sosyal HTTP testleri; mevcut 13 DB testi ve bootstrap kontrolü.
- [x] Temel profil, stil seçimi, özel bilgiler/analiz izni, ayarlar ve avatar; sekme listeleri oylama modülüne bağlı.
- [x] Kullanıcı arama, arkadaş isteği/kabul/red/iptal, arkadaş listesi/kaldırma, engelleme ve ortak sosyal erişim servisi.
- [x] Yerel özel fotoğraf yükleme/işleme/önizleme/manuel blur/erişim ve avatar; otomatik yüz tespiti ve bulut deposu bekliyor.
- [ ] Faz 1 sosyal kombin, ürün/trend ve gelir akışları.
- [ ] Gerçek OAuth/e-posta teslimi ve diğer harici entegrasyonlar.
- [ ] Faz 2 oyun/rekabet akışları; ertelendi.

**İlk uygulama ilerlemesi:** Ortak API altyapısı, yerel auth, temel profil/ayar, sosyal ve yerel medya/avatar API'leri tamamlandı. Google/Apple mock; gerçek OAuth/e-posta, otomatik yüz tespiti ve bulut medya entegrasyonu tamamlanmış sayılmıyor. Sonraki bizim işimiz 8. adım oylama taslağı/yayınlama; 7. adım katalog arkadaşta paralel ilerler. [Karar kaydı](implementation-decisions.md), [auth kullanımı](auth-development.md), [profil kullanımı](users-development.md), [sosyal kullanımı](social-development.md), [medya kullanımı](media-development.md).

Hazır şema başlangıçtır; şikâyet, lig, haftalık etkinlik, abonelik gibi alanlar ilgili adımda yeni migration'larla eklenecek. Generated dosyalar elle düzenlenmeyecek.

## Çalışma yöntemi

Adımları belgenin sonundaki güncel Faz 1/Faz 2 uygulama sırasıyla ele alacağız. Her adımda gerekli veri değişikliği, servis, API, anlamlı davranış kontrolü ve istek/yanıt örneği birlikte tamamlanacak. Bir modülü yalnızca dosyaları açıldı diye bitmiş saymayacağız. Her ekranda gerekebilecek boş, süresi dolmuş, yetkisiz ve başarısız durumları da sözleşmeye girecek.

Frontend yazmadan Faz 1 akışlarını HTTP istekleri, örnek dosyalar ve birden fazla test kullanıcısını temsil eden scriptlerle çalıştıracağız. Oyun simülasyonları Faz 2'dedir. Mobil cihaz davranışı, kamera entegrasyonu ve gerçek mağaza satın alma gibi istemciye bağlı kontroller frontend entegrasyonunda ayrıca doğrulanacak; script kontrolleri bunların yerine geçmiş sayılmayacak.

Harici servis gereken alanlar: giriş, medya depolama, push ve abonelik doğrulama. Bunların sağlayıcı/hesap/anahtar ihtiyacını 1. adımda listeleyeceğiz. Anahtar eksikse yerel taklitle geliştirilen alanı ayrıca işaretleyeceğiz; gerçek entegrasyon tamamlanmış sayılmayacak. Bir alandaki harici eksik, bağımsız backend işlerini durdurmayacak.

## 1. Ürün kurallarını ve kapsamı sabitle — Faz 1

**Sorumlu:** Birlikte; ürün kararlarını biz takip ederiz.

- [x] Giriş yöntemlerini seç: e-posta/şifre + Google + Apple; Google/Apple mock kabul edildi.
- [x] Kullanıcı adı/parola/oturum geliştirme varsayımlarını ve harici servis ihtiyaçlarını karar kaydına yaz.
- [ ] Minimum yaş yaklaşımı ve isteğe bağlı profil bilgilerini kesinleştir; dış kullanıcı kaydından önce uygula.
- [ ] Normal oylamada oy değiştirme, sonuç görünürlüğü, yayın sonrası düzenleme ve iptal kurallarını kesinleştir.
- [ ] Plus hakları, haftalık ücretsiz filtre hakkı, dönem sınırı ve iptal/iade davranışını tanımla.
- [ ] Reklamsız Plus ile affiliate üretici hakkının paket ilişkisini seç; trend filtrelerini otomatik ücretli sayma.
- [ ] Trend ölçümü, ürün kimliği, dönem/saat dilimi, örneklem ve fiyat bağlamını belirle; reklam sıklığını yapılandırılabilir tasarla.
- [ ] Hazır yorum etiketlerinin yorum mu yoksa ayrı tepki mi olduğunu ve sayaçlarını belirle.
- [ ] Hesap görünürlüğü gerekirse paylaşım görünürlüğüyle ilişkisini açıkça yaz; onaylı PUBLIC/FRIENDS kuralını sessizce değiştirme.

Oyun süreleri, eksik oy, oyun puanı/lig ve yarışma ödülü kararları Faz 2 adımları 19–23'te kesinleştirilir; Faz 1'i bekletmez.

**Bittiğinde:** aynı duruma farklı API'ler farklı karar vermeyecek. Normal oy tercihtir; çoğunluğu seçme ödülü hiçbir aşamada geri gelmez. Henüz onaylanmayan puan sayıları varsayılan gerçek kural gibi kodlanmaz.

## 2. API'nin ortak davranışlarını tamamla — Faz 1

**Sorumlu:** Biz; arkadaş mevcut altyapıyı kullanır.

- [x] İstek doğrulama, bilinmeyen alanların reddi, tutarlı hata kodları ve request ID.
- [x] Kimliği doğrulanmış kullanıcıyı servislere aktarma ve hesap durumu kontrolü.
- [x] Ortak limit/cursor yardımcıları, UTC tarih biçimi ve JSON için 64 KiB sınırı.
- [ ] Liste endpoint'lerinde sayfalama entegrasyonu ve medya dosya sınırları; ilgili modülde uygulanacak.
- [x] Hassas yanıtlarda no-store; e-posta ve mock kimlikten tekil kullanıcı.
- [ ] Faz 1 kaynak oluşturma komutları için kalıcı idempotency servisi; oyun komutları Faz 2'de aynı altyapıyı kullanacak.
- [x] OpenAPI/Swagger ve çalışan auth için örnek HTTP istekleri.
- [x] Ortam değişkenlerinin açılışta kontrolü; yerel/test ortamlarının ayrımı.

**Bittiğinde:** sonraki özellikler aynı istek, hata ve sayfalama standardını kullanır. Mobil için ayrı ayrı tahmin edilecek yanıt şekilleri oluşmaz.

## 3. Giriş ve oturumları bitir — Faz 1

**Sorumlu:** Biz; mevcut yerel auth korunur.

- [x] E-posta/şifre ile kayıt/giriş ve yerel kullanıcı oluşturma; doğrulanmadan giriş yok.
- [x] E-posta/mock issuer+subject tekilliği; aynı kimlikten çift kullanıcı oluşmaması.
- [x] Oturum yenileme, çıkış ve tüm cihazlardan çıkış; refresh tekrarında ilgili oturumu kapatma.
- [x] Tek kullanımlık e-posta doğrulama ve şifre sıfırlama; yerel posta taşıyıcısı; IP istek sınırı.
- [x] Eksik profilin ilk kuruluma yönlendirilmesi için durum bilgisi.
- [x] Askıya alınmış/silinmiş kullanıcı erişiminin kapanması.
- [x] Google/Apple geliştirme mock'u; açık bayrak olmadan kullanılamaz.
- [ ] Gerçek Google/Apple token doğrulaması, güvenli hesap bağlama ve gerçek e-posta teslimi.
- [ ] Çok instance limiter, hesap bazlı deneme kontrolü ve gerçek PostgreSQL auth yarış testleri.

**Bittiğinde:** gerçek giriş kanıtıyla API kullanılabilir; süresi dolmuş veya geçersiz oturum reddedilir. Sağlayıcının zaten sunduğu oturum işlerini ikinci bir sistemle çoğaltmayacağız.

## 4. Kullanıcı profili ve ayarlarını bitir — Faz 1

**Sorumlu:** Biz.

- [x] Kullanıcı adı uygunluğu, görünen ad, bio ve stil etiketleri.
- [x] Avatar yükleme/önizleme onayı ve profile bağlama/kaldırma; medya API'si.
- [x] İsteğe bağlı yaş grubu, cinsiyet/şehir bilgileri ve izin tercihleri; kamusal yanıttan ayrım. Değişiklikler için transaction içinde kalıcı olay kaydı; trend tüketicisi 13. adımda.
- [x] Kendi profili, başkasının profili ve profil düzenleme.
- [x] Paylaşım/arkadaş/puan sayaçlarının sözleşmesi; henüz oluşmamış veride sıfır/boş davranışı.
- [ ] Paylaşımlar ve kişisel kaydedilenler sekmelerinin sayfalı API'leri; ilgili özellik tamamlandıkça bağla. Yarışma geçmişi Faz 2'de eklenir.
- [x] Bildirim/gizlilik ayarları için kullanıcı tercihlerini saklama/okuma. Push, blur ve paylaşım varsayılanlarının tüketimi ilgili modüllerde bağlanır.

Çalışan uçlar ve bağlantısı bekleyen alanlar: [profil/ayar rehberi](users-development.md). Ayrı kapalı hesap politikası eklenmedi.

**Bittiğinde:** profil ekranının temel bilgileri ve ayarları API'den gelir; özel alanlar başka kullanıcıya sızmaz. Lig ve rozetler 22. adımda bu profile bağlanır.

## 5. Arkadaşlık, kullanıcı arama ve engellemeyi bitir — Faz 1

**Sorumlu:** Biz.

- [x] Kullanıcı adıyla arama, arkadaş isteği gönderme ve iptal etme.
- [x] Gelen/giden istekler; kabul, red, arkadaş listesi ve arkadaşlıktan çıkarma.
- [x] Çift/ters istek, kendine istek ve yinelenen kabul davranışı.
- [x] Kullanıcı engelleme/engeli kaldırma ve engellenenler listesi.
- [x] Ortak SocialAccessService, profil ve medya bağlantısı. Paylaşım/yorum uçları kendi adımlarında aynı servise bağlanacak; henüz mevcut değiller.
- [x] Engel ve arkadaşlık değişince özel yayın erişiminin kapanması; erişim servisi ve profil sayaçlarında gerçek sosyal HTTP komutlarıyla doğrulandı.

Sosyal değişiklik ve kalıcı outbox olayı aynı transaction'dadır. Bildirim tüketimi 12. adımda bağlanır. [Çalışan sosyal API ve varsayımlar](social-development.md).

**Bittiğinde:** A ile B arkadaşken özel paylaşımı C göremez. Arkadaşlıktan çıkma ve engelleme sadece arayüzde kart gizlemekten ibaret kalmaz.

## 6. Fotoğraf hattını bitir — Faz 1

**Sorumlu:** Biz.

- [x] Yerel yükleme izni, yükleme tamamlama ve sahiplik kontrolü.
- [x] Gerçek dosya türü, boyut/piksel sınırı, thumbnail/display üretimi ve EXIF temizleme.
- [x] Manuel seçilen bölgelerde yüz bulanıklaştırma, kullanıcı önizlemesi ve açık onay.
- [ ] Otomatik yüz tespit sağlayıcısı/modeli; mobil bölge seçme ve önizleme ekranının cihaz üzerinde doğrulanması.
- [x] İşleniyor/hazır/reddedildi durumları ve geçici hatadan yeniden deneme.
- [x] Tamamlanmış fotoğrafın yeniden kullanılan upload linkiyle değiştirilememesi.
- [x] Arkadaş içeriğine yetkili erişim; orijinal dosyaların dışarı açılmaması. DB fixture'larıyla gerçek sosyal HTTP komutlarına karşı doğrulandı; oylama yayını 8. adımda bağlanacak. Oyun fotoğrafı erişimi Faz 2'de bağlanır.
- [x] Kullanılmamış/silinen dosyalar için tekrar çalıştırılabilir yerel temizlik komutu; kullanımda medya korunur.
- [ ] Özel bulut deposu, ayrı işçi/kuyruk ve periyodik temizlik zamanlaması; canlı entegrasyon.

Yerel akış sonraki oylama adımına hazırdır; bütün medya/otomatik blur entegrasyonu tamamlandı denmez. Sınırlar ve servis sözleşmesi: [medya rehberi](media-development.md).

**Bittiğinde:** kullanıcı fotoğraf yükler, işlenmiş halini görür ve yayınlayabilir. Bulanıklaştırma hatasında orijinal dosya sessizce paylaşılmaz. Aynı hat oylama ve podyumda kullanılır.

## 7. Ürün kimliği ve link altyapısını tamamla — Faz 1

**Sorumlu:** Arkadaş; ortak şema entegrasyonunu biz koordine ederiz.

- [ ] Ortak ürün kataloğunu seçenek başına ProductTag'den ayır; aynı ürünün farklı paylaşımlarda birleştirilmesi.
- [ ] Mağaza/ürün kimliği veya normalize URL ile çözümleme; isimden belirsiz eşleşme ve kişinin kendi taslak etiket/eşleşmesinde manuel seçim veya bilgi düzeltme. Ortak ürünün üzerine yazma yetkisi vermez.
- [ ] Varyant, fiyat zamanı, para birimi ve eşleşmeyen link davranışı.
- [ ] Özgün dış/affiliate linkini ortak ürün kimliğinden ayrı koruma; normal ve ticari link beyanı/doğrulama sözleşmesi.
- [ ] Linkten otomatik ürün bilgisi alma için desteklenen kaynaklar ve başarısızlıkta kullanıcı girişi; her mağazaya otomatik entegrasyon varsaymama.

Bu adım biz 4–6'yı geliştirirken arkadaş tarafından paralel tamamlanabilir. İlk ortak ürün/etiket şema sözleşmesi erken birleştirilir.

İlk katalog teslimi çözümleme ve eşleşmedi/belirsiz durumda kullanıcı beyanını taşımadır. Bu beyan otomatik olarak doğrulanmış ortak ürün olmaz; ayrı kalıcı öneri tablosu ilk teslim için zorunlu değildir. Ortak ürün düzeltme/birleştirme API'si ortak yönetici yetkisiyle 16. adımda eklenir. Yönetici yetkisini biz, katalog yönetim API'sini arkadaş sağlar; ilk teslim bu altyapıyı beklemez.

**Bittiğinde:** farklı paylaşımlardaki aynı ürün tanınabilir; affiliate linkler ürün kimliğini çoğaltmaz. Trendleri hesaplayacak ilişki tercih API'si geliştirilirken dikkate alınır. Ücretli kullanım hakkı 14. adımda bağlanır.

## 8. Kombin oylaması oluşturmayı bitir — Faz 1

**Sorumlu:** Biz; arkadaşın katalog ve hak servislerini kullanır.

- [ ] Taslak oluşturma, düzenleme ve silme; 2–4 fotoğraflı seçenek.
- [ ] Soru, kategori, kullanım amacı ve süre seçenekleri.
- [ ] Seçenek başına ürün adı/marka/fiyat/para birimi/link etiketleri; bağlantı doğrulama.
- [ ] Herkese/arkadaşlara paylaşım; yorum izni ve hazır görsel kontrolü.
- [ ] Atomik yayınlama, süre başlatma, yayın sonrası sabit alanlar ve iptal.
- [ ] Kendi paylaşım listesi ve detay okuma.

**Bittiğinde:** ekranlardaki yeni oylama formu temel haliyle API'den yönetilir. Gelişmiş kitle filtreleri 14. adımda etkinleşir. Ürünler dış bağlantıdır; sepet/ödeme kapsamı eklenmez.

## 9. Tercih oyu, kapanış ve sonuçları bitir — Faz 1

**Sorumlu:** Biz; trend veri sözleşmesini arkadaşla birlikte uygularız.

- [ ] Kullanıcı başına tek tercih; kendi paylaşımına oy yasağı.
- [ ] Aynı isteğin tekrarı, başka oylamanın seçeneği ve yetkisiz oy kontrolleri.
- [ ] Süre dolunca oy kabulünü durdurma; kapanış işi gecikse de geç oy almama.
- [ ] Toplam oy, seçenek sayıları/yüzdeleri, kullanıcının tercihi ve anlık/kesin sonuç ayrımı.
- [ ] Beraberlik ve hiç oy gelmemesi.
- [ ] Sonuç görüntüleme izni ve oylama sahibi için sonuç erişimi.
- [ ] Trendler için seçilen seçenek–ürün ilişkisi ve gereken oy zamanı bağlamı; doğrudan ürün tercihiyle kombin tercihinin ayrımı, yinelenen sayımın önlenmesi.

**Bittiğinde:** paylaş → başka kullanıcı tercih yapsın → sonuç gör akışı tamamlanır. Normal oy profil puanı yazmaz.

## 10. Ana akış ve keşfi bitir — Faz 1

**Sorumlu:** Biz; reklam servisini 15. adımda bağlarız.

- [ ] Herkes/arkadaşlar akışları ve kategori filtreleri.
- [ ] Seçilen kitlenin oy uygunluğu ve kalan süre bilgisi.
- [ ] Oy verilmiş, kapanmış, engellenmiş veya görünmez içeriğin doğru davranışı.
- [ ] Kararlı sayfalama; akış yenilendiğinde tutarlı sıralama.
- [ ] Geçme davranışı; başlangıçta oturum içi geçiş yeterliyse gereksiz kalıcı kayıt oluşturmama.
- [ ] Boş akış ve dar filtrede sonuç bulunamaması yanıtları.

**Bittiğinde:** ana ekran başka kullanıcılardan gelen gerçek oylamalarla çalışır. İlk sıralama anlaşılır ve basit olur; kişiselleştirme sonraki veriyle geliştirilir.

## 11. Yorumlar, hazır tepkiler ve kaydetmeyi bitir — Faz 1

**Sorumlu:** Biz.

- [ ] Yorum ekleme, sayfalama, kendi yorumunu silme ve izin verilen düzenleme davranışı.
- [ ] Yorumları kapatma; eski yorumların görünürlüğü ve yeni yorum kabulünün ayrımı.
- [ ] Ekrandaki hazır yorum/tepki etiketleri; tekilleştirme ve sayaçlar.
- [ ] Kaydet/kaydı kaldır; kişisel kaydedilenler listesi.
- [ ] Silinmiş/özel hale gelmiş/engellenmiş içerikte yorum ve kayıt davranışı.
- [ ] Paylaşım/yorum/kullanıcı şikâyetini kaydetme; yönetim tarafı 16. adımda.

**Bittiğinde:** sosyal etkileşim ekranları ve sayaçları çalışır; kaydetmek yeni bir görüntüleme izni sağlamaz. Yorum yanıtları istenirse burada ayrı veri modeliyle eklenir, mevcut ekranlardan zorunlu özellik sayılmaz.

## 12. Bildirimleri bitir — Faz 1

**Sorumlu:** Biz.

- [ ] Uygulama içi bildirim listesi, okunmamış sayı ve okundu işlemleri.
- [ ] Arkadaş isteği/kabul, paylaşım yorumu ve oylama sonucu olayları.
- [ ] Cihaz/installation kaydı, çıkışta token temizliği ve bildirim tercihleri.
- [ ] Push entegrasyonu, geçersiz token temizleme, tekrar deneme ve uygulama açma hedefi.
- [ ] Aynı olaydan yinelenen uygulama içi kayıt çıkmaması; özel içeriğin push gövdesine taşınmaması.

Oyun daveti/sonucu, haftalık tema ve ödül bildirimleri Faz 2'de bu altyapıya bağlanır; Faz 1 kabulünü bekletmez.

**Bittiğinde:** bildirim sekmesi çalışır; seçilen push sağlayıcısı test ortamında doğrulanır. Frontend yazılmadan cihaz teslimi doğrulanamıyorsa bu kısım entegrasyon kontrolü olarak açıkça kalır.

## 13. Ürün trendleri ve filtrelerini bitir — Faz 1

**Sorumlu:** Arkadaş; tercih/izin/kaldırma olaylarını biz sağlarız.

- [ ] Günlük/haftalık/aylık dönem; takvim veya kayan pencere, saat dilimi ve güncelleme sıklığını seç.
- [ ] Seçilen kombinlerde etiketli ürünler ile doğrudan ürün tercihlerini ayrı ölç; ham sayı/oran/örneklem sözleşmesi ve sıralama formülü.
- [ ] Tercih yapanların cinsiyet/yaş grubu ve ürünün fiyat aralığı filtreleri; kategori/marka filtrelerini değerlendir.
- [ ] Yalnızca uygun kaynaklar; başlangıç önerisi PUBLIC içerik, FRIENDS içeriğini genel trendlere sessizce katmama.
- [ ] İzin, bilinmeyen demografi, minimum örneklem, küçük hücreler ve filtre kombinasyonlarında kişisel tercih çıkarımını önleme.
- [ ] Tekil sayım, sahte etkileşim, kaldırılan içerik/geri alınan izin ve yeniden hesaplama.
- [ ] Fiyat/demografi değişince geçmişi sessizce yeniden sınıflandırmama; dönem bağlamı politikası.
- [ ] Sayfalı liste/detay, boş/yetersiz veri, ölçüm türü, örneklem ve son güncelleme bilgisi.

Gerçek oy verisi oluşmadan sentetik fixture'larla hesap ve filtreler geliştirilebilir; gerçek trend entegrasyonu 7–9 ve ortak veri sözleşmesini bekler.

**Bittiğinde:** Trendler ekranı seçilen dönem ve filtrelerle çalışır; sonuçlar satın alma/satış veya tekil ürün beğenisi gibi yanlış adlandırılmaz. Ücretli kampanyalar organik sıralamayı değiştirmez. Filtre erişiminin ücretsiz/Plus olması açık ürün kararıdır.

## 14. Plus, affiliate üretici hakkı, hedef kitle ve ayrıntılı sonuçları bitir — Faz 1

**Sorumlu:** Arkadaş abonelik/hak/kota; biz profil/oylama tüketim noktaları, kitle uygunluğu ve oylama sonuç kırılımları. Trend kırılımları arkadaşın 13. adımındadır.

- [ ] Abonelik kaydı, doğrulanmış satın alma/sağlayıcı olayı, yenileme, iptal, süre bitimi, iade ve geri yükleme.
- [ ] Tekrarlanan/geciken olaylar; kullanıcının erişim hakkının sunucuda hesaplanması.
- [ ] Reklamsız Plus hakkını 15. adımdaki reklam yerleşimine bağla; hak bittiğinde/iade olduğunda doğru davranış.
- [ ] Affiliate komisyonu kazanan üreticiler için ücretli kullanım: ayrı paket mi Plus mı, uygunluk, normal linkten ayrım, limit ve eski linklerin davranışı.
- [ ] Trendlerin temel/gelişmiş filtrelerine erişimin ücretli olup olmayacağını ayrıca kararlaştır; varsayılan Plus kilidi üretme.
- [ ] Haftalık ücretsiz hedefleme hakkı, dönem hesabı, kalan hak ve atomik tüketim.
- [ ] Cinsiyet/yaş/benim yaşım/stil filtreleri; eksik profil bilgisi ve birleştirilen filtrelerin anlamı.
- [ ] Arkadaş görünürlüğünün hedefleme filtresiyle genişlememesi; yeterli kitle bulunmaması.
- [ ] Sonuçlarda yaş/cinsiyet kırılımları; Plus için şehir/stil kırılımları ve yetki kontrolü.
- [ ] Küçük örneklem, bilinmeyen bilgi, küçük hücreler ve tekrar sorguyla tercih çıkarımına karşı gösterim kuralları.
- [ ] Abonelik bittikten sonra önceki içerik/sonuç erişiminin seçilen politikaya göre davranması.
- [ ] Tahmini oy sayısı için gerçek veriye dayalı hesap veya veri yetmiyorsa açık bir `unavailable` durumu; 50 oy gibi sabit vaat üretmeme.

Paket/fiyat/sağlayıcı kararı gelene kadar hak sözleşmesi ve testler ilerler; doğrulanmamış satın alma gerçek ücretli hak açmaz.

**Bittiğinde:** Plus rozeti, kilitli alanlar, haftalık hak bilgisi ve hedefleme sunucudan yönetilir. Satın alma mağazası/sağlayıcısı seçilene kadar gerçek ödeme entegrasyonu bitmiş sayılmaz; mobil mağaza akışı ayrıca sandbox'ta doğrulanır.

## 15. Akış reklamlarını ve kampanya ölçümünü bitir — Faz 1

**Sorumlu:** Arkadaş; ana akış yerleşimini birlikte bağlarız.

- [ ] Mağaza/sponsor, reklam kreatifi, hedef linki, yayın dönemi ve kampanya yönetimi.
- [ ] Ana akışta reklam yerleşimi; yaklaşık 10 organik kart sonrası örneğini sabit vaat yerine yapılandırılabilir sıklık/sınır olarak ele al.
- [ ] Reklam/sponsorlu işareti, reklamsız Plus hak kontrolü; reklam yokken normal akış.
- [ ] Gösterim/tıklama ölçümünü tercihlerden ayrı tut; tekrar istekleri tekilleştir ve organik trendi reklamla şişirme.
- [ ] İzinli toplu kampanya raporu; kullanıcıların kişisel tercih kayıtlarını mağazalara açmama.

**Bittiğinde:** Akış kontrollü reklam yerleşimi sunar; aktif reklamsız hakta reklam verilmez. Gerçek mağaza anlaşması, reklam geliri ve affiliate satın alma dönüşümü varmış gibi gösterilmez. Hak ve satın alma entegrasyonu 14. adımla birlikte tamamlanır.

## 16. Yönetim, şikâyet ve hesap yaşam döngüsünü bitir — Faz 1

**Sorumlu:** Biz genel yönetim/şikâyet/hesap yaşam döngüsü; arkadaş ürün, trend, kampanya ve abonelik yönetimi.

- [ ] Yetkili yönetici rolü ve normal kullanıcıdan ayrılmış yönetim API'leri.
- [ ] Şikâyet kuyruğu; paylaşım/yorum/kullanıcı inceleme, kaldırma ve yaptırım.
- [ ] Hesap askıya alma, içerik yaptırımı ve işlem denetim kayıtları.
- [ ] Kategori/stil etiketi, ürün, reklam kampanyası ve abonelik/hak yönetimi; alanın sahibi kendi API'sini yazar, ortak yönetici yetkisini kullanır.
- [ ] Hesap silme: erişimi kapatma, oturum/cihaz/kişisel veri/medya temizliği ve geçmiş sonucun seçilen politikaya göre korunması.
- [ ] Veri saklama ve kullanılmayan dosya/oturum/bildirim/iş kaydı temizleme görevleri.
- [ ] Gerekirse kullanıcı veri dışa aktarımı ve izin geri alma; demografik snapshot'ları da kapsama.

Oyun iptali/oyuncu yaptırımı, ödül düzeltmesi, lig/rozet ve yarışma teması/sponsor etkinliği yönetimi Faz 2'de eklenir.

**Bittiğinde:** uygulama içerik ve kullanıcı sorunları yönetilebilen bir ürün olur. Yönetim panelinin frontend'i daha sonra yazılabilir; API ve yetkileri burada tamamlanır.

## 17. İlgili fazın backend'ini birlikte doğrula ve test ortamına hazırla — Faz 1

**Sorumlu:** Birlikte; her geliştirici kendi modül testini getirir.

- [ ] Tam akışlar: kayıt → profil → arkadaş → özel paylaşım → oy → yorum → sonuç/bildirim.
- [ ] Faz 1: ürün eşleştirme → tercih → dönemli/filtreli trend; affiliate hakkı → reklam/reklamsız Plus → iptal/iade senaryoları.
- [ ] Gerçek çok bağlantılı PostgreSQL'de Faz 1 çift oy/kapanış/hak tüketimi/ölçüm tekilliği.
- [ ] Fotoğraf sahipliği, engel, arkadaşlıktan çıkma, özel sonuç ve medya erişimi testleri.
- [ ] Kuyruk/işçi/API yeniden başlatma, işlem tekrarı ve eksik dış servis senaryoları.
- [ ] Ölçülen yük testi; sorgu/indeks/bağlantı havuzu ve dosya yükleme sınırlarını gerekli yerde düzeltme.
- [ ] Log/hata/iş gecikmesi takibi; token ve özel verinin loglanmaması.
- [ ] Ayrı test ortamı, otomatik kontroller, kontrollü migration süreci, yedekleme ve geri yükleme denemesi.

Faz 2'de bu kabul akışı oyun/puan/haftalık yarışma için tekrar uygulanır; son oda yeri, iki oyun işçisi, çift ödül ve eşleşme iptali testleri o fazdadır.

**Bittiğinde:** yerelde tablo oluşturabilmenin ötesinde, ilgili fazın akışlarının birlikte ve eşzamanlı çalıştığına dair kanıt bulunur. Yerel Prisma Postgres tek bağlantılı olduğundan eşzamanlılık testleri ayrıca gerçek PostgreSQL'de yapılır. Test/üretim yayını gerektiğinde somut sürüm ve ortam hazırlanır; bu plan yayın yapıldığı anlamına gelmez.

## 18. İlgili fazın frontend teslim paketini tamamla — Faz 1

**Sorumlu:** Birlikte; kendi modülünün API örneklerini her geliştirici tamamlar.

- [ ] Güncel OpenAPI ve frontend için üretilmiş API tipleri.
- [ ] Giriş/oturum kullanımı, medya yükleme ve yeniden deneme örnekleri.
- [ ] Her ekran için endpoint/alan eşleştirmesi; boş/hata/kilitli/bitmiş durumlar.
- [ ] Faz 1: ürün/trend/affiliate/reklam/Plus ekranlarının istek, yanıt ve boş/hak yetersiz durumları.
- [ ] Faz 1 demo hesapları: yazar, arkadaş, yabancı, engellenmiş, Plus ve affiliate üreticisi; trend ve reklam verileri. Farklı oyun durumları Faz 2'de.
- [ ] Tekrar üretilebilir test verisi ve HTTP scriptleri; oyun simülasyonu Faz 2'de.
- [ ] Sağlayıcı anahtarı veya mobil cihaz gerektiren açık entegrasyon kontrol listesi; sahte/test/canlı ayrımı.
- [ ] Ekranları besleyen son API kontrolü; kullanılmayan/eksik endpoint'leri ayıklama.

Faz 2'de Socket, yeniden bağlanma, geri sayım, oyun simülasyonu ve yarışma ekranlarının teslimi ayrıca yapılır.

**Bittiğinde:** frontend geliştirirken Faz 1 alanları, hata kodları veya ürün kuralları tahmin edilmeyecek. Mobil cihaz, mağaza satın alma ve push teslim kontrolleri frontend entegrasyonunun kabul işleri olarak ayrıca takip edilecek.

## 19. Arkadaş odası ve podyum oyununu bitir — Faz 2

**Sorumlu:** Faz 2 başlarken yeniden atanacak.

- [ ] Oyuncu sayısı, aşama süreleri, geç teslim, eksik oy, beraberlik ve aktif özel odada engel davranışını kesinleştir.
- [ ] Oda oluşturma, davet, katılma/ayrılma, hazır olma ve yeterli oyuncuyla başlama.
- [ ] Tek aktif oda hakkı; kapasite ve arkadaşlık kontrolleri.
- [ ] Tema açıklama ve 10 dakikalık hazırlık.
- [ ] Fotoğraf teslimi, süre bitiminde yeni teslimi kapatma ve işleme süresi.
- [ ] Geçerli katılımcıları/tur sırasını sabitleme; yetersiz oyuncuda gerekçeli iptal.
- [ ] Kombinleri sırayla sunma; kendi turunda değerlendirmeyi kapatma.
- [ ] 1–5 yıldız + temaya uygunluk; tur başına tek oy ve süre kontrolü.
- [ ] Sonuç hesabı, isimleri açma, oyun geçmişi ve geçerli aktif üyelikleri bırakma.

**Bittiğinde:** birden fazla test oyuncusu API üzerinden baştan sona aynı oyunu tamamlar. Sonuç tek kez oluşur; profil puanı 22. adıma kadar kapalıdır.

## 20. Canlı olaylar ve oyuna dönüşü bitir — Faz 2

**Sorumlu:** Faz 2 başlarken yeniden atanacak.

- [ ] Yetkili oda aboneliği ve duruma göre kullanıcıya özel yanıtlar.
- [ ] Oda/tema/hazırlık/tur/sonuç değişikliklerinin Socket.IO üzerinden bildirilmesi.
- [ ] Sunucu saati, kalan süre ve aşama sürümünün istemciye verilmesi.
- [ ] Bağlantı kopması ve tekrar bağlanma; uygulamanın ön plana dönmesi.
- [ ] Sırasız/yinelenen/kaçan olayların güncel durum okumasıyla düzeltilmesi.
- [ ] Host ayrılması, oyuncu terk etmesi, sunucu/işçi yeniden başlaması ve uzun kesintide iptal.

**Bittiğinde:** canlı oyun telefondaki sayaç veya tek bir socket mesajının ulaşmasına bağlı kalmaz. Tur sırasında gizlenen isimler yanıt ve olaylarda açığa çıkmaz.

## 21. Hızlı eşleşme ve oda keşfini bitir — Faz 2

**Sorumlu:** Faz 2 başlarken yeniden atanacak.

- [ ] Eşleşme talebi, bekleme, iptal ve tek aktif talep.
- [ ] Uygun bekleyen oyunculardan oda oluşturma veya mevcut odaya yerleştirme.
- [ ] Aynı anda son yere katılma, çift oda ataması ve iptal/eşleştirme çakışması.
- [ ] Bekleme süresi dolması, yeterli oyuncu bulunamaması ve tekrar eşleşme.
- [ ] Açık oda sayısı ve ekranlardaki oda türü bilgileri.
- [ ] Kadınlara özel oda seçeneği; katılım uygunluğu ve profil beyanının sınırları.

**Bittiğinde:** hızlı eşleş ve arkadaşlarla oda kur akışlarının ikisi de çalışır. Az kullanıcı varken çok fazla filtreyle eşleşme havuzu gereksiz bölünmez.

## 22. Profil puanı, lig, sıralama ve rozetleri bitir — Faz 2

**Sorumlu:** Faz 2 başlarken yeniden atanacak.

- [ ] Seçilmiş ödül politikasını uygun sonuçlara bağlama; normal tercih oyu ödülsüz kalır.
- [ ] Katılım/kazanma puanları, eksik oy/iptal davranışı ve arkadaş odalarının ödül uygunluğu.
- [ ] Puan hareketleri, toplam, düzeltme/geri alma ve aynı sonucun ikinci kez ödüllendirilmemesi.
- [ ] Lig eşikleri, sonraki lige kalan puan ve sezon/hafta sınırları.
- [ ] Arkadaşlar/genel sıralama; eşit puan, yeni kullanıcı ve dönem sıfırlama.
- [ ] Podyum birinciliği, stil başarısı ve aktif gün serisi gibi seçilmiş rozetler; tanımlı koşullar ve tekil kazanım.
- [ ] Profilde yarışma geçmişi, kazandığı rozetler ve sayaçlar.
- [ ] Tekrar tekrar aynı kişilerle oynayarak puan üretme ve anlaşmalı oyları izleme/ödül uygunluğu kuralları.

**Bittiğinde:** profil ve yarışma merkezi gerçek toplam/lig/sıralama gösterir. Formül seçilmeden tahmini sabit puanlar canlıya açılmaz.

## 23. Haftalık tema ve sponsorlu yarışmaları bitir — Faz 2

**Sorumlu:** Faz 2 başlarken yeniden atanacak.

- [ ] Tema, açıklama, kapak, başlangıç/katılım/oylama/bitiş saatleri.
- [ ] Fotoğrafla katılım, kişi başına hak, katılım listesi ve seçilen oylama yöntemi.
- [ ] Süre bitiminde sonucu kesinleştirme; beraberlik, elenme ve boş etkinlik davranışı.
- [ ] Kazananlar, profil yarışma geçmişi, varsa puan/rozet ve sonuç bildirimleri.
- [ ] Sponsor/marka bilgileri ve etkinliğe ürün/kolleksiyon bağlama.
- [ ] Ödül/indirim kodu envanteri, hak sahibi, tekil dağıtım ve ödül kontenjanında beraberlik kuralı.
- [ ] Yönetimden etkinlik hazırlama/yayınlama/iptal etme; kampanya ilerlerken kritik kuralları sabit tutma.

**Bittiğinde:** yarışma merkezindeki haftalık ve sponsorlu kartların tamamı backend verisinden gelir. Haftalık yarışma canlı podyumdan ayrı çalışır.

## Ekran kapsamı kontrolü

| Ekran/özellik | Adımlar |
| --- | --- |
| Kayıt/giriş ve profil | 3–4 |
| Herkes/arkadaşlar, kategori, paylaşım kartları | 5, 8, 10 |
| Fotoğraf, yüz bulanıklaştırma, 2–4 seçenek ve ürün etiketleri | 6–8 |
| Ortak ürün kimliği, normal/affiliate link ayrımı | 7–8, 14 |
| Tercih, yüzdeler, toplam oy, kapanış | 9 |
| Yorum, hazır etiketler, kaydetme | 11 |
| Bildirim sekmesi ve tercihler | 12 |
| Günlük/haftalık/aylık trendler, cinsiyet/yaş/fiyat filtreleri | 7, 9, 13 |
| Plus, ücretsiz filtre hakları ve ayrıntılı sonuçlar | 14 |
| Reklamlar ve reklamsız Plus | 14–15 |
| Şikâyet, yönetim ve hesap silme | 11, 16 |
| Faz 1 doğrulama ve frontend teslimi | 17–18 |
| Faz 2 oda, podyum, canlı olaylar, hızlı eşleşme | 19–21 |
| Faz 2 puan/lig/rozet ve haftalık/sponsorlu yarışma | 22–23 |

## Uygulama sırası

**Faz 1 entegrasyon sırası:** 1–3 ortak temel/giriş → 4 profil → 5 sosyal → 6 medya → 7 ürün kataloğu → 8 paylaşım → 9 tercih/sonuç → 10 akış → 11 yorum/kaydetme → 12 bildirim → 13 trendler → 14 Plus/affiliate hakları → 15 reklamlar → 16 yönetim/hesap yaşam döngüsü → 17 doğrulama → 18 frontend teslimi.

**Paralel başlangıç:** Biz 4. adıma, arkadaş 7. adımın ürün/link sözleşmesine başlar. Katalog bağımsız geliştirilir; oylama kayıtlarına doğrudan yazmaz. Sonraki paralel teslimler [iki kişilik planda](two-developer-plan.md) açıklanır.

**Faz 2:** 19 arkadaş odası/podyum → 20 canlı olaylar → 21 hızlı eşleşme → 22 oyun puanı/lig → 23 haftalık/sponsorlu yarışma → Faz 2 test ve frontend entegrasyonu. Mevcut oyun tabloları korunur; önceki oyun görevi aktif iş değildir.

Bir sonraki ürün işi bizim tarafta **8: oylama taslağı ve yayınlama**, arkadaş tarafında **7: ürün kataloğu ve link eşleştirme**. Yerel profil/sosyal/medya akışları hazır; otomatik yüz tespiti, bulut medya ve diğer gerçek sağlayıcı entegrasyonları ayrıca takip edilir. Ürün/oy/izin sözleşmeleri erken birlikte netleştirilir. Açık ürün kararları ilgili özellikten önce seçilir.
