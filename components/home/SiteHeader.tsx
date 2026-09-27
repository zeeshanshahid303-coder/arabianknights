"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SiteHeaderProps = {
  /** Wordmark beside the logo mark. The restaurant name comes from the
      database and may be empty, so the block collapses to a bare slot. */
  name: string;
  phone: string;
  reservationHref: string;
};

const NAV = [
  { label: "Menu", href: "/menu" },
  { label: "Reserve", href: "/reservation" },
  { label: "Cart", href: "/cart" },
];

/**
 * Fixed masthead. Sits over the hero on its own, then condenses to a
 * glass bar once the page scrolls.
 *
 * There is deliberately no mark or wordmark here: the logo slot is
 * reserved and left empty until the artwork arrives. The block is
 * always laid out at its final size so inserting a logo later is a
 * drop-in, not a re-layout.
 */
export function SiteHeader({ name, phone, reservationHref }: SiteHeaderProps) {
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`site-header fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        condensed ? "is-condensed" : ""
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 lg:px-12">
        {/* ---------- Logo slot ----------
            A fixed-size frame. Empty on purpose — no placeholder glyph,
            no temporary text. Drop the artwork in here and it is done. */}
        <Link
          href="/"
          aria-label={name ? `${name} — home` : "Home"}
          className="logo-slot"
        >
          <span className="logo-mark" aria-hidden />
          {name ? <span className="logo-wordmark">{name}</span> : null}
        </Link>

        <nav className="ml-auto hidden items-center gap-9 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <a
          href={`tel:${phone.replace(/\s+/g, "")}`}
          className="btn-ghost-row header-phone hidden lg:inline-flex"
        >
          {phone}
        </a>

        <Link
          href={reservationHref}
          className="btn-gold header-cta"
        >
          <span className="btn-label">Reserve</span>
        </Link>
      </div>
    </header>
  );
}
