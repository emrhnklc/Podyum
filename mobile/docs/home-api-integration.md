# Ana ekranın ilk gerçek API bağlantısı

10 Ekim 2026. Kapsam: doğrulanmış mevcut e-posta hesabıyla giriş, Keşfet, tercih/sonuç/detay, ürün linkleri ve yorumlar. Üç adımlı kayıt tasarımının API bağlantısı, e-posta doğrulama arayüzü, şifre sıfırlama, gerçek Google/Apple girişi ve diğer sekmelerin entegrasyonu sonraki işlerdir.

## Kullanıcı akışı

- Karşılama ekranındaki **Giriş yap** `/auth/login` ekranını açar; `/auth/login` ve `/auth/me` ile gerçek oturum alınır. **Başla** eski tasarım önizlemesini açar; bu ekran açıkça önizleme olarak işaretlenir, gerçek oy/kayıt üretmez. API hatasında gerçek liste yerine sessizce demo gösterilmez.
- Giriş yapan kullanıcı `/feed` ile gerçek Herkes/Arkadaşlar akışını, kategorileri, sunucu cursor'ıyla devamını ve aşağı çekerek yenilemeyi kullanır. Arkadaşlık/görünürlük sunucuda denetlenir. Geç kartı yalnız eldeki listeden kaldırır; son kartta liste başa sarmaz. Sekmeye veya uygulamaya dönünce liste yeniden alınır.
- Gerçek kart 2–4 seçenek destekler. Tercih UUID ile `/polls/:id/vote` ucuna gönderilir; başarı makbuzundan önce seçilmiş gibi gösterilmez. Backend bugün ilk tercihi sabit tutar; gerçek kart başka tercihe geçiş açmaz. Demo tercihin değiştirilebilir olması backend kuralını değiştirmez.
- Sonuçlar yalnız `/polls/:id/results` yanıtından gelir. İstemci oy/yüzde/demografi uydurmaz. Backend'in henüz sağlamadığı yaş/cinsiyet dağılımları gerçek detayda gösterilmez. UUID detay route'u gerçek API'ye, eski demo kimlikleri demo detayına gider.
- Kaydet/kaldır sunucu makbuzuyla güncellenir. Feed isSaved verir; doğrudan açılan detay bu alanı vermediği için ilk **Kaydet** idempotent PUT yapar, makbuzdan sonra kaldırma açılır. Profilin demo Kaydedilenler sekmesi henüz gerçek kaydetmelerin listesi değildir.
- Ürün paneli seçenek başına gerçek ProductTag adı/markası/fiyatı/özgün dış linkini kullanır. Ortak katalog eşleşmesi veya ürün görseli varmış gibi gösterilmez. Liste boşsa panel açılmaz.
- Yorum ekranı sayfalı okuma, canComment/canRemove kuralları, ekleme ve silmeyi bağlar. Yeni yorumdaki Idempotency-Key aynı gövdenin ağ hatası sonrası tekrarında korunur. İzin değişikliği komutta tekrar sunucuda denetlenir. Ana ekrana dönüşte yorum sayacı yenilenir.
- Bilinen 404 durumunda eski kart/fotoğraf gizlenir. 409 durumunda detay yeniden okunur. Ağ hatası kullanıcıya görünür; yeniden deneme ve yenileme eylemleri vardır.
- Ayarlar **Çıkış Yap** yerel oturumu temizler ve sunucuya çıkış gönderir. Sunucuya ulaşılamazsa yerel çıkış gerçekleşir; uzak oturumun iptali garanti edilmiş sayılmaz.

## Oturum ve medya

SessionManager token yenilemeyi tek uçuşta yürütür; eşzamanlı/geç 401 yanıtları aynı yenilemeyi kullanır. Refresh ağ hatasında eski tek kullanımlık token otomatik tekrarlanmaz, yeniden giriş istenir. Çıkış/hesap değişiminden sonra geç gelen istekler eski hesabın verisini yeni oturuma taşımaz.

