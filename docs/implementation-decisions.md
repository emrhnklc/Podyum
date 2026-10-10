# İlk geliştirme kararları

10 Ekim 2026. Bu dosya ilk adımın karar kaydıdır. **Onaylı**, kullanıcı tarafından belirtilen karardır. **Geliştirme varsayımı**, yerelde ilerlemek için seçilmiş ve değiştirilebilir davranıştır. Açık ürün kararlarını tamamlanmış saymayız.

## Onaylı

- Normal oy tercih içindir; çoğunluğu bulma puanı yoktur.
- FRIENDS paylaşımını yalnızca kabul edilmiş arkadaşlar; PUBLIC paylaşımını herkes görür.
- Podyum ortak tema, yaklaşık 10 dakikalık hazırlık, fotoğraf teslimi ve karşılıklı yıldız değerlendirmesidir. Canlı kamera yayını değildir.
- Önce backend'i sırayla geliştireceğiz; ikinci geliştirici katıldığında modülleri böleceğiz.
- E-posta/şifre, Google ve Apple girişleri bulunacak. Google/Apple için geliştirme mock'u kabul edildi.
- 10 Ekim mentör görüşmesi sonrası oyun/podyum Faz 2'ye ertelendi; önce sosyal kombin, ürün trendleri ve gelir özellikleri ilerleyecek. Önceki oyun görev dağılımı Faz 2 için bekletilecek.

## Mentör görüşmesiyle eklenen ürün işleri

[Görüşme notu](mentor-notes-2026-10-10.md) affiliate kullanan üreticiler için ücretli kullanım fikrini, günlük/haftalık/aylık ürün trendlerini, tercih yapanların cinsiyet/yaş ve ürün fiyatı filtrelerini, akış reklamlarını ve reklamsız Plus'ı kaydeder. Uygulama işleri planlandı; paket, ücret, trend formülü, reklam sıklığı ve filtrelerin ücretli olup olmayacağı henüz kesinleşmedi.

## Bu sürümde uygulanan varsayımlar

