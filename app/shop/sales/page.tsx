"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase.client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
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
      if (my?.role !== "shop_admin" || !my.shopId)
        return router.replace("/dashboard");
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
      setRows(res.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const markSettled = async (id: string) => {
    if (!shopId) return;
    setBusyId(id);
    setMsg(null);
    setErr(null);
    try {
      await updateDoc(doc(db, "auctions", id), {
        status: "settled",
        updatedAt: new Date(),
      });
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "settled" } : r))
      );
      setMsg("Marked as settled.");
    } catch (e: any) {
      setErr(e?.message || "Failed to update.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading sales…
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* glowing gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-6xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Sales</h1>
          <Link
            href="/shop/dashboard"
            className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm text-gray-200 hover:bg-indigo-600 hover:text-white transition"
          >
            Back to Dashboard
          </Link>
        </div>

        <section className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 text-gray-300">
              <tr className="border-b border-white/10">
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">
                  Title
                </th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">
                  Status
                </th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">
                  Winning Bid
                </th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">
                  Winner UID
                </th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-white/10 hover:bg-gray-800/40 transition"
                >
                  <td className="p-3">
                    <div className="font-medium">{r.title || "Auction"}</div>
                    <Link
                      href={`/auctions/${r.id}`}
                      className="text-xs text-indigo-400 underline hover:text-indigo-300"
                    >
                      View public
                    </Link>
                  </td>
                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-3">
                    {typeof r.highestBid === "number"
                      ? r.highestBid.toFixed(2)
                      : "—"}
                  </td>
                  <td className="p-3 font-mono text-xs text-gray-400">
                    {r.winnerUserUid ?? "—"}
                  </td>
                  <td className="p-3 text-right">
                    {r.status !== "settled" ? (
                      <button
                        onClick={() => markSettled(r.id)}
                        disabled={busyId === r.id}
                        className="rounded-xl bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                      >
                        {busyId === r.id ? "Saving…" : "Mark Settled"}
                      </button>
                    ) : (
                      <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/30">
                        Settled
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-6 text-center text-gray-400"
                  >
                    No sales yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

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
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ended: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
    settlement_pending:
      "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30 animate-pulse",
    settled: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  };
  const cls =
    map[status?.toLowerCase?.()] ||
    "bg-gray-500/20 text-gray-300 ring-1 ring-gray-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${cls}`}
    >
      {status}
    </span>
  );
}
