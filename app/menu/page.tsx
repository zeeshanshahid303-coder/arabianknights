import { supabase } from "../../lib/supabase";
import MenuClient from "../../components/MenuClient";

export default async function MenuPage() {
  const { data: categories } = await supabase
    .from("menu_categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order");

const { data: items } = await supabase
  .from("menu_items")
  .select("*")
  .eq("is_available", true);
  return (
    <main className="min-h-screen p-6 bg-gray-50">
      <a
  href="/"
  className="inline-block mb-6 bg-gray-200 px-4 py-2 rounded"
>
  ← Back to Home
</a>
      <h1 className="text-4xl font-bold mb-8">Menu</h1>

      <MenuClient
        items={items || []}
        categories={categories || []}
      />
    </main>
  );
}