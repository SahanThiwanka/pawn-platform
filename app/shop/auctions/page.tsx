"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase.client";
import { collection, getDocs, orderBy, query, where, doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toDateAny } from "../../lib/auction";

type A = { id: string; title: string; status: string; startAt?: any; endAt?: any };

export default function ShopAuctionsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<A[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const me = await getDoc(doc(db, "users", u.uid));
      const my = me.data();
      if (my?.role !== "shop_admin" || !my.shopId) return router.replace("/dashboard");

      const qA = query(
        collection(db, "auctions"),
        where("shopId", "==", my.shopId),
        orderBy("startAt", "desc")
      );
      const res = await getDocs(qA);
      setRows(res.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading auctions…
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-5xl p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Auctions</h1>
          <div className="flex gap-2">
            <Link
              href="/shop/loans"
              className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm hover:bg-indigo-600 hover:text-white transition"
            >
              Back to Loans
            </Link>
            <Link
              href="/shop/auctions/new"
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              New Auction
            </Link>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 text-gray-300">
              <tr className="border-b border-white/10">
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">Title</th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">Status</th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">Start</th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">End</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr
                  key={a.id}
                  className="border-t border-white/10 hover:bg-gray-800/40 transition"
                >
                  <td className="p-3">{a.title || "Auction"}</td>
                  <td className="p-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="p-3 text-gray-300">
                    {toDateAny(a.startAt)?.toLocaleString() ?? "—"}
                  </td>
                  <td className="p-3 text-gray-300">
                    {toDateAny(a.endAt)?.toLocaleString() ?? "—"}
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/auctions/${a.id}`}
                      className="rounded-xl bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
                    >
                      View Public Page
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-400">
                    No auctions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
    live: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 animate-pulse",
    ended: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
    settlement_pending: "bg-pink-500/15 text-pink-300 ring-1 ring-pink-500/30",
    settled: "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30",
    default: "bg-gray-500/15 text-gray-300 ring-1 ring-gray-500/30",
  };
  const cls = map[status?.toLowerCase?.()] || map.default;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
