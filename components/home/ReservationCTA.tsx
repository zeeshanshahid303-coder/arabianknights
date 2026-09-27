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
    <section className="grain relative flex min-h-[80vh] items-center justify-center overflow-hidden py-24 lg:py-32">
      {/* Base ambience - deeper than the rest of the site to make the CTA glow */}
      <div className="absolute inset-0 bg-[#040206]" aria-hidden />

      {/* Ambient background photo */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=2000&auto=format&fit=crop')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.25,
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 80%)",
        }}
      />

      {/* Rich overlay - maroon pooling low, emerald at the shoulders */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(212,175,55,0.12) 0%, transparent 70%), \
             radial-gradient(ellipse 80% 60% at 90% 90%, rgba(77,17,24,0.4) 0%, transparent 60%), \
             radial-gradient(ellipse 80% 60% at 10% 90%, rgba(18,70,58,0.4) 0%, transparent 60%)",
        }}
      />

      <div
        aria-hidden
        className="mashrabiya-gold pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
        style={{
          maskImage:
            "radial-gradient(60% 60% at 50% 50%, #000 0%, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(60% 60% at 50% 50%, #000 0%, transparent 78%)",
        }}
      />

      {/* Frame / Mihrab lines conveying a doorway/invitation */}
      <div className="absolute inset-6 pointer-events-none border border-[var(--color-gold)] opacity-10 sm:inset-10" />

      <Reveal className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <p
          className="mb-8 tracking-[0.3em] uppercase text-[0.6875rem]"
          style={{ color: "var(--color-gold)", fontFamily: "var(--font-sans)", opacity: 0.9 }}
        >
          Reserve Your Experience
        </p>

        <h2
          className="mb-8 text-balance"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.5rem, 6vw, 4rem)",
            fontWeight: 400,
            lineHeight: 1.05,
            letterSpacing: "0.02em",
            color: "var(--color-ivory)",
            textShadow: "0 4px 24px rgba(0,0,0,0.8)"
          }}
        >
          A Table <span className="text-gold-gradient font-medium italic pr-2">Awaits</span>
        </h2>

        <div className="mx-auto mb-10 w-px h-16 bg-[var(--color-gold)] opacity-30" aria-hidden />

        <div className="mb-12 space-y-2">
          <p
            className="text-[0.8125rem] tracking-[0.15em] uppercase"
            style={{
              fontFamily: "var(--font-sans)",
              color: "var(--color-ivory-faint)",
            }}
          >
            Opening Hours
          </p>
          <p
            className="text-[0.9375rem] tracking-wide"
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 300,
              color: "var(--color-ivory-muted)",
            }}
          >
            Mon–Fri <span className="text-[var(--color-ivory)]">{hours.monday_friday}</span> &nbsp;<span className="text-[var(--color-gold)] opacity-40">|</span>&nbsp; Sat–Sun <span className="text-[var(--color-ivory)]">{hours.saturday_sunday}</span>
          </p>
        </div>

        {/* Button with glow halo */}
        <div className="relative inline-flex w-full justify-center sm:w-auto">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -mx-6 -my-4 rounded-full blur-2xl transition-opacity duration-500"
            style={{ background: "rgba(212,175,55,0.25)" }}
          />
          <GoldButton
            href="/reservation"
            variant="solid"
            size="lg"
            className="w-full sm:w-auto !px-12 !py-5 !text-[0.8125rem]"
          >
            Reserve a Table
          </GoldButton>
        </div>

        {/* Phone escape hatch for guests who'd rather call */}
        <p
          className="mt-12 text-sm"
          style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory-faint)" }}
        >
          Prefer to call?{" "}
          <a
            href={`tel:${phone.replace(/\s+/g, "")}`}
            className="transition-colors duration-200 hover:text-[var(--color-gold)]"
            style={{ color: "var(--color-gold-soft)" }}
          >
            {phone}
          </a>
        </p>
      </Reveal>
    </section>
  );
}
