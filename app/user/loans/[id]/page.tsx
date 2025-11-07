"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase.client";
import { accrueLoanNow, round2, toDate } from "../../../lib/loan";
import { doc, getDoc, serverTimestamp, updateDoc, addDoc, collection } from "firebase/firestore";

export default function UserLoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [topup, setTopup] = useState<number>(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(() => {
    if (!loan) return { outstanding: 0, interest: 0, totalDue: 0, cap: 0 };
    const outstanding = Number(loan.outstandingPrincipal || 0);
    const interest = Number(loan.accruedInterest || 0);
    const late = Number(loan.lateFees || 0);
    const totalDue = round2(outstanding + interest + late);
    const cap = Number(loan.maxPrincipalAllowed || outstanding); // top-up cap equals appraised value limit
    return { outstanding, interest, late, totalDue, cap };
  }, [loan]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      // fetch & accrue
      await accrueLoanNow(id);
      const snap = await getDoc(doc(db, "loans", id));
      const data = snap.data();
      if (!data) return router.replace("/user/loans");
      if (data.customerUid !== u.uid) return router.replace("/user/loans");
      setLoan({ id, ...data });
      setLoading(false);
    });
    return () => unsub();
  }, [id, router]);

  const doTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!loan) return;

    const amt = round2(Number(topup || 0));
    if (amt <= 0) return setErr("Enter a positive top-up amount.");

    const newOutstanding = round2(Number(loan.outstandingPrincipal || 0) + amt);
    const cap = Number(loan.maxPrincipalAllowed || 0);
    if (cap && newOutstanding > cap) {
      return setErr(`Top-up exceeds cap (${cap}).`);
    }

    // record payment entry (top-up increases outstanding principal)
    await addDoc(collection(db, "payments"), {
      loanId: loan.id,
      shopId: loan.shopId,
      customerUid: loan.customerUid,
      amount: amt,
      type: "topup",
      method: "online",
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, "loans", loan.id), {
      outstandingPrincipal: newOutstanding,
      updatedAt: serverTimestamp(),
    });

    setMsg("Top-up applied.");
    setLoan({ ...loan, outstandingPrincipal: newOutstanding });
    setTopup(0);
  };

  const settleAll = async () => {
    setErr(null); setMsg(null);
    if (!loan) return;

    const total = totals.totalDue;
    if (total <= 0) return setErr("Nothing to settle.");

    // record settlement payment
    await addDoc(collection(db, "payments"), {
      loanId: loan.id,
      shopId: loan.shopId,
      customerUid: loan.customerUid,
      amount: total,
      type: "settlement",
      method: "online",
      createdAt: serverTimestamp(),
    });

    // close loan + release collateral
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

    setMsg("Loan settled successfully.");
    setTimeout(() => router.replace("/user/loans"), 800);
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!loan) return <div className="p-8 text-center">Not found</div>;

  const startDate = loan.startDate ? new Date(loan.startDate.seconds * 1000) : undefined;
  const dueDate = loan.dueDate ? new Date(loan.dueDate.seconds * 1000) : undefined;

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Loan Details</h1>
        <button onClick={() => router.back()} className="underline text-sm">Back</button>
      </div>

      <div className="rounded-xl border p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Status:</span> {loan.status}</div>
          <div><span className="text-gray-500">APR:</span> {loan.interestAPR}%</div>
          <div><span className="text-gray-500">Term:</span> {loan.termDays} days</div>
          <div><span className="text-gray-500">LTV:</span> {loan.ltvPercent}%</div>
          <div><span className="text-gray-500">Start:</span> {startDate?.toLocaleDateString() ?? "-"}</div>
          <div><span className="text-gray-500">Due:</span> {dueDate?.toLocaleDateString() ?? "-"}</div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Outstanding Principal</div>
            <div className="text-lg font-semibold">{totals.outstanding.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Accrued Interest</div>
            <div className="text-lg font-semibold">{totals.interest.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Late Fees</div>
            <div className="text-lg font-semibold">{(Number(loan.lateFees||0)).toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Total Due (now)</div>
            <div className="text-lg font-semibold">{totals.totalDue.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {loan.status === "active" && (
        <>
          {/* TOP-UP */}
          <form onSubmit={doTopup} className="rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">Top-up Principal</h2>
            <p className="text-sm text-gray-600">
              Cap: up to {Number(totals.cap).toFixed(2)} total outstanding principal.
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Amount"
                value={topup}
                onChange={(e)=>setTopup(Number(e.target.value))}
              />
              <button className="rounded-lg bg-black text-white px-4 py-2">Top-up</button>
            </div>
          </form>

          {/* SETTLE */}
          <div className="rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">Settle Loan</h2>
            <p className="text-sm text-gray-600">
              Pay the total due and close the loan. Your collateral will be marked as <b>redeemed</b>.
            </p>
            <button onClick={settleAll} className="rounded-lg bg-black text-white px-4 py-2">
              Settle {totals.totalDue.toFixed(2)}
            </button>
          </div>
        </>
      )}

      {msg && <p className="text-green-600 text-sm">{msg}</p>}
      {err && <p className="text-red-600 text-sm">{err}</p>}
    </main>
  );
}
