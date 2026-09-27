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
      className="border-t py-12"
      style={{ borderColor: "var(--color-hairline)", background: "var(--color-ink)" }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 text-center lg:px-12">
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
          <p style={{ fontFamily: "var(--font-sans)", color: "var(--color-ash)" }}>{address}</p>
          <p style={{ fontFamily: "var(--font-sans)", color: "var(--color-ash)" }}>
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
                style={{ fontFamily: "var(--font-sans)", color: "var(--color-ash)" }}
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
                style={{ fontFamily: "var(--font-sans)", color: "var(--color-ash)" }}
              >
                Instagram
              </a>
            ) : null}
          </div>
        ) : null}

        <p
          className="text-xs"
          style={{ fontFamily: "var(--font-sans)", color: "var(--color-ash)", opacity: 0.5 }}
        >
          {text}
        </p>
      </div>
    </footer>
  );
}
