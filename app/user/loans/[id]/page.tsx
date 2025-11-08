"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../../lib/firebase.client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  limit,
  query,
  where,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from "firebase/firestore";

type Loan = {
  id: string;
  collateralId: string;
  userUid: string;
  shopId: string | null;
  principal: number;
  outstanding?: number;
  totalPaid?: number;
  interestPct: number;
  durationDays: number;
  startAt?: any;
  dueAt?: any;
  status: "active" | "repaid" | "defaulted" | "closed";
  appraisedValue?: number | null;
  updatedAt?: any;
};

type Payment = {
  id: string;
  loanId: string;
  userUid: string;
  shopId: string | null;
  amount: number;
  method?: string | null;
  status: "pending" | "approved" | "declined";
  paidAt?: any;
  note?: string | null;
  createdBy?: string;
  createdByRole?: string;
  createdAt?: any;
};

type TopUp = {
  id: string;
  loanId: string;
  userUid: string;
  shopId: string | null;
  amount: number;
  newAppraisedValue?: number | null;
  reason?: string | null;
  status: "pending" | "approved" | "declined";
  createdAt?: any;
  decidedAt?: any;
  decidedBy?: string | null;
};

function toDateAny(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return null;
}
const money = (n?: number) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function UserLoanDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [me, setMe] = useState<{ uid: string } | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [topups, setTopups] = useState<TopUp[]>([]);
  const [loading, setLoading] = useState(true);

  // repay form
  const [amountPay, setAmountPay] = useState<number>(0);
  const [method, setMethod] = useState<string>("cash");
  const [busyPay, setBusyPay] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // top-up form
  const [tuAmount, setTuAmount] = useState<number>(0);
  const [tuAppraised, setTuAppraised] = useState<number | "">("");
  const [tuReason, setTuReason] = useState<string>("");
  const [busyTopUp, setBusyTopUp] = useState(false);
  const [msgTopUp, setMsgTopUp] = useState<string | null>(null);
  const [errTopUp, setErrTopUp] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");
      setMe({ uid: u.uid });

      // load loan
      const snap = await getDoc(doc(db, "loans", id));
      if (!snap.exists()) { setLoading(false); return; }
      const l = { id, ...(snap.data() as any) } as Loan;

      // initialize cumulative fields
      let needsInit = false;
      if (typeof l.outstanding !== "number") { l.outstanding = Number(l.principal || 0); needsInit = true; }
      if (typeof l.totalPaid !== "number") { l.totalPaid = 0; needsInit = true; }
      if (needsInit) {
        await updateDoc(doc(db, "loans", id), {
          outstanding: l.outstanding,
          totalPaid: l.totalPaid,
          updatedAt: serverTimestamp(),
        });
      }
      setLoan(l);

      // payments
      const qP = query(collection(db, "payments"), where("loanId", "==", id), limit(500));
      const ps = await getDocs(qP);
      setPayments(ps.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

      // top-ups
      const qT = query(collection(db, "topups"), where("loanId", "==", id), limit(200));
      const ts = await getDocs(qT);
      setTopups(ts.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

      setLoading(false);
    });
    return () => unsub();
  }, [id, router]);

  const canRepay = useMemo(() => {
    if (!loan) return false;
    if (loan.status !== "active") return false;
    if ((loan.outstanding || 0) <= 0) return false;
    return true;
  }, [loan]);

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!me || !loan) return;
    const amt = Number(amountPay || 0);
    if (!amt || amt <= 0) return setErr("Enter a valid amount.");

    try {
      setBusyPay(true);
      await addDoc(collection(db, "payments"), {
        loanId: loan.id,
        userUid: me.uid,
        shopId: loan.shopId || null,
        amount: amt,
        method: method || null,
        status: "pending",
        paidAt: null,
        note: null,
        createdBy: me.uid,
        createdByRole: "user",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMsg("Payment submitted for approval.");
      setAmountPay(0);

      const qP = query(collection(db, "payments"), where("loanId", "==", loan.id), limit(500));
      const ps = await getDocs(qP);
      setPayments(ps.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } catch (e: any) {
      setErr(e?.message || "Failed to submit payment.");
    } finally {
      setBusyPay(false);
    }
  };

  const requestTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrTopUp(null); setMsgTopUp(null);
    if (!me || !loan) return;
    const amt = Number(tuAmount || 0);
    if (!amt || amt <= 0) return setErrTopUp("Enter a valid top-up amount.");
    const newAppVal = tuAppraised === "" ? null : Number(tuAppraised);
    if (newAppVal !== null && (isNaN(newAppVal) || newAppVal <= 0)) {
      return setErrTopUp("Appraised value must be positive.");
    }

    try {
      setBusyTopUp(true);
      await addDoc(collection(db, "topups"), {
        loanId: loan.id,
        userUid: me.uid,
        shopId: loan.shopId || null,
        amount: amt,
        newAppraisedValue: newAppVal,
        reason: tuReason || null,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setMsgTopUp("Top-up request sent to shop.");
      setTuAmount(0); setTuAppraised(""); setTuReason("");

      const qT = query(collection(db, "topups"), where("loanId", "==", loan.id), limit(200));
      const ts = await getDocs(qT);
      setTopups(ts.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } catch (e: any) {
      setErrTopUp(e?.message || "Failed to request top-up.");
    } finally {
      setBusyTopUp(false);
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

  if (!loan)
    return (
      <div className="min-h-[100svh] grid place-items-center bg-gray-950 text-gray-200">
        Loan not found.
      </div>
    );

  const due = toDateAny(loan.dueAt)?.toLocaleString?.() || "—";
  const sortedPayments = [...payments].sort((a, b) =>
    (toDateAny(b.paidAt)?.getTime() ?? toDateAny(b.createdAt)?.getTime() ?? 0) -
    (toDateAny(a.paidAt)?.getTime() ?? toDateAny(a.createdAt)?.getTime() ?? 0)
  );
  const sortedTopups = [...topups].sort((a, b) =>
    (toDateAny(b.createdAt)?.getTime() ?? 0) - (toDateAny(a.createdAt)?.getTime() ?? 0)
  );

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />
      <main className="relative z-10 max-w-3xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
            Loan #{loan.id.slice(0, 6)}
          </h1>
          <Link
            href="/user/loans"
            className="rounded-full border border-white/20 bg-gray-800/60 px-4 py-2 text-sm hover:bg-gray-700/60 transition"
          >
            Back to My Loans
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-gray-900/70 p-4 backdrop-blur-md">
            <div className="text-sm text-gray-400">Principal</div>
            <div className="text-xl font-semibold text-gray-100">{money(loan.principal)}</div>
            <div className="mt-2 text-sm text-gray-400">Appraised Value</div>
            <div className="text-xl font-semibold text-gray-100">
              {loan.appraisedValue ? money(loan.appraisedValue) : "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gray-900/70 p-4 backdrop-blur-md">
            <div className="text-sm text-gray-400">Outstanding</div>
            <div className="text-xl font-semibold text-cyan-300">{money(loan.outstanding)}</div>
            <div className="mt-2 text-sm text-gray-400">Total Paid</div>
            <div className="text-xl font-semibold text-gray-100">{money(loan.totalPaid)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gray-900/70 p-4 backdrop-blur-md">
            <div className="text-sm text-gray-400">Due</div>
            <div className="font-medium text-gray-100">{due}</div>
            <div className="mt-1 text-sm">Status: <StatusBadge status={loan.status} /></div>
          </div>
        </div>

        {/* Request Top-Up */}
        {loan.status === "active" && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Request Top-Up</h2>
            <form
              onSubmit={requestTopUp}
              className="rounded-2xl border border-white/10 bg-gray-900/70 p-4 backdrop-blur-md space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Additional Amount *</label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    className="w-full rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={tuAmount}
                    onChange={(e) => setTuAmount(Number(e.target.value))}
                    placeholder="e.g. 500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">New Appraised Value</label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    className="w-full rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={tuAppraised as any}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTuAppraised(v === "" ? "" : Number(v));
                    }}
                    placeholder="Optional e.g. 1,200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Reason</label>
                <input
                  className="w-full rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={tuReason}
                  onChange={(e) => setTuReason(e.target.value)}
                  placeholder="Explain briefly (optional)"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={busyTopUp}
                  className="rounded-lg bg-indigo-600 text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 transition"
                >
                  {busyTopUp ? "Sending…" : "Request Top-Up"}
                </button>
                {errTopUp && <span className="text-sm text-rose-400">{errTopUp}</span>}
                {msgTopUp && <span className="text-sm text-emerald-300">{msgTopUp}</span>}
              </div>
            </form>
          </section>
        )}

        {/* Make a Repayment */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Make a Repayment</h2>
          {canRepay ? (
            <form
              onSubmit={submitPayment}
              className="rounded-2xl border border-white/10 bg-gray-900/70 p-4 backdrop-blur-md space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Amount</label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    className="w-full rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={amountPay}
                    onChange={(e) => setAmountPay(Number(e.target.value))}
                    placeholder="e.g. 5000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Method</label>
                  <select
                    className="w-full rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={busyPay}
                  className="rounded-lg bg-indigo-600 text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 transition"
                >
                  {busyPay ? "Submitting…" : "Submit Payment"}
                </button>
                {err && <span className="text-sm text-rose-400">{err}</span>}
                {msg && <span className="text-sm text-emerald-300">{msg}</span>}
              </div>
            </form>
          ) : (
            <div className="rounded-xl border border-white/10 bg-gray-900/60 p-3 text-sm text-gray-300">
              No repayment needed.
            </div>
          )}
        </section>

        {/* Top-Up History */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Top-Up Requests</h2>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/70 text-gray-300">
                <tr>
                  <th className="text-left p-3">Requested</th>
                  <th className="text-left p-3">Amount</th>
                  <th className="text-left p-3">New Appraisal</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedTopups.map((t) => (
                  <tr key={t.id} className="border-t border-white/10 hover:bg-gray-800/40 transition">
                    <td className="p-3 text-gray-200">{toDateAny(t.createdAt)?.toLocaleString?.() || "—"}</td>
                    <td className="p-3 text-gray-100">{money(t.amount)}</td>
                    <td className="p-3 text-gray-100">{t.newAppraisedValue ? money(t.newAppraisedValue) : "—"}</td>
                    <td className="p-3"><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
                {sortedTopups.length === 0 && (
                  <tr><td className="p-4 text-center text-gray-400" colSpan={4}>No top-ups yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Payment history */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Payments</h2>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/70 text-gray-300">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Amount</th>
                  <th className="text-left p-3">Method</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedPayments.map((p) => (
                  <tr key={p.id} className="border-t border-white/10 hover:bg-gray-800/40 transition">
                    <td className="p-3 text-gray-200">
                      {toDateAny(p.paidAt)?.toLocaleString?.() ||
                        toDateAny(p.createdAt)?.toLocaleString?.() || "—"}
                    </td>
                    <td className="p-3 text-gray-100">{money(p.amount)}</td>
                    <td className="p-3 text-gray-200">{p.method || "—"}</td>
                    <td className="p-3"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
                {sortedPayments.length === 0 && (
                  <tr><td className="p-4 text-center text-gray-400" colSpan={4}>No payments yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ---------- Small UI helper ---------- */
function StatusBadge({ status }: { status: string }) {
  const cls =
    {
      active: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
      repaid: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
      closed: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
      defaulted: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
      pending: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
      approved: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
      declined: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
    }[status?.toLowerCase?.()] || "bg-gray-600/15 text-gray-300 ring-1 ring-gray-600/30";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      {status.replace("_", " ")}
    </span>
  );
}
