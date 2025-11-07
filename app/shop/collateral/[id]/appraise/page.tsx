"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../../../lib/firebase.client";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
  collection,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";

export default function AppraiseCollateralPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [collateral, setCollateral] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [appraisedValue, setAppraisedValue] = useState<number>(0);
  const [ltvPercent, setLtvPercent] = useState<number>(50);
  const [interestAPR, setInterestAPR] = useState<number>(24);
  const [termDays, setTermDays] = useState<number>(30);

  // currency formatter (Sri Lanka)
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat("en-LK", {
        style: "currency",
        currency: "LKR",
        maximumFractionDigits: 2,
      }).format(Number(n || 0));
    } catch {
      return (Number(n || 0)).toFixed(2);
    }
  };

  const principalOffer = useMemo(
    () => Math.floor(Number(appraisedValue || 0) * (Number(ltvPercent || 0) / 100)),
    [appraisedValue, ltvPercent]
  );

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      // require shop admin
      const me = await getDoc(doc(db, "users", u.uid));
      const my = me.data();
      if (my?.role !== "shop_admin" || !my.shopId) return router.replace("/dashboard");

      // fetch collateral
      const cs = await getDoc(doc(db, "collaterals", id));
      const data = cs.data();
      if (!data) return router.replace("/shop/collateral");

      // optional: prevent cross-shop appraisal
      if (data.shopId && data.shopId !== my.shopId) {
        return router.replace("/shop/collateral");
      }

      setCollateral({ id, ...data });
      // prefill appraised value if previously set
      if (data.appraisedValue) setAppraisedValue(Number(data.appraisedValue));
      setLoading(false);
    });
    return () => unsub();
  }, [id, router]);

  const submitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!collateral) return;

    // basic validation
    if (appraisedValue <= 0) return setErr("Enter a valid appraised value.");
    if (ltvPercent <= 0 || ltvPercent > 100) return setErr("LTV must be between 1% and 100%.");
    if (interestAPR <= 0) return setErr("Enter a positive APR.");
    if (termDays <= 0) return setErr("Term must be at least 1 day.");

    setSubmitting(true);
    try {
      const principal = principalOffer;

      // create pending loan offer
      const loanRef = await addDoc(collection(db, "loans"), {
        shopId: collateral.shopId,
        customerUid: collateral.ownerUid,
        collateralId: collateral.id,
        principal,
        maxPrincipalAllowed: Number(appraisedValue),
        ltvPercent: Number(ltvPercent),
        interestAPR: Number(interestAPR),
        interestMode: "simple",
        termDays: Number(termDays),
        outstandingPrincipal: principal,
        accruedInterest: 0,
        lateFees: 0,
        status: "pending_offer",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // update collateral
      await updateDoc(doc(db, "collaterals", collateral.id), {
        appraisedValue: Number(appraisedValue),
        appraisalNotes: null,
        status: "appraised",
        linkedLoanId: loanRef.id,
        updatedAt: serverTimestamp(),
      });

      setMsg("Offer created.");
      setTimeout(() => router.replace("/shop/collateral"), 700);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create offer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading collateral…
        </div>
      </div>
    );
  }

  if (!collateral) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center bg-gray-950 text-gray-400">
        Not found
      </div>
    );
  }

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* brand glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-2xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Appraise: {collateral.title ?? "Collateral"}</h1>
          <button
            onClick={() => router.back()}
            className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm text-gray-200 hover:bg-indigo-600 hover:text-white transition"
          >
            Back
          </button>
        </header>

        {/* Collateral preview */}
        <section className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md p-5 space-y-4">
          {Array.isArray(collateral.images) && collateral.images.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {collateral.images.slice(0, 6).map((src: string, i: number) => (
                <img
                  key={i}
                  src={src}
                  alt={`Collateral ${i + 1}`}
                  className="h-24 w-full rounded-lg object-cover border border-white/10"
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-gray-800/60 p-4 text-sm text-gray-300">
              No images uploaded.
            </div>
          )}

          <div className="text-sm text-gray-300">
            <div className="text-gray-400">Owner UID</div>
            <code className="text-xs">{collateral.ownerUid}</code>
          </div>
        </section>

        {/* Appraisal form */}
        <form
          onSubmit={submitOffer}
          className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400">Appraised Value</label>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., 100000"
                value={appraisedValue}
                onChange={(e) => setAppraisedValue(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label className="text-xs text-gray-400">LTV %</label>
              <input
                type="number"
                min={1}
                max={100}
                className="mt-1 w-full rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="50"
                value={ltvPercent}
                onChange={(e) => setLtvPercent(Number(e.target.value))}
                required
              />
              {/* Optional range slider feel */}
              <input
                type="range"
                min={1}
                max={100}
                value={ltvPercent}
                onChange={(e) => setLtvPercent(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400">Interest APR %</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="24"
                value={interestAPR}
                onChange={(e) => setInterestAPR(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label className="text-xs text-gray-400">Term (days)</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-lg border border-white/10 bg-gray-800/70 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="30"
                value={termDays}
                onChange={(e) => setTermDays(Number(e.target.value))}
                required
              />
            </div>
          </div>

          {/* Live Offer Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Metric label="Appraised" value={fmt(appraisedValue)} />
            <Metric label="LTV" value={`${ltvPercent}%`} />
            <Metric label="Principal Offer" value={fmt(principalOffer)} />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-indigo-600 py-2 font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Creating Offer…" : "Create Offer"}
            </button>
          </div>

          {msg && (
            <p className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              {msg}
            </p>
          )}
          {err && (
            <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {err}
            </p>
          )}
        </form>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-gray-800/70 p-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
