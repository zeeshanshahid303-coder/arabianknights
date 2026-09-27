"use client";

import Link from "next/link";

type GoldButtonProps = {
  href: string;
  children: React.ReactNode;
  /** Rendered before the label in a fixed-width span so labels stay aligned. */
  icon?: React.ReactNode;
  /** `solid` fills with gold and is for the single primary action per view. */
  variant?: "solid" | "ghost";
  size?: "md" | "lg";
  className?: string;
};

const SIZES = {
  md: {
    padding: "0.875rem 2rem",
    font: "var(--font-sans)",
    size: "0.875rem",
    weight: 500,
    tracking: "0.08em",
    radius: "1rem",
  },
  lg: {
    padding: "1.25rem 3.5rem",
    font: "var(--font-display)",
    size: "1.25rem",
    weight: 500,
    tracking: "0.04em",
    radius: "20px",
  },
} as const;

const RESTING_SHADOW = "0 0 0 1px rgba(212,175,55,0.22), 0 0 40px -12px rgba(212,175,55,0.35)";

/**
 * The one gold action button on the site. Hover states live here so the
 * hero, the menu link and the reservation CTA don't each restate the same
 * pair of inline style handlers.
 *
 * Sizing is intrinsic — callers that need full-width buttons on small
 * screens (e.g. a grid of stacked hero CTAs) pass `w-full sm:w-auto`.
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
  const resting: React.CSSProperties =
    variant === "solid"
      ? {
          background: "linear-gradient(160deg, #f0d98a 0%, #d4af37 55%, #b8952c 100%)",
          border: "1px solid rgba(240, 217, 138, 0.7)",
          color: "#0a0d0b",
        }
      : {
          background: "rgba(212, 175, 55, 0.1)",
          border: "1px solid rgba(212, 175, 55, 0.4)",
          color: "var(--color-gold)",
        };
  const hovered: React.CSSProperties =
    variant === "solid"
      ? {
          background: "linear-gradient(160deg, #f7e6ad 0%, #e5c357 55%, #c9a232 100%)",
          border: "1px solid rgba(247, 230, 173, 0.9)",
          boxShadow: "0 0 0 1px rgba(212,175,55,0.45), 0 0 60px -8px rgba(212,175,55,0.6)",
        }
      : {
          background: "rgba(212, 175, 55, 0.2)",
          border: "1px solid rgba(212, 175, 55, 0.75)",
          boxShadow: "0 0 0 1px rgba(212,175,55,0.4), 0 0 60px -8px rgba(212,175,55,0.55)",
        };

  return (
    <Link
      href={href}
      className={`group inline-flex items-center justify-center gap-3 transition-all duration-300 ${className}`}
      style={{
        padding: s.padding,
        borderRadius: s.radius,
        fontFamily: s.font,
        fontSize: s.size,
        fontWeight: s.weight,
        letterSpacing: s.tracking,
        boxShadow: RESTING_SHADOW,
        ...resting,
      }}
      onMouseEnter={(e) => Object.assign(e.currentTarget.style, hovered)}
      onMouseLeave={(e) =>
        Object.assign(e.currentTarget.style, resting, {
          boxShadow: RESTING_SHADOW,
        })
      }
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
