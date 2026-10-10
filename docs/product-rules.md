# Ürün ve oyun kuralları

Bu belgedeki **onaylı** ifadeler kullanıcı konuşmasından gelir. **Öneri** ifadeleri uygulama planını somutlaştıran, değiştirilebilir varsayımlardır. Şema bir davranışın uygulanmış olduğu anlamına gelmez.

**Güncel kapsam:** 10 Ekim mentör görüşmesiyle oyun/podyum Faz 2'ye ertelendi. Bu belgedeki oyun kuralları sonraki fazın tasarımıdır. Faz 1'e eklenen trend/affiliate/reklam/Plus fikirleri ve henüz seçilmemiş kuralları [görüşme notunda](mentor-notes-2026-10-10.md) takip edilir.

## 1. Onaylı temel

- Normal oylama kişinin tercihidir. Çoğunluğu seçmeye puan verilmez.
- Arkadaşlara özel kombin sadece arkadaşlara; herkese açık kombin herkese görünür.
- Podyumda ortak tema, yaklaşık 10 dakika hazırlık, fotoğraf yükleme ve oyuncuların birbirini 1–5 yıldızla değerlendirmesi vardır. Oyuncu kendine oy veremez.
- Profilde birikecek puanın kuralı henüz seçilmedi. Tema oyunlarından kazanılması düşünülüyor.
- E-posta/şifre, Google ve Apple girişleri isteniyor. Google/Apple için yerel mock kabul edildi; gerçek sağlayıcı entegrasyonu henüz yok.

İlk geliştirme kararları ve açık konular: [karar kaydı](implementation-decisions.md). Çalışan giriş davranışı: [auth geliştirme rehberi](auth-development.md).

## 2. Oylama — başlangıç önerileri

```text
DRAFT → OPEN → CLOSED
  └────→ CANCELLED
        OPEN → CANCELLED
```

Moderasyon durumu `VISIBLE/HIDDEN/REMOVED` ayrı tutulur. Kaldırılmış bir oylama açık olsa bile oy kabul etmez. Başlangıçta kaldırılan içeriğin yeniden yayınlanması yoktur.

| Konu | Önerilen kural |
| --- | --- |
| Kimlik | İlk sürümde uygulamaya giriş gerekir; açık web paylaşımı ayrı özellik |
| Arkadaşlık | İstek + karşı tarafın kabulü; karşılıklı ilişki |
| Seçenekler | Yayın anında 2–4; her biri yayınlanabilir bir fotoğraf taşır |
| Süre | 30 dakika, 2 saat, 24 saat; yayınlandığında başlar |
| Oy hakkı | Kullanıcı/oylama başına tek oy; kendi paylaşımına oy veremez |
| Oy değiştirme | İlk sürümde yok; aynı seçeneğe tekrar istek aynı başarılı sonucu verir |
| Sonuç | Yazar görebilir; diğerleri oy verdikten sonra veya kapanınca görür |
| Yayın sonrası değişiklik | Soru, fotoğraf, seçenek, kitle, görünürlük, süre ve ürün etiketleri sabit |
| Yorum | Yazar yorumları kapatabilir; yeni yorum durur, eski görünür yorumlar kalır |
| Kapanış | Süre dolunca oy durur; işçinin gecikmesi süreyi uzatmaz |
| Eşitlik | Tüm birinciler eşit gösterilir; yapay kazanan seçilmez |
| Hiç oy yok | Yüzdeler 0, kazanan yok |
| Arkadaşlıktan çıkma | Yeni erişim durur; eski oy toplamda kalır |
| Kaydetme | Sadece kaydeden kullanıcı görebilir; kaydetmek yeni erişim hakkı sağlamaz |
| İptal | Yeni etkileşim kapanır; yazar durumunu görür, normal akıştan çıkar |

Yüzdeler ham sayılardan hesaplanır. Yuvarlama nedeniyle toplamı %100 yapacak sunum gerekirse en büyük kalan yöntemi kullanılır; ham sayılar değiştirilmez.

## 3. Kitle ve görünürlük

`visibility` kimin içeriği görebildiğidir. `audience` kimin oy verebildiğidir. Arkadaş filtresi görünürlüğü belirler; cinsiyet/yaş/stil filtresi görünürlüğü genişletemez.

İlk çalışan API için `audienceGender=ANY`, yaş filtresi boş, stil filtresi kapalı önerilir. Diğer alanlar şemada ayrılmıştır; servis desteklenmeyen kuralları reddeder. Plus ve ücretsiz hak tüketimi hazır olmadan UI filtreleri çalışıyor gibi gösterilmez.

