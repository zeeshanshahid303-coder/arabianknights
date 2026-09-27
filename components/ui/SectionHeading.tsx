"use client";

import { useReveal } from "@/lib/useReveal";

// Reusable section heading block: eyebrow label + large Cormorant heading.
// A client component so it can observe its own entrance — it is only ever
// rendered inside another client or server component, never on its own route.

type SectionHeadingProps = {
  eyebrow: string;
  heading: React.ReactNode;
  className?: string;
  center?: boolean;
};

export function SectionHeading({
  eyebrow,
  heading,
  className = "",
  center = false,
}: SectionHeadingProps) {
  const ref = useReveal<HTMLDivElement>();
  const align = center ? "text-center" : "";

  return (
    <div ref={ref} className={`reveal-up mb-12 ${align} ${className}`}>
      <p
        className="eyebrow mb-4"
        style={{ color: "var(--color-ivory-faint)", fontFamily: "var(--font-sans)" }}
      >
        {eyebrow}
      </p>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          color: "var(--color-ivory)",
          fontSize: "clamp(1.85rem, 4vw, 3rem)",
          fontWeight: 400,
          lineHeight: 1.1,
          letterSpacing: "0.01em",
        }}
      >
        {heading}
      </h2>
    </div>
  );
}
