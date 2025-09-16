// components/TopNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/",        label: "Overview" },
  { href: "/supply",  label: "Supply" },
  { href: "/demand",  label: "Demand" },
  { href: "/gap",     label: "Gap" },
  { href: "/mcda",    label: "MCDA" },
  { href: "/datasets",label: "Datasets" },
  { href: "/docs",    label: "Docs" }, // NEW
];

export default function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/60 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-6">
        <Link href="/" className="text-lg font-bold text-purple-400 hover:opacity-80">
          AFI–Dash
        </Link>
        <nav className="text-sm text-gray-300 gap-4 flex">
          {items.map(it => {
            const active = pathname === it.href || (it.href !== "/" && pathname?.startsWith(it.href));
            return (
              <Link
                key={it.href}
                href={it.href}
                className={active ? "text-white font-medium" : "hover:text-white"}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
