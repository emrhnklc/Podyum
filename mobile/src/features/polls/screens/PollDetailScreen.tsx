import { StyleSheet, View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { colors, common, fonts } from "@/theme";
import { ME } from "@/constants/demo";
import { posts } from "../data/demo-polls";
import {
  demoDemographics,
  type DemoBreakdownRow,
} from "../data/demo-demographics";
import { demoResults, useDemoPolls } from "../hooks/use-demo-polls";
import { PollCard } from "../components/PollCard";

export function PollDetailScreen({ id }: { id: string }) {
  const { votes } = useDemoPolls();
  const post = posts.find((item) => item.id === id);
  if (!post)
    return (
      <Screen>
        <BackButton />
        <EmptyState
          title="Oylama bulunamadı"
          message="Bu önizlemede böyle bir paylaşım yok."
        />
      </Screen>
    );
  const picked = votes[post.id];
  const revealed =
    !!picked || post.user === ME || post.timeLeft === "bitti";
  const results = demoResults(post, picked);
  const demographics = demoDemographics(post, results.total);
  return (
    <Screen>
      <View style={[common.row, { gap: 0 }]}>
        <BackButton />
        <Text style={styles.heading}>
          {revealed ? "Sonuç detayları" : "Kombin detayları"}
        </Text>
      </View>
      <PollCard post={post} />
      {revealed ? (
        <>
          <View style={common.card}>
            <View style={common.spread}>
              <Text style={styles.sectionTitle}>Kaç oy kullanıldı?</Text>
              <Text style={styles.total}>{results.total} oy</Text>
            </View>
            {results.options.map((option) => (
              <Bar
                key={option.label}
                label={`${option.label} seçeneği`}
                count={option.votes}
                percent={option.percent}
                highlight={picked === option.label}
              />
            ))}
          </View>
          <Breakdown title="Kimler oy verdi?" rows={demographics.gender} />
          <Breakdown title="Yaş aralığı" rows={demographics.age} />
          <Text style={styles.note}>
            Demo verisi. Dağılımlar örnektir; gerçek uygulamada yalnızca izin
            veren kullanıcıların toplu verisi gösterilir ve küçük gruplar
            gizlenir.
          </Text>
        </>
      ) : (
        <Text style={[common.subtitle, { textAlign: "center" }]}>
          Oy verince kaç kişinin katıldığını, cinsiyet ve yaş dağılımını burada
          görürsün.
        </Text>
      )}
    </Screen>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: DemoBreakdownRow[];
}) {
  return (
    <View style={common.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.map((row) => (
        <Bar
          key={row.label}
          label={row.label}
          count={row.count}
          percent={row.percent}
        />
      ))}
    </View>
  );
}

function Bar({
  label,
  count,
  percent,
  highlight = false,
}: {
  label: string;
  count: number;
  percent: number;
  highlight?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${count} oy, yüzde ${percent}`}
      style={{ gap: 6 }}
    >
      <View style={common.spread}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
          {label}
          {highlight ? " · senin seçimin" : ""}
        </Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13 }}>{count}</Text>{" "}
          oy · %{percent}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${percent}%`,
              backgroundColor: highlight ? colors.accent : colors.text,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.bold, fontSize: 18 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 17 },
  total: { fontFamily: fonts.extraBold, fontSize: 17, color: colors.accent },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.line,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 4 },
  note: { fontSize: 12, lineHeight: 17, color: colors.muted },
});
