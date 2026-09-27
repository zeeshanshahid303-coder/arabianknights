"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
export default function AdminPage() {
  const router = useRouter();

  const [menuItems, setMenuItems] = useState<any[]>([]);
 const [categories, setCategories] = useState<any[]>([]); 
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
    <main className="p-6">
      Checking access...
    </main>
  );
}
  return (
    <main className="p-6">
     <div className="flex justify-between items-center mb-6">
  <h1 className="text-3xl font-bold">
    Admin Dashboard
  </h1>
  <div className="flex gap-2">
  <button
    onClick={() => router.push("/admin/staff")}
    className="bg-blue-600 text-white px-4 py-2 rounded"
  >
    Staff Management
  </button>

  <button
    onClick={async () => {
      await supabase.auth.signOut();
      router.replace("/admin/login");
    }}
    className="bg-red-600 text-white px-4 py-2 rounded"
  >
    Logout
  </button>
</div>
</div>
<div className="border rounded-lg p-4 mb-6">
  <h2 className="text-xl font-bold mb-3">
    Add Menu Item
  </h2>

  <input
    type="text"
    placeholder="Item Name"
    value={name}
    onChange={(e) => setName(e.target.value)}
    className="border p-2 mr-2"
  />

  <input
    type="number"
    placeholder="Price"
    value={price}
    onChange={(e) => setPrice(e.target.value)}
    className="border p-2 mr-2"
  />
  <select
  value={categoryId}
  onChange={(e) => setCategoryId(e.target.value)}
  className="border p-2 mr-2"
>
  <option value="">Select Category</option>

  {categories.map((category) => (
    <option
      key={category.id}
      value={category.id}
    >
      {category.name}
    </option>
  ))}
</select>
<input
  type="text"
  placeholder="Image URL"
  value={imageUrl}
  onChange={(e) => setImageUrl(e.target.value)}
  className="border p-2 mr-2"
/>
<input
  type="file"
  accept="image/*"
  onChange={(e) => {
    if (e.target.files?.[0]) {
      setImageFile(e.target.files[0]);
    }
  }}
  className="border p-2 mr-2"
/>
  <button
   onClick={async () => {
  console.log("CATEGORY ID:", categoryId);

  let finalImageUrl = imageUrl;

  // Upload image to Supabase Storage
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

  // Add menu item
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

  // Clear form
  setName("");
  setPrice("");
  setImageUrl("");
  setCategoryId("");
  setImageFile(null);

  loadMenu();
}}
    className="bg-green-600 text-white px-4 py-2 rounded"
  >
    ➕ Add
  </button>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
  <div className="bg-white border rounded-lg p-4">
    <h3 className="font-bold">
      Today's Orders
    </h3>
    <p className="text-2xl">
      {todayOrders}
    </p>
  </div>

  <div className="bg-white border rounded-lg p-4">
    <h3 className="font-bold">
      Today's Revenue
    </h3>
    <p className="text-2xl">
      ₹{todayRevenue}
    </p>
  </div>

  <div className="bg-white border rounded-lg p-4">
    <h3 className="font-bold">
      This Month Revenue
    </h3>
    <p className="text-2xl">
      ₹{monthRevenue}
    </p>
  </div>
</div>
      <h2 className="text-xl font-bold mb-4">
        Menu Items ({menuItems.length})
      </h2>

      <div className="space-y-3">
        {menuItems.map((item) => (
          <div
            key={item.id}
            className="border rounded-lg p-4"
          >
        <p><strong>{item.name}</strong></p>
<p>₹{item.price}</p>

<p>
  Status: {item.is_available ? "✅ Available" : "❌ Hidden"}
</p>

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
  className="bg-blue-600 text-white px-3 py-1 rounded mt-2"
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
  className="bg-red-600 text-white px-3 py-1 rounded mt-2 ml-2"
>
  {item.is_available ? "🙈 Hide" : "👁 Show"}
</button>
          </div>
        ))}
      </div>
    </main>
  );
}