# Hesap silme ve kalıcı temizlik — 16. adım

Kullanıcı kararı: geçmiş tercihler ve oyun sonuçları anonim kalsın; başkalarının sonuç toplamları değişmesin. Çalışan yerel akış erişimi ve kimlik/özel bilgileri kapatır, sonra yeniden denenebilir bir iş içerik/dosya temizliğini tamamlar. Bu teknik akış genel saklama politikasının veya veri dışa aktarımının tamamlandığı anlamına gelmez.

## API ve mobil davranışı

`DELETE /v1/me/account`, aktif Bearer oturumu ve yalnız `{ "confirmDeletion": true }` alır. Kullanıcı kimliği body'den alınmaz. Oturum son 15 dakika içinde **yeni girişle** açılmış olmalıdır; refresh oturumun createdAt tarihini yenilemez. Eski giriş `403 RECENT_LOGIN_REQUIRED`; yeniden girişten sonra işlem tekrar edilir. ADMIN hesabı `409 PROTECTED_ADMIN` alır; rol önce güvenilen yerel yönetimle kaldırılır. SUSPENDED hesap mevcut auth kuralı gereği bu uca erişemez; askıdan bağımsız silme başvurusu ayrı açık iştir.

Başarı 202:

```json
{
  "deletionId": "uuid",
  "status": "ACCEPTED",
  "requestedAt": "2026-10-10T19:00:00.000Z"
}
```

202 hesabın kapandığını ve kalıcı temizlik işinin kaydedildiğini gösterir; disk silmesinin bittiği anlamına gelmez. Mobil onayı aldıktan sonra access/refresh token, kişisel cache, saklanan medya ve socket bağlantılarını kaldırır, giriş ekranına döner. Silme isteği timeout olursa aynı tokenla `/auth/me` kontrol edilir: INVALID_SESSION durumunda yerel oturum temizlenir; ağ hatası kesin silme sonucu sayılmaz. Başka cihazdan çıkış/token süresi dolması da INVALID_SESSION verebildiğinden bu durum kullanıcıya kesin "tüm dosyalar silindi" diye gösterilmez.

Idempotency-Key zorunlu değildir. Kullanıcı başına tek AccountDeletion kaydı doğal tekilliktir; iki eşzamanlı istekten biri kabul edilir, diğeri artık geçersiz oturum alır. Başarıdan sonra eski tokenla makbuz replay veya anonim status sorgusu yoktur. Yeniden kayıt/Google-Apple mock girişi yeni hesap oluşturabilir; eski DELETED kullanıcıyı ve sonuç bağlantılarını geri açmaz.

Yönetici `GET /v1/admin/users/:id/deletion` ile `{deletionId,userId,status:PENDING|COMPLETED,requestedAt,completedAt,pendingMedia}` okur. Rol her istekte güncel DB'den denetlenir. Özel temizlik hash'leri bu yanıta veya OpenAPI'ye girmez. [HTTP örnekleri](../examples/accounts.http).

## İlk transaction: erişim ve kimlik

User satırı kilitlenir; güncel hesap, oturum, son giriş ve rol tekrar kontrol edilir. Bu transaction kaynak poll/game/media satırlarını kilitlemez; mevcut kaynak → kullanıcı kilit sırasını tersine çevirmez.

- User.status DELETED, görünen ad "Silinmiş kullanıcı", rastgele tombstone kullanıcı adı; bio/avatar/profileCompletedAt temizlenir. Eski kullanıcı adı serbest kalır.
- Tüm cihaz, kullanılmış refresh, oturum, e-posta/parola credential'ı, e-posta action token'ı ve dış/mock kimlik bağlantısı silinir.
- UserPrivate/UserSettings/UserStyle temizlenir; mevcut PollVote demografik snapshot ve izin alanları null olur. PollVote tercih satırı korunur.
- AccountDeletion, user.status.changed, user.analytics-preferences.changed ve account.deletion.requested aynı transaction'da kaydedilir. Outbox hatası hepsini geri alır.

