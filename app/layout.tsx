import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LATAM · Email Marketing Performance",
  description: "Dashboard gerencial mensal de Email Marketing.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
