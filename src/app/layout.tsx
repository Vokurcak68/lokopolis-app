import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lokopolis — Modelová železnice",
  description:
    "Lokopolis je komunita nadšenců do modelové železnice. Stavba kolejišť, modelové domy, krajina, elektronika, digitální řízení a mnoho dalšího.",
  keywords: [
    "modelová železnice",
    "kolejiště",
    "modelářství",
    "H0",
    "TT",
    "N",
    "lokomotiva",
    "vlaky",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
