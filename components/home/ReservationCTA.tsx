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
    <section
      className="relative overflow-hidden py-20 lg:py-28 grain"
      style={{ background: "var(--color-ink)" }}
    >
      {/* Gold radial glow behind the content */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(212,175,55,0.07) 0%, transparent 70%)",
        }}
      />

      <Reveal className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <p
          className="eyebrow mb-5"
          style={{ color: "var(--color-ash)", fontFamily: "var(--font-sans)" }}
        >
          Reserve Your Experience
        </p>

        <h2
          className="mb-5 text-balance"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 5vw, 3.25rem)",
            fontWeight: 400,
            lineHeight: 1.1,
            letterSpacing: "0.01em",
            color: "var(--color-bone)",
          }}
        >
          Book Your <span className="text-gold-gradient">Table Today</span>
        </h2>

        <p
          className="mb-10 text-sm tracking-wide"
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 300,
            color: "var(--color-ash)",
            opacity: 0.8,
          }}
        >
          Mon–Fri {hours.monday_friday} &nbsp;·&nbsp; Sat–Sun {hours.saturday_sunday}
        </p>

        {/* Button with glow halo */}
        <div className="relative inline-flex w-full justify-center sm:w-auto">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-4 rounded-3xl blur-xl"
            style={{ background: "rgba(212,175,55,0.08)" }}
          />
          <GoldButton
            href="/reservation"
            icon="📅"
            variant="solid"
            size="lg"
            className="w-full sm:w-auto"
          >
            Reserve a Table
          </GoldButton>
        </div>

        {/* Phone escape hatch for guests who'd rather call */}
        <p
          className="mt-8 text-sm"
          style={{ fontFamily: "var(--font-sans)", color: "var(--color-ash)", opacity: 0.7 }}
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
