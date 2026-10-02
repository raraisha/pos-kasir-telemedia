"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { db } from "../../../config/firebase"; // Sesuaikan path import firebase dengan struktur folder Anda

interface SPG {
  id: string;
  name: string;
}

export default function KelolaSpgPage() {
  const [spgList, setSpgList] = useState<SPG[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk Modal Tambah/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [spgName, setSpgName] = useState("");

  // State untuk Modal Konfirmasi Hapus
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Ambil Data SPG dari Firestore
  const fetchSpgList = async () => {
    setLoading(true);
    try {
      const spgQuery = query(collection(db, "spg"), orderBy("createdAt", "asc"));
      const querySnapshot = await getDocs(spgQuery);
      
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      })) as SPG[];
      
      setSpgList(data);
    } catch (error) {
      console.error("Gagal mengambil data SPG:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpgList();
  }, []);

  // Buka modal untuk Tambah Baru
  const handleOpenAdd = () => {
    setEditingId(null);
    setSpgName("");
    setIsModalOpen(true);
  };

  // Buka modal untuk Edit
  const handleOpenEdit = (spg: SPG) => {
    setEditingId(spg.id);
    setSpgName(spg.name);
    setIsModalOpen(true);
  };

  // Simpan Data (Tambah atau Edit)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spgName.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingId) {
        // Proses Update
        await updateDoc(doc(db, "spg", editingId), {
          name: spgName,
          updatedAt: serverTimestamp()
        });
      } else {
        // Proses Tambah Baru
        await addDoc(collection(db, "spg"), {
          name: spgName,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      fetchSpgList(); // Refresh data
    } catch (error) {
      console.error("Gagal menyimpan data:", error);
      alert("Gagal menyimpan data SPG.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Buka modal Konfirmasi Hapus
  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setIsDeleteModalOpen(true);
  };

  // Eksekusi Hapus Data
  const handleDelete = async () => {
    if (!deletingId) return;
    
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "spg", deletingId));
      setIsDeleteModalOpen(false);
      fetchSpgList(); // Refresh data
    } catch (error) {
      console.error("Gagal menghapus data:", error);
      alert("Gagal menghapus data SPG.");
    } finally {
      setIsSubmitting(false);
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 font-sans pb-10">
      
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">Kelola SPG / SPB</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Data ini akan langsung muncul sebagai pilihan di layar kasir.
          </p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Tambah Baru
        </button>
      </div>

      {/* Tampilan Grid Daftar SPG */}
      {loading ? (
        <div className="flex justify-center items-center h-40 text-zinc-500 font-medium bg-white rounded-2xl border border-zinc-200 shadow-sm">
          Memuat data...
        </div>
      ) : spgList.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-40 bg-white rounded-2xl border border-zinc-200 shadow-sm text-center px-4">
          <p className="text-zinc-500 font-medium mb-3">Belum ada data SPG / SPB yang tersimpan.</p>
          <p className="text-xs text-zinc-400">Kasir saat ini menggunakan data dummy (SPG/B 1 - 12).</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {spgList.map((spg) => (
            <div key={spg.id} className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between hover:border-blue-300 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                  {spg.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-bold text-zinc-800">{spg.name}</span>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => handleOpenEdit(spg)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button 
                  onClick={() => confirmDelete(spg.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  title="Hapus"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= MODAL TAMBAH / EDIT ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-zinc-100">
              <h3 className="text-lg font-bold text-zinc-900">
                {editingId ? "Edit SPG / SPB" : "Tambah SPG / SPB Baru"}
              </h3>
            </div>
            
            <form onSubmit={handleSave}>
              <div className="p-6">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  Nama SPG / SPB
                </label>
                <input
                  type="text"
                  value={spgName}
                  onChange={(e) => setSpgName(e.target.value)}
                  placeholder="Contoh: Rina, Budi..."
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 focus:outline-none focus:border-blue-500 font-medium"
                  autoFocus
                  required
                />
              </div>

              <div className="p-4 border-t border-zinc-100 flex gap-3 bg-zinc-50">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 py-3 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold rounded-xl transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting || !spgName.trim()}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-xl transition-all shadow-sm"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL KONFIRMASI HAPUS ================= */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-lg font-extrabold text-zinc-900 mb-2">Hapus Data SPG?</h3>
            <p className="text-sm text-zinc-500 mb-6">
              Data yang dihapus tidak akan muncul lagi di layar kasir, tetapi riwayat transaksi sebelumnya yang menggunakan nama ini akan tetap aman.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsDeleteModalOpen(false)} 
                className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl transition-all"
              >
                Batal
              </button>
              <button 
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold rounded-xl shadow-sm transition-all"
              >
                {isSubmitting ? "Proses..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}