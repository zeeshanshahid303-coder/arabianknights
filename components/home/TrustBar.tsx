import { Reveal } from "@/components/ui/Reveal";

type TrustBarProps = {
  priceMin: number;
  priceMax: number;
};

/** Hairline rule before every cell but the first, via a pseudo-element so it
    spans the cell without needing `position: relative` on a flex container. */
const DIVIDER =
  "relative before:absolute before:hidden before:inset-y-0 before:left-0 before:w-px before:content-[''] lg:before:block first:before:hidden lg:before:left-[-1.5rem]";

export function TrustBar({ priceMin, priceMax }: TrustBarProps) {
  const items = [
    { label: "Rating", value: "4.5 ★", sub: "Google Reviews" },
    { label: "Reviews", value: "280+", sub: "Happy Guests" },
    { label: "Cuisine", value: "Mughlai & Indian", sub: "Authentic Recipes" },
    { label: "Price Range", value: `₹${priceMin}–₹${priceMax}`, sub: "Per Person" },
  ];

  // We add a custom class for the gradient divider
  const gradientDividerClass = "[&>div:not(:first-child)]:before:bg-[linear-gradient(to_bottom,transparent,rgba(212,175,55,0.15)_20%,rgba(212,175,55,0.15)_80%,transparent)]";

  return (
    <section
      className="relative z-20 py-10"
      style={{
        background: "radial-gradient(ellipse at top, rgba(11,45,36,0.15) 0%, rgba(4,2,6,0.4) 100%)",
        borderTop: "1px solid rgba(212,175,55,0.08)",
        borderBottom: "1px solid rgba(212,175,55,0.08)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.03) 50%, transparent 100%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
        <div className={`grid grid-cols-2 gap-y-10 lg:grid-cols-4 lg:gap-y-0 ${gradientDividerClass}`}>
          {items.map((item, i) => (
            <Reveal
              key={item.label}
              delay={i * 80}
              className={`flex flex-col items-center text-center ${DIVIDER}`}
            >
              <span
                className="eyebrow mb-1"
                style={{ color: "var(--color-ivory-faint)", fontFamily: "var(--font-sans)" }}
              >
                {item.label}
              </span>
              <span
                className="text-balance"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
                  fontWeight: 400,
                  color: "var(--color-ivory)",
                  lineHeight: 1.2,
                }}
              >
                {item.value}
              </span>
              <span
                className="mt-1 text-xs"
                style={{
                  fontFamily: "var(--font-sans)",
                  color: "var(--color-ivory-faint)",
                }}
              >
                {item.sub}
              </span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
