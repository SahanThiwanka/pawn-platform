"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../../lib/firebase.client";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  limit,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ensureJoinCode } from "../../../lib/shop";

export default function ShopCustomersAddPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [shopId, setShopId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const user = userSnap.data();
      if (user?.role !== "shop_admin" || !user.shopId) return router.replace("/dashboard");

      setShopId(user.shopId);
      const code = await ensureJoinCode(user.shopId);
      setJoinCode(code);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const addByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    if (!shopId) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return setError("Please enter a valid email.");

    setSubmitting(true);
    try {
      // 1) If user exists, avoid duplicate memberships
      const qUser = query(collection(db, "users"), where("email", "==", normalizedEmail), limit(1));
      const usersRes = await getDocs(qUser);

      if (!usersRes.empty) {
        const userDoc = usersRes.docs[0];

        // Check existing membership for this user+shop
        const qMember = query(
          collection(db, "memberships"),
          where("userId", "==", userDoc.id),
          where("shopId", "==", shopId),
          limit(1)
        );
        const memberRes = await getDocs(qMember);
        if (!memberRes.empty) {
          setStatus("This user is already linked to your shop.");
          return;
        }

        await addDoc(collection(db, "memberships"), {
          userId: userDoc.id,
          shopId,
          status: "active",
          createdBy: "shop",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setStatus("Linked existing user as customer.");
        setEmail("");
        return;
      }

      // 2) If user not found, avoid duplicate pending invites
      const qInvite = query(
        collection(db, "invites"),
        where("email", "==", normalizedEmail),
        where("shopId", "==", shopId),
        where("status", "==", "pending"),
        limit(1)
      );
      const inviteRes = await getDocs(qInvite);
      if (!inviteRes.empty) {
        setStatus("An invite is already pending for this email.");
        return;
      }

      await addDoc(collection(db, "invites"), {
        email: normalizedEmail,
        shopId,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setStatus("Invite created. When the user registers with this email, they can accept it.");
      setEmail("");
    } catch (e: any) {
      setError(e?.message || "Failed to add customer.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async () => {
    if (!joinCode) return;
    await navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  if (loading)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading shop info…
        </div>
      </div>
    );

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* glowing gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/25 via-sky-500/15 to-cyan-400/10 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-xl p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
            Add Customer
          </h1>
          <Link
            href="/shop/customers"
            className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm hover:bg-indigo-600 hover:text-white transition"
          >
            Back
          </Link>
        </div>

        {/* Add by Email */}
        <form
          onSubmit={addByEmail}
          className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md p-5 space-y-4"
        >
          <h2 className="font-semibold text-lg">Add by Email</h2>
          <input
            type="email"
            className="w-full rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="customer@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 text-white px-4 py-2 hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-transparent" />
                Adding…
              </span>
            ) : (
              "Add"
            )}
          </button>

          {status && (
            <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              {status}
            </p>
          )}
          {error && (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
        </form>

        {/* Join by Code */}
        <section className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md p-5 space-y-3">
          <h2 className="font-semibold text-lg">Join by Code</h2>
          <p className="text-gray-400 text-sm">Share this code with customers:</p>

          <div className="flex items-center gap-3">
            <p className="text-3xl font-mono tracking-widest text-cyan-400 select-all">
              {joinCode ?? "…"}
            </p>
            {joinCode && (
              <button
                type="button"
                onClick={copyCode}
                className="rounded-lg border border-white/10 bg-gray-800/80 px-3 py-1.5 text-sm hover:bg-gray-700"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            )}
          </div>

          <p className="text-gray-500 text-xs">
            Customers go to <code>/user/shops/join</code> and enter this code.
          </p>
        </section>
      </main>
    </div>
  );
}