Native token çifti API adresine bağlı SecureStore anahtarında saklanır. Web önizlemesinde yalnız bellektedir; sayfa yenilenince tekrar giriş gerekir. Token, parola ve gerçek ortam dosyaları Git'e konmaz. [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) ve [Router oturum rehberi](https://docs.expo.dev/router/advanced/authentication/).

ApiImage yalnız `/v1/media/<uuid>/content` yollarını Bearer ile alır. API dışına token göndermez; fotoğrafı geçici data URI olarak gösterir ve hesap/kaynak değişiminde eski resmi bırakır. Bu ilk sürüm dosyaya kalıcı cache yazmaz; büyük görsel bellek/yük davranışı cihazda ayrıca ölçülecek. Diğer fotoğraflar PreviewImage ile aynı fallback'i kullanır.

## Yerel çalıştırma

Backend ayrı terminalde:

```bash
cd backend
npm ci
npm run db:start
npm run db:deploy
HOST=0.0.0.0 CORS_ORIGINS=http://localhost:8081,http://127.0.0.1:8081,http://<LAN-IP>:8081 npm start
```

`db:start` yalnız DB kapalıysa gerekir. Mevcut sunucuya ikinci API başlatılmaz. Mobile `.env.local` içinde `EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP>:3000/v1`; telefon için localhost kullanılmaz. API adresi/safe CORS listesi yerel geliştirmeye aittir. Native CORS'a bağlı değildir; web origin listede olmalıdır.

Mobile'da `npm ci`, sonra `npm run dev`; yeni paket/ortam değişiminden sonra Expo'yu yeniden başlat. Yeni paketler Expo SDK ile eşleştirilmiş expo-secure-store/expo-crypto'dur.

Mevcut doğrulanmış hesap yoksa, API çalışırken **backend** klasöründe:

```bash
npm run preview:mobile
```

Bu güvenilen geliştirici komutu yalnız yerel proje DB/API'sinde iki ayrı önizleme hesabını normal kayıt/doğrulama/giriş akışıyla kurar; arkadaş yapar, depodaki örnek fotoğrafları normal upload/complete/accept akışıyla gönderir ve üç açık oylama hazırlar. Eski demo kullanıcıları veya gerçek hesaplar değiştirilmez. Giriş e-posta/şifresi Git dışında `.local/mobile-preview.json` dosyasındadır; uygulamada otomatik test girişi yoktur. Tekrar çalıştırınca mevcut hesapları kullanır; görülebilir test oylaması azalmış veya bitmişse yenisini açar. Bu komut genel db:seed yerine geçmez, üretime uygun değildir. Önizleme medya/kayıtları yerelde kalır.

## Doğrulama

Mobile klasöründe:

```bash
npm run test:session
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000/v1 npm run test:home-api
npm run typecheck
npm run lint
npm run check:expo
npm run build
```

9 oturum testi: giriş/restore, eşzamanlı refresh, geç 401, çıkış/refresh yarışı, belirsiz yenilemede token tekrarını önleme, geç eski hesap yanıtı, geç JSON gövdesi, hesap değişiminde eski tokenı kapatma ve 403/409 ayrımı. API smoke normal e-posta girişini, arkadaş/kategori listesini, yetkili/yetkisiz görseli, kaydet/kaldır, tek oy/replay/değiştirme reddi, detay/sonuç, akıştan çıkarma, yorum/replay/silme ve çıkışı gerçek mobil istemciyle doğrular. Yalnız önizleme hesaplarının bir oylamasına oy verir ve kendi test yorumunu kaldırır; eski demo verisini değiştirmez. Sonrasında yeniden preview:mobile ile üç oylanmamış kart hazırlanabilir.

Android/iOS/web export gerçek cihaz kabulü değildir. Galeriden paylaşma, gerçek profil/arkadaş araması, bildirim ve oyun ekranı entegrasyonu, kayıt tasarımının API bağlantısı, doğrulama arayüzü ve demografik sonuçlar henüz bağlanmadı. Giriş sonrası bağlantısı olmayan sekmeler önizleme etiketi gösterir.
