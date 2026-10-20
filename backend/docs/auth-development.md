# Çalışan auth akışı

E-posta/şifre ve sunucuda saklanan oturumlar çalışır. Kayıt, giriş ve şifre sıfırlamada parola sınırı 8–128 karakterdir; parola kırpılmaz. E-posta teslimi yerel dosyadır; Google/Apple yalnızca geliştirme mock'udur. Gerçek OAuth ve gerçek e-posta gönderimi tamamlanmadı.

## Çalıştır

```bash
npm run db:start
npm run db:deploy
npm start
```

- Swagger: `http://127.0.0.1:3000/v1/docs`
- OpenAPI: `http://127.0.0.1:3000/v1/openapi.json`
- HTTP örnekleri: [examples/auth.http](../examples/auth.http)
- Davranış testleri: `npm run test:api`

`AUTH_MOCK_ENABLED` tanımlanmadığında `false` kabul edilir. Mock denemek için `.env` içine `AUTH_MOCK_ENABLED="true"` yazıp sunucuyu yeniden başlatın. `NODE_ENV=production` açılışı henüz reddedilir; yerel posta ve sahte kimliklerle canlı ortama geçilmez.

## Endpoint'ler

Tüm yollar `/v1` altındadır.

| Metot/yol | Davranış |
| --- | --- |
| GET `/auth/providers` | E-posta/Google/Apple ve `mock`/`unconfigured` durumu |
| POST `/auth/register` | E-posta, şifre, kullanıcı adı, görünen ad; 202 |
| POST `/auth/email-verification/request` | `{email}`; uygunsa yeni doğrulama; 202 |
| POST `/auth/email-verification/confirm` | `{token}`; tek kullanımlık doğrulama; 200 |
| POST `/auth/login` | `{email,password}`; token çifti; 200 |
| POST `/auth/refresh` | `{refreshToken}`; yeni token çifti; 200 |
| GET `/auth/me` | Bearer oturumla kimlik ve `profileSetupRequired`; 200 |
| POST `/auth/logout` | Bearer oturumla mevcut cihazdan çıkış; 200 |
| POST `/auth/logout-all` | Bearer oturumla tüm cihazlardan çıkış; 200 |
| POST `/auth/password-reset/request` | `{email}`; uygunsa reset; 202 |
| POST `/auth/password-reset/confirm` | `{token,password}`; şifre değiştir, bütün oturumları kapat; 200 |
| POST `/auth/mock` | `{provider,subject,acknowledgeMock:true}`; yalnızca mock açıkken; 200 |

Kayıt aynı e-postayla tekrarlanırsa ikinci kullanıcı oluşturulmaz; 202 döner, mevcut şifre/ad değiştirilmez. Yeni doğrulama için ayrı request endpoint'i kullanılır. Kullanıcı adı başkası tarafından alınmışsa `409 USERNAME_UNAVAILABLE` gelir.

Kayıt sonrası `.local/mailbox` altındaki ilgili `VERIFY_EMAIL` dosyasından `token` değerini alıp confirm endpoint'ine gönderin; sonra login yapın. Reset de aynı kutuda `RESET_PASSWORD` türündedir. Posta kutusu yalnızca yerel geliştirme içindir; token'ları ortak loglara kopyalamayın.

Yanıt örneği:

```json
{
  "accessToken": "opaque-token",
  "refreshToken": "opaque-refresh-token",
  "tokenType": "Bearer",
  "accessExpiresAt": "2026-10-10T11:15:00.000Z",
  "refreshExpiresAt": "2026-11-09T11:00:00.000Z",
  "sessionId": "uuid",
  "mock": false
}
```

Access token JWT değildir; istemci içeriğini çözmeye çalışmaz. Sonraki isteklerde `Authorization: Bearer <accessToken>` kullanılır. `X-User-Id` veya body'deki `userId` kimlik sayılmaz. Global guard bütün ürün endpoint'lerini varsayılan olarak korur; herkese açık endpoint açıkça `@Public()` işaretlenir. Sağlık kontrolleri açıktır.

Refresh eski token çiftini kapatır. Mobil aynı oturum için tek bir refresh isteği yürütmeli ve yeni çifti birlikte saklamalıdır. Kullanılmış refresh yeniden sunulursa aynı cihazın oturumu iptal edilir; diğer cihazlar etkilenmez. Yenileme yanıtı kaybolursa otomatik eski token tekrarı yerine yeniden giriş gerekir. Bu davranış idempotent POST komutlarından farklıdır.

Askıya alınmış hesap `403 ACCOUNT_SUSPENDED`, silinmiş hesap/geçersiz veya süresi dolmuş oturum `401 INVALID_SESSION` alır. E-posta onayı etkinse doğru şifreyle henüz doğrulanmamış e-posta `403 EMAIL_NOT_VERIFIED` alır. Yanlış e-posta/şifre `401 INVALID_CREDENTIALS` olur. Hatalar ortak `{error:{code,message,requestId,fields?}}` şeklindedir.

## Sınırlar

- Auth controller'ında IP başına dakikada 30 istek sınırı vardır; aşımda 429 ve `Retry-After`. Sayaç tek API sürecinin belleğindedir; çok instance/üretim öncesinde ortak limiter ve hesap bazlı deneme kontrolü gerekir. İstemciden gelen forwarded IP'ler otomatik güvenilir sayılmaz.
- İstek JSON boyutu en fazla 64 KiB'dir; DTO alanları dışında değerler reddedilir. Medya multipart dosyası için ayrı 10 MiB sınırı uygulanır; [medya rehberi](media-development.md).
- Minimum yaş/izin politikası, gerçek OAuth, güvenli hesap bağlama, gerçek e-posta teslimi ve oturum/veri saklama temizliği dış kullanıcı sürümünden önce tamamlanacak.
- Bu auth endpoint'leri `Idempotency-Key` istemez. Paylaşım/oyun komutlarının kalıcı idempotency servisi ilgili adımda eklenecek.
- Yerel PostgreSQL tek bağlantılıdır. Testler sıralı HTTP davranışını doğrular; çok bağlantılı refresh/reset/kayıt yarışları gerçek PostgreSQL'de ayrıca test edilecek.
- Şifreleme uygulaması için [Node scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback), parametre seçimi için [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) esas alındı.

## E-posta onayı ayarı

`AUTH_EMAIL_VERIFICATION_REQUIRED` (varsayılan `false`). Kapalıyken kayıt olan hesap `emailVerifiedAt` dolu açılır, doğrulama postası gönderilmez ve giriş onay istemez; ürün kararı olarak şimdilik kapalıdır. `true` yapılınca önceki davranış döner: kayıtta VERIFY_EMAIL postası, onaysız girişte `403 EMAIL_NOT_VERIFIED`. Ayar her istekte okunur; kapalıyken açılmış hesaplar onaylı kalır.
