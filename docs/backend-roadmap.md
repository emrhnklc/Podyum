# Backend çalışma planı

10 Ekim 2026. Amaç: Faz 1 sosyal kombin, ürün trendleri ve gelir özelliklerinin backend'ini tamamlayıp frontend'e teslim etmek; ardından Faz 2 oyun/rekabet kapsamına geçmek. Bu belge yapılacak iş listesidir; kutuların boş olması işlevin henüz tamamlanmadığı anlamına gelir. Mimari ayrıntılar ayrı belgelerde kalır.

**Mentör görüşmesiyle güncellenen öncelik:** Oyun/podyum en sona, **Faz 2**'ye alındı. Günlük/haftalık/aylık ürün trendleri, cinsiyet/yaş/fiyat filtreleri, affiliate kullanan üreticilere ücretli hak, akış reklamları ve reklamsız Plus Faz 1 ürün planına eklendi. Ayrıntılı not ve açık kararlar: [mentör görüşmesi](mentor-notes-2026-10-10.md).

Mevcut adım numaraları belge referansları bozulmasın diye korunmuştur; numara artık tek başına çalışma sırası değildir. **12–16 Faz 2'dir.** 17–20 ve yeni 7A/11A/11B işleri Faz 1'de oyun öncesinde uygulanır. Faz 1'in test ve frontend teslimi Faz 2'yi beklemez.

## Mevcut durum

- [x] NestJS başlangıcı, health endpoint'leri ve özellik klasörleri.
- [x] Prisma şeması, yerel veritabanı, beş migration ve demo kayıtları.
- [x] Veritabanı hedef kontrolü, 13 ilişkisel bütünlük testi ve HTTP sağlık kontrolü.
- [ ] Giriş, profil, sosyal oylama ve yarışma ürün akışları.

**İlk uygulama ilerlemesi:** Ortak API altyapısı ve yerel auth tamamlandı. E-posta/şifre akışı HTTP ile doğrulandı; Google/Apple mock. Gerçek OAuth ve e-posta gönderimi tamamlanmış sayılmıyor. [Karar kaydı](implementation-decisions.md), [auth kullanımı](auth-development.md).

Hazır şema başlangıçtır; şikâyet, lig, haftalık etkinlik, abonelik gibi alanlar ilgili adımda yeni migration'larla eklenecek. Generated dosyalar elle düzenlenmeyecek.

## Çalışma yöntemi

Adımları belgenin sonundaki güncel Faz 1/Faz 2 uygulama sırasıyla ele alacağız. Her adımda gerekli veri değişikliği, servis, API, anlamlı davranış kontrolü ve istek/yanıt örneği birlikte tamamlanacak. Bir modülü yalnızca dosyaları açıldı diye bitmiş saymayacağız. Her ekranda gerekebilecek boş, süresi dolmuş, yetkisiz ve başarısız durumları da sözleşmeye girecek.

Frontend yazmadan akışları HTTP istekleri, örnek dosyalar ve birden fazla test kullanıcısını/oyuncuyu temsil eden scriptlerle çalıştıracağız. Mobil cihaz davranışı, kamera entegrasyonu ve gerçek mağaza satın alma gibi istemciye bağlı kontroller frontend entegrasyonunda ayrıca doğrulanacak; script kontrolleri bunların yerine geçmiş sayılmayacak.

Harici servis gereken alanlar: giriş, medya depolama, push ve abonelik doğrulama. Bunların sağlayıcı/hesap/anahtar ihtiyacını 1. adımda listeleyeceğiz. Anahtar eksikse yerel taklitle geliştirilen alanı ayrıca işaretleyeceğiz; gerçek entegrasyon tamamlanmış sayılmayacak. Bir alandaki harici eksik, bağımsız backend işlerini durdurmayacak.

## 1. Ürün kurallarını ve kapsamı sabitle

