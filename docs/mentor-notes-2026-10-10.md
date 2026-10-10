# Mentör görüşmesi — trendler, affiliate, reklam ve Plus

Tarih: 10 Ekim 2026. Kaynak: kullanıcının mentör görüşmesinden aktardığı fikirler. Bu bir ürün notu ve yapılacak iş kaydıdır; aşağıdaki gelir özellikleri henüz uygulanmadı.

## Güncel öncelik kararı

**Oyun/podyum Faz 2'ye ertelendi.** İlk sürüm sosyal kombin tercihi, ürün etiketleme, trendler ve gelir özellikleri etrafında ilerleyecek. Oda, canlı turlar, Socket.IO oyun olayları, hızlı eşleşme ve oyuna bağlı puan/lig çalışmaları ilk sürümün önkoşulu değil.

Mevcut oyun tabloları ve tasarım belgeleri korunur. Önceki oyun geliştirme sırası ve arkadaşın Claude'una hazırlanan oyun görevi yeni önceliği yansıtmıyor; bu görev Faz 2 için bekletilecek. Haftalık/sponsorlu yarışma da şimdilik yarışma kapsamıyla Faz 2'de tutulur; akışta mağaza reklamı ayrı Faz 1 işidir.

## 1. Affiliate link kullananlar için ücretli kullanım

Mentör önerisi: paylaşımlarındaki ürün linklerinden affiliate komisyonu kazanan içerik üreticilerine, uygulamada bu ticari kullanımı ücretli bir hak olarak sunmak.

- Normal ürün linki ile komisyon kazandıran affiliate link kullanımını ayıracağız.
- Örnekte Zara gibi bir mağazaya yönlendiren link düşünüldü. Bu örnek, ilgili mağazanın mevcut bir affiliate programına veya bizimle anlaşmasına dair doğrulama değildir.
- Komisyonu kazanan üreticiden abonelik/hak ücreti alınması fikrini takip edeceğiz. Uygulamanın affiliate komisyonundan ayrıca pay alması henüz kararlaştırılmadı.
- Bu hak tüketici Plus'ına mı dahil, ayrı üretici paketi mi olacak; ücret, limit ve uygunluk şartları açık karar.
- Affiliate linki yalnızca URL'deki birkaç parametreden kesin tanıyabileceğimizi varsaymayacağız; beyan, desteklenen sağlayıcı ve doğrulama yöntemi belirlenecek.
- İlk sürüm ürünleri dış bağlantıyla açar. Sepet, uygulama içi ürün satışı ve üreticiye komisyon ödeme sistemi bu notla kapsama eklenmez.

## 2. Trendler ekranı

Günlük, haftalık ve aylık dönemde en çok tercih edilen ürünleri listeleyen ayrı bir ekran planlanacak.

Örnek sorular:

- Bugün en çok hangi ürünler seçilmiş?
- Bu hafta kadınların tercih ettiği ürünler neler?
- 18–24 yaş grubunda hangi ürünler öne çıkmış?
- Belirli fiyat aralığında bu ay hangi ürünler daha çok tercih edilmiş?

Filtreler: dönem, tercih yapanların cinsiyeti, tercih yapanların yaş grubu, fiyat aralığı; kategori ve marka filtreleri de değerlendirilecek. Buradaki demografik filtre **ürünü paylaşan kişiyi değil, tercih oyunu verenleri** anlatır.

## 3. Ürünü tanıma ve aynı ürünü birleştirme

Ürün linki veya adı üzerinden hangi kıyafetin etiketlendiğini belirleyip aynı ürünün farklı paylaşımlardaki tercihlerini bir araya getireceğiz.

- Mevcut `ProductTag`, seçenek başına ad/marka/fiyat/link tutuyor; tek başına ortak ürün kataloğu veya trend altyapısı değil.
- Mağaza + doğrulanmış ürün kimliği/temizlenmiş ürün URL'siyle eşleştirme öncelikli aday. Affiliate parametreleri ürün kimliğinden ayrı tutulmalı; kullanıcının özgün yönlendirme linki korunmalı.
- İsimden eşleştirme belirsiz olabilir. Aynı adlı farklı ürünleri otomatik birleştirmeyeceğiz; çözülemeyen ürün için manuel seçim/düzeltme veya eşleşmedi durumu gerekecek.
- Uygulama kapsamı açıklaması: manuel düzeltme kullanıcının kendi taslak etiketi/eşleşmesidir; ortak katalog kaydını değiştirmez. İlk katalog tesliminde admin düzeltme/birleştirme endpoint'i yoktur; ortak yönetici yetkisi geldiğinde ayrı eklenir. Kullanıcı beyanı otomatik olarak doğrulanmış ürün sayılmaz.
- Renk/beden varyantlarının ayrı ürün sayılıp sayılmayacağı ve URL'den bilgi alma yöntemi açık karar. Her mağazadan otomatik veri okunabildiği varsayılmayacak.
- Fiyatın hangi tarihe ait olduğu ve para birimi tutulacak. Farklı para birimleri doğrudan aynı fiyat aralığına karşılaştırılmayacak.

## 4. Trend ölçümünü doğru adlandırma

