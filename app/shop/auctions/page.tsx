"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase.client";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";

type Auction = {
  id: string;
  title?: string;
  images?: string[];
  status: "scheduled" | "live" | "ended" | "settled" | "settlement_pending" | string;
  startAt?: any;
  endAt?: any;
  updatedAt?: any;
  startPrice?: number;
};

function toDateAny(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return null;
}

function fmtLKR(n?: number) {
  if (typeof n !== "number") return "";
  try {
    return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

export default function ShopAuctionsPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState<string | null>(null);
  const [rows, setRows] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<
    "scheduled" | "live" | "ended" | "settled" | "settlement_pending"
  >("scheduled");

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const me = await getDoc(doc(db, "users", u.uid));
      const my = me.data() as any;
      if (my?.role !== "shop_admin" || !my.shopId) return router.replace("/dashboard");
      setShopId(my.shopId);

      // no orderBy → no composite index required
      const col = collection(db, "auctions");
      const qAll = query(col, where("shopId", "==", my.shopId), limit(200));
      const res = await getDocs(qAll);
      const all = res.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setRows(all as Auction[]);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const filtered = useMemo(() => rows.filter((r) => r.status === tab), [rows, tab]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (tab === "scheduled") {
      arr.sort(
        (a, b) =>
          (toDateAny(a.startAt)?.getTime() ?? 0) -
          (toDateAny(b.startAt)?.getTime() ?? 0)
      );
    } else if (tab === "live") {
      arr.sort(
        (a, b) =>
          (toDateAny(a.endAt)?.getTime() ?? 0) -
          (toDateAny(b.endAt)?.getTime() ?? 0)
      );
    } else {
      arr.sort(
        (a, b) =>
          (toDateAny(b.updatedAt)?.getTime() ?? 0) -
          (toDateAny(a.updatedAt)?.getTime() ?? 0)
      );
    }
    return arr;
  }, [filtered, tab]);

  if (loading) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />
      <main className="relative z-10 max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Shop Auctions</h1>
          <Link
            href="/shop/auctions/new"
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
          >
            New Auction
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {(["scheduled","live","ended","settlement_pending","settled"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-sm transition
                ${tab === t
                  ? "bg-white text-gray-900"
                  : "border border-white/10 bg-gray-900/60 text-gray-200 hover:bg-gray-800/60"
                }`}
            >
              {t.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Table */}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 text-gray-300">
              <tr className="border-b border-white/10">
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">Title</th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">Status</th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">Start</th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">End</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => (
                <tr key={a.id} className="border-t border-white/10 hover:bg-gray-800/40 transition">
                  <td className="p-3">
                    <div className="font-medium">{a.title || "Auction"}</div>
                    <div className="text-xs text-gray-400">
                      {typeof a.startPrice === "number" && `Start Price: ${fmtLKR(a.startPrice)}`}
                    </div>
                  </td>
                  <td className="p-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="p-3">
                    {toDateAny(a.startAt)?.toLocaleString?.() || "—"}
                  </td>
                  <td className="p-3">
                    {toDateAny(a.endAt)?.toLocaleString?.() || "—"}
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/auctions/${a.id}`}
                      className="rounded-xl bg-indigo-600 px-3 py-1.5 text-white hover:opacity-90"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-gray-400" colSpan={5}>
                    No auctions in this status.
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

/* Status badge */
function StatusBadge({ status }: { status: string }) {
  const cls =
    {
      live: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
      scheduled: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
      ended: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
      settlement_pending: "bg-pink-500/15 text-pink-300 ring-1 ring-pink-500/30",
      settled: "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30",
    }[status?.toLowerCase?.()] || "bg-gray-600/15 text-gray-300 ring-1 ring-gray-600/30";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      {status.replace("_", " ")}
    </span>
  );
}
