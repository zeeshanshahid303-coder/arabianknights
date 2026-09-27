"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

type HeroSectionProps = {
  heroImageUrl: string | null;
  subtitle: string;
  isOpen: boolean;
};

export function HeroSection({ heroImageUrl, subtitle, isOpen }: HeroSectionProps) {
  const bgRef = useRef<HTMLDivElement>(null);

  // Subtle parallax — background moves at 35% of scroll speed
  useEffect(() => {
    const el = bgRef.current;
    if (!el) return;
    const onScroll = () => {
      const y = window.scrollY;
      el.style.transform = `translateY(${y * 0.35}px)`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section
      className="relative flex items-center justify-center overflow-hidden"
      style={{ minHeight: "100dvh" }}
    >
      {/* Background image layer */}
      <div ref={bgRef} className="absolute inset-0 scale-110">
        {heroImageUrl ? (
          <Image
            src={heroImageUrl}
            alt="Arabian Knights Restaurant"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div style={{ background: "var(--color-ink-raised)" }} className="absolute inset-0" />
        )}
      </div>

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(5,7,6,0.52) 0%, rgba(5,7,6,0.88) 55%, #050706 100%)",
        }}
      />

      {/* Grain texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.35,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto">
        {/* Status pill */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs tracking-widest uppercase"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid var(--color-hairline)",
            fontFamily: "var(--font-sans)",
            color: "var(--color-ash)",
            animationName: "fadeUp",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: isOpen ? "#4ade80" : "#ef4444",
              boxShadow: isOpen ? "0 0 6px 2px rgba(74,222,128,0.4)" : "none",
            }}
          />
          {isOpen ? "Open Now · Dine-in & Delivery" : "Currently Closed"}
          <span style={{ color: "var(--color-hairline-strong)" }}>·</span>
          Mughlai & Indian Cuisine
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 300,
            lineHeight: 0.95,
            letterSpacing: "0.01em",
            fontSize: "clamp(2.4rem, 7.5vw, 5rem)",
            color: "var(--color-bone)",
          }}
          className="mb-6 hero-headline"
        >
          Experience the&nbsp;Art
          <br />
          of{" "}
          <span className="text-gold-gradient">Arabian Dining</span>
        </h1>

        {/* Subtitle */}
        <p
          className="mb-12 max-w-md hero-subtitle"
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

        {/* CTA buttons */}
        <div
          className="flex flex-wrap items-center justify-center gap-4 hero-buttons"
        >
          <Link
            href="/menu?mode=takeaway"
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm transition-all duration-300"
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              letterSpacing: "0.08em",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--color-hairline)",
              color: "var(--color-bone)",
              backdropFilter: "blur(8px)",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.background = "rgba(255,255,255,0.1)";
              el.style.borderColor = "var(--color-hairline-strong)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.background = "rgba(255,255,255,0.05)";
              el.style.borderColor = "var(--color-hairline)";
            }}
          >
            <span>🥡</span> Takeaway
          </Link>

          <Link
            href="/menu?mode=delivery"
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm transition-all duration-300"
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              letterSpacing: "0.08em",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--color-hairline)",
              color: "var(--color-bone)",
              backdropFilter: "blur(8px)",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.background = "rgba(255,255,255,0.1)";
              el.style.borderColor = "var(--color-hairline-strong)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.background = "rgba(255,255,255,0.05)";
              el.style.borderColor = "var(--color-hairline)";
            }}
          >
            <span>🏠</span> Delivery
          </Link>

          <Link
            href="/reservation"
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm transition-all duration-300 glow-gold"
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              letterSpacing: "0.08em",
              background: "rgba(212,175,55,0.1)",
              border: "1px solid rgba(212,175,55,0.4)",
              color: "var(--color-gold)",
              backdropFilter: "blur(8px)",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.background = "rgba(212,175,55,0.18)";
              el.style.borderColor = "rgba(212,175,55,0.7)";
              el.style.boxShadow =
                "0 0 0 1px rgba(212,175,55,0.35), 0 0 48px -8px rgba(212,175,55,0.5)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.background = "rgba(212,175,55,0.1)";
              el.style.borderColor = "rgba(212,175,55,0.4)";
              el.style.boxShadow =
                "0 0 0 1px rgba(212,175,55,0.22), 0 0 40px -12px rgba(212,175,55,0.35)";
            }}
          >
            📅 Reserve a Table
          </Link>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <span
          className="text-[10px] tracking-[0.3em] uppercase"
          style={{ fontFamily: "var(--font-sans)", color: "var(--color-ash)" }}
        >
          Scroll
        </span>
        <div
          className="w-px h-10 relative overflow-hidden"
          style={{ background: "var(--color-hairline)" }}
        >
          <div
            className="absolute top-0 left-0 w-full"
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
        .hero-headline {
          animation: heroFadeUp 900ms cubic-bezier(0.22,1,0.36,1) both;
        }
        .hero-subtitle {
          animation: heroFadeUp 900ms 140ms cubic-bezier(0.22,1,0.36,1) both;
        }
        .hero-buttons {
          animation: heroFadeUp 900ms 280ms cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </section>
  );
}
