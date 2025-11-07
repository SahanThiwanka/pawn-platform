"use client";

import { useEffect, useState } from "react";
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
        const loan = d.data();
        const shopSnap = await getDoc(doc(db, "shops", loan.shopId));
        const shopName = shopSnap.exists() ? (shopSnap.data().shopName ?? "Shop") : "Shop";
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

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Loans</h1>
        <Link href="/user/dashboard" className="underline text-sm">Back</Link>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Shop</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Outstanding</th>
              <th className="text-left p-3">Interest</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.shopName}</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3">{r.outstandingPrincipal.toFixed(2)}</td>
                <td className="p-3">{r.accruedInterest.toFixed(2)}</td>
                <td className="p-3 text-right">
                  <Link href={`/user/loans/${r.id}`} className="rounded-lg border px-3 py-1.5 hover:bg-gray-50">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-4 text-gray-500" colSpan={5}>No loans yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
