# Trendler bağlantısı — 8. adım

20 Ekim 2026. `/trendler` gerçek oturumla `GET /v1/trends` kullanır; `features/trends/data/demo-products.ts` kaldırıldı. Tasarımın filtre çubuğu ve ürün satırları korunur. Liste sırası/sayıları, örneklem yeterliliği ve cursor sunucudan gelir.

## Ekran ve veri

- Bugün / bu hafta / bu ay; kategori, oy verenin izinli oy anı cinsiyeti/yaşı, yayın anındaki marka/fiyat ve para birimi filtreleri.
- Marka yazıldıktan sonra “Markayı uygula” veya klavyede gönder; marka tam ve büyük/küçük harfe duyarlı eşleşir. Filtreyi temizlemek dönemi korur, diğerlerini varsayılana döndürür.
- TRY / EUR / USD / GBP ayrı istenir; kur çevrilmez. 750 altı `maxPriceMinor=74999`, 750–2000 dahil `75000..200000`, 2000 üstü `minPriceMinor=200001`. Etiket seçilen para birimini gösterir.
- Ürün satırı gerçek `rank`, `score` ve `distinctVoters` kullanır. Puan hesap/ürün/İstanbul günü başına en fazla bir katkının dönem toplamıdır; doğrudan ürün oyu/satış değildir. Kombin sayısı veya yüzde/sıra değişimi uydurulmaz.
- Karttaki fiyat, marka ve kategori güncel katalog bilgisidir; filtreler yayın anı snapshot'ını kullanır. Bu fark ekranda açıklanır. Katalogda görsel olmadığı için ürün fotoğrafı yerine simge vardır.
- Satıra dokunmak `/catalog/[id]` açar; burası gerçek `/catalog/products/:id` kullanır. Mağaza adı, tarihli fiyat ve güvenilir `canonicalUrl` varsa “Mağazada gör” çalışır. Rastgele alışveriş araması yoktur. Özgün kombin etiketinin affiliate adresi bu katalog kartından türetilmez; kombin detayındaki etiket kendi özgün bağlantısını korur.

## Yenileme, sayfalama ve gizlilik

`TrendList` tek hesap/filtre kapsamına aittir. İlk sayfa ve “Daha fazla göster”, ortak SessionManager üzerinden Bearer/refresh kullanır. Aynı anda iki sonraki sayfa isteği gönderilmez; satırlar kimliğe göre tekilleşir, sunucu sırası/puanı hesaplanmaz.

Filtre/hesap değişimi, yenileme, ekrandan çıkma veya uygulamanın arka plana geçmesi eski sayfaları kaldırır ve isteği iptal eder. Odak/aktif uygulama dönüşünde yeniden yüklenir. Geç tamamlanan eski istek yeni listeye karışmaz. Sayfa verisi diske kaydedilmez.

`TREND_RESULTS_CHANGED` / `TREND_PAGE_EXPIRED` alınırsa bütün eski sayfalar hemen silinir ve **bir kez cursorsuz ilk sayfa** istenir. Yeni kesit eski sayfalara eklenmez. Yenileme hata verirse eski toplamlar geri gösterilmez; “Tekrar dene” yeni ilk sayfa ister.

| Durum | Davranış |
| --- | --- |
| Oturum yok | Giriş gerekir; demo ürünlere düşmez |
| Yükleniyor | Gösterge; devam/yenileme isteği yinelenmez |
| NO_DATA | “Bu filtrede henüz veri yok” |
| INSUFFICIENT_SAMPLE | “Henüz yeterli katılım yok”; sunucunun en az hesap eşiği açıklanır |
| READY | Yalnız API'nin yayımladığı ürünler |
| Ağ/API hatası | Hata ve “Tekrar dene”; eski cohort toplamı tutulmaz |
| Ürün arşivlenmiş/erişilemiyor | Detay API hatası gösterilir, sahte ürün açılmaz |
| Dış bağlantı açılamıyor | Yerel hata ve tekrar; yalnız HTTP(S), kimlik bilgisi içermeyen katalog URL'si |

Filtreler Plus'a kilitlenmedi; ödeme/affiliate/reklam hakkı üretilmez. Yerel DB'de yeterli kataloglu tercih yoksa boş/yetersiz görünmesi normaldir; gerçek kullanıcı verisine demo trend eklenmez.

## Doğrulama

`npm run test:trends` filtre/para birimi/kuruş sınırları, gerçek cursor, çift istek, geciken yanıt, hesap/filtre iptali, 409 temizleme/yenileme ve hata sonrası tekrar senaryolarını çalıştırır. Bütün mobil testler `npx tsx --test tests/*.test.ts` ile çalışır. Tip/lint, Expo paket uyumu ve üç platform export'u ayrıca denetlenir.

Arayüz kabulü: Chrome web üzerinde gerçek yerel Nest/Prisma ile 21 ürün ve 5 ayrı izinli tercih sahibi; giriş → filtre/sayfalama → ürün detayı/mağaza → izin geri alma/409 → boş/yetersiz → geçici hata/tekrar. Test yalnız kendi geçici hesap/katalog/oy fixture'larını kullanır ve sonunda temizler. Geçici hata ile mağaza sayfası tarayıcıda kontrollü cevaplanır; trend/izin/sıralama/katalog sonuçları gerçek API'dir. Fiziksel iOS/Android, harici mağaza teslimi ve çok bağlantılı yük testi ayrı kalır.

[Backend sözleşmesi](../../backend/docs/trends-api-development.md), [uygulama sırası](../../backend/docs/backend-implementation-plan-2026-10-19.md).
