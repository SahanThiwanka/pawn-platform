"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../../lib/firebase.client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  addDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UserJoinShopPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");
      const me = await getDoc(doc(db, "users", u.uid));
      if (me.data()?.role !== "user") return router.replace("/dashboard");
    });
    return () => unsub();
  }, [router]);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setLoading(true);

    const u = auth.currentUser;
    if (!u) return router.replace("/login");

    try {
      const q = query(collection(db, "shops"), where("joinCode", "==", code.trim()));
      const res = await getDocs(q);
      if (res.empty) {
        setErr("Invalid shop code. Please double-check and try again.");
        return;
      }

      const shopId = res.docs[0].id;

      await addDoc(collection(db, "memberships"), {
        userId: u.uid,
        shopId,
        status: "active",
        createdBy: "user",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMsg("Successfully joined! Redirecting…");
      setTimeout(() => router.replace("/user/shops"), 700);
    } catch (e: any) {
      setErr(e.message ?? "Error joining shop.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-md p-6 space-y-6">
        <h1 className="text-3xl font-bold text-center">Join a Shop</h1>

        <form
          onSubmit={join}
          className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md p-6 space-y-4"
        >
          <label className="block text-sm text-gray-300">
            Enter the 6-digit code provided by the shop
          </label>
          <input
            className="w-full rounded-xl border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. 123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-2 font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Joining…" : "Join Shop"}
          </button>

          {msg && (
            <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              {msg}
            </p>
          )}
          {err && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {err}
            </p>
          )}
        </form>

        <div className="text-center">
          <Link
            href="/user/shops"
            className="text-sm text-indigo-400 hover:text-indigo-300 underline"
          >
            Back to My Shops
          </Link>
        </div>
      </main>
    </div>
  );
}
