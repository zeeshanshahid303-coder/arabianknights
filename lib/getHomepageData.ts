import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  description: string | null;
  category: string | null;
  is_available: boolean;
  is_sold_out: boolean;
};

export type Review = {
  id: string;
  food_rating: number;
  service_rating: number;
  comment: string | null;
  created_at: string;
};

export type RestaurantSettings = {
  name: string;
  hero_image_url: string | null;
  contact_info: {
    phone: string;
    address: string;
    email: string;
  };
  social_links: {
    facebook?: string;
    instagram?: string;
  };
  reservation_hours: {
    monday_friday: string;
    saturday_sunday: string;
  };
  restaurant_open: boolean;
  delivery_charge: string;
};

export type WebsiteContent = {
  hero_title: string;
  hero_subtitle: string;
  about_section: string;
  story_section: string;
  reviews_section_title: string;
  footer_text: string;
};

export type HomepageData = {
  settings: RestaurantSettings;
  content: WebsiteContent;
  featuredDishes: MenuItem[];
  reviews: Review[];
  priceRange: { min: number; max: number };
};

/** Hosted image we trust to resolve through the Next image optimizer. */
const REAL_IMAGE_HOST = "pbrgvuxvmfvnfbweznri.supabase.co";

/** Placeholder rows still in the menu table; not real dishes. */
const TEST_NAMES = ["aaa", "abc"];

const FEATURED_LIMIT = 6;
const REVIEW_LIMIT = 6;

const FALLBACK_SETTINGS: RestaurantSettings = {
  name: "Arabian Knights Restaurant",
  hero_image_url: null,
  contact_info: {
    phone: "+91-6456355448",
    address: "Captain Complex, College Road, Paschimpali, Kishanganj",
    email: "contact@arabianknightskne@gmail.com",
  },
  social_links: {},
  reservation_hours: {
    monday_friday: "11:00-23:00",
    saturday_sunday: "10:00-00:00",
  },
  restaurant_open: true,
  delivery_charge: "50",
};

const FALLBACK_CONTENT: WebsiteContent = {
  hero_title: "Experience Culinary Excellence",
  hero_subtitle: "Crafted with passion, served with perfection.",
  about_section:
    "We are dedicated to providing an unforgettable dining experience with locally sourced ingredients and masterful culinary techniques.",
  story_section:
    "Founded in 2010, our journey began with a simple mission: to bring authentic, high-quality Mughlai flavours to our community.",
  reviews_section_title: "What Our Guests Say",
  footer_text:
    "© 2024 Arabian Knights Restaurant & Cafe · Captain Complex, Kishanganj",
};

const EMPTY_PRICE_RANGE = { min: 0, max: 0 };

/**
 * `category:menu_categories(name)` comes back as an object when PostgREST
 * infers the embed to be one-to-one, and as a single-element array when it
 * infers one-to-many. Normalise both to the category's name.
 */
function categoryName(embed: unknown): string | null {
  if (Array.isArray(embed)) {
    const first = embed[0] as { name?: string | null } | undefined;
    return first?.name?.trim() ?? null;
  }
  const row = embed as { name?: string | null } | null;
  return row?.name?.trim() ?? null;
}

/**
 * Everything the homepage renders, in one round trip each. Each table is
 * optional: if a query fails or a table is empty, the page still renders
 * from the fallbacks above rather than erroring out.
 */
export async function getHomepageData(): Promise<HomepageData> {
  const [settingsResult, contentResult, menuResult, reviewsResult] = await Promise.all([
    supabase.from("restaurant_settings").select("*").limit(1).maybeSingle(),
    supabase.from("website_content").select("*").limit(1).maybeSingle(),
    supabase
      .from("menu_items")
      .select(
        "id, name, price, image_url, description, is_available, is_sold_out, category:menu_categories(name)",
      )
      .eq("is_available", true)
      .eq("is_sold_out", false)
      .eq("is_active", true),
    supabase
      .from("feedback")
      .select("id, food_rating, service_rating, comment, created_at")
      .eq("is_private", false)
      .order("created_at", { ascending: false })
      .limit(REVIEW_LIMIT),
  ]);

  const allItems: MenuItem[] = (menuResult.data ?? []).map((item) => ({
    id: item.id,
    name: item.name?.trim() ?? "",
    price: Number(item.price),
    image_url: item.image_url,
    description: item.description,
    is_available: item.is_available,
    is_sold_out: item.is_sold_out,
    // PostgREST returns a to-one embed as an array when the relationship is
    // inferred as one-to-many, so normalise both shapes to a single name.
    category: categoryName(item.category),
  }));

  const featuredDishes = allItems
    .filter(
      (item) =>
        item.image_url?.includes(REAL_IMAGE_HOST) &&
        !TEST_NAMES.includes(item.name.toLowerCase()),
    )
    .slice(0, FEATURED_LIMIT);

  // The trust bar shows what a guest actually spends, so this spans the
  // dishes on the menu rather than the few on display. `Math.min()` of an
  // empty array is Infinity, hence the explicit emptiness check.
  const prices = allItems.map((i) => i.price).filter((p) => Number.isFinite(p) && p > 0);
  const priceRange = prices.length
    ? { min: Math.min(...prices), max: Math.max(...prices) }
    : EMPTY_PRICE_RANGE;

  // Ratings are optional columns, so fall back to a neutral 5 rather than
  // letting a null become NaN in the star row.
  const reviews: Review[] = (reviewsResult.data ?? []).map((r) => ({
    id: r.id,
    food_rating: r.food_rating ?? 5,
    service_rating: r.service_rating ?? 5,
    comment: r.comment,
    created_at: r.created_at,
  }));

  return {
    settings: settingsResult.data ?? FALLBACK_SETTINGS,
    content: { ...FALLBACK_CONTENT, ...contentResult.data },
    featuredDishes,
    reviews,
    priceRange,
  };
}
