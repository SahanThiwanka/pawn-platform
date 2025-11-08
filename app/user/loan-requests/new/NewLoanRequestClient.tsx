"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "../../../lib/firebase.client";
import {
  addDoc, collection, doc, getDoc, getDocs,
  query, where, limit, serverTimestamp
} from "firebase/firestore";
import Link from "next/link";

export default function NewLoanRequestClient(){
  const router = useRouter();
  const search = useSearchParams();
  const [loading, setLoading] = useState(true);

  const [collateral, setCollateral] = useState<any|null>(null);
  const [shops, setShops] = useState<any[]>([]);

  const [shopId, setShopId] = useState("");
  const [amountRequested, setAmountRequested] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [interestPct, setInterestPct] = useState<number>(5);

  const [err, setErr] = useState<string|null>(null);
  const [msg, setMsg] = useState<string|null>(null);

  const collateralId = search.get("collateralId") || "";

  useEffect(()=>{
    const unsub = auth.onAuthStateChanged(async (u)=>{
      if(!u) return router.replace("/login");
      await u.reload();
      if(!u.emailVerified) return router.replace("/verify");

      if(!collateralId){
        setErr("Missing collateralId.");
        setLoading(false);
        return;
      }
      const cSnap = await getDoc(doc(db,"collaterals",collateralId));
      if(!cSnap.exists()){
        setErr("Collateral not found.");
        setLoading(false);
        return;
      }
      const c = { id: collateralId, ...(cSnap.data() as any) };
      if(c.userUid !== u.uid){
        setErr("This collateral is not yours.");
        setLoading(false);
        return;
      }
      setCollateral(c);

      // fetch shops (role=shop_admin)
      const uCol = collection(db,"users");
      const qShops = query(uCol, where("role","==","shop_admin"), limit(200));
      const res = await getDocs(qShops);
      setShops(res.docs.map(d=>({ uid: d.id, ...(d.data() as any) })));

      setLoading(false);
    });
    return ()=>unsub();
  },[router, collateralId]);

  const canSubmit = useMemo(()=>{
    return !!(collateral && shopId && amountRequested>0 && durationDays>0 && interestPct>=0);
  },[collateral,shopId,amountRequested,durationDays,interestPct]);

  const submit = async (e:React.FormEvent)=>{
    e.preventDefault();
    setErr(null); setMsg(null);
    const u = auth.currentUser;
    if(!u) return setErr("Not authenticated.");
    if(!canSubmit) return setErr("Fill all required fields.");

    try{
      await addDoc(collection(db,"loanRequests"),{
        collateralId: collateral.id,
        userUid: u.uid,
        shopId,
        amountRequested: Number(amountRequested||0),
        durationDays: Number(durationDays||0),
        interestPct: Number(interestPct||0),
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setMsg("Request sent.");
      router.replace("/user/collateral");
    }catch(e:any){
      setErr(e?.message || "Failed to submit request.");
    }
  };

  if(loading) return <div className="p-8">Loading…</div>;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Request Loan</h1>

      {collateral && (
        <div className="rounded-xl border p-3">
          <div className="font-medium">{collateral.title}</div>
          <div className="text-xs text-gray-600">
            Est. Value: {Number(collateral.estimatedValue||0).toFixed(2)}
          </div>
          <Link href="/user/collateral" className="underline text-xs">
            Change collateral
          </Link>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4 rounded-xl border p-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Shop *</label>
          <select className="w-full border rounded-lg px-3 py-2"
            value={shopId} onChange={(e)=>setShopId(e.target.value)}>
            <option value="">Select a shop</option>
            {shops.map(s=>(
              <option key={s.uid} value={s.shopId || s.uid}>
                {s.shopName || s.displayName || s.uid}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Uses shopId if present, else uses user uid.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Amount Requested *
            </label>
            <input type="number" min={1}
              className="w-full border rounded-lg px-3 py-2"
              value={amountRequested}
              onChange={(e)=>setAmountRequested(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Duration (days) *
            </label>
            <input type="number" min={1}
              className="w-full border rounded-lg px-3 py-2"
              value={durationDays}
              onChange={(e)=>setDurationDays(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Interest (%) *
            </label>
            <input type="number" min={0} step="0.1"
              className="w-full border rounded-lg px-3 py-2"
              value={interestPct}
              onChange={(e)=>setInterestPct(Number(e.target.value))} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button disabled={!canSubmit}
            className="rounded-lg bg-black text-white px-4 py-2 disabled:opacity-50">
            Send Request
          </button>
          {err && <span className="text-sm text-red-600">{err}</span>}
          {msg && <span className="text-sm text-green-700">{msg}</span>}
        </div>
      </form>
    </main>
  );
}
