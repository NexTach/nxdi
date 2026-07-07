import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "T-ETF",
  description: "T-ETF 포트폴리오와 투자 의향서 서비스"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