- [x] Giriş yöntemlerini seç: e-posta/şifre + Google + Apple; Google/Apple mock kabul edildi.
- [x] Kullanıcı adı/parola/oturum geliştirme varsayımlarını ve harici servis ihtiyaçlarını karar kaydına yaz.
- [ ] Minimum yaş yaklaşımı ve isteğe bağlı profil bilgilerini kesinleştir; dış kullanıcı kaydından önce uygula.
- [ ] Normal oylamada oy değiştirme, sonuç görünürlüğü, yayın sonrası düzenleme ve iptal kurallarını kesinleştir.
- [ ] Podyum oyuncu sayısı, hazırlık/tur süresi, geç teslim, eksik oy ve beraberlik davranışını seç.
- [ ] Kombine verilen yıldız ile profilde kazanılan puanı ayır; hangi oyunların puan üreteceğini belirle.
- [ ] Haftalık tema katılım/oylama yöntemi, lig dönemi, rozet koşulları ve seri davranışını tanımla.
- [ ] Plus hakları, haftalık ücretsiz filtre hakkı, dönem sınırı ve iptal/iade davranışını tanımla.
- [ ] Reklamsız Plus ile affiliate üretici hakkının paket ilişkisini seç; trend filtrelerini otomatik ücretli sayma.
- [ ] Trend ölçümü, ürün kimliği, dönem/saat dilimi, örneklem ve fiyat bağlamını belirle; reklam sıklığını yapılandırılabilir tasarla.
- [ ] Hazır yorum etiketlerinin yorum mu yoksa ayrı tepki mi olduğunu ve sayaçlarını belirle.
- [ ] Hesap görünürlüğü gerekirse paylaşım görünürlüğüyle ilişkisini açıkça yaz; onaylı PUBLIC/FRIENDS kuralını sessizce değiştirme.

**Bittiğinde:** aynı duruma farklı API'ler farklı karar vermeyecek. Normal oy tercihtir; çoğunluğu seçme ödülü hiçbir aşamada geri gelmez. Henüz onaylanmayan puan sayıları varsayılan gerçek kural gibi kodlanmaz.

## 2. API'nin ortak davranışlarını tamamla

- [x] İstek doğrulama, bilinmeyen alanların reddi, tutarlı hata kodları ve request ID.
- [x] Kimliği doğrulanmış kullanıcıyı servislere aktarma ve hesap durumu kontrolü.
- [x] Ortak limit/cursor yardımcıları, UTC tarih biçimi ve JSON için 64 KiB sınırı.
- [ ] Liste endpoint'lerinde sayfalama entegrasyonu ve medya dosya sınırları; ilgili modülde uygulanacak.
- [x] Hassas yanıtlarda no-store; e-posta ve mock kimlikten tekil kullanıcı.
- [ ] Paylaşım/oyun komutları için kalıcı idempotency servisi; ilk kaynak oluşturma komutunda uygulanacak.
- [x] OpenAPI/Swagger ve çalışan auth için örnek HTTP istekleri.
- [x] Ortam değişkenlerinin açılışta kontrolü; yerel/test ortamlarının ayrımı.

**Bittiğinde:** sonraki özellikler aynı istek, hata ve sayfalama standardını kullanır. Mobil için ayrı ayrı tahmin edilecek yanıt şekilleri oluşmaz.

## 3. Giriş ve oturumları bitir

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

## 4. Kullanıcı profili ve ayarlarını bitir

- [ ] Kullanıcı adı uygunluğu, görünen ad, bio ve stil etiketleri.
- [ ] Avatar yükleme bağlantısı; medya adımıyla birlikte tamamlanır.
- [ ] İsteğe bağlı yaş grubu, cinsiyet/şehir bilgileri ve izin tercihleri; kamusal yanıttan ayrım.
- [ ] Kendi profili, başkasının profili ve profil düzenleme.
- [ ] Paylaşım/arkadaş/puan sayaçlarının sözleşmesi; henüz oluşmamış veride sıfır/boş davranışı.
- [ ] Paylaşımlar, kişisel kaydedilenler ve yarışma geçmişi sekmelerinin sayfalı API'leri; ilgili özellik tamamlandıkça bağla.
- [ ] Bildirim/gizlilik ayarları için kullanıcı tercihleri.

**Bittiğinde:** profil ekranının temel bilgileri ve ayarları API'den gelir; özel alanlar başka kullanıcıya sızmaz. Lig ve rozetler 15. adımda bu profile bağlanır.

## 5. Arkadaşlık, kullanıcı arama ve engellemeyi bitir

