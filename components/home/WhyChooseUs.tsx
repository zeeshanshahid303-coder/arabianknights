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
    <section className="grain relative overflow-hidden py-24 lg:py-32">
      {/* Subtle emerald bloom anchoring the background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(circle at 100% 50%, rgba(11,45,36,0.18) 0%, transparent 60%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-12">
        <SectionHeading
          eyebrow="The Arabian Knights Difference"
          heading="Why Guests Choose Us"
          center
        />

        <div className="mt-16 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:gap-x-16 lg:gap-y-16">
          {features.map((f, i) => (
            <Reveal
              key={f.title}
              delay={i * 80}
              className="group relative flex flex-col items-center sm:items-start text-center sm:text-left"
            >
              <div
                aria-hidden
                className="mb-6 select-none opacity-40 transition-opacity duration-500 ease-out group-hover:opacity-100"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "3rem",
                  color: "var(--color-gold)",
                  lineHeight: 1,
                  textShadow: "0 0 24px rgba(212,175,55,0.4)",
                }}
              >
                {f.glyph}
              </div>

              <h3
                className="mb-4"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.6rem",
                  fontWeight: 400,
                  color: "var(--color-ivory)",
                }}
              >
                {f.title}
              </h3>

              <p
                className="leading-[1.75]"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontWeight: 300,
                  fontSize: "1.0625rem",
                  color: "var(--color-ivory-faint)",
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
