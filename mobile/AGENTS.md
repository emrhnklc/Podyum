# Podyum mobile

Bu paket Expo + React Native + Expo Router kullanır. Backend ayrı `../backend/` paketidir.

- `src/app/` yalnız route, parametre ve navigation layout taşır. İş akışı ve ekran kodu `src/features/<özellik>/` altındadır.
- Özelliğe özel bileşen/hook/tip/veri o özelliğin klasöründe tutulur. Ortak UI `src/components/`, ortak hook `src/hooks/`, teknik istemciler `src/lib/`, renk/font/ölçüler `src/theme/` altındadır.
- Native ekranlarda React Native bileşenleri ve StyleSheet kullanılır; Next.js, HTML tag veya CSS module eklenmez.
- Expo'ya bağlı paket sürümlerini `npx expo install` ile eşleştir. Resmi kaynaklar: https://docs.expo.dev/router/installation/ ve https://docs.expo.dev/router/reference/src-directory/.
- Ana ekran e-posta girişiyle gerçek feed/oy/sonuç/kaydetme/yorum API'lerine bağlıdır; `docs/home-api-integration.md` sözleşmedir. Kayıt/doğrulama ve profil kurulumunun sözleşmesi `docs/registration-api-integration.md` içindedir; e-posta teslimi yereldir. Diğer sekmeler hâlâ demo/önizlemedir. Demo tercih/kaydetme bellektedir; gerçek oturum, yayın, ödeme veya oyun hakkı üretmez. Normal oylama çoğunluğu tahmin oyunu değildir, yıldız/puan vermez.
- Kontroller: `npm run typecheck`, `npm run lint`, `npm run check:expo`, `npm run build`. Native export, gerçek cihaz testi yerine geçmez.
- `.expo/`, `dist/`, native üretilen dizinler, gerçek fotoğraflar ve ortam dosyaları Git'e eklenmez. Backend şemasını bu düzenleme için değiştirme.
