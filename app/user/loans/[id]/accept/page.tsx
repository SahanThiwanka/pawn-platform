"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../../../lib/firebase.client";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";

export default function AcceptLoanOfferPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const snap = await getDoc(doc(db, "loans", id));
      const data = snap.data();
      if (!data) {
        setErr("Loan offer not found.");
        setLoading(false);
        return;
      }
      if (data.customerUid && data.customerUid !== u.uid) {
        router.replace("/user/loans");
        return;
      }
      setLoan({ id, ...data });
      setLoading(false);
    });
    return () => unsub();
  }, [id, router]);

  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat("en-LK", {
        style: "currency",
        currency: "LKR",
      }).format(Number(n || 0));
    } catch {
      return Number(n || 0).toFixed(2);
    }
  };

  const metrics = useMemo(() => {
    if (!loan) return null;
    return [
      { label: "Principal", value: fmt(loan.principal) },
      { label: "APR", value: `${loan.interestAPR}%` },
      { label: "Term", value: `${loan.termDays} days` },
      { label: "LTV", value: `${loan.ltvPercent}%` },
      { label: "Max top-up cap", value: fmt(loan.maxPrincipalAllowed) },
    ];
  }, [loan]);

  const accept = async () => {
    if (!loan) return;
    setErr(null);
    setAccepting(true);
    try {
      const start = new Date();
      const due = new Date(start.getTime() + loan.termDays * 24 * 60 * 60 * 1000);

      await updateDoc(doc(db, "loans", id), {
        status: "active",
        startDate: start,
        dueDate: due,
        lastAccruedAt: start,
        updatedAt: serverTimestamp(),
      });

      if (loan.collateralId) {
        await updateDoc(doc(db, "collaterals", loan.collateralId), {
          status: "loan_active",
          updatedAt: serverTimestamp(),
        });
      }

      router.replace("/user/loans");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to activate loan.");
    } finally {
      setAccepting(false);
      setConfirming(false);
    }
  };

  if (loading)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading loan offer…
        </div>
      </div>
    );

  if (!loan)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        Not found
      </div>
    );

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* glowing background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
            Loan Offer
          </h1>
          <button
            onClick={() => router.back()}
            className="rounded-full border border-white/20 bg-gray-800/70 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700/60 transition"
          >
            Back
          </button>
        </header>

        <section className="rounded-2xl border border-white/10 bg-gray-900/70 p-5 backdrop-blur-md space-y-5">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {metrics?.map((m) => (
              <li key={m.label} className="rounded-xl bg-gray-800/60 p-3">
                <div className="text-xs text-gray-400">{m.label}</div>
                <div className="mt-0.5 font-semibold text-gray-100">{m.value}</div>
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            By accepting, interest accrues from the{" "}
            <span className="font-semibold text-amber-100">start date</span> until the{" "}
            <span className="font-semibold text-amber-100">due date</span>. You can request
            top-ups and repay anytime before the loan matures.
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white hover:opacity-90"
              >
                Accept & Activate
              </button>
            ) : (
              <div className="flex w-full items-center gap-2">
                <button
                  onClick={accept}
                  disabled={accepting}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  {accepting ? "Activating…" : "Confirm Accept"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="rounded-xl border border-white/10 bg-gray-800 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {err && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {err}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
