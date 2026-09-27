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

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="mb-3 flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          aria-hidden
          style={{
            color: s <= rating ? "var(--color-gold)" : "var(--color-hairline-strong)",
            fontSize: "0.875rem",
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

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
      className="edge-hair flex h-full flex-col rounded-[20px] p-7"
      style={{ background: "rgba(255,255,255,0.04)" }}
    >
      <StarRow rating={rating} />

      {quote ? (
        <p
          className="mb-6 flex-1 text-pretty text-sm italic leading-relaxed"
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 300,
            color: "var(--color-ash)",
          }}
        >
          &ldquo;{quote}&rdquo;
        </p>
      ) : (
        <div className="flex-1" />
      )}

      <div
        className="mt-auto flex items-center gap-3 border-t pt-4"
        style={{ borderColor: "var(--color-hairline)" }}
      >
        {initials && name ? (
          <>
            <div
              className="flex size-8 flex-none items-center justify-center text-xs font-medium"
              style={{
                background: "rgba(212,175,55,0.15)",
                border: "1px solid var(--color-hairline)",
                borderRadius: "9999px",
                color: "var(--color-gold)",
                fontFamily: "var(--font-display)",
                fontSize: "1rem",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p
                className="truncate text-xs font-medium"
                style={{ fontFamily: "var(--font-sans)", color: "var(--color-bone)" }}
              >
                {name}
              </p>
              <p
                className="truncate text-xs"
                style={{ fontFamily: "var(--font-sans)", color: "var(--color-ash)", opacity: 0.65 }}
              >
                {meta}
              </p>
            </div>
          </>
        ) : (
          <p
            className="truncate text-xs"
            style={{ fontFamily: "var(--font-sans)", color: "var(--color-ash)", opacity: 0.65 }}
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
    <section
      className="py-20 lg:py-28"
      style={{ background: "var(--color-ink-raised)" }}
    >
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
              color: "var(--color-ash)",
              opacity: 0.5,
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
