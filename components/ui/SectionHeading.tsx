// Reusable section heading block: eyebrow label + large Cormorant heading

type SectionHeadingProps = {
  eyebrow: string;
  heading: React.ReactNode;
  className?: string;
  center?: boolean;
};

export function SectionHeading({
  eyebrow,
  heading,
  className = "",
  center = false,
}: SectionHeadingProps) {
  const align = center ? "text-center" : "";
  return (
    <div className={`mb-12 ${align} ${className}`}>
      <p
        className="eyebrow mb-4"
        style={{ color: "var(--color-ash)", fontFamily: "var(--font-sans)" }}
      >
        {eyebrow}
      </p>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          color: "var(--color-bone)",
          fontSize: "clamp(1.85rem, 4vw, 3rem)",
          fontWeight: 400,
          lineHeight: 1.1,
          letterSpacing: "0.01em",
        }}
      >
        {heading}
      </h2>
    </div>
  );
}
