import type { Metadata } from "next";
import { supabase } from "../../lib/supabase";
import MenuClient from "../../components/MenuClient";
import { GoldButton } from "../../components/ui/GoldButton";
import { SiteHeader } from "../../components/home/SiteHeader";
import { getHomepageData } from "../../lib/getHomepageData";

export const metadata: Metadata = {
  title: "Menu | Arabian Knights Restaurant & Cafe",
  description:
    "Browse the full Arabian Knights menu — Mughlai and Indian cuisine prepared to order. Dine-in, takeaway, and home delivery in Kishanganj.",
};

export default async function MenuPage() {
  const [{ data: categories }, { data: items }, { settings }] =
    await Promise.all([
      supabase
        .from("menu_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order"),

      supabase.from("menu_items").select("*").eq("is_available", true),

      // The masthead is the same lockup the homepage carries, so the menu
      // reads as part of the same site rather than a bare utility page.
      getHomepageData(),
    ]);

  return (
    <>
      <SiteHeader
        name={settings.name}
        phone={settings.contact_info.phone}
        reservationHref="/reservation"
      />

      <main className="grain relative min-h-screen overflow-hidden">
        {/* ==========================================================
            The room the menu is read in — the same night the hero
            builds: maroon and emerald in the dark air, the lattice
            behind it, a lamp overhead, and film grain over the lot.
            ========================================================== */}
        <div aria-hidden className="veil-night absolute inset-0" />

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div
            className="mashrabiya-maroon absolute inset-0 h-full w-full opacity-[0.07]"
            style={{
              maskImage:
                "radial-gradient(70% 45% at 50% 8%, #000 0%, rgba(0,0,0,0.35) 60%, transparent 92%)",
              WebkitMaskImage:
                "radial-gradient(70% 45% at 50% 8%, #000 0%, rgba(0,0,0,0.35) 60%, transparent 92%)",
            }}
          />
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[70vh]"
          style={{
            background:
              "radial-gradient(55% 55% at 50% -8%, rgba(232,204,114,0.30) 0%, rgba(212,175,55,0.13) 42%, transparent 80%)",
          }}
        />

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(78% 62% at 50% 34%, transparent 0%, rgba(4,2,6,0.5) 80%, rgba(4,2,6,0.85) 100%)",
          }}
        />

        {/* ==========================================================
            Hero
            ========================================================== */}
        <section className="relative mx-auto max-w-7xl px-6 pb-16 pt-32 text-center sm:pb-20 sm:pt-40 lg:px-12">
          <p
            className="hero-status eyebrow mb-6"
            style={{ color: "var(--color-gold)" }}
          >
            Arabian Knights
          </p>

          <h1
            className="hero-headline mx-auto max-w-4xl text-balance"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "0.01em",
              fontSize: "clamp(2.75rem, 8vw, 5.5rem)",
              color: "var(--color-ivory)",
              textShadow: "0 0 60px rgba(212,175,55,0.15)",
            }}
          >
            The <span className="text-gold-gradient">Menu</span>
          </h1>

          <div
            className="ornament hero-rule mx-auto my-8 h-px w-24"
            aria-hidden
          />

          <p
            className="hero-subtitle mx-auto max-w-xl text-pretty text-[0.9375rem] leading-[1.8] sm:text-[1.0625rem]"
            style={{
              color: "var(--color-ivory)",
              opacity: 0.8,
              fontFamily: "var(--font-sans)",
              fontWeight: 300,
            }}
          >
            Mughlai and Indian classics, prepared to order and served with the
            hospitality the house is known for.
          </p>

          <div className="hero-buttons mt-12 flex flex-wrap items-center justify-center gap-4">
            <GoldButton href="/reservation" variant="solid" size="md">
              Reserve a Table
            </GoldButton>

            <GoldButton href="/" variant="ghost" size="md">
              <span className="btn-icon" style={{ display: "inline-flex" }}>
                <svg
                  aria-hidden
                  width="15"
                  height="15"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    d="M16 10H4M8 6l-4 4 4 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Back to Home
            </GoldButton>
          </div>
        </section>

        {/* ==========================================================
            Chapters. Each category is a chapter of the menu book,
            opened onto its own band of the night.
            ========================================================== */}
        <MenuClient items={items || []} categories={categories || []} />

        {/* A last full-bleed band, so the page ends in the same dark
            the hero opened with rather than on a cut edge. */}
        <div
          aria-hidden
          className="pointer-events-none relative h-32 w-full"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(4,2,6,0.85) 100%)",
          }}
        >
          <div
            className="mashrabiya-gold absolute inset-0 h-full w-full opacity-[0.06]"
            style={{
              maskImage: "linear-gradient(to top, #000 0%, transparent 70%)",
              WebkitMaskImage:
                "linear-gradient(to top, #000 0%, transparent 70%)",
            }}
          />
        </div>
      </main>
    </>
  );
}
