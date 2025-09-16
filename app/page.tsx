"use client";

// app/page.tsx — AFI‑Dash landing page
// TailwindCSS + Framer Motion. Keeps particles + glass background.
// Minimal inline icons to avoid external deps.

import ParticlesBackground from "@/components/ParticlesBackground";
import { motion, useReducedMotion } from "framer-motion";
import React from "react";

// ----- Inline icons (simple, dependency-free) -----
const Icon = {
  Trend: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3 3v18h18"/>
      <path d="M7 15l4-4 3 3 6-6"/>
    </svg>
  ),
  MapPin: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 21s-6-4.35-6-9a6 6 0 1112 0c0 4.65-6 9-6 9z"/>
      <circle cx="12" cy="12" r="2.5"/>
    </svg>
  ),
  Layers: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 3l9 5-9 5-9-5 9-5z"/>
      <path d="M3 12l9 5 9-5"/>
      <path d="M3 17l9 5 9-5"/>
    </svg>
  ),
  Gauge: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M21 12a9 9 0 10-18 0 9 9 0 0018 0z"/>
      <path d="M12 12l5-2"/>
    </svg>
  ),
  Database: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <ellipse cx="12" cy="5" rx="8" ry="3"/>
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/>
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/>
    </svg>
  ),
  Book: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 4h10a4 4 0 014 4v12H8a4 4 0 01-4-4V4z"/>
      <path d="M8 4v16"/>
    </svg>
  ),
  Arrow: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 12h14"/>
      <path d="M13 5l7 7-7 7"/>
    </svg>
  )
};

export default function Home() {
  const prefersReducedMotion = useReducedMotion();

  const fadeUp = {
    initial: { opacity: 0, y: prefersReducedMotion ? 0 : 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: 0.6, ease: "easeOut" }
  } as const;

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      {/* Particles background retained for brand identity */}
      <ParticlesBackground />

      {/* Decorative radial spotlight + grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[60rem] w-[60rem] -translate-x-1/2 rounded-full bg-gradient-to-b from-cyan-400/20 via-blue-500/10 to-transparent blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* Glassy app frame */}
      <div className="relative z-10 mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <GlassSurface>
          <Header />
          <Hero fadeUp={fadeUp} />
          <StatsRow />
          <Features fadeUp={fadeUp} />
          <Spotlight />
          <Updates />
          <FinalCTA />
          <Footer />
        </GlassSurface>
      </div>
    </main>
  );
}

// ----- Layout wrappers -----
function GlassSurface({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-700/50 bg-slate-800/30 p-6 sm:p-10 lg:p-14 shadow-2xl backdrop-blur-xl">
      {children}
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-20 -mx-2 mb-8 rounded-xl border border-white/5 bg-slate-900/40 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-slate-900/30">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <a href="/" className="group inline-flex items-center gap-2 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-cyan-400/60">
          <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500" />
          <span className="text-sm font-semibold tracking-wide text-white/90">AFI‑Dash</span>
        </a>
        <ul className="hidden items-center gap-2 sm:flex">
          <NavLink href="#features">Features</NavLink>
          <NavLink href="#datasets">Datasets</NavLink>
          <NavLink href="#docs">Docs</NavLink>
        </ul>
        <div className="flex items-center gap-2">
          <a href="#try" className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/60">
            Try the demo
          </a>
        </div>
      </nav>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a
        href={href}
        className="rounded-lg px-3 py-1.5 text-sm text-slate-300 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
      >
        {children}
      </a>
    </li>
  );
}

