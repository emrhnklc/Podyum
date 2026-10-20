# Trendler API'si — 7. adım

20 Ekim 2026. `GET /v1/trends` oturumlu kullanıcılara gerçek, toplu ürün sıralaması verir. Veri [tercih katkısı hattından](trend-pipeline-development.md) gelir. [Mobil bağlantı](../../mobile/docs/trends-api-integration.md) 8. adımda tamamlandı; filtre çubuğu ve satır tasarımı korunur.

## İstek

```http
GET /v1/trends?period=WEEK&date=2026-10-20&category=SHOES&gender=WOMAN&ageBand=AGE_18_24&currency=TRY&minPriceMinor=10000&maxPriceMinor=200000&limit=20
Authorization: Bearer ACCESS_TOKEN
```

| Alan | Davranış |
| --- | --- |
| period | DAY / WEEK / MONTH; varsayılan WEEK |
| date | Dönemin içindeki İstanbul tarihi, YYYY-MM-DD; varsayılan bugün. Gerçek takvim tarihi, 2017 sonrası ve gelecekte olmayan tarih gerekir |
| category | OUTFIT / SHOES / BAG / JEWELRY / ACCESSORY / TATTOO; yayın anındaki ürün kategorisi |
| brand | 1–100 karakter, trim sonrası yayın anı markasıyla tam ve büyük/küçük harfe duyarlı eşleşme |
| gender | WOMAN / MAN / NON_BINARY / UNSPECIFIED; oy verenin izinli oy anı cinsiyeti; verilmezse genel |
| ageBand | AGE_18_24 / AGE_25_34 / AGE_35_PLUS; oy verenin izinli oy anı yaş grubu; verilmezse genel |
| currency | TRY / EUR / USD / GBP; varsayılan TRY. Tek para birimi, kur çevrimi yok |
| minPriceMinor / maxPriceMinor | Yayın anındaki ürün fiyatı, en küçük para birimi; dahil sınırlar. 10000 TRY = 100 TL. Negatif/kesirli tutar veya ters aralık reddedilir |
| limit / cursor | 1–50, varsayılan 20; sonraki sayfada aynı filtreler ve önceki nextCursor |

Gün İstanbul takvim günü, hafta pazartesi–pazartesi, ay takvim ayıdır. Üst tarih sınırı hariçtir. Sunucunun yerel saat dilimi sonucu değiştirmez. Cursor ile devam ederken tarih yazılmamışsa ilk sayfanın günü korunur; gece yarısı yeni döneme atlamaz. Gelecek oy dahil edilmez.

## Ölçüm, örneklem ve fiyat

Ölçüm **seçilen kombinlerdeki ürünlerdir**; doğrudan ürün oyu, satış veya tıklama değildir. `score`, dönem içindeki hesap/ürün/İstanbul günü başına ilk uygun tercihlerin toplamıdır. `distinctVoters`, o ürünün seçili filtrelerdeki ayrı hesap sayısıdır. Örneğin aynı 5 kişinin iki farklı gün seçimi score=10, distinctVoters=5 üretir. Bütün gerçek kombin tercihleri asıl tabloda korunur.

Günlük ilk uygun sinyal **filtrelemeden önce** belirlenir. İlk tercihin demografisi izinsizse aynı günün sonraki izinli tercihini kullanarak bağlam üretilmez. Yaş/cinsiyet filtresi varsa yanıt `population=CONSENTED_VOTER_SNAPSHOT` olur; genel yanıt `GENERAL_PREFERENCES` olur. Genel toplam, izin vermeyenlerin ve silinmiş hesapların anonim geçmiş tercihlerini de kapsayabilir. Filtreli alt örneklem bütün kullanıcıları temsil eden bir yüzdeye çevrilmez.

**Her ürün, seçili filtrelerden sonra en az 5 ayrı hesap** gerektirir. Aynı dört kişinin yüz katkısı bu eşiği geçmez. Eşik altındaki ürünün kimliği, sırası ve kesin sayıları döndürülmez; gizlenen ürün sayısı/toplamı da verilmez. Bu bir asgari örneklem kuralıdır; istatistiksel anonimlik veya diferansiyel gizlilik garantisi değildir.

| status | Ekranın göstereceği durum |
| --- | --- |
| NO_DATA | Seçili dönemde/filtrelerde uygun sinyal yok |
| INSUFFICIENT_SAMPLE | Sinyal var, fakat hiçbir ürün 5 ayrı hesap eşiğine ulaşmıyor |
| READY | En az bir ürün yayımlanabilir; yalnız eşiği geçenler items içinde |

