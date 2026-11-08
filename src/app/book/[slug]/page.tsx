"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Suspense } from "react";

type Business = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  hours: { dayOfWeek: number; startTime: string; endTime: string }[];
  services: { id: string; name: string; description: string | null; durationMin: number; price: string | null }[];
};

function BookingPage() {
  const params = useParams();
  const slug = String(params?.slug || "");
  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<{ start: string; end: string }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    fetch(`/api/public/business/${slug}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Not found");
        const j = await r.json();
        setBusiness(j.business);
        if (j.business.services?.length) setServiceId(j.business.services[0].id);
      })
      .catch(() => setError("Business not found"));
  }, [slug]);

  useEffect(() => {
    if (!slug || !date) return;
    setLoadingSlots(true);
    fetch(`/api/public/business/${slug}/slots?date=${date}`)
      .then((r) => r.json())
      .then((j) => setSlots(j.slots || []))
      .finally(() => setLoadingSlots(false));
  }, [slug, date]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) { setError("Pick a time slot"); return; }
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/public/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        serviceId,
        customerName: form.name,
        customerEmail: form.email,
        customerPhone: form.phone,
        startTime: selectedSlot,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Booking failed");
      return;
    }
    setSuccess(true);
  }

  if (error && !business) return <main className="p-8 text-red-600">{error}</main>;
  if (!business) return <main className="p-8">Loading...</main>;

  if (success) {
    return (
      <main className="max-w-md mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-green-600 mb-2">Booked!</h1>
        <p className="text-gray-600">Your appointment is confirmed. A confirmation will be sent to your email.</p>
        <button onClick={() => { setSuccess(false); setSelectedSlot(""); }} className="mt-6 text-blue-600">Book another</button>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold">{business.name}</h1>
      {business.description && <p className="text-gray-600 mt-1">{business.description}</p>}

      <div className="mt-8 grid md:grid-cols-2 gap-8">
        <div>
          <label className="block text-sm font-medium mb-1">Service</label>
          <select className="w-full border rounded px-3 py-2" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {business.services.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.durationMin} min){s.price ? ` - ${s.price}` : ""}</option>
            ))}
          </select>

          <label className="block text-sm font-medium mt-4 mb-1">Date</label>
          <input type="date" className="w-full border rounded px-3 py-2" value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => { setDate(e.target.value); setSelectedSlot(""); }} />

          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Available times</p>
            {loadingSlots && <p className="text-sm text-gray-500">Loading...</p>}
            {!loadingSlots && slots.length === 0 && <p className="text-sm text-gray-500">No slots available on this day.</p>}
            <div className="grid grid-cols-3 gap-2">
              {slots.map((s) => (
                <button
                  key={s.start}
                  onClick={() => setSelectedSlot(s.start)}
                  className={`px-3 py-2 text-sm rounded border ${selectedSlot === s.start ? "bg-blue-600 text-white border-blue-600" : "bg-white"}`}
                >
                  {new Date(s.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <h2 className="text-lg font-semibold">Your details</h2>
          <input className="w-full border rounded px-3 py-2" placeholder="Full name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="w-full border rounded px-3 py-2" type="email" placeholder="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className="w-full border rounded px-3 py-2" placeholder="Phone (optional)" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button disabled={submitting || !selectedSlot} className="w-full bg-blue-600 text-white py-2 rounded font-medium disabled:opacity-50">
            {submitting ? "Booking..." : "Book appointment"}
          </button>
          {selectedSlot && (
            <p className="text-sm text-gray-500">
              Selected: {new Date(selectedSlot).toLocaleString()}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}


export default function BookingPageWrapper() {
  return (
    <Suspense fallback={<main className="p-8">Loading...</main>}>
      <BookingPage />
    </Suspense>
  );
}
