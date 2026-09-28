const fs = require('fs');
const file = 'components/home/ReviewsSection.tsx';
let code = fs.readFileSync(file, 'utf8');

const newCard = `function ReviewCard({
  rating,
  quote,
  initials,
  name,
  meta,
  delay,
}: {
  rating: number;
  quote: string;
  initials?: string;
  name?: string;
  meta: string;
  delay: number;
}) {
  return (
    <Reveal
      delay={delay}
      variant="up"
      className="group relative flex h-full flex-col px-6 py-10 sm:px-8 sm:py-12 rounded-[2px] transition-all duration-700 hover:-translate-y-1"
      style={{
        background: "linear-gradient(135deg, rgba(244,239,228,0.035) 0%, rgba(244,239,228,0.005) 100%)",
        border: "1px solid rgba(212,175,55,0.08)",
        backdropFilter: "blur(12px)",
        boxShadow: "inset 0 1px 0 rgba(244,239,228,0.04), 0 20px 40px -10px rgba(0,0,0,0.5)",
      }}
    >
      {/* Decorative quote mark */}
      <div
        aria-hidden
        className="mb-5 flex justify-center text-4xl leading-none transition-transform duration-700 group-hover:scale-110"
        style={{ fontFamily: "var(--font-display)", color: "rgba(212,175,55,0.4)" }}
      >
        &ldquo;
      </div>

      <div className="relative mb-6 flex justify-center gap-1.5" role="img" aria-label={\`\${rating} out of 5 stars\`}>
        {[1, 2, 3, 4, 5].map((s) => (
          <span
            key={s}
            aria-hidden
            className="transition-colors duration-500"
            style={{
              color: s <= rating ? "var(--color-gold)" : "rgba(244,239,228,0.06)",
              fontSize: "0.8125rem",
              textShadow: s <= rating ? "0 0 8px rgba(212,175,55,0.2)" : "none",
            }}
          >
            ★
          </span>
        ))}
      </div>

      {quote ? (
        <p
          className="relative mb-10 flex-1 text-balance text-center text-[1.125rem] italic leading-[1.8] sm:text-[1.1875rem]"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 300,
            color: "var(--color-ivory)",
          }}
        >
          {quote}
        </p>
      ) : (
        <div className="flex-1" />
      )}

      {/* Elegant separator */}
      <div className="mx-auto mb-7 flex items-center justify-center gap-3 opacity-60">
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-[var(--color-gold)]" />
        <span className="shrink-0 text-[0.45rem] text-[var(--color-gold)]">❖</span>
        <span className="h-px w-8 bg-gradient-to-l from-transparent to-[var(--color-gold)]" />
      </div>

      <div className="mt-auto text-center">
        {name ? (
          <>
            <p
              className="text-xs font-semibold tracking-[0.2em] uppercase transition-colors duration-500 group-hover:text-[var(--color-gold)]"
              style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory)" }}
            >
              {name}
            </p>
            <p
              className="mt-2.5 text-[0.625rem] tracking-[0.15em] uppercase"
              style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory-faint)" }}
            >
              {meta}
            </p>
          </>
        ) : (
          <p
            className="text-[0.625rem] tracking-[0.15em] uppercase"
            style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory-faint)" }}
          >
            {meta}
          </p>
        )}
      </div>
    </Reveal>
  );
}`;

let start = code.indexOf('function ReviewCard(');
let end = code.indexOf('export function ReviewsSection');

if (start > -1 && end > -1) {
  code = code.substring(0, start) + newCard + '\n\n' + code.substring(end);
  fs.writeFileSync(file, code);
  console.log('Patched ReviewsSection');
} else {
  console.log('Failed to find bounds');
}
