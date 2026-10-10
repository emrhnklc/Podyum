import Link from "next/link";
import { ME } from "@/lib/demo";
import styles from "./Nav.module.css";

export type NavKey = "kesfet" | "trendler" | "paylas" | "bildirimler" | "profil";

// Alt menü. Hangi sekmenin açık olduğu sayfadan `active` ile gelir.
// Not: Modlar (Canlı Podyum, haftalık tema) Faz 2'ye ertelendiği için
// menüde yok; yerini Trendler aldı.
export default function Nav({ active }: { active: NavKey }) {
  const item = (key: NavKey) => (active === key ? styles.active : styles.item);
  return (
    <nav className={styles.nav} aria-label="Ana menü">
      <Link href="/" className={item("kesfet")} aria-current={active === "kesfet" ? "page" : undefined}>
        <CardsIcon />
        Keşfet
      </Link>
      <Link
        href="/trendler"
        className={item("trendler")}
        aria-current={active === "trendler" ? "page" : undefined}
      >
        <TrendIcon />
        Trendler
      </Link>
      <Link href="/paylas" className={styles.share} aria-label="Paylaş">
        <PlusIcon />
      </Link>
      <Link
        href="/bildirimler"
        className={item("bildirimler")}
        aria-label="Bildirimler, 2 yeni"
        aria-current={active === "bildirimler" ? "page" : undefined}
      >
        <BellIcon />
        Bildirim
        <span className={styles.badge}>2</span>
      </Link>
      <Link
        href={`/u/${ME}`}
        className={item("profil")}
        aria-current={active === "profil" ? "page" : undefined}
      >
        <UserIcon />
        Profil
      </Link>
    </nav>
  );
}

const stroke = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function CardsIcon() {
  return (
    <svg {...stroke}>
      <rect x="7" y="3" width="12" height="16" rx="2" />
      <path d="M4 7v12a2 2 0 0 0 2 2h10" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg {...stroke}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg {...stroke} width={22} height={22} strokeWidth={2.4}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg {...stroke}>
      <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg {...stroke}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
