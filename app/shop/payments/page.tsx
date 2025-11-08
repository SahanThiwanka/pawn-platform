"use client";

import { useEffect, useState } from "react";
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
  runTransaction,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from "firebase/firestore";

type Payment = {
  id: string;
  loanId: string;
  userUid: string;
  shopId: string | null;
  amount: number;
  method?: string | null;
  status: "pending" | "approved" | "declined";
  createdAt?: any;
};

function toDateAny(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return null;
}

const money = (n?: number) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function ShopPaymentsPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState<string | null>(null);
  const [rows, setRows] = useState<Payment[]>([]);
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
      if (my?.role !== "shop_admin" || !my.shopId)
        return router.replace("/dashboard");

      setShopId(my.shopId);

      const qP = query(
        collection(db, "payments"),
        where("shopId", "==", my.shopId),
        where("status", "==", "pending"),
        limit(200)
      );
      const res = await getDocs(qP);
      setRows(res.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const approve = async (p: Payment) => {
    setBusy(p.id);
    setMsg(null);
    setErr(null);
    try {
      await runTransaction(db, async (tx) => {
        const payRef = doc(db, "payments", p.id);
        const paySnap = await tx.get(payRef);
        if (!paySnap.exists()) throw new Error("Payment not found.");
        const payData = paySnap.data() as any;
        if (payData.status !== "pending")
          throw new Error("Already processed.");

        const loanRef = doc(db, "loans", p.loanId);
        const loanSnap = await tx.get(loanRef);
        if (!loanSnap.exists()) throw new Error("Loan not found.");
        const loan = loanSnap.data() as any;

        const outstanding = Number(loan.outstanding ?? loan.principal ?? 0);
        const totalPaid = Number(loan.totalPaid ?? 0);
        const amt = Number(payData.amount || 0);
        const newOutstanding = Math.max(0, outstanding - amt);
        const newTotalPaid = totalPaid + amt;

        const updates: any = {
          outstanding: newOutstanding,
          totalPaid: newTotalPaid,
          updatedAt: serverTimestamp(),
        };
        if (newOutstanding <= 0 && loan.status === "active") {
          updates.status = "repaid";
        }

        tx.update(loanRef, updates);
        tx.update(payRef, {
          status: "approved",
          updatedAt: serverTimestamp(),
        });
      });

      setRows((prev) => prev.filter((x) => x.id !== p.id));
      setMsg("✅ Payment approved and loan updated.");
    } catch (e: any) {
      setErr(e?.message || "Failed to approve payment.");
    } finally {
      setBusy(null);
    }
  };

  const decline = async (p: Payment) => {
    setBusy(p.id);
    setMsg(null);
    setErr(null);
    try {
      await updateDoc(doc(db, "payments", p.id), {
        status: "declined",
        updatedAt: serverTimestamp(),
      });
      setRows((prev) => prev.filter((x) => x.id !== p.id));
      setMsg("❌ Payment declined.");
    } catch (e: any) {
      setErr(e?.message || "Failed to decline payment.");
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

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* Glow layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
            Pending Payments
          </h1>
          <Link
            href="/shop/loans"
            className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm hover:bg-indigo-600 hover:text-white transition"
          >
            Back to Loans
          </Link>
        </div>

        {/* Payments Table */}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 text-gray-300">
              <tr className="border-b border-white/10">
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">
                  Loan
                </th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">
                  User
                </th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">
                  Amount
                </th>
                <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide">
                  Method
                </th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-white/10 hover:bg-gray-800/40 transition"
                >
                  <td className="p-3">
                    <code className="text-xs text-gray-400">{p.loanId}</code>
                  </td>
                  <td className="p-3">
                    <code className="text-xs text-gray-400">{p.userUid}</code>
                  </td>
                  <td className="p-3 text-cyan-400 font-medium">
                    {money(p.amount)}
                  </td>
                  <td className="p-3 text-gray-300">{p.method || "—"}</td>
                  <td className="p-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => approve(p)}
                        disabled={busy === p.id}
                        className="rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
                      >
                        {busy === p.id ? "Saving…" : "Approve"}
                      </button>
                      <button
                        onClick={() => decline(p)}
                        disabled={busy === p.id}
                        className="rounded-lg border border-white/20 bg-gray-800/60 text-gray-200 px-3 py-1.5 text-sm hover:bg-gray-700/60 disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    className="p-6 text-center text-gray-400"
                    colSpan={5}
                  >
                    No pending payments.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Status Messages */}
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
