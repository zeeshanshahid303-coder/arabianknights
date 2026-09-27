import Image from "next/image";
import Link from "next/link";
import type { MenuItem } from "@/lib/getHomepageData";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GoldButton } from "@/components/ui/GoldButton";
import { Reveal } from "@/components/ui/Reveal";

type FeaturedDishesProps = {
  dishes: MenuItem[];
};

const DISPLAY_LIMIT = 6;

function clean(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function FeaturedDishes({ dishes }: FeaturedDishesProps) {
  if (dishes.length === 0) return null;

  const displayed = dishes.slice(0, DISPLAY_LIMIT);

  return (
    <section className="veil-emerald grain relative overflow-hidden py-20 lg:py-28">
      {/* The section itself is full-bleed so the background reaches the
          edges of the viewport; the content is centred inside it. */}
      <div className="relative mx-auto max-w-6xl px-6 lg:px-12">
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

        {/* 1 / 2 / 3 columns; 6 dishes fill the last row exactly at 3-up */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((dish, i) => (
            <Reveal key={dish.id} variant="scale" delay={i * 90} as="article" className="h-full">
              <DishCard dish={dish} />
            </Reveal>
          ))}
        </div>

        <div className="mt-14 flex justify-center">
          <GoldButton href="/menu" className="w-full sm:w-auto">
            View Full Menu
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="shrink-0"
            >
              <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </GoldButton>
        </div>
      </div>
    </section>
  );
}

function DishCard({ dish }: { dish: MenuItem }) {
  const name = clean(dish.name);

  return (
    <article className="group relative flex h-[380px] w-full flex-col overflow-hidden sm:h-[460px]">
      {/* Background Image full bleed */}
      <div className="absolute inset-0 z-0 bg-[#07040a]">
        {dish.image_url ? (
          <Image
            src={dish.image_url}
            alt={name}
            fill
            className="object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-[1.08]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "radial-gradient(120% 100% at 50% 0%, rgba(212,175,55,0.16) 0%, var(--color-night-raised) 70%)",
            }}
          >
            <span
              aria-hidden
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl opacity-10"
              style={{ fontFamily: "var(--font-display)", color: "var(--color-gold)" }}
            >
              ✦
            </span>
          </div>
        )}
      </div>

      {/* Cinematic Overlays */}
      <div
        className="absolute inset-0 z-10 opacity-80 mix-blend-multiply transition-opacity duration-700 group-hover:opacity-50"
        style={{
          background: "linear-gradient(180deg, rgba(11,45,36,0.3) 0%, rgba(77,17,24,0.6) 100%)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 z-10 opacity-90 transition-opacity duration-700 group-hover:opacity-75"
        style={{
          background: "linear-gradient(to top, #040206 0%, rgba(4,2,6,0.4) 40%, transparent 100%)",
        }}
        aria-hidden
      />

      {/* Subtle Hairline Frame */}
      <div className="absolute inset-3 z-20 pointer-events-none border border-[var(--color-gold)] opacity-10 transition-opacity duration-700 group-hover:opacity-30 sm:inset-4" />

      {/* Content */}
      <div className="relative z-30 flex mt-auto flex-col px-6 pb-6 pt-12 sm:px-8 sm:pb-8">
        {dish.category && (
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px w-6 bg-[var(--color-gold)] opacity-40" />
            <p
              className="text-[0.625rem] uppercase tracking-[0.25em]"
              style={{
                color: "var(--color-gold)",
                fontFamily: "var(--font-sans)",
                opacity: 0.9,
              }}
            >
              {dish.category}
            </p>
          </div>
        )}
        <h3
          className="mb-3 text-balance leading-[1.15]"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.6rem",
            fontWeight: 400,
            color: "var(--color-ivory)",
            textShadow: "0 2px 12px rgba(0,0,0,0.8)",
          }}
        >
          {name}
        </h3>
        {dish.description ? (
          <p
            className="mb-6 line-clamp-2 text-sm leading-relaxed"
            style={{
              fontFamily: "var(--font-sans)",
              color: "var(--color-ivory-faint)",
              textShadow: "0 1px 4px rgba(0,0,0,0.8)",
            }}
          >
            {dish.description}
          </p>
        ) : (
          <div className="mb-6" />
        )}

        <div className="flex items-center justify-between border-t border-[rgba(244,239,228,0.1)] pt-4">
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 300,
              fontSize: "1.0625rem",
              letterSpacing: "0.04em",
              color: "var(--color-gold)",
            }}
          >
            ₹{dish.price}
          </span>
          <Link
            href="/menu"
            className="group/btn relative flex items-center gap-2 overflow-hidden text-[0.6875rem] uppercase tracking-[0.2em] text-[var(--color-ivory)] transition-colors duration-300 hover:text-[var(--color-gold)]"
          >
            Order
            <svg
              aria-hidden
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="transition-transform duration-300 group-hover/btn:translate-x-1"
            >
              <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}
