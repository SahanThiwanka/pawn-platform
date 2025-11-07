"use client";

import { auth, googleProvider, db } from "../lib/firebase.client";
import { signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ensureUserDoc = async (uid: string) => {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        role: null,
        profileCompleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return (await getDoc(ref)).data()!;
  };

  const routeByState = (data: any) => {
    if (!data.role) return router.replace("/register"); // choose role
    if (!data.profileCompleted) {
      return router.replace(data.role === "shop_admin" ? "/profile/shop" : "/profile/user");
    }
    return router.replace("/dashboard");
  };

  const loginGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const data = await ensureUserDoc(cred.user.uid);
      routeByState(data);
    } catch (e:any) { setError(e.message); }
  };

  const loginEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const data = await ensureUserDoc(cred.user.uid);
      routeByState(data);
    } catch (e:any) { setError(e.message); }
  };

  return (
    <main className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Login</h1>

      <button onClick={loginGoogle} className="w-full rounded-lg border px-4 py-2">
        Continue with Google
      </button>

      <div className="text-center text-sm text-gray-500">or</div>

      <form onSubmit={loginEmail} className="space-y-3">
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Email"
               value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Password" type="password"
               value={password} onChange={(e)=>setPassword(e.target.value)} />
        <button className="w-full rounded-lg bg-black text-white px-4 py-2">Login</button>
      </form>

      {error && <p className="text-red-600 text-sm">{error}</p>}
    </main>
  );
}
