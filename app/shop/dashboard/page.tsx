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
      if (my?.role !== "shop_admin" || !my.shopId) return router.replace("/dashboard");
      setShopId(my.shopId);

      const col = collection(db, "auctions");
      const st = { live: 0, scheduled: 0, ended: 0, settlementPending: 0, settled: 0 };

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

  if (loading) return <div className="p-8 text-center">Loading…</div>;

  const Tile = ({ label, value, href }: { label: string; value: number; href: string }) => (
    <Link href={href} className="rounded-xl border p-4 hover:shadow-sm">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </Link>
  );

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Shop Dashboard</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Tile label="Live" value={stats.live} href="/shop/auctions" />
        <Tile label="Scheduled" value={stats.scheduled} href="/shop/auctions" />
        <Tile label="Ended" value={stats.ended} href="/shop/sales" />
        <Tile label="Pending Settlement" value={stats.settlementPending} href="/shop/sales" />
        <Tile label="Settled" value={stats.settled} href="/shop/sales" />
      </div>

      <div className="rounded-xl border p-4 space-y-2">
        <div className="font-semibold">Quick Actions</div>
        <div className="flex flex-wrap gap-2">
          <Link href="/shop/loans" className="rounded-lg border px-3 py-1.5 hover:bg-gray-50">Manage Loans</Link>
          <Link href="/shop/auctions" className="rounded-lg border px-3 py-1.5 hover:bg-gray-50">Manage Auctions</Link>
        </div>
      </div>
    </main>
  );
}
