"use client";

import Image from "next/image";
import { useState } from "react";
import {
  CATEGORY_LABEL,
  TREND_MIN_PICKS,
  trendProducts,
  type PollCategory,
  type PriceBand,
  type TrendPeriod,
  type TrendVoter,
} from "@/lib/demo";
import Nav from "./Nav";
import shell from "./shell.module.css";
import styles from "./Trendler.module.css";

type CategoryFilter = "ALL" | PollCategory;

const PERIODS: { value: TrendPeriod; label: string }[] = [
  { value: "WEEK", label: "Bu hafta" },
  { value: "MONTH", label: "Bu ay" },
];

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: "ALL", label: "Tümü" },
  ...(Object.keys(CATEGORY_LABEL) as PollCategory[]).map((value) => ({
    value,
    label: CATEGORY_LABEL[value],
  })),
];

const VOTERS: { value: TrendVoter; label: string }[] = [
  { value: "ANY", label: "Herkes" },
  { value: "WOMEN", label: "Kadınlar" },
  { value: "MEN", label: "Erkekler" },
];

const PRICES: { value: PriceBand; label: string }[] = [
  { value: "ALL", label: "Tüm fiyatlar" },
  { value: "UNDER_750", label: "750 TL altı" },
  { value: "FROM_750_TO_2000", label: "750–2.000 TL" },
  { value: "OVER_2000", label: "2.000 TL üstü" },
];

function inPriceBand(priceMinor: number, band: PriceBand) {
  const price = priceMinor / 100;
  if (band === "UNDER_750") return price < 750;
  if (band === "FROM_750_TO_2000") return price >= 750 && price <= 2000;
  if (band === "OVER_2000") return price > 2000;
  return true;
}

function formatPrice(priceMinor: number) {
  return `${(priceMinor / 100).toLocaleString("tr-TR")} TL`;
}

export default function Trendler() {
  const [period, setPeriod] = useState<TrendPeriod>("WEEK");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [voter, setVoter] = useState<TrendVoter>("ANY");
  const [price, setPrice] = useState<PriceBand>("ALL");

  // Sıra değişimi genel listeye aittir; filtre varken göstermek yanıltır.
  const isGeneralList = category === "ALL" && voter === "ANY" && price === "ALL";

  const rows = trendProducts
    .filter((p) => category === "ALL" || p.category === category)
    .filter((p) => inPriceBand(p.priceMinor, price))
    .map((p) => ({ product: p, picks: p.picks[period][voter] }))
    .filter((row) => row.picks >= TREND_MIN_PICKS)
    .sort((a, b) => b.picks - a.picks);

  return (
    <div className={shell.screen}>
      <div className={shell.scroll}>
        <header className={styles.header}>
          <h1 className={shell.title}>Trendler</h1>
          <p className={styles.subtitle}>Seçilen kombinlerde en çok yer alan ürünler</p>
        </header>

        <div className={styles.segment} role="group" aria-label="Dönem">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={period === p.value ? styles.segmentActive : styles.segmentItem}
              aria-pressed={period === p.value}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <ChipRow label="Kategori" options={CATEGORIES} value={category} onChange={setCategory} />
        <ChipRow label="Tercih yapanlar" options={VOTERS} value={voter} onChange={setVoter} />
        <ChipRow label="Fiyat" options={PRICES} value={price} onChange={setPrice} />

        {rows.length === 0 ? (
          <div className={shell.empty}>
            <div className={shell.emptyTitle}>Bu filtrede yeterli veri yok</div>
            <div className={shell.emptyText}>
              Küçük gruplar gösterilmez. Filtreyi genişletip tekrar dene.
            </div>
          </div>
        ) : (
          <ol className={styles.list}>
            {rows.map(({ product, picks }, index) => (
              <li key={product.id} className={index === 0 ? styles.rowFirst : styles.row}>
                <span className={styles.rank}>{index + 1}</span>
                <span
                  className={index === 0 ? styles.thumbFirst : styles.thumb}
                  style={{ background: product.tone }}
                >
                  {product.image && (
                    <Image src={product.image} alt="" fill sizes="96px" className={styles.thumbImage} />
                  )}
                </span>
                <span className={styles.text}>
                  <span className={styles.productTitle}>{product.title}</span>
                  <span className={styles.productMeta}>
                    {product.brand} · {formatPrice(product.priceMinor)}
                  </span>
                  <span className={styles.picks}>
                    <strong>{picks.toLocaleString("tr-TR")}</strong> seçilen kombinde
                  </span>
                </span>
                {isGeneralList && <RankChange change={product.rankChange[period]} />}
              </li>
            ))}
          </ol>
        )}

        <p className={styles.note}>
          Demo verisi. Sayılar ürünün seçilen kombinlerde kaç kez yer aldığını gösterir; ürün oyu ya
          da satış sayısı değildir.
        </p>
      </div>
      <Nav active="trendler" />
    </div>
  );
}

function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.filter}>
      <div className={styles.filterLabel}>{label}</div>
      <div className={styles.chips} role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? styles.chipActive : styles.chip}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RankChange({ change }: { change: number | "NEW" }) {
  if (change === "NEW") return <span className={styles.changeNew}>Yeni</span>;
  if (change === 0) {
    return (
      <span className={styles.changeSame} aria-label="Sırası değişmedi">
        –
      </span>
    );
  }
  const up = change > 0;
  return (
    <span
      className={up ? styles.changeUp : styles.changeDown}
      aria-label={up ? `${change} sıra yükseldi` : `${-change} sıra düştü`}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        {up ? <path d="M6 2l5 8H1z" /> : <path d="M6 10L1 2h10z" />}
      </svg>
      {Math.abs(change)}
    </span>
  );
}
