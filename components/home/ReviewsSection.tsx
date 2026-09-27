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
      className="group relative flex h-full flex-col px-6 py-10 sm:px-8"
    >
      {/* Subtle top rule that blooms on hover */}
      <div
        className="absolute inset-x-0 top-0 h-px transition-colors duration-500 group-hover:bg-[var(--color-gold)]"
        style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.15), transparent)" }}
      />

      {/* Decorative quote mark */}
      <div
        aria-hidden
        className="absolute left-1/2 top-4 -translate-x-1/2 text-5xl opacity-10 transition-opacity duration-500 group-hover:opacity-20"
        style={{ fontFamily: "var(--font-display)", color: "var(--color-gold)" }}
      >
        &ldquo;
      </div>

      <div className="relative mb-8 flex justify-center gap-1.5" role="img" aria-label={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((s) => (
          <span
            key={s}
            aria-hidden
            style={{
              color: s <= rating ? "var(--color-gold)" : "rgba(244,239,228,0.06)",
              fontSize: "0.75rem",
            }}
          >
            ★
          </span>
        ))}
      </div>

      {quote ? (
        <p
          className="relative mb-10 flex-1 text-balance text-center text-[1.0625rem] italic leading-relaxed"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 300,
            color: "var(--color-ivory)",
            textShadow: "0 1px 2px rgba(0,0,0,0.4)"
          }}
        >
          {quote}
        </p>
      ) : (
        <div className="flex-1" />
      )}

      <div className="mt-auto text-center">
        {name ? (
          <>
            <p
              className="text-[0.6875rem] tracking-[0.2em] uppercase"
              style={{ fontFamily: "var(--font-sans)", color: "var(--color-gold)", opacity: 0.9, letterSpacing: "0.15em" }}
            >
              {name}
            </p>
            <p
              className="mt-2 text-xs tracking-wider"
              style={{ fontFamily: "var(--font-sans)", color: "var(--color-ivory-faint)" }}
            >
              {meta}
            </p>
          </>
        ) : (
          <p
            className="text-xs tracking-wider"
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
    <section className="veil-maroon grain relative overflow-hidden py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-12">
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