| Alan | Davranış |
| --- | --- |
| Kullanıcı adı | 3–30 karakter; `a-z`, `0-9`, `_`; küçük harfe normalize edilir, tekildir |
| Görünen ad | Kırpıldıktan sonra 1–80 karakter |
| Parola | 15–128 karakter; kırpılmaz; scrypt ile salt'lı hash; body/log/yanıtta geri dönmez |
| E-posta | Kırpılır ve küçük harfe normalize edilir; tekildir; girişten önce doğrulanır |
| Oturum | Opaque Bearer access token 15 dakika; refresh 30 gün mutlak süre; DB'de sadece hash'leri |
| Yenileme | Access ve refresh değişir; önceki access kapanır; kullanılmış refresh yeniden sunulursa aynı cihazın oturumu iptal olur |
| İstemci tekrarı | Aynı oturumu yenileyen istekler istemcide sıraya alınır; refresh otomatik olarak aynı token'la tekrar edilmez |
| Kurtarma | Doğrulama 24 saat, reset 30 dakika; tek kullanımlık; yeni aynı tür bağlantı eskisini geçersiz kılar |
| Şifre değişikliği | Reset bütün cihaz oturumlarını ve önceki doğrulama/reset bağlantılarını kapatır |
| Mock kimlik | Gerçek sağlayıcıdan farklı `mock:google` / `mock:apple` issuer; e-posta ile hesap birleştirme yapılmaz |
| İlk profil | E-posta kaydı ad ve kullanıcı adıyla tamamlanır; mock hesap profil kurulumu bekler |
| Profil düzenleme | Kullanıcı adı/ad/bio ve en fazla 10 sözlük stili; mock ilk kurulumu aynı istekte username+displayName ile tamamlanır |
| Özel profil | Yaş grubu/cinsiyet/şehir isteğe bağlı, yalnız sahibine açık; analiz izni varsayılan false ve açık seçimle değişir |
| Analiz değişikliği | İzin/demografi değişikliği monoton revision ve aynı transaction'da ham demografi içermeyen outbox olayı üretir; trend tüketimi sonraki adımda |
| Ayar varsayılanları | Bildirim tercihleri, yorumlar ve yüz blur tercihi açık; yeni paylaşım görünürlüğü PUBLIC. Medya blur, oylama oluşturma görünürlük/yorum varsayılanını kullanır; push tüketicisi henüz yok |
| Profil erişimi | Oturum gerekir; aktif, iki yönde engel olmayan hedefin kamusal alanları açılır. Paylaşım sayısı izleyicinin erişimine göre hesaplanır |
| Arkadaş isteği | Yönsüz tek çift, açık alıcı kabulü; ters istek otomatik kabul olmaz. Red sonrası yeniden istek açılabilir; bekleme süresi henüz seçilmedi |
| Sosyal tekrar | Aynı gönderim/kabul/red/iptal/kaldırma/engel etkisizse yeni olay yazmaz; userId komutları çiftin mevcut durumuna uygulanır |
| Engel | Arkadaşlığı/bekleyen isteği kaldırır; iki yönlü görünürlük kapanır. Kendi engelini açmak eski ilişkiyi veya karşı tarafın engelini kaldırmaz |
| Sosyal olay | İki kullanıcı UUID sırasıyla kilitlenir; ilişki/engel, socialRevision artışı ve iç outbox olayları aynı transaction'da yazılır. Bildirim işçisi henüz yok |
| Yerel fotoğraf | Özel dosya deposu, Bearer + 15 dakikalık tek kullanımlık upload token, 10 MiB/25 MP sınırı, JPEG/PNG/WebP decode; EXIF'siz WebP display/thumbnail |
| Blur ve önizleme | Otomatik tespit yok; manuel seçilen bölgeler veya açık yüz-yok doğrulaması; READY sonrası kullanıcı onayı olmadan avatar/yayın bağlanamaz |
| Medya değişmezliği | Kaynak sürümü/checksum sabit; READY çıktı değiştirilemez. Aynı complete parametresi tekrar güvenli; geç işleme silinen kaydı canlandıramaz |
| Avatar ve erişim | Onaylı AVATAR purpose kendi profile bağlanır; eski avatar başkasına kapanır. Medya her istekte sosyal erişimi kontrol eder, orijinal dışarı açılmaz |
| Medya temizlik | Süresi dolan yüklenmemiş veya 24 saati geçen kullanılmayan dosyalar yerel komutla silinir; bağlantılı dosyalar korunur. Cron/bulut/worker henüz yok |
| Oylama taslağı | Boş soru ve 0–4 farklı kendi POLL medyası; options güncellemesi bütün liste/ürünleri yeni kimliklerle değiştirir; expectedVersion zorunlu |
| Yayın | Soru + ardışık 2–4 READY/onaylı görsel; 1800/7200/86400 saniye yayın anında DB saatinden başlar; gelişmiş hedefleme kapalı |
| Yayın sonrası | Soru/seçenek/ürün/süre/görünürlük sabit; yorum izni ayrı sürümlü endpoint'ten değişir; yorum API'si henüz yok |
| İptal/silme | DRAFT veya süresi dolmamış OPEN iptal edilebilir; başkasına kapanır. Fiziksel silme yalnız DRAFT; medya ayrıca yönetilir |
| Süre okuması | Süresi dolan OPEN effectiveStatus=CLOSED okunur; kalıcı kapanış/oy/sonuç 9. adımda |
| Ürün beyanı | En fazla 10 ürün/seçenek; özgün http/https link korunur, taranmaz; tamsayı fiyat + sunucu beyan zamanı; katalog kimliği/ücretli affiliate hakkı bağlı değil |
| İşlem tekrarı | Kullanıcı/komut/kaynak/anahtar kapsamında 24 saatlik başarılı yanıt snapshot'ı; payload değişirse 409; iş/makbuz/outbox aynı transaction |
| Oylama kaynak sınırı | En fazla 50 mevcut taslak ve son 24 saatte 100 başarılı oluşturma; geliştirme limiti, Plus kotası değildir |
| Yerel erişim | Varsayılan `127.0.0.1`; dış kullanıcı kaydı ve üretim açılışı henüz kapalı |

