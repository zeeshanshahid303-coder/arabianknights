import { SectionHeading } from "@/components/ui/SectionHeading";

type Review = {
  food_rating: number;
  service_rating: number;
  comment: string | null;
  created_at: string;
};

type ReviewsSectionProps = {
  reviews: Review[];
};

// Placeholder reviews shown when DB has no real reviews yet
const PLACEHOLDER_REVIEWS = [
  {
    initial: "A",
    name: "Arjun M.",
    rating: 5,
    text: "The Chicken Tikka Butter Masala was absolutely outstanding. Rich, creamy, and aromatic — exactly what authentic Mughlai flavors should taste like. Highly recommended!",
    date: "Recent Guest",
  },
  {
    initial: "P",
    name: "Priya S.",
    rating: 5,
    text: "Mutton Biryani was cooked to perfection. The fragrant basmati rice layered with tender mutton was a delight. The ambiance with the neon-lit interior adds to the experience.",
    date: "Regular Diner",
  },
  {
    initial: "R",
    name: "Rahul K.",
    rating: 4,
    text: "Great dining experience. The Zeera Rice and Paneer Butter Masala combination was delicious. Service was warm and prompt. Will definitely be back.",
    date: "Satisfied Guest",
  },
];

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 mb-3">
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
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

export function ReviewsSection({ reviews }: ReviewsSectionProps) {
  const hasRealReviews = reviews.length > 0;
  const isPlaceholder = !hasRealReviews;

  return (
    <section
      style={{ background: "var(--color-ink-raised)" }}
      className="py-[120px]"
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-12">
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

        {/* Subtle note when showing illustrative reviews */}
        {isPlaceholder && (
          <p
            className="text-center text-xs mb-10 -mt-6"
            style={{
              fontFamily: "var(--font-sans)",
              color: "var(--color-ash)",
              opacity: 0.5,
              letterSpacing: "0.04em",
            }}
          >
            Illustrative guest experiences
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isPlaceholder
            ? PLACEHOLDER_REVIEWS.map((r, i) => (
                <div
                  key={r.name}
                  className="rounded-[20px] edge-hair p-7 reveal-up flex flex-col"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    transitionDelay: `${i * 100}ms`,
                  }}
                >
                  <StarRow rating={r.rating} />
                  <p
                    className="flex-1 text-sm leading-relaxed mb-6 italic"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontWeight: 300,
                      color: "var(--color-ash)",
                    }}
                  >
                    &ldquo;{r.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t"
                    style={{ borderColor: "var(--color-hairline)" }}>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                      style={{
                        background: "rgba(212,175,55,0.15)",
                        border: "1px solid var(--color-hairline)",
                        color: "var(--color-gold)",
                        fontFamily: "var(--font-display)",
                        fontSize: "1rem",
                      }}
                    >
                      {r.initial}
                    </div>
                    <div>
                      <p
                        className="text-xs font-medium"
                        style={{ fontFamily: "var(--font-sans)", color: "var(--color-bone)" }}
                      >
                        {r.name}
                      </p>
                      <p
                        className="text-xs"
                        style={{ fontFamily: "var(--font-sans)", color: "var(--color-ash)", opacity: 0.65 }}
                      >
                        {r.date}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            : reviews.map((r, i) => {
                const avg = Math.round((r.food_rating + r.service_rating) / 2);
                return (
                  <div
                    key={i}
                    className="rounded-[20px] edge-hair p-7 reveal-up flex flex-col"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      transitionDelay: `${i * 100}ms`,
                    }}
                  >
                    <StarRow rating={avg} />
                    {r.comment && (
                      <p
                        className="flex-1 text-sm leading-relaxed mb-4 italic"
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 300,
                          color: "var(--color-ash)",
                        }}
                      >
                        &ldquo;{r.comment}&rdquo;
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-auto pt-4 border-t"
                      style={{ borderColor: "var(--color-hairline)" }}>
                      <span
                        className="text-xs"
                        style={{ fontFamily: "var(--font-sans)", color: "var(--color-ash)", opacity: 0.65 }}
                      >
                        {new Date(r.created_at).toLocaleDateString("en-IN", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
        </div>
      </div>
    </section>
  );
}
