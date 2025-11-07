"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase.client";
import { collection, getDocs, orderBy, query, where, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UserDashboardPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [wins, setWins] = useState<any[]>([]);
  const [recentBids, setRecentBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");
      setUid(u.uid);

      // auctions I won (or ended with me as winner)
      const aq = query(
        collection(db, "auctions"),
        where("winnerUserUid", "==", u.uid),
        orderBy("updatedAt", "desc"),
        limit(10)
      );
      const ares = await getDocs(aq);
      setWins(ares.docs.map(d => ({ id: d.id, ...(d.data() as any) })));

      // latest bids (count only)
      const bq = query(
        collection(db, "bids"),
        where("userUid", "==", u.uid),
        orderBy("placedAt", "desc"),
        limit(10)
      );
      const bres = await getDocs(bq);
      setRecentBids(bres.docs.map(d => d.data()));

      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading) return <div className="p-8 text-center">Loading…</div>;

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">My Dashboard</h1>

      <div className="rounded-xl border p-4">
        <div className="font-semibold mb-2">Quick Links</div>
        <div className="flex flex-wrap gap-2">
          <Link href="/auctions" className="rounded-lg border px-3 py-1.5 hover:bg-gray-50">Browse Auctions</Link>
          <Link href="/user/auctions" className="rounded-lg border px-3 py-1.5 hover:bg-gray-50">My Auctions</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border p-4">
          <div className="font-semibold mb-2">Auctions I Won</div>
          {wins.length === 0 ? (
            <div className="text-sm text-gray-600">No wins yet.</div>
          ) : (
            <ul className="space-y-2">
              {wins.map(a => (
                <li key={a.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.title || "Auction"}</div>
                    <div className="text-xs text-gray-600">Status: {a.status}</div>
                  </div>
                  <Link href={`/auctions/${a.id}`} className="text-sm underline">View</Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <div className="font-semibold mb-2">Recent Bids</div>
          <div className="text-3xl font-semibold">{recentBids.length}</div>
        </div>
      </div>
    </main>
  );
}
