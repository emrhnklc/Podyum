# Trend veri hattı — 6. adım

20 Ekim 2026. Kataloglu kombin tercihlerinden yeniden üretilebilir trend katkısı hazırdır. [Filtreli/sayfalı Trendler HTTP API'si](trends-api-development.md) 7. adımda eklendi; [mobil örnek verinin kaldırılması](../../mobile/docs/trends-api-integration.md) 8. adımda tamamlandı. Ham katkı ve bireysel demografi HTTP'ye açılmadı.

## Ölçüm ve kurallar

Ölçüm **seçilen kombinlerde yer alan ürünlerdir** (`PRODUCTS_IN_PREFERRED_OUTFITS`). Doğrudan ürün oyu, satış, tıklama veya komisyon değildir. Seçilmeyen seçeneğin ürünü katkı almaz. Elle girilmiş/doğrulanmamış ürün adı veya sonradan onaylanmış öneri, geçmişe katalog eşleşmesi uydurmaz.

**Kullanıcının seçtiği kural:** hesap/ürün başına günde en fazla 1 trend katkısı. Aynı kişinin farklı kombinlerdeki bütün gerçek tercihleri korunur. Gün, `Europe/Istanbul` takvim günüdür; hareketli son 24 saat değildir. Günlük tekilleştirmede ilk uygun tercih seçilir; eşit zamanda poll/tag kimliği sırası kullanılır. İlk tercih artık uygun değilse sıradaki uygun tercih devreye girer. Başka gün yeniden katkı olabilir.

Başlangıç dönem politikası: İstanbul takvim günü, pazartesi başlayan takvim haftası, takvim ayı. Haftalık/aylık puan günlük tekil katkıların toplamıdır; benzersiz hesap sayısı ayrıca ölçülür. Genel API'de ürün/filtre başına en az **5 farklı hesap** olmadan örneklem yayımlamama geliştirme eşiği `TREND_POLICY` içindedir ve 7. adım HTTP toplamasında uygulanır; iç veri hattı 5 kişiyi beklemeden kaynak oluşturur. Para birimleri çevrilmez veya sessizce birleştirilmez.

## Üç veri katmanı

| Kaynak | Sorumluluk |
| --- | --- |
| `PollVote` + yayınlanmış `ProductTag.catalogSnapshot` | Asıl değişmez tercih ve yayın anındaki ürün/fiyat bağlamı |
| `TrendContribution` | `(pollId, voterId, sourceCatalogProductId)` başına yeniden üretilebilir ürün katkısı; URL, isim/e-posta veya demografi kopyası yok |
| `TrendEligibleContribution` / `TrendDailySignal` SQL görünümleri | Güncel uygunluk, katalog birleşmesi ve izin denetimi; ardından hesap/ürün/gün tekilleştirmesi |

`TrendsModule`, mevcut OutboxRegistry'ye `poll.vote.cast` tüketicisini kaydeder. Kaynak kimliklerini olaydan alır; seçeneği, tarihleri veya fiyatı olayın beyanından kopyalamaz. Gerçek vote/option ve yayın snapshot'ını DB'den okur. Katkı ile olayın yayımlandı işareti aynı transaction'dadır. Yinelenen/sırasız olay toplamı şişirmez. Hata normal outbox yeniden deneme/deneme sınırı mekanizmasına girer; payload/demografi loglanmaz.

`TrendContribution` **genel trend toplamı değildir**: gizlenmiş/iptal edilmiş bir yayının doğrulanmış geçmiş kaynak bilgisi burada kalabilir. Genel hesaplama yalnız uygunluk görünümünden, günlük puan ise `TrendDailySignal` üzerinden yapılır. Bu ayrım gizleme/geri açma veya izin geri alma için kuyruk gecikmesine bağımlılığı kaldırır. Ham tabloyu doğrudan gruplayarak kamuya sonuç sunmayın.

## Uygunluk ve silme

| Değişiklik | Uygulanan sonuç |
| --- | --- |
| FRIENDS veya taslak | Kaynak katkısı oluşturulmaz; genel trende girmez |
| PUBLIC + OPEN/CLOSED + VISIBLE | Diğer koşullar uygunsa katkı okunur; süresi bitmiş geçerli geçmiş oylar korunur |
| İptal, gizleme, kaldırma, yazarın askıya alınması/silinmesi | Sonraki okumada derhal dışlanır; eski kuyruk olayı diriltemez |
| Görünürlüğü/hesabı geri açma | Kaynak hâlâ geçerliyse yeniden uygun olur |
| Oy verenin askıya alınması | Askı boyunca dışlanır; geri açma asıl oyu değiştirmez |
| Oy verenin hesabını silmesi | Geçmiş genel katkı anonim hesap tombstone'u üzerinden korunur; demografi kapanır |
| Yazarın kalıcı etiket temizliği | Tag FK cascade ile katkı da silinir; başka kişilerin gerçek oy toplamı silinmez |
| Ürün arşivi veya mağaza kapanması | Etkin genel katalog dışına alınır; kuyruğu beklemez |
| Katalog birleştirme | Eski kaynak kimliği/fiyatı değişmez; etkin son hedefe çözülür. Aynı oydaki iki eski ürün aynı hedefe birleşmişse bir katkı sayılır |

Tercih kendi yazarına ait olamaz; oy zamanı yayın aralığında olmalı, ileri tarih olamaz. Gelişmiş hedefli içerik bu başlangıç ölçümüne girmez. Birleştirme zinciri döngü/derinlik korumalıdır. Eski ürünü bugünkü ad/fiyatla geçmişe yeniden yazmayız.

## Demografi ve izin

Trend tablosunda cinsiyet/yaş tutulmaz. Görünüm, oy anındaki `PollVote` snapshot'ını kullanır; güncel profilin cinsiyet/yaşını eski tercihe taşımaz. Aynı izin dönemi ve güncel açık izin gerekir. Sonradan izin vermek önceki oyları demografik olarak zenginleştirmez. Profil demografisi değişince eski izinli oyun bağlamı korunur.

İzin geri alma mevcut akışta kaynak oy snapshot'ını temizler. Görünüm ayrıca güncel izni, izin dönemini ve hesap durumunu okuduğundan kuyruk tüketilmeden de demografi kapanır. Yeniden izin verme veya eski olayı tekrar işleme silinen bağlamı geri getirmez. Genel tercih sayısı korunur. Günlük ilk uygun tercihin izinli bağlamı yoksa sonraki aynı gün tercihi üzerinden demografi uydurulmaz.

## Kaçan olay / kaynak onarımı

`backend/` içinde:

```bash
npm run trends:rebuild
npm run trends:rebuild -- --poll-id=OY_POLL_UUID --batch-size=50
npm run trends:rebuild -- --apply --poll-id=OY_POLL_UUID
```

Varsayılan yalnız rapor; `--apply` yalnız türetilmiş trend kayıtlarını yeniden kurar. Kullanıcı, tercih, ürün etiketi, fiyat snapshot'ı veya olay makbuzu değiştirilmez. Yerel proje DB koruması geçerlidir. HTTP'den sıradan kullanıcı bu komutu çalıştıramaz.

Bir batch 1–100 tercih inceler. `hasMore=true` ise rapordaki `nextCursor` ile aynı kapsamda `--cursor=...` verilir. Sıra `(pollId, voterId)` şeklindedir; zaman eşitliğinden etkilenmez. Cursor işletim içindir, gizli kimlik veya yetki anahtarı değildir. Kapsam değişirse reddedilir. Değişmeyen kaynak aynı katkı kümesini üretir; tüm tabloyu silip boş bırakma aşaması yoktur. Bir batch atomiktir. Normal tüketiciyle onarım ortak advisory kilidi kullanır.

Bozuk/eksik yayın snapshot'ından bugünkü katalog verisiyle sahte geçmiş üretilmez. Olay tüketimi bu durumda başarısız olup tekrar denenir; onarım `invalidSnapshots` sayısını raporlar ve CLI çıkış kodu 1 olur. Kalıcı sorun kaynak verisi incelemesi gerektirir. Elle etiketler eksik snapshot diye hata sayılmaz, bu ölçümün dışında kalır.

Gösterilen güncel uygunluk kaynak durumuna bağlıdır; onarım birden çok batch sürerken gelen yeni tercihler normal olay hattına da gider. Yarış/yük kanıtı ayrı gerçek çok bağlantılı PostgreSQL aşamasındadır; yerel tek bağlantı testi bunun yerine geçmez.

## Doğrulama ve devam

```bash
npm run test:trends
```

Veri hattına ait 18 HTTP/DB/olay testi: seçilen ürün, tekrar/sırasız olay, donmuş fiyat, özel içerik, oy anı demografisi, izin geri alma/yeniden izin, gizleme/iptal, hesap silme/askı, katalog birleşmesi/mağaza, günlük tek katkı, İstanbul gece yarısı, cursor/dry-run/onarım, bozuk kaynak, outbox rollback/yeniden deneme ve FK/HTTP sınırları. Komut ayrıca 7. adımın 18 Trendler API testini çalıştırır; toplam 36 senaryo genel backend regresyonuna da dahildir.

26. migration tablo ve SQL görünümlerini ekler; `db:deploy` + `db:generate`, reset gerekmez. 7. adımda dönem/yaş/cinsiyet/fiyat/kategori filtreleri, en az örneklem koruması, sabit sıralama/cursor ve ölçüm/zaman sözleşmesi taşıyan [Trendler API'si](trends-api-development.md) eklendi. Mobil 8. adım da tamamlandı; sırada gerçek e-posta teslimi var.
