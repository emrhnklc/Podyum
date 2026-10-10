# Frontend feature sınırları

| Feature | Sorumluluk |
| --- | --- |
| auth | Gerçek giriş/kayıt/yerel doğrulama/oturum ve profil kurulumu |
| feed | Keşfet filtresi, kart seçimi ve akış ekranı |
| polls | Kombin kartı, tercih/sonuç, paylaş formu ve detay |
| profile | Kullanıcı profili, paylaşım ve kaydedilenler görünümü |
| friends | Arkadaş listesi ve ileride sosyal işlemler |
| trends | Ürün sıralaması, dönem/kitle/fiyat/kategori filtreleri |
| games | Günlük etkinlik ve QR lobileri; şimdi hazırlık ekranı |
| notifications | Bildirim listesi/boş durum ve ileride cihaz kaydı |

`app/` feature ekranını açar. Feature API çağrıları eklendiğinde o feature'ın `api/` klasöründe ortak `lib/api/client` kullanılır. Backend DTO/Prisma modeli frontend'e doğrudan import edilmez. Teknik API istemcisi iş kuralı hesaplamaz.

Ortak UI `components`, renk/font/ölçü `theme` altındadır. Bir feature'a özel hook veya bileşen ortak klasöre konmaz. Feature'lar başka feature'ın iç state'ini değiştirmez; demo tercih/kaydetme için PollsProvider açık bir hook sunar. Demo profil ve trend verileri kendi feature'larında tutulur.

Karşılamadaki Başla anonim demo gezinmesini açar; gerçek işlemler AuthProvider ve backend oturum denetimi gerektirir. Native güvenli oturum deposu ve refresh bağlıdır. Kayıt/profil kurulumu sözleşmesi `../../docs/registration-api-integration.md` içindedir. Oyun/ödül ve Plus hakkı istemci varsayımıyla açılmaz.
