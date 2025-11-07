"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase.client";
import { collection, doc, getDoc, getDocs, orderBy, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toDateAny } from "../../lib/auction";

type A = { id: string; title: string; status: string; startAt?: any; endAt?: any };

export default function ShopAuctionsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<A[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const me = await getDoc(doc(db, "users", u.uid));
      const my = me.data();
      if (my?.role !== "shop_admin" || !my.shopId) return router.replace("/dashboard");

      const qA = query(
        collection(db, "auctions"),
        where("shopId", "==", my.shopId),
        orderBy("startAt", "desc")
      );
      const res = await getDocs(qA);
      setRows(res.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading) return <div className="p-8 text-center">Loading…</div>;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Auctions</h1>
        <Link href="/shop/loans" className="underline text-sm">Back to Loans</Link>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Start</th>
              <th className="text-left p-3">End</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-3">{a.title || "Auction"}</td>
                <td className="p-3">{a.status}</td>
                <td className="p-3">{toDateAny(a.startAt)?.toLocaleString() ?? "—"}</td>
                <td className="p-3">{toDateAny(a.endAt)?.toLocaleString() ?? "—"}</td>
                <td className="p-3 text-right">
                  <Link href={`/auctions/${a.id}`} className="rounded-lg border px-3 py-1.5 hover:bg-gray-50">
                    View Public Page
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-4 text-gray-500" colSpan={5}>No auctions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
