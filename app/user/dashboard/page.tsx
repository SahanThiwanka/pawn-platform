"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase.client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

// helpers
function toDateAny(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return null;
}
const fmtMoney = (n?: number) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function UserDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // data
  const [wins, setWins] = useState<any[]>([]);
  const [recentBids, setRecentBids] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [collaterals, setCollaterals] = useState<any[]>([]);

  // name caches
  const [shopNames, setShopNames] = useState<Record<string, string>>({});
  const [collateralTitles, setCollateralTitles] = useState<
    Record<string, string>
  >({});

  // --- resolvers (robust) ---
  const resolveShopName = async (sid: string) => {
    if (!sid) return "";
    if (shopNames[sid]) return shopNames[sid];
    let name: string | null = null;
    try {
      const userSnap = await getDoc(doc(db, "users", sid));
      if (userSnap.exists()) {
        const u = userSnap.data() as any;
        if (u?.role === "shop_admin") {
          name = u.shopName || u.displayName || u.email || sid;
        }
      }
    } catch {}
    if (!name) {
      try {
        const res = await getDocs(
          query(collection(db, "users"), where("shopId", "==", sid), limit(1))
        );
        const u = res.docs[0]?.data() as any;
        if (u) name = u.shopName || u.displayName || u.email || sid;
      } catch {}
    }
    if (!name) {
      try {
        const sSnap = await getDoc(doc(db, "shops", sid));
        if (sSnap.exists()) {
          const s = sSnap.data() as any;
          name = s?.name || s?.shopName || sid;
        }
      } catch {}
    }
    if (!name) name = sid;
    setShopNames((m) => ({ ...m, [sid]: name! }));
    return name!;
  };

  const resolveCollateralTitle = async (collateralId: string) => {
    if (!collateralId) return "";
    if (collateralTitles[collateralId]) return collateralTitles[collateralId];
    try {
      const snap = await getDoc(doc(db, "collaterals", collateralId));
      const title = snap.exists()
        ? (snap.data() as any).title || collateralId
        : collateralId;
      setCollateralTitles((m) => ({ ...m, [collateralId]: String(title) }));
      return title;
    } catch {
      setCollateralTitles((m) => ({ ...m, [collateralId]: collateralId }));
      return collateralId;
    }
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      let winsList: any[] = [];
      try {
        const qWins = query(
          collection(db, "auctions"),
          where("winnerUserUid", "==", u.uid),
          limit(20)
        );
        const w = await getDocs(qWins);
        winsList = w.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setWins(winsList);
      } catch {
        setWins([]);
      }

      let recent: any[] = [];
      try {
        const qB = query(
          collection(db, "bids"),
          where("userUid", "==", u.uid),
          limit(50)
        );
        const b = await getDocs(qB);
        const seen = new Set<string>();
        for (const d of b.docs) {
          const aid = String((d.data() as any).auctionId || "");
          if (!aid || seen.has(aid)) continue;
          seen.add(aid);
          const aSnap = await getDoc(doc(db, "auctions", aid));
          if (aSnap.exists()) recent.push({ id: aid, ...(aSnap.data() as any) });
          if (recent.length >= 12) break;
        }
        setRecentBids(recent);
      } catch {
        setRecentBids([]);
      }

      let loanList: any[] = [];
      try {
        const qL = query(
          collection(db, "loans"),
          where("userUid", "==", u.uid),
          limit(200)
        );
        const l = await getDocs(qL);
        loanList = l.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setLoans(loanList);
      } catch {
        setLoans([]);
      }

      const shopIds = Array.from(
        new Set([
          ...loanList.map((x) => String(x.shopId || "")),
          ...winsList.map((a) => String(a.shopId || "")),
        ])
      ).filter(Boolean);
      const colIds = Array.from(
        new Set(
          loanList.map((x) => String(x.collateralId || "")).filter(Boolean)
        )
      );

      await Promise.all([
        ...shopIds.map((sid) => resolveShopName(sid)),
        ...colIds.map((cid) => resolveCollateralTitle(cid)),
      ]);

      try {
        const qC = query(
          collection(db, "collaterals"),
          where("userUid", "==", u.uid),
          limit(200)
        );
        const c = await getDocs(qC);
        setCollaterals(c.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      } catch {
        setCollaterals([]);
      }

      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const activeLoans = useMemo(
    () => loans.filter((x) => x.status === "active"),
    [loans]
  );
  const endedWins = useMemo(
    () => wins.filter((a) => a.status === "ended" || a.status === "settled"),
    [wins]
  );

  const sortByDueSoon = [...activeLoans].sort(
    (a, b) =>
      (toDateAny(a.dueAt)?.getTime() ?? 0) -
      (toDateAny(b.dueAt)?.getTime() ?? 0)
  );
  const sortWinsRecent = [...endedWins].sort(
    (a, b) =>
      (toDateAny(b.updatedAt)?.getTime() ?? 0) -
      (toDateAny(a.updatedAt)?.getTime() ?? 0)
  );

  if (loading)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading dashboard…
        </div>
      </div>
    );

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-xl border border-white/10 bg-gray-900/70 backdrop-blur-md p-4">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-2xl font-semibold text-cyan-300">{value}</div>
    </div>
  );

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* glowing gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
            My Dashboard
          </h1>
          <div className="flex gap-2">
            <Link
              href="/auctions"
              className="rounded-lg border border-white/20 bg-gray-800/60 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700/60 transition"
            >
              Browse Auctions
            </Link>
            <Link
              href="/user/collateral"
              className="rounded-lg border border-white/20 bg-gray-800/60 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700/60 transition"
            >
              My Jewelry
            </Link>
            <Link
              href="/user/loans"
              className="rounded-lg border border-white/20 bg-gray-800/60 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700/60 transition"
            >
              My Loans
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Active Loans" value={String(activeLoans.length)} />
          <Stat label="My Collaterals" value={String(collaterals.length)} />
          <Stat label="Auctions Won" value={String(wins.length)} />
          <Stat label="Recent Bid Auctions" value={String(recentBids.length)} />
        </div>

        {/* Loans */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Ongoing Loans</h2>
          <div className="rounded-xl border border-white/10 bg-gray-900/60 backdrop-blur-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/70 text-gray-300">
                <tr>
                  <th className="text-left p-3">Shop</th>
                  <th className="text-left p-3">Collateral</th>
                  <th className="text-left p-3">Principal</th>
                  <th className="text-left p-3">Interest</th>
                  <th className="text-left p-3">Due</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortByDueSoon.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-white/10 hover:bg-gray-800/50 transition"
                  >
                    <td className="p-3">
                      {r.shopId ? shopNames[r.shopId] || r.shopId : "—"}
                    </td>
                    <td className="p-3">
                      {r.collateralId
                        ? collateralTitles[r.collateralId] || r.collateralId
                        : "—"}
                    </td>
                    <td className="p-3">{fmtMoney(r.principal)}</td>
                    <td className="p-3">
                      {Number(r.interestPct || 0).toFixed(2)}%
                    </td>
                    <td className="p-3">
                      {toDateAny(r.dueAt)?.toLocaleString?.() || "—"}
                    </td>
                    <td className="p-3 text-cyan-300">{r.status}</td>
                  </tr>
                ))}
                {sortByDueSoon.length === 0 && (
                  <tr>
                    <td
                      className="p-4 text-gray-400 text-center"
                      colSpan={6}
                    >
                      No active loans.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Wins */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Auctions I Won</h2>
          {sortWinsRecent.length === 0 ? (
            <p className="text-sm text-gray-400">No wins yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sortWinsRecent.map((a) => (
                <Link
                  key={a.id}
                  href={`/auctions/${a.id}`}
                  className="rounded-xl border border-white/10 bg-gray-900/60 backdrop-blur-md p-3 hover:-translate-y-1 transition"
                >
                  <div className="font-medium text-gray-100">
                    {a.title || "Auction"}
                  </div>
                  <div className="text-xs text-gray-400">
                    Highest: {fmtMoney(a.highestBid)}
                    {a.shopId ? (
                      <> • Shop: {shopNames[a.shopId] || a.shopId}</>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-500">Status: {a.status}</div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Recent Bids */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Recently Bid Auctions</h2>
          {recentBids.length === 0 ? (
            <p className="text-sm text-gray-400">No recent bids.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentBids.map((a) => (
                <Link
                  key={a.id}
                  href={`/auctions/${a.id}`}
                  className="rounded-xl border border-white/10 bg-gray-900/60 backdrop-blur-md p-3 hover:-translate-y-1 transition"
                >
                  <div className="font-medium text-gray-100">
                    {a.title || "Auction"}
                  </div>
                  <div className="text-xs text-gray-400">
                    Status: {a.status} • Ends:{" "}
                    {toDateAny(a.endAt)?.toLocaleString?.() || "—"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
