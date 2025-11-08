"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase.client";
import {
  collection, doc, getDoc, getDocs, query, where, limit,
  updateDoc, addDoc, serverTimestamp
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ShopLoanRequestsPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const me = await getDoc(doc(db, "users", u.uid));
      const my = me.data() as any;
      if (my?.role !== "shop_admin" || !my.shopId) {
        return router.replace("/dashboard");
      }
      setShopId(my.shopId);

      const qL = query(
        collection(db, "loanRequests"),
        where("shopId", "==", my.shopId),
        limit(200)
      );
      const res = await getDocs(qL);
      setRows(res.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const pending = useMemo(() => rows.filter(r => r.status === "pending"), [rows]);
  const accepted = useMemo(() => rows.filter(r => r.status === "accepted"), [rows]);
  const declined = useMemo(() => rows.filter(r => r.status === "declined"), [rows]);

  const accept = async (req: any) => {
    setBusy(req.id); setMsg(null); setErr(null);
    try {
      const start = new Date();
      const due = new Date(start.getTime() + Number(req.durationDays || 30) * 86400000);
      const loanRef = await addDoc(collection(db, "loans"), {
        collateralId: req.collateralId,
        userUid: req.userUid,
        shopId: req.shopId,
        principal: Number(req.amountRequested || 0),
        interestPct: Number(req.interestPct || 0),
        durationDays: Number(req.durationDays || 0),
        startAt: start,
        dueAt: due,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "loanRequests", req.id), {
        status: "accepted",
        updatedAt: serverTimestamp(),
        loanId: loanRef.id,
      });
      await updateDoc(doc(db, "collaterals", req.collateralId), {
        status: "pledged",
        updatedAt: serverTimestamp(),
      });

      setRows(prev => prev.map(r => r.id === req.id ? { ...r, status: "accepted", loanId: loanRef.id } : r));
      setMsg("Request accepted, loan created.");
    } catch (e: any) {
      setErr(e?.message || "Failed to accept.");
    } finally {
      setBusy(null);
    }
  };

  const decline = async (req: any) => {
    setBusy(req.id); setMsg(null); setErr(null);
    try {
      await updateDoc(doc(db, "loanRequests", req.id), {
        status: "declined",
        updatedAt: serverTimestamp(),
      });
      setRows(prev => prev.map(r => r.id === req.id ? { ...r, status: "declined" } : r));
      setMsg("Request declined.");
    } catch (e: any) {
      setErr(e?.message || "Failed to decline.");
    } finally {
      setBusy(null);
    }
  };

  if (loading)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading…
        </div>
      </div>
    );

  const Section = ({ title, items }: { title: string; items: any[] }) => (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-gray-200">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/80 text-gray-300">
            <tr className="border-b border-white/10">
              <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">User</th>
              <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">Collateral</th>
              <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">Amount</th>
              <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">Duration</th>
              <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">Interest</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t border-white/10 hover:bg-gray-800/40 transition">
                <td className="p-3 text-gray-200">
                  <code className="text-xs text-gray-400">{r.userUid}</code>
                </td>
                <td className="p-3 text-gray-200">
                  <code className="text-xs text-gray-400">{r.collateralId}</code>
                </td>
                <td className="p-3 text-cyan-400">
                  {Number(r.amountRequested || 0).toFixed(2)}
                </td>
                <td className="p-3 text-gray-300">{r.durationDays} days</td>
                <td className="p-3 text-gray-300">{Number(r.interestPct || 0).toFixed(2)}%</td>
                <td className="p-3 text-right">
                  {r.status === "pending" ? (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => accept(r)}
                        disabled={busy === r.id}
                        className="rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
                      >
                        {busy === r.id ? "Working…" : "Accept"}
                      </button>
                      <button
                        onClick={() => decline(r)}
                        disabled={busy === r.id}
                        className="rounded-lg border border-white/20 bg-gray-800/60 text-gray-200 px-3 py-1.5 text-sm hover:bg-gray-700/60 disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  ) : r.status === "accepted" ? (
                    <span className="text-emerald-400 font-medium">Accepted</span>
                  ) : (
                    <span className="text-gray-500">Declined</span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="p-4 text-center text-gray-500" colSpan={6}>
                  No items.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* Glow background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />
      <main className="relative z-10 max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
            Loan Requests
          </h1>
          <Link
            href="/shop/dashboard"
            className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm hover:bg-indigo-600 hover:text-white transition"
          >
            Back
          </Link>
        </div>

        <Section title="Pending" items={pending} />
        <Section title="Accepted" items={accepted} />
        <Section title="Declined" items={declined} />

        {msg && (
          <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {msg}
          </p>
        )}
        {err && (
          <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {err}
          </p>
        )}
      </main>
    </div>
  );
}