Demografik bilgi isteğe bağlı, kullanıcı beyanıdır. Bilgisi eksik kişi daraltılmış kitleye otomatik dahil edilmez. Bu beyan kimlik doğrulaması sayılmaz. Yaş grupları ekranlardan alınmış taslaktır; minimum yaş politikası belirlenmeden dış kullanıcı kaydı açılmaz.

Sonuç kırılımları için öneri: sadece izin verilen toplu istatistikler; başlangıç eşiği grup başına 10 oy. Bu eşik tek başına anonimlik garantisi değildir: küçük seçenek hücreleri, tamamlayıcı gruplar ve art arda sorgulayarak fark alma da değerlendirilmeden istatistik özelliği açılmaz.

## 4. Canlı podyum — durum makinesi

```text
WAITING → PREPARING → PROCESSING → VOTING → CALCULATING → COMPLETED
    └──────── her aktif aşamadan gerekçeli CANCELLED ─────────┘
```

| Aşama | Sunucunun yaptığı |
| --- | --- |
| WAITING | Katılım, oda kapasitesi ve hazır olma; tema henüz gizli |
| PREPARING | Tema açıklanır; öneri 600 saniye; fotoğraf teslimi açık |
| PROCESSING | Yeni teslim yok; süresinde alınmış fotoğrafların işlenmesine öneri 30 saniye ek süre |
| VOTING | Geçerli teslimlerin rastgele sıralanmış, DB'ye kaydedilmiş turları; tur başına öneri 20 saniye |
| CALCULATING | Kalıcı değerlendirmelerden sonuç hesabı; yeni oy yok |
| COMPLETED | Sonuçlar ve isimler açılır; varsa ayrı ödül politikası uygulanır |
| CANCELLED | Gerekçe gösterilir; ödül yok |

**Oda büyüklüğü önerisi:** en az 3, en fazla 8 oyuncu. İlk alpha için 4 oyuncuyla oynanabilirlik ölçülmeli; sayılar yapılandırılabilir. 8 fotoğraf × 20 saniye yaklaşık 160 saniye oylamadır; hazırlık ve işlemeyle toplam deneyim 13 dakika civarındadır.

### Başlama ve katılım

- Arkadaş odasında başlangıç komutunu host verir; yeterli ve hazır katılımcı gerekir. Hızlı eşleşmede sunucu aynı koşullarla başlatır.
- Arkadaş odasına katılmak için host ile mevcut arkadaşlık ve davet gerekir. Davet kodu tek başına yetki sağlamaz; DB'de düz metin yerine hash tutulur.
- Oda başladıktan sonra yeni oyuncu alınmaz. Aynı kişi iki aktif odada bulunamaz.
- Host oyun başlamadan ayrılırsa oda iptal edilir; oyun başladıktan sonra sunucu yönetir, host bağlantısına bağımlı kalmaz.
- Arkadaşlık/engel değişikliğinin aktif özel odaya etkisi ürün kararıdır. Alpha varsayımı: katılımcılar arasında yeni engel oluşursa ödülsüz iptal; genel kullanıma çıkmadan kural kesinleştirilecek.

### Fotoğraf teslimi

- Hazırlık bitmeden upload-complete işlemi sunucu tarafından kabul edilmiş ve sabit dosya sürümüyle eşleşmiş olmalı. Sadece yükleme linki almak teslim sayılmaz.
- Hazırlık sürerken kendi teslimini değiştirebilir; son kabul edilen teslim geçerlidir. Sonradan başlayan dosya yüklemesi grace süresinden faydalanamaz.
- İşleme aşaması bitince `READY` ve önizlemesi kabul edilmiş teslimler yarışmaya alınır; oyuncu listesi ve tur sırası dondurulur.
- Geçerli teslim sayısı minimumun altındaysa oyun iptal edilir. İşleme hatasıyla elenen kullanıcıya gerekçe gösterilir.
- Sonradan silinen/uygunsuz bulunan yarışma fotoğrafı için alpha davranışı oyunu ödülsüz iptal etmektir. Kesinleşmiş sonuçta yaptırım/ödül geri alma ayrı yönetim işlemidir.

### Tur ve değerlendirme

