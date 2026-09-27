export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <h1 className="text-5xl font-bold mb-4">
        Arabian Knights Restaurant
      </h1>

      <p className="text-gray-600 mb-10 text-center">
        Captain Complex, College Road, Paschimpali, Kishanganj
      </p>

      <div className="grid gap-4 w-full max-w-md">
     
 <a
  href="/menu?mode=takeaway"
  className="bg-black text-white text-center py-4 rounded-xl text-xl font-semibold"
>
  🥡 Takeaway
</a>

<a
  href="/menu?mode=delivery"
  className="bg-black text-white text-center py-4 rounded-xl text-xl font-semibold"
>
  🏠 Home Delivery
</a>

        <a
          href="/reservation"
          className="bg-black text-white text-center py-4 rounded-xl text-xl font-semibold"
        >
          📅 Table Booking
        </a>
      </div>

      <div className="mt-10 text-center">
        <p>📞 +91-6456355448</p>
        <p className="text-green-600 font-semibold">
          ● Open Now
        </p>
      </div>
    </main>
  );
}