- [ ] Kullanıcı adıyla arama, arkadaş isteği gönderme ve iptal etme.
- [ ] Gelen/giden istekler; kabul, red, arkadaş listesi ve arkadaşlıktan çıkarma.
- [ ] Çift/ters istek, kendine istek ve yinelenen kabul davranışı.
- [ ] Kullanıcı engelleme/engeli kaldırma ve engellenenler listesi.
- [ ] Görünürlük kontrolünü profil, paylaşım, yorum ve medyanın ortak kullanması.
- [ ] Engel ve arkadaşlık değişince sonraki özel içerik erişiminin kapanması.

**Bittiğinde:** A ile B arkadaşken özel paylaşımı C göremez. Arkadaşlıktan çıkma ve engelleme sadece arayüzde kart gizlemekten ibaret kalmaz.

## 6. Fotoğraf hattını bitir

- [ ] Yükleme izni, yükleme tamamlama ve sahiplik kontrolü.
- [ ] Gerçek dosya türü, boyut/piksel sınırı, thumbnail/display üretimi ve EXIF temizleme.
- [ ] Yüz bulanıklaştırma, kullanıcı önizlemesi ve onayı.
- [ ] İşleniyor/hazır/reddedildi durumları ve yeniden deneme davranışı.
- [ ] Yayınlanmış fotoğrafın yeniden kullanılan upload linkiyle değiştirilememesi.
- [ ] Arkadaş içeriği ve oyun fotoğrafına yetkili erişim; orijinal dosyaların dışarı açılmaması.
- [ ] Kullanılmamış yüklemelerin ve silinen içeriğin dosya temizliği.

**Bittiğinde:** kullanıcı fotoğraf yükler, işlenmiş halini görür ve yayınlayabilir. Bulanıklaştırma hatasında orijinal dosya sessizce paylaşılmaz. Aynı hat oylama ve podyumda kullanılır.

## 7. Kombin oylaması oluşturmayı bitir

- [ ] Taslak oluşturma, düzenleme ve silme; 2–4 fotoğraflı seçenek.
- [ ] Soru, kategori, kullanım amacı ve süre seçenekleri.
- [ ] Seçenek başına ürün adı/marka/fiyat/para birimi/link etiketleri; bağlantı doğrulama.
- [ ] Herkese/arkadaşlara paylaşım; yorum izni ve hazır görsel kontrolü.
- [ ] Atomik yayınlama, süre başlatma, yayın sonrası sabit alanlar ve iptal.
- [ ] Kendi paylaşım listesi ve detay okuma.

**Bittiğinde:** ekranlardaki yeni oylama formu temel haliyle API'den yönetilir. Gelişmiş kitle filtreleri 17. adımda etkinleşir. Ürünler dış bağlantıdır; sepet/ödeme kapsamı eklenmez.

## 7A. Ürün kimliği ve link altyapısını tamamla — Faz 1

- [ ] Ortak ürün kataloğunu seçenek başına ProductTag'den ayır; aynı ürünün farklı paylaşımlarda birleştirilmesi.
- [ ] Mağaza/ürün kimliği veya normalize URL ile çözümleme; isimden belirsiz eşleşme ve manuel düzeltme.
- [ ] Varyant, fiyat zamanı, para birimi ve eşleşmeyen link davranışı.
- [ ] Özgün dış/affiliate linkini ortak ürün kimliğinden ayrı koruma; normal ve ticari link beyanı/doğrulama sözleşmesi.
- [ ] Linkten otomatik ürün bilgisi alma için desteklenen kaynaklar ve başarısızlıkta kullanıcı girişi; her mağazaya otomatik entegrasyon varsaymama.

**Bittiğinde:** farklı paylaşımlardaki aynı ürün tanınabilir; affiliate linkler ürün kimliğini çoğaltmaz. Trendleri hesaplayacak ilişki tercih API'si geliştirilirken dikkate alınır. Ücretli kullanım hakkı 17. adımda bağlanır.

## 8. Tercih oyu, kapanış ve sonuçları bitir

- [ ] Kullanıcı başına tek tercih; kendi paylaşımına oy yasağı.
- [ ] Aynı isteğin tekrarı, başka oylamanın seçeneği ve yetkisiz oy kontrolleri.
- [ ] Süre dolunca oy kabulünü durdurma; kapanış işi gecikse de geç oy almama.
- [ ] Toplam oy, seçenek sayıları/yüzdeleri, kullanıcının tercihi ve anlık/kesin sonuç ayrımı.
- [ ] Beraberlik ve hiç oy gelmemesi.
- [ ] Sonuç görüntüleme izni ve oylama sahibi için sonuç erişimi.
- [ ] Trendler için seçilen seçenek–ürün ilişkisi ve gereken oy zamanı bağlamı; doğrudan ürün tercihiyle kombin tercihinin ayrımı, yinelenen sayımın önlenmesi.

