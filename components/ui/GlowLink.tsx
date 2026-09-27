"use client";

import Link from "next/link";

type GlowLinkProps = {
  href: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
};

const RESTING = {
  background: "rgba(255, 255, 255, 0.05)",
  borderColor: "var(--color-hairline)",
};
const HOVERED = {
  background: "rgba(255, 255, 255, 0.1)",
  borderColor: "var(--color-hairline-strong)",
};

/**
 * The neutral, glassy counterpart to GoldButton — used for secondary
 * actions so the gold CTA keeps its emphasis. Shares the same hover
 * transition timing and icon treatment.
 */
export function GlowLink({ href, children, icon, className = "" }: GlowLinkProps) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center justify-center gap-3 rounded-2xl px-8 py-3.5 text-sm transition-all duration-300 ${className}`}
      style={{
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        letterSpacing: "0.08em",
        color: "var(--color-bone)",
        backdropFilter: "blur(8px)",
        ...RESTING,
      }}
      onMouseEnter={(e) => Object.assign(e.currentTarget.style, HOVERED)}
      onMouseLeave={(e) => Object.assign(e.currentTarget.style, RESTING)}
    >
      {icon ? (
        <span
          aria-hidden
          className="inline-flex shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5"
        >
          {icon}
        </span>
      ) : null}
      <span className="text-center">{children}</span>
    </Link>
  );
}
