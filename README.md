# Podyum

Kombin tercihleri, sosyal paylaşım ve günlük tema oyunları için uygulama.

[Güncel backend çalışma sırası](backend/docs/backend-implementation-plan-2026-10-19.md), [mobil bağlantı durumu](mobile/docs/connected-screens-integration.md). 20 Ekim: bakım, oyun süre uyumu, katalog/kombin bağlantısı, trend veri hattı ve [filtreli Trendler API'si](backend/docs/trends-api-development.md) hazır; mobil Trendler ekranı da gerçek API’ye bağlı.

```text
Podyum/
  backend/       NestJS API, Prisma, migration, test ve backend belgeleri
  mobile/        Expo + React Native mobil uygulaması ve web önizlemesi
  package.json   İki uygulamanın kökten çalıştırma komutları
```

`backend/` ve `mobile/` kendi `package.json`, `package-lock.json` ve `node_modules` dizinlerine sahiptir. Paket kurulumu ve TypeScript ayarları ayrı yönetilir. Mobile, Expo Router ile `src/app`, `features`, ortak `components/hooks/lib/theme` düzenini kullanır; ana sosyal/paylaşım/defile ekranları gerçek API kullanır, Trendler ve katalog detayı da gerçek API kullanır.

## Kurulum

Node.js 24.11+ ve npm gerekir. Aşağıdaki komutlar `Podyum/` kökünde çalıştırılır:

```bash
npm run setup
```

Yeni backend kurulumunda `backend/.env.example` dosyasını `backend/.env` olarak kopyalayın. Mevcut `.env` dosyasının üzerine yazmayın. Sonra:

```bash
npm run db:start
npm run db:generate
npm run db:deploy
```

İsteğe bağlı demo verisi: `npm --prefix backend run db:seed`. Yerel kurulum ayrıntıları ve DB korumaları: [backend rehberi](backend/README.md).

## Çalıştırma

İki ayrı terminalde, proje kökünden:

```bash
npm run dev:backend
```

```bash
npm run dev:mobile
```

- Backend: `http://127.0.0.1:3000`; Swagger: `http://127.0.0.1:3000/v1/docs`.
- Mobile: Expo terminalindeki QR ile Expo Go; Metro portu `8081`.
- Tarayıcı önizlemesi: `npm run web:mobile` → `http://localhost:8081`.

Doğrudan ilgili klasörde de çalışılabilir: `cd backend && npm start` veya `cd mobile && npm run dev`. Expo Go için bilgisayar ve telefon aynı Wi-Fi'da olmalıdır. Backend ortam ayarları ve yerel dosyaları `backend/.env` ve `backend/.local/` altındadır. Özel fotoğraflar, posta kutusu, ortam dosyaları ve bağımlılıklar Git'e eklenmez.

## Kontroller ve belgeler

```bash
npm run typecheck
npm run lint:mobile
npm run build
npm run test:api
npm run test:db
npm run test:smoke
npm run db:check
```

DB kullanan test ve bakım komutlarını yerel tek bağlantılı DB üzerinde sırayla çalıştırın.

- [Backend çalışma planı](backend/docs/backend-roadmap.md)
- [İki geliştiricinin görev paylaşımı](backend/docs/two-developer-plan.md)
- [Günlük oyun ve QR lobileri](backend/docs/game-design.md)
- [Mobile çalıştırma rehberi](mobile/README.md)
- [Ekran ve API haritası](mobile/docs/ekran-ve-api-haritasi.md)

Backend değişiklikleri `backend/`, arayüz değişiklikleri `mobile/` altında yapılır. Prisma'nın ürettiği `backend/src/generated/prisma/` dosyaları elle değiştirilmez.

Mobile `build`, Android/iOS/web JavaScript paketlerini dışa aktarır; APK/IPA üretmez. Detaylı kurulum ve feature sınırları [mobile rehberindedir](mobile/README.md).