Profil/içerik/medya sorgularının aktif hesap koşulu erişimi hemen kapatır. Admin medya incelemesi de DELETED sahibin dosyasını açmaz. Socket kullanıcı durum olayında veya periyodik kontrolde eski oturumu reddeder. Önceden indirilmiş fotoğraflar, gönderilmiş push ve uygulama dışındaki kopyalar uzaktan geri alınamaz.

## Kalıcı temizlik işi

AccountErasureService mevcut OutboxRegistry'ye kayıtlıdır. `account.deletion.requested` commit sonrasında tüketilir; yeniden başlatmada DB'deki iş devam eder. `OUTBOX_WORKER_ENABLED=false` otomatik temizliği de durdurur; erişim kapalı kalır. Kullanıcı endpoint'i dosya silmesini beklemez.

İş her kaynak için ayrı transaction kullanır, tekrar güvenlidir:

1. Kişinin paylaşımları REMOVED olur; soru/occasion ve ürün etiketleri/linkleri temizlenir. Seçenek/oy FK'leri geçmiş için tutulur. İçerik geri açılmaz.
2. Kişinin yorumları ve kendi paylaşımlarındaki yorumlar REMOVED olur, body boşaltılır. Mevcut kaldıran/tarih korunur; ilk kaldırma silinen kullanıcıya bağlanır. Bildirim grupları mevcut comment.removed hattıyla güncellenir.
3. Oyun üyeliği LEFT, teslim WITHDRAWN olur. Özel lobinin hostuysa aktif lobi HOST_ACCOUNT_DELETED ile iptal edilir, daveti kapanır; kişisel tema başlığı temizlenir. DAILY etkinlik diğer üyeler için sürer. Tamamlanmış GameScore/GameOutcome ve başkalarının toplamı korunur; silinen kişinin fotoğrafı sonuç listesinde gösterilmez.
4. Eski oyun modeli için aktif üyelik/davet kapanır, teslim görünmez olur; eski FK/puan geçmişi tutulur.
5. Sahip olunan bağlı ve boşta bütün medya DELETED yapılır; işlem sürümü artırılır. Bilinen source/display/thumbnail dosyaları ve UUID dizini kaldırılır; filesPurgedAt kaydedilir, boyut/checksum/işleme metadatası temizlenir. Medya satırı FK tombstone'udur. Sürmekte olan işin READY commit'i sahibin ACTIVE olmasını da ister; geç işleme kaydı canlandıramaz. İşleme finally'si geç çıktıları kaldırır; süreç bu sırada çökerse mevcut medya orphan scavenger'ı kalan dizinleri temizler.
6. Yerel e-posta/push teslim dosyaları kullanıcı kimliği, eski token hash'i veya bildirim kimliğiyle eşlenip kaldırılır. Yeni yerel teslimlerde userId bulunur; Expo'ya giden payload'a eklenmez. Yerel push yazımı User kilidi ve güncel ACTIVE kontrolüyle silme kabulüyle sıralanır; kapalı hesaba geç dosya yazılmaz. Süresi dolmuş eski yerel teslimler de temizlenir. Başka hesabın geçerli dosyası korunur.
7. Arkadaşlık/engel, kendi kaydetmeleri/nedenleri, alıcı veya aktör olduğu bildirimler, kendi idempotency makbuzları ve kendi şikâyet açıklaması temizlenir. completedAt ve account.deletion.completed son transaction'da tek kez yazılır.

Geçmiş tercihler ve yıldızlar aynı tombstone UUID'sine bağlı kalır; uygulama kullanıcının eski ismini/profilini göstermez. Bu, veritabanı açısından ilişkileri koruyan kişisel alan temizliğidir; geçmiş kayıtların birbirine bağlanabilirliği tamamen yok olmaz. Şikâyet/denetim gerekçeleri, başkalarının yazdığı içerik, yedekler, dış sağlayıcı kayıtları ve genel operasyonel geçmiş için saklama/redaksiyon politikası ayrıca tamamlanmalıdır. Otomatik olarak her metinde bir kişinin adını bulup silme yapılmaz.