// ----- Sections -----
function Hero({
  fadeUp
}: {
  fadeUp: { initial: any; whileInView: any; transition: any; viewport: any };
}) {
  return (
    <section className="mb-12 text-center sm:mb-16">
      <motion.h1
        {...fadeUp}
        className="mx-auto mb-4 max-w-4xl bg-gradient-to-r from-blue-300 via-cyan-200 to-teal-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-6xl lg:text-7xl"
      >
        Evidence‑led planning for Age Friendly Ireland
      </motion.h1>
      <motion.p
        {...fadeUp}
        transition={{ ...fadeUp.transition, delay: 0.05 }}
        className="mx-auto max-w-3xl text-base text-slate-300 sm:text-lg"
      >
        Explore population demand, service supply, gaps, and a transparent MCDA that allocates funding across local authorities.
      </motion.p>
      <motion.div
        {...fadeUp}
        transition={{ ...fadeUp.transition, delay: 0.1 }}
        className="mt-6 flex flex-wrap items-center justify-center gap-3"
      >
        <a
          href="/mcda"
          className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
        >
          Open MCDA <Icon.Arrow className="h-4 w-4" />
        </a>
        <a
          href="/docs"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-600/60 bg-slate-800/40 px-5 py-3 text-sm font-medium text-slate-200 backdrop-blur transition hover:border-slate-500 hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
        >
          Read the method
        </a>
      </motion.div>
    </section>
  );
}

function StatsRow() {
  return (
    <section aria-label="Key statistics" className="mb-10 sm:mb-14">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat title="65+ growth" value="+48%" hint="2019 → 2030 projection" />
        <Stat title="85+ growth" value="+67%" hint="2019 → 2030 projection" />
        <Stat title="Local authorities" value="31" hint="All Ireland coverage" />
        <Stat title="Datasets" value="> 40" hint="Open & referenced" />
      </div>
    </section>
  );
}

function Stat({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/30 p-4 text-center shadow-inner backdrop-blur">
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{title}</div>
      <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
    </div>
  );
}

function Features({ fadeUp }: { fadeUp: any }) {
  const items: Array<{ href: string; title: string; desc: string; IconEl: React.ReactNode }> = [
    { href: "/demand", title: "Demand", desc: "65+ / 85+ trends & OADR", IconEl: <Icon.Trend className="h-5 w-5" /> },
    { href: "/supply", title: "Supply", desc: "Service locations & capacity", IconEl: <Icon.Layers className="h-5 w-5" /> },
    { href: "/gap", title: "Gap", desc: "Demand vs supply by area", IconEl: <Icon.MapPin className="h-5 w-5" /> },
    { href: "/mcda", title: "MCDA", desc: "Score & allocate funding", IconEl: <Icon.Gauge className="h-5 w-5" /> },
    { href: "/datasets", title: "Datasets", desc: "Source files & notes", IconEl: <Icon.Database className="h-5 w-5" /> },
    { href: "/docs", title: "Docs", desc: "Methods & definitions", IconEl: <Icon.Book className="h-5 w-5" /> }
  ];

  return (
    <section id="features" className="mb-14 sm:mb-20">
      <motion.h2
        {...fadeUp}
        className="mb-6 text-center text-2xl font-semibold tracking-tight text-white/90 sm:text-3xl"
      >
        Explore the dashboard
      </motion.h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <QuickLink key={it.href} href={it.href} title={it.title} desc={it.desc} icon={it.IconEl} />
        ))}
      </div>
    </section>
  );
}

function QuickLink({
  href,
  title,
  desc,
  icon
}: {
  href: string;
  title: string;
  desc: string;
  icon?: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
    >
      {/* Hover glow */}
      <div className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-transparent" />
      </div>
      {/* Gradient border shimmer */}
      <div aria-hidden className="pointer-events-none absolute inset-px rounded-2xl [mask:linear-gradient(#000,#000)_content-box,linear-gradient(#000,#000)] [mask-composite:exclude] bg-gradient-to-r from-cyan-400/20 via-blue-400/20 to-emerald-400/20 p-px" />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-cyan-300">{icon}</span> : null}
          <h3 className="text-lg font-semibold text-white transition-colors duration-300 group-hover:text-cyan-300">
            {title}
          </h3>
        </div>
        <Icon.Arrow className="h-4 w-4 translate-x-0 text-slate-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-cyan-300" />
      </div>
      <p className="mt-1 text-sm text-slate-400">{desc}</p>
    </a>
  );
}

