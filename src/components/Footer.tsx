import Link from "next/link";
import BadgeLogo from "./BadgeLogo";

export default function Footer() {
  return (
    <footer style={{ marginTop: "64px", background: "#161822", borderTop: "1px solid #252838", padding: "48px 0 24px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px" }}>
        {/* Footer grid */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          style={{ gap: "32px", marginBottom: "32px" }}
        >
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div style={{ marginBottom: "12px" }}>
              <Link href="/" style={{ textDecoration: "none" }}>
                <BadgeLogo size="sm" />
              </Link>
            </div>
            <p style={{ fontSize: "13px", color: "#6a6e80", maxWidth: "280px" }}>
              Česká komunita modelové železnice. Články, návody, recenze, galerie a vše pro vaše kolejiště.
            </p>
          </div>

          {/* Obsah */}
          <div>
            <h4
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#fff",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "16px",
              }}
            >
              Obsah
            </h4>
            <Link href="/clanky" style={{ display: "block", fontSize: "13px", color: "#6a6e80", padding: "4px 0", textDecoration: "none" }}>
              Články
            </Link>
            <Link href="/galerie" style={{ display: "block", fontSize: "13px", color: "#6a6e80", padding: "4px 0", textDecoration: "none" }}>
              Galerie
            </Link>
            <Link href="/ke-stazeni" style={{ display: "block", fontSize: "13px", color: "#6a6e80", padding: "4px 0", textDecoration: "none" }}>
              Ke stažení
            </Link>
            <Link href="/akce" style={{ display: "block", fontSize: "13px", color: "#6a6e80", padding: "4px 0", textDecoration: "none" }}>
              Akce
            </Link>
          </div>

          {/* Komunita */}
          <div>
            <h4
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#fff",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "16px",
              }}
            >
              Komunita
            </h4>
            <Link href="/forum" style={{ display: "block", fontSize: "13px", color: "#6a6e80", padding: "4px 0", textDecoration: "none" }}>
              Fórum
            </Link>
            <Link href="/komunita" style={{ display: "block", fontSize: "13px", color: "#6a6e80", padding: "4px 0", textDecoration: "none" }}>
              Členové
            </Link>
            <Link href="/pravidla" style={{ display: "block", fontSize: "13px", color: "#6a6e80", padding: "4px 0", textDecoration: "none" }}>
              Pravidla
            </Link>
            <Link href="/forum/nove-vlakno" style={{ display: "block", fontSize: "13px", color: "#6a6e80", padding: "4px 0", textDecoration: "none" }}>
              Nový příspěvek
            </Link>
          </div>

          {/* Info */}
          <div>
            <h4
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#fff",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "16px",
              }}
            >
              Info
            </h4>
            <Link href="/o-projektu" style={{ display: "block", fontSize: "13px", color: "#6a6e80", padding: "4px 0", textDecoration: "none" }}>
              O projektu
            </Link>
            <Link href="/kontakt" style={{ display: "block", fontSize: "13px", color: "#6a6e80", padding: "4px 0", textDecoration: "none" }}>
              Kontakt
            </Link>
            <Link href="/podporte-nas" style={{ display: "block", fontSize: "13px", color: "#6a6e80", padding: "4px 0", textDecoration: "none" }}>
              Podpořte nás
            </Link>
          </div>
        </div>

        {/* Copyright */}
        <div
          style={{
            borderTop: "1px solid #252838",
            paddingTop: "24px",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
            fontSize: "12px",
            color: "#555a70",
          }}
        >
          <span>© 2026 Lokopolis.cz — Svět modelové železnice</span>
          <span>Vytvořeno s ❤️ pro modeláře</span>
        </div>
      </div>
    </footer>
  );
}