Normal oy bir kombin/seçenek içindir. Seçilen kombinde üç ürün bulunması, kişinin üç ürünü ayrı ayrı değerlendirdiği anlamına gelmez.

- Başlangıç ölçümü adayı: **seçilen kombinlerde yer alan ürünler**. Bu, doğrudan ürün oyu, satın alma veya satış sayısı değildir.
- Tek ürün karşılaştırmasında doğrudan ürün tercihi ayrı ölçülebilir.
- Ham tercih sayısı, ürünün kaç kez seçeneklerde yer aldığı ve yeterli gösterim/örneklem varsa tercih oranı birbirinden ayrılacak. Trend formülü henüz seçilmedi.
- Aynı ürünün aynı seçenekte birden fazla etiketi ve tekrar gönderilen oylar sayacı çoğaltmamalı. Aynı kullanıcıdan tekrar tercihlerin nasıl sayılacağı ve sahte etkileşim kontrolleri belirlenecek.
- Genel trendlerin kaynak kapsamı için başlangıç önerisi yalnızca uygun PUBLIC içeriklerdir. FRIENDS içeriği sessizce genel trend veya mağaza raporuna katılmayacak.
- Demografik kırılımlar toplu ve izinli veriyle çalışacak. Yetersiz örneklemde sonuç gizlenecek; küçük gruplardan tek kişinin tercihi çıkarılmayacak.
- Gün/hafta/ay için takvim dönemi mi kayan pencere mi kullanılacağı, saat dilimi, son güncelleme zamanı ve minimum örneklem eşikleri açık karar.
- Oy anındaki ürün/fiyat/demografik bağlamın nasıl tutulacağı belirlenecek; sonraki profil veya ürün değişikliği eski tercihleri sessizce yeniden sınıflandırmamalı.

## 5. Mağaza reklamları ve reklamsız Plus

Mentörün gelir hipotezi: trendlerde oluşan ilgi verisi, mağazaların uygulamada reklam vermek istemesini sağlayabilir. Bu bir fırsat hipotezi; mağaza talebi veya reklam geliri garanti değil.

- Ana kombin akışında reklam/sponsorlu kartlar planlanacak.
- Kullanıcının yaklaşık 10 kombin kartından sonra reklam görmesi bir örnek sıklık; kesin, sabit kural değil. Sıklık ve toplam gösterim sınırı yapılandırılacak.
- Reklam açıkça reklam/sponsorlu olarak etiketlenecek. Ücretli gösterim organik trend sıralamasına karıştırılmayacak.
- **Reklamsız kullanım Plus adayıdır.** Hak sunucudan doğrulanacak; Plus aktifken reklam yerleşimi sunulmayacak.
- Reklam gösterimi, tıklama ve kampanya raporlaması ürün tercihinden ayrı tutulacak. Tıklama tek başına satın alma/affiliate komisyonu değildir.
- Reklam yokken akışın normal devam etmesi, tekrar isteklerin sayaçları çoğaltmaması ve kampanya yönetimi planlanacak.
- Mağazalara kişisel oy kayıtları verilmez. İlk kapsam reklam kampanyası yönetimi ve izinli toplu istatistik; ayrı mağaza paneli/veri satışı henüz seçilmedi.

## 6. Plus ve paketlerde açık kararlar

Birbirinden ayrı değerlendirilecek hak adayları:

1. Tüketici için reklamsız Plus.
2. Affiliate kullanan üretici için ücretli ticari link hakkı.
3. Önceden konuşulan hedef kitle ve ayrıntılı sonuç hakları.
4. Trendlerin temel/gelişmiş filtrelerine erişim.

Trendler ekranının veya demografik/fiyat filtrelerinin ücretli olacağı henüz söylenmedi; otomatik olarak Plus kilidi eklenmeyecek. Paketler, fiyat, ücretsiz limitler ve abonelik sonrası eski linklerin davranışı netleştirilecek.

## Yapılacaklar ve sıra

- [ ] Profil → arkadaşlık → medya → kombin/tercih/akış temelini tamamla.
- [ ] Ürün etiketleme geliştirilirken ortak ürün kimliği ve özgün affiliate link ayrımını tasarla.
- [ ] Tercih kaydı geliştirilirken trend için gerekli ilişki ve ölçüm verisini planla; sayaç formülünü seçmeden başarı iddiası üretme.
- [ ] Ürün eşleştirme/katalog ve günlük/haftalık/aylık trend API'leri.
- [ ] Cinsiyet/yaş/fiyat filtreleri, örneklem kuralları ve düzeltme/yeniden hesaplama.
- [ ] Affiliate ticari kullanım hakkı, doğrulama ve ücretlendirme kararı.
- [ ] Reklam kampanyaları, akış yerleşimleri ve ayrı ölçüm olayları.
- [ ] Plus/üretici hakları ve gerçek abonelik doğrulaması; reklamsız akış.
- [ ] Faz 1 yönetim, test ve frontend teslimi.
- [ ] Faz 2: podyum → canlı olaylar → eşleşme → oyun puanı/lig → haftalık/sponsorlu yarışmalar.

Bu not ürün planına eklendi. Uygulama kodu, şema ve migration bu görüşme kaydı nedeniyle değiştirilmedi.
