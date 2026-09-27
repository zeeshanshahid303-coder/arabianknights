"use client";

import { useReveal } from "@/lib/useReveal";

type RevealProps = {
  children: React.ReactNode;
  /** Direction the element travels from before settling. */
  variant?: "up" | "left" | "right" | "scale";
  /** Staggers a group; pair with an `index` in the mapped list. */
  delay?: number;
  as?: "div" | "section" | "article" | "li";
  className?: string;
  style?: React.CSSProperties;
};

const VARIANTS = {
  up: "reveal-up",
  left: "reveal-left",
  right: "reveal-right",
  scale: "reveal-scale",
} as const;

/**
 * Applies the scroll-reveal transition to a server-rendered subtree. The
 * component itself is a client boundary, so server components can use it
 * without becoming client components themselves.
 */
export function Reveal({
  children,
  variant = "up",
  delay = 0,
  as: Tag = "div",
  className = "",
  style,
}: RevealProps) {
  const ref = useReveal<HTMLElement>();
  // `Tag` is a union of intrinsic elements, each with its own ref type. The
  // observer only ever touches classList/style, so widen it once here.
  const El = Tag as React.ElementType;

  return (
    <El
      ref={ref}
      className={`${VARIANTS[variant]} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms`, ...style } : style}
    >
      {children}
    </El>
  );
}
