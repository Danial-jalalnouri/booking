"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

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
      .catch(() => { /* aborted (e.g. navigation) */ })
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

  if (error && !business)
    return (
      <main className="max-w-md mx-auto mt-32 px-6">
        <div className="card p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-2xl">🔍</div>
          <h1 className="text-xl font-bold text-t1">Business not found</h1>
          <p className="mt-2 text-sm text-t3">{error}</p>
          <Link href="/" className="btn-secondary mt-8 block">← Back home</Link>
        </div>
      </main>
    );
  if (!business) return <main className="p-16 text-center text-t3">Loading…</main>;

  if (success) {
    return (
      <main className="max-w-md mx-auto px-6 mt-28">
        <div className="card p-12 text-center shadow-xl shadow-indigo-600/5">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
            <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-emerald-500"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-t1">You&apos;re booked!</h1>
          <p className="mt-2 text-sm text-t2">
            Your appointment is confirmed. A confirmation will be sent to your email.
          </p>
          <button onClick={() => { setSuccess(false); setSelectedSlot(""); }} className="btn-secondary mt-8">
            Book another appointment
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24">
      <header className="brand-gradient relative overflow-hidden rounded-b-3xl px-6 py-14 text-center text-white -mx-6 md:mx-0 md:rounded-3xl md:mt-12 md:px-10">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -top-16 -left-16 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        </div>
        <h1 className="relative text-3xl font-bold tracking-tight text-white md:text-4xl">{business.name}</h1>
        {business.description && <p className="relative mt-2 text-white/80">{business.description}</p>}
      </header>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <div className="card p-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-t3">Service</span>
            <select className="input mt-2" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {business.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMin} min){s.price ? ` — ${s.price}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-5">
            <span className="text-xs font-semibold uppercase tracking-wide text-t3">Date</span>
            <input type="date" className="input mt-2" value={date} min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => { setDate(e.target.value); setSelectedSlot(""); }} />
          </div>
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-t3">Available times</p>
            {loadingSlots && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded-lg bg-white/5" />
                ))}
              </div>
            )}
            {!loadingSlots && slots.length === 0 && (
              <p className="mt-3 rounded-xl bg-[color:var(--btn2-bg)] px-3 py-4 text-center text-sm text-t3">
                No slots available on this day 🙃
              </p>
            )}
            {!loadingSlots && slots.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {slots.map((s) => {
                  const label = new Date(s.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                  const active = selectedSlot === s.start;
                  return (
                    <button key={s.start} onClick={() => setSelectedSlot(s.start)}
                      className={`rounded-lg border py-2 text-sm font-medium transition ${
                        active
                          ? "border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                          : "bg-[color:var(--btn2-bg)] border-[color:var(--surface-border)] text-t2 hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-accent"
                      }`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={submit} className="card flex flex-col p-6">
          <h2 className="text-lg font-semibold text-white">Your details</h2>
          <div className="mt-5 space-y-4">
            <input className="input" placeholder="Full name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="input" type="email" placeholder="you@example.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input className="input" placeholder="Phone (optional)" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          {error && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-danger">{error}</p>}
          {selectedSlot && (
            <p className="mt-4 text-sm text-t3">
              Selected:{" "}
              <span className="font-medium text-t1">
                {new Date(selectedSlot).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </p>
          )}
          <button disabled={submitting || !selectedSlot} className="btn-primary mt-6 w-full py-3">
            {submitting ? "Booking…" : "Book appointment"}
          </button>
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
