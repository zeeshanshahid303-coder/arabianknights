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
    <section className="veil-emerald-soft max-w-6xl mx-auto px-6 py-20 lg:px-12 lg:py-28">
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
    </section>
  );
}

function DishCard({ dish }: { dish: MenuItem }) {
  const name = clean(dish.name);

  return (
    <article
      className="group edge-hair flex h-full flex-col overflow-hidden rounded-[20px] transition-[transform,box-shadow] duration-350 ease-out hover:-translate-y-1.5"
      style={{
        background: "rgba(255,255,255,0.04)",
        boxShadow: "0 24px 60px -16px rgba(0,0,0,0.5)",
      }}
    >
      {/* Image */}
      <div className="relative h-52 shrink-0 overflow-hidden sm:h-56">
        {dish.image_url ? (
          <Image
            src={dish.image_url}
            alt={name}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div
            className="absolute inset-0 grid place-items-center"
            style={{
              background:
                "radial-gradient(120% 100% at 50% 0%, rgba(212,175,55,0.16) 0%, var(--color-ink-raised) 70%)",
            }}
          >
            <span
              aria-hidden
              className="text-4xl opacity-40"
              style={{ fontFamily: "var(--font-display)", color: "var(--color-gold)" }}
            >
              ✦
            </span>
          </div>
        )}
        {/* Bottom gradient so the category label stays legible */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
          style={{
            background: "linear-gradient(to top, rgba(10,11,10,0.85) 0%, transparent 100%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-6">
        {dish.category ? (
          <p
            className="eyebrow mb-2"
            style={{
              color: "var(--color-gold)",
              fontFamily: "var(--font-sans)",
              opacity: 0.85,
            }}
          >
            {dish.category}
          </p>
        ) : null}
        <h3
          className="mb-2 text-balance"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.375rem",
            fontWeight: 500,
            color: "var(--color-bone)",
            lineHeight: 1.2,
          }}
        >
          {name}
        </h3>
        {dish.description ? (
          <p
            className="mb-4 flex-1 text-sm leading-relaxed"
            style={{ fontFamily: "var(--font-sans)", color: "var(--color-ash)" }}
          >
            {dish.description}
          </p>
        ) : (
          <div className="flex-1" />
        )}
        <div
          className="mt-auto flex items-center justify-between border-t pt-4"
          style={{ borderColor: "var(--color-hairline)" }}
        >
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
            className="text-xs transition-colors duration-200 hover:text-[var(--color-gold-soft)]"
            style={{ fontFamily: "var(--font-sans)", color: "var(--color-ash)" }}
          >
            Order Now →
          </Link>
        </div>
      </div>
    </article>
  );
}
