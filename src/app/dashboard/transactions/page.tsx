"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "../../../config/firebase";

// --- INTERFACES ---
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Transaction {
  id: string;
  transactionId?: string;
  total: number;
  subTotal: number;
  tax: number;
  paymentMethod: string;
  cashReceived: number;
  change: number;
  kasir: string;
  status?: string;
  timestamp: any;
  items: CartItem[];
  voidedAt?: any;
}

export default function TransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // State Filter Waktu
  const [timeRange, setTimeRange] = useState("hari-ini");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // State untuk Detail Modal
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Format Rupiah
  const formatRupiah = (number: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  // Format Tanggal (Lengkap)
  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        let start: Date | null = null;
        let end: Date | null = new Date(); // Default end batasnya adalah waktu saat ini
        const now = new Date();
        
        if (timeRange === "hari-ini") {
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (timeRange === "minggu-ini") {
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        } else if (timeRange === "bulan-ini") {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (timeRange === "kustom" && startDate && endDate) {
          start = new Date(startDate);
          start.setHours(0, 0, 0, 0); // Mulai dari jam 00:00:00
          
          end = new Date(endDate);
          end.setHours(23, 59, 59, 999); // Sampai ujung hari (23:59:59)
        } else if (timeRange === "semua") {
          start = null;
          end = null;
        }

        let txQuery;
        if (start && end) {
          txQuery = query(
            collection(db, "transactions"),
            where("timestamp", ">=", start),
            where("timestamp", "<=", end),
            orderBy("timestamp", "desc")
          );
        } else if (start) {
          txQuery = query(
            collection(db, "transactions"),
            where("timestamp", ">=", start),
            orderBy("timestamp", "desc")
          );
        } else {
          txQuery = query(
            collection(db, "transactions"),
            orderBy("timestamp", "desc")
          );
        }

        const querySnapshot = await getDocs(txQuery);
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Transaction[];
        
        setTransactions(data);
      } catch (error) {
        console.error("Gagal memuat data transaksi:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [timeRange, startDate, endDate]); // Akan merefresh data jika range atau tanggal kustom berubah

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Riwayat Transaksi</h1>
          <p className="text-sm text-zinc-500 mt-1">Pantau semua aktivitas penjualan dan pembatalan (void).</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden sm:block">Periode:</label>
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer shadow-sm"
          >
            <option value="hari-ini">Hari Ini</option>
            <option value="minggu-ini">7 Hari Terakhir</option>
            <option value="bulan-ini">Bulan Ini</option>
            <option value="kustom">Pilih Tanggal Kustom</option>
            <option value="semua">Semua Waktu</option>
          </select>

          {timeRange === "kustom" && (
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-zinc-400"
              />
              <span className="text-zinc-400 font-medium text-xs">s/d</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-zinc-400"
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabel Transaksi */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Waktu & ID</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Kasir</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Metode</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Total (Rp)</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-zinc-500">Memuat data transaksi...</td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-zinc-500">Belum ada transaksi di periode ini.</td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-zinc-900">{formatDateTime(tx.timestamp)}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{tx.transactionId || tx.id}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-700">{tx.kasir}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                        tx.paymentMethod === 'Tunai' ? 'bg-zinc-100 text-zinc-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {tx.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                        tx.status === 'Dibatalkan (Void)' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {tx.status || 'Berhasil'}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-sm font-bold text-right ${tx.status === 'Dibatalkan (Void)' ? 'text-zinc-400 line-through' : 'text-zinc-900'}`}>
                      {formatRupiah(tx.total)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL DETAIL TRANSAKSI --- */}
      {selectedTx && (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-5 border-b border-zinc-100 flex justify-between items-start bg-zinc-50/50">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Detail Transaksi</h2>
                <p className="text-xs font-mono text-zinc-500 mt-1">{selectedTx.transactionId || selectedTx.id}</p>
              </div>
              <button onClick={() => setSelectedTx(null)} className="text-zinc-400 hover:text-zinc-700 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Info Status Void (Jika ada) */}
              {selectedTx.status === "Dibatalkan (Void)" && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-sm">
                  <p className="font-bold text-red-800 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Transaksi Telah Dibatalkan
                  </p>
                  <p className="text-red-600 mt-1">Dibatalkan pada: {formatDateTime(selectedTx.voidedAt)}</p>
                </div>
              )}

              {/* Grid Info */}
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Waktu Pembelian</p>
                  <p className="font-semibold text-zinc-900">{formatDateTime(selectedTx.timestamp)}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Kasir Bertugas</p>
                  <p className="font-semibold text-zinc-900">{selectedTx.kasir}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Metode Bayar</p>
                  <p className="font-semibold text-zinc-900">{selectedTx.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Status</p>
                  <p className="font-semibold text-zinc-900">{selectedTx.status || "Berhasil"}</p>
                </div>
              </div>

              {/* Rincian Barang */}
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-3 border-b border-zinc-100 pb-2">Rincian Pembelian</h3>
              <div className="space-y-3 mb-6">
                {selectedTx.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <div>
                      <p className="font-semibold text-zinc-900">{item.name}</p>
                      <p className="text-zinc-500 text-xs">{item.quantity} x {formatRupiah(item.price)}</p>
                    </div>
                    <p className="font-bold text-zinc-900">{formatRupiah(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>

              {/* Total Kalkulasi */}
              <div className="bg-zinc-50 p-4 rounded-xl space-y-2 text-sm border border-zinc-100">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal</span>
                  <span>{formatRupiah(selectedTx.subTotal)}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>PPN / Pajak</span>
                  <span>{formatRupiah(selectedTx.tax)}</span>
                </div>
                <div className="flex justify-between text-lg font-extrabold text-zinc-900 pt-2 border-t border-zinc-200 mt-2">
                  <span>Total Akhir</span>
                  <span>{formatRupiah(selectedTx.total)}</span>
                </div>
                
                {selectedTx.paymentMethod === "Tunai" && (
                  <>
                    <div className="flex justify-between text-zinc-500 pt-2 mt-2 border-t border-zinc-200 border-dashed">
                      <span>Uang Diterima</span>
                      <span>{formatRupiah(selectedTx.cashReceived)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span>Kembalian</span>
                      <span>{formatRupiah(selectedTx.change)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-zinc-100">
              <button 
                onClick={() => setSelectedTx(null)}
                className="w-full py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-xl transition-all"
              >
                Tutup Detail
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}