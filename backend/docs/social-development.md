# Sosyal modül — çalışan yerel API

10 Ekim 2026. Bütün yollar `/v1` altında, mevcut Bearer oturumuyla çalışır. Kaynak: `src/modules/social`; [HTTP örnekleri](../examples/social.http). İsteklerde aktör daima CurrentUser'dan gelir, body'den alınmaz.

## Endpoint'ler

| Metot | Yol | Davranış |
| --- | --- | --- |
| GET | `/users/search?q=elif` | Kullanıcı adı başlangıcıyla arama; min 2/max 30, trim/küçük harf |
| GET | `/users/:userId/relationship` | İzleyiciye göre ilişki durumu |
| GET | `/me/friends` | Kabul edilmiş, aktif ve engelsiz arkadaşlar |
| GET | `/me/friend-requests?direction=incoming` | Bekleyen gelen istekler; direction=outgoing gidenleri verir |
| POST | `/friend-requests` | `{ targetUserId }`; istek gönderme |
| DELETE | `/friend-requests/:userId` | Kendi gönderdiğin isteği iptal |
| POST | `/friend-requests/:userId/accept` | Yalnız alıcı kabul eder; userId isteği gönderen kişidir |
| POST | `/friend-requests/:userId/decline` | Yalnız alıcı reddeder |
| DELETE | `/friends/:userId` | Arkadaşlığı kaldır |
| GET | `/me/blocks` | Kendi engellediğin hesaplar |
| PUT | `/blocks/:userId` | Engelle; ilişkiyi ve bekleyen isteği aynı transaction'da kaldır |
| DELETE | `/blocks/:userId` | Yalnız kendi engelini kaldır |
| PUT | `/users/:userId/follow` | Takip et; onaysız, doğal tekrar |
| DELETE | `/users/:userId/follow` | Takibi bırak; takip yoksa da 200 |
| GET | `/users/:userId/followers` | Takipçiler; createdAt + kullanıcı id cursor'ı |
| GET | `/users/:userId/following` | Takip edilenler; aynı cursor kuralı |

Komutlar başarılıysa 200 döner. İstek/arkadaşlık komutu yanıtı `{ userId, state }`; engel yanıtı `{ blockedUserId, blocked }`. İlişki durumları SELF, NONE, OUTGOING_REQUEST, INCOMING_REQUEST ve FRIENDS'tir. Engellenmiş hedefte ilişki endpoint'i 404 verir; karşı tarafın engel durumunu açmaz.

## Uygulanan geliştirme varsayımları

- İstek çifti UUID sırasıyla tek kanonik satırdır. Aynı göndericinin tekrar isteği yeni kayıt/olay oluşturmaz. Ters yönde bekleyen istekte `409 INCOMING_REQUEST_EXISTS`; otomatik kabul yapılmaz.
- Kendi isteğini kabul/red veya karşı tarafın isteğini iptal etme 409 olur. İlişkisi olmayan üçüncü kişi kabul edemez. Kişinin kendisiyle ilişki komutları 400 olur.
- Alıcının başarılı kabulü tekrarlanırsa FRIENDS döner, yeni olay oluşmaz. Reddedilmiş/iptal edilmiş istek kabul edilemez. Kabul edilmiş arkadaşlık red/iptal yoluyla kaldırılamaz.
- Red satırı DECLINED olarak korunur ve listelerde görünmez; aynı alıcının red tekrarı NONE döner. Sonraki istek yeni döngü açar, requesterId ve createdAt güncellenir. Bu aşamada ürün kararı olarak bir yeniden istek bekleme süresi seçilmedi.
- Gönderenin iptal ettiği veya kaldırılan arkadaşlık satırı silinir. Aynı iptal/kaldırma tekrarında ilişki yoksa NONE döner. Bekleyen istek için arkadaşlıktan çıkarma yerine iptal/red kullanılır.
- UserId ile gelen kabul/red komutları o çiftin **mevcut** istek durumuna uygulanır; geçmiş bir istek kimliği veya sürümüne bağlanmaz. Mobil güncel durumu okuyarak butonları yönetir.
- Engel arkadaşlığı ve bekleyen/reddedilmiş istek satırını kaldırır. İki yönde arama/profil/ilişki görünürlüğü kapanır. Karşılıklı engeller bağımsızdır; birini açmak diğerini açmaz. Engel açmak eski arkadaşlığı veya isteği geri getirmez.
- İstek işlemlerinde aktif/engelsiz hedef gerekir. İnaktif veya bulunamayan hedef ve engel aynı 404 kuralıyla ele alınır. Engelleme aktif hedefe yapılır; karşılıklı engel koyulabilir. Kendi engelini kaldırma, hedef hesabı inaktif olsa da yapılabilir; olmayan engeli kaldırmak 200 ve blocked=false döner.

