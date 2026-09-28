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
    <section className="grain relative overflow-hidden py-10 lg:py-12">
      {/* Soft gradient wash bridging sections */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 0% 50%, rgba(77,17,24,0.18) 0%, transparent 60%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-12 lg:gap-16">
          
          {/* Text — left on desktop, second on mobile */}
          <div className="order-2 lg:order-1 lg:col-span-6 lg:py-10">
            <Reveal variant="up" delay={0}>
              <SectionHeading
                eyebrow="Our Heritage"
                heading={
                  <>
                    A Legacy of{" "}
                    <span className="text-gold-gradient">Arabian Hospitality</span>
                  </>
                }
              />
            </Reveal>

            <Reveal variant="up" delay={100}>
              <div className="mt-8 relative">
                <span
                  className="absolute -left-5 -top-4 text-5xl opacity-20 sm:-left-7 sm:-top-5 sm:text-6xl"
                  style={{ fontFamily: "var(--font-display)", color: "var(--color-gold)" }}
                  aria-hidden
                >
                  &ldquo;
                </span>
                <p
                  className="mb-8 text-balance leading-relaxed"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.375rem",
                    fontWeight: 300,
                    color: "var(--color-ivory)",
                    letterSpacing: "0.02em"
                  }}
                >
                  {storyText}
                </p>
              </div>
            </Reveal>

            <Reveal variant="up" delay={200}>
              <p
                className="mb-12 leading-[1.8]"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontWeight: 300,
                  fontSize: "1rem",
                  color: "var(--color-ivory-muted)",
                }}
              >
                {aboutText}
              </p>
            </Reveal>

            <Reveal variant="up" delay={300}>
              <div className="flex flex-col items-start gap-3 border-t border-[rgba(212,175,55,0.15)] pt-8">
                <span className="uppercase tracking-[0.25em] text-[0.625rem] text-[var(--color-gold)] font-medium">
                  The Destination
                </span>
                <p
                  className="text-[0.75rem] tracking-[0.15em] uppercase leading-[1.8] text-balance"
                  style={{
                    fontFamily: "var(--font-sans)",
                    color: "var(--color-ivory-faint)",
                  }}
                >
                  {address}
                </p>
              </div>
            </Reveal>
          </div>

          {/* Image — first on mobile, right on desktop */}
          <Reveal variant="left" delay={200} className="order-1 lg:order-2 lg:col-span-5 lg:col-start-8">
            <div className="relative mx-auto aspect-[3/4] w-full max-w-[500px] overflow-hidden">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt="Arabian Knights Restaurant & Cafe"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 40vw"
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    background:
                      "radial-gradient(120% 100% at 50% 0%, var(--color-emerald-core) 0%, var(--color-night) 70%)",
                  }}
                >
                  <span
                    className="text-6xl opacity-10"
                    style={{ fontFamily: "var(--font-display)", color: "var(--color-gold)" }}
                    aria-hidden
                  >
                    ✦
                  </span>
                </div>
              )}

              {/* Architectural framing overlay */}
              <div className="absolute inset-0 z-10 pointer-events-none ring-1 ring-inset ring-[rgba(255,255,255,0.06)]" />
              <div className="absolute inset-3 z-10 pointer-events-none border border-[rgba(212,175,55,0.2)] sm:inset-4" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
