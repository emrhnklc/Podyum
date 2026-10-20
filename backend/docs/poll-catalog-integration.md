# Kombin ürünlerini kataloğa bağlama

20 Ekim 2026. Güncel planın 5. adımı. Mevcut `POST /polls` ve `PATCH /polls/:id` uçlarında seçenek başına iki etiket biçimi çalışır; eski kayıtlar dönüşüm/reset gerektirmeden korunur.

## İstek

Katalog seçimi:

```json
{ "catalogProductId": "urun-uuid", "externalUrl": "https://magaza.example/urun?utm_source=paylasan" }
```

`externalUrl` isteğe bağlıdır; verilmezse ürünün kanonik adresi alınır. Verilirse o ürünün kayıtlı adreslerinden birine normalleşmelidir. Bilinen takip parametreleri ürün kimliğini değiştirmez; özgün adres etikette aynen korunur. Başka ürün/beden/renk adresi kendiliğinden aynı ürün sayılmaz. Katalogda doğrulanmış bağlantı yoksa `PRODUCT_URL_REQUIRED`; ilgisiz bağlantıysa `PRODUCT_URL_MISMATCH` döner. Sunucu URL'yi ziyaret etmez.

Katalog seçiminde `title`, `brand`, `priceMinor`, `currency` gönderilmez; sunucu bunları katalogdan alır. İstemci `source` veya `catalogSnapshot` yazamaz. Bunları yollamak ortak kaydı düzeltmez; istek reddedilir.

Elle ürün etiketi eski biçimi korur:

```json
{ "title": "Bej pantolon", "brand": "Marka", "priceMinor": 129900, "currency": "TRY", "externalUrl": "https://magaza.example/pantolon?aff=ozgun" }
```

Bu kayıt `USER_ENTERED`, `catalogProductId: null`, `catalogSnapshot: null` olarak kalır. Kataloğa öneri gönderilmesi veya önerinin ileride onaylanması geçmiş paylaşımı otomatik doğrulanmış ürüne dönüştürmez. Kullanıcı taslakta açıkça katalog ürünü seçebilir.

## Taslak, yayın ve tarihsel doğruluk

- Taslakta katalog ürünü seçilince ilk sunucu snapshot'ı alınır. `PATCH options` tüm listeyi değiştirmeye devam eder; ürün kaldırma/değiştirme buradan yapılır.
- Yayında bağlı ürünler yeniden doğrulanır; güncel ad/marka/kategori/mağaza/harici kimlik/varyant/kaynak, sürüm ve fiyat bağlamı `catalogSnapshot` içine yazılır. `capturedAt` yayın sırasında alınan DB zamanıdır. `priceRecordedAt` katalogdaki fiyatın kayıt zamanıdır; yayın zamanı diye yeniden yazılmaz.
- Ürün/mağaza artık pasifse yayın 422 ile durur. Taslak korunur; kullanıcı etiketi değiştirir veya kaldırır. Mağazanın o anda stokta olduğu iddia edilmez.
- Sonraki katalog düzeltmesi/arşiv/mağaza kapatma eski yayındaki ad/fiyat/kaynak/linki değiştirmez. Yayın sonrası etiket düzenleme yoktur.
- Birleştirilmiş eski ID taslak oluşturma/yayın sırasında etkin hedefe çözülür. Daha önce yayımlanmış etiketin ID ve snapshot'ı yeniden yazılmaz; ortak kimlik üzerinden trend toplama politikası sonraki adımdadır.
- Aynı işlem anahtarı aynı yayın makbuzunu döndürür; yeniden deneme sonradan değişen fiyatı eski yayına taşımaz. Snapshot, yayın, sürüm, olay ve işlem makbuzu aynı transaction'dadır.

`CatalogLinkService` başka modüllere yalnız transaction içindeki yakalama işini sunar. Katalog yönetimi ve yakalama ortak advisory kilidi kullanır; birleştirme/alias/mağaza değişikliği sırasında parçalı snapshot alınmaz. Yerel tek bağlantı testi gerçek çok bağlantılı yük kanıtı değildir.

## Sınırlar ve erişim

Seçenek başına en fazla 10 etiket. Aynı katalog hedefi veya aynı özgün manual URL aynı seçenekte tekrarlanamaz; farklı seçeneklerde aynı ürün kullanılabilir. İki ürün taslak beklerken birleştirilip tek hedefe dönüşmüşse yayın 422 `DUPLICATE_PRODUCT_TAG` ile tamamen geri alınır; sunucu sessizce birini atmaz. FK, nullable eski kayıt uyumu, kaynak/snapshot çifti ve `(optionId, catalogProductId)` tekilliği migration ile korunur.

Ürün alanları mevcut detay/kart sunumuna eklidir; FRIENDS, engel, moderasyon ve hesap durumuna ilişkin erişim kuralları değişmez. Özel öneri verisi veya kullanıcının öneri kimliği snapshot'a alınmaz. Tercih olayı aynı donmuş optionId'ye işaret eder; ham link/demografi olaya kopyalanmaz. Doğrudan ürün oyu, satış veya affiliate geliri üretilmez.

## Mobil

Paylaş ekranında A/B/C/D fotoğrafının altında **Ürün etiketle / Düzenle** açılır. İsim/link çözümleme sonuçlarında kullanıcı ürünü seçer; eşleşme yoksa adı/linki elle ekler veya **Kataloğa öner ve ekle** ile kendi özel önerisini gönderir. Önce kayıtlı ürünler gösterilir; ürünler kaldırılabilir. Fotoğrafların yer değiştirmeyen seçeneğine bağlı tutulur; yayın yeniden denemesinde ürün listesi de istek imzasına dahildir.

Katalog adı/fiyatı istemciden yazma isteğine kopyalanmaz. Detay/karttaki ürün düğmesi saklanan özgün linki açar; katalog veya kullanıcı beyanı kaynağı gösterilir. Defile/Canlı/Sonbahar tasarımı bu adımda değişmedi.

## Doğrulama

```bash
npm run test:poll-catalog
```

12 HTTP/DB testi: eski etiket uyumu, sunucu alanları, özgün link, yayın snapshot'ı, oy/akış, merge, tekrar/limit, pasif ürün, özel erişim, yayın sonrası koruma, rollback, DB/OpenAPI ve gerçek görsel yükle → katalog seç → yayın → tercih → görsel/ürün okuma. Mobil `npm run test:product-tags` fiyat girişi, kimlik payload'ı ve sınırları kontrol eder.

Diğer bilgisayarda `backend/` içinde `npm run db:deploy`, `npm run db:generate`; 25. migration ek alanları taşır. Üretilen Prisma model dosyaları elle düzenlenmez. Sonraki adım 6: izinli PUBLIC tercihlerin donmuş katalog etiketlerinden tekil trend katkısı üretmek.
