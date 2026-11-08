"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Business = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  slotDuration: number;
  hours: { id: string; dayOfWeek: number; startTime: string; endTime: string }[];
  services: { id: string; name: string; description: string | null; durationMin: number; price: string | null; active: boolean }[];
};

type Booking = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  startTime: string;
  endTime: string;
  status: string;
  service: { name: string };
  business: { name: string; slug: string };
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Dashboard() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"bookings" | "settings" | "services" | "hours">("bookings");

  const [newBiz, setNewBiz] = useState({ name: "", slug: "", description: "", slotDuration: 30 });
  const [bizError, setBizError] = useState("");

  const selected = businesses.find((b) => b.id === selectedId);

  async function loadBusinesses() {
    const res = await fetch("/api/businesses");
    if (res.status === 401) { router.push("/login"); return; }
    const j = await res.json();
    setBusinesses(j.businesses || []);
    if (!selectedId && (j.businesses || []).length) setSelectedId(j.businesses[0].id);
    setLoading(false);
  }

  async function loadBookings() {
    const url = selectedId ? `/api/dashboard/bookings?businessId=${selectedId}` : `/api/dashboard/bookings`;
    const res = await fetch(url);
    const j = await res.json();
    setBookings(j.bookings || []);
  }

  useEffect(() => { loadBusinesses(); }, []);
  useEffect(() => { if (selectedId) loadBookings(); }, [selectedId]);

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault();
    setBizError("");
    const res = await fetch("/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newBiz),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setBizError(j.error || "Failed");
      return;
    }
    const j = await res.json();
    setBusinesses((prev) => [j.business, ...prev]);
    setSelectedId(j.business.id);
    setNewBiz({ name: "", slug: "", description: "", slotDuration: 30 });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  if (loading) return <main className="p-8">Loading...</main>;

  if (businesses.length === 0) {
    return (
      <main className="max-w-xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold mb-2">Welcome</h1>
        <p className="text-gray-600 mb-6">Create your first business to start accepting bookings.</p>
        <form onSubmit={createBusiness} className="space-y-4">
          <input className="w-full border rounded px-3 py-2" placeholder="Business name" value={newBiz.name}
            onChange={(e) => setNewBiz({ ...newBiz, name: e.target.value })} required />
          <input className="w-full border rounded px-3 py-2" placeholder="URL slug (e.g. my-salon)" value={newBiz.slug}
            onChange={(e) => setNewBiz({ ...newBiz, slug: e.target.value.toLowerCase() })} required />
          <textarea className="w-full border rounded px-3 py-2" placeholder="Description" value={newBiz.description}
            onChange={(e) => setNewBiz({ ...newBiz, description: e.target.value })} />
          <label className="block text-sm text-gray-600">Slot duration (minutes)</label>
          <input className="w-full border rounded px-3 py-2" type="number" value={newBiz.slotDuration}
            onChange={(e) => setNewBiz({ ...newBiz, slotDuration: Number(e.target.value) })} />
          {bizError && <p className="text-red-600 text-sm">{bizError}</p>}
          <button className="w-full bg-blue-600 text-white py-2 rounded font-medium">Create business</button>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Dashboard</h1>
          <button onClick={logout} className="text-sm text-gray-600">Log out</button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <select
            className="border rounded px-3 py-2"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.slug})</option>
            ))}
          </select>
          {selected && (
            <a className="text-blue-600 text-sm" href={`/book/${selected.slug}`} target="_blank" rel="noreferrer">
              Booking page: /book/{selected.slug}
            </a>
          )}
        </div>

        <div className="flex gap-2 mb-6 border-b">
          {(["bookings", "settings", "services", "hours"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 capitalize ${tab === t ? "border-b-2 border-blue-600 font-medium" : "text-gray-500"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "bookings" && (
          <BookingsTab bookings={bookings} onRefresh={loadBookings} />
        )}
        {tab === "settings" && selected && (
          <SettingsTab business={selected} onUpdated={loadBusinesses} />
        )}
        {tab === "services" && selected && (
          <ServicesTab business={selected} onUpdated={loadBusinesses} />
        )}
        {tab === "hours" && selected && (
          <HoursTab key={selected.id} business={selected} onUpdated={loadBusinesses} />
        )}
      </main>
    </div>
  );
}

function BookingsTab({ bookings, onRefresh }: { bookings: Booking[]; onRefresh: () => void }) {
  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-lg font-semibold">Bookings</h2>
        <button onClick={onRefresh} className="text-sm text-blue-600">Refresh</button>
      </div>
      {bookings.length === 0 && <p className="text-gray-500">No bookings yet.</p>}
      <ul className="space-y-3">
        {bookings.map((b) => (
          <li key={b.id} className="border rounded-lg p-4 bg-white">
            <div className="font-medium">{b.customerName}</div>
            <div className="text-sm text-gray-600">{b.customerEmail} {b.customerPhone && `· ${b.customerPhone}`}</div>
            <div className="text-sm text-gray-600">{b.service.name}</div>
            <div className="text-sm font-medium">{new Date(b.startTime).toLocaleString()} – {new Date(b.endTime).toLocaleTimeString()}</div>
            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">{b.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SettingsTab({ business, onUpdated }: { business: Business; onUpdated: () => void }) {
  const [form, setForm] = useState({
    name: business.name,
    description: business.description || "",
    slotDuration: business.slotDuration,
  });
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/businesses/${business.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onUpdated();
  }
  return (
    <form onSubmit={save} className="space-y-4 max-w-lg">
      <input className="w-full border rounded px-3 py-2" value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <textarea className="w-full border rounded px-3 py-2" value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <label className="block text-sm text-gray-600">Slot duration (minutes)</label>
      <input className="w-full border rounded px-3 py-2" type="number" value={form.slotDuration}
        onChange={(e) => setForm({ ...form, slotDuration: Number(e.target.value) })} />
      <button disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded">
        {saving ? "Saving..." : "Save"}
      </button>
      <p className="text-sm text-gray-500">Booking URL: /book/{business.slug}</p>
    </form>
  );
}

function ServicesTab({ business, onUpdated }: { business: Business; onUpdated: () => void }) {
  const [form, setForm] = useState({ name: "", description: "", durationMin: business.slotDuration, price: "" });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/businesses/${business.id}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", description: "", durationMin: business.slotDuration, price: "" });
    onUpdated();
  }
  async function remove(id: string) {
    await fetch(`/api/businesses/${business.id}/services/${id}`, { method: "DELETE" });
    onUpdated();
  }
  return (
    <div className="space-y-6">
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input className="border rounded px-3 py-2" placeholder="Service name" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="border rounded px-3 py-2" type="number" placeholder="Duration" value={form.durationMin}
          onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} />
        <input className="border rounded px-3 py-2" placeholder="Price" value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
      </form>
      <ul className="space-y-2">
        {business.services.map((s) => (
          <li key={s.id} className="border rounded p-3 bg-white flex justify-between items-center">
            <div>
              <div className="font-medium">{s.name} {s.price && <span className="text-gray-500 text-sm">({s.price})</span>}</div>
              <div className="text-sm text-gray-600">{s.durationMin} min {s.description && `· ${s.description}`}</div>
            </div>
            <button onClick={() => remove(s.id)} className="text-red-600 text-sm">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HoursTab({ business, onUpdated }: { business: Business; onUpdated: () => void }) {
  const [hours, setHours] = useState(business.hours);
  function update(day: number, field: "startTime" | "endTime", value: string) {
    setHours((prev) => {
      const existing = prev.find((h) => h.dayOfWeek === day);
      if (existing) {
        return prev.map((h) => h.dayOfWeek === day ? { ...h, [field]: value } : h);
      }
      return [...prev, { id: "", dayOfWeek: day, startTime: "09:00", endTime: "17:00", [field]: value }];
    });
  }
  function toggle(day: number, enabled: boolean) {
    if (enabled) {
      setHours((prev) => {
        if (prev.find((h) => h.dayOfWeek === day)) return prev;
        return [...prev, { id: "", dayOfWeek: day, startTime: "09:00", endTime: "17:00" }];
      });
    } else {
      setHours((prev) => prev.filter((h) => h.dayOfWeek !== day));
    }
  }
  async function save() {
    await fetch(`/api/businesses/${business.id}/hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hours.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }))),
    });
    onUpdated();
  }
  return (
    <div className="space-y-4 max-w-xl">
      {DAYS.map((d, idx) => {
        const h = hours.find((x) => x.dayOfWeek === idx);
        const enabled = !!h;
        return (
          <div key={idx} className="flex items-center gap-3">
            <label className="w-12 font-medium">{d}</label>
            <input type="checkbox" checked={enabled} onChange={(e) => toggle(idx, e.target.checked)} />
            {enabled && (
              <>
                <input type="time" className="border rounded px-2 py-1" value={h!.startTime}
                  onChange={(e) => update(idx, "startTime", e.target.value)} />
                <span>to</span>
                <input type="time" className="border rounded px-2 py-1" value={h!.endTime}
                  onChange={(e) => update(idx, "endTime", e.target.value)} />
              </>
            )}
          </div>
        );
      })}
      <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded">Save hours</button>
    </div>
  );
}
