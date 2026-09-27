"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ReservationPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [reservationDate, setReservationDate] = useState("");
  const [reservationTime, setReservationTime] = useState("");
  const [guestsCount, setGuestsCount] = useState(2);

  const submitReservation = async () => {
    if (
      !guestName ||
      !guestPhone ||
      !reservationDate ||
      !reservationTime
    ) {
      alert("Please fill all required fields.");
      return;
    }

    setLoading(true);

const { data, error } = await supabase
  .from("reservations")
  .insert({
    guest_name: guestName,
    guest_phone: guestPhone,
    reservation_date: reservationDate,
    reservation_time: reservationTime,
    guests_count: guestsCount,
  })
  .select();

console.log("DATA:", data);
console.log("ERROR:", error);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white shadow rounded-xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-green-600 mb-4">
            ✅ Reservation Request Submitted
          </h1>

          <p className="text-gray-600">
            We will contact you shortly to confirm your booking.
          </p>

          <a
            href="/"
            className="inline-block mt-6 bg-black text-white px-5 py-3 rounded"
          >
            Back to Home
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-xl mx-auto">
        <a
  href="/"
  className="inline-block mb-6 bg-gray-200 px-4 py-2 rounded"
>
  ← Back to Home
</a>
      <h1 className="text-4xl font-bold mb-8">
        📅 Table Reservation
      </h1>

      <div className="space-y-4">
        <input
          type="text"
          placeholder="Guest Name"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          className="w-full border p-3 rounded"
        />

        <input
          type="text"
          placeholder="Phone Number"
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
          className="w-full border p-3 rounded"
        />

        <input
          type="date"
          value={reservationDate}
          onChange={(e) => setReservationDate(e.target.value)}
          className="w-full border p-3 rounded"
        />

        <input
          type="time"
          value={reservationTime}
          onChange={(e) => setReservationTime(e.target.value)}
          className="w-full border p-3 rounded"
        />

        <input
          type="number"
          min="1"
          value={guestsCount}
          onChange={(e) =>
            setGuestsCount(Number(e.target.value))
          }
          className="w-full border p-3 rounded"
        />

        <button
          onClick={submitReservation}
          disabled={loading}
          className="w-full bg-black text-white py-3 rounded"
        >
          {loading ? "Submitting..." : "Reserve Table"}
        </button>
      </div>
    </main>
  );
}