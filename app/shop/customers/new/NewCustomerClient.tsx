"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase.client";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isNIC(v: string) {
  return /^(\d{9}[VvXx]|\d{12})$/.test(v);
}

export default function NewCustomerClient() {
  const router = useRouter();

  const [shopId, setShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [nicNumber, setNicNumber] = useState("");
  const [phone, setPhone] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const meSnap = await getDoc(doc(db, "users", u.uid));
      const me = meSnap.data() as any;
      if (me?.role !== "shop_admin" || !me?.shopId) {
        return router.replace("/dashboard");
      }
      setShopId(me.shopId);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!shopId) return;

    if (!email || !isEmail(email)) return setErr("Please enter a valid email.");
    if (!nicNumber || !isNIC(nicNumber))
      return setErr("Enter a valid NIC number (e.g., 123456789V or 12 digits).");
    if (!fullName.trim()) return setErr("Please enter the customer's full name.");

    try {
      setSaving(true);
      await addDoc(collection(db, "shops", shopId, "customers"), {
        fullName: fullName.trim(),
        email: email.toLowerCase(),
        nicNumber: nicNumber.trim().toUpperCase(),
        phone: phone.trim() || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "active",
      });
      setMsg("Customer added.");
      router.replace("/shop/customers");
    } catch (e: any) {
      setErr(e?.message || "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <div className="p-8 text-center text-gray-400">Loading…</div>;

  return (
    <main className="relative max-w-3xl mx-auto p-6 space-y-8 text-gray-100">
      {/* background glow */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/20 via-cyan-400/10 to-transparent opacity-40 blur-3xl" />

      {/* Header */}
      <h1 className="relative text-3xl font-bold bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
        Add Customer
      </h1>

      {/* Form */}
      <form
        onSubmit={submit}
        className="relative space-y-5 rounded-xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-6 shadow-lg"
      >
        <div>
          <label className="block text-sm text-gray-400 mb-1">Full Name *</label>
          <input
            className="w-full bg-gray-800/70 border border-white/10 rounded-lg px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Customer full name"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Email *</label>
          <input
            type="email"
            className="w-full bg-gray-800/70 border border-white/10 rounded-lg px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@example.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">NIC Number *</label>
          <input
            className="w-full bg-gray-800/70 border border-white/10 rounded-lg px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={nicNumber}
            onChange={(e) => setNicNumber(e.target.value)}
            placeholder="123456789V or 200012345678"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Old: 9 digits + V/X (e.g., 123456789V). New: 12 digits.
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Phone</label>
          <input
            className="w-full bg-gray-800/70 border border-white/10 rounded-lg px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+94 7X XXX XXXX"
          />
        </div>

        {/* Buttons and messages */}
        <div className="flex items-center gap-3">
          <button
            disabled={saving}
            className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Customer"}
          </button>
          {err && <span className="text-sm text-red-400">{err}</span>}
          {msg && <span className="text-sm text-green-400">{msg}</span>}
        </div>
      </form>
    </main>
  );
}
