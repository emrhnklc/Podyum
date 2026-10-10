"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CATEGORY_LABEL, ME, feed, getUser, me, type DemoOption } from "@/lib/demo";
import Nav from "./Nav";
import styles from "./Kesfet.module.css";

type Label = DemoOption["label"];

const SELECT_LABEL: Record<Label, string> = {
  A: "Seçenek A'yı seç",
  B: "Seçenek B'yi seç",
};

export default function Kesfet() {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Label | null>(null);
  const [dayStars, setDayStars] = useState(me.predictionStarsToday);

  const post = feed[index % feed.length];
  const [a, b] = post.options;
  const winner: Label = a.percent >= b.percent ? "A" : "B";
  const revealed = picked !== null;
  const won = picked === winner;
  const author = getUser(post.user);
  const initials = author?.initials ?? post.user.slice(0, 2).toUpperCase();
  const starsTotal = (getUser(ME)?.counts.stars ?? 0) + dayStars - me.predictionStarsToday;

  function pick(label: Label) {
    if (revealed) return;
    setPicked(label);
    if (label === winner) setDayStars((s) => Math.min(100, s + 10));
  }

  function next() {
    setIndex((i) => (i + 1) % feed.length);
    setPicked(null);
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.logo}>Podyum</div>
        <div className={styles.headerChips}>
          <div className={styles.headerChip} aria-label={`${me.streakDays} günlük seri`}>
            <FlameIcon />
            {me.streakDays} gün
          </div>
          <div className={styles.headerChip}>
            <span className={styles.accent}>★</span>
            {starsTotal.toLocaleString("tr-TR")}
          </div>
        </div>
      </header>

      <div className={styles.daily}>
        <span className={styles.dailyLabel}>Bugünkü tahmin yıldızı</span>
        <div className={styles.track}>
          <div className={styles.trackFill} style={{ width: `${dayStars}%` }} />
        </div>
        <span className={styles.dailyValue}>{dayStars}/100 ★</span>
      </div>

      <div className={styles.filters}>
        <div className={styles.segment}>
          <button type="button" className={styles.segmentActive}>
            Herkes
          </button>
          <button type="button" className={styles.segmentItem}>
            Arkadaşlar
          </button>
        </div>
        <button type="button" className={styles.categoryButton}>
          Tüm kategoriler
          <ChevronDownIcon />
        </button>
      </div>

      <button type="button" className={styles.myPoll}>
        <span className={styles.liveDot} />
        <span className={styles.myPollText}>
          <strong>Senin oylaman</strong> · {me.activePoll.timeLeft} kaldı
        </span>
        <span className={styles.myPollVotes}>{me.activePoll.votes} oy</span>
        <ChevronRightIcon />
      </button>

      <div className={styles.stack}>
        <div className={styles.peek} aria-hidden="true" />
        <main className={styles.card} key={post.id}>
          <div className={styles.author}>
            <Link href={`/u/${post.user}`} className={styles.authorLink}>
              <div className={styles.avatar}>
                {author?.avatar ? (
                  <Image src={author.avatar} alt="" fill sizes="40px" className={styles.avatarImage} />
                ) : (
                  initials
                )}
              </div>
              <div className={styles.authorText}>
                <div className={styles.username}>{post.user}</div>
                <div className={styles.meta}>
                  {post.context} ·{" "}
                  <span className={post.urgent ? styles.timeUrgent : styles.time}>
                    {post.timeLeft} kaldı
                  </span>
                </div>
              </div>
            </Link>
            <div className={styles.categoryChip}>{CATEGORY_LABEL[post.category]}</div>
          </div>

          <h1 className={styles.question}>{post.question}</h1>

          <div className={styles.options}>
            {post.options.map((option) => {
              const isWinner = option.label === winner;
              return (
                <button
                  key={option.label}
                  type="button"
                  className={styles.option}
                  style={{ background: option.tone }}
                  onClick={() => pick(option.label)}
                  aria-label={
                    revealed
                      ? `Seçenek ${option.label}, yüzde ${option.percent}`
                      : SELECT_LABEL[option.label]
                  }
                >
                  {option.video ? (
                    <video
                      className={styles.video}
                      src={option.video}
                      poster={option.image}
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                  ) : option.image ? (
                    <Image
                      src={option.image}
                      alt=""
                      fill
                      sizes="(max-width: 480px) 50vw, 240px"
                      className={styles.photo}
                    />
                  ) : (
                    <>
                      <ShirtIcon />
                      <span className={styles.photoLabel}>{post.photoLabel}</span>
                    </>
                  )}
                  {revealed ? (
                    <>
                      <span
                        className={isWinner ? styles.barWinner : styles.barLoser}
                        style={{ height: `${option.percent}%` }}
                      />
                      <span className={isWinner ? styles.percentWinner : styles.percentLoser}>
                        %{option.percent}
                      </span>
                    </>
                  ) : (
                    <span className={styles.productPill}>{option.productCount} ürün</span>
                  )}
                  {picked === option.label && <span className={styles.minePill}>Senin seçimin</span>}
                  <span className={styles.badge}>{option.label}</span>
                </button>
              );
            })}
          </div>

          {revealed ? (
            <div className={styles.result}>
              {won ? (
                <div className={styles.winBanner}>
                  <CheckIcon />
                  <div className={styles.bannerText}>Çoğunluğu bildin</div>
                  <div className={styles.bannerStars}>+10 ★</div>
                </div>
              ) : (
                <div className={styles.loseBanner}>
                  <div className={styles.bannerText}>Bu sefer azınlıktasın</div>
                  <div className={styles.bannerHint}>Sıradakinde yakala</div>
                </div>
              )}
              <div className={styles.insightRow}>
                <span className={styles.insight}>{post.insight}</span>
                <button type="button" className={styles.detailsLink}>
                  Detaylar
                </button>
              </div>
              <button type="button" className={styles.cta} onClick={next}>
                Sıradaki oylama
                <ArrowRightIcon size={20} strokeWidth={2.4} />
              </button>
            </div>
          ) : (
            <div className={styles.voting}>
              <div className={styles.hint}>
                Dokun ve seç. Çoğunluğu bilirsen <span className={styles.hintStars}>+10 ★</span>
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.action} onClick={next}>
                  <ArrowRightIcon size={18} strokeWidth={1.8} />
                  Geç
                </button>
                <button type="button" className={styles.action}>
                  <BookmarkIcon />
                  Kaydet
                </button>
                <button type="button" className={styles.action} aria-label={`${post.commentCount} yorum`}>
                  <CommentIcon />
                  {post.commentCount}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      <Nav active="kesfet" />
    </div>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function FlameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--blue)" aria-hidden="true">
      <path d="M12 2c.6 3.4 4.5 5.2 4.5 10a4.5 4.5 0 0 1-9 0c0-1.7.7-3 1.6-4 .3 1.3 1 2 1.7 2.2C10.6 7.6 11.4 5 12 2z" />
    </svg>
  );
}

function ShirtIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" strokeWidth="1.4" {...stroke}>
      <path d="M9 3l3 2 3-2 5 3-2 4-3-1.5V21H9V8.5L6 10 4 6z" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="2.2" {...stroke}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2" {...stroke}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ArrowRightIcon({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={strokeWidth} {...stroke}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="2.4" {...stroke}>
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="1.8" {...stroke}>
      <path d="M4 5h16v11H9l-5 4z" />
    </svg>
  );
}

