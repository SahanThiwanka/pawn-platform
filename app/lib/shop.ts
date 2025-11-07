import { db } from "../lib/firebase.client";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export async function ensureJoinCode(shopId: string) {
  const ref = doc(db, "shops", shopId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.joinCode) return data.joinCode;

  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
  await updateDoc(ref, { joinCode: code });
  return code;
}
