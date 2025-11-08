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

export default function ShopDashboardPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [auctions, setAuctions] = useState<any[]>([]);
  const [loanRequests, setLoanRequests] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);

  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [collateralTitles, setCollateralTitles] = useState<Record<string, string>>({});

  const resolveUserName = async (uid: string) => {
    if (!uid) return "";
    if (userNames[uid]) return userNames[uid];
    const snap = await getDoc(doc(db, "users", uid));
    const data = snap.data() as any;
    const name = data?.displayName || data?.fullName || data?.email || uid;
    setUserNames((m) => ({ ...m, [uid]: String(name) }));
    return name;
  };
  const resolveCollateralTitle = async (collateralId: string) => {
    if (!collateralId) return "";
    if (collateralTitles[collateralId]) return collateralTitles[collateralId];
    const snap = await getDoc(doc(db, "collaterals", collateralId));
    const title = snap.exists() ? (snap.data() as any).title || collateralId : collateralId;
    setCollateralTitles((m) => ({ ...m, [collateralId]: String(title) }));
    return title;
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const me = await getDoc(doc(db, "users", u.uid));
      const my = me.data() as any;
      if (my?.role !== "shop_admin" || !my.shopId) return router.replace("/dashboard");
      setShopId(my.shopId);

      // fetch data
      const [a, r, l] = await Promise.all([
        getDocs(query(collection(db, "auctions"), where("shopId", "==", my.shopId), limit(300))),
        getDocs(query(collection(db, "loanRequests"), where("shopId", "==", my.shopId), limit(200))),
        getDocs(query(collection(db, "loans"), where("shopId", "==", my.shopId), limit(300))),
      ]);

      const auctions = a.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const loanRequests = r.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const loans = l.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

      setAuctions(auctions);
      setLoanRequests(loanRequests);
      setLoans(loans);

      const uids = Array.from(new Set(loans.map((x) => x.userUid).filter(Boolean)));
      const colIds = Array.from(new Set(loans.map((x) => x.collateralId).filter(Boolean)));
      await Promise.all([
        ...uids.map((id) => resolveUserName(id)),
        ...colIds.map((id) => resolveCollateralTitle(id)),
      ]);

      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const live = useMemo(() => auctions.filter((a) => a.status === "live"), [auctions]);
  const scheduled = useMemo(() => auctions.filter((a) => a.status === "scheduled"), [auctions]);
  const ended = useMemo(() => auctions.filter((a) => a.status === "ended"), [auctions]);
  const settlementPending = useMemo(
    () => auctions.filter((a) => a.status === "settlement_pending"),
    [auctions]
  );
  const settled = useMemo(() => auctions.filter((a) => a.status === "settled"), [auctions]);
  const pendingReqs = useMemo(() => loanRequests.filter((x) => x.status === "pending"), [loanRequests]);
  const activeLoans = useMemo(() => loans.filter((x) => x.status === "active"), [loans]);

  const liveSoonest = [...live].sort(
    (a, b) => (toDateAny(a.endAt)?.getTime() ?? 0) - (toDateAny(b.endAt)?.getTime() ?? 0)
  );
  const scheduledSoonest = [...scheduled].sort(
    (a, b) => (toDateAny(a.startAt)?.getTime() ?? 0) - (toDateAny(b.startAt)?.getTime() ?? 0)
  );
  const activeLoansDue = [...activeLoans].sort(
    (a, b) => (toDateAny(a.dueAt)?.getTime() ?? 0) - (toDateAny(b.dueAt)?.getTime() ?? 0)
  );

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;

  const Tile = ({ label, value, href }: { label: string; value: number | string; href: string }) => (
    <Link
      href={href}
      className="rounded-xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-4 hover:bg-gray-900/60 transition"
    >
      <div className="text-sm text-gray-400">{label}</div>
      <div className="text-2xl font-semibold text-white">{value}</div>
    </Link>
  );

  return (
    <main className="relative max-w-6xl mx-auto p-6 space-y-10 text-gray-100">
      {/* subtle glow */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-20 blur-3xl" />

      <div className="relative flex items-center justify-between">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
          Shop Dashboard
        </h1>
        <div className="flex gap-2">
          <Link href="/shop/auctions" className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-gray-800">
            Manage Auctions
          </Link>
          <Link href="/shop/loan-requests" className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-gray-800">
            Loan Requests
          </Link>
          <Link href="/shop/loans" className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-gray-800">
            Loans
          </Link>
        </div>
      </div>

      {/* KPI grid */}
      <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Tile label="Live" value={live.length} href="/shop/auctions" />
        <Tile label="Scheduled" value={scheduled.length} href="/shop/auctions" />
        <Tile label="Ended" value={ended.length} href="/shop/sales" />
        <Tile label="Pending Settlement" value={settlementPending.length} href="/shop/sales" />
        <Tile label="Settled" value={settled.length} href="/shop/sales" />
        <Tile label="Pending Requests" value={pendingReqs.length} href="/shop/loan-requests" />
      </div>

      {/* Live auctions */}
      <section className="relative space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Live Auctions (ending soon)</h2>
          <Link href="/shop/auctions" className="underline text-sm text-sky-400 hover:text-sky-300">
            View all
          </Link>
        </div>
        {liveSoonest.length === 0 ? (
          <p className="text-sm text-gray-400">No live auctions.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveSoonest.slice(0, 6).map((a) => (
              <Link
                key={a.id}
                href={`/auctions/${a.id}`}
                className="rounded-xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-4 hover:bg-gray-900/70 transition"
              >
                <div className="font-medium text-white">{a.title || "Auction"}</div>
                <div className="text-xs text-gray-400">
                  Ends: {toDateAny(a.endAt)?.toLocaleString?.() || "—"}
                </div>
                <div className="text-xs text-gray-300">
                  Highest: {fmtMoney(a.highestBid)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Scheduled auctions */}
      <section className="relative space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Scheduled (starting soon)</h2>
          <Link href="/shop/auctions/new" className="underline text-sm text-sky-400 hover:text-sky-300">
            Create Auction
          </Link>
        </div>
        {scheduledSoonest.length === 0 ? (
          <p className="text-sm text-gray-400">No scheduled auctions.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {scheduledSoonest.slice(0, 6).map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-4"
              >
                <div className="font-medium">{a.title || "Auction"}</div>
                <div className="text-xs text-gray-400">
                  Starts: {toDateAny(a.startAt)?.toLocaleString?.() || "—"}
                </div>
                <div className="text-xs text-gray-300">
                  Start: {fmtMoney(a.startPrice)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Loans */}
      <section className="relative space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Active Loans (due soon)</h2>
          <Link href="/shop/loans" className="underline text-sm text-sky-400 hover:text-sky-300">
            View all loans
          </Link>
        </div>
        {activeLoansDue.length === 0 ? (
          <p className="text-sm text-gray-400">No active loans.</p>
        ) : (
          <div className="rounded-xl border border-white/10 bg-gray-900/40 backdrop-blur-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50 text-gray-300">
                <tr>
                  <th className="text-left p-3">User</th>
                  <th className="text-left p-3">Collateral</th>
                  <th className="text-left p-3">Principal</th>
                  <th className="text-left p-3">Due</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {activeLoansDue.slice(0, 8).map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="p-3">{userNames[r.userUid] || r.userUid}</td>
                    <td className="p-3">{collateralTitles[r.collateralId] || r.collateralId}</td>
                    <td className="p-3">{fmtMoney(r.principal)}</td>
                    <td className="p-3">{toDateAny(r.dueAt)?.toLocaleString?.() || "—"}</td>
                    <td className="p-3 capitalize">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
