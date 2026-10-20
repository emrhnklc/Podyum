# Podyum logosu

Kullanıcının 20 Ekim 2026'da gönderdiği kırmızı zeminli, iki basamak ve parıltı içeren referansın temiz geometrik SVG çizimi `logo.svg` dosyasıdır. Sohbet görselinin özgün dosyası depoda bulunmadığından küçük görüntü büyütülmek yerine şekil vektör olarak yeniden çizildi. Ana ekranın kahve/krem teması korunur.

- `logo.png`: uygulama içi, şeffaf köşeli 512 px logo.
- `icon.png`: iOS/genel uygulama için 1024 px, köşeleri işletim sistemi tarafından maskelenecek opak kare.
- `adaptive-icon.png`: Android için güvenli iç alanda şeffaf ön katman; arka plan app.json içinde kırmızı.
- `monochrome-icon.png`: Android temalı ikonlar için beyaz maske.
- `splash-logo.png`: açılış logosu.
- `favicon.png`: web sekmesi simgesi.

PNG'ler sürüm kontrolünde tutulur. SVG değişirse proje kökünden, backend bağımlılıkları kuruluyken:

```bash
node mobile/scripts/generate-brand-assets.mjs
```

Betik mevcut backend Sharp bağımlılığını kullanır. Normal mobil kurulum/derleme, yeniden üretme betiğini çalıştırmaz. AppLogo bileşeni giriş ve ilk yükleme ekranında aynı dosyayı kullanır; native ikon ve splash ayarları `mobile/app.json` içindedir.

İkon/splash native yapılandırması yeni uygulama derlemesinde uygulanır; Expo Go tam native açılış deneyimini doğrulamaz. [Expo açıklaması](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/).
