# Podyum — mobile

Expo SDK 57 + React Native + Expo Router + TypeScript. Ana ekran e-posta girişinden sonra gerçek backend kullanır: akış, tercih/sonuç, kaydetme, ürün linkleri ve yorumlar bağlıdır. Kayıt, yerel e-posta doğrulama ve profil/stil/avatar kurulumu da bağlıdır; profil/sosyal, paylaşım, bildirim/ayar ve Defile de gerçek API kullanır. Trendler de gerçek dönem/kitle/ürün/fiyat API’sine ve katalog detayına bağlıdır; [Trendler rehberi](docs/trends-api-integration.md). [Diğer ekran bağlantıları](docs/connected-screens-integration.md). [Kayıt rehberi](docs/registration-api-integration.md). [Bağlantı rehberi](docs/home-api-integration.md).

## Çalıştırma

Uygulama ikonu, açılış ve giriş/ana ekran logosu `assets/brand/` altındadır; [kaynak ve yeniden üretme notları](assets/brand/README.md). Native ikon/splash değişiklikleri yeni uygulama derlemesinde uygulanır.

Proje kökünden:

```bash
npm run setup:mobile
npm run dev:mobile
```

Expo terminalindeki QR'ı aynı Wi-Fi'daki telefonda Expo Go ile açın. Kurulu Expo Go uygulaması SDK 57'yi desteklemelidir. QR adresi terminalde gösterilir; localhost telefonun kendisidir. Metro portu varsayılan 8081'dir.

Tarayıcı önizlemesi:

```bash
npm run web:mobile
```

Adres `http://localhost:8081`. Backend ayrı terminalde 3000 portunda çalışır. Port doluysa mobile içinde `npx expo start --port 8082` kullanın; başka projenin sunucusunu durdurmayın. LAN engelliyse `npx expo start --tunnel` kullanılabilir; gerekli tünel paketi/bağlantısı ayrıca kurulmalıdır.

İlgili klasörde doğrudan `npm run ios`, `npm run android`, `npm run web` kullanılabilir. iOS/Android simulator için ilgili geliştirme araçları gerekir. Bu teslimde gerçek telefonda Expo Go çalışma testi yapılmış sayılmaz; native bundle üretimi ayrı kontroldür.

## Kod düzeni

```text
mobile/
  assets/                 Gömülü ortak medya; kişisel demo fotoğrafları Git dışında
  src/
    app/                  İnce route dosyaları ve navigation layout
      (tabs)/             Keşfet, Trendler, Paylaş, Defile, Profil
      auth/ friends/ games/
      polls/[id].tsx
      u/[username].tsx
    features/
      auth/ feed/ polls/ profile/ people/ friends/ trends/ games/ notifications/ settings/ moderation/
    components/           Ortak UI ve medya bileşenleri
    constants/            Kategori etiketleri ve demo kimliği
    hooks/                Ortak hook'lar
    lib/api/              Yapılandırılabilir API istemcisi
    theme/                Renk, font, boşluk ve ortak stiller
```

Her özellik ihtiyaç duydukça `screens`, `components`, `hooks`, `data`, `api`, `types` ekler; kullanılmayan boş servisler oluşturulmaz. App route dosyaları ekranı export eder veya parametreyi ekrana iletir. Özelliğe özel kod ortak components/hooks klasörlerine taşınmaz. [Feature sınırları](src/features/README.md), [ekran ve API haritası](docs/ekran-ve-api-haritasi.md).

## Ekranların durumu

Gerçek oturumla Keşfet, profil/arkadaşlar/kişi arama, fotoğraflı paylaşım ve yorumlar, bildirim/tercihler, şikâyet/engel ve Defile odaları çalışır. Sonbahar kartının görselleri korunur; düğmesi aynı temadaki odaları açar. Lig ve defile sonuçlarını backend hesaplar. Trendler gerçek filtre/sayfalama/örneklem API’sine ve katalog detayına bağlıdır. Hazır API’si olmayan Plus/ödeme/haftalık yarışma için başarı üretilmez.

Eski demo bileşenleri ve verileri kaynakta tasarım referansı olarak durur. Demo yüzdeleri/demografi, tercih değiştirme ve kaydetme bellektedir; gerçek API verisine veya yetkilere dönüşmez. Gerçek normal oy tek tercihtir ve yıldız/puan üretmez. [Güncel ekran/API haritası](docs/ekran-ve-api-haritasi.md).

## Medya ve API

Eksik demo fotoğraflarında pastel yer tutucu gösterilir. Native, eski `/demo/...` web yollarını HTTP adresi gibi çağırmaz. Yerel özel `public/demo/` dosyaları korunur; native görsel için uygun static asset kaynağı veya tam erişilebilir medya URL'si gerekir. Yerel fotoğrafları görmek için `mobile/.env.local` içine `EXPO_PUBLIC_DEMO_MEDIA_BASE_URL=http://<Mac'in-LAN-adresi>:8081` yaz: Expo geliştirme sunucusu `public/` klasörünü de sunduğu için `/demo/...` yolları bu adrese göre çözülür. Değişken yoksa davranış aynıdır, ağ isteği yapılmaz. Kişisel fotoğraf/video Git'e eklenmez. Eski video desteği taşınmadı; ilk backend medya hattı fotoğraftır.

`src/lib/api/client.ts` gerçek ana ekran, oturum ve medya isteklerinde kullanılır. `EXPO_PUBLIC_API_BASE_URL` `/v1` dahil tam API adresidir; telefon için Mac'in LAN adresi kullanılmalıdır. `EXPO_PUBLIC_*` içine sır/token yazılmaz. E-posta girişi, tek uçuşlu yenileme ve native güvenli token deposu bağlıdır; kayıt/doğrulama ve profil kurulumu bağlıdır; diğer bağlı ekranlar ve kalan sınırlar [bağlantı notlarında](docs/connected-screens-integration.md) yer alır.

## Kontroller

```bash
npm run typecheck
npm run lint
npm run check:expo
npx expo-doctor
npm run build
```

`build` Android/iOS/web JavaScript ve asset export üretir; APK/IPA veya mağaza yayını değildir. Üretilen `dist/`, `.expo/`, `ios/`, `android/` Git dışında kalır. Paket sürümleri Expo'nun resmi SDK 57 şablonu ve `expo install` ile eşleştirilir. Kaynak: [Expo Router kurulumu](https://docs.expo.dev/router/installation/), [src dizini](https://docs.expo.dev/router/reference/src-directory/).
