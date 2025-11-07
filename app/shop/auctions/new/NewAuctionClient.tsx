"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "../../../lib/firebase.client";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export default function NewAuctionClient() {
  const router = useRouter();
  const search = useSearchParams(); // SAFE now (inside Suspense)
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // simple form state
  const [title, setTitle] = useState(search.get("title") || "");
  const [startPrice, setStartPrice] = useState<number>(
    Number(search.get("startPrice") || 0)
  );
  const [startAt, setStartAt] = useState<string>("");
  const [endAt, setEndAt] = useState<string>("");

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");
      // (optional) you can check role/shopId here if needed
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
      // NOTE: add shopId from the logged-in shop profile if you store it
      await addDoc(collection(db, "auctions"), {
        title,
        startPrice: Number(startPrice || 0),
        status: "scheduled",
        startAt: s,
        endAt: eTime,
        highestBid: 0,
        reservePrice: 0,
        images: [],
        shopId: null, // TODO: populate with your shopId if applicable
        createdBy: u.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMsg("Auction created.");
      router.replace("/shop/auctions");
    } catch (e: any) {
      setErr(e?.message || "Failed to create auction.");
    }
  };

  if (loading) return <div className="p-8">Loading…</div>;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Create Auction</h1>

      <form onSubmit={submit} className="space-y-4 rounded-xl border p-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Title *
          </label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., 22K Gold Necklace"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Start Price *
          </label>
          <input
            type="number"
            className="w-full border rounded-lg px-3 py-2"
            value={startPrice}
            onChange={(e) => setStartPrice(Number(e.target.value))}
            min={0}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Start At (local) *
            </label>
            <input
              type="datetime-local"
              className="w-full border rounded-lg px-3 py-2"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              End At (local) *
            </label>
            <input
              type="datetime-local"
              className="w-full border rounded-lg px-3 py-2"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded-lg bg-black text-white px-4 py-2">
            Create
          </button>
          {err && <span className="text-sm text-red-600">{err}</span>}
          {msg && <span className="text-sm text-green-700">{msg}</span>}
        </div>
      </form>
    </main>
  );
}
