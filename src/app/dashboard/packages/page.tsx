"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../config/firebase";

// --- INTERFACES ---
interface AvailableProduct { id: string; name: string; }
interface AvailableMerch { id: string; name: string; stock: number; }
interface PackageMerch { id: string; name: string; qty: number; }

// Struktur baru untuk Varian (Menyimpan aturan fix / kelipatan)
interface PackageVariantRule { 
  id: string; 
  name: string; 
  ruleType: "fix" | "multiple"; 
  qtyValue: number; 
}

interface Package {
  id: string;
  name: string;
  price: number;
  totalQtyRequired: number;
  allowedVariants: PackageVariantRule[];
  merchandises: PackageMerch[];
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([]);
  const [availableMerchandises, setAvailableMerchandises] = useState<AvailableMerch[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    totalQtyRequired: "",
    allowedVariants: [] as PackageVariantRule[],
    merchandises: [] as PackageMerch[],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const pkgSnap = await getDocs(collection(db, "packages"));
      setPackages(pkgSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Package[]);

      const prodSnap = await getDocs(collection(db, "products"));
      setAvailableProducts(prodSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));

      const merchSnap = await getDocs(collection(db, "merchandises"));
      setAvailableMerchandises(merchSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name, stock: doc.data().stock })));
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenAdd = () => {
    setFormData({ name: "", price: "", totalQtyRequired: "", allowedVariants: [], merchandises: [] });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pkg: Package) => {
    setFormData({
      name: pkg.name,
      price: pkg.price.toString(),
      totalQtyRequired: pkg.totalQtyRequired.toString(),
      allowedVariants: pkg.allowedVariants || [],
      merchandises: pkg.merchandises || []
    });
    setEditingId(pkg.id);
    setIsModalOpen(true);
  };

  // --- LOGIC ATURAN VARIAN ---
  const toggleVariant = (prod: AvailableProduct) => {
    setFormData(prev => {
      const exists = prev.allowedVariants.find(v => v.id === prod.id);
      if (exists) {
        return { ...prev, allowedVariants: prev.allowedVariants.filter(v => v.id !== prod.id) };
      }
      return { 
        ...prev, 
        allowedVariants: [...prev.allowedVariants, { id: prod.id, name: prod.name, ruleType: "multiple", qtyValue: 1 }] 
      };
    });
  };

  const updateVariantRule = (id: string, field: "ruleType" | "qtyValue", value: any) => {
    setFormData(prev => ({
      ...prev,
      allowedVariants: prev.allowedVariants.map(v => v.id === id ? { ...v, [field]: value } : v)
    }));
  };

  // --- LOGIC MERCHANDISE ---
  const addMerch = () => {
    setFormData(prev => ({ ...prev, merchandises: [...prev.merchandises, { id: "", name: "", qty: 1 }] }));
  };

  const removeMerch = (index: number) => {
    setFormData(prev => ({ ...prev, merchandises: prev.merchandises.filter((_, i) => i !== index) }));
  };

  const updateMerch = (index: number, field: "id" | "qty", value: any) => {
    const updated = [...formData.merchandises];
    if (field === "id") {
      const selected = availableMerchandises.find(am => am.id === value);
      updated[index] = { ...updated[index], id: value, name: selected?.name || "" };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setFormData(prev => ({ ...prev, merchandises: updated }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.allowedVariants.length === 0) return alert("Pilih minimal 1 varian produk!");
    
    setIsSubmitting(true);
    const data = {
      name: formData.name,
      price: Number(formData.price),
      totalQtyRequired: Number(formData.totalQtyRequired),
      allowedVariants: formData.allowedVariants,
      merchandises: formData.merchandises,
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "packages", editingId), data);
      } else {
        await addDoc(collection(db, "packages"), data);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      alert("Gagal menyimpan paket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Yakin ingin menghapus paket "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "packages", id));
      setPackages(packages.filter(p => p.id !== id));
    } catch (error) {
      alert("Gagal menghapus.");
    }
  };

  const formatRupiah = (number: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(number);
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Kelola Paket (Bundling)</h1>
          <p className="text-sm text-zinc-500 mt-1">Buat aturan harga paket, kuota isi, dan merchandise.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2 justify-center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Tambah Paket
        </button>
      </div>

      {/* --- TABEL --- */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Info Paket</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">Wajib Isi</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Harga</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-sm text-zinc-500">Memuat data paket...</td></tr>
              ) : packages.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-sm text-zinc-500">Belum ada paket bundling.</td></tr>
              ) : (
                packages.map(pkg => (
                  <tr key={pkg.id} className="hover:bg-zinc-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg shrink-0 border border-zinc-200/50 shadow-inner bg-zinc-100 flex items-center justify-center text-xl">
                          📦
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">{pkg.name}</p>
                          <div className="text-[10px] text-zinc-500 mt-1 font-medium space-x-1">
                            {pkg.allowedVariants.map((v, i) => (
                              <span key={i} className="inline-block bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                                {v.name} ({v.ruleType === 'fix' ? `Fix ${v.qtyValue}` : `Kelipatan ${v.qtyValue}`})
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700">
                        {pkg.totalQtyRequired} Pcs
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-zinc-800">
                      {formatRupiah(pkg.price)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleOpenEdit(pkg)} className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(pkg.id, pkg.name)} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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

      {/* --- MODAL FORM PAKET (Scrollable Fixed) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-xl overflow-hidden">
            
            <div className="px-6 py-5 border-b border-zinc-100 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-zinc-900">{editingId ? "Edit Paket" : "Tambah Paket Baru"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-700">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Nama Paket</label>
                <input type="text" required placeholder="Misal: OATSIDE STRAW 48" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Harga Paket (Rp)</label>
                  <input type="number" required min="0" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Total Wajib Isi (Pcs)</label>
                  <input type="number" min="1" required placeholder="Misal: 48" value={formData.totalQtyRequired} onChange={(e) => setFormData({...formData, totalQtyRequired: e.target.value})} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm" />
                </div>
              </div>

              {/* VARIAN DENGAN ATURAN (FIX / KELIPATAN) */}
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-3">Varian & Aturan Pilihan Kasir</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableProducts.map(prod => {
                    const checkedVar = formData.allowedVariants.find(v => v.id === prod.id);
                    const isChecked = !!checkedVar;
                    return (
                      <div key={prod.id} className="flex flex-col p-3 bg-white border border-zinc-200 rounded-xl shadow-sm">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={isChecked} onChange={() => toggleVariant(prod)} className="w-4 h-4 rounded" />
                          <span className="text-sm font-semibold text-zinc-900">{prod.name}</span>
                        </label>
                        
                        {isChecked && checkedVar && (
                          <div className="mt-3 pt-3 border-t border-zinc-100 flex gap-2">
                            <div className="flex-1">
                              <label className="block text-[10px] font-semibold uppercase text-zinc-500 mb-1">Tipe Aturan</label>
                              <select
                                value={checkedVar.ruleType}
                                onChange={(e) => updateVariantRule(prod.id, "ruleType", e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50"
                              >
                                <option value="multiple">Kelipatan</option>
                                <option value="fix">Fix (Pasti)</option>
                              </select>
                            </div>
                            <div className="w-20">
                              <label className="block text-[10px] font-semibold uppercase text-zinc-500 mb-1">Jumlah</label>
                              <input
                                type="number" min="1" required
                                value={checkedVar.qtyValue}
                                onChange={(e) => updateVariantRule(prod.id, "qtyValue", Number(e.target.value))}
                                className="w-full px-2 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50 text-center"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* MERCHANDISE */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Merchandise / Hadiah</h3>
                  <button type="button" onClick={addMerch} className="text-[11px] font-bold text-blue-600">+ Tambah Merch</button>
                </div>
                <div className="space-y-3">
                  {formData.merchandises.map((m, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <select required value={m.id} onChange={(e) => updateMerch(i, "id", e.target.value)} className="flex-1 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm">
                        <option value="" disabled>Pilih Merchandise...</option>
                        {availableMerchandises.map(am => <option key={am.id} value={am.id}>{am.name} (Sisa: {am.stock})</option>)}
                      </select>
                      <input type="number" min="1" required value={m.qty} onChange={(e) => updateMerch(i, "qty", Number(e.target.value))} className="w-20 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-center" />
                      <button type="button" onClick={() => removeMerch(i)} className="p-2 text-zinc-400 hover:text-red-500">✕</button>
                    </div>
                  ))}
                  {formData.merchandises.length === 0 && (
                    <p className="text-xs text-center text-zinc-500 py-3">Tidak ada hadiah.</p>
                  )}
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-zinc-100 flex gap-3 shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-zinc-100 text-zinc-700 font-semibold rounded-xl">Batal</button>
              <button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="flex-1 py-3 bg-zinc-900 text-white font-semibold rounded-xl">
                {isSubmitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}