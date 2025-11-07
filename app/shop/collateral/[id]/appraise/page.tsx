"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../../../lib/firebase.client";
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";

export default function AppraiseCollateralPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [collateral, setCollateral] = useState<any>(null);

  const [appraisedValue, setAppraisedValue] = useState<number>(0);
  const [ltvPercent, setLtvPercent] = useState<number>(50);
  const [interestAPR, setInterestAPR] = useState<number>(24);
  const [termDays, setTermDays] = useState<number>(30);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      const cs = await getDoc(doc(db, "collaterals", id));
      const data = cs.data();
      if (!data) return router.replace("/shop/collateral");
      setCollateral({ id, ...data });
      setLoading(false);
    });
    return () => unsub();
  }, [id, router]);

  const submitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collateral) return;
    const principalOffer = Math.floor(appraisedValue * (ltvPercent/100));
    const loanRef = await addDoc(collection(db, "loans"), {
      shopId: collateral.shopId,
      customerUid: collateral.ownerUid,
      collateralId: collateral.id,
      principal: principalOffer,
      maxPrincipalAllowed: appraisedValue,
      ltvPercent, interestAPR, interestMode: "simple",
      termDays,
      outstandingPrincipal: principalOffer,
      accruedInterest: 0,
      lateFees: 0,
      status: "pending_offer",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "collaterals", collateral.id), {
      appraisedValue,
      appraisalNotes: null,
      status: "appraised",
      linkedLoanId: loanRef.id,
      updatedAt: serverTimestamp(),
    });
    router.replace("/shop/collateral");
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Appraise: {collateral.title}</h1>
      <form onSubmit={submitOffer} className="space-y-3">
        <input type="number" className="w-full border rounded-lg px-3 py-2"
          placeholder="Appraised value (e.g., 1000)" value={appraisedValue}
          onChange={e=>setAppraisedValue(Number(e.target.value))} />
        <input type="number" className="w-full border rounded-lg px-3 py-2"
          placeholder="LTV %" value={ltvPercent} onChange={e=>setLtvPercent(Number(e.target.value))} />
        <input type="number" className="w-full border rounded-lg px-3 py-2"
          placeholder="Interest APR %" value={interestAPR} onChange={e=>setInterestAPR(Number(e.target.value))} />
        <input type="number" className="w-full border rounded-lg px-3 py-2"
          placeholder="Term (days)" value={termDays} onChange={e=>setTermDays(Number(e.target.value))} />
        <button className="rounded-lg bg-black text-white px-4 py-2">Create Offer</button>
      </form>
    </main>
  );
}
