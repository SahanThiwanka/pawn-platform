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
  updateDoc,
  doc,
  Timestamp,
  serverTimestamp,
  getDoc,
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
  outstanding?: number;
  totalPaid?: number;
  updatedAt?: any;
};

const toDateAny = (v: any): Date | null =>
  v instanceof Date
    ? v
    : v instanceof Timestamp
    ? v.toDate()
    : typeof v === "string" || typeof v === "number"
    ? new Date(v)
    : null;

const fmtMoney = (n?: number) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function ShopLoansPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState<string | null>(null);
  const [rows, setRows] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const meSnap = await getDoc(doc(db, "users", u.uid));
      const me = meSnap.data() as any;
      if (me?.role !== "shop_admin" || !me?.shopId)
        return router.replace("/dashboard");
      setShopId(me.shopId);

      const qL = query(
        collection(db, "loans"),
        where("shopId", "==", me.shopId),
        limit(300)
      );
      const res = await getDocs(qL);
      const list = res.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setRows(list as Loan[]);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const active = useMemo(() => rows.filter((r) => r.status === "active"), [rows]);
  const repaid = useMemo(
    () => rows.filter((r) => ["repaid", "closed"].includes(r.status)),
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

  const mark = async (id: string, status: "repaid" | "defaulted") => {
    setBusy(id);
    setMsg(null);
    setErr(null);
    try {
      await updateDoc(doc(db, "loans", id), { status, updatedAt: serverTimestamp() });
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
      setMsg(`Marked as ${status}.`);
    } catch (e: any) {
      setErr(e?.message || "Failed to update.");
    } finally {
      setBusy(null);
    }
  };

  if (loading)
    return <div className="p-8 text-center text-gray-400">Loading…</div>;

  const Section = ({
    title,
    items,
    actions = true,
  }: {
    title: string;
    items: Loan[];
    actions?: boolean;
  }) => (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="rounded-xl border border-white/10 bg-gray-900/40 backdrop-blur-sm overflow-hidden">
        <table className="w-full text-sm text-gray-200">
          <thead className="bg-gray-800/60 text-gray-300">
            <tr>
              <th className="text-left p-3">Loan</th>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Collateral</th>
              <th className="text-left p-3">Principal</th>
              <th className="text-left p-3">Outstanding</th>
              <th className="text-left p-3">Interest</th>
              <th className="text-left p-3">Due</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3 text-right">Link</th>
              {actions && <th className="p-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td className="p-3">
                  <code className="text-xs text-gray-400">{r.id.slice(0, 8)}</code>
                </td>
                <td className="p-3">
                  <code className="text-xs text-gray-400">{r.userUid}</code>
                </td>
                <td className="p-3">
                  <code className="text-xs text-gray-400">{r.collateralId}</code>
                </td>
                <td className="p-3">{fmtMoney(r.principal)}</td>
                <td className="p-3">
                  {fmtMoney(typeof r.outstanding === "number" ? r.outstanding : r.principal)}
                </td>
                <td className="p-3">{(r.interestPct ?? 0).toFixed(2)}%</td>
                <td className="p-3">{toDateAny(r.dueAt)?.toLocaleString?.() || "—"}</td>
                <td className="p-3 capitalize">{r.status}</td>
                <td className="p-3 text-right">
                  <Link
                    href={`/shop/loans/${r.id}`}
                    className="text-sky-400 underline text-xs hover:text-sky-300"
                  >
                    Open
                  </Link>
                </td>
                {actions && (
                  <td className="p-3 text-right">
                    {r.status === "active" ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => mark(r.id, "repaid")}
                          disabled={busy === r.id}
                          className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 text-xs disabled:opacity-50"
                        >
                          {busy === r.id ? "Saving…" : "Mark Repaid"}
                        </button>
                        <button
                          onClick={() => mark(r.id, "defaulted")}
                          disabled={busy === r.id}
                          className="rounded-lg border border-white/10 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 text-xs disabled:opacity-50"
                        >
                          Default
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="p-4 text-center text-gray-500" colSpan={actions ? 10 : 9}>
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
    <main className="relative max-w-6xl mx-auto p-6 space-y-10 text-gray-100">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-20 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
          Shop Loans
        </h1>
        <Link href="/shop/dashboard" className="text-sm text-sky-400 underline hover:text-sky-300">
          Back to Dashboard
        </Link>
      </div>

      <Section title="Active" items={sortActive} />
      <Section title="Repaid / Closed" items={sortRepaid} actions={false} />
      <Section title="Defaulted" items={sortDefaulted} actions={false} />

      {msg && <p className="text-green-400 text-sm">{msg}</p>}
      {err && <p className="text-red-400 text-sm">{err}</p>}
    </main>
  );
}
