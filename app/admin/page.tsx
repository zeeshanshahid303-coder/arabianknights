"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
export default function AdminPage() {
  const router = useRouter();

  const [menuItems, setMenuItems] = useState<any[]>([]) /* eslint-disable-line @typescript-eslint/no-explicit-any */;
 const [categories, setCategories] = useState<any[]>([]) /* eslint-disable-line @typescript-eslint/no-explicit-any */; 
const [name, setName] = useState("");
const [price, setPrice] = useState("");
const [imageUrl, setImageUrl] = useState("");
const [imageFile, setImageFile] = useState<File | null>(null);
const [categoryId, setCategoryId] = useState("");
const [todayOrders, setTodayOrders] = useState(0);
const [todayRevenue, setTodayRevenue] = useState(0);
const [monthRevenue, setMonthRevenue] = useState(0);
const [checkingAccess, setCheckingAccess] = useState(true);
  const loadMenu = async () => {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .order("id");

    if (error) {
      console.error(error);
      return;
    }

    setMenuItems(data || []);
    const { data: categoriesData } = await supabase
  .from("menu_categories")
  .select("*")
  .eq("is_active", true)
  .order("display_order");
console.log("CATEGORIES:", categoriesData);
setCategories(categoriesData || []);
const today = new Date();
today.setHours(0, 0, 0, 0);

const { data: ordersData } = await supabase
  .from("orders")
  .select("*");
console.log("ORDERS:", ordersData);
const todayOrdersData =
  ordersData?.filter(
    (o) => new Date(o.created_at) >= today
  ) || [];

setTodayOrders(todayOrdersData.length);

setTodayRevenue(
  todayOrdersData.reduce(
    (sum, o) => sum + (o.total || 0),
    0
  )
);

const currentMonth = new Date().getMonth();
const currentYear = new Date().getFullYear();

const monthOrders =
  ordersData?.filter((o) => {
    const d = new Date(o.created_at);

    return (
      d.getMonth() === currentMonth &&
      d.getFullYear() === currentYear
    );
  }) || [];

setMonthRevenue(
  monthOrders.reduce(
    (sum, o) => sum + (o.total || 0),
    0
  )
);
  };
useEffect(() => {
  const initialize = async () => {
const {
  data: { session },
} = await supabase.auth.getSession();

if (!session) {
  router.replace("/admin/login");
  return;
}

const { data: admin } = await supabase
  .from("admins")
  .select("*")
  .eq("email", session.user.email)
  .eq("status", "active")
  .single();

if (!admin) {
  await supabase.auth.signOut();
  router.replace("/admin/login");
  return;
}
setCheckingAccess(false);
loadMenu();
  };

  initialize();
}, [router]);
if (checkingAccess) {
  return (
    <main className="admin-page flex items-center justify-center">
      <p className="admin-title">Checking access...</p>
    </main>
  );
}

  return (
    <main className="admin-page">
      <header className="admin-head">
        <div>
          <p className="eyebrow mb-2 text-gold-gradient">Arabian Knights</p>
          <h1 className="admin-title">Admin Dashboard</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/admin/staff")}
            className="admin-btn admin-btn-secondary"
          >
            Staff Management
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = "/admin/login";
            }}
            className="admin-btn admin-btn-danger"
          >
            Logout
          </button>
        </div>
      </header>

      {/* SUMMARY STATS */}
      <section className="admin-section">
        <div className="admin-summary-grid">
          <div className="admin-summary-card">
            <p className="admin-summary-label">Today&apos;s Orders</p>
            <p className="admin-summary-value">{todayOrders}</p>
          </div>
          <div className="admin-summary-card">
            <p className="admin-summary-label">Today&apos;s Revenue</p>
            <p className="admin-summary-value">₹{todayRevenue}</p>
          </div>
          <div className="admin-summary-card">
            <p className="admin-summary-label">This Month</p>
            <p className="admin-summary-value">₹{monthRevenue}</p>
          </div>
        </div>
      </section>

      {/* ADD MENU ITEM FORM */}
      <section className="admin-section">
        <div className="admin-section-head">
          <h2 className="admin-section-title">Add Menu Item</h2>
        </div>

        <div className="admin-card p-6" style={{ background: "transparent" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="admin-label">Item Name</label>
              <input
                type="text"
                placeholder="e.g. Hummus"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="admin-control"
              />
            </div>

            <div>
              <label className="admin-label">Price (₹)</label>
              <input
                type="number"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="admin-control"
              />
            </div>

            <div>
              <label className="admin-label">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="admin-control"
              >
                <option value="">Select Category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="admin-label">Image URL</label>
              <input
                type="text"
                placeholder="https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="admin-control"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-end justify-between gap-4 border-t border-[var(--color-hairline)] pt-4 mt-2">
            <div className="w-full md:w-1/2">
              <label className="admin-label">Or Upload Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setImageFile(e.target.files[0]);
                  }
                }}
                className="admin-control"
                style={{ padding: "0.5rem" }}
              />
            </div>

            <button
              onClick={async () => {
                console.log("CATEGORY ID:", categoryId);

                let finalImageUrl = imageUrl;

                if (imageFile) {
                  const fileExt = imageFile.name.split(".").pop();
                  const fileName = `${Date.now()}.${fileExt}`;

                  const { error: uploadError } = await supabase.storage
                    .from("menu-images")
                    .upload(fileName, imageFile);

                  if (uploadError) {
                    console.error(uploadError);
                    alert("Image upload failed");
                    return;
                  }

                  const { data } = supabase.storage
                    .from("menu-images")
                    .getPublicUrl(fileName);

                  finalImageUrl = data.publicUrl;
                }

                const { error } = await supabase
                  .from("menu_items")
                  .insert([
                    {
                      name,
                      price: Number(price),
                      image_url: finalImageUrl,
                      category_id: categoryId,
                    },
                  ]);

                if (error) {
                  console.error(error);
                  alert("Failed to add item");
                  return;
                }

                setName("");
                setPrice("");
                setImageUrl("");
                setCategoryId("");
                setImageFile(null);

                loadMenu();
              }}
              className="admin-btn admin-btn-primary"
              style={{ padding: "0.875rem 2rem" }}
            >
              <span className="mr-2">➕</span> Add Item
            </button>
          </div>
        </div>
      </section>

      {/* MENU ITEMS LIST */}
      <section className="admin-section">
        <div className="admin-section-head">
          <h2 className="admin-section-title">Menu Items</h2>
          <span className="admin-count">{menuItems.length}</span>
        </div>

        <div className="admin-grid">
          {menuItems.map((item) => (
            <article key={item.id} className="admin-card">
              <header className="admin-card-head" style={{ paddingBottom: "0.75rem" }}>
                <h3 className="admin-card-table text-lg font-sans">{item.name}</h3>
                <span className={`admin-badge ${item.is_available ? 'admin-badge-success' : 'admin-badge-active'}`}>
                  {item.is_available ? "Available" : "Hidden"}
                </span>
              </header>
              <div className="admin-card-body" style={{ paddingTop: "0" }}>
                <p className="font-display text-2xl text-[var(--color-gold)] mb-4 border-b border-[var(--color-hairline)] pb-4">
                  ₹{item.price}
                </p>

                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={async () => {
                      const newPrice = prompt(
                        `New price for ${item.name}?`,
                        item.price
                      );

                      if (!newPrice) return;

                      const { error } = await supabase
                        .from("menu_items")
                        .update({
                          price: Number(newPrice),
                        })
                        .eq("id", item.id);

                      if (error) {
                        console.error(error);
                        return;
                      }

                      loadMenu();
                    }}
                    className="admin-btn admin-btn-secondary flex-1"
                    style={{ padding: "0.5rem" }}
                  >
                    ✏️ Edit Price
                  </button>

                  <button
                    onClick={async () => {
                      const {
                        data: { session },
                      } = await supabase.auth.getSession();

                      console.log("SESSION:", session);
                      const { error } = await supabase
                        .from("menu_items")
                        .update({
                          is_available: !item.is_available,
                        })
                        .eq("id", item.id);

                      if (error) {
                        console.error(error);
                        return;
                      }

                      loadMenu();
                    }}
                    className={`admin-btn flex-1 ${item.is_available ? 'admin-btn-danger' : 'admin-btn-success'}`}
                    style={{ padding: "0.5rem" }}
                  >
                    {item.is_available ? "🙈 Hide" : "👁 Show"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
