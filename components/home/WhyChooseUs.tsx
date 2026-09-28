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
    <section className="grain relative overflow-hidden py-10 lg:py-12">
      {/* Subtle emerald bloom anchoring the background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(circle at 100% 50%, rgba(11,45,36,0.18) 0%, transparent 60%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-4xl px-6 lg:px-12">
        <Reveal variant="up">
          <SectionHeading
            eyebrow="The Arabian Knights Difference"
            heading={
              <>
                Our Promise to <span className="text-gold-gradient">Every Guest</span>
              </>
            }
            center
          />
        </Reveal>

        <div className="mt-14 flex flex-col">
          {features.map((f, i) => (
            <Reveal
              key={f.title}
              delay={i * 100}
              variant="up"
              className="group flex flex-col border-t border-[rgba(212,175,55,0.15)] py-8 md:flex-row md:items-start md:gap-12 md:py-10"
            >
              {/* Glyph & Title Side */}
              <div className="mb-4 flex items-center gap-5 md:mb-0 md:w-5/12 md:shrink-0 md:items-start">
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[rgba(212,175,55,0.15)] bg-[rgba(212,175,55,0.02)] text-[1.125rem] transition-all duration-700 ease-out group-hover:border-[rgba(212,175,55,0.4)] group-hover:bg-[rgba(212,175,55,0.06)] group-hover:shadow-[0_0_16px_rgba(212,175,55,0.15)]"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: "var(--color-gold)",
                  }}
                >
                  {f.glyph}
                </span>
                <h3
                  className="pt-1.5"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.5rem",
                    fontWeight: 400,
                    color: "var(--color-ivory)",
                    letterSpacing: "0.02em"
                  }}
                >
                  {f.title}
                </h3>
              </div>

              {/* Body Text Side */}
              <div className="md:pt-2 text-balance md:text-pretty">
                <p
                  className="leading-[1.8]"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontWeight: 300,
                    fontSize: "1rem",
                    color: "var(--color-ivory-faint)",
                  }}
                >
                  {f.body}
                </p>
              </div>
            </Reveal>
          ))}
          {/* Closing rule to anchor the index list */}
          <Reveal variant="up" delay={features.length * 100}>
            <div className="border-t border-[rgba(212,175,55,0.15)]" aria-hidden />
          </Reveal>
        </div>
      </div>
    </section>
  );
}