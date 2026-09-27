import Image from "next/image";
import Link from "next/link";
import type { MenuItem } from "@/lib/getHomepageData";
import { SectionHeading } from "@/components/ui/SectionHeading";

type FeaturedDishesProps = {
  dishes: MenuItem[];
};

function clean(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function FeaturedDishes({ dishes }: FeaturedDishesProps) {
  if (dishes.length === 0) return null;

  const displayed = dishes.slice(0, 3);

  return (
    <section className="py-[120px] max-w-6xl mx-auto px-6 lg:px-12">
      <SectionHeading
        eyebrow="Our Signature Dishes"
        heading={
          <>
            Crafted for the{" "}
            <span className="text-gold-gradient">Discerning Palate</span>
          </>
        }
        center
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayed.map((dish, i) => (
          <DishCard key={dish.id} dish={dish} index={i} />
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link
          href="/menu"
          className="inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl text-sm transition-all duration-300 edge-hair"
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            letterSpacing: "0.1em",
            color: "var(--color-gold)",
            background: "rgba(212,175,55,0.05)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "rgba(212,175,55,0.1)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "rgba(212,175,55,0.05)";
          }}
        >
          View Full Menu
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </section>
  );
}

function DishCard({ dish, index }: { dish: MenuItem; index: number }) {
  return (
    <article
      className="group rounded-[20px] overflow-hidden edge-hair flex flex-col reveal-scale"
      style={{
        background: "rgba(255,255,255,0.04)",
        transitionDelay: `${index * 100}ms`,
        transition: "transform 350ms cubic-bezier(0.22,1,0.36,1), box-shadow 350ms ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.transform = "translateY(-6px)";
        el.style.boxShadow =
          "0 0 0 1px rgba(212,175,55,0.38), 0 24px 60px -16px rgba(0,0,0,0.6), 0 0 40px -12px rgba(212,175,55,0.25)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.transform = "";
        el.style.boxShadow = "";
      }}
    >
      {/* Image */}
      <div className="relative h-[240px] overflow-hidden">
        {dish.image_url ? (
          <Image
            src={dish.image_url}
            alt={clean(dish.name)}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: "var(--color-ink-raised)" }}
          />
        )}
        {/* Gradient at card bottom for blending */}
        <div
          className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(10,11,10,0.8) 0%, transparent 100%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1">
        {dish.category && (
          <p
            className="eyebrow mb-2"
            style={{ color: "var(--color-gold)", fontFamily: "var(--font-sans)", opacity: 0.8 }}
          >
            {dish.category}
          </p>
        )}
        <h3
          className="mb-2"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.375rem",
            fontWeight: 500,
            color: "var(--color-bone)",
            lineHeight: 1.2,
          }}
        >
          {clean(dish.name)}
        </h3>
        {dish.description && (
          <p
            className="mb-4 flex-1 text-sm leading-relaxed"
            style={{ fontFamily: "var(--font-sans)", color: "var(--color-ash)" }}
          >
            {dish.description}
          </p>
        )}
        <div className="flex items-center justify-between mt-auto pt-4 border-t"
          style={{ borderColor: "var(--color-hairline)" }}>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              fontSize: "1rem",
              letterSpacing: "0.03em",
              color: "var(--color-gold)",
            }}
          >
            ₹{dish.price}
          </span>
          <Link
            href="/menu"
            className="text-xs transition-colors duration-200"
            style={{ fontFamily: "var(--font-sans)", color: "var(--color-ash)" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.color = "var(--color-gold-soft)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.color = "var(--color-ash)")
            }
          >
            Order Now →
          </Link>
        </div>
      </div>
    </article>
  );
}
