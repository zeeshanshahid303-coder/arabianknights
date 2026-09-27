import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";

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
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-12">
        <SectionHeading
          eyebrow="The Arabian Knights Difference"
          heading="Why Guests Choose Us"
          center
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {features.map((f, i) => (
            <Reveal
              key={f.title}
              delay={i * 80}
              className="edge-hair cursor-default rounded-[20px] p-8 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-[var(--color-hairline-strong)] hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.5)]"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <div
                aria-hidden
                className="mb-5 select-none text-3xl"
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
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
