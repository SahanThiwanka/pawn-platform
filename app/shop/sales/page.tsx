"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase.client";
import { collection, doc, getDoc, getDocs, query, updateDoc, where, orderBy, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Row = {
  id: string;
  title: string;
  status: string;
  highestBid?: number;
  winnerUserUid?: string;
  endAt?: any;
};

export default function ShopSalesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
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

      const col = collection(db, "auctions");
      const qA = query(
        col,
        where("shopId", "==", my.shopId),
        where("status", "in", ["ended", "settlement_pending"]),
        orderBy("updatedAt", "desc"),
        limit(50)
      );
      const res = await getDocs(qA);
      setRows(res.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const markSettled = async (id: string) => {
    if (!shopId) return;
    setBusyId(id);
    setMsg(null); setErr(null);
    try {
      await updateDoc(doc(db, "auctions", id), {
        status: "settled",
        updatedAt: new Date()
      });
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: "settled" } : r));
      setMsg("Marked as settled.");
    } catch (e: any) {
      setErr(e?.message || "Failed to update.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading…</div>;

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sales</h1>
        <Link href="/shop/dashboard" className="underline text-sm">Back to Dashboard</Link>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Winning Bid</th>
              <th className="text-left p-3">Winner</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{r.title || "Auction"}</div>
                  <Link href={`/auctions/${r.id}`} className="text-xs underline text-gray-600">View public</Link>
                </td>
                <td className="p-3">{r.status}</td>
                <td className="p-3">{typeof r.highestBid === "number" ? r.highestBid.toFixed(2) : "—"}</td>
                <td className="p-3">
                  {r.winnerUserUid ? <code className="text-xs">{r.winnerUserUid}</code> : "—"}
                </td>
                <td className="p-3 text-right">
                  {r.status !== "settled" ? (
                    <button
                      onClick={() => markSettled(r.id)}
                      disabled={busyId === r.id}
                      className="rounded-lg bg-black text-white px-3 py-1.5 disabled:opacity-50"
                    >
                      {busyId === r.id ? "Saving…" : "Mark as Settled"}
                    </button>
                  ) : (
                    <span className="text-green-700 font-medium">Settled</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-4 text-gray-500" colSpan={5}>No sales yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {msg && <p className="text-green-700 text-sm">{msg}</p>}
      {err && <p className="text-red-700 text-sm">{err}</p>}
    </main>
  );
}
