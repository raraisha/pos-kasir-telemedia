"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../../config/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Login dengan Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Ambil data tambahan user dari Firestore (untuk cek role)
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // 3. Pengecekan Role (Admin & Kasir)
        if (userData.role === "admin") {
          router.push("/dashboard"); 
        } else if (userData.role === "kasir") {
          router.push("/kasir"); 
        } else {
          setError("Akses ditolak. Akun ini tidak memiliki izin yang valid.");
          await auth.signOut();
        }
      } else {
        setError("Data user tidak ditemukan di database.");
        await auth.signOut();
      }
    } catch (err: any) {
      console.error(err);
      setError("Email atau password salah.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 font-sans selection:bg-zinc-200">
      
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-8 sm:p-10 shadow-sm">
        
        {/* Header Title (Tanpa Logo, Kontras Rendah) */}
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-medium tracking-tight text-zinc-700 mb-2">Login</h1>
          <p className="text-sm text-zinc-500">Masuk sebagai Admin atau Kasir</p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-6 p-4 text-sm bg-red-50 border border-red-100 text-red-500 rounded-xl">
            {error}
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-400 ml-1">
              Alamat Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@perusahaan.com"
              className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-zinc-300 transition-colors duration-200"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-400 ml-1">
              Kata Sandi
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-zinc-300 transition-colors duration-200"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-zinc-100 hover:bg-zinc-200 active:scale-[0.99] text-zinc-600 font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Memproses...
              </>
            ) : (
              "Masuk"
            )}
          </button>
        </form>

      </div>
    </main>
  );
}