**Bittiğinde:** paylaş → başka kullanıcı tercih yapsın → sonuç gör akışı tamamlanır. Normal oy profil puanı yazmaz.

## 9. Ana akış ve keşfi bitir

- [ ] Herkes/arkadaşlar akışları ve kategori filtreleri.
- [ ] Seçilen kitlenin oy uygunluğu ve kalan süre bilgisi.
- [ ] Oy verilmiş, kapanmış, engellenmiş veya görünmez içeriğin doğru davranışı.
- [ ] Kararlı sayfalama; akış yenilendiğinde tutarlı sıralama.
- [ ] Geçme davranışı; başlangıçta oturum içi geçiş yeterliyse gereksiz kalıcı kayıt oluşturmama.
- [ ] Boş akış ve dar filtrede sonuç bulunamaması yanıtları.

**Bittiğinde:** ana ekran başka kullanıcılardan gelen gerçek oylamalarla çalışır. İlk sıralama anlaşılır ve basit olur; kişiselleştirme sonraki veriyle geliştirilir.

## 10. Yorumlar, hazır tepkiler ve kaydetmeyi bitir

- [ ] Yorum ekleme, sayfalama, kendi yorumunu silme ve izin verilen düzenleme davranışı.
- [ ] Yorumları kapatma; eski yorumların görünürlüğü ve yeni yorum kabulünün ayrımı.
- [ ] Ekrandaki hazır yorum/tepki etiketleri; tekilleştirme ve sayaçlar.
- [ ] Kaydet/kaydı kaldır; kişisel kaydedilenler listesi.
- [ ] Silinmiş/özel hale gelmiş/engellenmiş içerikte yorum ve kayıt davranışı.
- [ ] Paylaşım/yorum/kullanıcı şikâyetini kaydetme; yönetim tarafı 18. adımda.

**Bittiğinde:** sosyal etkileşim ekranları ve sayaçları çalışır; kaydetmek yeni bir görüntüleme izni sağlamaz. Yorum yanıtları istenirse burada ayrı veri modeliyle eklenir, mevcut ekranlardan zorunlu özellik sayılmaz.

## 11. Bildirimleri bitir

- [ ] Uygulama içi bildirim listesi, okunmamış sayı ve okundu işlemleri.
- [ ] Arkadaş isteği/kabul, paylaşım yorumu ve oylama sonucu olayları.
- [ ] Cihaz/installation kaydı, çıkışta token temizliği ve bildirim tercihleri.
- [ ] Push entegrasyonu, geçersiz token temizleme, tekrar deneme ve uygulama açma hedefi.
- [ ] Aynı olaydan yinelenen uygulama içi kayıt çıkmaması; özel içeriğin push gövdesine taşınmaması.
- [ ] Oyun daveti/sonucu, haftalık tema ve ödül olaylarını ilgili adımlar tamamlandıkça bağlama.

**Bittiğinde:** bildirim sekmesi çalışır; seçilen push sağlayıcısı test ortamında doğrulanır. Frontend yazılmadan cihaz teslimi doğrulanamıyorsa bu kısım entegrasyon kontrolü olarak açıkça kalır.

## 11A. Ürün trendleri ve filtrelerini bitir — Faz 1

- [ ] Günlük/haftalık/aylık dönem; takvim veya kayan pencere, saat dilimi ve güncelleme sıklığını seç.
- [ ] Seçilen kombinlerde etiketli ürünler ile doğrudan ürün tercihlerini ayrı ölç; ham sayı/oran/örneklem sözleşmesi ve sıralama formülü.
- [ ] Tercih yapanların cinsiyet/yaş grubu ve ürünün fiyat aralığı filtreleri; kategori/marka filtrelerini değerlendir.
- [ ] Yalnızca uygun kaynaklar; başlangıç önerisi PUBLIC içerik, FRIENDS içeriğini genel trendlere sessizce katmama.
- [ ] İzin, bilinmeyen demografi, minimum örneklem, küçük hücreler ve filtre kombinasyonlarında kişisel tercih çıkarımını önleme.
- [ ] Tekil sayım, sahte etkileşim, kaldırılan içerik/geri alınan izin ve yeniden hesaplama.
- [ ] Fiyat/demografi değişince geçmişi sessizce yeniden sınıflandırmama; dönem bağlamı politikası.
- [ ] Sayfalı liste/detay, boş/yetersiz veri, ölçüm türü, örneklem ve son güncelleme bilgisi.

