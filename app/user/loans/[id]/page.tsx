"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase.client";
import { accrueLoanNow, round2 } from "../../../lib/loan";
import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  addDoc,
  collection,
} from "firebase/firestore";

export default function UserLoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [topup, setTopup] = useState<number>(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(() => {
    if (!loan)
      return { outstanding: 0, interest: 0, late: 0, totalDue: 0, cap: 0 };
    const outstanding = Number(loan.outstandingPrincipal || 0);
    const interest = Number(loan.accruedInterest || 0);
    const late = Number(loan.lateFees || 0);
    const totalDue = round2(outstanding + interest + late);
    const cap = Number(loan.maxPrincipalAllowed || outstanding);
    return { outstanding, interest, late, totalDue, cap };
  }, [loan]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

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
    setErr(null);
    setMsg(null);
    if (!loan) return;
    const amt = round2(Number(topup || 0));
    if (amt <= 0) return setErr("Enter a positive top-up amount.");

    const newOutstanding = round2(
      Number(loan.outstandingPrincipal || 0) + amt
    );
    const cap = Number(loan.maxPrincipalAllowed || 0);
    if (cap && newOutstanding > cap)
      return setErr(`Top-up exceeds cap (${cap}).`);

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

    setMsg("✅ Top-up applied.");
    setLoan({ ...loan, outstandingPrincipal: newOutstanding });
    setTopup(0);
  };

  const settleAll = async () => {
    setErr(null);
    setMsg(null);
    if (!loan) return;
    const total = totals.totalDue;
    if (total <= 0) return setErr("Nothing to settle.");

    await addDoc(collection(db, "payments"), {
      loanId: loan.id,
      shopId: loan.shopId,
      customerUid: loan.customerUid,
      amount: total,
      type: "settlement",
      method: "online",
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

    setMsg("✅ Loan settled successfully.");
    setTimeout(() => router.replace("/user/loans"), 1000);
  };

  if (loading)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading loan details…
        </div>
      </div>
    );

  if (!loan)
    return (
      <div className="min-h-[100svh] flex items-center justify-center text-gray-400">
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
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-2xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Loan Details</h1>
          <button
            onClick={() => router.back()}
            className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm text-gray-200 hover:bg-indigo-600 hover:text-white"
          >
            Back
          </button>
        </div>

        {/* Loan Info */}
        <section className="rounded-2xl border border-white/10 bg-gray-900/70 p-5 backdrop-blur-md">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Status" value={loan.status} />
            <Info label="APR" value={`${loan.interestAPR}%`} />
            <Info label="Term" value={`${loan.termDays} days`} />
            <Info label="LTV" value={`${loan.ltvPercent}%`} />
            <Info
              label="Start"
              value={startDate?.toLocaleDateString() ?? "—"}
            />
            <Info label="Due" value={dueDate?.toLocaleDateString() ?? "—"} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Metric label="Outstanding Principal" value={totals.outstanding} />
            <Metric label="Accrued Interest" value={totals.interest} />
            <Metric label="Late Fees" value={totals.late} />
            <Metric label="Total Due (now)" value={totals.totalDue} accent />
          </div>
        </section>

        {loan.status === "active" && (
          <>
            {/* TOP-UP */}
            <form
              onSubmit={doTopup}
              className="rounded-2xl border border-white/10 bg-gray-900/70 p-5 space-y-3 backdrop-blur-md"
            >
              <h2 className="text-lg font-semibold">Top-up Principal</h2>
              <p className="text-sm text-gray-400">
                Cap: up to{" "}
                <span className="text-indigo-400">
                  {Number(totals.cap).toFixed(2)}
                </span>{" "}
                total outstanding principal.
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full rounded-xl border border-white/10 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-400 focus:ring focus:ring-indigo-500/30 outline-none"
                  placeholder="Amount"
                  value={topup}
                  onChange={(e) => setTopup(Number(e.target.value))}
                />
                <button className="rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white hover:opacity-90">
                  Top-up
                </button>
              </div>
            </form>

            {/* SETTLE */}
            <section className="rounded-2xl border border-white/10 bg-gray-900/70 p-5 space-y-3 backdrop-blur-md">
              <h2 className="text-lg font-semibold">Settle Loan</h2>
              <p className="text-sm text-gray-400">
                Pay the total due and close the loan. Your collateral will be
                marked as <b>redeemed</b>.
              </p>
              <button
                onClick={settleAll}
                className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:opacity-90"
              >
                Settle {totals.totalDue.toFixed(2)}
              </button>
            </section>
          </>
        )}

        {msg && (
          <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300">
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-400">{label}:</span>{" "}
      <span className="font-medium text-gray-100">{value}</span>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 ${
        accent
          ? "bg-indigo-600/20 text-indigo-300 ring-1 ring-indigo-500/30"
          : "bg-gray-800/70 text-gray-100"
      }`}
    >
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-lg font-semibold">{value.toFixed(2)}</div>
    </div>
  );
}
