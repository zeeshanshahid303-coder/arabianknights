"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { GoldDust } from "@/components/home/GoldDust";

type HeroSectionProps = {
  title: string;
  subtitle: string;
  isOpen: boolean;
  /** Appended after the gold-gradient phrase in the headline. */
  headlineLead: string;
  headlineAccent: string;
};

/** Drifting orbs of bounced light. Each one a different wash of the
    room, breathing on its own long cycle. */
const ORBS = [
  {
    top: "2%",
    left: "8%",
    width: "46vw",
    height: "46vw",
    background:
      "radial-gradient(circle, rgba(212,175,55,0.30) 0%, rgba(212,175,55,0.07) 45%, transparent 70%)",
    duration: "24s",
  },
  {
    top: "46%",
    left: "62%",
    width: "52vw",
    height: "52vw",
    background:
      "radial-gradient(circle, rgba(77,17,24,0.72) 0%, rgba(107,26,34,0.28) 46%, transparent 72%)",
    duration: "31s",
    delay: "-8s",
  },
  {
    top: "66%",
    left: "-6%",
    width: "48vw",
    height: "48vw",
    background:
      "radial-gradient(circle, rgba(18,70,58,0.62) 0%, rgba(11,45,36,0.26) 48%, transparent 74%)",
    duration: "37s",
    delay: "-15s",
  },
  {
    top: "18%",
    left: "58%",
    width: "26vw",
    height: "26vw",
    background:
      "radial-gradient(circle, rgba(212,175,55,0.22) 0%, transparent 66%)",
    duration: "19s",
    delay: "-4s",
  },
];