## Takip

21 Ekim 2026. Kırmızı-siyah profil tasarımındaki takipçi/takip sayıları için eklendi. Takip arkadaşlığın **yanındadır**, yerine geçmez:

- Tek yönlüdür ve onay istemez. Takip `FRIENDS` görünürlüğünü, yorum/oy hakkını veya arkadaşlık durumunu değiştirmez; `socialRevision` artmaz.
- Komut yanıtı `{ userId, isFollowing, followerCount }`. `followerCount` hedefin aktif ve onunla engelsiz takipçileridir. Kendini takip 400 `SELF_RELATIONSHIP_NOT_ALLOWED`; veritabanında da `Follow_not_self` kuralı vardır.
- Takip için hedef aktif ve iki yönlü engelsiz olmalıdır, aksi 404. Takibi bırakmak hedef inaktif veya engelli olsa da yapılabilir.
- Engel iki yöndeki takibi aynı transaction'da siler. Engel açılınca takip geri gelmez.
- `GET /users/:userId/relationship` yanıtına `isFollowing` (izleyici takip ediyor) ve `followsYou` (hedef izleyiciyi takip ediyor) eklendi. Profil `counts` alanında `followers` ve `following` vardır.
- Liste satırı `{ user, followedAt, isFollowing, isSelf }`. Hedefle veya izleyiciyle engelli ya da aktif olmayan hesaplar listelenmez. Cursor liste türüne, izleyiciye ve hedefe bağlıdır.
- Her yeni/bırakılan takip `social.follow.created` / `social.follow.removed` outbox olayı yazar. Bildirim işleyicisi takip edilen kişiye `user.follow.received` bildirimi üretir (arkadaşlık bildirimi ayarını kullanır). Bırakılan takibin okunmamış bildirimi silinir; aynı kişinin tekrar takibi eski satır dururken yeni push üretmez.
- Hesap silme iki yöndeki takip kayıtlarını temizler.

## Liste ve arama yanıtları

Liste yanıtı `{ items, nextCursor }`, limit varsayılan 20/en fazla 50. Arama ve ilişki öğeleri `{ user: { id, username, displayName }, relationship, createdAt }` biçimindedir; özel profil, e-posta, oturum ve başkalarının ilişki listeleri dönmez.

Aramada kişinin kendisi, inaktif ve iki yönde engelli hesaplar hariçtir. Engel listesi yalnız kişinin kendi koyduğu engellerdir. Engel listesi öğesinde `blockedUserId`, `createdAt` ve `user` vardır; hedef artık aktif değilse user=null döner ve engeli kaldırmak için kimlik korunur.

Arama metnindeki alt çizgi gerçek karakter olarak eşleşir; LIKE wildcard'ı olarak kullanılmaz. PostgreSQL/Prisma filtre davranışı: [Prisma filtering FAQ](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/filtering-and-sorting). Bu davranış ayrı benzer kullanıcı adıyla test edildi.

Arama hesap createdAt/id, engeller createdAt/blockedId, ilişkiler createdAt/kanonik çift ile azalan sıralanır. İlişki tarihi kabul zamanı değil mevcut istek döngüsünün oluşturulma zamanıdır. Eşit timestamp durumunda çiftin iki tarafı da boşluk/tekrar olmadan sayfalanır. Cursor kullanıcı, liste, arama metni ve istek yönüne bağlıdır; yanlış bağlamda 400 INVALID_CURSOR. Cursor bir yetki kanıtı değildir; her sayfada güncel erişim filtreleri tekrar uygulanır. Kayıtlar değişirse liste sabit snapshot garantisi vermez.

## Ortak erişim servisi

SocialModule, SocialAccessService'i export eder; UsersModule onu kullanır. Başka modüller de aynı servisi kullanmalıdır:

