# Ürün ve oyun kuralları

Bu belgedeki **onaylı** ifadeler kullanıcı konuşmasından gelir. **Öneri** ifadeleri uygulama planını somutlaştıran, değiştirilebilir varsayımlardır. Şema bir davranışın uygulanmış olduğu anlamına gelmez.

**Güncel kapsam:** Kullanıcının son kararıyla günlük podyum ve QR lobileri aktif backend kapsamına geri alındı. Güncel iki mod ve açık kararlar [oyun tasarımında](game-design.md); eski 10 dakika/20 saniyelik tur önerisi geçersizdir. Faz 1'e eklenen trend/affiliate/reklam/Plus fikirleri ve henüz seçilmemiş kuralları [görüşme notunda](mentor-notes-2026-10-10.md) takip edilir.

## 1. Onaylı temel

- Normal oylama kişinin tercihidir. Çoğunluğu seçmeye puan verilmez.
- Arkadaşlara özel kombin sadece arkadaşlara; herkese açık kombin herkese görünür.
- Genel podyum günün seçilecek saatinde 30 dakika fotoğraf + 30 dakika oylamadır. Yalnız o etkinliğe katılanlar oy verebilir. Özel lobiler QR ile paylaşılır; fotoğraf süresi ayarlanabilir veya host erken bitirerek oylamayı başlatabilir. Oylamanın ayrı süresi olacaktır; sınırları henüz seçilmedi. Ortak tema ve kendine oy yasağı korunur; 1–5 yıldız + temaya uygunluk yeni akış için değerlendirme adayıdır.
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

## 4. Günlük podyum ve özel QR lobileri

Bu oyun aktif ilk teslim kapsamındadır; eski ortak sıralı tur modeli kullanılmaz. Ayrıntılı kaynak: [güncel oyun tasarımı](game-design.md).

| Mod | Fotoğraf | Oylama | Geçiş |
| --- | --- | --- | --- |
| Genel günlük etkinlik | Belirlenecek günlük saatte 30 dk | Sonraki 30 dk; yalnız etkinlik katılımcıları | Sunucu takvimi |
| Özel davetli lobi | Hostun seçtiği süre | Ayrı seçilen süre | Süre bitimi veya hostun fotoğraf aşamasını erken bitirmesi |

Önerilen durum: SCHEDULED/WAITING → SUBMISSION_OPEN → VOTING_OPEN → FINALIZING → COMPLETED; aktif aşamalardan gerekçeli CANCELLED. Takvim saat dilimiyle belirlenir; son süreler UTC ve DB saatiyle denetlenir. Host bağlantısının kopması oyunu durdurmaz. Genel takvim işçi gecikmesiyle uzamaz; özel lobide erken geçiş bir kez uygulanır.

Davet token’ı hash olarak saklanır; QR frontend’in göstereceği davet bağlantısını taşır. Giriş/katılım/kapasite/engel denetlenir; QR tek başına üye veya oy sahibi yapmaz. Özel lobide önceden arkadaşlık/host onayı zorunluluğu açık karardır.

İlk öneri: fotoğraf aşamasında kişi başına tek değiştirilebilir kendi READY/onaylı görsel; oylamaya geçince teslimler ve süreler sabit. İsimler oylama kartlarında gizlenir; teslimler sayfalı ve dengeli gösterilir. Genel etkinlik için eski 8 kişi veya ortak 20 saniyelik tur sınırı yoktur. Kişi/teslim başına bir değerlendirme ve kendine oy yasağı korunur.

Yalnız etkinlikte olanların oy vermesi onaylıdır; oy için ayrıca geçerli fotoğraf gerekip gerekmediği, lobi kapasitesi/süre sınırları, değerlendirme yöntemi, minimum örneklem ve sonuç sıralaması netleştirilecek. Eksik oy sıfır sayılmaz; eşitlik ve hiç oy durumları ele alınır. Profil puanı/lig formülü seçilmeden resmî ödül üretilmez. Eski GameRoom/GameRound şeması yeni oyun davranışını karşılamak için ayrı migration ile gözden geçirilecek.

## 5. Profil puanı ve lig

Kombine verilen 1–5 yıldız `GameRating.stars` alanıdır. Hesapta birikecek puan ayrı `PointsLedger` kaydıdır; normal oy buraya kayıt oluşturmaz.

Ödül politikası seçilince oda `rulesVersion` ve `rulesSnapshot` ile o anki kuralları saklar. Gelecekte kural değişse bile eski oyunun hesabı değişmez. Kaynak olay, kullanıcı ve ödül türü bir kere uygulanır. Düzeltmeler eski kaydı değiştirmek yerine referanslı karşı hareketle yapılır.

Kalıcı toplam, haftalık lig, rozet ve seri aynı metrik değildir. Sezon tablosu ve rozet tanımları ihtiyaç olduğunda eklenir. Kazanma/katılım için hayali sabit ödüller bugün tanımlanmadı.

## 6. Haftalık tema

Canlı podyumdan farklı, eşzamanlı olmayan yarışmadır. `Challenge`, `ChallengeEntry`, `ChallengeVote` modeli sonraki aşamada eklenecek. Bir haftalık etkinlikte sürekli açık oda varmış gibi `GameRoom` kullanılmaz. Kimlerin oy vereceği, kaç giriş hakkı olduğu ve yarışmanın hangi yöntemle sıralanacağı henüz açık karardır.

## 7. Kesinleştirilecek kararlar

1. Minimum yaş politikası ve gerçek giriş sağlayıcısı yapılandırmaları; giriş yöntemleri seçildi.
2. Önerilen oylama kuralları: oy değiştirmeme, sonuç görünürlüğü ve yayın sonrası sabit alanlar.
3. Günlük saat/saat dilimi; lobi kapasitesi/süre sınırları; QR katılım koşulu, geçerli fotoğraf/oy uygunluğu, eksik oy ve eşitlik politikası.
4. Profil puanı, lig dönemi ve özel odaların ödül uygunluğu.
5. Plus özellikleri, ücretsiz hak dönemi ve kitle eşleşmesi.
6. Açık/kapalı profil gerekip gerekmediği; oylama görünürlüğü zaten ayrı alan.

Bu kararlar temel ilişkileri tasarlamayı engellemez. İlgili özelliği dış kullanıcıya açmadan önce kesinleştirilmeleri gerekir.
