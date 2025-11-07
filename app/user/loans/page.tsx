"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase.client";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Row = {
  id: string;
  shopName: string;
  status: string;
  principal: number;
  outstandingPrincipal: number;
  accruedInterest: number;
  dueDate?: string;
};

export default function UserLoansPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const me = await getDoc(doc(db, "users", u.uid));
      if (me.data()?.role !== "user") return router.replace("/dashboard");

      const qLoans = query(collection(db, "loans"), where("customerUid", "==", u.uid));
      const ls = await getDocs(qLoans);
      const out: Row[] = [];
      for (const d of ls.docs) {
        const loan = d.data() as any;
        const shopSnap = await getDoc(doc(db, "shops", loan.shopId));
        const shopName = shopSnap.exists() ? (shopSnap.data()?.shopName ?? "Shop") : "Shop";
        out.push({
          id: d.id,
          shopName,
          status: loan.status,
          principal: Number(loan.principal || 0),
          outstandingPrincipal: Number(loan.outstandingPrincipal || 0),
          accruedInterest: Number(loan.accruedInterest || 0),
          dueDate: loan.dueDate ? new Date(loan.dueDate.seconds * 1000).toLocaleDateString() : undefined,
        });
      }
      setRows(out);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const totals = useMemo(() => {
    const outstanding = rows.reduce((s, r) => s + (r.outstandingPrincipal || 0), 0);
    const interest = rows.reduce((s, r) => s + (r.accruedInterest || 0), 0);
    return { outstanding, interest };
  }, [rows]);

  if (loading) {
    return (
      <div className="relative min-h-[100svh]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />
        <main className="relative z-10 mx-auto grid min-h-[100svh] w-full place-items-center px-4">
          <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-gray-900/70 p-6 backdrop-blur-md">
            <div className="animate-pulse space-y-4">
              <div className="h-7 w-1/3 rounded bg-white/10" />
              <div className="h-10 w-full rounded bg-white/10" />
              <div className="h-10 w-full rounded bg-white/10" />
              <div className="h-10 w-full rounded bg-white/10" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* brand glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-4xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Loans</h1>
            <p className="mt-1 text-sm text-gray-400">Track balances and due dates.</p>
          </div>
          <Link href="/user/dashboard" className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm text-gray-200 hover:bg-indigo-600 hover:text-white">
            Back
          </Link>
        </div>

        {/* Summary chips */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-gray-900/70 p-4 backdrop-blur-md">
            <div className="text-sm text-gray-400">Total Outstanding</div>
            <div className="mt-1 text-2xl font-semibold text-indigo-400">
              {formatCurrency(totals.outstanding)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gray-900/70 p-4 backdrop-blur-md">
            <div className="text-sm text-gray-400">Accrued Interest</div>
            <div className="mt-1 text-2xl font-semibold text-cyan-300">
              {formatCurrency(totals.interest)}
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900/90 text-left text-gray-300">
                <tr className="border-b border-white/10">
                  <Th>Shop</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Outstanding</Th>
                  <Th className="text-right">Interest</Th>
                  <Th className="text-right">Due</Th>
                </tr>
              </thead>
              <tbody className="[&_tr]:border-t [&_tr]:border-white/10">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-800/40">
                    <td className="p-3">{r.shopName}</td>
                    <td className="p-3">
                      <StatusChip status={r.status} />
                    </td>
                    <td className="p-3 text-right">{formatCurrency(r.outstandingPrincipal)}</td>
                    <td className="p-3 text-right">{formatCurrency(r.accruedInterest)}</td>
                    <td className="p-3 text-right">{r.dueDate ?? "—"}</td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/user/loans/${r.id}`}
                        className="rounded-full border border-white/10 bg-gray-800/80 px-3 py-1.5 text-xs text-gray-200 hover:bg-indigo-600 hover:text-white"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="p-4 text-center text-gray-400" colSpan={6}>
                      No loans yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`p-3 text-xs font-semibold uppercase tracking-wide ${className}`}>{children}</th>;
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    overdue: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
    closed: "bg-gray-500/20 text-gray-300 ring-1 ring-gray-500/30",
    defaulted: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
    submitted: "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30",
  };
  const cls = map[status?.toLowerCase?.()] ?? "bg-gray-500/20 text-gray-300 ring-1 ring-gray-500/30";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${cls}`}>{status}</span>;
}

function formatCurrency(n: number) {
  // Customize currency if needed; default is LKR-style no symbol
  try {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      maximumFractionDigits: 2,
    }).format(n || 0);
  } catch {
    return (n || 0).toFixed(2);
  }
}
