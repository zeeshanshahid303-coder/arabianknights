import { SectionHeading } from "@/components/ui/SectionHeading";

const features = [
  {
    glyph: "✦",
    title: "Authentic Flavors",
    body: "Recipes rooted in Mughlai tradition, prepared with whole spices and slow-cooking techniques passed down through generations.",
  },
  {
    glyph: "◈",
    title: "Fresh Every Day",
    body: "Every dish is prepared fresh to order. No pre-made shortcuts — only honest kitchen craft and daily sourced ingredients.",
  },
  {
    glyph: "◇",
    title: "Warm Hospitality",
    body: "From your first call to your last bite, every detail of your experience is attended to with genuine Arabian warmth.",
  },
  {
    glyph: "❖",
    title: "Premium Dining",
    body: "An atmosphere designed for celebration — intimate lighting, elegant interiors, and attentive service at every table.",
  },
];

export function WhyChooseUs() {
  return (
    <section className="py-[120px]">
      <div className="max-w-6xl mx-auto px-6 lg:px-12">
        <SectionHeading
          eyebrow="The Arabian Knights Difference"
          heading="Why Guests Choose Us"
          center
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="rounded-[20px] edge-hair p-8 reveal-up"
              style={{
                background: "rgba(255,255,255,0.04)",
                transitionDelay: `${i * 80}ms`,
                transition: "transform 300ms cubic-bezier(0.22,1,0.36,1), border-color 300ms ease, box-shadow 300ms ease",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.transform = "translateY(-4px)";
                el.style.borderColor = "var(--color-hairline-strong)";
                el.style.boxShadow = "0 16px 48px -16px rgba(0,0,0,0.5)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.transform = "";
                el.style.borderColor = "";
                el.style.boxShadow = "";
              }}
            >
              {/* Glyph icon */}
              <div
                className="mb-5 text-3xl select-none"
                style={{ color: "var(--color-gold)", lineHeight: 1 }}
              >
                {f.glyph}
              </div>

              <h3
                className="mb-3"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.375rem",
                  fontWeight: 500,
                  color: "var(--color-bone)",
                }}
              >
                {f.title}
              </h3>

              <p
                className="text-sm leading-relaxed"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontWeight: 300,
                  color: "var(--color-ash)",
                }}
              >
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
