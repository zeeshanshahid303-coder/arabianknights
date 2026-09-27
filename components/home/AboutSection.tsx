import Image from "next/image";
import { SectionHeading } from "@/components/ui/SectionHeading";

type AboutSectionProps = {
  heroImageUrl: string | null;
  storyText: string;
  aboutText: string;
  address: string;
};

export function AboutSection({
  heroImageUrl,
  storyText,
  aboutText,
  address,
}: AboutSectionProps) {
  return (
    <section
      style={{ background: "var(--color-ink-raised)" }}
      className="py-[120px]"
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Text — left on desktop, second on mobile */}
          <div className="order-2 lg:order-1 reveal-right">
            <SectionHeading
              eyebrow="Our Story"
              heading={
                <>
                  A Legacy of{" "}
                  <span className="text-gold-gradient">Arabian Hospitality</span>
                </>
              }
            />

            <p
              className="mb-6 leading-[1.75]"
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 300,
                fontSize: "1.0625rem",
                color: "var(--color-ash)",
              }}
            >
              {storyText}
            </p>

            <p
              className="mb-8 leading-[1.75]"
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 300,
                fontSize: "1.0625rem",
                color: "var(--color-ash)",
              }}
            >
              {aboutText}
            </p>

            {/* Divider */}
            <div className="rule-gold w-24 mb-6" />

            <p
              className="text-sm tracking-wider"
              style={{
                fontFamily: "var(--font-sans)",
                color: "var(--color-ash)",
                opacity: 0.65,
              }}
            >
              {address}
            </p>
          </div>

          {/* Image — first on mobile, right on desktop */}
          <div className="order-1 lg:order-2 reveal-left" style={{ transitionDelay: "200ms" }}>
            <div
              className="relative rounded-[20px] overflow-hidden"
              style={{
                height: "clamp(320px, 45vw, 540px)",
              }}
            >
              {heroImageUrl ? (
                <Image
                  src={heroImageUrl}
                  alt="Arabian Knights Restaurant exterior"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{ background: "var(--color-ink)" }}
                />
              )}
              {/* Subtle inner gold frame */}
              <div
                className="absolute inset-5 rounded-2xl pointer-events-none"
                style={{ border: "1px solid rgba(212,175,55,0.18)" }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
