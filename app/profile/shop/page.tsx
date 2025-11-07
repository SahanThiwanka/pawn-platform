"use client";

import { auth, db, storage } from "../../lib/firebase.client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function ShopProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      const userSnap = await getDoc(doc(db, "users", u.uid));
      if (userSnap.exists() && userSnap.data().shopId) {
        // already has a shop → send to dashboard
        router.replace("/dashboard");
      } else {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  const save = async () => {
    try {
      const u = auth.currentUser!;
      let logoPath: string | null = null;
      if (logoFile) {
        const path = `shops/${u.uid}/branding/${Date.now()}_${logoFile.name}`;
        const sref = ref(storage, path);
        await uploadBytes(sref, logoFile);
        logoPath = await getDownloadURL(sref);
      }

      const shopRef = await addDoc(collection(db, "shops"), {
        ownerUid: u.uid,
        shopName,
        address,
        phone,
        logoPath,
        profileCompleted: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "users", u.uid), {
        role: "shop_admin",
        shopId: shopRef.id,
        profileCompleted: true,
        updatedAt: serverTimestamp(),
      });

      router.replace("/dashboard");
    } catch (e:any) { setError(e.message); }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <main className="max-w-xl mx-auto p-6 space-y-3">
      <h1 className="text-2xl font-bold">Register your shop</h1>
      <input className="w-full border rounded-lg px-3 py-2" placeholder="Shop name"
             value={shopName} onChange={(e)=>setShopName(e.target.value)} />
      <input className="w-full border rounded-lg px-3 py-2" placeholder="Shop phone"
             value={phone} onChange={(e)=>setPhone(e.target.value)} />
      <textarea className="w-full border rounded-lg px-3 py-2" placeholder="Shop address"
                value={address} onChange={(e)=>setAddress(e.target.value)} />
      <div className="space-y-1">
        <label className="text-sm text-gray-600">Logo (optional)</label>
        <input type="file" accept="image/*" onChange={(e)=>setLogoFile(e.target.files?.[0] ?? null)} />
      </div>
      <button onClick={save} className="rounded-lg bg-black text-white px-4 py-2">Save</button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </main>
  );
}
