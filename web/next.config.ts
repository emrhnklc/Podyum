import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Telefon aynı Wi-Fi'dan Mac'in adresiyle bağlanır; dev sunucusu
  // varsayılan olarak yalnızca localhost'a izin verir.
  allowedDevOrigins: [
    "*.local",
    "10.*.*.*",
    "192.168.*.*",
    "172.*.*.*",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
