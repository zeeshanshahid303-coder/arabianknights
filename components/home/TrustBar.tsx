import { Reveal } from "@/components/ui/Reveal";

type TrustBarProps = {
  priceMin: number;
  priceMax: number;
};

/** Hairline rule before every cell but the first, via a pseudo-element so it
    spans the cell without needing `position: relative` on a flex container.
    `before:content-['']` is what actually materialises the pseudo-element. */
const DIVIDER =
  "relative before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-[var(--color-hairline)] before:content-[''] first:before:hidden lg:before:left-[-1.5rem]";

export function TrustBar({ priceMin, priceMax }: TrustBarProps) {
  const items = [
    { label: "Rating", value: "4.5 ★", sub: "Google Reviews" },
    { label: "Reviews", value: "280+", sub: "Happy Guests" },
    { label: "Cuisine", value: "Mughlai & Indian", sub: "Authentic Recipes" },
    { label: "Price Range", value: `₹${priceMin}–₹${priceMax}`, sub: "Per Person" },
  ];

  return (
    <section
      className="py-8"
      style={{
        background: "rgba(255,255,255,0.025)",
        borderTop: "1px solid var(--color-hairline)",
        borderBottom: "1px solid var(--color-hairline)",
      }}
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-12">
        <div className="grid grid-cols-2 gap-y-8 lg:grid-cols-4 lg:gap-y-0">
          {items.map((item, i) => (
            <Reveal
              key={item.label}
              delay={i * 80}
              className={`flex flex-col items-center text-center ${DIVIDER}`}
            >
              <span
                className="eyebrow mb-1"
                style={{ color: "var(--color-ash)", fontFamily: "var(--font-sans)" }}
              >
                {item.label}
              </span>
              <span
                className="text-balance"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
                  fontWeight: 400,
                  color: "var(--color-bone)",
                  lineHeight: 1.2,
                }}
              >
                {item.value}
              </span>
              <span
                className="mt-1 text-xs"
                style={{
                  fontFamily: "var(--font-sans)",
                  color: "var(--color-ash)",
                  opacity: 0.7,
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
