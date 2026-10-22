export type DemoBreakdownRow = { label: string; count: number; percent: number };
export type DemoDemographics = {
  gender: DemoBreakdownRow[];
  age: DemoBreakdownRow[];
};

// Mock: oy verenlerin toplu dağılımı. Paylar gönderi kimliğinden türetilir ki
// her açılışta aynı kalsın. Gerçek veri değildir; backend'in ilk sonuç
// sözleşmesinde demografik kırılım yoktur.
export function demoDemographics(post: { id: string }, total: number): DemoDemographics {
  const seed = [...post.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const women = 0.45 + (seed % 30) / 100;
  const unspecified = 0.03 + (seed % 5) / 100;
  const young = 0.4 + (seed % 21) / 100;
  const older = 0.08 + (seed % 9) / 100;
  return {
    gender: split(total, [
      ["Kadın", women],
      ["Erkek", 1 - women - unspecified],
      ["Belirtmeyen", unspecified],
    ]),
    age: split(total, [
      ["18–24 yaş", young],
      ["25–34 yaş", 1 - young - older],
      ["35 yaş ve üstü", older],
    ]),
  };
}

// Payları tam sayılara böler; en büyük kalan yöntemiyle toplam korunur.
function split(total: number, shares: [string, number][]): DemoBreakdownRow[] {
  const exact = shares.map(([, share]) => share * total);
  const counts = exact.map(Math.floor);
  let rest = total - counts.reduce((sum, count) => sum + count, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of order) {
    if (rest <= 0) break;
    counts[index]++;
    rest--;
  }
  return shares.map(([label], index) => ({
    label,
    count: counts[index],
    percent: total ? Math.round((counts[index] * 100) / total) : 0,
  }));
}