**Bittiğinde:** Trendler ekranı seçilen dönem ve filtrelerle çalışır; sonuçlar satın alma/satış veya tekil ürün beğenisi gibi yanlış adlandırılmaz. Ücretli kampanyalar organik sıralamayı değiştirmez. Filtre erişiminin ücretsiz/Plus olması açık ürün kararıdır.

## 11B. Akış reklamlarını ve kampanya ölçümünü bitir — Faz 1

- [ ] Mağaza/sponsor, reklam kreatifi, hedef linki, yayın dönemi ve kampanya yönetimi.
- [ ] Ana akışta reklam yerleşimi; yaklaşık 10 organik kart sonrası örneğini sabit vaat yerine yapılandırılabilir sıklık/sınır olarak ele al.
- [ ] Reklam/sponsorlu işareti, reklamsız Plus hak kontrolü; reklam yokken normal akış.
- [ ] Gösterim/tıklama ölçümünü tercihlerden ayrı tut; tekrar istekleri tekilleştir ve organik trendi reklamla şişirme.
- [ ] İzinli toplu kampanya raporu; kullanıcıların kişisel tercih kayıtlarını mağazalara açmama.

**Bittiğinde:** Akış kontrollü reklam yerleşimi sunar; aktif reklamsız hakta reklam verilmez. Gerçek mağaza anlaşması, reklam geliri ve affiliate satın alma dönüşümü varmış gibi gösterilmez. Hak ve satın alma entegrasyonu 17. adımla birlikte tamamlanır.

## 12. Arkadaş odası ve podyum oyununu bitir — Faz 2

- [ ] Oda oluşturma, davet, katılma/ayrılma, hazır olma ve yeterli oyuncuyla başlama.
- [ ] Tek aktif oda hakkı; kapasite ve arkadaşlık kontrolleri.
- [ ] Tema açıklama ve 10 dakikalık hazırlık.
- [ ] Fotoğraf teslimi, süre bitiminde yeni teslimi kapatma ve işleme süresi.
- [ ] Geçerli katılımcıları/tur sırasını sabitleme; yetersiz oyuncuda gerekçeli iptal.
- [ ] Kombinleri sırayla sunma; kendi turunda değerlendirmeyi kapatma.
- [ ] 1–5 yıldız + temaya uygunluk; tur başına tek oy ve süre kontrolü.
- [ ] Sonuç hesabı, isimleri açma, oyun geçmişi ve geçerli aktif üyelikleri bırakma.

**Bittiğinde:** birden fazla test oyuncusu API üzerinden baştan sona aynı oyunu tamamlar. Sonuç tek kez oluşur; profil puanı 15. adıma kadar kapalıdır.

## 13. Canlı olaylar ve oyuna dönüşü bitir — Faz 2

- [ ] Yetkili oda aboneliği ve duruma göre kullanıcıya özel yanıtlar.
- [ ] Oda/tema/hazırlık/tur/sonuç değişikliklerinin Socket.IO üzerinden bildirilmesi.
- [ ] Sunucu saati, kalan süre ve aşama sürümünün istemciye verilmesi.
- [ ] Bağlantı kopması ve tekrar bağlanma; uygulamanın ön plana dönmesi.
- [ ] Sırasız/yinelenen/kaçan olayların güncel durum okumasıyla düzeltilmesi.
- [ ] Host ayrılması, oyuncu terk etmesi, sunucu/işçi yeniden başlaması ve uzun kesintide iptal.

**Bittiğinde:** canlı oyun telefondaki sayaç veya tek bir socket mesajının ulaşmasına bağlı kalmaz. Tur sırasında gizlenen isimler yanıt ve olaylarda açığa çıkmaz.

## 14. Hızlı eşleşme ve oda keşfini bitir — Faz 2

