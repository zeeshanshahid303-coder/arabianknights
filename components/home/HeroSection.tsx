"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { GoldButton } from "@/components/ui/GoldButton";
import { GlowLink } from "@/components/ui/GlowLink";

type HeroSectionProps = {
  heroImageUrl: string | null;
  title: string;
  subtitle: string;
  isOpen: boolean;
  /** Appended after the gold-gradient phrase in the headline. */
  headlineLead: string;
  headlineAccent: string;
};

export function HeroSection({
  heroImageUrl,
  title,
  subtitle,
  isOpen,
  headlineLead,
  headlineAccent,
}: HeroSectionProps) {
  const bgRef = useRef<HTMLDivElement>(null);

  // Subtle parallax — the backdrop drifts at 35% of scroll speed. Skipped
  // where the user has asked for reduced motion.
  useEffect(() => {
    const el = bgRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.transform = `translateY(${window.scrollY * 0.35}px)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section
      className="relative flex items-center justify-center overflow-hidden grain"
      style={{ minHeight: "100dvh" }}
    >
      {/* Backdrop — scaled up so the parallax drift never exposes an edge */}
      <div
        ref={bgRef}
        className="absolute inset-0"
        style={{ inset: "-12% 0", willChange: "transform" }}
      >
        {heroImageUrl ? (
          <Image
            src={heroImageUrl}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 80% at 50% 0%, var(--color-emerald-core) 0%, var(--color-emerald-deep) 45%, var(--color-ink) 100%)",
            }}
          />
        )}
      </div>

      {/* Legibility overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(5,7,6,0.55) 0%, rgba(5,7,6,0.88) 55%, #050706 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center px-6 text-center">
        {/* Status pill */}
        <div
          className="mb-8 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full px-4 py-1.5 text-xs uppercase tracking-widest hero-status"
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid var(--color-hairline)",
            fontFamily: "var(--font-sans)",
            color: "var(--color-ash)",
          }}
        >
          <span
            className="size-1.5 flex-none rounded-full"
            style={{
              background: isOpen ? "#4ade80" : "#ef4444",
              boxShadow: isOpen ? "0 0 6px 2px rgba(74, 222, 128, 0.4)" : "none",
            }}
          />
          <span>{isOpen ? "Open Now · Dine-in & Delivery" : "Currently Closed"}</span>
          <span aria-hidden style={{ color: "var(--color-hairline-strong)" }}>
            ·
          </span>
          <span>Mughlai &amp; Indian Cuisine</span>
        </div>

        {/* Headline */}
        <h1
          className="hero-headline"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 300,
            lineHeight: 0.95,
            letterSpacing: "0.01em",
            fontSize: "clamp(2.4rem, 7.5vw, 5rem)",
            color: "var(--color-bone)",
          }}
        >
          {headlineLead}
          <br />
          <span className="text-gold-gradient">{headlineAccent}</span>
        </h1>

        {/* Screen-reader-only full title, so the h1 still reads as one title */}
        <span className="sr-only">{title}</span>

        {/* Subtitle */}
        <p
          className="hero-subtitle mb-10 max-w-md text-pretty"
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 300,
            fontSize: "clamp(1rem, 2vw, 1.125rem)",
            letterSpacing: "0.06em",
            color: "var(--color-ash)",
            lineHeight: 1.65,
          }}
        >
          {subtitle}
        </p>

        {/* Primary actions — stack full-width on phones, inline from `sm` up */}
        <div className="hero-buttons grid w-full max-w-lg grid-cols-1 gap-3 sm:flex sm:max-w-none sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
          <GlowLink href="/menu?mode=takeaway" icon="🥡" className="w-full sm:w-auto">
            Takeaway
          </GlowLink>
          <GlowLink href="/menu?mode=delivery" icon="🏠" className="w-full sm:w-auto">
            Delivery
          </GlowLink>
          <GoldButton
            href="/reservation"
            icon="📅"
            variant="solid"
            className="w-full sm:w-auto"
          >
            Reserve a Table
          </GoldButton>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 opacity-40">
        <span
          className="text-[10px] uppercase tracking-[0.3em]"
          style={{ fontFamily: "var(--font-sans)", color: "var(--color-ash)" }}
        >
          Scroll
        </span>
        <div
          className="relative h-10 w-px overflow-hidden"
          style={{ background: "var(--color-hairline)" }}
        >
          <div
            className="absolute left-0 top-0 w-full"
            style={{
              height: "40%",
              background: "var(--color-gold)",
              animation: "scrollLine 1.8s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes scrollLine {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(300%); }
        }
        .hero-status   { animation: fadeUp 900ms cubic-bezier(0.22,1,0.36,1) both; }
        .hero-headline { animation: fadeUp 900ms 120ms cubic-bezier(0.22,1,0.36,1) both; }
        .hero-subtitle { animation: fadeUp 900ms 240ms cubic-bezier(0.22,1,0.36,1) both; }
        .hero-buttons  { animation: fadeUp 900ms 360ms cubic-bezier(0.22,1,0.36,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .hero-status, .hero-headline, .hero-subtitle, .hero-buttons {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
