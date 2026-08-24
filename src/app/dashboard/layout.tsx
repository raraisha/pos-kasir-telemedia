"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../../config/firebase";
import { doc, getDoc } from "firebase/firestore";
// Pastikan path import Sidebar sudah sesuai
import Sidebar from "../_components/sidebar"; 

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
          setAdminName(userDoc.data().nama || "Admin");
          setLoading(false);
        } else {
          await signOut(auth);
          router.replace("/login");
        }
      } catch (error) {
        console.error(error);
        router.replace("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  // Layar Loading (Tema Terang)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-500 font-sans">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-medium tracking-wide">Memverifikasi akses admin...</p>
        </div>
      </div>
    );
  }

  return (
    // Background utama diubah ke zinc-50 (abu-abu sangat muda/hampir putih)
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex font-sans selection:bg-zinc-200">
      
      {/* Sidebar Component */}
      <Sidebar adminName={adminName} onLogout={handleLogout} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header Mobile (Tema Terang) - Hanya muncul di layar kecil */}
        <header className="h-16 bg-white border-b border-zinc-200 px-6 flex items-center justify-between shadow-sm z-10 md:hidden">
          <span className="text-sm font-extrabold text-zinc-900">POS Admin</span>
          <button
            onClick={handleLogout}
            className="py-1.5 px-4 bg-red-50 hover:bg-red-100 active:scale-95 border border-red-100 text-red-600 text-xs font-semibold rounded-lg transition-all"
          >
            Keluar
          </button>
        </header>
        
        {/* Main Canvas */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </main>

      </div>
    </div>
  );
}