import Image from "next/image";
import Link from "next/link";
import { ME, postsOf, type DemoPost, type DemoUser } from "@/lib/demo";
import Nav from "./Nav";
import shell from "./shell.module.css";
import styles from "./Profil.module.css";

export default function Profil({ user }: { user: DemoUser }) {
  const isMe = user.username === ME;
  const userPosts = postsOf(user.username);

  return (
    <div className={shell.screen}>
      <div className={shell.scroll}>
        <header className={styles.topBar}>
          {!isMe && (
            <Link href="/" className={styles.back} aria-label="Keşfet'e dön">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </Link>
          )}
          <div className={styles.username}>{user.username}</div>
        </header>

        <div className={styles.summary}>
          <div className={isMe ? styles.avatarMe : styles.avatar}>
            {user.avatar ? (
              <Image src={user.avatar} alt="" fill sizes="84px" className={styles.avatarImage} />
            ) : (
              user.initials
            )}
          </div>
          <dl className={styles.counts}>
            <Count label="Paylaşım" value={user.counts.polls} />
            <Count label="Arkadaş" value={user.counts.friends} />
            <Count label="Yıldız" value={user.counts.stars} accent />
          </dl>
        </div>

        <div className={styles.about}>
          <div className={styles.displayName}>{user.displayName}</div>
          {user.bio && <p className={styles.bio}>{user.bio}</p>}
          {user.styles.length > 0 && (
            <ul className={styles.styleTags}>
              {user.styles.map((style) => (
                <li key={style} className={styles.styleTag}>
                  {style}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.actions}>
          {isMe ? (
            <>
              <button type="button" className={styles.secondary}>
                Profili düzenle
              </button>
              <button type="button" className={styles.dark}>
                Arkadaş davet et
              </button>
            </>
          ) : (
            <>
              <button type="button" className={styles.primary}>
                Arkadaş ekle
              </button>
              <button type="button" className={styles.more} aria-label="Engelle ya da şikâyet et">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
            </>
          )}
        </div>

        <div className={styles.tabs}>
          <button type="button" className={styles.tabActive} aria-pressed="true">
            Paylaşımlar
          </button>
          {isMe && (
            <button type="button" className={styles.tab} aria-pressed="false">
              Kaydedilenler
            </button>
          )}
        </div>

        {userPosts.length === 0 ? (
          <div className={shell.empty}>
            <div className={shell.emptyTitle}>Henüz paylaşım yok</div>
            <div className={shell.emptyText}>
              {isMe ? "İlk oylamanı başlat, sonuçlar burada birikir." : "Paylaşım yaptığında burada görünür."}
            </div>
          </div>
        ) : (
          <ul className={styles.grid}>
            {userPosts.map((post) => (
              <li key={post.id}>
                <PostTile post={post} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <Nav active={isMe ? "profil" : "kesfet"} />
    </div>
  );
}

function Count({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={styles.count}>
      <dd className={accent ? styles.countValueAccent : styles.countValue}>
        {value.toLocaleString("tr-TR")}
      </dd>
      <dt className={styles.countLabel}>{label}</dt>
    </div>
  );
}

// Karede kazanan (şu an önde olan) seçeneğin medyası ve yüzdesi görünür.
function PostTile({ post }: { post: DemoPost }) {
  const [a, b] = post.options;
  const leading = a.percent >= b.percent ? a : b;
  const hasMedia = Boolean(leading.video || leading.image);
  return (
    <div className={styles.tile} style={{ background: leading.tone }}>
      {leading.video ? (
        <video
          className={styles.tileVideo}
          src={leading.video}
          poster={leading.image}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        leading.image && (
          <Image src={leading.image} alt="" fill sizes="33vw" className={styles.cover} />
        )
      )}
      {!hasMedia && <span className={styles.tileQuestion}>{post.question}</span>}
      <span className={styles.tileBadge}>
        {leading.label} %{leading.percent}
      </span>
    </div>
  );
}
