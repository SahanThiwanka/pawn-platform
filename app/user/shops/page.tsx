"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase.client";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Row = { id: string; name: string; status: string };

export default function UserShopsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");
      const me = await getDoc(doc(db, "users", u.uid));
      if (me.data()?.role !== "user") return router.replace("/dashboard");

      const q = query(collection(db, "memberships"), where("userId", "==", u.uid));
      const ms = await getDocs(q);

      const out: Row[] = [];
      for (const m of ms.docs) {
        const d = m.data();
        const sSnap = await getDoc(doc(db, "shops", d.shopId));
        const s = sSnap.data() || {};
        out.push({ id: d.shopId, name: s.shopName || "Shop", status: d.status || "active" });
      }
      setRows(out);
    });
    return () => unsub();
  }, [router]);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Shops</h1>
        <Link href="/user/shops/join" className="rounded-lg bg-black text-white px-4 py-2">
          Join a Shop
        </Link>
      </div>
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Shop</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.name}</td>
                <td className="p-3">{r.status}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-4 text-gray-500" colSpan={2}>No shops yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
