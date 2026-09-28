import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import type { Review } from "@/lib/getHomepageData";

type ReviewsSectionProps = {
  reviews: Review[];
};

/**
 * Shown when the restaurant has no public feedback yet. They are clearly
 * labelled as illustrative below, so they never read as real quotes.
 */
const PLACEHOLDER_REVIEWS = [
  {
    initial: "A",
    name: "Arjun M.",
    rating: 5,
    text: "The Chicken Tikka Butter Masala was absolutely outstanding. Rich, creamy, and aromatic — exactly what authentic Mughlai flavours should taste like. Highly recommended!",
    date: "Recent Guest",
  },
  {
    initial: "P",
    name: "Priya S.",
    rating: 5,
    text: "Mutton Biryani was cooked to perfection. The fragrant basmati rice layered with tender mutton was a delight, and the warm lighting made it a proper dinner out.",
    date: "Regular Diner",
  },
  {
    initial: "R",
    name: "Rahul K.",
    rating: 4,
    text: "A great dining experience. The Zeera Rice and Paneer Butter Masala combination was delicious, and the service was prompt without hovering. Will definitely be back.",
    date: "Satisfied Guest",
  },
];

function ReviewCard({
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

      <div className="relative mb-6 flex justify-center gap-1.5" role="img" aria-label={`${rating} out of 5 stars`}>
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
}

export function ReviewsSection({ reviews }: ReviewsSectionProps) {
  const isPlaceholder = reviews.length === 0;

  const cards = isPlaceholder
    ? PLACEHOLDER_REVIEWS.map((r) => ({
        key: r.name,
        rating: r.rating,
        quote: r.text,
        initials: r.initial,
        name: r.name,
        meta: r.date,
      }))
    : reviews.map((r) => ({
        key: r.id,
        rating: Math.round((r.food_rating + r.service_rating) / 2),
        quote: r.comment ?? "",
        initials: undefined,
        name: undefined,
        // Formatted on the server, where the locale is fixed. Doing this in
        // the browser would risk a server/client locale mismatch.
        meta: new Date(r.created_at).toLocaleDateString("en-IN", {
          month: "long",
          year: "numeric",
        }),
      }));

  return (
    <section className="grain relative overflow-hidden py-10 lg:py-12">
      {/* Background layer connecting from WhyChooseUs into this section */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(100% 100% at 50% 0%, rgba(77,17,24,0.15) 0%, transparent 80%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
        <SectionHeading
          eyebrow="What Our Guests Say"
          heading={
            <>
              Stories of an{" "}
              <span className="text-gold-gradient">Unforgettable Meal</span>
            </>
          }
          center
        />

        {isPlaceholder ? (
          <p
            className="-mt-6 mb-10 text-center text-xs"
            style={{
              fontFamily: "var(--font-sans)",
              color: "var(--color-ivory-faint)",
              letterSpacing: "0.04em",
            }}
          >
            Illustrative guest experiences — reviews from our guests will appear here
          </p>
        ) : null}

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-4 lg:gap-8">
          {cards.map((c, i) => (
            <ReviewCard
              key={c.key}
              rating={c.rating}
              quote={c.quote}
              initials={c.initials}
              name={c.name}
              meta={c.meta}
              delay={i * 100}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
