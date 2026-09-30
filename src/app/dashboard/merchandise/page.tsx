"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, increment } from "firebase/firestore";
// Sesuaikan path import db dengan lokasimu
import { db } from "../../../config/firebase";

// --- INTERFACE ---
interface Merchandise {
  id: string;
  name: string;
  stock: number;
  description: string;
}

export default function MerchandisePage() {
  const [merchandises, setMerchandises] = useState<Merchandise[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk Modal Form Tambah/Edit Merch
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // State Input Form Merch
  const [formData, setFormData] = useState({
    name: "",
    stock: "",
    description: "",
  });

  // --- STATE MODAL PENYESUAIAN STOK ---
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedMerch, setSelectedMerch] = useState<Merchandise | null>(null);
  const [adjustType, setAdjustType] = useState<"restock" | "waste">("restock");
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustNote, setAdjustNote] = useState<string>("");

  // --- MENGAMBIL DATA MERCHANDISE ---
  const fetchMerchandises = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "merchandises"));
      const data = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Merchandise[];
      setMerchandises(data);
    } catch (error) {
      console.error("Gagal memuat merchandise:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchandises();
  }, []);

  // --- HANDLER FORM UTAMA ---
  const handleOpenAdd = () => {
    setFormData({ name: "", stock: "", description: "" });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (merch: Merchandise) => {
    setFormData({
      name: merch.name,
      stock: merch.stock !== undefined ? merch.stock.toString() : "0",
      description: merch.description || "",
    });
    setEditingId(merch.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Yakin ingin menghapus merchandise "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "merchandises", id));
      await addDoc(collection(db, "activity_logs"), {
        user: "Admin", 
        role: "admin",
        action: "Menghapus Merchandise",
        details: `Menghapus item merch: ${name}`,
        timestamp: serverTimestamp()
      });
      setMerchandises(merchandises.filter(m => m.id !== id));
    } catch (error) {
      alert("Gagal menghapus merchandise.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const merchData = {
      name: formData.name,
      stock: Number(formData.stock),
      description: formData.description,
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "merchandises", editingId), merchData);
        await addDoc(collection(db, "activity_logs"), {
          user: "Admin", role: "admin", action: "Mengubah Data Merchandise",
          details: `Edit merch: ${formData.name}`, timestamp: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "merchandises"), merchData);
        await addDoc(collection(db, "activity_logs"), {
          user: "Admin", role: "admin", action: "Menambah Merchandise Baru",
          details: `Item baru: ${formData.name}`, timestamp: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      fetchMerchandises();
    } catch (error) {
      alert("Terjadi kesalahan saat menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- HANDLER PENYESUAIAN STOK ---
  const handleOpenStockModal = (merch: Merchandise) => {
    setSelectedMerch(merch);
    setAdjustType("restock");
    setAdjustQty(1);
    setAdjustNote("");
    setIsStockModalOpen(true);
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerch) return;
    if (adjustQty <= 0) return alert("Jumlah harus lebih dari 0!");

    const quantityChange = adjustType === "restock" ? adjustQty : -adjustQty;

    if (adjustType !== "restock" && selectedMerch.stock + quantityChange < 0) {
      return alert("Stok tidak mencukupi untuk jumlah pengurangan tersebut.");
    }

    try {
      await updateDoc(doc(db, "merchandises", selectedMerch.id), {
        stock: increment(quantityChange)
      });

      const actionName = adjustType === "restock" ? "Tambah Stok Merch" : "Pengurangan Stok Merch";

      await addDoc(collection(db, "activity_logs"), {
        user: "Admin", role: "admin", action: actionName,
        details: `${selectedMerch.name} | Qty: ${adjustQty} | Catatan: ${adjustNote || '-'}`,
        timestamp: serverTimestamp()
      });

      setIsStockModalOpen(false);
      fetchMerchandises();
      alert("Stok merchandise berhasil disesuaikan!");
    } catch (error) {
      console.error(error);
      alert("Gagal menyesuaikan stok.");
    }
  };

  return (
    <div className="space-y-6 font-sans pb-10">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Kelola Merchandise</h1>
          <p className="text-sm text-zinc-500 mt-1">Pantau stok item hadiah / merchandise untuk produk paket.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2 justify-center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Tambah Item
        </button>
      </div>

      {/* --- TABEL MERCHANDISE --- */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nama Item</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">Sisa Stok</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Keterangan</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-sm text-zinc-500">Memuat data merchandise...</td>
                </tr>
              ) : merchandises.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-sm text-zinc-500">Belum ada item merchandise.</td>
                </tr>
              ) : (
                merchandises.map((merch) => (
                  <tr key={merch.id} className="hover:bg-zinc-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg shrink-0 border border-purple-200 bg-purple-50 flex items-center justify-center text-purple-600 font-bold">
                          🎁
                        </div>
                        <p className="text-sm font-semibold text-zinc-900">{merch.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-bold ${
                        (merch.stock || 0) <= 5 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {merch.stock || 0} Pcs
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500">
                      {merch.description || "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenStockModal(merch)}
                          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg transition-colors"
                          title="Sesuaikan Stok"
                        >
                          Atur Stok
                        </button>
                        <button
                          onClick={() => handleOpenEdit(merch)}
                          className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button
                          onClick={() => handleDelete(merch.id, merch.name)}
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL TAMBAH / EDIT MERCHANDISE --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-zinc-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-zinc-900">{editingId ? "Edit Item" : "Tambah Item Baru"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-700">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Nama Item (Misal: Lunch Box)</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Stok Awal</label>
                <input type="number" required min="0" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Keterangan / Deskripsi (Opsional)</label>
                <textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl resize-none" placeholder="Misal: Hadiah khusus pembelian paket besar" />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-zinc-100 text-zinc-700 font-semibold rounded-xl">Batal</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-zinc-900 text-white font-semibold rounded-xl">{isSubmitting ? "Menyimpan..." : "Simpan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL PENYESUAIAN STOK --- */}
      {isStockModalOpen && selectedMerch && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-zinc-900">Atur Stok Merchandise</h3>
                <p className="text-xs text-zinc-500">{selectedMerch.name} (Sisa: {selectedMerch.stock})</p>
              </div>
              <button onClick={() => setIsStockModalOpen(false)} className="text-zinc-400 hover:text-zinc-700">✕</button>
            </div>

            <form onSubmit={handleStockAdjustment} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Jenis Penyesuaian</label>
                <select 
                  value={adjustType} 
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold"
                >
                  <option value="restock">➕ Tambah Stok (Barang Masuk)</option>
                  <option value="waste">➖ Kurangi Stok (Rusak / Hilang)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Jumlah (Qty)</label>
                <input 
                  type="number" 
                  min="1" 
                  required 
                  value={adjustQty} 
                  onChange={(e) => setAdjustQty(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Catatan / Keterangan (Opsional)</label>
                <input 
                  type="text" 
                  placeholder="Misal: Barang sobek / cacat pabrik"
                  value={adjustNote} 
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsStockModalOpen(false)} className="flex-1 py-3 bg-zinc-100 text-zinc-700 font-semibold rounded-xl">Batal</button>
                <button type="submit" className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-md">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}