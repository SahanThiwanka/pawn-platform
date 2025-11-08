"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "../../../lib/firebase.client";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";

type UFile = File & { preview?: string };

export default function NewCollateralPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [estimatedValue, setEstimatedValue] = useState<number>(0);
  const [files, setFiles] = useState<UFile[]>([]);

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    const withPreview = list.map((f) => {
      const uf = f as UFile;
      uf.preview = URL.createObjectURL(f);
      return uf;
    });
    setFiles(withPreview);
  };

  const uploadAllImages = async (uid: string, collId: string, selected: UFile[]) => {
    if (!selected.length) return [] as string[];
    const urls: string[] = [];
    let index = 0;
    for (const file of selected) {
      const cleanName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `collateralImages/${uid}/${collId}/${Date.now()}_${index++}_${cleanName}`;
      const objectRef = sRef(storage, path);
      const snap = await uploadBytes(objectRef, file, {
        contentType: file.type || "application/octet-stream",
      });
      const url = await getDownloadURL(snap.ref);
      urls.push(url);
    }
    return urls;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setSaving(true);

    const u = auth.currentUser;
    if (!u) {
      setErr("Not authenticated.");
      setSaving(false);
      return;
    }
    if (!title || !estimatedValue) {
      setErr("Please fill Title and Estimated Value.");
      setSaving(false);
      return;
    }

    try {
      const newRef = doc(collection(db, "collaterals"));
      const collId = newRef.id;
      const imageUrls = await uploadAllImages(u.uid, collId, files);

      await setDoc(newRef, {
        userUid: u.uid,
        title,
        description: desc || "",
        images: imageUrls,
        estimatedValue: Number(estimatedValue || 0),
        status: "available",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMsg("Collateral added.");
      router.replace("/user/collateral");
    } catch (e: any) {
      setErr(e?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-gray-950 text-gray-400">
        <div className="animate-pulse rounded-2xl border border-white/10 bg-gray-900/70 px-8 py-6 backdrop-blur-md">
          Loading…
        </div>
      </div>
    );

  return (
    <div className="relative min-h-[100svh] bg-gray-950 text-gray-100">
      {/* glowing gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25 blur-3xl" />

      <main className="relative z-10 mx-auto max-w-3xl p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
            Add Jewelry
          </h1>
          <button
            onClick={() => router.back()}
            className="rounded-full border border-white/10 bg-gray-800/80 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white transition"
          >
            Back
          </button>
        </div>

        <form
          onSubmit={submit}
          className="space-y-5 rounded-2xl border border-white/10 bg-gray-900/70 p-6 backdrop-blur-md"
        >
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title *</label>
            <input
              className="w-full rounded-lg border border-white/10 bg-gray-800/60 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-cyan-400 focus:outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="22K Gold Necklace"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              className="w-full rounded-lg border border-white/10 bg-gray-800/60 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-cyan-400 focus:outline-none"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="e.g. Intricate design with embedded gemstones."
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Estimated Value (LKR/USD) *
            </label>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border border-white/10 bg-gray-800/60 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-cyan-400 focus:outline-none"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Photos (JPEG/PNG, multiple allowed)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onPickFiles}
              className="block w-full text-sm text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/20 file:px-4 file:py-1.5 file:text-cyan-200 hover:file:bg-cyan-500/30 transition"
            />
            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {files.map((f, i) => (
                  <img
                    key={i}
                    src={f.preview!}
                    alt={f.name}
                    className="h-24 w-full object-cover rounded-lg border border-white/10"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-5 py-2 font-medium text-white hover:opacity-90 disabled:opacity-60 transition"
            >
              {saving ? "Saving…" : "Save Jewelry"}
            </button>
            {err && <span className="text-sm text-red-400">{err}</span>}
            {msg && <span className="text-sm text-emerald-400">{msg}</span>}
          </div>
        </form>
      </main>
    </div>
  );
}
