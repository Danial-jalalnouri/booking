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

  if (loading)
    return (
      <main className="p-20 text-center text-t3">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--spinner-track)] border-t-indigo-400" />
        <p className="mt-4 text-sm">Loading your dashboard…</p>
      </main>
    );

  if (businesses.length === 0) {
    return (
      <main className="max-w-xl mx-auto px-6 py-20">
        <div className="card p-10">
          <span className="brand-gradient mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl text-white shadow-lg shadow-indigo-600/25">🚀</span>
          <h1 className="text-center text-2xl font-bold text-t1">Welcome aboard</h1>
          <p className="mt-2 text-center text-sm text-t3">Create your first business to start accepting bookings.</p>
          <form onSubmit={createBusiness} className="mt-8 space-y-4">
            <div>
              <label className="input-label">Business name</label>
              <input className="input" placeholder="Glow Salon" value={newBiz.name}
                onChange={(e) => setNewBiz({ ...newBiz, name: e.target.value })} required />
            </div>
            <div>
              <label className="input-label">Booking URL slug</label>
              <div className="flex items-center rounded-xl bg-[color:var(--input-bg)] border border-[color:var(--input-border)] shadow-sm focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/20">
                <span className="pl-3.5 text-sm text-t3">/book/</span>
                <input className="w-full bg-transparent px-1.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none"
                  placeholder="glow-salon" value={newBiz.slug}
                  onChange={(e) => setNewBiz({ ...newBiz, slug: e.target.value.toLowerCase() })} required />
              </div>
            </div>
            <div>
              <label className="input-label">Description (optional)</label>
              <textarea className="input" placeholder="What do you offer?" value={newBiz.description}
                onChange={(e) => setNewBiz({ ...newBiz, description: e.target.value })} />
            </div>
            <div>
              <label className="input-label">Slot duration (minutes)</label>
              <input className="input" type="number" value={newBiz.slotDuration}
                onChange={(e) => setNewBiz({ ...newBiz, slotDuration: Number(e.target.value) })} />
            </div>
            {bizError && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-danger">{bizError}</p>}
            <button className="btn-primary w-full py-3">
              {loading ? "Creating…" : "Create business"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3.5 sm:gap-4 sm:px-6">
          <span className="inline-flex items-center gap-2 shrink-0">
            <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-md shadow-indigo-600/25">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4"><rect x="3.5" y="5" width="17" height="15.5" rx="3" stroke="currentColor" strokeWidth="1.8" /><path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.8" /></svg>
            </span>
            <span className="text-lg font-bold tracking-tight text-t1">Bookly</span>
          </span>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <select
              className="input w-32 min-w-0 py-2 text-xs sm:w-auto sm:max-w-[240px] sm:text-sm"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.slug})</option>
              ))}
            </select>
            <button onClick={logout} className="btn-secondary shrink-0 px-3.5 py-2 text-xs">Log out</button>
          </div>

          <nav className="order-last -mx-1 inline-flex w-full overflow-x-auto rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--btn2-bg)] p-1 shadow-sm sm:order-none sm:mx-0 sm:w-auto sm:overflow-visible sm:ml-4">
            {(["bookings", "settings", "services", "hours"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition sm:px-4 ${
                  tab === t
                    ? "bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-600/25"
                    : "text-t3 hover:text-t1"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        {selected && (
          <a
            className="pill mb-6 inline-flex border border-indigo-500/25 bg-indigo-500/10 text-accent transition hover:bg-indigo-500/20"
            href={`/book/${selected.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            🔗 /book/{selected.slug}
          </a>
        )}

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
  const initials = (name: string) =>
    name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-t1">
          Bookings <span className="ml-1 text-sm font-normal text-t3">({bookings.length})</span>
        </h2>
        <button onClick={onRefresh} className="btn-secondary px-3.5 py-1.5 text-xs">↻ Refresh</button>
      </div>
      {bookings.length === 0 && (
        <div className="card p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10 text-2xl">📭</div>
          <p className="font-medium text-t1">No bookings yet</p>
          <p className="mt-1 text-sm text-t3">Share your booking URL and appointments will show up here.</p>
        </div>
      )}
      <ul className="space-y-3">
        {bookings.map((b) => (
          <li key={b.id} className="card flex flex-wrap items-center gap-4 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-sm font-bold text-accent">
              {initials(b.customerName)}
            </span>
            <div className="min-w-[180px]">
              <div className="font-semibold text-t1">{b.customerName}</div>
              <div className="text-xs text-t3">{b.customerEmail}{b.customerPhone && ` · ${b.customerPhone}`}</div>
            </div>
            <div className="h-8 w-px bg-line" />
            <div>
              <div className="text-sm font-medium text-t2">{b.service.name}</div>
              <div className="text-xs text-t3">{b.business.name}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-sm font-semibold text-t2">
                {new Date(b.startTime).toLocaleDateString([], { month: "short", day: "numeric" })} ·{" "}
                {new Date(b.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <span className="pill mt-1 bg-emerald-500/15 text-ok">{b.status}</span>
            </div>
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
    <form onSubmit={save} className="card max-w-lg space-y-5 p-8">
      <div>
        <label className="input-label">Name</label>
        <input className="input" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="input-label">Description</label>
        <textarea className="input" value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div>
        <label className="input-label">Slot duration (minutes)</label>
        <input className="input max-w-32" type="number" value={form.slotDuration}
          onChange={(e) => setForm({ ...form, slotDuration: Number(e.target.value) })} />
      </div>
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-accent">Booking URL</div>
        <p className="mt-1 font-mono text-sm text-t2">/book/{business.slug}</p>
      </div>
      <button disabled={saving} className="btn-primary px-6">
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

function ServicesTab({ business, onUpdated }: { business: Business; onUpdated: () => void }) {
  const [form, setForm] = useState({ name: "", description: "", durationMin: business.slotDuration, price: "" });
  const [adding, setAdding] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    await fetch(`/api/businesses/${business.id}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setAdding(false);
    setForm({ name: "", description: "", durationMin: business.slotDuration, price: "" });
    onUpdated();
  }
  async function remove(id: string) {
    await fetch(`/api/businesses/${business.id}/services/${id}`, { method: "DELETE" });
    onUpdated();
  }
  return (
    <div className="space-y-6">
      <form onSubmit={add} className="card flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-48 flex-1">
          <label className="input-label">Service name</label>
          <input className="input" placeholder="e.g. Consultation" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="w-28">
          <label className="input-label">Duration</label>
          <input className="input" type="number" placeholder="min" value={form.durationMin}
            onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} />
        </div>
        <div className="w-28">
          <label className="input-label">Price</label>
          <input className="input" placeholder="$0" value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
        <button disabled={adding} className="btn-primary">
          {adding ? "Adding…" : "+ Add service"}
        </button>
      </form>
      {business.services.length === 0 && (
        <div className="card p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10 text-2xl">✂️</div>
          <p className="font-medium text-t1">No services yet</p>
          <p className="mt-1 text-sm text-t3">Add your first service so clients can book it.</p>
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {business.services.map((s) => (
          <li key={s.id} className="card group flex items-center justify-between p-5">
            <div>
              <div className="font-semibold text-t1">
                {s.name}
                {s.price && <span className="ml-2 text-sm font-medium text-accent">{s.price}</span>}
              </div>
              <div className="mt-0.5 text-xs text-t3">{s.durationMin} min{s.description && ` · ${s.description}`}</div>
            </div>
            <button onClick={() => remove(s.id)} className="btn-danger opacity-70 hover:opacity-100">🗑 Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HoursTab({ business, onUpdated }: { business: Business; onUpdated: () => void }) {
  const [hours, setHours] = useState(business.hours);
  const [saving, setSaving] = useState(false);
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
    setSaving(true);
    await fetch(`/api/businesses/${business.id}/hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hours.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }))),
    });
    setSaving(false);
    onUpdated();
  }
  return (
    <div className="card max-w-2xl space-y-1.5 p-6">
      <div className="grid grid-cols-[3rem_1fr] gap-3">
        {DAYS.map((d, idx) => {
          const h = hours.find((x) => x.dayOfWeek === idx);
          const enabled = !!h;
          return (
            <div key={idx} className={`col-span-2 grid grid-cols-[3rem_1fr] items-center gap-x-3 gap-y-2 rounded-xl px-3 py-2.5 transition sm:grid-cols-[3rem_1fr_5fr] ${enabled ? "bg-indigo-500/10" : ""}`}>
              <label className="font-semibold text-t2">{d}</label>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" className="peer sr-only" checked={enabled}
                  onChange={(e) => toggle(idx, e.target.checked)} />
                <div className="h-5.5 w-9 rounded-full bg-slate-600 transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-4.5 after:w-4.5 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:bg-indigo-600 peer-checked:after:translate-x-3.5" />
              </label>
              {enabled && (
                <div className="col-start-2 flex items-center gap-2 sm:col-start-3">
                  <input type="time" className="input w-20 px-2.5 py-1.5 text-xs sm:w-auto sm:max-w-[105px]" value={h!.startTime}
                    onChange={(e) => update(idx, "startTime", e.target.value)} />
                  <span className="text-xs text-t3">→</span>
                  <input type="time" className="input w-20 px-2.5 py-1.5 text-xs sm:w-auto sm:max-w-[105px]" value={h!.endTime}
                    onChange={(e) => update(idx, "endTime", e.target.value)} />
                </div>
              )}
              {!enabled && <span className="col-start-2 text-xs text-t3 sm:col-start-3">Closed</span>}
            </div>
          );
        })}
      </div>
      <div className="pt-4">
        <button onClick={save} disabled={saving} className="btn-primary px-6">
          {saving ? "Saving…" : "Save hours"}
        </button>
      </div>
    </div>
  );
}
