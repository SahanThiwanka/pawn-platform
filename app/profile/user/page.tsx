"use client";

import { auth, db, storage } from "../../lib/firebase.client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { isNonEmpty, isSriLankanNIC, isPhoneOk } from "../../lib/validators";

export default function UserProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [nicNumber, setNicNumber] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [nicFile, setNicFile] = useState<File | null>(null);
  const [nicPreview, setNicPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const snap = await getDoc(doc(db, "users", u.uid));
      const data = snap.data() || {};
      if (data.role !== "user" && data.role !== null) return router.replace("/dashboard");
      if (data.displayName) setDisplayName(data.displayName);
      if (data.address) setAddress(data.address);
      if (data.phone) setPhone(data.phone);
      if (data.nicNumber) setNicNumber(data.nicNumber);
      if (data.nicPhotoPath) setNicPreview(data.nicPhotoPath);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const save = async () => {
    setError(null);

    if (!isNonEmpty(displayName)) return setError("Please enter your full name.");
    if (!isSriLankanNIC(nicNumber)) return setError("NIC looks invalid. Use 9 digits + V/X or 12 digits.");
    if (!isPhoneOk(phone)) return setError("Phone number looks invalid.");
    if (!isNonEmpty(address)) return setError("Please enter your address.");

    const u = auth.currentUser!;
    let nicPhotoPath: string | undefined = undefined;

    if (nicFile) {
      const path = `users/${u.uid}/nic/${Date.now()}_${nicFile.name}`;
      const sref = ref(storage, path);
      await uploadBytes(sref, nicFile);
      nicPhotoPath = await getDownloadURL(sref);
    }

    await updateDoc(doc(db, "users", u.uid), {
      role: "user",
      displayName,
      nicNumber: nicNumber.trim().toUpperCase(),
      address,
      phone,
      nicPhotoPath: nicPhotoPath ?? nicPreview ?? null,
      profileCompleted: true,
      updatedAt: serverTimestamp(),
    });

    router.replace("/dashboard");
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Complete your profile</h1>

      <div className="space-y-3">
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Full name"
          value={displayName}
          onChange={(e)=>setDisplayName(e.target.value)}
        />
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="NIC number (e.g., 993456789V or 200012345678)"
          value={nicNumber}
          onChange={(e)=>setNicNumber(e.target.value)}
        />
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Phone"
          value={phone}
          onChange={(e)=>setPhone(e.target.value)}
        />
        <textarea
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Address"
          value={address}
          onChange={(e)=>setAddress(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-gray-600">NIC Photo (image)</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e)=>setNicFile(e.target.files?.[0] ?? null)}
        />
        {nicPreview && (
          <div className="mt-2">
            <img src={nicPreview} alt="NIC" className="max-h-40 rounded border" />
          </div>
        )}
      </div>

      <button onClick={save} className="rounded-lg bg-black text-white px-4 py-2">
        Save
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </main>
  );
}
