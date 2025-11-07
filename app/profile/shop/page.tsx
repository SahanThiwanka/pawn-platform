"use client";

import { auth, db, storage } from "../../lib/firebase.client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { isNonEmpty, isPhoneOk } from "../../lib/validators";
import { ensureJoinCode } from "../../lib/shop";

export default function ShopProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [localHint, setLocalHint] = useState<string | null>(null);

  const phoneOk = useMemo(() => (phone ? isPhoneOk(phone) : true), [phone]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return router.replace("/login");
      await u.reload();
      if (!u.emailVerified) return router.replace("/verify");

      const userSnap = await getDoc(doc(db, "users", u.uid));
      const data = userSnap.data() || {};
      if (data.role !== "shop_admin" && data.role !== null) {
        return router.replace("/dashboard");
      }

      if (data.shopId) {
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

  // live preview for newly selected logo
  useEffect(() => {
    if (!logoFile) return;
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const onPickFile = (file: File | null) => {
    setLocalHint(null);
    if (!file) return setLogoFile(null);
    const maxMB = 5;
    if (file.size > maxMB * 1024 * 1024) {
      setLocalHint(`Logo too large. Max ${maxMB}MB.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setLocalHint("Please upload an image file (PNG/JPG/SVG).");
      return;
    }
    setLogoFile(file);
  };

  const save = async () => {
    setError(null);
    setLocalHint(null);

    if (!isNonEmpty(shopName)) return setError("Please enter a shop name.");
    if (!phoneOk) return setError("Shop phone looks invalid.");
    if (!isNonEmpty(address)) return setError("Please enter a shop address.");

    const u = auth.currentUser!;
    if (!u) return setError("Session expired. Please login again.");

    setSaving(true);

    try {
      const userRef = doc(db, "users", u.uid);
      const userSnap = await getDoc(userRef);
      const user = userSnap.data() || {};

      let shopId = user.shopId as string | undefined;
      let logoPath: string | null = logoPreview ?? null;

      // create shop if not present
      if (!shopId) {
        const refDoc = await addDoc(collection(db, "shops"), {
          ownerUid: u.uid,
          shopName,
          address,
          phone,
          logoPath: null,
          profileCompleted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        shopId = refDoc.id;
        await updateDoc(userRef, {
          role: "shop_admin",
          shopId,
          updatedAt: serverTimestamp(),
        });
      }

      // upload new logo if chosen
      if (logoFile) {
        const path = `shops/${shopId}/branding/${Date.now()}_${logoFile.name}`;
        const sref = ref(storage, path);
        await uploadBytes(sref, logoFile);
        logoPath = await getDownloadURL(sref);
      }

      // update shop document
      await updateDoc(doc(db, "shops", shopId!), {
        shopName,
        address,
        phone,
        logoPath,
        profileCompleted: true,
        updatedAt: serverTimestamp(),
      });

      // ensure join code
      const code = await ensureJoinCode(shopId!);
      setJoinCode(code);

      router.replace("/dashboard");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save shop profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-[100svh]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25" />
        <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-white/10 blur-3xl" />

        <main className="relative z-10 mx-auto grid min-h-[100svh] w-full place-items-center px-4">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-gray-900/70 p-8 backdrop-blur-md">
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-1/2 rounded bg-white/10" />
              <div className="h-10 w-full rounded bg-white/10" />
              <div className="h-10 w-full rounded bg-white/10" />
              <div className="h-24 w-full rounded bg-white/10" />
              <div className="h-10 w-1/3 rounded bg-white/10" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100svh]">
      {/* Brand gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 opacity-25" />
      <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-white/10 blur-3xl" />

      <main className="relative z-10 mx-auto flex min-h-[100svh] w-full items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-gray-900/70 p-6 text-gray-100 shadow-2xl backdrop-blur-md md:p-8">
          <header className="mb-6 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gray-800 ring-1 ring-white/10">
              <span className="text-xl">🏪</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold">Set up your shop</h1>
              <p className="text-sm text-gray-400">KYC for pawn shops</p>
            </div>
          </header>

          <div className="space-y-4">
            <Field
              label="Shop name"
              error={!isNonEmpty(shopName) && shopName ? "Enter a shop name." : undefined}
            >
              <input
                className="w-full rounded-xl border border-white/10 bg-gray-800 px-3 py-2 text-gray-100 outline-none ring-indigo-400/30 placeholder:text-gray-400 focus:ring"
                placeholder="Ex: Royal Gems & Pawning"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
              />
            </Field>

            <Field label="Shop phone" hint="Sri Lanka mobile (07x…); include leading 0" error={!phoneOk && phone ? "Phone looks invalid." : undefined}>
              <input
                className={`w-full rounded-xl border px-3 py-2 outline-none placeholder:text-gray-400 focus:ring ${
                  phoneOk
                    ? "border-white/10 bg-gray-800 text-gray-100 ring-indigo-400/30"
                    : "border-red-500/40 bg-red-950/30 text-red-100 ring-red-400/40"
                }`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07x xxx xxxx"
                inputMode="tel"
              />
            </Field>

            <Field label="Shop address">
              <textarea
                className="w-full rounded-xl border border-white/10 bg-gray-800 px-3 py-2 text-gray-100 outline-none ring-indigo-400/30 placeholder:text-gray-400 focus:ring"
                rows={3}
                placeholder="Street, city, postal code"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>

            {/* Logo uploader */}
            <div className="space-y-2">
              <label className="text-sm text-gray-300">Logo (optional)</label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0] ?? null;
                  onPickFile(file);
                }}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-white/15 bg-gray-800/70 p-4 hover:bg-gray-800"
              >
                <div className="text-sm text-gray-300">
                  Drag & drop an image here, or{" "}
                  <label className="cursor-pointer underline">
                    browse
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </label>
                </div>
                {logoPreview ? (
                  <button
                    onClick={() => {
                      setLogoFile(null);
                      setLogoPreview(null);
                    }}
                    type="button"
                    className="rounded-full border border-white/10 bg-gray-900 px-3 py-1 text-xs text-gray-200 hover:bg-gray-700"
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              {(logoPreview || localHint) && (
                <div className="mt-2 grid grid-cols-[auto,1fr] items-start gap-3">
                  {logoPreview && (
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="max-h-40 rounded-xl border border-white/10 bg-white/5 p-2"
                    />
                  )}
                  {localHint && (
                    <p className="text-sm text-amber-300/90">{localHint}</p>
                  )}
                </div>
              )}
            </div>

            {/* Join code (if already exists) */}
            {joinCode && (
              <div className="rounded-2xl border border-white/10 bg-gray-800/60 p-4">
                <p className="text-xs text-gray-400">Customer Join Code</p>
                <p className="mt-1 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 font-mono text-lg tracking-wider text-gray-100 ring-1 ring-white/10">
                  {joinCode}
                </p>
              </div>
            )}

            <button
              onClick={save}
              disabled={saving}
              className="mt-2 w-full rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-600/20 transition hover:translate-y-[-1px] hover:shadow-xl disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save & Continue"}
            </button>

            {error && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/** Helper field component with label/hint/error */
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-gray-300">{label}</span>
      {children}
      <div className="mt-1 min-h-[1.25rem] text-xs">
        {error ? (
          <span className="text-red-300">{error}</span>
        ) : hint ? (
          <span className="text-gray-400">{hint}</span>
        ) : null}
      </div>
    </label>
  );
}
