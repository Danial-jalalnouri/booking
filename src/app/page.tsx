import { Logo } from "@/components/brand";

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <a href="/login" className="btn-secondary">Log in</a>
          <a href="/signup" className="btn-primary">Get started</a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-16 pb-20 text-center">
        <span className="pill mb-6 border border-indigo-500/25 bg-indigo-500/10 text-accent">
          ✦ Free & unlimited bookings
        </span>
        <h1 className="mx-auto max-w-3xl text-5xl font-extrabold tracking-tight text-t1 md:text-6xl">
          Appointment booking that <span className="gradient-text">runs itself</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-t2">
          Create your business, define services and available time slots, share your
          booking link, and manage appointments from your dashboard.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href="/signup" className="btn-primary px-6 py-3 text-base">Create your business</a>
          <a href="/login" className="btn-secondary px-6 py-3 text-base">Log in</a>
        </div>

        <div className="card mx-auto mt-16 max-w-4xl p-8 text-left shadow-xl shadow-indigo-950/40">
          <div className="mb-6 flex items-center gap-3">
            <span className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-white text-sm font-bold">TS</span>
            <div>
              <div className="font-semibold">Test Company</div>
              <div className="text-sm text-t3">teaching · 55 min</div>
            </div>
            <span className="pill bg-emerald-500/15 text-ok ml-auto">confirmed</span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {["09:00", "10:00", "10:55", "11:50", "12:45", "14:35", "15:30", "16:25"].map((t, i) => (
              <span key={t} className={`rounded-lg border py-2 text-center text-xs font-medium ${i === 3 ? "bg-[color:var(--btn2-bg)] border-[color:var(--surface-border)] text-t3 line-through" : "border-transparent bg-indigo-500/10 text-accent"}`}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: "🧩", title: "Define what you offer", text: "Services, prices and durations — tailored to your business." },
            { icon: "🗓️", title: "Open the right slots", text: "Weekly hours and slot durations. Clients only see open times." },
            { icon: "🔗", title: "Share one link", text: "Your booking URL works anywhere — everywhere clients are." },
          ].map((f) => (
            <div key={f.title} className="card p-6 hover:-translate-y-0.5 transition hover:shadow-lg hover:shadow-indigo-950/40">
              <div className="mb-3 text-2xl">{f.icon}</div>
              <h3 className="font-semibold text-t1">{f.title}</h3>
              <p className="mt-1 text-sm text-t2">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[color:var(--surface-border)] bg-[color:var(--btn2-bg)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-t3">
          <Logo className="scale-90 origin-left" />
          <span>© 2026 Bookly</span>
        </div>
      </footer>
    </main>
  );
}
