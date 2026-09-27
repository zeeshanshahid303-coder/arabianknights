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
    <footer
      className="grain relative overflow-hidden border-t py-14"
      style={{ borderColor: "var(--color-hairline)" }}
    >
      <div
        aria-hidden
        className="mashrabiya-maroon pointer-events-none absolute inset-0 h-full w-full opacity-[0.05]"
        style={{
          maskImage: "linear-gradient(to bottom, #000 0%, transparent 70%)",
          WebkitMaskImage: "linear-gradient(to bottom, #000 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, rgba(77,17,24,0.4) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 text-center lg:px-12">
        <div>
          <p
            className="text-gold-gradient"
            style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 500 }}
          >
            {name}
          </p>
          <div className="rule-gold mx-auto mt-4 w-16" />
        </div>

        <div className="flex flex-col items-center gap-2 text-sm">
          <p style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory-muted)" }}>{address}</p>
          <p style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory-muted)" }}>
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className="transition-colors duration-200 hover:text-[var(--color-gold)]"
            >
              {phone}
            </a>
            {" · "}
            <a
              href={`mailto:${email}`}
              className="transition-colors duration-200 hover:text-[var(--color-gold)]"
            >
              {email}
            </a>
          </p>
        </div>

        {socialLinks.facebook || socialLinks.instagram ? (
          <div className="flex items-center gap-4">
            {socialLinks.facebook ? (
              <a
                href={socialLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs uppercase tracking-widest transition-colors duration-200 hover:text-[var(--color-gold)]"
                style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory-faint)" }}
              >
                Facebook
              </a>
            ) : null}
            {socialLinks.instagram ? (
              <a
                href={socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs uppercase tracking-widest transition-colors duration-200 hover:text-[var(--color-gold)]"
                style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory-faint)" }}
              >
                Instagram
              </a>
            ) : null}
          </div>
        ) : null}

        <p
          className="text-xs"
          style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory-faint)" }}
        >
          {text}
        </p>
      </div>
    </footer>
  );
}
