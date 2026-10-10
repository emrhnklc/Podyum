# Profil ve ayarlar — çalışan yerel API

10 Ekim 2026. `users` modülü yerel DB üzerinde çalışır. Bütün yollar `/v1` altındadır ve mevcut Bearer oturumunu ister. İstek örnekleri: [users.http](../examples/users.http). Güncel tipler Swagger `/v1/docs` ve OpenAPI `/v1/openapi.json` üzerinden alınır.

## Endpoint'ler

| Metot | Yol | Davranış |
| --- | --- | --- |
| GET | `/me` | `{ profile, profileSetupRequired }`; kendi temel profilin |
| PATCH | `/me` | `username`, `displayName`, `bio`, `styleIds`; aynı yanıt biçimi |
| GET | `/users/:id` | Yalnızca kamusal profil alanları; aktif hedef ve iki yönde engel kontrolü |
| GET | `/users/username-availability?username=...` | Normalize edilmiş ad ve anlık `available` bilgisi |
| GET | `/style-tags` | Kontrollü stil sözlüğü; `{ id, label }[]` |
| GET / PATCH | `/me/private` | Kendi isteğe bağlı demografik bilgilerin ve analiz iznin |
| GET / PATCH | `/me/settings` | Kendi bildirim ve paylaşım varsayılanların |
| PUT / DELETE | `/me/avatar` | Medya modülü: kendi onaylı AVATAR fotoğrafını bağla / bağlantıyı kaldır |

Kamusal profil: `id`, `username`, `displayName`, `bio`, `styles`, nullable `avatarMediaId/avatarPath`, `createdAt`, `updatedAt`, `counts`. E-posta, oturum, özel bilgiler, analiz izni ve ayarlar bu nesneye girmez. GET `/me` de özel bilgileri içermez; ilgili özel endpoint ayrı okunur. Kapatılmış/askıya alınmış hedef ve iki yönlü engel, bulunamayan kullanıcıyla aynı `404 RESOURCE_NOT_FOUND` sonucunu verir.

## Düzenleme kuralları

- Alan gönderilmezse korunur. Boş PATCH `400 EMPTY_UPDATE`; bilinmeyen alan `400 VALIDATION_ERROR` olur. İstemci userId, status, isPlus veya puan belirleyemez.
- Kullanıcı adı auth ile aynı biçimde 3–30 karakter, `a-z/0-9/_`, trim ve küçük harf. Kendi mevcut adı uygundur. Silinmiş/askıya alınmış hesabın adı bu aşamada yeniden dağıtılmaz.
- Kullanıcı adı uygunluk sorgusu rezervasyon yapmaz. Son tekillik DB'de korunur; çakışma `409 USERNAME_UNAVAILABLE`, transaction içindeki diğer değişiklikler de geri alınır.
- Görünen ad trim sonrası 1–80, bio en fazla 300 karakterdir. Bio `null` veya boş metinle temizlenir; kullanıcı adı/görünen ad/stiller için `null` geçersizdir.
- `styleIds` en fazla 10 farklı sözlük id'sidir. Bilinmeyen id `400 UNKNOWN_STYLE_TAG`; `[]` seçimleri temizler. Profil ve stiller birlikte atomik kaydedilir.
- Mock ilk kurulumu, `username` ve `displayName` aynı başarılı PATCH'te gönderilince tamamlanır. Yalnız bio/stil güncellemesi kurulumu tamamlamaz. `/auth/me` ile `/me` aynı `profileSetupRequired` durumunu gösterir.

## Sayaçlar

`counts.polls`, VISIBLE ve OPEN/CLOSED yayınları sayar. Kendi profili ve kabul edilmiş arkadaş hem PUBLIC hem FRIENDS yayınlarını sayar; diğer izleyici yalnız PUBLIC sayar. Taslak, iptal, gizlenmiş ve kaldırılmış içerik hariçtir. GET snapshot'ı aynı transaction'da okunur.

`counts.friends`, kabul edilmiş, aktif ve profil sahibiyle engel ilişkisi olmayan arkadaşları sayar. `counts.stars`, mevcut PointsLedger toplamıdır; veri yoksa sıfır. Profil API'si puan üretmez. Oyun ödülleri/ligler Faz 2'dir. Sosyal ve paylaşım oluşturma API'leri hazır; sayaç görünürlüğü ayrıca DB fixture'ları ve gerçek yayın akışıyla doğrulanır.

## Özel bilgiler ve analiz izni

Özel yanıt: `gender`, `ageBand`, `cityCode`, `analyticsConsent`, `analyticsConsentAt`, `analyticsRevision`. İlk üç alan isteğe bağlıdır ve `null` ile temizlenebilir. Cinsiyet/yaş enum'ları Prisma ile aynıdır; tam doğum tarihi alınmaz. Şehir kodu en fazla 30 karakter, büyük harf/numara/alt çizgi/tire biçimindedir; doğrulanmış şehir sözlüğü veya otomatik konum tespiti değildir.

