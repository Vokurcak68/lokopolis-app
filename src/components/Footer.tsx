import Link from "next/link";
import BadgeLogo from "./BadgeLogo";

const footerLinks = [
  { label: "Články", href: "/clanky" },
  { label: "Galerie", href: "/galerie" },
  { label: "Ke stažení", href: "/ke-stazeni" },
  { label: "Komunita", href: "/komunita" },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border-subtle bg-bg-dark">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col items-center gap-8">
          {/* Logo */}
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <BadgeLogo size="sm" />
          </Link>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-text-muted hover:text-primary transition-colors text-sm tracking-wide uppercase"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Copyright */}
          <p className="text-text-muted text-sm text-center">
            © {currentYear} Lokopolis. Všechna práva vyhrazena.
          </p>
        </div>
      </div>
    </footer>
  );
}
