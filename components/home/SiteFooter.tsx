import { Reveal } from "@/components/ui/Reveal";

type SiteFooterProps = {
  name: string;
  address: string;
  phone: string;
  email: string;
  socialLinks: {
    facebook?: string;
    instagram?: string;
  };
  text: string;
};

export function SiteFooter({
  name,
  address,
  phone,
  email,
  socialLinks,
  text,
}: SiteFooterProps) {
  return (
    <footer className="veil-night grain relative overflow-hidden py-10 lg:py-12">
      {/* Top graceful separator rule instead of a hard border */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.2), transparent)"
        }}
      />

      <div
        aria-hidden
        className="mashrabiya-maroon pointer-events-none absolute inset-0 h-full w-full opacity-[0.03]"
        style={{
          maskImage: "linear-gradient(to bottom, #000 0%, transparent 60%)",
          WebkitMaskImage: "linear-gradient(to bottom, #000 0%, transparent 60%)",
        }}
      />

      {/* Soft floor glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(100% 70% at 50% 100%, rgba(212,175,55,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
        <Reveal variant="up" className="flex flex-col items-center text-center">

          <div className="mb-10 flex flex-col items-center">
            {/* Monogram/Crest stand-in */}
            <div
              aria-hidden
              className="mb-8 flex size-12 items-center justify-center rounded-full border border-[var(--color-gold)] opacity-50"
              style={{
                background: "rgba(212,175,55,0.03)",
                color: "var(--color-gold)",
                fontFamily: "var(--font-display)",
                fontSize: "1.25rem"
              }}
            >
              A
            </div>

            <p
              className="text-balance"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
                fontWeight: 400,
                letterSpacing: "0.08em",
                color: "var(--color-ivory)",
                textTransform: "uppercase"
              }}
            >
              {name}
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-6 border-y border-[rgba(244,239,228,0.08)] py-12">
            {/* Address */}
            <div className="flex flex-col items-center">
              <span className="eyebrow mb-4" style={{ color: "var(--color-gold)" }}>Location</span>
              <p
                className="text-balance text-sm leading-relaxed"
                style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory-muted)", fontWeight: 300 }}
              >
                {address}
              </p>
            </div>

            {/* Reservations */}
            <div className="flex flex-col items-center">
              <span className="eyebrow mb-4" style={{ color: "var(--color-gold)" }}>Reservations</span>
              <a
                href={`tel:${phone.replace(/\s+/g, "")}`}
                className="group relative mb-2 text-sm transition-colors duration-300 hover:text-[var(--color-ivory)]"
                style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory-muted)", fontWeight: 300 }}
              >
                {phone}
                <span className="absolute -bottom-1 left-1/2 h-[1px] w-0 -translate-x-1/2 bg-[var(--color-gold)] transition-all duration-300 group-hover:w-full" />
              </a>
              <a
                href={`mailto:${email}`}
                className="group relative text-sm transition-colors duration-300 hover:text-[var(--color-ivory)]"
                style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory-muted)", fontWeight: 300 }}
              >
                {email}
                <span className="absolute -bottom-1 left-1/2 h-[1px] w-0 -translate-x-1/2 bg-[var(--color-gold)] transition-all duration-300 group-hover:w-full" />
              </a>
            </div>

            {/* Social */}
            <div className="flex flex-col items-center">
              <span className="eyebrow mb-4" style={{ color: "var(--color-gold)" }}>Follow Us</span>
              <div className="flex flex-col items-center gap-3">
                {socialLinks.instagram && (
                  <a
                    href={socialLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative text-sm tracking-widest uppercase transition-colors duration-300 hover:text-[var(--color-ivory)]"
                    style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory-muted)" }}
                  >
                    Instagram
                    <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-[var(--color-gold)] transition-all duration-300 group-hover:w-full" />
                  </a>
                )}
                {socialLinks.facebook && (
                  <a
                    href={socialLinks.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative text-sm tracking-widest uppercase transition-colors duration-300 hover:text-[var(--color-ivory)]"
                    style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory-muted)" }}
                  >
                    Facebook
                    <span className="absolute -bottom-1 left-0 h-[1px] w-0 bg-[var(--color-gold)] transition-all duration-300 group-hover:w-full" />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="mt-12">
            <p
              className="text-[0.6875rem] tracking-wider"
              style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory-faint)" }}
            >
              {text}
            </p>
          </div>
        </Reveal>
      </div>
    </footer>
  );
}
