"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "../../../lib/firebase.client";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";

export default function NewAuctionPage() {
  const router = useRouter();
  const params = useSearchParams();
  const collateralId = params.get("collateralId");

  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState<string | null>(null);
  const [collateral, setCollateral] = useState<any>(null);

  const [title, setTitle] = useState("");
  const [startPrice, setStartPrice] = useState<number>(0);
  const [reservePrice, setReservePrice] = useState<number>(0);
  const [startAt, setStartAt] = useState<string>(""); // ISO local datetime string
  const [endAt, setEndAt] = useState<string>("");

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const me = await getDoc(doc(db, "users", u.uid));
      const my = me.data();
      if (my?.role !== "shop_admin" || !my.shopId) return router.replace("/dashboard");
      setShopId(my.shopId);

      if (!collateralId) return router.replace("/shop/loans");

      const cSnap = await getDoc(doc(db, "collaterals", collateralId));
      const c = cSnap.data();
      if (!c || c.shopId !== my.shopId) return router.replace("/shop/loans");
      setCollateral({ id: collateralId, ...c });
      setTitle(c.title ?? "Auction Item");
      setLoading(false);
    });
    return () => unsub();
  }, [router, collateralId]);

  const createAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!shopId || !collateral) return;

    // Convert local datetime inputs to Date
    const sAt = startAt ? new Date(startAt) : new Date(Date.now() + 60 * 60 * 1000);
    const eAt = endAt ? new Date(endAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const ref = await addDoc(collection(db, "auctions"), {
      shopId,
      collateralId: collateral.id,
      title,
      images: collateral.images ?? [],
      startPrice: Number(startPrice || 0),
      reservePrice: Number(reservePrice || 0),
      startAt: sAt,
      endAt: eAt,
      status: "scheduled",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setMsg("Auction created.");
    // optional: update collateral status
    // await updateDoc(doc(db, "collaterals", collateral.id), { status: "auctioned", updatedAt: serverTimestamp() });
    setTimeout(() => router.replace(`/shop/loans`), 800);
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!collateral) return <div className="p-8 text-center">Not found</div>;

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Create Auction</h1>
      <p className="text-sm text-gray-600">Collateral: <b>{collateral.title}</b></p>

      <form onSubmit={createAuction} className="space-y-3">
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Title"
          value={title}
          onChange={(e)=>setTitle(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number" step="0.01" min="0"
            className="border rounded-lg px-3 py-2"
            placeholder="Start price"
            value={startPrice}
            onChange={(e)=>setStartPrice(Number(e.target.value))}
          />
          <input
            type="number" step="0.01" min="0"
            className="border rounded-lg px-3 py-2"
            placeholder="Reserve price"
            value={reservePrice}
            onChange={(e)=>setReservePrice(Number(e.target.value))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Start at</label>
            <input
              type="datetime-local"
              className="w-full border rounded-lg px-3 py-2"
              value={startAt}
              onChange={(e)=>setStartAt(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">End at</label>
            <input
              type="datetime-local"
              className="w-full border rounded-lg px-3 py-2"
              value={endAt}
              onChange={(e)=>setEndAt(e.target.value)}
            />
          </div>
        </div>

        <button className="rounded-lg bg-black text-white px-4 py-2">Create Auction</button>
      </form>

      {msg && <p className="text-green-600 text-sm">{msg}</p>}
      {err && <p className="text-red-600 text-sm">{err}</p>}
    </main>
  );
}
