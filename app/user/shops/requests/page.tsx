"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../../lib/firebase.client";
import {
  collection, getDocs, query, where, doc, getDoc, addDoc, serverTimestamp, updateDoc
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Req = { id: string; shopId: string; shopName: string };

export default function UserShopRequests() {
  const router = useRouter();
  const [rows, setRows] = useState<Req[]>([]);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");
      const me = await getDoc(doc(db, "users", u.uid));
      if (me.data()?.role !== "user") return router.replace("/dashboard");

      const em = me.data()?.email || u.email;
      setEmail(em);

      // invites matching my email
      const q = query(collection(db, "invites"), where("email", "==", em), where("status", "==", "pending"));
      const invs = await getDocs(q);
      const out: Req[] = [];
      for (const i of invs.docs) {
        const d = i.data();
        const sSnap = await getDoc(doc(db, "shops", d.shopId));
        out.push({ id: i.id, shopId: d.shopId, shopName: sSnap.data()?.shopName || "Shop" });
      }
      setRows(out);
    });
    return () => unsub();
  }, [router]);

  const accept = async (inviteId: string, shopId: string) => {
    const u = auth.currentUser!;
    await addDoc(collection(db, "memberships"), {
      userId: u.uid,
      shopId,
      status: "active",
      createdBy: "shop",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "invites", inviteId), { status: "accepted", updatedAt: serverTimestamp() });
    setRows((r) => r.filter((x) => x.id !== inviteId));
  };

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Shop Requests</h1>
      <p className="text-gray-600 text-sm">Email: {email ?? "-"}</p>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr><th className="text-left p-3">Shop</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.shopName}</td>
                <td className="p-3 text-right">
                  <button onClick={()=>accept(r.id, r.shopId)} className="rounded-lg bg-black text-white px-4 py-2">
                    Accept
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-4 text-gray-500" colSpan={2}>No pending requests.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Link className="underline text-sm" href="/user/shops">Back to My Shops</Link>
    </main>
  );
}