- [ ] Eşleşme talebi, bekleme, iptal ve tek aktif talep.
- [ ] Uygun bekleyen oyunculardan oda oluşturma veya mevcut odaya yerleştirme.
- [ ] Aynı anda son yere katılma, çift oda ataması ve iptal/eşleştirme çakışması.
- [ ] Bekleme süresi dolması, yeterli oyuncu bulunamaması ve tekrar eşleşme.
- [ ] Açık oda sayısı ve ekranlardaki oda türü bilgileri.
- [ ] Kadınlara özel oda seçeneği; katılım uygunluğu ve profil beyanının sınırları.

**Bittiğinde:** hızlı eşleş ve arkadaşlarla oda kur akışlarının ikisi de çalışır. Az kullanıcı varken çok fazla filtreyle eşleşme havuzu gereksiz bölünmez.

## 15. Profil puanı, lig, sıralama ve rozetleri bitir — Faz 2

- [ ] Seçilmiş ödül politikasını uygun sonuçlara bağlama; normal tercih oyu ödülsüz kalır.
- [ ] Katılım/kazanma puanları, eksik oy/iptal davranışı ve arkadaş odalarının ödül uygunluğu.
- [ ] Puan hareketleri, toplam, düzeltme/geri alma ve aynı sonucun ikinci kez ödüllendirilmemesi.
- [ ] Lig eşikleri, sonraki lige kalan puan ve sezon/hafta sınırları.
- [ ] Arkadaşlar/genel sıralama; eşit puan, yeni kullanıcı ve dönem sıfırlama.
- [ ] Podyum birinciliği, stil başarısı ve aktif gün serisi gibi seçilmiş rozetler; tanımlı koşullar ve tekil kazanım.
- [ ] Profilde yarışma geçmişi, kazandığı rozetler ve sayaçlar.
- [ ] Tekrar tekrar aynı kişilerle oynayarak puan üretme ve anlaşmalı oyları izleme/ödül uygunluğu kuralları.

**Bittiğinde:** profil ve yarışma merkezi gerçek toplam/lig/sıralama gösterir. Formül seçilmeden tahmini sabit puanlar canlıya açılmaz.

## 16. Haftalık tema ve sponsorlu yarışmaları bitir — Faz 2

- [ ] Tema, açıklama, kapak, başlangıç/katılım/oylama/bitiş saatleri.
- [ ] Fotoğrafla katılım, kişi başına hak, katılım listesi ve seçilen oylama yöntemi.
- [ ] Süre bitiminde sonucu kesinleştirme; beraberlik, elenme ve boş etkinlik davranışı.
- [ ] Kazananlar, profil yarışma geçmişi, varsa puan/rozet ve sonuç bildirimleri.
- [ ] Sponsor/marka bilgileri ve etkinliğe ürün/kolleksiyon bağlama.
- [ ] Ödül/indirim kodu envanteri, hak sahibi, tekil dağıtım ve ödül kontenjanında beraberlik kuralı.
- [ ] Yönetimden etkinlik hazırlama/yayınlama/iptal etme; kampanya ilerlerken kritik kuralları sabit tutma.

**Bittiğinde:** yarışma merkezindeki haftalık ve sponsorlu kartların tamamı backend verisinden gelir. Haftalık yarışma canlı podyumdan ayrı çalışır.

## 17. Plus, affiliate üretici hakkı, hedef kitle ve ayrıntılı sonuçları bitir — Faz 1

- [ ] Abonelik kaydı, doğrulanmış satın alma/sağlayıcı olayı, yenileme, iptal, süre bitimi, iade ve geri yükleme.
- [ ] Tekrarlanan/geciken olaylar; kullanıcının erişim hakkının sunucuda hesaplanması.
- [ ] Reklamsız Plus hakkını 11B reklam yerleşimine bağla; hak bittiğinde/iade olduğunda doğru davranış.
- [ ] Affiliate komisyonu kazanan üreticiler için ücretli kullanım: ayrı paket mi Plus mı, uygunluk, normal linkten ayrım, limit ve eski linklerin davranışı.
- [ ] Trendlerin temel/gelişmiş filtrelerine erişimin ücretli olup olmayacağını ayrıca kararlaştır; varsayılan Plus kilidi üretme.
- [ ] Haftalık ücretsiz hedefleme hakkı, dönem hesabı, kalan hak ve atomik tüketim.
- [ ] Cinsiyet/yaş/benim yaşım/stil filtreleri; eksik profil bilgisi ve birleştirilen filtrelerin anlamı.
- [ ] Arkadaş görünürlüğünün hedefleme filtresiyle genişlememesi; yeterli kitle bulunmaması.
- [ ] Sonuçlarda yaş/cinsiyet kırılımları; Plus için şehir/stil kırılımları ve yetki kontrolü.
- [ ] Küçük örneklem, bilinmeyen bilgi, küçük hücreler ve tekrar sorguyla tercih çıkarımına karşı gösterim kuralları.
- [ ] Abonelik bittikten sonra önceki içerik/sonuç erişiminin seçilen politikaya göre davranması.
- [ ] Tahmini oy sayısı için gerçek veriye dayalı hesap veya veri yetmiyorsa açık bir `unavailable` durumu; 50 oy gibi sabit vaat üretmeme.

