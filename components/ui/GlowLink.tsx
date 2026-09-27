"use client";

import Link from "next/link";

type GlowLinkProps = {
  href: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
};

/**
 * The neutral, glassy counterpart to GoldButton — used for secondary
 * actions so the gold CTA keeps its emphasis. Shares the same hover
 * transition and icon treatment, both defined in globals.css.
 */
export function GlowLink({ href, children, icon, className = "" }: GlowLinkProps) {
  return (
    <Link
      href={href}
      className={`btn-glass inline-flex items-center justify-center gap-3 rounded-full px-8 py-4 text-sm font-medium tracking-[0.1em] ${className}`}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {icon ? (
        <span aria-hidden className="btn-icon">
          {icon}
        </span>
      ) : null}
      <span className="btn-label text-center">{children}</span>
    </Link>
  );
}
