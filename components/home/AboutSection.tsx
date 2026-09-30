import Image from "next/image";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";

type AboutSectionProps = {
  storyText: string;
  aboutText: string;
  address: string;
};

export function AboutSection({
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
          <Reveal variant="left" delay={200} className="order-1 lg:order-2 lg:col-span-6 lg:col-start-7">
            {/* Six of the twelve tracks rather than five: the section's
                own 16-unit column gap keeps the text column and this one
                apart, so the image can grow without ever reaching the
                words beside it. */}
            <div className="relative mx-auto w-full max-w-[560px]">
              {/* The image's own dimensions (2734x1536, read from the
                 asset's header) are handed to <Image> so it lays out at
                 the correct intrinsic size before the bytes land, with
                 no layout shift. h-auto then lets the rendered height
                 follow the width, and the natural proportions are kept
                 because the box is sized to them rather than the image
                 being fitted to a box — nothing is cropped. */}
              <Image
                src="/restaurant-hero.png"
                alt="Arabian Knights Restaurant & Cafe"
                width={2734}
                height={1536}
                sizes="(max-width: 1024px) 100vw, 560px"
                priority
                className="heritage-figure block h-auto w-full"
              />

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