Demografik alanları doldurmak analiz izni vermez. `analyticsConsent` başlangıçta false'tur; yalnızca açık boolean değiştirir. True iznin verildiği sunucu zamanını yazar, false bunu temizler. Aynı değerin tekrarı tarihi ve sürümü değiştirmez. Önceden alınmış verinin yeniden işlenmesi ve izin geri alma işçisi trend entegrasyonunda uygulanacak.

Gerçek izin veya demografi değişikliğinde UserPrivate ve OutboxEvent aynı transaction'da yazılır. Olay sözleşmesi:

```json
{
  "aggregateType": "user-analytics",
  "aggregateId": "user-uuid",
  "aggregateVersion": 3,
  "type": "user.analytics-preferences.changed",
  "payload": {
    "schemaVersion": 1,
    "userId": "user-uuid",
    "revision": 3,
    "analyticsConsent": false,
    "consentChanged": true,
    "demographicsChanged": false,
    "changedAt": "2026-10-10T12:00:00.000Z"
  }
}
```

Olayın `id` alanı DB tarafından üretilir; tüketici eventId ve kullanıcı başına revision ile tekrar/sıra dışı teslimi ele almalıdır. Olay ham cinsiyet/yaş/şehir içermez, HTTP'den yayınlanmaz. Gönderici/işçi ve trend katkısı çıkarma henüz uygulanmadı; olaylar publishedAt=null kalır. Bu olay geçmiş tercihlerin demografisini yeni bilgilerle değiştirme talimatı değildir. Tercih anı izinli snapshot ve izin geri alırken bütün oy demografisini temizleme artık çalışır; oy sayısı korunur, yeniden izin eski snapshot’ı doldurmaz. Trend tüketicisinin eski toplu katkıları geri alması arkadaşın entegrasyonunda ayrıca uygulanacak. [Oy/izin sözleşmesi](poll-votes-development.md).

## Ayar varsayımları

`pushEnabled`, `friendRequestNotifications`, `pollResultNotifications`, `commentNotifications`, `defaultCommentsEnabled` ve `defaultBlurFace` true; `defaultPollVisibility` PUBLIC. Bunlar değiştirilebilir geliştirme varsayımlarıdır. İlk GET, satır oluşturmadan varsayılanı döndürür. PATCH sadece gönderilen alanları günceller; kısmi güncellemeler birbirini silmez.

Bildirim alanları ileride gönderim tercihi olarak kullanılacak; bugün push göndermez. `defaultBlurFace` yeni medya izninde, blurRequested gönderilmezse uygulanır. Manuel bölge seçimi ve önizleme onayı gerekir; otomatik yüz tespiti henüz yoktur. Oylama oluşturma görünürlük/yorum varsayılanlarını kullanır; mevcut bir paylaşımın görünürlüğü/yorumları ayar değişikliğiyle geriye dönük değişmez. Ayrı kapalı hesap özelliği eklenmedi; PUBLIC/FRIENDS paylaşım kuralı korunur.

## Kurulum, doğrulama ve kalan bağlantılar

Altıncı migration `UserSettings` ve `UserPrivate.analyticsRevision` ekler. Diğer bilgisayarda güncel koddan `npm run db:deploy` ve `npm run db:generate` çalıştırılır; mevcut DB resetlenmez.

`npm run test:users` profil/ayar HTTP testlerini, `npm run test:api` auth + profil testlerini çalıştırır. Derlenmiş gerçek Nest uygulaması ve mevcut yerel DB kullanılır. Testler yalnız kendi benzersiz hesap, stil, ilişki, paylaşım ve olay fixture'larını temizler. Tek bağlantılı yerel Prisma Postgres gerçek eşzamanlı yarış testi değildir.

Avatar/yükleme yerel medya modülüne bağlıdır; profil PATCH'i mediaId veya avatarMediaId kabul etmez. Kendi paylaşım listesi `GET /me/polls` ile çalışır. Başkasının profil paylaşımları `GET /users/:id/polls`, kişisel kaydedilenler `GET /me/saved-polls` ile çalışır: [etkileşim rehberi](interactions-development.md). Push tüketimi, trend işçisi ve Plus alanları kendi adımlarında bağlanacak. Bu modül onlar için çalışan sahte endpoint veya ücretli hak üretmez. Sosyal, medya ve oylama modülleri ortak SocialAccessService'i kullanır. [Sosyal rehber](social-development.md), [medya rehberi](media-development.md), [oylama rehberi](polls-development.md). [Organik ana akış](feed-development.md) hazırdır; sonraki bizim işimiz günlük podyum/QR lobisidir.