- `activeUnblockedUserWhere(viewerId)`: aktif ve iki yönde engelsiz kullanıcı sorgu filtresi.
- `requireUserAccess(tx, viewerId, targetId)`: görünür kullanıcı ve ilişki durumu; bulunamayan/engelli hedefte aynı 404.
- `visiblePublishedPollWhere(viewerId)`: VISIBLE, OPEN/CLOSED; aktif/engelsiz yazar; PUBLIC veya kendi/kabul edilmiş arkadaşının FRIENDS yayını.
- `requirePublishedPollAccess(tx, viewerId, pollId)`: bu kurala göre minimal yayın okuma izni; gizli içerik varlığını açmayan 404.

Servis güvenilir, normalize edilmiş **kimliği doğrulanmış aktif izleyici** bağlamıyla çağrılır; AuthGuard yerine geçmez. Yayın okuma filtresi oy verme/kitle/süre kontrolü değildir ve taslak erişimi sağlamaz. Profil sayaçları, medya içerik, oylama detay/tercih/sonuç uçları bugün ortak filtreyi kullanır; taslak/iptal erişimini PollsService yalnız sahibine verir. Yorum endpoint'leri henüz yok; aynı servise bağlanacak. Özel yayın erişimi gerçek oluşturma/yayın, profil ve fotoğraf HTTP uçlarında arkadaşlık/engel komutları öncesi/sonrası test edildi. [Medya davranışı](media-development.md), [oylama davranışı](polls-development.md).

## Transaction ve olay sözleşmesi

Sosyal yazma işlemleri iki kullanıcı satırını UUID sırasıyla FOR UPDATE kilitler, aktörün aktifliğini tekrar kontrol eder. Aynı veya örtüşen çiftlerde istek/kabul/engel işlemleri ortak sıradan geçer. İlişki/engel değişikliği, iki kullanıcının socialRevision artışı ve iki outbox kaydı aynı transaction'dadır. Etkisiz tekrar yeni sürüm/olay oluşturmaz.

Olay: type=`social.relationship.changed`, aggregateType=`user-social`, aggregateId=ilgili kullanıcı, aggregateVersion=o kullanıcının socialRevision değeri. Payload:

```json
{
  "schemaVersion": 1,
  "userId": "ilgili-kullanici-uuid",
  "otherUserId": "diger-kullanici-uuid",
  "actorId": "islemi-yapan-uuid",
  "reason": "REQUESTED",
  "revision": 1
}
```

Reason: REQUESTED, ACCEPTED, DECLINED, CANCELLED, REMOVED, BLOCKED veya UNBLOCKED. Outbox'ın id alanı eventId'dir. Bunlar iç olaylardır; ham payload istemciye/push'a yayınlanmaz. Bildirim işçisi REQUESTED/ACCEPTED için güncel ilişkiyi kontrol ederek işlemi yapmayan tarafa bildirim üretir; diğer nedenler bekleyen istek bildirimini kaldırır ([bildirim rehberi](notifications-development.md)). Engel/red/kaldırma olayları otomatik olarak karşı tarafa bildirim göndermez. Sıra dışı veya eski olay erişim kazandırmaz; yetki güncel DB'den kontrol edilir. Olay kuyruğu işçisi olayı işleyince publishedAt dolar; Socket henüz yok.

Yedinci migration yalnız User.socialRevision ekler. Diğer bilgisayarda güncel koddan `npm run db:deploy` ve `npm run db:generate` çalıştırılır; reset gerekmez. Yeni rol/admin/katalog alanı eklenmedi.

## Doğrulama

`npm run test:social` 11 sosyal testi, `npm run test:api` mevcut auth/profil/sosyal testlerini çalıştırır. Yetkiler, ters/çift istek, iptal/red/kabul tekrarı, engel/unblock, özel yayın erişimi, eşit tarihli cursor'lar ve outbox hatasında rollback doğrulanır. Testler kendi benzersiz hesap/ilişki/olay/yayın fixture'larını temizler.

Yerel Prisma Postgres tek bağlantılıdır; kilit sırası uygulanmıştır fakat gerçek çok bağlantılı yarış testi yapılmış sayılmaz. Dağıtık yazma limiti/istek kötüye kullanım politikası ve gerçek PostgreSQL yarış kontrolleri dış kullanıcı öncesi ortak altyapı işlerinde kalır. Yerel medya/önizleme ve oylama oluşturma artık hazırdır; sonraki bizim adımımız ana akış, ardından günlük oyun/QR lobisidir.