**Bittiğinde:** Plus rozeti, kilitli alanlar, haftalık hak bilgisi ve hedefleme sunucudan yönetilir. Satın alma mağazası/sağlayıcısı seçilene kadar gerçek ödeme entegrasyonu bitmiş sayılmaz; mobil mağaza akışı ayrıca sandbox'ta doğrulanır.

## 18. Yönetim, şikâyet ve hesap yaşam döngüsünü bitir

- [ ] Yetkili yönetici rolü ve normal kullanıcıdan ayrılmış yönetim API'leri.
- [ ] Şikâyet kuyruğu; paylaşım/yorum/oyuncu inceleme, kaldırma ve yaptırım.
- [ ] Askıya alma, oyun iptal etme, gerekçeli ödül düzeltmesi ve işlem denetim kayıtları.
- [ ] Tema, kategori, stil etiketi, rozet/lig kuralı, sponsor ve etkinlik yönetimi.
- [ ] Hesap silme: erişimi kapatma, oturum/cihaz/kişisel veri/medya temizliği ve geçmiş sonucun seçilen politikaya göre korunması.
- [ ] Veri saklama ve kullanılmayan dosya/oturum/bildirim/iş kaydı temizleme görevleri.
- [ ] Gerekirse kullanıcı veri dışa aktarımı ve izin geri alma; demografik snapshot'ları da kapsama.

**Bittiğinde:** uygulama içerik ve kullanıcı sorunları yönetilebilen bir ürün olur. Yönetim panelinin frontend'i daha sonra yazılabilir; API ve yetkileri burada tamamlanır.

## 19. İlgili fazın backend'ini birlikte doğrula ve test ortamına hazırla

- [ ] Tam akışlar: kayıt → profil → arkadaş → özel paylaşım → oy → yorum → sonuç/bildirim.
- [ ] Faz 1: ürün eşleştirme → tercih → dönemli/filtreli trend; affiliate hakkı → reklam/reklamsız Plus → iptal/iade senaryoları.
- [ ] Faz 2: tam oyun, puan/lig ve haftalık/sponsorlu yarışma; Faz 1 teslimi bu testleri beklemez.
- [ ] Gerçek çok bağlantılı PostgreSQL'de Faz 1 çift oy/kapanış/hak tüketimi/ölçüm tekilliği; Faz 2 son oda yeri/iki oyun işçisi/çift ödül/eşleşme iptali testleri.
- [ ] Fotoğraf sahipliği, engel, arkadaşlıktan çıkma, özel sonuç ve medya erişimi testleri.
- [ ] Kuyruk/işçi/API yeniden başlatma, işlem tekrarı ve eksik dış servis senaryoları.
- [ ] Ölçülen yük testi; sorgu/indeks/bağlantı havuzu ve dosya yükleme sınırlarını gerekli yerde düzeltme.
- [ ] Log/hata/iş gecikmesi takibi; token ve özel verinin loglanmaması.
- [ ] Ayrı test ortamı, otomatik kontroller, kontrollü migration süreci, yedekleme ve geri yükleme denemesi.

**Bittiğinde:** yerelde tablo oluşturabilmenin ötesinde, ilgili fazın akışlarının birlikte ve eşzamanlı çalıştığına dair kanıt bulunur. Yerel Prisma Postgres tek bağlantılı olduğundan eşzamanlılık testleri ayrıca gerçek PostgreSQL'de yapılır. Test/üretim yayını gerektiğinde somut sürüm ve ortam hazırlanır; bu plan yayın yapıldığı anlamına gelmez.

