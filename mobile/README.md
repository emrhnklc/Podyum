# Podyum — mobile

Expo SDK 57 + React Native + Expo Router + TypeScript. Önceki Next.js önizlemesi native bileşenlere taşındı; beyaz/kırmızı tema ve Hanken Grotesk korunur. Ekranlar henüz backend çağrısı yapmaz; feature içindeki demo verilerini kullanır.

## Çalıştırma

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
      (tabs)/             Keşfet, Trendler, Paylaş, Bildirim, Profil
      auth/ friends/ games/
      polls/[id].tsx
      u/[username].tsx
    features/
      auth/ feed/ polls/ profile/ friends/ trends/ games/ notifications/
    components/           Ortak UI ve medya bileşenleri
    constants/            Kategori etiketleri ve demo kimliği
    hooks/                Ortak hook'lar
    lib/api/              Yapılandırılabilir API istemcisi
    theme/                Renk, font, boşluk ve ortak stiller
```

Her özellik ihtiyaç duydukça `screens`, `components`, `hooks`, `data`, `api`, `types` ekler; kullanılmayan boş servisler oluşturulmaz. App route dosyaları ekranı export eder veya parametreyi ekrana iletir. Özelliğe özel kod ortak components/hooks klasörlerine taşınmaz. [Feature sınırları](src/features/README.md), [ekran ve API haritası](docs/ekran-ve-api-haritasi.md).

## Çalışan önizleme

- Keşfet: içerik odaklı tek oylama; fotoğraflar ekranı doldurur. Herkes/Arkadaşlar sekmesi, ikonla açılan kategori filtresi, normal tercih, anlık demo sonuç, sonraki kombin ve kaydetme.
- Oylama açıkken diğer seçeneğe dokunarak tercih değiştirilebilir (demo). Backend bugün ilk oyu sabit tutar; bu açık ürün kararı [ekran ve API haritasında](docs/ekran-ve-api-haritasi.md) yazılı. Kendi paylaşımına oy verilmez. Normal tercih yıldız/puan üretmez. Eski +10/çoğunluğu tahmin davranışı kaldırıldı.
- Sonuç detayları: toplam oy, seçenek başına oy ve oy verenlerin cinsiyet/yaş dağılımı; hepsi mock veridir.
- Kombin detayları, kullanıcı profilleri, kendi profilindeki paylaşımlar/kaydedilenler ve örnek arkadaş listesi. Alt ekranlarda sol üstte sade geri oku vardır.
- Trendler: hafta/ay, kategori, tercih yapan grup ve fiyat filtreleri. Küçük örneklem demo eşiği korunur; gerçek backend gizlilik eşiği olarak kabul edilmez.
- Paylaş formu: A ve B için galeriden fotoğraf seçme (`expo-image-picker`), değiştirme ve kaldırma; soru, kategori, süre, görünürlük ve yorum/blur ayarları. Seçilen fotoğraflar yalnız cihazda kalır. Sunucuya yükleme, blur işleme ve yayın henüz bağlı değildir; önizleme gerçek paylaşım oluşturmaz.
- Bildirim boş durumu; auth ve oyun alanları hazırlık ekranıdır. Günlük 30+30 ve QR lobileri planda; oyun çalışıyor gibi gösterilmez.

Tercih ve kaydetmeler `DemoPollsProvider` ile yalnız bellekte tutulur; sekme/detay geçişlerinde korunur, uygulama yeniden açılınca sıfırlanır. Demo profildeki yıldız ve sayaçlar örnek değerdir. Gerçek kullanıcı oturumu veya ücretli hak yoktur.

## Medya ve API

Eksik demo fotoğraflarında pastel yer tutucu gösterilir. Native, eski `/demo/...` web yollarını HTTP adresi gibi çağırmaz. Yerel özel `public/demo/` dosyaları korunur; native görsel için uygun static asset kaynağı veya tam erişilebilir medya URL'si gerekir. Yerel fotoğrafları görmek için `mobile/.env.local` içine `EXPO_PUBLIC_DEMO_MEDIA_BASE_URL=http://<Mac'in-LAN-adresi>:8081` yaz: Expo geliştirme sunucusu `public/` klasörünü de sunduğu için `/demo/...` yolları bu adrese göre çözülür. Değişken yoksa davranış aynıdır, ağ isteği yapılmaz. Kişisel fotoğraf/video Git'e eklenmez. Eski video desteği taşınmadı; ilk backend medya hattı fotoğraftır.

`src/lib/api/client.ts` ilerideki entegrasyon içindir, ekranlar henüz kullanmaz. `EXPO_PUBLIC_API_BASE_URL` `/v1` dahil tam API adresidir; telefon için Mac'in LAN adresi kullanılmalıdır. `EXPO_PUBLIC_*` içine sır/token yazılmaz. Gerçek auth/yenileme/güvenli token depolama ve her feature'ın API katmanı entegrasyon adımında eklenecek.

## Kontroller

```bash
npm run typecheck
npm run lint
npm run check:expo
npx expo-doctor
npm run build
```

`build` Android/iOS/web JavaScript ve asset export üretir; APK/IPA veya mağaza yayını değildir. Üretilen `dist/`, `.expo/`, `ios/`, `android/` Git dışında kalır. Paket sürümleri Expo'nun resmi SDK 57 şablonu ve `expo install` ile eşleştirilir. Kaynak: [Expo Router kurulumu](https://docs.expo.dev/router/installation/), [src dizini](https://docs.expo.dev/router/reference/src-directory/).
