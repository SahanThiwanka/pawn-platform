"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "../../../lib/firebase.client";
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";

type UFile = File & { preview?: string };

export default function NewAuctionClient() {
  const router = useRouter();
  const [shopId, setShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [startPrice, setStartPrice] = useState<number>(0);
  const [reservePrice, setReservePrice] = useState<number | "">("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  const [files, setFiles] = useState<UFile[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");
      const meSnap = await getDoc(doc(db, "users", u.uid));
      const me = meSnap.data() as any;
      if (me?.role !== "shop_admin" || !me?.shopId) return router.replace("/dashboard");
      setShopId(me.shopId);
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

  const uploadAllImages = async (uid: string, auctionId: string, selected: UFile[]) => {
    if (!selected.length) return [] as string[];
    const urls: string[] = [];
    let idx = 0;
    for (const file of selected) {
      const cleanName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `auctionImages/${uid}/${auctionId}/${Date.now()}_${idx++}_${cleanName}`;
      const objectRef = sRef(storage, path);
      const snap = await uploadBytes(objectRef, file, { contentType: file.type || "application/octet-stream" });
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
    if (!u || !shopId) {
      setErr("Not authenticated.");
      setSaving(false);
      return;
    }
    if (!title || !startPrice || !startAt || !endAt) {
      setErr("Please fill Title, Start Price, Start and End date/time.");
      setSaving(false);
      return;
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setErr("Invalid dates.");
      setSaving(false);
      return;
    }
    if (end <= start) {
      setErr("End time must be after start time.");
      setSaving(false);
      return;
    }

    try {
      const newRef = doc(collection(db, "auctions"));
      const auctionId = newRef.id;
      const imageUrls = await uploadAllImages(u.uid, auctionId, files);

      await setDoc(newRef, {
        shopId,
        createdByUid: u.uid,
        title: title.trim(),
        description: desc || "",
        images: imageUrls,
        startPrice: Number(startPrice || 0),
        reservePrice: reservePrice === "" ? null : Number(reservePrice),
        startAt: start,
        endAt: end,
        status: "scheduled",
        highestBid: 0,
        highestBidUserUid: null,
        winnerUserUid: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMsg("Auction created.");
      router.replace("/shop/auctions");
    } catch (e: any) {
      setErr(e?.message || "Failed to create auction.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <div className="p-8 text-center text-gray-400">Loading…</div>;

  return (
    <main className="relative max-w-3xl mx-auto p-6 space-y-8 text-gray-100">
      {/* glow background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-cyan-500/10 to-transparent opacity-40 blur-3xl" />

      <h1 className="relative text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
        Create Auction
      </h1>

      <form
        onSubmit={submit}
        className="relative space-y-5 rounded-xl border border-white/10 bg-gray-900/40 backdrop-blur-sm p-6 shadow-lg"
      >
        <div>
          <label className="block text-sm text-gray-400 mb-1">Title *</label>
          <input
            className="w-full bg-gray-800/70 border border-white/10 rounded-lg px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="18K Gold Bracelet"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Description</label>
          <textarea
            className="w-full bg-gray-800/70 border border-white/10 rounded-lg px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder="Details, weight, condition…"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Start Price *</label>
            <input
              type="number"
              min={0}
              className="w-full bg-gray-800/70 border border-white/10 rounded-lg px-3 py-2 text-gray-100 focus:ring-2 focus:ring-indigo-500"
              value={startPrice}
              onChange={(e) => setStartPrice(Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Reserve Price</label>
            <input
              type="number"
              min={0}
              className="w-full bg-gray-800/70 border border-white/10 rounded-lg px-3 py-2 text-gray-100 focus:ring-2 focus:ring-indigo-500"
              value={reservePrice as any}
              onChange={(e) => {
                const v = e.target.value;
                setReservePrice(v === "" ? "" : Number(v));
              }}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Starts At *</label>
            <input
              type="datetime-local"
              className="w-full bg-gray-800/70 border border-white/10 rounded-lg px-3 py-2 text-gray-100 focus:ring-2 focus:ring-indigo-500"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Ends At *</label>
            <input
              type="datetime-local"
              className="w-full bg-gray-800/70 border border-white/10 rounded-lg px-3 py-2 text-gray-100 focus:ring-2 focus:ring-indigo-500"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Photos (JPEG/PNG — multiple allowed)
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onPickFiles}
            className="block w-full text-sm text-gray-400"
          />
          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {files.map((f, i) => (
                <img
                  key={i}
                  src={f.preview!}
                  alt={f.name}
                  className="h-24 w-full object-cover rounded-lg border border-white/10 shadow-sm"
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            disabled={saving}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 font-medium disabled:opacity-50 transition"
          >
            {saving ? "Creating…" : "Create Auction"}
          </button>
          {err && <span className="text-sm text-red-400">{err}</span>}
          {msg && <span className="text-sm text-emerald-400">{msg}</span>}
        </div>
      </form>
    </main>
  );
}
