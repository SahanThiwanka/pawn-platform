"use client";

import { auth, db, storage } from "../../lib/firebase.client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc, collection, doc, getDoc, serverTimestamp, updateDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { isNonEmpty, isPhoneOk } from "../../lib/validators";
import { ensureJoinCode } from "../../lib/shop";

export default function ShopProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const userSnap = await getDoc(doc(db, "users", u.uid));
      const data = userSnap.data() || {};
      if (data.role !== "shop_admin" && data.role !== null) return router.replace("/dashboard");

      if (data.shopId) {
        // existing shop; prefill and go to dashboard if completed
        const sSnap = await getDoc(doc(db, "shops", data.shopId));
        const s = sSnap.data() || {};
        setShopName(s.shopName || "");
        setAddress(s.address || "");
        setPhone(s.phone || "");
        setLogoPreview(s.logoPath || null);
        setJoinCode(s.joinCode || null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const save = async () => {
    setError(null);
    if (!isNonEmpty(shopName)) return setError("Please enter a shop name.");
    if (!isPhoneOk(phone)) return setError("Shop phone looks invalid.");
    if (!isNonEmpty(address)) return setError("Please enter a shop address.");

    const u = auth.currentUser!;
    const userRef = doc(db, "users", u.uid);
    const userSnap = await getDoc(userRef);
    const user = userSnap.data() || {};

    let shopId = user.shopId as string | undefined;
    let logoPath: string | null = logoPreview ?? null;

    if (!shopId) {
      // create new shop
      const ref = await addDoc(collection(db, "shops"), {
        ownerUid: u.uid,
        shopName,
        address,
        phone,
        logoPath: null,
        profileCompleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      shopId = ref.id;
      await updateDoc(userRef, { role: "shop_admin", shopId, updatedAt: serverTimestamp() });
    }

    if (logoFile) {
      const path = `shops/${shopId}/branding/${Date.now()}_${logoFile.name}`;
      const sref = ref(storage, path);
      await uploadBytes(sref, logoFile);
      logoPath = await getDownloadURL(sref);
    }

    await updateDoc(doc(db, "shops", shopId), {
      shopName,
      address,
      phone,
      logoPath,
      profileCompleted: true,
      updatedAt: serverTimestamp(),
    });

    // ensure join code for onboarding customers
    const code = await ensureJoinCode(shopId);
    setJoinCode(code);

    router.replace("/dashboard");
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Set up your shop</h1>

      <div className="space-y-3">
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Shop name"
          value={shopName}
          onChange={(e)=>setShopName(e.target.value)}
        />
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Shop phone"
          value={phone}
          onChange={(e)=>setPhone(e.target.value)}
        />
        <textarea
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Shop address"
          value={address}
          onChange={(e)=>setAddress(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-gray-600">Logo (optional)</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e)=>setLogoFile(e.target.files?.[0] ?? null)}
        />
        {logoPreview && (
          <div className="mt-2">
            <img src={logoPreview} alt="Logo" className="max-h-40 rounded border" />
          </div>
        )}
      </div>

      {joinCode && (
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-600">Customer Join Code</p>
          <p className="text-2xl font-mono">{joinCode}</p>
        </div>
      )}

      <button onClick={save} className="rounded-lg bg-black text-white px-4 py-2">
        Save
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </main>
  );
}