## Hata ve yeniden deneme

Disk/yerel teslim dosyası hatasında completedAt yazılmaz. Daha önce temizlenen kaynaklar geri açılmaz; sonraki deneme eksik işi tamamlar. AccountDeletion yalnız mevcut DELETED hesap ve kayıtlı silme işi üzerinde çalışır; CLI aktif bir hesabı silmeye başlayamaz. Yeni isteklerin eski profil/içerik/cihazı yeniden yazmaması için kaynak kilidi sonrası aktiflik ve cihaz oturumu yeniden denetlenir. Sonuçların ve çok bağlantılı kilit yarışlarının PostgreSQL kabul testi 17. adımda kalır.

Outbox 12 başarısız denemeden sonra otomatik denemeyi durdurur; iş PENDING kalır. Sorunu giderince güvenilen yerel terminalde yalnız hedef iş:

```bash
npm run accounts:cleanup -- <user-uuid>
```

Komut yerel proje DB hedefini denetler; yeni silme isteği oluşturmaz ve diğer işçileri açmaz. Tamamlanmış iş tekrarında etkisizdir. İşin tamamlanması kaynak outbox makbuzunu otomatik yayınlandı yapmaz; eski olay tekrar işlense de tamamlanmış iş yeniden içerik silmez.

Bu teslim tek makinede aynı LOCAL_MEDIA_DIR/LOCAL_MAILBOX_DIR/LOCAL_PUSH_DIR alanlarını kullanan API/işçi içindir. Ayrı makinelerde yerel dosya depoları ortak değildir; üretimde ortak depo ve worker yönlendirmesi gerekir.

Yönetici durum uçları PENDING işi görünür kılar; otomatik alarm/üretim gözlemlenebilirliği henüz yoktur. Yerel hash/notification eşleme dizileri tamamlanınca boşaltılır; ham e-posta/push token'ı AccountDeletion'a yazılmaz. Transaction/disk çöküşünden kalan, kimliğe bağlanamayan eski yerel dosyalar genel süreli temizlikle kapsanır; keyfî klasör tarama yapılmaz.

## Kurulum ve kontroller

17. migration `20261011000000_account_deletion` tekil AccountDeletion ve iki CHECK ekler: bitiş başlangıçtan önce olamaz; tamamlanmış işte geçici hash/kimlik dizileri boş olmalıdır. 18. migration `20261011000100_account_deletion_array_guard` bu dizilerin SQL NULL olmasını da engeller. Eski migration'lar ve demo verileri korunur. Başka bilgisayarda backend klasöründe:

```bash
npm ci
npm run db:deploy
npm run db:generate
npm run test:accounts
```

13 HTTP/DB/Socket senaryosu: onay/kimlik/son giriş/refresh, korunan ADMIN, atomik özel veri/giriş temizliği, tercih ve yıldız toplamları, bağlı fotoğraf/link/yorum, disk retry, outbox rollback/işçi teslimi, socket/host iptali, yerel dosyalar, yeni hesap ayrımı, DB CHECK/OpenAPI, geç işleme ve çift silme. Testler kendi benzersiz hesaplarını/dosyalarını temizler; gerçek kullanıcı silinmez.

## Sırada kalanlar

Genel saklama süreleri ve süresi dolmuş oturum/action/idempotency/bildirim/outbox işlerini düzenli temizleme; yedeklerin saklama/silme davranışı; yönetim gerekçeleri için redaksiyon; gerekirse kullanıcı verisi dışa aktarımı; askıdaki hesabın silme başvurusu. Özel lobiden tek oyuncu çıkarma ve ticari modüllerin yönetimi ayrıca açıktır. Bunlar bu hesabı kapatma/yerel temizlik tesliminden ayrı takip edilir.
