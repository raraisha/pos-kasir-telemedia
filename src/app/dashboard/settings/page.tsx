"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../../config/firebase";

export default function SettingsPage() {
  const [formData, setFormData] = useState({
    storeName: "Toko POS Kami",
    storeAddress: "Jl. Contoh Alamat No. 123, Jakarta",
    storePhone: "081234567890",
    taxRate: 11,
    defaultDiscount: 0,
    minStockAlert: 5,
    receiptFooter: "Terima kasih atas kunjungan Anda!",
  });

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Ambil data pengaturan dari Firestore
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "store_config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setFormData((prev) => ({ ...prev, ...docSnap.data() }));
        }
      } catch (error) {
        console.error("Gagal memuat pengaturan:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
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
        updatedAt: new Date(),
      }, { merge: true });

      await addDoc(collection(db, "activity_logs"), {
        user: "Admin",
        role: "admin",
        action: "Mengubah Pengaturan Toko",
        details: `Memperbarui profil toko, pajak (${formData.taxRate}%), dan diskon default (${formData.defaultDiscount})`,
        timestamp: serverTimestamp(),
      });

      setMessage("Pengaturan toko berhasil disimpan!");
    } catch (error) {
      console.error(error);
      setMessage("Gagal menyimpan pengaturan.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-zinc-500 font-medium">Memuat pengaturan...</div>;
  }

  return (
    <div className="space-y-6 font-sans max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Pengaturan & Konfigurasi Toko</h1>
        <p className="text-sm text-zinc-500 mt-1">Kelola identitas struk, pajak, diskon default, dan batas stok minimum.</p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6">
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* IDENTITAS TOKO */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider border-b pb-2">1. Identitas Toko (Struk)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Nama Toko</label>
                <input 
                  type="text" 
                  required
                  value={formData.storeName} 
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Nomor Telepon / WhatsApp</label>
                <input 
                  type="text" 
                  value={formData.storePhone} 
                  onChange={(e) => setFormData({ ...formData, storePhone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Alamat Toko</label>
              <textarea 
                rows={2}
                value={formData.storeAddress} 
                onChange={(e) => setFormData({ ...formData, storeAddress: e.target.value })}
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* PAJAK & DISKON */}
          <div className="space-y-4 pt-4 border-t border-zinc-100">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider border-b pb-2">2. Keuangan & Pajak</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Tarif PPN / Pajak (%)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" step="0.1" min="0" max="100" required
                    value={formData.taxRate} 
                    onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:outline-none focus:border-blue-500"
                  />
                  <span className="font-bold text-zinc-700">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Diskon Khusus Otomatis (Opsional)</label>
                <input 
                  type="number" min="0"
                  value={formData.defaultDiscount} 
                  onChange={(e) => setFormData({ ...formData, defaultDiscount: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:outline-none focus:border-blue-500"
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
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">Pesan Penutup Struk (Footer)</label>
                <input 
                  type="text" 
                  value={formData.receiptFooter} 
                  onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {message && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold rounded-xl">
              {message}
            </div>
          )}

          <div className="pt-4 border-t border-zinc-100">
            <button 
              type="submit" 
              disabled={isSaving}
              className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl shadow-sm transition-all"
            >
              {isSaving ? "Menyimpan..." : "Simpan Semua Pengaturan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}