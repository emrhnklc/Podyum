import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Podyum",
  description: "Arada kaldığın kombini oylat.",
  appleWebApp: { capable: true, title: "Podyum", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={hanken.variable}>
      <body>{children}</body>
    </html>
  );
}
