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
    <section className="grain relative overflow-hidden py-10 lg:py-12">
      {/* Background linking hero/trustbar to this section */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(120% 80% at 50% 10%, rgba(11,45,36,0.12) 0%, transparent 70%)",
        }}
        aria-hidden
      />

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
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
          {displayed.map((dish, i) => (
            <Reveal key={dish.id} variant="scale" delay={i * 90} as="article" className="h-full">
              <DishCard dish={dish} />
            </Reveal>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
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
    <article className="group relative flex h-full w-full flex-col">
      {/* Editorial Image Framing - Portrait crop, clean, no darkening overlays */}
      <div className="relative aspect-[4/5] w-full overflow-hidden mb-6">
        {dish.image_url ? (
          <Image
            src={dish.image_url}
            alt={name}
            fill
            className="object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-[1.05]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div
            className="h-full w-full flex items-center justify-center"
            style={{
              background:
                "radial-gradient(120% 100% at 50% 0%, rgba(212,175,55,0.08) 0%, rgba(4,2,6,0.5) 100%)",
            }}
          >
            <span
              aria-hidden
              className="text-4xl opacity-10"
              style={{ fontFamily: "var(--font-display)", color: "var(--color-gold)" }}
            >
              ✦
            </span>
          </div>
        )}
        
        {/* Subtle inner matting line to crisp the image edge without heavy borders */}
        <div className="absolute inset-0 z-10 pointer-events-none ring-1 ring-inset ring-[rgba(244,239,228,0.06)]" />
      </div>

      {/* Typography & Data - Spacious, unboxed layout */}
      <div className="flex flex-col flex-1">
        {dish.category && (
          <p
            className="mb-2.5 text-[0.625rem] uppercase tracking-[0.25em]"
            style={{
              color: "var(--color-gold)",
              fontFamily: "var(--font-sans)",
              opacity: 0.8,
            }}
          >
            {dish.category}
          </p>
        )}
        
        <div className="mb-3 flex items-start justify-between gap-4">
          <h3
            className="text-balance leading-snug"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.375rem",
              fontWeight: 400,
              color: "var(--color-ivory)",
            }}
          >
            {name}
          </h3>
          <span
            className="shrink-0 pt-1"
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 300,
              fontSize: "1rem",
              letterSpacing: "0.04em",
              color: "var(--color-gold)",
            }}
          >
            ₹{dish.price}
          </span>
        </div>

        {dish.description && (
          <p
            className="mb-7 line-clamp-2 text-sm leading-relaxed"
            style={{
              fontFamily: "var(--font-sans)",
              color: "var(--color-ivory-faint)",
            }}
          >
            {dish.description}
          </p>
        )}

        <div className="mt-auto">
          <Link
            href="/menu"
            className="group/btn inline-flex items-center gap-2 overflow-hidden text-[0.6875rem] uppercase tracking-[0.15em] transition-colors duration-300 text-[var(--color-ivory-faint)] hover:text-[var(--color-gold)]"
          >
            <span className="relative">
              Order
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-[var(--color-gold)] transition-all duration-300 group-hover/btn:w-full" />
            </span>
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
