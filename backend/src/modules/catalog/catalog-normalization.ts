import { isIP } from "node:net";
import { ApiError } from "../../common/errors/api-error.js";
export const normalizedName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
export function catalogDomain(value: string) {
  let url;
  try {
    url = new URL(`https://${value}`);
  } catch {
    throw new ApiError(
      422,
      "INVALID_STORE_DOMAIN",
      "Geçerli mağaza alan adı gerekli.",
    );
  }
  const domain = url.hostname.toLowerCase().replace(/^www\./, "");
  if (
    !domain
      .split(".")
      .every((part) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)) ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    isIP(domain) ||
    !/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(domain) ||
    !/\.[a-z][a-z0-9-]{1,62}$/.test(domain) ||
    /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(domain)
  )
    throw new ApiError(
      422,
      "INVALID_STORE_DOMAIN",
      "Genel bir mağaza alan adı gerekli; port, yol ve dahili adres kullanma.",
    );
  return domain;
}
export function normalizeCatalogUrl(
  value: string,
  trackingParameters: string[] = [],
) {
  const originalUrl = value.trim();
  let url;
  try {
    url = new URL(originalUrl);
  } catch {
    throw new ApiError(
      422,
      "INVALID_PRODUCT_URL",
      "Geçerli http/https ürün bağlantısı gerekli.",
    );
  }
  if (
    originalUrl.length > 2048 ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new ApiError(
      422,
      "INVALID_PRODUCT_URL",
      "Ürün bağlantısı kimlik veya özel port içeremez.",
    );
  const domain = catalogDomain(url.hostname);
  url.hostname = domain;
  const tracking = new Set(
    ["fbclid", "gclid", "dclid", "msclkid", ...trackingParameters].map((key) =>
      key.toLowerCase(),
    ),
  );
  for (const key of [...url.searchParams.keys()])
    if (/^utm_/i.test(key) || tracking.has(key.toLowerCase()))
      url.searchParams.delete(key);
  url.searchParams.sort();
  const normalizedUrl = url.toString();
  if (normalizedUrl.length > 2048)
    throw new ApiError(422, "INVALID_PRODUCT_URL", "Ürün bağlantısı çok uzun.");
  return { domain, originalUrl, normalizedUrl };
}
