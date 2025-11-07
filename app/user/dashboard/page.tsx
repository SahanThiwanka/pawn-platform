"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase.client";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  limit,
} from "firebase/firestore";
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

      let winsList: any[] = [];

      try {
        const aq = query(
          collection(db, "auctions"),
          where("winnerUserUid", "==", u.uid),
          orderBy("updatedAt", "desc"),
          limit(10)
        );
        const ares = await getDocs(aq);
        winsList = ares.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      } catch (e: any) {
        console.warn("Index not ready, fallback:", e.message);
        const aq2 = query(
          collection(db, "auctions"),
          where("winnerUserUid", "==", u.uid),
          limit(10)
        );
        const ares2 = await getDocs(aq2);
        winsList = ares2.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .sort(
            (a, b) =>
              (b.updatedAt?.toMillis?.() ?? 0) -
              (a.updatedAt?.toMillis?.() ?? 0)
          );
      }

      setWins(winsList);

      try {
        const bq = query(
          collection(db, "bids"),
          where("userUid", "==", u.uid),
          orderBy("placedAt", "desc"),
          limit(10)
        );
        const bres = await getDocs(bq);
        setRecentBids(bres.docs.map((d) => d.data()));
      } catch (e: any) {
        console.warn("Bids fallback:", e.message);
        const bq2 = query(
          collection(db, "bids"),
          where("userUid", "==", u.uid),
          limit(10)
        );
        const bres2 = await getDocs(bq2);
        setRecentBids(bres2.docs.map((d) => d.data()));
      }

      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 text-center backdrop-blur-md">
          Loading dashboard…
        </div>
      </div>
    );

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* subtle gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-6xl space-y-8 p-6">
        <header>
          <h1 className="text-3xl font-bold text-white">My Dashboard</h1>
          <p className="mt-1 text-sm text-gray-400">
            Manage your bids, auctions, and wins in one place.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-gray-900/70 p-5 shadow-lg backdrop-blur-md">
          <h2 className="mb-3 text-lg font-semibold text-white">Quick Links</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/auctions"
              className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm text-gray-200 transition hover:bg-indigo-600 hover:text-white"
            >
              Browse Auctions
            </Link>
            <Link
              href="/user/auctions"
              className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm text-gray-200 transition hover:bg-indigo-600 hover:text-white"
            >
              My Auctions
            </Link>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Wins */}
          <div className="rounded-2xl border border-white/10 bg-gray-900/70 p-5 shadow-lg backdrop-blur-md">
            <h2 className="mb-3 text-lg font-semibold text-white">
              Auctions I Won
            </h2>
            {wins.length === 0 ? (
              <p className="text-sm text-gray-400">No wins yet.</p>
            ) : (
              <ul className="divide-y divide-white/10">
                {wins.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between py-2 transition hover:bg-gray-800/40"
                  >
                    <div>
                      <div className="font-medium text-gray-100">
                        {a.title || "Auction"}
                      </div>
                      <div className="text-xs text-gray-400">
                        Status: {a.status}
                      </div>
                    </div>
                    <Link
                      href={`/auctions/${a.id}`}
                      className="text-sm text-indigo-400 hover:underline"
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent bids */}
          <div className="rounded-2xl border border-white/10 bg-gray-900/70 p-5 shadow-lg backdrop-blur-md">
            <h2 className="mb-3 text-lg font-semibold text-white">
              Recent Bids
            </h2>
            {recentBids.length === 0 ? (
              <p className="text-sm text-gray-400">No bids placed yet.</p>
            ) : (
              <div>
                <div className="text-5xl font-bold text-indigo-400">
                  {recentBids.length}
                </div>
                <p className="mt-2 text-sm text-gray-400">
                  Total bids placed recently.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
