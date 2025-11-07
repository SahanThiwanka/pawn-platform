"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase.client";
import { doc, getDoc, serverTimestamp, updateDoc, addDoc, collection } from "firebase/firestore";
import { round2, toDate } from "../../../lib/loan";
import Link from "next/link";

export default function ShopLoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loan, setLoan] = useState<any>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [payAmount, setPayAmount] = useState<number>(0);
  const [payType, setPayType] = useState<"interest"|"principal"|"late_fee">("principal");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(() => {
    if (!loan) return { outstanding: 0, interest: 0, late: 0, total: 0 };
    const outstanding = Number(loan.outstandingPrincipal || 0);
    const interest = Number(loan.accruedInterest || 0);
    const late = Number(loan.lateFees || 0);
    return { outstanding, interest, late, total: round2(outstanding + interest + late) };
  }, [loan]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const me = await getDoc(doc(db, "users", u.uid));
      const my = me.data();
      if (my?.role !== "shop_admin" || !my.shopId) return router.replace("/dashboard");
      setShopId(my.shopId);

      const snap = await getDoc(doc(db, "loans", id));
      const data = snap.data();
      if (!data || data.shopId !== my.shopId) return router.replace("/shop/loans");
      setLoan({ id, ...data });

      setLoading(false);
    });
    return () => unsub();
  }, [id, router]);

  // Record a manual payment (interest/principal/late_fee)
  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setMsg(null);
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

    // update loan fields accordingly
    const patch: any = { updatedAt: serverTimestamp() };
    if (payType === "principal") patch.outstandingPrincipal = round2(totals.outstanding - amt);
    if (payType === "interest") patch.accruedInterest = round2(totals.interest - amt);
    if (payType === "late_fee") patch.lateFees = round2(totals.late - amt);

    // prevent going negative:
    patch.outstandingPrincipal = Math.max(0, patch.outstandingPrincipal ?? totals.outstanding);
    patch.accruedInterest = Math.max(0, patch.accruedInterest ?? totals.interest);
    patch.lateFees = Math.max(0, patch.lateFees ?? totals.late);

    await updateDoc(doc(db, "loans", loan.id), patch);

    setMsg("Payment recorded.");
    setLoan({ ...loan, ...patch, outstandingPrincipal: patch.outstandingPrincipal, accruedInterest: patch.accruedInterest, lateFees: patch.lateFees });
    setPayAmount(0);
  };

  const settleOnBehalf = async () => {
    setErr(null); setMsg(null);
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
    setErr(null); setMsg(null);
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

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!loan) return <div className="p-8 text-center">Not found</div>;

  const startDate = loan.startDate ? new Date(loan.startDate.seconds * 1000) : undefined;
  const dueDate = loan.dueDate ? new Date(loan.dueDate.seconds * 1000) : undefined;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Loan</h1>
        <Link href="/shop/loans" className="underline text-sm">Back</Link>
      </div>

      <div className="rounded-xl border p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Status:</span> {loan.status}</div>
          <div><span className="text-gray-500">Customer:</span> {loan.customerUid}</div>
          <div><span className="text-gray-500">APR:</span> {loan.interestAPR}%</div>
          <div><span className="text-gray-500">Term:</span> {loan.termDays} days</div>
          <div><span className="text-gray-500">Start:</span> {startDate?.toLocaleDateString() ?? "—"}</div>
          <div><span className="text-gray-500">Due:</span> {dueDate?.toLocaleDateString() ?? "—"}</div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Outstanding</div>
            <div className="text-lg font-semibold">{totals.outstanding.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Interest</div>
            <div className="text-lg font-semibold">{totals.interest.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Late Fees</div>
            <div className="text-lg font-semibold">{totals.late.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Manual payment */}
      {loan.status === "active" && (
        <form onSubmit={addPayment} className="rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold">Add Payment</h2>
          <div className="grid grid-cols-3 gap-3">
            <select
              className="border rounded-lg px-3 py-2"
              value={payType}
              onChange={(e)=>setPayType(e.target.value as any)}
            >
              <option value="principal">Principal</option>
              <option value="interest">Interest</option>
              <option value="late_fee">Late Fee</option>
            </select>
            <input
              type="number" step="0.01" min="0"
              className="border rounded-lg px-3 py-2"
              placeholder="Amount"
              value={payAmount}
              onChange={(e)=>setPayAmount(Number(e.target.value))}
            />
            <button className="rounded-lg bg-black text-white px-4 py-2">Record</button>
          </div>
        </form>
      )}

      {/* Settle */}
      {loan.status === "active" && (
        <div className="rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold">Settle on Behalf</h2>
          <p className="text-sm text-gray-600">Close the loan and mark collateral as redeemed.</p>
          <button onClick={settleOnBehalf} className="rounded-lg bg-black text-white px-4 py-2">
            Settle {totals.total.toFixed(2)}
          </button>
        </div>
      )}

      {/* Default + Auction */}
      {loan.status !== "settled" && (
        <div className="rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold">Default & Auction</h2>
          <div className="flex flex-wrap gap-3">
            {loan.status !== "defaulted" && (
              <button onClick={markDefault} className="rounded-lg border px-4 py-2 hover:bg-gray-50">
                Mark Default
              </button>
            )}
            {loan.status === "defaulted" && loan.collateralId && (
              <Link
                href={`/shop/auctions/new?collateralId=${loan.collateralId}`}
                className="rounded-lg bg-black text-white px-4 py-2"
              >
                Create Auction
              </Link>
            )}
          </div>
        </div>
      )}

      {msg && <p className="text-green-600 text-sm">{msg}</p>}
      {err && <p className="text-red-600 text-sm">{err}</p>}
    </main>
  );
}
