"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../config/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists() && userDoc.data().role === "admin") {
            router.replace("/dashboard");
          } else {
            router.replace("/login");
          }
        } catch (error) {
          router.replace("/login");
        }
      } else {
        router.replace("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0f1117] text-[#8b949e]">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-[#30363d] border-t-[#58a6ff] rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-sm tracking-wide">Memuat aplikasi POS...</p>
      </div>
    </main>
  );
}