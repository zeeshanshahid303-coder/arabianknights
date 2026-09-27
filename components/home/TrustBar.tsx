type TrustBarProps = {
  priceMin: number;
  priceMax: number;
};

export function TrustBar({ priceMin, priceMax }: TrustBarProps) {
  const items = [
    { label: "Rating", value: "4.5 ★", sub: "Google Reviews" },
    { label: "Reviews", value: "280+", sub: "Happy Guests" },
    { label: "Cuisine", value: "Mughlai & Indian", sub: "Authentic Recipes" },
    {
      label: "Price Range",
      value: `₹${priceMin}–₹${priceMax}`,
      sub: "Per Person",
    },
  ];

  return (
    <section
      style={{
        background: "rgba(255,255,255,0.025)",
        borderTop: "1px solid var(--color-hairline)",
        borderBottom: "1px solid var(--color-hairline)",
      }}
      className="py-8"
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0">
          {items.map((item, i) => (
            <div
              key={item.label}
              className="flex flex-col items-center text-center reveal-up"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <span
                className="eyebrow mb-1"
                style={{ color: "var(--color-ash)", fontFamily: "var(--font-sans)" }}
              >
                {item.label}
              </span>
              <span
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
              {/* Vertical divider — only between items on large screens */}
              {i < items.length - 1 && (
                <div
                  className="hidden lg:block absolute right-0 h-10 w-px"
                  style={{ background: "var(--color-hairline)" }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