E-posta taşıyıcısı `.local/mailbox` altında dosyadır. Bu, gerçek e-posta gönderimi değildir. Dosyada tek kullanımlık token bulunur; HTTP'den servis edilmez, git'e alınmaz. Dosya yazımı başarısızsa kayıt/action transaction'ı geri alınır. İşlem commit edilmeden süreç çökerse dosyada geçersiz bağlantı kalabilir; gerçek taşıyıcıya geçerken kalıcı teslim kuyruğu/yeniden deneme eklenecek.

Profil/ayar API'sinin uygulanan davranışları ve sonraki modüllere kalan bağlantılar: [users rehberi](users-development.md). Kapalı hesap politikası hâlâ açık karardır; ayrı kapalı hesap alanı eklenmedi.

Sosyal API ve ortak erişim servisi çalışır; profil/medya/oylama detay uçları bağlıdır, yorum kendi adımında bağlanır. [Sosyal rehber](social-development.md), [oylama rehberi](polls-development.md). Engel/red olayları otomatik olarak karşı tarafa bildirim göndermez.

## İlgili adım geldiğinde kesinleştirilecekler

| Adım | Karar |
| --- | --- |
| Dış kullanıcı testinden önce | Minimum yaş, kayıt sırasında yaş uygunluğu, gizlilik ve izin metinleri |
| 8–9: oylama | Tek değişmez oy, sonuç görünürlüğü, yayın sonrası sabit alanlar ve iptal önerilerini ürün kararı haline getirme |
| 11: sosyal etkileşim | Hazır etiketler ayrı tepki mi; kişi başına kaç etiket; düzenleme davranışı |
| 19: oyun (Faz 2) | 3–8 oyuncu, 600/30/20 saniye, eksik oy, beraberlik, engel sonrası oda davranışı önerileri |
| 22: puan (Faz 2) | Ödül formülü, arkadaş odası uygunluğu, lig/sezon/rozet/seri koşulları |
| 23: haftalık yarışma (Faz 2) | Katılım hakkı, oylama yöntemi, sponsor ödüllerinde beraberlik |
| 7, 13: ürün/trend | Kimlik, ölçüm türü, dönem/saat dilimi, fiyat ve örneklem kuralları |
| 14–15: gelir | Plus/affiliate paketleri, ücretsiz hak/kota/iade, trend filtrelerine erişim ve reklam sıklığı |
| 4–5: profil/görünürlük | Ayrı kapalı hesap özelliği gerekip gerekmediği; mevcut PUBLIC/FRIENDS kuralı korunur |

Bu kararlar API temelini ve yerel auth'u engellemez. Henüz seçilmemiş ödül/Plus kuralları etkinmiş gibi davranan kod yazılmayacak.

Güncel sahiplik: biz kullanıcı/kombin, arkadaş katalog/trend/gelir. İlk görevler profil ve katalogdur; önceki oyun görevi bekler. [İki kişilik plan](two-developer-plan.md), [güncel Claude metni](friend-claude-task.md).

## Harici entegrasyon listesi

| Alan | Şimdi | Gerçek entegrasyon için gereken |
| --- | --- | --- |
| E-posta | Yerel dosya posta kutusu | Sağlayıcı hesabı, doğrulanmış gönderen, API anahtarı, teslim/yeniden deneme |
| Google | Açıkça etkinleştirilen mock | Mobil/web client ID'leri, gerçek ID token imza/issuer/audience/expiry doğrulaması |
| Apple | Açıkça etkinleştirilen mock | Apple uygulama/servis kimliği, yapılandırma, gerçek token doğrulaması ve iptal olayları |
| Fotoğraf | Özel yerel dosya deposu ve gerçek işleme; manuel bölge blur | Özel bulut deposu/anahtarlar, kuyruk/worker, otomatik yüz tespiti ve mobil önizleme testi |
| Push | Henüz yok | Mobil uygulama kaydı, sağlayıcı bilgileri ve cihaz testi |
| Plus | Henüz yok | Mağaza ürünleri, sunucu satın alma doğrulaması, webhook ve sandbox testleri |

Gerçek Google/Apple bağlandığında mock hesaplar sessizce gerçek hesaba dönüştürülmez. Güvenli hesap bağlama ayrı akıştır. Bir sağlayıcının kendi oturumlarını kullanmaya geçersek yerel oturum sistemiyle sorumlulukları tekrar düzenleyeceğiz.
