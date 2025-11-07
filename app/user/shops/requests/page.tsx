"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../../lib/firebase.client";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Req = { id: string; shopId: string; shopName: string };

export default function UserShopRequests() {
  const router = useRouter();
  const [rows, setRows] = useState<Req[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");
      const me = await getDoc(doc(db, "users", u.uid));
      if (me.data()?.role !== "user") return router.replace("/dashboard");

      const em = (me.data()?.email as string) || u.email || null;
      setEmail(em);

      // invites matching my email
      try {
        const qInv = query(
          collection(db, "invites"),
          where("email", "==", em),
          where("status", "==", "pending")
        );
        const invs = await getDocs(qInv);
        const out: Req[] = [];
        for (const i of invs.docs) {
          const d = i.data() as any;
          const sSnap = await getDoc(doc(db, "shops", d.shopId));
          out.push({
            id: i.id,
            shopId: d.shopId,
            shopName: sSnap.data()?.shopName || "Shop",
          });
        }
        setRows(out);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load requests.");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  const accept = async (inviteId: string, shopId: string) => {
    setErr(null);
    setMsg(null);
    setAcceptingId(inviteId);
    try {
      const u = auth.currentUser!;
      await addDoc(collection(db, "memberships"), {
        userId: u.uid,
        shopId,
        status: "active",
        createdBy: "shop",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "invites", inviteId), {
        status: "accepted",
        updatedAt: serverTimestamp(),
      });
      setRows((r) => r.filter((x) => x.id !== inviteId));
      setMsg("✅ Request accepted.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to accept request.");
    } finally {
      setAcceptingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading requests…
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* brand glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-2xl space-y-6 p-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Shop Requests</h1>
            <p className="mt-1 text-sm text-gray-400">
              Email: <span className="font-mono">{email ?? "—"}</span>
            </p>
          </div>
          <Link
            href="/user/shops"
            className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm text-gray-200 hover:bg-indigo-600 hover:text-white"
          >
            Back to My Shops
          </Link>
        </header>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 text-gray-300">
              <tr className="border-b border-white/10">
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">
                  Shop
                </th>
                <th className="p-3 text-right" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-white/10 transition hover:bg-gray-800/40"
                >
                  <td className="p-3">{r.shopName}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => accept(r.id, r.shopId)}
                      disabled={acceptingId === r.id}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {acceptingId === r.id ? "Accepting…" : "Accept"}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    className="p-6 text-center text-gray-400"
                    colSpan={2}
                  >
                    No pending requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {msg && (
          <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {msg}
          </p>
        )}
        {err && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {err}
          </p>
        )}
      </main>
    </div>
  );
}
