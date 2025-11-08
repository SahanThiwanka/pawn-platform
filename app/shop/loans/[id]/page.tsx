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
  limit,
  query,
  where,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
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
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function ShopLoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [shopId, setShopId] = useState<string | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [topups, setTopups] = useState<TopUp[]>([]);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<string>("cash");
  const [paidAt, setPaidAt] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [busyAdd, setBusyAdd] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const meSnap = await getDoc(doc(db, "users", u.uid));
      const me = meSnap.data() as any;
      if (me?.role !== "shop_admin" || !me?.shopId) {
        return router.replace("/dashboard");
      }
      setShopId(me.shopId);

      const loanSnap = await getDoc(doc(db, "loans", id));
      if (!loanSnap.exists()) {
        setLoading(false);
        return;
      }

      const L = { id, ...(loanSnap.data() as any) } as Loan;
      let needsInit = false;
      if (typeof L.outstanding !== "number") {
        L.outstanding = Number(L.principal || 0);
        needsInit = true;
      }
      if (typeof L.totalPaid !== "number") {
        L.totalPaid = 0;
        needsInit = true;
      }
      if (needsInit) {
        await updateDoc(doc(db, "loans", id), {
          outstanding: L.outstanding,
          totalPaid: L.totalPaid,
          updatedAt: serverTimestamp(),
        });
      }

      setLoan(L);

      const qP = query(collection(db, "payments"), where("loanId", "==", id), limit(500));
      const resP = await getDocs(qP);
      setPayments(resP.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

      const qT = query(collection(db, "topups"), where("loanId", "==", id), limit(200));
      const resT = await getDocs(qT);
      setTopups(resT.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

      setLoading(false);
    });
    return () => unsub();
  }, [id, router]);

  const sortedPayments = useMemo(
    () =>
      [...payments].sort(
        (a, b) =>
          (toDateAny(b.paidAt)?.getTime() ?? toDateAny(b.createdAt)?.getTime() ?? 0) -
          (toDateAny(a.paidAt)?.getTime() ?? toDateAny(a.createdAt)?.getTime() ?? 0)
      ),
    [payments]
  );

  const sortedTopups = useMemo(
    () =>
      [...topups].sort(
        (a, b) => (toDateAny(b.createdAt)?.getTime() ?? 0) - (toDateAny(a.createdAt)?.getTime() ?? 0)
      ),
    [topups]
  );

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!loan || !shopId) return;
    const amt = Number(amount || 0);
    if (!amt || amt <= 0) return setErr("Enter a valid amount.");
    const paidAtDate = paidAt ? new Date(paidAt) : new Date();
    if (isNaN(paidAtDate.getTime())) return setErr("Invalid payment date/time.");

    try {
      setBusyAdd(true);
      const currentUid = auth.currentUser?.uid || "system";

      await runTransaction(db, async (tx) => {
        const loanRef = doc(db, "loans", loan.id);
        const loanSnap = await tx.get(loanRef);
        if (!loanSnap.exists()) throw new Error("Loan not found.");
        const L = loanSnap.data() as any;

        const outstanding = Number(L.outstanding ?? L.principal ?? 0);
        const totalPaid = Number(L.totalPaid ?? 0);
        const newOutstanding = Math.max(0, outstanding - amt);
        const newTotalPaid = totalPaid + amt;

        const payRef = doc(collection(db, "payments"));
        tx.set(payRef, {
          id: payRef.id,
          loanId: loan.id,
          userUid: L.userUid,
          shopId: loan.shopId || shopId,
          amount: amt,
          method: method || null,
          status: "approved",
          paidAt: paidAtDate,
          note: note || null,
          createdBy: currentUid,
          createdByRole: "shop_admin",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const updates: any = {
          outstanding: newOutstanding,
          totalPaid: newTotalPaid,
          updatedAt: serverTimestamp(),
        };
        if (newOutstanding <= 0 && L.status === "active") updates.status = "repaid";
        tx.update(loanRef, updates);
      });

      const fresh = await getDoc(doc(db, "loans", loan.id));
      if (fresh.exists()) setLoan({ id: loan.id, ...(fresh.data() as any) });

      const qP = query(collection(db, "payments"), where("loanId", "==", loan.id), limit(500));
      const res = await getDocs(qP);
      setPayments(res.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

      setAmount(0);
      setNote("");
      setPaidAt("");
      setMsg("Payment recorded.");
    } catch (e: any) {
      setErr(e?.message || "Failed to add payment.");
    } finally {
      setBusyAdd(false);
    }
  };

  const approveTopUp = async (t: TopUp) => {
    setErr(null);
    setMsg(null);
    if (!loan) return;
    try {
      await runTransaction(db, async (tx) => {
        const loanRef = doc(db, "loans", loan.id);
        const loanSnap = await tx.get(loanRef);
        if (!loanSnap.exists()) throw new Error("Loan not found.");
        const L = loanSnap.data() as any;

        const newPrincipal = Number(L.principal || 0) + Number(t.amount || 0);
        const newOutstanding = Number(L.outstanding ?? L.principal ?? 0) + Number(t.amount || 0);

        const updates: any = {
          principal: newPrincipal,
          outstanding: newOutstanding,
          updatedAt: serverTimestamp(),
        };
        if (typeof t.newAppraisedValue === "number" && t.newAppraisedValue > 0) {
          updates.appraisedValue = t.newAppraisedValue;
        }
        tx.update(loanRef, updates);

        const topRef = doc(db, "topups", t.id);
        tx.update(topRef, {
          status: "approved",
          decidedAt: serverTimestamp(),
          decidedBy: auth.currentUser?.uid || null,
        });
      });

      const fresh = await getDoc(doc(db, "loans", loan.id));
      if (fresh.exists()) setLoan({ id: loan.id, ...(fresh.data() as any) });

      const qT = query(collection(db, "topups"), where("loanId", "==", loan.id), limit(200));
      const ts = await getDocs(qT);
      setTopups(ts.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

      setMsg("Top-up approved. Principal & outstanding updated.");
    } catch (e: any) {
      setErr(e?.message || "Failed to approve top-up.");
    }
  };

  const declineTopUp = async (t: TopUp) => {
    setErr(null);
    setMsg(null);
    try {
      await updateDoc(doc(db, "topups", t.id), {
        status: "declined",
        decidedAt: serverTimestamp(),
        decidedBy: auth.currentUser?.uid || null,
      });
      setTopups((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: "declined" } : x)));
      setMsg("Top-up declined.");
    } catch (e: any) {
      setErr(e?.message || "Failed to decline top-up.");
    }
  };

  if (loading)
    return <div className="p-8 text-center text-gray-400">Loading…</div>;
  if (!loan)
    return <div className="p-8 text-center text-gray-400">Loan not found.</div>;

  const due = toDateAny(loan.dueAt)?.toLocaleString?.() || "—";

  return (
    <main className="relative max-w-5xl mx-auto p-6 space-y-10 text-gray-100">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/20 via-cyan-400/10 to-transparent opacity-40 blur-3xl" />

      <div className="relative flex items-center justify-between">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
          Loan #{loan.id.slice(0, 6)}
        </h1>
        <div className="flex gap-3 text-sm">
          <Link href="/shop/loans" className="text-sky-400 underline hover:text-sky-300">
            Back to Loans
          </Link>
          <Link
            href={`/user/loans/${loan.id}`}
            className="text-sky-400 underline hover:text-sky-300"
            prefetch={false}
          >
            View as User
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Principal", value: money(loan.principal), sub: "Appraised Value", subVal: loan.appraisedValue ? money(loan.appraisedValue) : "—" },
          { label: "Outstanding", value: money(loan.outstanding), sub: "Total Paid", subVal: money(loan.totalPaid) },
          { label: "Due", value: due, sub: "Status", subVal: loan.status },
        ].map((x) => (
          <div
            key={x.label}
            className="rounded-xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-4"
          >
            <div className="text-sm text-gray-400">{x.label}</div>
            <div className="text-2xl font-semibold">{x.value}</div>
            <div className="text-sm text-gray-400 mt-2">{x.sub}</div>
            <div className="text-xl font-semibold capitalize">{x.subVal}</div>
          </div>
        ))}
      </div>

      {/* Record Payment */}
      <section className="space-y-3 relative">
        <h2 className="text-xl font-semibold">Record a Payment</h2>
        <form
          onSubmit={addPayment}
          className="rounded-xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-4 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Amount *</label>
              <input
                type="number"
                min={1}
                step="0.01"
                className="w-full bg-gray-800/70 border border-white/10 rounded-lg px-3 py-2 text-gray-100"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="5000"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Method</label>
              <select
                className="w-full bg-gray-800/70 border border-white/10 rounded-lg px-3 py-2 text-gray-100"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Paid At</label>
              <input
                type="datetime-local"
                className="w-full bg-gray-800/70 border border-white/10 rounded-lg px-3 py-2 text-gray-100"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for now.</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Note</label>
              <input
                className="w-full bg-gray-800/70 border border-white/10 rounded-lg px-3 py-2 text-gray-100"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Receipt #123, teller…"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              disabled={busyAdd}
              className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 disabled:opacity-50"
            >
              {busyAdd ? "Saving…" : "Add Payment"}
            </button>
            {err && <span className="text-sm text-red-400">{err}</span>}
            {msg && <span className="text-sm text-green-400">{msg}</span>}
          </div>
        </form>
      </section>

      {/* Top-Up Requests */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Top-Up Requests</h2>
        <div className="rounded-xl border border-white/10 bg-gray-900/40 backdrop-blur-sm overflow-hidden">
          <table className="w-full text-sm text-gray-200">
            <thead className="bg-gray-800/60 text-gray-300">
              <tr>
                <th className="text-left p-3">Requested</th>
                <th className="text-left p-3">Amount</th>
                <th className="text-left p-3">New Appraisal</th>
                <th className="text-left p-3">Reason</th>
                <th className="text-left p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedTopups.map((t) => (
                <tr key={t.id} className="border-t border-white/10">
                  <td className="p-3">{toDateAny(t.createdAt)?.toLocaleString?.() || "—"}</td>
                  <td className="p-3">{money(t.amount)}</td>
                  <td className="p-3">
                    {typeof t.newAppraisedValue === "number" ? money(t.newAppraisedValue) : "—"}
                  </td>
                  <td className="p-3">{t.reason || "—"}</td>
                  <td className="p-3 capitalize">{t.status}</td>
                  <td className="p-3 text-right">
                    {t.status === "pending" ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => approveTopUp(t)}
                          className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => declineTopUp(t)}
                          className="rounded-lg bg-transparent border border-white/20 hover:bg-white/10 px-3 py-1.5"
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {sortedTopups.length === 0 && (
                <tr>
                  <td className="p-4 text-gray-500" colSpan={6}>
                    No top-ups yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Payment History */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Payment History</h2>
        <div className="rounded-xl border border-white/10 bg-gray-900/40 backdrop-blur-sm overflow-hidden">
          <table className="w-full text-sm text-gray-200">
            <thead className="bg-gray-800/60 text-gray-300">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Amount</th>
                <th className="text-left p-3">Method</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Note</th>
                <th className="text-left p-3">Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {sortedPayments.map((p) => (
                <tr key={p.id} className="border-t border-white/10">
                  <td className="p-3">
                    {toDateAny(p.paidAt)?.toLocaleString?.() ||
                      toDateAny(p.createdAt)?.toLocaleString?.() ||
                      "—"}
                  </td>
                  <td className="p-3">{money(p.amount)}</td>
                  <td className="p-3 capitalize">{p.method || "—"}</td>
                  <td className="p-3 capitalize">{p.status}</td>
                  <td className="p-3">{p.note || "—"}</td>
                  <td className="p-3 text-xs text-gray-400">
                    {p.createdByRole || "—"} <code>{p.createdBy || "—"}</code>
                  </td>
                </tr>
              ))}
              {sortedPayments.length === 0 && (
                <tr>
                  <td className="p-4 text-gray-500" colSpan={6}>
                    No payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
