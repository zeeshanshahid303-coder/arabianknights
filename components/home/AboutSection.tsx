import Image from "next/image";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";

type AboutSectionProps = {
  imageUrl: string | null;
  storyText: string;
  aboutText: string;
  address: string;
};

export function AboutSection({
  imageUrl,
  storyText,
  aboutText,
  address,
}: AboutSectionProps) {
  return (
    <section className="grain relative overflow-hidden py-24 lg:py-32">
      {/* Soft gradient wash bridging sections */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 0% 50%, rgba(77,17,24,0.18) 0%, transparent 60%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-12">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Text — left on desktop, second on mobile */}
          <div className="order-2 lg:order-1">
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
                color: "var(--color-ivory-muted)",
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
                color: "var(--color-ivory-muted)",
              }}
            >
              {aboutText}
            </p>

            <div className="rule-gold mb-6 w-24" />

            <p
              className="text-sm tracking-wider"
              style={{
                fontFamily: "var(--font-sans)",
                color: "var(--color-ivory-faint)",
              }}
            >
              {address}
            </p>
          </div>

          {/* Image — first on mobile, right on desktop */}
          <Reveal variant="left" delay={200} className="order-1 lg:order-2">
            <div
              className="relative overflow-hidden"
              style={{ height: "clamp(400px, 50vw, 600px)" }}
            >
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt="Arabian Knights Restaurant & Cafe"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(120% 100% at 50% 0%, var(--color-emerald-core) 0%, var(--color-night) 70%)",
                  }}
                />
              )}

              {/* Cinematic overlay for depth */}
              <div
                className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply"
                style={{ background: "linear-gradient(180deg, transparent 40%, #040206 100%)" }}
              />

              {/* Subtle inner gold frame - straight edged */}
              <div
                className="pointer-events-none absolute inset-3 sm:inset-5"
                style={{ border: "1px solid rgba(212,175,55,0.15)" }}
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
