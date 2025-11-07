"use client";

import { useEffect, useState } from "react";
import { auth, db, storage } from "../../../lib/firebase.client";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";

export default function NewCollateralPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [shopId, setShopId] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");
    });
    return () => unsub();
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = auth.currentUser!;
    const imageUrls: string[] = [];
    if (files && files.length) {
      for (const f of Array.from(files)) {
        const p = `collateral/${u.uid}/${Date.now()}_${f.name}`;
        const sref = ref(storage, p);
        await uploadBytes(sref, f);
        imageUrls.push(await getDownloadURL(sref));
      }
    }
    await addDoc(collection(db, "collaterals"), {
      ownerUid: u.uid,
      shopId,
      title,
      description: desc,
      images: imageUrls,
      status: "submitted",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setMsg("Submitted for appraisal. The shop will review soon.");
    setTimeout(()=>router.replace("/user/dashboard"), 800);
  };

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Submit Jewelry for Loan</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
        <textarea className="w-full border rounded-lg px-3 py-2" placeholder="Description" value={desc} onChange={e=>setDesc(e.target.value)} />
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Shop ID" value={shopId} onChange={e=>setShopId(e.target.value)} />
        <input type="file" multiple accept="image/*" onChange={e=>setFiles(e.target.files)} />
        <button className="rounded-lg bg-black text-white px-4 py-2">Submit</button>
      </form>
      {msg && <p className="text-green-600 text-sm">{msg}</p>}
    </main>
  );
}
