# Frontend feature sınırları

| Feature | Sorumluluk |
| --- | --- |
| auth | Giriş/kayıt/oturum akışları; şimdi hazırlık ekranı |
| feed | Keşfet filtresi, kart seçimi ve akış ekranı |
| polls | Kombin kartı, tercih/sonuç, paylaş formu ve detay |
| profile | Kullanıcı profili, paylaşım ve kaydedilenler görünümü |
| friends | Arkadaş listesi ve ileride sosyal işlemler |
| trends | Ürün sıralaması, dönem/kitle/fiyat/kategori filtreleri |
| games | Günlük etkinlik ve QR lobileri; şimdi hazırlık ekranı |
| notifications | Bildirim listesi/boş durum ve ileride cihaz kaydı |

`app/` feature ekranını açar. Feature API çağrıları eklendiğinde o feature'ın `api/` klasöründe ortak `lib/api/client` kullanılır. Backend DTO/Prisma modeli frontend'e doğrudan import edilmez. Teknik API istemcisi iş kuralı hesaplamaz.

Ortak UI `components`, renk/font/ölçü `theme` altındadır. Bir feature'a özel hook veya bileşen ortak klasöre konmaz. Feature'lar başka feature'ın iç state'ini değiştirmez; demo tercih/kaydetme için PollsProvider açık bir hook sunar. Demo profil ve trend verileri kendi feature'larında tutulur.

Auth ekranı şu an demo gezinmeyi engellemez; bu gerçek API yetkilendirmesi değildir. Kalıcı oturum, refresh ve güvenli depolama ayrı entegrasyondur. Oyun/ödül ve Plus hakkı istemci varsayımıyla açılmaz.
