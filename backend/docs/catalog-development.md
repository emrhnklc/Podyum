# Ortak ürün kataloğu — ilk çalışan teslim

20 Ekim 2026. Ortak ürün, mağaza, URL eşleştirmesi ve kullanıcıya özel öneri akışı çalışır. Kombin `ProductTag` bağlantısı ve mobil ürün seçimi de [5. adımda tamamlandı](poll-catalog-integration.md); eski elle girilen etiketler korunur. Trend ve affiliate ücretlendirmesi ayrıca yapılacak.

## Veri ve yetki

`CatalogStore` mağaza alan adını ve açıkça bilinen takip parametrelerini tutar. `CatalogProduct` ortak kimlik, mağaza, marka, kategori, varsa harici ürün kimliği/varyant, kaynak, fiyat ve sürüm taşır. Ürün durumu `ACTIVE`, `ARCHIVED` veya `MERGED`; kaynak bu teslimde `ADMIN_REVIEWED` olur. Bu kaynak yönetici incelemesini ifade eder, mağazadan otomatik doğrulama veya stok garantisi değildir.

`CatalogProductUrl` aynı ürüne ait doğrulanmış adresleri tekilleştirir. `CatalogSuggestion` kullanıcının özel beyanıdır: `PENDING` → `APPROVED` / `REJECTED`. Öneri oluşturmak ortak ürünü yaratmaz veya değiştirmez. Öneriyi yalnız sahibi ve ADMIN görür; özgün linki genel kataloğa çıkmaz. Hesap silme öneriyi de temizler; ortak ürün kalır.

Yalnız ADMIN ortak ürün/mağaza yaratır, düzeltir, arşivler ve birleştirir. Yönetim yazmaları `Idempotency-Key`, güncellemede `expectedVersion`, boş olmayan gerekçe, transaction içinde güncel rol kontrolü ve atomik audit/outbox kullanır. Normal kayıt/profil isteğiyle rol alınamaz.

## Çözümleme

`POST /v1/catalog/resolve` URL ve/veya isim alır, veri yazmaz ve ağdan sayfa çekmez:

| Sonuç | Anlamı |
| --- | --- |
| `EXACT` | Normalleştirilmiş adres katalogdaki tekil URL kaydına bağlı |
| `CANDIDATES` | İsim/marka olası ürünler getirdi; kullanıcı seçmeli |
| `UNMATCHED` | Eşleşme yok; özel öneri oluşturulabilir |

Aynı isim otomatik ortak kimlik sayılmaz. `(storeId, externalId, variantKey)` tekildir; harici ürün kimliği bu teslimde yönetici tarafından girilir. Mağazadan ürün kodu/fiyat/isim çıkarmak için scraper veya gerçek mağaza API'si bağlı değildir. Boş katalogda çözümlemenin eşleşmemesi beklenir.

Normalleştirme `www` ve bilinen takip parametrelerini (`utm_*`, `gclid`, vb.; mağazanın belirttiği ek anahtarlar) temizler. Bilinmeyen query ve fragment korunur; bunlar varyant veya sayfa kimliği olabilir. `originalUrl` ayrı kalır. Bu ayrım affiliate hakkı, komisyon veya satış doğrulaması sağlamaz. HTTP/HTTPS dışında adres, kimlik bilgili URL, özel port ve dahili/IP adresleri reddedilir.

Mağaza domain/takip anahtarları ilk tanım sonrası bu API'den değiştirilmez; mevcut URL kimliklerini sessizce bozmayız. Düzeltme ihtiyacında ayrı veri dönüşümü gerekir. Birleştirme aynı mağaza/varyant için iki sürümle yapılır; kaynak `MERGED` olur, URL'ler hedefe taşınır. Eski ürün ID'si hedefi `redirectedFromId` ile döndürür; döngü ve kendi kendine birleşme reddedilir.

Fiyat `priceMinor` tamsayı alt birimidir (TRY için kuruş); `currency` TRY/EUR/USD/GBP ve sunucunun `priceRecordedAt` zamanı ayrı tutulur. Fiyat yoksa tarih de yoktur; DB bunu doğrular. Otomatik kur dönüşümü/karşılaştırma veya güncel mağaza fiyatı iddiası yoktur.

## Çalışan uçlar

Tüm yollar `/v1` altındadır, oturum gerekir. Sayfalı listeler `limit` 1–50 ve kullanıcı/filtreye bağlı cursor kullanır.

| Metot | Yol | İş |
| --- | --- | --- |
| GET | `/catalog/stores` | Aktif mağazalar, en fazla 200 |
| GET | `/catalog/products?q=...&category=...` | Aktif mağazalardaki aktif ürünler |
| GET | `/catalog/products/:id` | Ürün / birleştirilmiş ID'nin hedefi |
| POST | `/catalog/resolve` | `{ url?, query?, brand? }`; en az URL/isim |
| POST | `/catalog/suggestions` | `{ title, category, brand?, url?, priceMinor?, currency? }`; işlem anahtarı |
| GET | `/catalog/suggestions` | Yalnız kendi önerileri, isteğe bağlı status |
| GET | `/catalog/suggestions/:id` | Kendi önerisi; başka sahip 404 |
| GET/POST | `/admin/catalog/stores` | Tümü / mağaza yarat |
| PUT | `/admin/catalog/stores/:id` | İsim/aktiflik, sürüm ve gerekçe |
| GET/POST | `/admin/catalog/products` | Tüm durumlar / ürün yarat |
| GET/PUT | `/admin/catalog/products/:id` | İncele / ortak alanları güncelle |
| POST | `/admin/catalog/products/:id/urls` | URL ekle, sürüm ve gerekçe |
| POST | `/admin/catalog/products/:id/merge` | `targetId`, `targetVersion`, kaynak sürümü ve gerekçe |
| GET | `/admin/catalog/suggestions` | İnceleme kuyruğu |
| PUT | `/admin/catalog/suggestions/:id/decision` | APPROVE + mevcut aktif productId veya REJECT; sürüm/gerekçe |

Aynı kullanıcının aynı beyanı farklı anahtarla tekrar göndermesi de tek öneridir. Başlangıç kaynak sınırı kullanıcı başına son 24 saatte 20 yeni öneri; Plus hakkı değildir. ADMIN önce gerekirse ortak ürünü oluşturur, sonra öneriyi o ürüne onaylar. Öneri içeriği kendiliğinden ortak ürünün alanlarını ezmez.

## Kontrol ve sonraki adım

```bash
npm run test:catalog
```

13 gerçek HTTP/DB testi: erişim/katı alanlar, kesin/aday eşleşme, varyant, özel öneri/limit, audit/rollback, fiyat/tarih, birleştirme, arşiv/mağaza, cursor, hesap silme ve OpenAPI. İstek örnekleri: [catalog.http](../examples/catalog.http).

`ProductTag.catalogProductId`, yayın anı snapshot'ı, özgün linkin korunması ve mobil ürün seçimi hazırdır. Sırada izinli PUBLIC tercih katkılarından gerçek trend vardır.
