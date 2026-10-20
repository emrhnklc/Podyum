export function catalogLink(url: string | null): string | null {
  try {
    const parsed = new URL(url ?? "");
    return ["https:", "http:"].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}
export function catalogPrice(priceMinor: number | null, currency: string) {
  return priceMinor === null
    ? "Fiyat belirtilmedi"
    : new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(
        priceMinor / 100,
      );
}
