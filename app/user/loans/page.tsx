"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "../../lib/firebase.client";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

type Loan = {
  id: string;
  collateralId: string;
  userUid: string;
  shopId: string | null;
  principal: number;
  interestPct: number;
  durationDays: number;
  startAt?: any;
  dueAt?: any;
  status: "active" | "repaid" | "defaulted" | "closed";
  updatedAt?: any;
};

function toDateAny(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return null;
}

function fmtMoney(n: number | undefined) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function daysLeft(dueAt?: any) {
  const d = toDateAny(dueAt)?.getTime();
  if (!d) return null;
  const ms = d - Date.now();
  return Math.ceil(ms / (24 * 3600 * 1000));
}

export default function UserLoansPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const qL = query(
        collection(db, "loans"),
        where("userUid", "==", u.uid),
        limit(200)
      );
      const res = await getDocs(qL);
      const list = res.docs.map(
        (d) => ({ id: d.id, ...(d.data() as any) } as Loan)
      );
      setRows(list);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const active = useMemo(() => rows.filter((r) => r.status === "active"), [rows]);
  const repaid = useMemo(
    () => rows.filter((r) => r.status === "repaid" || r.status === "closed"),
    [rows]
  );
  const defaulted = useMemo(() => rows.filter((r) => r.status === "defaulted"), [rows]);

  const sortActive = [...active].sort(
    (a, b) => (toDateAny(a.dueAt)?.getTime() ?? 0) - (toDateAny(b.dueAt)?.getTime() ?? 0)
  );
  const sortRepaid = [...repaid].sort(
    (a, b) => (toDateAny(b.updatedAt)?.getTime() ?? 0) - (toDateAny(a.updatedAt)?.getTime() ?? 0)
  );
  const sortDefaulted = [...defaulted].sort(
    (a, b) => (toDateAny(b.updatedAt)?.getTime() ?? 0) - (toDateAny(a.updatedAt)?.getTime() ?? 0)
  );

  if (loading)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading loans…
        </div>
      </div>
    );

  const Section = ({ title, items }: { title: string; items: Loan[] }) => (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="rounded-xl border border-white/10 bg-gray-900/60 backdrop-blur-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/70 text-gray-300">
            <tr>
              <th className="text-left p-3">Collateral</th>
              <th className="text-left p-3">Principal</th>
              <th className="text-left p-3">Interest</th>
              <th className="text-left p-3">Due</th>
              <th className="text-left p-3">Days Left</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => {
              const left = daysLeft(r.dueAt);
              return (
                <tr
                  key={r.id}
                  className="border-t border-white/10 hover:bg-gray-800/40 transition"
                >
                  <td className="p-3">
                    <div className="font-medium text-gray-100">
                      <code className="text-xs text-cyan-300">{r.collateralId}</code>
                    </div>
                    <div className="text-xs text-gray-500">
                      Shop: <code className="text-[10px]">{r.shopId}</code>
                    </div>
                  </td>
                  <td className="p-3 text-gray-200">{fmtMoney(r.principal)}</td>
                  <td className="p-3 text-gray-300">
                    {(r.interestPct ?? 0).toFixed(2)}%
                  </td>
                  <td className="p-3 text-gray-300">
                    {toDateAny(r.dueAt)?.toLocaleString?.() || "—"}
                  </td>
                  <td className="p-3 font-medium">
                    {left !== null ? (
                      <span
                        className={
                          left < 0
                            ? "text-rose-400 font-semibold"
                            : "text-cyan-300"
                        }
                      >
                        {left}d
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 text-gray-200">{r.status}</td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/user/loans/${r.id}`}
                      className="text-xs text-cyan-300 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td
                  className="p-4 text-gray-400 text-center"
                  colSpan={7}
                >
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
      {/* glowing gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
            My Loans
          </h1>
          <Link
            href="/user/collateral"
            className="rounded-lg border border-white/20 bg-gray-800/60 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700/60 transition"
          >
            My Jewelry
          </Link>
        </div>

        <Section title="Active" items={sortActive} />
        <Section title="Repaid / Closed" items={sortRepaid} />
        <Section title="Defaulted" items={sortDefaulted} />
      </main>
    </div>
  );
}
