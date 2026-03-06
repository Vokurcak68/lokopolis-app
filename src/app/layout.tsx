import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AuthProvider from "@/components/Auth/AuthProvider";

export const metadata: Metadata = {
  title: "Lokopolis — Svět modelové železnice",
  description:
    "Lokopolis je komunita nadšenců do modelové železnice. Články, návody, recenze, galerie a vše pro vaše kolejiště.",
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
      <body className="antialiased flex flex-col min-h-screen">
        <AuthProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
