// 2400 → "2,4K"; Türkçe ondalık virgül.
export function compactCount(count: number) {
  if (count < 1000) return `${count}`;
  return `${(count / 1000).toFixed(1).replace(".", ",").replace(",0", "")}K`;
}
