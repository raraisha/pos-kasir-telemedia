"use client";

import { useState, useEffect } from "react";
import { doc, setDoc, addDoc, collection, serverTimestamp, onSnapshot } from "firebase/firestore";
// Sesuaikan path import db ini dengan lokasi file config firebase kamu
import { db } from "../../../config/firebase";

export default function SettingsPage() {
  const [formData, setFormData] = useState({
    storeName: "",
    appName: "",
    storeAddress: "",
    storePhone: "",
    taxRate: 0,
    defaultDiscount: 0,
    minStockAlert: 0,
    receiptFooter: "",
  });

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Ambil data pengaturan dari Firestore (Real-time)
  useEffect(() => {
    const docRef = doc(db, "settings", "store_config");
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData({
          storeName: data.storeName || "",
          appName: data.appName || "POS Dashboard", // Default jika kosong
          storeAddress: data.storeAddress || "",
          storePhone: data.storePhone || "",
          taxRate: data.taxRate || 0,
          defaultDiscount: data.defaultDiscount || 0,
          minStockAlert: data.minStockAlert || 0,
          receiptFooter: data.receiptFooter || "",
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Gagal memuat pengaturan:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage("");

    try {
      await setDoc(doc(db, "settings", "store_config"), {
        ...formData,
        taxRate: Number(formData.taxRate),
        defaultDiscount: Number(formData.defaultDiscount),
        minStockAlert: Number(formData.minStockAlert),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await addDoc(collection(db, "activity_logs"), {
        user: "Admin",
        role: "admin",
        action: "Mengubah Pengaturan Toko",
        details: `Memperbarui profil toko, pajak (${formData.taxRate}%), dan diskon default (${formData.defaultDiscount})`,
        timestamp: serverTimestamp(),
      });

      setMessage("Pengaturan toko berhasil disimpan!");
      
      setTimeout(() => {
        setMessage("");
      }, 3000);
      
    } catch (error) {
      console.error(error);
      setMessage("Gagal menyimpan pengaturan.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center space-x-2 text-zinc-500 font-medium">
        <svg className="animate-spin h-5 w-5 text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Memuat pengaturan...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Pengaturan & Konfigurasi Toko</h1>
        <p className="text-sm text-zinc-500 mt-1">Kelola identitas, pajak, diskon default, dan batas stok minimum.</p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6">
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* IDENTITAS BRAND & APLIKASI */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider border-b pb-2">1. Identitas Brand & Aplikasi</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">
                  Nama Brand
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.storeName} 
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-900 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Misal: TELEMEDIA.ID"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">
                  Nama Aplikasi / Subtitle
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.appName} 
                  onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-900 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Misal: POS Dashboard"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Nomor Telepon / WhatsApp</label>
                <input 
                  type="text" 
                  value={formData.storePhone} 
                  onChange={(e) => setFormData({ ...formData, storePhone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-900 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Misal: +622129327540"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Alamat Website</label>
                <input 
                  type="text" 
                  value={formData.storeAddress} 
                  onChange={(e) => setFormData({ ...formData, storeAddress: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-900 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Misal: www.asastatelemedia.com"
                />
              </div>
            </div>
          </div>

          {/* PAJAK & DISKON */}
          <div className="space-y-4 pt-4 border-t border-zinc-100">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider border-b pb-2">2. Keuangan & Pajak</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Tarif PPN / Pajak (%)</label>
                <div className="relative">
                  <input 
                    type="number" step="0.1" min="0" max="100" required
                    value={formData.taxRate} 
                    onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 pr-8 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Diskon Khusus Otomatis</label>
                <input 
                  type="number" min="0"
                  value={formData.defaultDiscount} 
                  onChange={(e) => setFormData({ ...formData, defaultDiscount: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Nilai potong default (Rp)"
                />
              </div>
            </div>
          </div>

          {/* INVENTARIS & STRUK */}
          <div className="space-y-4 pt-4 border-t border-zinc-100">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider border-b pb-2">3. Sistem & Struk</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Batas Minimum Peringatan Stok</label>
                <input 
                  type="number" min="0" required
                  value={formData.minStockAlert} 
                  onChange={(e) => setFormData({ ...formData, minStockAlert: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Pesan Penutup Struk (Footer)</label>
                <input 
                  type="text" 
                  value={formData.receiptFooter} 
                  onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-900 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Misal: Terima kasih atas kunjungan Anda"
                />
              </div>
            </div>
          </div>

          {/* FEEDBACK MESSAGE */}
          {message && (
            <div className="p-4 bg-emerald-50/80 backdrop-blur-sm border border-emerald-200 text-emerald-700 text-sm font-medium rounded-xl flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              {message}
            </div>
          )}

          <div className="pt-4 border-t border-zinc-100">
            <button 
              type="submit" 
              disabled={isSaving}
              className={`w-full sm:w-auto px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 ${
                isSaving ? "opacity-75 cursor-not-allowed" : "active:scale-[0.98]"
              }`}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Menyimpan...
                </>
              ) : (
                "Simpan Semua Pengaturan"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}