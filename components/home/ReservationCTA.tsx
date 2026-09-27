import Link from "next/link";

type ReservationCTAProps = {
  hours: {
    monday_friday: string;
    saturday_sunday: string;
  };
};

export function ReservationCTA({ hours }: ReservationCTAProps) {
  return (
    <section
      className="relative py-[120px] overflow-hidden"
      style={{ background: "var(--color-ink)" }}
    >
      {/* Gold radial glow behind the content */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(212,175,55,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center reveal-up">
        <p
          className="eyebrow mb-5"
          style={{ color: "var(--color-ash)", fontFamily: "var(--font-sans)" }}
        >
          Reserve Your Experience
        </p>

        <h2
          className="mb-5"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 5vw, 3.25rem)",
            fontWeight: 400,
            lineHeight: 1.1,
            letterSpacing: "0.01em",
            color: "var(--color-bone)",
          }}
        >
          Book Your{" "}
          <span className="text-gold-gradient">Table Today</span>
        </h2>

        <p
          className="mb-12 text-sm tracking-wide"
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 300,
            color: "var(--color-ash)",
            opacity: 0.8,
          }}
        >
          Mon–Fri {hours.monday_friday} &nbsp;·&nbsp; Sat–Sun{" "}
          {hours.saturday_sunday}
        </p>

        {/* Button with glow halo */}
        <div className="relative inline-flex">
          <div
            className="absolute -inset-4 rounded-3xl pointer-events-none blur-xl"
            style={{ background: "rgba(212,175,55,0.08)" }}
          />
          <Link
            href="/reservation"
            className="relative inline-flex items-center gap-3 px-14 py-5 rounded-[20px] transition-all duration-300 glow-gold"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.25rem",
              fontWeight: 500,
              letterSpacing: "0.04em",
              background: "rgba(212,175,55,0.1)",
              border: "1px solid rgba(212,175,55,0.45)",
              color: "var(--color-gold)",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.background = "rgba(212,175,55,0.18)";
              el.style.borderColor = "rgba(212,175,55,0.75)";
              el.style.boxShadow =
                "0 0 0 1px rgba(212,175,55,0.4), 0 0 60px -8px rgba(212,175,55,0.55)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.background = "rgba(212,175,55,0.1)";
              el.style.borderColor = "rgba(212,175,55,0.45)";
              el.style.boxShadow =
                "0 0 0 1px rgba(212,175,55,0.22), 0 0 40px -12px rgba(212,175,55,0.35)";
            }}
          >
            📅 Reserve a Table
          </Link>
        </div>
      </div>
    </section>
  );
}
