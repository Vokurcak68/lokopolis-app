import BadgeLogo from "@/components/BadgeLogo";
import Link from "next/link";

const categories = [
  {
    title: "Stavba kolejiště",
    description: "Plánování, podklady, kolejivo a konstrukce kolejišť",
    icon: "🛤️",
    href: "/kategorie/stavba-kolejiste",
  },
  {
    title: "Modelové domy",
    description: "Stavebnice, kitbashing a scratch-building budov",
    icon: "🏠",
    href: "/kategorie/modelove-domy",
  },
  {
    title: "Krajina a zeleň",
    description: "Terén, stromy, tráva, vodní plochy a sezónní efekty",
    icon: "🌿",
    href: "/kategorie/krajina-a-zelen",
  },
  {
    title: "Elektronika",
    description: "Obvody, napájení, spínání a automatizace",
    icon: "⚡",
    href: "/kategorie/elektronika",
  },
  {
    title: "Digitální řízení",
    description: "DCC, dekodéry, centrály a počítačové řízení",
    icon: "🖥️",
    href: "/kategorie/digitalni-rizeni",
  },
  {
    title: "Recenze",
    description: "Hodnocení modelů, příslušenství a nástrojů",
    icon: "⭐",
    href: "/kategorie/recenze",
  },
  {
    title: "Kolejové plány",
    description: "Návrhy tratí, inspirace a plánování layoutů",
    icon: "📐",
    href: "/kategorie/kolejove-plany",
  },
  {
    title: "Nátěry a patina",
    description: "Stříkání, weathering, patinování a detailing",
    icon: "🎨",
    href: "/kategorie/natery-a-patina",
  },
  {
    title: "Osvětlení",
    description: "LED, optická vlákna, denní a noční scény",
    icon: "💡",
    href: "/kategorie/osvetleni",
  },
  {
    title: "3D tisk",
    description: "Modelování, tisk a postprocessing pro železnici",
    icon: "🖨️",
    href: "/kategorie/3d-tisk",
  },
  {
    title: "Tipy a triky",
    description: "Praktické rady, postupy a life-hacky",
    icon: "💡",
    href: "/kategorie/tipy-a-triky",
  },
  {
    title: "Ze světa",
    description: "Novinky, výstavy, události a zahraniční scéna",
    icon: "🌍",
    href: "/kategorie/ze-sveta",
  },
];

const stats = [
  { label: "Kategorií", value: "12" },
  { label: "Článků", value: "0" },
  { label: "Členů", value: "0" },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center py-20 md:py-32 px-4">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-bg-dark via-bg-dark to-bg-card/30 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-8 text-center max-w-3xl">
          {/* Large Badge Logo */}
          <BadgeLogo size="lg" />

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-text-muted max-w-xl leading-relaxed">
            Komunita nadšenců do modelové železnice. Sdílejte své projekty,
            učte se od ostatních a tvořte společně.
          </p>

          {/* Stats */}
          <div className="flex gap-8 md:gap-12 mt-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center">
                <span className="text-2xl md:text-3xl font-bold text-primary">
                  {stat.value}
                </span>
                <span className="text-sm text-text-muted uppercase tracking-wider">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 px-4">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
            <span className="text-white">Prozkoumejte </span>
            <span className="text-primary">kategorie</span>
          </h2>
          <p className="text-text-muted text-center mb-12 max-w-lg mx-auto">
            Vyberte si téma, které vás zajímá, a ponořte se do světa
            modelové železnice.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="group flex flex-col gap-3 p-5 rounded-xl bg-bg-card border border-border-subtle hover:border-primary/50 hover:bg-bg-card-hover transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{cat.icon}</span>
                  <h3 className="font-semibold text-white group-hover:text-primary transition-colors">
                    {cat.title}
                  </h3>
                </div>
                <p className="text-sm text-text-muted leading-relaxed">
                  {cat.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
