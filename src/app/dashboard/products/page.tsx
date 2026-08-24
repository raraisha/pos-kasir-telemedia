"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "../../../config/firebase";

// --- INTERFACE ---
interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  color: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk Modal Form Tambah/Edit Produk
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // State Input Form Produk
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    stock: "",
    category: "Makanan",
    color: "bg-orange-100",
  });

  // --- STATE MODAL PENYESUAIAN STOK (RESTOCK / SAMPLING / WASTE) ---
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<"restock" | "sampling" | "waste">("restock");
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustNote, setAdjustNote] = useState<string>("");

  // --- MENGAMBIL DATA PRODUK ---
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "products"));
      const data = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Product[];
      setProducts(data);
    } catch (error) {
      console.error("Gagal memuat produk:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // --- HANDLER FORM UTAMA ---
  const handleOpenAdd = () => {
    setFormData({ name: "", price: "", stock: "", category: "Makanan", color: "bg-orange-100" });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setFormData({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock !== undefined ? product.stock.toString() : "0",
      category: product.category,
      color: product.color || "bg-zinc-100",
    });
    setEditingId(product.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Yakin ingin menghapus produk "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "products", id));
      await addDoc(collection(db, "activity_logs"), {
        user: "Admin", 
        role: "admin",
        action: "Menghapus Produk",
        details: `Menghapus produk: ${name}`,
        timestamp: serverTimestamp()
      });
      setProducts(products.filter(p => p.id !== id));
    } catch (error) {
      alert("Gagal menghapus produk.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const productData = {
      name: formData.name,
      price: Number(formData.price),
      stock: Number(formData.stock),
      category: formData.category,
      color: formData.color,
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "products", editingId), productData);
        await addDoc(collection(db, "activity_logs"), {
          user: "Admin", 
          role: "admin",
          action: "Mengubah Data Produk",
          details: `Edit produk: ${formData.name} (Stok: ${formData.stock})`,
          timestamp: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "products"), productData);
        await addDoc(collection(db, "activity_logs"), {
          user: "Admin", 
          role: "admin",
          action: "Menambah Produk Baru",
          details: `Produk baru: ${formData.name} (Stok: ${formData.stock})`,
          timestamp: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (error) {
      alert("Terjadi kesalahan saat menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- HANDLER PENYESUAIAN STOK (RESTOCK, SAMPLING, WASTE) ---
  const handleOpenStockModal = (product: Product) => {
    setSelectedProduct(product);
    setAdjustType("restock");
    setAdjustQty(1);
    setAdjustNote("");
    setIsStockModalOpen(true);
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (adjustQty <= 0) return alert("Jumlah harus lebih dari 0!");

    // Tentukan jumlah perubahan (Sampling & Waste mengurangi stok, Restock menambah stok)
    const quantityChange = adjustType === "restock" ? adjustQty : -adjustQty;

    // Validasi agar stok tidak minus jika dikurangi sampling/waste
    if (adjustType !== "restock" && selectedProduct.stock + quantityChange < 0) {
      return alert("Gagal! Stok tidak mencukupi untuk jumlah pengurangan tersebut.");
    }

    try {
      const productRef = doc(db, "products", selectedProduct.id);
      await updateDoc(productRef, {
        stock: increment(quantityChange)
      });

      // Catat ke Log Aktivitas
      const actionName = 
        adjustType === "restock" ? "Tambah Stok (Restock)" :
        adjustType === "sampling" ? "Penggunaan Sampling" : "Pencatatan Waste (Barang Rusak/Basi)";

      await addDoc(collection(db, "activity_logs"), {
        user: "Admin",
        role: "admin",
        action: actionName,
        details: `Produk: ${selectedProduct.name} | Jumlah: ${adjustQty} | Catatan: ${adjustNote || '-'}`,
        timestamp: serverTimestamp()
      });

      setIsStockModalOpen(false);
      fetchProducts();
      alert("Stok berhasil disesuaikan!");
    } catch (error) {
      console.error(error);
      alert("Gagal menyesuaikan stok.");
    }
  };

  const formatRupiah = (number: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Kelola Produk & Stok</h1>
          <p className="text-sm text-zinc-500 mt-1">Atur menu, harga, restock, sampling, dan pencatatan waste.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2 justify-center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Tambah Produk
        </button>
      </div>

      {/* --- TABEL PRODUK --- */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Info Produk</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Kategori</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">Stok</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Harga</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-zinc-500">Memuat data produk...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-zinc-500">Belum ada produk.</td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-zinc-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg shrink-0 border border-zinc-200/50 shadow-inner ${product.color}`}></div>
                        <p className="text-sm font-semibold text-zinc-900">{product.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 text-zinc-600">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                        (product.stock || 0) <= 5 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {product.stock || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-zinc-800">
                      {formatRupiah(product.price)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {/* Tombol Atur Stok (Restock/Sampling/Waste) */}
                        <button
                          onClick={() => handleOpenStockModal(product)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors"
                          title="Sesuaikan Stok"
                        >
                          Atur Stok
                        </button>
                        <button
                          onClick={() => handleOpenEdit(product)}
                          className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button
                          onClick={() => handleDelete(product.id, product.name)}
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
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

      {/* --- MODAL TAMBAH / EDIT PRODUK --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-zinc-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-zinc-900">{editingId ? "Edit Produk" : "Tambah Produk Baru"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-700">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Nama Produk</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Harga (Rp)</label>
                  <input type="number" required min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Stok Awal</label>
                  <input type="number" required min="0" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Kategori</label>
                  <input type="text" required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Warna Label</label>
                  <select value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                    <option value="bg-zinc-100">Abu-abu</option>
                    <option value="bg-orange-100">Oranye</option>
                    <option value="bg-blue-100">Biru</option>
                    <option value="bg-yellow-100">Kuning</option>
                    <option value="bg-purple-100">Ungu</option>
                    <option value="bg-green-100">Hijau</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-zinc-100 text-zinc-700 font-semibold rounded-xl">Batal</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-zinc-900 text-white font-semibold rounded-xl">{isSubmitting ? "Menyimpan..." : "Simpan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL PENYESUAIAN STOK (RESTOCK / SAMPLING / WASTE) --- */}
      {isStockModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-zinc-900">Atur Stok Produk</h3>
                <p className="text-xs text-zinc-500">{selectedProduct.name} (Sisa: {selectedProduct.stock})</p>
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
                  <option value="restock">➕ Tambah Stok (Restock)</option>
                  <option value="sampling">🧪 Penggunaan Sampling (Kurangi)</option>
                  <option value="waste">🗑️ Pencatatan Waste / Basi (Kurangi)</option>
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
                  placeholder="Misal: Barang tumpah / tester pembeli"
                  value={adjustNote} 
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsStockModalOpen(false)} className="flex-1 py-3 bg-zinc-100 text-zinc-700 font-semibold rounded-xl">Batal</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}