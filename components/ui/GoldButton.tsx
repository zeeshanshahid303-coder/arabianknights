"use client";

import Link from "next/link";

type GoldButtonProps = {
  href: string;
  children: React.ReactNode;
  /** Rendered before the label in a fixed-width span so labels stay aligned. */
  icon?: React.ReactNode;
  /** `solid` is the brushed-gold primary action; `ghost` is its glass counterpart. */
  variant?: "solid" | "ghost";
  size?: "md" | "lg";
  className?: string;
};

const SIZES = {
  md: {
    padding: "0.9rem 2rem",
    size: "0.8125rem",
    tracking: "0.12em",
    weight: 500,
  },
  lg: {
    padding: "1.2rem 3.25rem",
    size: "0.9375rem",
    tracking: "0.12em",
    weight: 600,
  },
} as const;

/**
 * The gold action button. Both variants carry the hover behaviour in
 * globals.css (`.btn-gold` / `.btn-glass`) rather than inline handlers,
 * so the hero, the menu link and the reservation CTA all animate
 * identically without restating the same pair of style objects.
 */
export function GoldButton({
  href,
  children,
  icon,
  variant = "ghost",
  size = "md",
  className = "",
}: GoldButtonProps) {
  const s = SIZES[size];

  return (
    <Link
      href={href}
      className={`${variant === "solid" ? "btn-gold" : "btn-glass"} inline-flex items-center justify-center gap-3 rounded-full ${
        variant === "solid" ? "font-semibold" : "font-medium"
      } ${className}`}
      style={{
        padding: s.padding,
        fontFamily: "var(--font-sans)",
        fontSize: s.size,
        fontWeight: s.weight,
        letterSpacing: s.tracking,
        textTransform: "uppercase",
      }}
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
