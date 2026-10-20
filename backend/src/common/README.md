# Ortak altyapı

Birden fazla modülün kullandığı teknik parçalar burada yer alır:

- `config/environment.ts`: açılış ortam kontrolü.
- `errors/`: kararlı hata kodları, HTTP hata filtresi ve OpenAPI hata şeması.
- `http/`: sunucu request ID'si, cache başlıkları, kullanıcı bağlamı ve DTO validation pipe.
- `pagination/`: limit DTO'su ve filtre bağlamı içeren cursor yardımcıları.
- `maintenance/`: teknik DB kayıtları için sınırlı dry-run/açık apply; [bakım rehberi](../../docs/technical-retention.md).
- `idempotency/`: kullanıcı/komut/kaynak kapsamında advisory lock, normalize JSON hash'i ve 24 saatlik kalıcı başarılı yanıt; domain yazımı/outbox aynı transaction'da. Oylama komutlarında kullanılır; [sözleşme](../../docs/polls-development.md).

Cursor şifreli veya imzalı değildir; opak bir sayfalama konumudur, erişim kanıtı sayılmaz. Her liste sorgusu kimlik, görünürlük ve filtre koşullarını sunucuda tekrar uygulamalıdır. Sosyal ve kendi oylama listesi bu yardımcıları kullanır. Idempotency yanıtı ise güncel kaynak okuması değildir; yalnız sahibin kendi komut snapshot'ı için kullanılır, başka kaynağa bağlı yetkili komutlar yeniden erişim denetimi eklemelidir.

Arkadaşlık, oy uygunluğu, puan hesabı ve oda durumu ilgili özellik modülünde kalır. Auth'a özgü guard, decorator ve strategy dosyaları `modules/auth/` altındadır. Ortak altyapı özellik modüllerine bağımlı olmaz.

20 Ekim: `maintenance/technical-retention.ts` DB teknik kayıt seçimini; `maintenance/local-delivery-retention.ts` yalnız yerel dosya biçimi/süre kontrolünü yapar. Domain medya temizliği ve zamanlama/kalıcı durum `modules/maintenance` içindedir; common domain modülünü import etmez. [Bakım sözleşmesi](../../docs/technical-retention.md).
