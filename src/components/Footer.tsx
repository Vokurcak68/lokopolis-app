import Link from "next/link";
import BadgeLogo from "./BadgeLogo";

export default function Footer() {
  return (
    <footer style={{ marginTop: "64px", background: "var(--bg-header)", borderTop: "1px solid var(--border)", padding: "48px 0 24px" }}>
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
            <p style={{ fontSize: "13px", color: "var(--text-dimmer)", maxWidth: "280px" }}>
              Česká komunita modelové železnice. Články, návody, recenze, galerie a vše pro vaše kolejiště.
            </p>
            {/* Social */}
            <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
              <a
                href="https://instagram.com/lokopolis"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-link"
                title="Instagram"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Obsah */}
          <div>
            <h4
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--text-primary)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "16px",
              }}
            >
              Obsah
            </h4>
            <Link href="/clanky" style={{ display: "block", fontSize: "13px", color: "var(--text-dimmer)", padding: "4px 0", textDecoration: "none" }}>
              Články
            </Link>
            <Link href="/galerie" style={{ display: "block", fontSize: "13px", color: "var(--text-dimmer)", padding: "4px 0", textDecoration: "none" }}>
              Galerie
            </Link>
            <Link href="/ke-stazeni" style={{ display: "block", fontSize: "13px", color: "var(--text-dimmer)", padding: "4px 0", textDecoration: "none" }}>
              Ke stažení
            </Link>
            <Link href="/akce" style={{ display: "block", fontSize: "13px", color: "var(--text-dimmer)", padding: "4px 0", textDecoration: "none" }}>
              Akce
            </Link>
          </div>

          {/* Komunita */}
          <div>
            <h4
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--text-primary)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "16px",
              }}
            >
              Komunita
            </h4>
            <Link href="/forum" style={{ display: "block", fontSize: "13px", color: "var(--text-dimmer)", padding: "4px 0", textDecoration: "none" }}>
              Fórum
            </Link>
            <Link href="/komunita" style={{ display: "block", fontSize: "13px", color: "var(--text-dimmer)", padding: "4px 0", textDecoration: "none" }}>
              Členové
            </Link>
            <Link href="/pravidla" style={{ display: "block", fontSize: "13px", color: "var(--text-dimmer)", padding: "4px 0", textDecoration: "none" }}>
              Pravidla
            </Link>
            <Link href="/forum/nove-vlakno" style={{ display: "block", fontSize: "13px", color: "var(--text-dimmer)", padding: "4px 0", textDecoration: "none" }}>
              Nový příspěvek
            </Link>
          </div>

          {/* Info */}
          <div>
            <h4
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--text-primary)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "16px",
              }}
            >
              Info
            </h4>
            <Link href="/o-projektu" style={{ display: "block", fontSize: "13px", color: "var(--text-dimmer)", padding: "4px 0", textDecoration: "none" }}>
              O projektu
            </Link>
            <Link href="/kontakt" style={{ display: "block", fontSize: "13px", color: "var(--text-dimmer)", padding: "4px 0", textDecoration: "none" }}>
              Kontakt
            </Link>
            <Link href="/podporte-nas" style={{ display: "block", fontSize: "13px", color: "var(--text-dimmer)", padding: "4px 0", textDecoration: "none" }}>
              Podpořte nás
            </Link>
            <Link href="/obchodni-podminky" style={{ display: "block", fontSize: "13px", color: "var(--text-dimmer)", padding: "4px 0", textDecoration: "none" }}>
              Obchodní podmínky
            </Link>
            <Link href="/ochrana-udaju" style={{ display: "block", fontSize: "13px", color: "var(--text-dimmer)", padding: "4px 0", textDecoration: "none" }}>
              Ochrana osobních údajů
            </Link>
          </div>
        </div>

        {/* Copyright */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: "24px",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
            fontSize: "12px",
            color: "var(--text-faint)",
          }}
        >
          <span>© 2026 Lokopolis.cz — Svět modelové železnice</span>
          <span>Vytvořeno s ❤️ pro modeláře</span>
        </div>
      </div>
    </footer>
  );
}
