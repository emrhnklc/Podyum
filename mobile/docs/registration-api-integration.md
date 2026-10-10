# Gerçek kayıt ve profil kurulumu

10 Ekim 2026. Üç adımlı kahve/krem kayıt tasarımı mevcut Auth, Users ve Media API'lerini kullanır. Backend şeması ve kimlik doğrulama kuralları değişmez.

## Akış

1. **Hesap:** ad, kullanıcı adı, e-posta ve parola `/auth/register` ile gönderilir. Kullanıcı adı 3–30 küçük harf/rakam/alt çizgi; parola 15–128 karakter; ad 1–80 karakterdir. Parola kırpılmaz. 202 yanıtı oturum değildir ve hesabın yeni oluşturulduğunu kanıtlamaz; mevcut e-postaya da aynı yanıt verilir.
2. **Doğrulama:** tek kullanımlık anahtar `/auth/email-verification/confirm` ile tüketilir. Yeni anahtar `/auth/email-verification/request` ile istenir; önceki anahtar geçersizleşir. Başarılı doğrulama ayrı gösterilir, ardından normal `/auth/login` ve `/auth/me` ile giriş yapılır. Doğrulama yanıtı kaybolmuşsa “Daha önce doğruladım” ile giriş denenebilir; oturum için e-posta/parola her durumda gerekir. Mevcut hesap/parola uyuşmazlığında ayrı giriş ekranına geçilebilir.
3. **Profil:** doğrulanmış oturum açılınca form mevcut `/me` profilini okur. Görünen ad ve biyografi `/me` PATCH ile kaydedilir. İsteğe bağlı fotoğraf AVATAR izni → multipart yükleme → complete → işlenmiş önizleme → kullanıcının açık onayı → `/me/avatar` bağlama sırasını kullanır. Önizleme onaylanmadan sonraki adıma geçilmez. Fotoğrafa blur uygulanmaz; ekranda belirtilir. JPEG/PNG/WebP, en fazla 10 MB; backend ayrıca gerçek içerik/piksel sınırını denetler.
4. **Stil:** seçenekler `/style-tags` sözlüğünden gelir; etiket adları yerine gerçek id'ler `/me` PATCH ile gönderilir. En fazla beş seçim yapılabilir; adım geçilirse mevcut stiller korunur. Bitişte `/auth/me` yenilenir ve gerçek Keşfet açılır.

Üç tasarım adımı korunur; doğrulama hesabın ardından araya girer. Aynı düğmeye çift basma engellenir, hata durumunda adım ilerlemez. Önceki adımın başarılı sunucu kaydı korunur; bütün kayıt/profil/fotoğraf hattı tek transaction değildir. Bir fotoğraf onaylama/bağlama yanıtı kaybolursa aynı medya kimliğiyle tekrar denenebilir. Başarısız yükleme yeniden fotoğraf seçmeyi gerektirebilir; bağlanmamış medya için genel saklama/temizlik işi backend yol haritasında açıktır.

Parola ve doğrulama anahtarı yalnız açık formun belleğinde tutulur; dosyaya, SecureStore'a, demo profile veya loga yazılmaz. Native depoya yalnız normal oturum token çifti gider. Hesap değişince form yeniden kurulur; avatar hattı da hesap değişimini denetler. Uygulama kapanırsa yeniden giriş/doğrulama ekranından devam edilir; gönderilmemiş profil taslağı geri gelmez. Gönderilmiş profil alanları ve avatar sunucudadır. Profil sekmesinin demo tasarımı henüz bu kayıtları göstermez.

## Yerel doğrulamayı deneme

Mevcut backend yalnız `local-only` posta taşır; internet üzerinden gerçek e-posta yollamaz. Ekran bunu açıkça söyler. Backend çalışırken:

1. Karşılama → **Kayıt ol**, ilk adımı doldur ve devam et.
2. VS Code'da `backend/.local/mailbox/` klasöründe e-postanla eşleşen en yeni `VERIFY_EMAIL` JSON dosyasını aç. `LOCAL_MAILBOX_DIR` farklı ayarlanmışsa o klasörü kullan.
3. Dosyanın `token` değerini uygulamadaki **Doğrulama anahtarı** alanına yapıştır. Dosya/anahtar Git'e veya herkese açık bir API'ye konmaz.
4. **E-postayı doğrula** → **Profilini tamamla** → profil/stil → Keşfet.

Giriş ekranındaki `EMAIL_NOT_VERIFIED` hatası da doğrulama ekranına geçiş sağlar. `/auth/verify-email` route'u varsa `token` parametresini forma doldurur; otomatik tüketmez. Gerçek e-posta sağlayıcısı, doğrulama bağlantısının teslimi ve mağaza sürümünün link kabulü ayrıca bağlanacaktır.

Konum, Instagram ve ilgi kategorilerinin uygun backend sözleşmesi henüz yoktur. Alanlar veri toplamaz ve kayıt edilmiş gibi gösterilmez. Demografik bilgiler ve analiz izni bu akışta alınmaz; izin varsayılan kapalı kalır. Şifre sıfırlama arayüzü ve gerçek Google/Apple entegrasyonu sonraki işlerdir.

## Kontroller

Mobile klasöründe:

```bash
npm run test:session
npm run test:registration
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000/v1 npm run test:registration-api
npm run typecheck
npm run lint
npm run check:expo
npm run build
```

API smoke yalnız açıkça seçilmiş yerel `/v1` sunucusuna gider ve yeni `signup_` test hesabı oluşturur; mevcut demo/gerçek hesapları değiştirmez. Yerel posta kutusundan yalnız o test hesabının anahtarını okur; token/parolayı yazdırmaz. Test hesabı ve örnek avatar yerel DB'de kalır. Özel posta klasörü için `LOCAL_MAILBOX_DIR` mutlak yolunu ayrıca ver.

Kontrol kapsamı: alan kuralları; doğrulanmadan giriş reddi; yeniden gönderim/eski anahtar/replay; mevcut hesabın adı/parolasının korunması; kullanıcı adı çakışması; profil/stiller; avatar önizleme/onay/tekrar; varsayılan analiz izni; yeniden girişte kalıcılık. Unit testleri parola sınırlarını, noktalı kullanıcı adını, eşzamanlı oturum yenilemelerini ve geç profil yanıtının çıkışı bozamamasını doğrular. Export, fiziksel telefonda galeri ve ekran testi yerine geçmez.
