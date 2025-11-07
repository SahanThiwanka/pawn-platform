"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase.client";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ShopDashboardPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    live: 0,
    scheduled: 0,
    ended: 0,
    settlementPending: 0,
    settled: 0,
  });
  const [loading, setLoading] = useState(true);

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
      const st = {
        live: 0,
        scheduled: 0,
        ended: 0,
        settlementPending: 0,
        settled: 0,
      };

      const [qlive, qsched, qend, qpend, qset] = await Promise.all([
        getDocs(query(col, where("shopId", "==", my.shopId), where("status", "==", "live"))),
        getDocs(query(col, where("shopId", "==", my.shopId), where("status", "==", "scheduled"))),
        getDocs(query(col, where("shopId", "==", my.shopId), where("status", "==", "ended"))),
        getDocs(query(col, where("shopId", "==", my.shopId), where("status", "==", "settlement_pending"))),
        getDocs(query(col, where("shopId", "==", my.shopId), where("status", "==", "settled"))),
      ]);

      st.live = qlive.size;
      st.scheduled = qsched.size;
      st.ended = qend.size;
      st.settlementPending = qpend.size;
      st.settled = qset.size;

      setStats(st);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading dashboard…
        </div>
      </div>
    );
  }

  const Tile = ({
    label,
    value,
    href,
    color,
  }: {
    label: string;
    value: number;
    href: string;
    color: string;
  }) => (
    <Link
      href={href}
      className={`group rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md p-4 text-center transition hover:-translate-y-1 hover:shadow-lg hover:shadow-${color}-500/20`}
    >
      <div className="text-sm text-gray-400">{label}</div>
      <div className={`text-3xl font-bold text-${color}-400 group-hover:scale-110 transition-transform`}>
        {value}
      </div>
    </Link>
  );

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-6xl p-6 space-y-8">
        <h1 className="text-3xl font-bold">Shop Dashboard</h1>

        {/* Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Tile label="Live" value={stats.live} href="/shop/auctions" color="emerald" />
          <Tile label="Scheduled" value={stats.scheduled} href="/shop/auctions" color="sky" />
          <Tile label="Ended" value={stats.ended} href="/shop/sales" color="amber" />
          <Tile label="Pending Settlement" value={stats.settlementPending} href="/shop/sales" color="pink" />
          <Tile label="Settled" value={stats.settled} href="/shop/sales" color="violet" />
        </div>

        {/* Quick actions */}
        <section className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md p-5 space-y-3">
          <h2 className="font-semibold text-lg">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/shop/loans"
              className="rounded-lg border border-white/10 bg-gray-800/70 px-4 py-2 text-sm hover:bg-indigo-600 hover:text-white transition"
            >
              Manage Loans
            </Link>
            <Link
              href="/shop/auctions"
              className="rounded-lg border border-white/10 bg-gray-800/70 px-4 py-2 text-sm hover:bg-sky-600 hover:text-white transition"
            >
              Manage Auctions
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