## 20. İlgili fazın frontend teslim paketini tamamla

- [ ] Güncel OpenAPI ve frontend için üretilmiş API tipleri.
- [ ] Giriş/oturum kullanımı, medya yükleme ve yeniden deneme örnekleri.
- [ ] Her ekran için endpoint/alan eşleştirmesi; boş/hata/kilitli/bitmiş durumlar.
- [ ] Faz 1: ürün/trend/affiliate/reklam/Plus ekranlarının istek, yanıt ve boş/hak yetersiz durumları.
- [ ] Faz 2: Socket olayları, bağlanma/yeniden bağlanma, geri sayım ve state yenileme örnekleri; Faz 1 teslimini bekletmez.
- [ ] Faz 1 demo hesapları: yazar, arkadaş, yabancı, engellenmiş, Plus ve affiliate üreticisi; trend ve reklam verileri. Farklı oyun durumları Faz 2'de.
- [ ] Tekrar üretilebilir test verisi ve HTTP scriptleri; oyun simülasyonu Faz 2'de.
- [ ] Sağlayıcı anahtarı veya mobil cihaz gerektiren açık entegrasyon kontrol listesi; sahte/test/canlı ayrımı.
- [ ] Ekranları besleyen son API kontrolü; kullanılmayan/eksik endpoint'leri ayıklama.

**Bittiğinde:** frontend geliştirirken alan adları, hata kodları veya oyun kuralları tahmin edilmeyecek. Mobil cihaz, mağaza satın alma ve push teslim kontrolleri frontend entegrasyonunun kabul işleri olarak ayrıca takip edilecek.

## Ekran kapsamı kontrolü

| Ekran/özellik | Adımlar |
| --- | --- |
| Herkes/arkadaşlar, kategori, paylaşım kartları | 5, 7, 9 |
| 2–4 fotoğraf, soru, kullanım amacı, süre | 6, 7 |
| Ürün etiketleri ve dış bağlantı | 7 |
| Ortak ürün kimliği, normal/affiliate link ayrımı | 7A, 17 |
| Günlük/haftalık/aylık trendler, cinsiyet/yaş/fiyat filtreleri | 7A, 8, 11A |
| Akış reklamları, kampanya ölçümü ve reklamsız Plus | 11B, 17 |
| Tercih, yüzdeler, toplam oy, kapanış | 8 |
| Yorum, hazır etiketler, kaydetme | 10 |
| Yüz bulanıklaştırma | 6 |
| Cinsiyet/yaş/stil hedefleme, ücretsiz hak | 17 |
| Yaş/cinsiyet sonuçları ve Plus şehir/stil | 17 |
| Hızlı eşleş, arkadaş odası, özel oda türleri | 12–14 |
| Tema, hazırlık, tur, yıldız ve temaya uygunluk | 12–13 |
| Yarışma sonucu, puan, lig ve sıralama | 15 |
| Haftalık ve sponsorlu yarışma | 16 |
| Profil, arkadaş sayısı, sekmeler, rozet ve seri | 4, 5, 10, 15–16 |
| Bildirim sekmesi ve bildirim tercihleri | 11 |
| Şikâyet, engel, hesap silme ve yönetim | 5, 10, 18 |

## Uygulama sırası

**Faz 1:** Kurallar ve API temeli → giriş → profil → arkadaşlık → fotoğraf → paylaşım/ürün kimliği (7–7A) → tercih/sonuç → akış → yorum/kaydetme → bildirim → trendler (11A) → affiliate/Plus hakları ve reklamlar (17 + 11B) → yönetim → Faz 1 testleri → Faz 1 frontend teslimi.

**Faz 2:** Arkadaş odası/podyum (12) → canlı olaylar (13) → hızlı eşleşme (14) → oyun puanı/lig (15) → haftalık/sponsorlu yarışma (16) → Faz 2 test ve frontend entegrasyonu. Önceki oyun görevi bu faza taşınmıştır; mevcut oyun şeması korunur.

Bir sonraki ürün işi **4. adım: profil ve ayarlar**. İlk adımın açık ürün kararları ilgili özellikten önce kesinleştirilecek; gerçek sağlayıcı entegrasyonları ayrıca takip edilecek. Kodlama sırasında tamamlanan kutular işaretlenecek; belirsiz ürün kararları teknik iş bitmiş gibi kapatılmayacak.