function Spotlight() {
  return (
    <section id="datasets" className="mb-14 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-6 backdrop-blur">
        <h3 className="mb-2 text-xl font-semibold text-white">Transparent inputs</h3>
        <p className="text-sm text-slate-300">
          Every chart and score is backed by traceable datasets. Import CSVs, keep notes, and show caveats right where people look.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />Open data sources</li>
          <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />Provenance & versioning</li>
          <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />Inline documentation</li>
        </ul>
        <div className="mt-5">
          <a href="/datasets" className="inline-flex items-center gap-2 rounded-lg border border-slate-600/60 bg-slate-800/40 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/60">
            Browse datasets <Icon.Arrow className="h-4 w-4" />
          </a>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-6 backdrop-blur">
        <h3 className="mb-2 text-xl font-semibold text-white">Fair allocation</h3>
        <p className="text-sm text-slate-300">
          The MCDA is clear and configurable. Weight indicators, preview impacts, and export the breakdown for audit.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-white/5 bg-slate-800/40 p-3">
            <div className="text-xs text-slate-400">Weight</div>
            <div className="text-lg font-semibold text-white">0.35</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-slate-800/40 p-3">
            <div className="text-xs text-slate-400">Impact</div>
            <div className="text-lg font-semibold text-white">+12.4%</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-slate-800/40 p-3">
            <div className="text-xs text-slate-400">Criteria</div>
            <div className="text-lg font-semibold text-white">7</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-slate-800/40 p-3">
            <div className="text-xs text-slate-400">Exports</div>
            <div className="text-lg font-semibold text-white">CSV / PDF</div>
          </div>
        </div>
        <div className="mt-5">
          <a href="/mcda" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-slate-900 shadow shadow-cyan-500/20">
            Try MCDA <Icon.Arrow className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

function Updates() {
  const items = [
    { date: "2025‑08‑20", title: "Added service capacity layer", desc: "Upload facility capacity by EIRCODE and visualize coverage." },
    { date: "2025‑07‑30", title: "MCDA export", desc: "Download full allocation with per‑criterion contributions." },
    { date: "2025‑07‑10", title: "Docs refresh", desc: "New glossary and indicator definitions." }
  ];
  return (
    <section className="mb-14">
      <h3 className="mb-4 text-xl font-semibold text-white">Latest updates</h3>
      <ol className="relative space-y-4 border-l border-white/10 pl-4">
        {items.map((i) => (
          <li key={i.title} className="ml-1">
            <div className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-cyan-400" aria-hidden />
            <div className="text-xs text-slate-400">{i.date}</div>
            <div className="font-medium text-white">{i.title}</div>
            <div className="text-sm text-slate-300">{i.desc}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FinalCTA() {
  return (
    <section id="try" className="mb-10">
      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-600/10 p-6 sm:flex-row">
        <div>
          <h4 className="text-lg font-semibold text-white">Ready to explore your area?</h4>
          <p className="text-sm text-slate-300">Jump straight to demand, supply, and gaps for your local authority.</p>
        </div>
        <div className="flex gap-2">
          <a href="/gap" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:brightness-95">Open the map</a>
          <a href="/docs" className="rounded-xl border border-slate-600/60 bg-slate-800/40 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/60">See how it works</a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-8 border-t border-white/10 pt-6 text-sm text-slate-400">
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p>© {new Date().getFullYear()} AFI‑Dash. Built for Age Friendly Ireland.</p>
        <div className="flex gap-4">
          <a href="/datasets" className="hover:text-white">Datasets</a>
          <a href="/docs" className="hover:text-white">Docs</a>
          <a href="/about" className="hover:text-white">About</a>
        </div>
      </div>
    </footer>
  );
}
