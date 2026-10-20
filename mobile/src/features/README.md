# Frontend feature sınırları

| Feature | Sorumluluk |
| --- | --- |
| auth | Gerçek giriş/kayıt/yerel doğrulama/oturum ve profil kurulumu |
| feed | Keşfet filtresi, kart seçimi ve akış ekranı |
| polls | Kombin kartı, tercih/sonuç, paylaş formu ve detay |
| profile | Kullanıcı profili, paylaşım ve kaydedilenler görünümü |
| people | Kullanıcı arama, ilişki durumu ve profil bağlantıları |
| moderation | Kullanıcı/oylama/yorum şikâyeti |
| settings | Kalıcı tercihler, engellenenler, güvenlik ve silme |
| friends | Gerçek arkadaş listesi, gelen/giden istekler ve yönetimi |
| trends | Gerçek dönem/kitle/marka/fiyat/kategori API’si, cursor/409 yenileme ve örneklem durumları |
| games | Gerçek açık/davetli oda, günlük etkinlik, QR, fotoğraf, yıldız, sonuç/geçmiş ve lig |
| notifications | Gerçek liste, okundu, hedefe geçiş; cihaz push teslimi ayrıca kurulacak |

`app/` feature ekranını açar. Feature API çağrıları eklendiğinde o feature'ın `api/` klasöründe ortak `lib/api/client` kullanılır. Backend DTO/Prisma modeli frontend'e doğrudan import edilmez. Teknik API istemcisi iş kuralı hesaplamaz.

Ortak UI `components`, renk/font/ölçü `theme` altındadır. Bir feature'a özel hook veya bileşen ortak klasöre konmaz. Feature'lar başka feature'ın iç state'ini değiştirmez; demo tercih/kaydetme için PollsProvider açık bir hook sunar. Eski profil/demo önizlemeleri kendi feature’larında tutulur; Trendler yalnız gerçek API kullanır.

Karşılamadaki Başla e-posta girişini açar; gerçek işlemler AuthProvider ve backend oturum denetimi gerektirir. Native güvenli oturum deposu ve refresh bağlıdır. Kayıt/profil kurulumu sözleşmesi `../../docs/registration-api-integration.md` içindedir. Oyun/ödül ve Plus hakkı istemci varsayımıyla açılmaz.
