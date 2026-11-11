"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthFrame } from "@/components/brand";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Login failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthFrame>
      <h1 className="text-2xl font-bold text-t1">Welcome back</h1>
      <p className="mt-1 text-sm text-t3">Log in to manage your bookings.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="input-label">Email</label>
          <input className="input" type="email" placeholder="you@business.com" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div>
          <label className="input-label">Password</label>
          <input className="input" type="password" placeholder="••••••••" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </div>
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <button disabled={loading} className="btn-primary w-full py-3">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-t3">
        New here? <a className="link" href="/signup">Create an account</a>
      </p>
    </AuthFrame>
  );
}
