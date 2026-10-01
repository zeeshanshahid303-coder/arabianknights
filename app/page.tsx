import { getHomepageData } from "@/lib/getHomepageData";
import { SiteHeader } from "@/components/home/SiteHeader";
import { HeroSection } from "@/components/home/HeroSection";
import { TrustBar } from "@/components/home/TrustBar";
import { FeaturedDishes } from "@/components/home/FeaturedDishes";
import { AboutSection } from "@/components/home/AboutSection";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { ReservationCTA } from "@/components/home/ReservationCTA";
import { SiteFooter } from "@/components/home/SiteFooter";

// Revalidate hourly on Vercel. Next static export will ignore this or fail.
export const revalidate = 3600;

export default async function HomePage() {
  const { settings, content, featuredDishes, reviews, priceRange } =
    await getHomepageData();

  return (
    <>
      <SiteHeader
        name={settings.name}
        phone={settings.contact_info.phone}
        reservationHref="/reservation"
      />

      <main className="flex-1">
        <HeroSection
          title={content.hero_title}
          subtitle={content.hero_subtitle}
          isOpen={settings.restaurant_open}
          headlineLead="Experience the Art"
          headlineAccent="of Arabian Dining"
        />

      <TrustBar priceMin={priceRange.min} priceMax={priceRange.max} />

      <FeaturedDishes dishes={featuredDishes} />

      <AboutSection
        storyText={content.story_section}
        aboutText={content.about_section}
        address={settings.contact_info.address}
      />

      <WhyChooseUs />

      <ReviewsSection reviews={reviews} />

      <ReservationCTA
        hours={settings.reservation_hours}
        phone={settings.contact_info.phone}
      />
      </main>

      <SiteFooter
        name={settings.name}
        address={settings.contact_info.address}
        phone={settings.contact_info.phone}
        email={settings.contact_info.email}
        socialLinks={settings.social_links}
        text={content.footer_text}
      />
    </>
  );
}
