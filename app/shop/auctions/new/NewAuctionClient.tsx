"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "../../../lib/firebase.client";
import { addDoc, collection, serverTimestamp, getDoc, doc } from "firebase/firestore";

export default function NewAuctionClient() {
  const router = useRouter();
  const search = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [title, setTitle] = useState(search.get("title") || "");
  const [startPrice, setStartPrice] = useState<number>(Number(search.get("startPrice") || 0));
  const [startAt, setStartAt] = useState<string>("");
  const [endAt, setEndAt] = useState<string>("");

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      // optional: validate role and shopId
      const me = await getDoc(doc(db, "users", u.uid));
      const my = me.data();
      if (my?.role !== "shop_admin" || !my.shopId) return router.replace("/dashboard");
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!title || !startAt || !endAt) {
      setErr("Please fill all required fields.");
      return;
    }

    const s = new Date(startAt);
    const eTime = new Date(endAt);
    if (isNaN(s.getTime()) || isNaN(eTime.getTime()) || s >= eTime) {
      setErr("Start time must be before end time.");
      return;
    }

    const u = auth.currentUser;
    if (!u) return setErr("Not authenticated.");

    try {
      const me = await getDoc(doc(db, "users", u.uid));
      const my = me.data();
      const shopId = my?.shopId ?? null;

      await addDoc(collection(db, "auctions"), {
        title,
        startPrice: Number(startPrice || 0),
        status: "scheduled",
        startAt: s,
        endAt: eTime,
        highestBid: 0,
        reservePrice: 0,
        images: [],
        shopId,
        createdBy: u.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMsg("Auction created successfully!");
      setTimeout(() => router.replace("/shop/auctions"), 800);
    } catch (e: any) {
      setErr(e?.message || "Failed to create auction.");
    }
  };

  if (loading)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading form…
        </div>
      </div>
    );

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* gradient glow background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-3xl p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Create Auction</h1>
          <button
            onClick={() => router.back()}
            className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm text-gray-200 hover:bg-indigo-600 hover:text-white transition"
          >
            Back
          </button>
        </div>

        <form
          onSubmit={submit}
          className="space-y-6 rounded-2xl border border-white/10 bg-gray-900/70 p-6 backdrop-blur-md"
        >
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title *</label>
            <input
              className="w-full rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., 22K Gold Necklace"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Start Price (LKR) *</label>
            <input
              type="number"
              className="w-full rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={startPrice}
              onChange={(e) => setStartPrice(Number(e.target.value))}
              min={0}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Start At (local) *</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">End At (local) *</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <button
              className="rounded-xl bg-indigo-600 px-6 py-2 text-white font-medium hover:opacity-90 transition"
              type="submit"
            >
              Create Auction
            </button>
            {err && <p className="text-sm text-red-400">{err}</p>}
            {msg && <p className="text-sm text-emerald-400">{msg}</p>}
          </div>
        </form>
      </main>
    </div>
  );
}
