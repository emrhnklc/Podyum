# Özellik modülleri

`health` ve `auth` çalışır. Auth: e-posta/şifre, yerel doğrulama/reset mesajları, opaque oturumlar ve Google/Apple mock. Diğer klasörler henüz controller/service içermezler. Auth ayrıntıları: [geliştirme rehberi](../../docs/auth-development.md).

| Klasör | Sorumluluk |
| --- | --- |
| auth | Kimlik doğrulama, token doğrulama, auth guard/decorator/strategy |
| users | Profil, özel profil alanları ve stil etiketleri |
| social | Arkadaş isteği, kabul, arkadaşlık ve engelleme |
| media | Yükleme, işleme, önizleme ve yetkili görsel erişimi |
| polls | Kombin oylaması, tercih, sonuç, yorum ve kaydetme |
| games | Podyum odası, eşleşme, durum makinesi, turlar ve sonuç |
| notifications | Uygulama içi bildirim ve push |
| rewards | Profil puan hareketleri; ödül politikası seçilince etkinleşir |
| health | Süreç ve veritabanı sağlık kontrolleri |

Her modül ihtiyaç duyduğu `*.module.ts`, `*.controller.ts`, `*.service.ts` ve `dto/` dosyalarını kendi içinde tutar. Guard/strategy gibi alt klasörler yalnızca ilgili modülün ihtiyacı varsa açılır. Oda, matchmaking ve puanlama kodu büyürse `games` içinde alt servisler oluşturulur.

Controller HTTP giriş/çıkışını yönetir; service iş kurallarını ve transaction'ları yürütür; DTO istek/yanıt sözleşmesidir. Prisma modeli doğrudan kamusal yanıt DTO'su olarak kullanılmaz.

Başka modülün işlemi gerekiyorsa onun export ettiği servis kullanılır. DatabaseModule ortak DB istemcisini sağlar; domain yetkilendirmesini üstlenmez.
