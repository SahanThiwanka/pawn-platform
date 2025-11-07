"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase.client";
import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  addDoc,
  collection,
} from "firebase/firestore";
import { round2 } from "../../../lib/loan";
import Link from "next/link";

export default function ShopLoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loan, setLoan] = useState<any>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payType, setPayType] = useState<"interest" | "principal" | "late_fee">(
    "principal"
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(() => {
    if (!loan)
      return { outstanding: 0, interest: 0, late: 0, total: 0 };
    const outstanding = Number(loan.outstandingPrincipal || 0);
    const interest = Number(loan.accruedInterest || 0);
    const late = Number(loan.lateFees || 0);
    return {
      outstanding,
      interest,
      late,
      total: round2(outstanding + interest + late),
    };
  }, [loan]);

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

      const snap = await getDoc(doc(db, "loans", id));
      const data = snap.data();
      if (!data || data.shopId !== my.shopId)
        return router.replace("/shop/loans");
      setLoan({ id, ...data });
      setLoading(false);
    });
    return () => unsub();
  }, [id, router]);

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!loan || !shopId) return;

    const amt = round2(Number(payAmount || 0));
    if (amt <= 0) return setErr("Enter a positive amount.");

    await addDoc(collection(db, "payments"), {
      loanId: loan.id,
      shopId,
      customerUid: loan.customerUid,
      amount: amt,
      type: payType,
      method: "cash",
      createdAt: serverTimestamp(),
    });

    const patch: any = { updatedAt: serverTimestamp() };
    if (payType === "principal")
      patch.outstandingPrincipal = round2(totals.outstanding - amt);
    if (payType === "interest")
      patch.accruedInterest = round2(totals.interest - amt);
    if (payType === "late_fee")
      patch.lateFees = round2(totals.late - amt);

    patch.outstandingPrincipal = Math.max(
      0,
      patch.outstandingPrincipal ?? totals.outstanding
    );
    patch.accruedInterest = Math.max(
      0,
      patch.accruedInterest ?? totals.interest
    );
    patch.lateFees = Math.max(0, patch.lateFees ?? totals.late);

    await updateDoc(doc(db, "loans", loan.id), patch);

    setMsg("Payment recorded.");
    setLoan({
      ...loan,
      ...patch,
      outstandingPrincipal: patch.outstandingPrincipal,
      accruedInterest: patch.accruedInterest,
      lateFees: patch.lateFees,
    });
    setPayAmount(0);
  };

  const settleOnBehalf = async () => {
    setErr(null);
    setMsg(null);
    if (!loan || !shopId) return;

    const total = totals.total;
    if (total <= 0) return setErr("Already settled.");

    await addDoc(collection(db, "payments"), {
      loanId: loan.id,
      shopId,
      customerUid: loan.customerUid,
      amount: total,
      type: "settlement",
      method: "cash",
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, "loans", loan.id), {
      status: "settled",
      outstandingPrincipal: 0,
      accruedInterest: 0,
      lateFees: 0,
      updatedAt: serverTimestamp(),
    });

    if (loan.collateralId) {
      await updateDoc(doc(db, "collaterals", loan.collateralId), {
        status: "redeemed",
        updatedAt: serverTimestamp(),
      });
    }

    setMsg("Loan settled.");
    setTimeout(() => router.replace("/shop/loans"), 800);
  };

  const markDefault = async () => {
    setErr(null);
    setMsg(null);
    if (!loan) return;

    await updateDoc(doc(db, "loans", loan.id), {
      status: "defaulted",
      updatedAt: serverTimestamp(),
    });
    if (loan.collateralId) {
      await updateDoc(doc(db, "collaterals", loan.collateralId), {
        status: "defaulted",
        updatedAt: serverTimestamp(),
      });
    }
    setMsg("Marked as defaulted.");
    setLoan({ ...loan, status: "defaulted" });
  };

  if (loading)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading loan…
        </div>
      </div>
    );

  if (!loan)
    return (
      <div className="min-h-[100svh] flex items-center justify-center text-gray-400 bg-gray-950">
        Not found
      </div>
    );

  const startDate = loan.startDate
    ? new Date(loan.startDate.seconds * 1000)
    : undefined;
  const dueDate = loan.dueDate
    ? new Date(loan.dueDate.seconds * 1000)
    : undefined;

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* glow background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-3xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Manage Loan</h1>
          <Link
            href="/shop/loans"
            className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm text-gray-200 hover:bg-indigo-600 hover:text-white transition"
          >
            Back
          </Link>
        </div>

        {/* Loan info */}
        <section className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-400">Status:</span>{" "}
              <StatusBadge status={loan.status} />
            </div>
            <div>
              <span className="text-gray-400">Customer:</span>{" "}
              <code className="text-xs text-gray-300">{loan.customerUid}</code>
            </div>
            <div>
              <span className="text-gray-400">APR:</span> {loan.interestAPR}%
            </div>
            <div>
              <span className="text-gray-400">Term:</span> {loan.termDays} days
            </div>
            <div>
              <span className="text-gray-400">Start:</span>{" "}
              {startDate?.toLocaleDateString() ?? "—"}
            </div>
            <div>
              <span className="text-gray-400">Due:</span>{" "}
              {dueDate?.toLocaleDateString() ?? "—"}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <Metric label="Outstanding" value={totals.outstanding} />
            <Metric label="Interest" value={totals.interest} />
            <Metric label="Late Fees" value={totals.late} />
          </div>
        </section>

        {/* Add payment */}
        {loan.status === "active" && (
          <form
            onSubmit={addPayment}
            className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md p-5 space-y-3"
          >
            <h2 className="font-semibold text-lg">Add Payment</h2>
            <div className="grid grid-cols-3 gap-3">
              <select
                className="rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2"
                value={payType}
                onChange={(e) => setPayType(e.target.value as any)}
              >
                <option value="principal">Principal</option>
                <option value="interest">Interest</option>
                <option value="late_fee">Late Fee</option>
              </select>
              <input
                type="number"
                step="0.01"
                min="0"
                className="rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2"
                placeholder="Amount"
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
              />
              <button className="rounded-lg bg-indigo-600 text-white px-4 py-2 hover:opacity-90">
                Record
              </button>
            </div>
          </form>
        )}

        {/* Settle */}
        {loan.status === "active" && (
          <section className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md p-5 space-y-3">
            <h2 className="font-semibold text-lg">Settle on Behalf</h2>
            <p className="text-sm text-gray-400">
              Close the loan and mark collateral as redeemed.
            </p>
            <button
              onClick={settleOnBehalf}
              className="rounded-lg bg-emerald-600 text-white px-4 py-2 hover:opacity-90"
            >
              Settle {totals.total.toFixed(2)}
            </button>
          </section>
        )}

        {/* Default */}
        {loan.status !== "settled" && (
          <section className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md p-5 space-y-3">
            <h2 className="font-semibold text-lg">Default & Auction</h2>
            <div className="flex flex-wrap gap-3">
              {loan.status !== "defaulted" && (
                <button
                  onClick={markDefault}
                  className="rounded-lg border border-white/10 bg-gray-800/70 px-4 py-2 hover:bg-red-600 hover:text-white transition"
                >
                  Mark Default
                </button>
              )}
              {loan.status === "defaulted" && loan.collateralId && (
                <Link
                  href={`/shop/auctions/new?collateralId=${loan.collateralId}`}
                  className="rounded-lg bg-indigo-600 text-white px-4 py-2 hover:opacity-90"
                >
                  Create Auction
                </Link>
              )}
            </div>
          </section>
        )}

        {msg && (
          <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {msg}
          </p>
        )}
        {err && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {err}
          </p>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-gray-800/70 border border-white/10 p-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-lg font-semibold">{value.toFixed(2)}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30 animate-pulse",
    settled: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    defaulted: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
  };
  const cls =
    map[status?.toLowerCase?.()] ||
    "bg-gray-500/15 text-gray-300 ring-1 ring-gray-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}
