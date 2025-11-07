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
  const [previews, setPreviews] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!files) return setPreviews([]);
    const urls = Array.from(files).map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setError(null);
    setLoading(true);
    try {
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
      setMsg("✅ Submitted for appraisal. The shop will review soon.");
      setTimeout(() => router.replace("/user/dashboard"), 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* Subtle background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto flex min-h-[100svh] w-full items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-gray-900/70 p-6 shadow-2xl backdrop-blur-md md:p-8">
          <header className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-white">
              Submit Jewelry for Loan
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Upload details and photos of your collateral for appraisal.
            </p>
          </header>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-sm text-gray-300">Title</label>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-400 focus:ring focus:ring-indigo-500/30 outline-none"
                placeholder="Ex: 22k Gold Necklace"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm text-gray-300">Description</label>
              <textarea
                className="mt-1 w-full rounded-xl border border-white/10 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-400 focus:ring focus:ring-indigo-500/30 outline-none"
                rows={3}
                placeholder="Briefly describe your jewelry or item"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm text-gray-300">Shop ID</label>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-400 focus:ring focus:ring-indigo-500/30 outline-none"
                placeholder="Enter shop code or ID"
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm text-gray-300">
                Upload Images (up to 5)
              </label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setFiles(e.target.files)}
                className="mt-2 block w-full text-sm text-gray-400"
              />
              {previews.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {previews.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Preview ${i + 1}`}
                      className="h-28 w-full rounded-xl object-cover border border-white/10"
                    />
                  ))}
                </div>
              )}
            </div>

            <button
              disabled={loading}
              className="w-full rounded-full bg-indigo-600 px-4 py-2 font-medium text-white shadow-lg shadow-indigo-600/30 transition hover:translate-y-[-1px] hover:shadow-xl disabled:opacity-60"
            >
              {loading ? "Submitting..." : "Submit for Appraisal"}
            </button>
          </form>

          {msg && (
            <p className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300">
              {msg}
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
