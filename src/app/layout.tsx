import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Duet",
    template: "%s · Duet",
  },
  description: "两人共用的生活日志与同步台",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${manrope.variable} ${instrument.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans text-ink">{children}</body>
    </html>
  );
}
