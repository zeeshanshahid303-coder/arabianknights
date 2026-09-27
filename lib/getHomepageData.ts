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
  footer_text: string;
};

export type HomepageData = {
  settings: RestaurantSettings;
  content: WebsiteContent;
  featuredDishes: MenuItem[];
  priceRange: { min: number; max: number };
};

const REAL_IMAGE_HOST = "pbrgvuxvmfvnfbweznri.supabase.co";
const TEST_NAMES = ["aaa", "abc"];

export async function getHomepageData(): Promise<HomepageData> {
  const [settingsResult, contentResult, menuResult] = await Promise.all([
    supabase.from("restaurant_settings").select("*").single(),
    supabase.from("website_content").select("*").single(),
    supabase
      .from("menu_items")
      .select(
        "id, name, price, image_url, description, is_available, is_sold_out, category_id",
      )
      .eq("is_available", true)
      .eq("is_sold_out", false),
  ]);

  // Fetch categories separately for join
  const { data: categories } = await supabase
    .from("menu_categories")
    .select("id, name");
  const catMap = Object.fromEntries(
    (categories ?? []).map((c) => [c.id, c.name]),
  );

  const allItems: MenuItem[] = (menuResult.data ?? []).map((item) => ({
    ...item,
    name: item.name?.trim() ?? "",
    price: Number(item.price),
    category: catMap[item.category_id] ?? null,
  }));

  // Only show items with real hosted images
  const featuredDishes = allItems
    .filter(
      (item) =>
        item.image_url?.includes(REAL_IMAGE_HOST) &&
        !TEST_NAMES.includes(item.name.toLowerCase()),
    )
    .slice(0, 6);

  const prices = allItems.map((i) => i.price).filter(Boolean);
  const priceRange = {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };

  const settings: RestaurantSettings = settingsResult.data ?? {
    name: "Arabian Knights Restaurant",
    hero_image_url: null,
    contact_info: {
      phone: "+91-6456355448",
      address: "Captain Complex, College Road, Paschimpali, Kishanganj",
      email: "contact@arabianknightskne@gmail.com",
    },
    social_links: {},
    reservation_hours: {
      monday_friday: "11:00–23:00",
      saturday_sunday: "10:00–00:00",
    },
    restaurant_open: true,
    delivery_charge: "50",
  };

  const content: WebsiteContent = contentResult.data ?? {
    hero_title: "Experience the Art of Arabian Dining",
    hero_subtitle: "Crafted with passion, served with perfection.",
    about_section:
      "We are dedicated to providing an unforgettable dining experience with locally sourced ingredients and masterful culinary techniques.",
    story_section:
      "Our journey began with a simple mission: to bring authentic, high-quality Mughlai flavors to Kishanganj.",
    footer_text:
      "© 2024 Arabian Knights Restaurant & Cafe · Captain Complex, Kishanganj",
  };

  return { settings, content, featuredDishes, priceRange };
}
