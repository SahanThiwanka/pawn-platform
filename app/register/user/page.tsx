"use client";

import { auth, db, googleProvider } from "../../lib/firebase.client";
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { actionCodeSettings } from "../../lib/verification";

export default function RegisterUserPage() {
  const router = useRouter();
  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setRoleDoc = async (uid: string, email?: string) => {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { role: "user", email: email ?? null, profileCompleted: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    } else {
      await updateDoc(ref, { role: "user", email: email ?? snap.data().email ?? null, updatedAt: serverTimestamp() });
    }
  };

  const finish = () => router.replace("/profile/user");

  const registerEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setRoleDoc(cred.user.uid, email);
      await sendEmailVerification(cred.user, actionCodeSettings);
      router.replace("/verify");
    } catch (e:any) { setError(e.message); }
  };

  const registerGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await setRoleDoc(cred.user.uid, cred.user.email || undefined);
      // even for Google, enforce verification flow:
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        await sendEmailVerification(auth.currentUser, actionCodeSettings);
        return router.replace("/verify");
      }
      finish();
    } catch (e:any) { setError(e.message); }
  };

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Register as Customer</h1>

      <button onClick={registerGoogle} className="w-full rounded-lg border px-4 py-2">
        Continue with Google
      </button>

      <div className="text-center text-sm text-gray-500">or</div>

      <form onSubmit={registerEmail} className="space-y-3">
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Email"
               value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Password" type="password"
               value={password} onChange={(e)=>setPassword(e.target.value)} />
        <button className="w-full rounded-lg bg-black text-white px-4 py-2">Create Account</button>
      </form>

      {error && <p className="text-red-600 text-sm">{error}</p>}
    </main>
  );
}
