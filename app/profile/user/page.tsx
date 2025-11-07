"use client";

import { auth, db, storage } from "../../lib/firebase.client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { isNonEmpty, isSriLankanNIC, isPhoneOk } from "../../lib/validators";

export default function UserProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [nicNumber, setNicNumber] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const [nicFile, setNicFile] = useState<File | null>(null);
  const [nicPreview, setNicPreview] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [localHint, setLocalHint] = useState<string | null>(null);

  // live validation states (for inline hints)
  const nicOk = useMemo(() => (nicNumber ? isSriLankanNIC(nicNumber) : true), [nicNumber]);
  const phoneOk = useMemo(() => (phone ? isPhoneOk(phone) : true), [phone]);

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

  // handle file selection + preview
  useEffect(() => {
    if (!nicFile) return;
    const url = URL.createObjectURL(nicFile);
    setNicPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [nicFile]);

  const onPickFile = (file: File | null) => {
    setLocalHint(null);
    if (!file) return setNicFile(null);

    // Basic checks (client-side)
    const maxMB = 5;
    if (file.size > maxMB * 1024 * 1024) {
      setLocalHint(`Image too large. Max ${maxMB}MB.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setLocalHint("Please upload an image file (PNG/JPG).");
      return;
    }
    setNicFile(file);
  };

  const save = async () => {
    setError(null);
    setLocalHint(null);

    // Required fields
    if (!isNonEmpty(displayName)) return setError("Please enter your full name.");
    if (!isSriLankanNIC(nicNumber))
      return setError("NIC looks invalid. Use 9 digits + V/X or 12 digits.");
    if (!isPhoneOk(phone)) return setError("Phone number looks invalid.");
    if (!isNonEmpty(address)) return setError("Please enter your address.");

    const u = auth.currentUser!;
    if (!u) return setError("Session expired. Please login again.");

    setSaving(true);

    try {
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
    } catch (e: any) {
      setError(e?.message ?? "Failed to save profile.");
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
              <span className="text-xl">💍</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold">Complete your profile</h1>
              <p className="text-sm text-gray-400">KYC for customers</p>
            </div>
          </header>

          <div className="space-y-4">
            <Field
              label="Full name"
              error={!isNonEmpty(displayName) && displayName ? "Enter your full name." : undefined}
            >
              <input
                className="w-full rounded-xl border border-white/10 bg-gray-800 px-3 py-2 text-gray-100 outline-none ring-indigo-400/30 placeholder:text-gray-400 focus:ring"
                placeholder="Full name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </Field>

            <Field
              label="NIC number"
              hint="e.g., 993456789V / 993456789X or 200012345678"
              error={!nicOk ? "Use 9 digits + V/X or 12 digits." : undefined}
            >
              <input
                className={`w-full rounded-xl border px-3 py-2 outline-none placeholder:text-gray-400 focus:ring ${
                  nicOk
                    ? "border-white/10 bg-gray-800 text-gray-100 ring-indigo-400/30"
                    : "border-red-500/40 bg-red-950/30 text-red-100 ring-red-400/40"
                }`}
                value={nicNumber}
                onChange={(e) => setNicNumber(e.target.value)}
                placeholder="NIC number"
              />
            </Field>

            <Field label="Phone" hint="Sri Lanka mobile (07x…); include leading 0">
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

            <Field label="Address">
              <textarea
                className="w-full rounded-xl border border-white/10 bg-gray-800 px-3 py-2 text-gray-100 outline-none ring-indigo-400/30 placeholder:text-gray-400 focus:ring"
                rows={3}
                placeholder="Street, city, postal code"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>

            {/* NIC image uploader */}
            <div className="space-y-2">
              <label className="text-sm text-gray-300">NIC Photo (image)</label>

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
                  Drag & drop an image here, or
                  <label className="ml-1 cursor-pointer underline">
                    browse
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </label>
                </div>
                {nicPreview ? (
                  <button
                    onClick={() => {
                      setNicFile(null);
                      setNicPreview(null);
                    }}
                    type="button"
                    className="rounded-full border border-white/10 bg-gray-900 px-3 py-1 text-xs text-gray-200 hover:bg-gray-700"
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              {(nicPreview || localHint) && (
                <div className="mt-2 grid grid-cols-[auto,1fr] items-start gap-3">
                  {nicPreview && (
                    <img
                      src={nicPreview}
                      alt="NIC preview"
                      className="max-h-40 rounded-xl border border-white/10"
                    />
                  )}
                  {localHint && (
                    <p className="text-sm text-amber-300/90">{localHint}</p>
                  )}
                </div>
              )}
            </div>

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

/** Small helper field wrapper with label/hint/error styles */
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