- Her geçerli teslim bir turdur. Yarışmacı kendi turunu görür ama değerlendirme düğmesi kapalıdır.
- Diğer geçerli yarışmacılar tur başına bir kez 1–5 yıldız ve `themeFits` gönderir.
- Tur sırasında isim, avatar, profil bağlantısı ve toplam puan dönmez. Kişi fotoğraftan tanınabilir; tam anonimlik iddia edilmez.
- Aynı değerlendirmenin tekrar gönderilmesi başarılı yanıtı tekrar verir; farklı içerikle değiştirme reddedilir.
- İlk sürümde herkes erken oy verse de tur planlanan süresinde kapanır; yeniden deneme/zamanlama karmaşası azaltılır.
- Bağlantısı kopan oyuncu süre devam ederken geri dönebilir. Süre durdurulmaz; eski tura sonradan oy veremez.
- Aktif oyun sırasında ayrılmak mevcut geçerli teslimi ve önceki oyları silmez; üyelik oyun bitene kadar aktif kalır. Bu, tekrar eşleşerek çoklu oda açmayı önler.

### Sonuç hesabı — henüz kesin ürün kararı değil

Alpha önerisi: `ortalama = ratingSum / ratingCount`; süre aşımı eksik oydur, sıfır yıldız değildir. `themeFits` ayrı oran olarak gösterilir, yıldızları otomatik düşürmez.

Önerilen asgari katılım: her teslim için `ceil(0.70 × (qualifiedCount - 1))` değerlendirme. En az bir teslim bu eşiği geçemiyorsa oyun yine sona erer fakat genel kazanan/sıralama üretilmez; alınan oy sayısı ve değerlendirmeler gösterilir. Eşiğin geçilmesi tam adalet garantisi değildir; oyuncu terkleri ve anlaşmalı oylar ayrıca izlenecektir.

Sıralama varsa ortalamalar tam sayı toplamları çapraz çarpılarak karşılaştırılır; gösterim yuvarlaması kazananı değiştirmez. Eşit ortalamaya eşit derece verilir (`1,1,3`). Tur sırası veya teslim saati gizli eşitlik bozucu değildir.

**Alpha sonuçları `official=false` ve otomatik profil puanı kapalıdır.** Ödüllü rekabet açılmadan önce katılım eşiği, yarım bırakma davranışı, puan formülü ve arkadaş odalarının ödül hakkı kararlaştırılmalıdır.

## 5. Profil puanı ve lig

Kombine verilen 1–5 yıldız `GameRating.stars` alanıdır. Hesapta birikecek puan ayrı `PointsLedger` kaydıdır; normal oy buraya kayıt oluşturmaz.

Ödül politikası seçilince oda `rulesVersion` ve `rulesSnapshot` ile o anki kuralları saklar. Gelecekte kural değişse bile eski oyunun hesabı değişmez. Kaynak olay, kullanıcı ve ödül türü bir kere uygulanır. Düzeltmeler eski kaydı değiştirmek yerine referanslı karşı hareketle yapılır.

Kalıcı toplam, haftalık lig, rozet ve seri aynı metrik değildir. Sezon tablosu ve rozet tanımları ihtiyaç olduğunda eklenir. Kazanma/katılım için hayali sabit ödüller bugün tanımlanmadı.

## 6. Haftalık tema

Canlı podyumdan farklı, eşzamanlı olmayan yarışmadır. `Challenge`, `ChallengeEntry`, `ChallengeVote` modeli sonraki aşamada eklenecek. Bir haftalık etkinlikte sürekli açık oda varmış gibi `GameRoom` kullanılmaz. Kimlerin oy vereceği, kaç giriş hakkı olduğu ve yarışmanın hangi yöntemle sıralanacağı henüz açık karardır.

## 7. Kesinleştirilecek kararlar

1. Minimum yaş politikası ve gerçek giriş sağlayıcısı yapılandırmaları; giriş yöntemleri seçildi.
2. Önerilen oylama kuralları: oy değiştirmeme, sonuç görünürlüğü ve yayın sonrası sabit alanlar.
3. Podyum oyuncu sayısı, tur süresi, eksik oy ve eşitlik politikası.
4. Profil puanı, lig dönemi ve özel odaların ödül uygunluğu.
5. Plus özellikleri, ücretsiz hak dönemi ve kitle eşleşmesi.
6. Açık/kapalı profil gerekip gerekmediği; oylama görünürlüğü zaten ayrı alan.

Bu kararlar temel ilişkileri tasarlamayı engellemez. İlgili özelliği dış kullanıcıya açmadan önce kesinleştirilmeleri gerekir.