Fiyat aralığı yayın snapshot'ını kullanır (`priceBasis=PUBLICATION_SNAPSHOT`). Fiyatı bilinmeyen ürün, aralık verilmemişse sayılabilir; aralık varsa dışlanır. Filtre para birimleri birbirine dönüştürülmez.

`item.product` güncel etkin ortak katalog kaydıdır (`productBasis=CURRENT_CATALOG`): ad/marka/kategori, mağaza, güvenilir ürün bağlantısı ve tarihli güncel fiyat. Güncel fiyatın geçmiş tercih filtresindeki fiyattan farklı olması mümkündür; mobil bunu açıklamalıdır. Güncel katalog fiyatı farklı para birimine geçmişse filtre para birimiyle fiyat etiketi uydurulmaz. Kartta seçilme yüzdesi, önceki sıra değişimi veya olmayan ürün fotoğrafı üretilmez.

## Sayfalama ve veri değişikliği

Sıra: `score DESC`, ardından `distinctVoters DESC`, ardından ürün UUID'si ASC. `rank` bütün yayımlanabilir filtreli listeye göre 1'den başlar; her sayfada sıfırlanmaz. Bu, ödül beraberliği kuralı değildir.

İlk sayfanın DB saati `asOf` üst sınırıdır; yeni oylar mevcut sayfa dizisini ileri itmez, yenilemede görünür. Tek SQL deyimi uygun sinyalleri, eşiği, sıralamayı ve sayfayı aynı DB okuma kesitinde hesaplar. N ürün için N ayrı sorgu yoktur.

Cursor filtre/dönem/hesap kapsamına bağlıdır; sayfa boyutu değişebilir. Güncel yetki/izin/görünürlük/katalog uygunluğu **her okumada** uygulanır. Kamuya döndürülebilir toplamların veya güncel kartların özeti değişmişse `409 TREND_RESULTS_CHANGED` döner. İstemci biriktirdiği sayfaları temizleyip ilk sayfadan yeniler; eski izinli toplamları önbellekten devam ettirmez. 15 dakikadan eski kesitte `409 TREND_PAGE_EXPIRED`, bozuk/farklı filtreli imleçte `400 INVALID_CURSOR` gelir. Cursor yetki veya gizli kimlik anahtarı değildir; içeriğini değiştirerek ham veri/eşik altı ürün açılmaz.

Yanıt `Cache-Control: private, no-store` taşır. `computedAt` hesaplama zamanıdır; tüm outbox olaylarının tamamlandığı anlamına gelmez. `consistency=EVENTUAL`: yeni tercihin trend katkısına dönüşmesi outbox işlemesini bekleyebilir. `latestSignalAt` yalnız döndürülen ürünün seçili katkıları için son oy zamanıdır. İptal/gizleme/arşiv/izin geri alma, kaynak görünümü üzerinden kuyruğu beklemeden geçerli olur.

## Sınırlar ve doğrulama

Filtreler Plus'a kilitlenmedi. Ham katkı, oy veren kimliği, kaynak paylaşım veya bireysel demografi ucu eklenmedi. Bu adım yeni migration, seed, veri sıfırlama, dış mağaza taraması veya ticari hak açmaz.

`npm run test:trends`: kaynak hattı ve HTTP filtre/sıralama testlerini birlikte çalıştırır. `test:api` de ikisini içerir. Gerçek kaynakla eşik, çok günlük puan, zaman sınırları, fiyat/para birimi, izin geri alma, gizleme, arşiv/birleştirme, cursor ve OpenAPI kontrol edilir. Sıralama sorgusunun `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` çıktısından planlama/çalışma süresi ve buffer sayısı test tanısına yazılır.

Sorgu mevcut kaynak/FK/oy ve katkı indekslerini kullanabilen canlı görünümlerden başlar. İlk EXPLAIN ölçümü 3 ürün/5 hesap/15 katkı fixture'ında planlama 38,9 ms, çalışma 1,7 ms, 314 buffer hit / 18 read verdi. Küçük yerel fixture ölçümü, üretim yük kanıtı değildir. Günlük tekilleştirme, birleşme grafiği ve her sayfadaki toplam özeti büyük veri üzerinde ayrıca ölçülmelidir. Bu aşamada ayrı servis/önbellek veya ölçümsüz yeni indeks kurulmadı; 18. adımda çok bağlantılı PostgreSQL ve temsili veriyle gerekirse dönemli ön hesaplama seçilecek. Güncel tam koşu ölçümü yürütme planının teslim kaydına işlenir.

[HTTP örnekleri](../examples/trends.http), [uygulama sırası](backend-implementation-plan-2026-10-19.md).
