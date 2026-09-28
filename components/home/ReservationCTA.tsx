import { GoldButton } from "@/components/ui/GoldButton";
import { Reveal } from "@/components/ui/Reveal";

type ReservationCTAProps = {
  hours: {
    monday_friday: string;
    saturday_sunday: string;
  };
  phone: string;
};

export function ReservationCTA({ hours, phone }: ReservationCTAProps) {
  return (
    <section className="grain relative flex items-center justify-center overflow-hidden py-20 lg:py-28">
      {/* Base ambience - deeper than the rest of the site to make the CTA glow */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 100% 100% at 50% 0%, #060309 0%, #020104 100%)"
        }}
        aria-hidden
      />

      {/* Ambient background photo */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=2000&auto=format&fit=crop')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.15,
          maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 0%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 0%, transparent 100%)",
        }}
      />

      {/* Rich overlay emphasizing the center focal point */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(212,175,55,0.08) 0%, transparent 100%),              radial-gradient(ellipse 60% 60% at 50% 100%, rgba(77,17,24,0.2) 0%, transparent 100%)",
        }}
      />

      {/* Subtle texture */}
      <div
        aria-hidden
        className="mashrabiya-gold pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]"
        style={{
          maskImage: "radial-gradient(50% 50% at 50% 50%, #000 0%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(50% 50% at 50% 50%, #000 0%, transparent 100%)",
        }}
      />

      <Reveal className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center px-6 text-center">
        {/* Invitation Eyebrow */}
        <div className="mb-6 flex items-center justify-center gap-4">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-[var(--color-gold)] opacity-50" aria-hidden />
          <span
            className="tracking-[0.25em] uppercase text-[0.625rem] font-medium"
            style={{ color: "var(--color-gold)", fontFamily: "var(--font-sans)" }}
          >
            An Invitation
          </span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-[var(--color-gold)] opacity-50" aria-hidden />
        </div>

        {/* Climax Title */}
        <h2
          className="mb-6 text-balance"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(3rem, 7vw, 5.5rem)",
            fontWeight: 400,
            lineHeight: 1.05,
            color: "var(--color-ivory)",
            textShadow: "0 4px 32px rgba(0,0,0,0.6)"
          }}
        >
          A Table <span className="text-gold-gradient italic pr-2">Awaits</span>
        </h2>

        {/* Emotional Subtitle */}
        <p
          className="mx-auto mb-12 max-w-xl text-balance leading-relaxed"
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 300,
            fontSize: "1.125rem",
            color: "var(--color-ivory-faint)",
          }}
        >
          Join us for an unforgettable evening of culinary excellence, steeped in royal Mughlai heritage and Arabian warmth.
        </p>

        {/* Focal point CTA */}
        <div className="relative mb-16 inline-flex w-full justify-center sm:w-auto">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -mx-4 -my-4 rounded-full blur-2xl transition-opacity duration-700"
            style={{ background: "rgba(212,175,55,0.15)" }}
          />
          <GoldButton
            href="/reservation"
            variant="solid"
            size="lg"
            className="w-full sm:w-auto hover:scale-[1.02] transition-transform duration-500 !px-14 !py-5 !text-[0.875rem] !tracking-[0.2em]"
          >
            Reserve Your Experience
          </GoldButton>
        </div>

        {/* Utility / Footer of the CTA */}
        <div className="flex w-full flex-col items-center pt-10 border-t border-[rgba(212,175,55,0.1)] gap-6">
          <div className="flex flex-col items-center gap-2">
            <span
              className="uppercase tracking-[0.2em] text-[0.625rem]"
              style={{ color: "var(--color-gold)", fontFamily: "var(--font-sans)" }}
            >
              Service Hours
            </span>
            <p
              className="text-[0.75rem] tracking-widest uppercase"
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 300,
                color: "var(--color-ivory-muted)",
              }}
            >
              Mon–Fri <span className="text-[var(--color-ivory)]">{hours.monday_friday}</span>
              <span className="mx-3 opacity-30 text-[var(--color-gold)]">❖</span>
              Sat–Sun <span className="text-[var(--color-ivory)]">{hours.saturday_sunday}</span>
            </p>
          </div>

          <p
            className="text-[0.6875rem] tracking-widest uppercase"
            style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory-faint)" }}
          >
            Personal Assistance:{" "}
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className="transition-colors duration-300 hover:text-[var(--color-gold)]"
              style={{ color: "var(--color-gold-soft)" }}
            >
              {phone}
            </a>
          </p>
        </div>
      </Reveal>
    </section>
  );
}