export function HeroSection({
  title,
  subtitle,
  isOpen,
  headlineLead,
  headlineAccent,
}: HeroSectionProps) {
  const depthRef = useRef<HTMLDivElement>(null);

  // Parallax. The lattice and the glow drift against the copy at
  // different rates, which is what turns a flat background into a room
  // with a back wall. Skipped where the user has asked for reduced motion.
  useEffect(() => {
    const el = depthRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        // The back wall lags; the lattice in front of it lags less.
        el.style.setProperty("--drift-back", `${y * 0.16}px`);
        el.style.setProperty("--drift-front", `${y * 0.34}px`);
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
      ref={depthRef}
      className="hero grain relative flex min-h-[100dvh] items-center justify-center overflow-hidden"
    >
      {/* ==========================================================
          The room, in layers, back to front.
          ========================================================== */}

      {/* 1 · Base atmosphere — maroon and emerald in the dark air. */}
      <div aria-hidden className="veil-night hero-lights absolute inset-0" />

      {/* 1.5 · Photography backdrop. Deep luxurious ambient interior blended into the dark air. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1542314831-c6a420b9df4b?q=80&w=2000&auto=format&fit=crop')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.25,
          maskImage: "linear-gradient(to bottom, black 0%, transparent 60%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 60%)"
        }}
      />

      {/* 2 · Back wall. The far side of the room: emerald, barely lit,
             with the coarsest lattice ghosted across it. */}
      <div
        aria-hidden
        className="absolute inset-0 overflow-hidden"
        style={{ transform: "translateY(calc(var(--drift-back, 0px) * -0.12))" }}
      >
        <div className="mashrabiya-maroon absolute inset-0 h-full w-full opacity-10" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 120%, rgba(11,45,36,0.65) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* 3 · The lamp. A warm pool of light high in the room — the
             single brightest thing in the composition, and the source
             the lattice below appears to be lit by. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[80vh]"
        style={{
          background:
            "radial-gradient(55% 55% at 50% -5%, rgba(232,204,114,0.38) 0%, rgba(212,175,55,0.18) 40%, transparent 80%)",
        }}
      />

      {/* 4 · Light through the screen. The gold lattice, sitting
             directly over the lamp pool so it reads as the shadow a
             pierced screen casts — not as a printed pattern. */}
      <div
        aria-hidden
        className="absolute inset-0 overflow-hidden"
        style={{ transform: "translateY(calc(var(--drift-front, 0px) * -0.1))" }}
      >
        <div
          className="mashrabiya-gold absolute inset-0 h-full w-full opacity-30"
          style={{
            // Masked so the lattice is dense under the lamp and
            // dissolves toward the edges of the room.
            maskImage:
              "radial-gradient(60% 50% at 50% 15%, #000 0%, rgba(0,0,0,0.4) 60%, transparent 90%)",
            WebkitMaskImage:
              "radial-gradient(60% 50% at 50% 15%, #000 0%, rgba(0,0,0,0.4) 60%, transparent 90%)",
          }}
        />
      </div>

      {/* 5 · Drifting orbs. */}
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        {ORBS.map((orb, i) => (
          <div
            key={i}
            className="orb"
            style={{
              top: orb.top,
              left: orb.left,
              width: orb.width,
              height: orb.height,
              background: orb.background,
              animation: `orb-drift ${orb.duration} ease-in-out infinite`,
              animationDelay: orb.delay,
            }}
          />
        ))}
      </div>

      {/* 6 · Gold dust. */}
      <GoldDust />

      {/* 6b · Reading scrim. The orbs drift across the centre of the
            frame; this settles them back down so the copy over them
            holds a comfortable contrast. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(48% 34% at 50% 52%, rgba(7,4,10,0.58) 0%, transparent 78%)",
        }}
      />

      {/* 7 · Mihrab. A hairline pointed arch framing the copy, the way
             a niche frames a lamp in the back wall of the room. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-24 bottom-16 mx-auto max-w-3xl sm:inset-x-10"
      >
        <svg
          className="h-full w-full"
          viewBox="0 0 600 800"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M300 4 C 300 4, 560 210, 560 340 L 560 796 L 40 796 L 40 340 C 40 210, 300 4, 300 4 Z"
            stroke="url(#arch)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <defs>
            <linearGradient id="arch" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8cc72" stopOpacity="0.34" />
              <stop offset="45%" stopColor="#d4af37" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#d4af37" stopOpacity="0.03" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* 8 · Vignette. Pulls the eye to the centre and sinks the
             corners, so the page below the fold starts already in shadow. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(78% 62% at 50% 42%, transparent 0%, rgba(4,2,6,0.55) 78%, rgba(4,2,6,0.9) 100%)",
        }}
      />

      {/* ==========================================================
          Copy
          ========================================================== */}
      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center px-6 pt-24 text-center sm:pt-28">
        <div className="hero-logo-slot mb-10 flex shrink-0 items-center justify-center">
          <Image
            src="/logo.png"
            alt="Arabian Knights Logo"
            className="hero-logo-mark"
            width={160}
            height={160}
            priority
          />
        </div>

        {/* Status */}
        <div
          className="hero-status mb-7 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-full px-4 py-1.5 text-[0.6875rem] uppercase tracking-[0.22em]"
          style={{
            background: "rgba(244,239,228,0.045)",
            border: "1px solid var(--color-hairline)",
            backdropFilter: "blur(10px)",
            color: "var(--color-ivory-muted)",
            boxShadow: "inset 0 1px 0 rgba(244,239,228,0.08)",
          }}
        >
          <span
            className="size-1.5 flex-none rounded-full"
            style={{
              background: isOpen ? "#4ade80" : "#ef4444",
              boxShadow: isOpen ? "0 0 8px 2px rgba(74,222,128,0.45)" : "none",
            }}
          />
          <span>{isOpen ? "Open Now" : "Currently Closed"}</span>
          <span aria-hidden style={{ color: "var(--color-hairline-strong)" }}>
            ·
          </span>
          <span>Mughlai &amp; Indian Cuisine</span>
        </div>

        {/* Headline. The gold phrase carries the gradient and a soft
            bloom, so the type itself appears lit. */}
        <h1
          className="hero-headline"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 400,
            lineHeight: 1.05,
            letterSpacing: "0.01em",
            fontSize: "clamp(2.75rem, 8vw, 5.5rem)",
            color: "var(--color-ivory)",
            textShadow: "0 0 60px rgba(212,175,55,0.15)",
          }}
        >
          {headlineLead}
          <br className="mb-2 block sm:hidden" />
          <span className="hidden sm:inline">{" "}</span>
          <span
            className="text-gold-gradient block sm:inline"
            style={{ textShadow: "0 2px 24px rgba(212,175,55,0.3)" }}
          >
            {headlineAccent}
          </span>
        </h1>

        {/* Screen-reader-only full title, so the h1 still reads as one title */}
        <span className="sr-only">{title}</span>

        <div className="ornament hero-rule mx-auto my-8 h-px w-24" aria-hidden />

        <p
          className="hero-subtitle mb-12 max-w-xl text-pretty text-[0.9375rem] leading-[1.8] sm:text-[1.0625rem]"
          style={{
            color: "var(--color-ivory)",
            opacity: 0.8,
            letterSpacing: "0.01em",
            fontFamily: "var(--font-sans)",
            fontWeight: 300,
          }}
        >
          {subtitle}
        </p>

        {/* Actions. Reserve leads; the two order modes are its glass
            counterparts. */}
        <div className="hero-buttons flex w-full max-w-2xl flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:gap-4">
          <a
            href="/reservation"
            className="btn-gold inline-flex items-center justify-center gap-3 rounded-full px-10 py-4 sm:py-5 text-[0.9375rem] font-semibold tracking-[0.12em] shadow-[0_0_30px_rgba(212,175,55,0.2)]"
          >
            <span className="btn-icon">
              <svg
                width="17"
                height="17"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
              >
                <rect x="2.8" y="4" width="14.4" height="13.2" rx="1.8" />
                <path d="M2.8 8.2h14.4M6.6 2.6v2.8M13.4 2.6v2.8" strokeLinecap="round" />
                <path
                  d="M6.6 11.4h1.6M10 11.4h1.6M6.6 14.2h1.6M10 14.2h1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="btn-label">Reserve a Table</span>
          </a>

          <a
            href="/menu?mode=takeaway"
            className="btn-glass inline-flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-[0.8125rem] font-medium tracking-[0.1em]"
          >
            <span className="btn-icon">
              <svg
                width="15"
                height="15"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              >
                <path
                  d="M4 7.5h12l-1.1 8.2a1.6 1.6 0 0 1-1.6 1.3H6.7a1.6 1.6 0 0 1-1.6-1.3L4 7.5Z"
                  strokeLinejoin="round"
                />
                <path d="M7.5 7.5V6a2.5 2.5 0 0 1 5 0v1.5" strokeLinecap="round" />
              </svg>
            </span>
            <span className="btn-label">Takeaway</span>
          </a>

          <a
            href="/menu?mode=delivery"
            className="btn-glass inline-flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-[0.8125rem] font-medium tracking-[0.1em]"
          >
            <span className="btn-icon">
              <svg
                width="15"
                height="15"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              >
                <path
                  d="M2.5 6.5 10 2.8l7.5 3.7v7L10 17.2 2.5 13.5v-7Z"
                  strokeLinejoin="round"
                />
                <path d="M2.5 6.5 10 10.2l7.5-3.7M10 10.2v7" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="btn-label">Delivery</span>
          </a>
        </div>
      </div>

      {/* Scroll cue */}
      <div
        className="hero-cue pointer-events-none absolute bottom-9 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 opacity-60"
        aria-hidden
      >
        <div
          className="relative h-12 w-px overflow-hidden"
          style={{ background: "var(--color-hairline)" }}
        >
          <div
            className="absolute inset-x-0 top-0 h-5"
            style={{
              background: "linear-gradient(to bottom, transparent, var(--color-gold))",
              animation: "scrollLine 2.6s cubic-bezier(0.65,0,0.35,1) infinite",
            }}
          />
        </div>
      </div>
    </section>
  );
}
