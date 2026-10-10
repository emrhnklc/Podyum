# Ortak altyapı

Birden fazla modülün kullandığı teknik parçalar burada yer alır:

- `config/environment.ts`: açılış ortam kontrolü.
- `errors/`: kararlı hata kodları, HTTP hata filtresi ve OpenAPI hata şeması.
- `http/`: sunucu request ID'si, cache başlıkları, kullanıcı bağlamı ve DTO validation pipe.
- `pagination/`: limit DTO'su ve filtre bağlamı içeren cursor yardımcıları.

Cursor şifreli veya imzalı değildir; opak bir sayfalama konumudur, erişim kanıtı sayılmaz. Her liste sorgusu kimlik, görünürlük ve filtre koşullarını sunucuda tekrar uygulamalıdır. Gerçek liste endpoint'leri ilgili özellikte bu yardımcıları kullanacak.

Arkadaşlık, oy uygunluğu, puan hesabı ve oda durumu ilgili özellik modülünde kalır. Auth'a özgü guard, decorator ve strategy dosyaları `modules/auth/` altındadır. Ortak altyapı özellik modüllerine bağımlı olmaz.
