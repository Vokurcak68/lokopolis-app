import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AuthProvider from "@/components/Auth/AuthProvider";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://lokopolis-app.vercel.app"),
  title: {
    default: "Lokopolis — Svět modelové železnice",
    template: "%s | Lokopolis",
  },
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
  openGraph: {
    type: "website",
    locale: "cs_CZ",
    siteName: "Lokopolis",
    title: "Lokopolis — Svět modelové železnice",
    description:
      "Komunita nadšenců do modelové železnice. Články, návody, recenze, galerie.",
    url: "https://lokopolis-app.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('lokopolis-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="antialiased flex flex-col min-h-screen">
        <ThemeProvider>
          <AuthProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
