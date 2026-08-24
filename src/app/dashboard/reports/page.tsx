"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, where, doc, getDoc } from "firebase/firestore";
import { db } from "../../../config/firebase";

interface Transaction {
  id: string;
  transactionId?: string;
  total: number;
  subTotal: number;
  tax: number;
  paymentMethod: string;
  kasir: string;
  status?: string;
  timestamp: any;
  dateString?: string;
  items: any[];
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [storeName, setStoreName] = useState("NAMA TOKO ANDA"); // Untuk Header Laporan
  
  // State Filter Waktu
  const [filterType, setFilterType] = useState<"hari-ini" | "minggu-ini" | "bulan-ini" | "kustom">("hari-ini");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Format Rupiah
  const formatRupiah = (number: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  // Format Tanggal
  const formatDate = (timestamp: any) => {
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

  const getPeriodeCetak = () => {
    if (filterType === "hari-ini") return "Hari Ini";
    if (filterType === "minggu-ini") return "7 Hari Terakhir";
    if (filterType === "bulan-ini") return "Bulan Ini";
    return `${startDate} s/d ${endDate}`;
  };

  // Ambil Data Berdasarkan Filter
  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Ambil nama toko untuk kop laporan
      const storeSnap = await getDoc(doc(db, "settings", "store_config"));
      if (storeSnap.exists() && storeSnap.data().storeName) {
        setStoreName(storeSnap.data().storeName);
      }

      const now = new Date();
      let start: Date | null = null;
      let end: Date | null = new Date(); // Sampai hari ini akhir

      if (filterType === "hari-ini") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (filterType === "minggu-ini") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      } else if (filterType === "bulan-ini") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (filterType === "kustom" && startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
        end.setHours(23, 59, 59); // Ambil sampai akhir hari tersebut
      }

      let txQuery;
      if (start) {
        txQuery = query(
          collection(db, "transactions"),
          where("timestamp", ">=", start),
          where("timestamp", "<=", end || now),
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
        ...doc.data(),
        id: doc.id
      })) as Transaction[];

      setTransactions(data);
    } catch (error) {
      console.error("Gagal memuat laporan:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [filterType, startDate, endDate]);

  // Kalkulasi Ringkasan (Hanya hitung transaksi berhasil / bukan Void)
  const validTransactions = transactions.filter(t => t.status !== "Dibatalkan (Void)");
  const totalRevenue = validTransactions.reduce((acc, t) => acc + (t.total || 0), 0);
  const totalOrders = validTransactions.length;
  const totalItemsSold = validTransactions.reduce((acc, t) => {
    if (t.items && Array.isArray(t.items)) {
      return acc + t.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }
    return acc;
  }, 0);

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. TAMPILAN WEB NORMAL (Akan disembunyikan saat diprint via print:hidden) */}
      {/* ========================================================================= */}
      <div className="space-y-6 font-sans print:hidden">
        
        {/* HEADER & FILTER */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Rekapitulasi Laporan Penjualan</h1>
            <p className="text-sm text-zinc-500 mt-1">Analisis omzet, jumlah pesanan, dan rincian transaksi berdasarkan periode waktu.</p>
          </div>

          {/* CONTROLS FILTER */}
          <div className="flex flex-wrap items-center gap-3">
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-800 shadow-sm focus:outline-none cursor-pointer"
            >
              <option value="hari-ini">Hari Ini</option>
              <option value="minggu-ini">7 Hari Terakhir</option>
              <option value="bulan-ini">Bulan Ini</option>
              <option value="kustom">Rentang Waktu Kustom</option>
            </select>

            {filterType === "kustom" && (
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-semibold"
                />
                <span className="text-zinc-400">s/d</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-semibold"
                />
              </div>
            )}

            <button 
              onClick={() => window.print()}
              disabled={loading}
              className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              🖨️ Cetak Laporan PDF
            </button>
          </div>
        </div>

        {/* KARTU RINGKASAN STATISTIK */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Total Omzet (Pendapatan)</p>
            <p className="text-3xl font-extrabold text-emerald-600">{loading ? "..." : formatRupiah(totalRevenue)}</p>
          </div>
          <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Total Transaksi Sukses</p>
            <p className="text-3xl font-extrabold text-blue-600">{loading ? "..." : totalOrders} <span className="text-sm font-medium text-zinc-400">order</span></p>
          </div>
          <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Produk Terjual</p>
            <p className="text-3xl font-extrabold text-purple-600">{loading ? "..." : totalItemsSold} <span className="text-sm font-medium text-zinc-400">item</span></p>
          </div>
        </div>

        {/* TABEL RINCIAN TRANSAKSI (UI WEB) */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
            <h2 className="font-bold text-zinc-900 text-sm">Daftar Transaksi Periode Ini ({transactions.length})</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/30 text-zinc-500 uppercase font-semibold">
                  <th className="px-6 py-3.5">ID Transaksi / Waktu</th>
                  <th className="px-6 py-3.5">Kasir</th>
                  <th className="px-6 py-3.5">Metode Bayar</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Total Tagihan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">Memuat rekapitulasi data...</td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">Tidak ada transaksi pada periode ini.</td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-6 py-3.5">
                        <p className="font-bold text-zinc-900">{tx.transactionId || "TRX-UNKNOWN"}</p>
                        <p className="text-[11px] text-zinc-400">{formatDate(tx.timestamp)}</p>
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-zinc-700 uppercase">{tx.kasir || "Kasir"}</td>
                      <td className="px-6 py-3.5 text-zinc-600 font-medium">{tx.paymentMethod || "Tunai"}</td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-1 rounded-md font-bold text-[10px] ${
                          tx.status === 'Dibatalkan (Void)' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {tx.status || 'Berhasil'}
                        </span>
                      </td>
                      <td className={`px-6 py-3.5 text-right font-extrabold text-sm ${tx.status === 'Dibatalkan (Void)' ? 'text-zinc-300 line-through' : 'text-zinc-900'}`}>
                        {formatRupiah(tx.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TAMPILAN KHUSUS PRINT (Tersembunyi di web, muncul full page di print) */}
      {/* ========================================================================= */}
      <div className="hidden print:block w-full bg-white text-black p-8 font-sans">
        
        {/* KOP LAPORAN */}
        <div className="text-center border-b-2 border-black pb-6 mb-6">
          <h1 className="text-3xl font-extrabold uppercase tracking-widest">{storeName}</h1>
          <h2 className="text-xl font-bold mt-2 text-zinc-700">LAPORAN REKAPITULASI PENJUALAN</h2>
          <p className="text-sm mt-1 font-medium text-zinc-600">Periode: {getPeriodeCetak()}</p>
        </div>

        {/* SUMMARY (RINGKASAN) */}
        <div className="flex justify-between items-center bg-zinc-100 p-4 border border-zinc-300 rounded-lg mb-8">
          <div className="text-center flex-1 border-r border-zinc-300">
            <p className="text-xs font-bold uppercase text-zinc-500 mb-1">Total Omzet Bersih</p>
            <p className="text-xl font-extrabold text-black">{formatRupiah(totalRevenue)}</p>
          </div>
          <div className="text-center flex-1 border-r border-zinc-300">
            <p className="text-xs font-bold uppercase text-zinc-500 mb-1">Total Transaksi</p>
            <p className="text-xl font-extrabold text-black">{totalOrders} <span className="text-sm font-normal">Order</span></p>
          </div>
          <div className="text-center flex-1">
            <p className="text-xs font-bold uppercase text-zinc-500 mb-1">Produk Terjual</p>
            <p className="text-xl font-extrabold text-black">{totalItemsSold} <span className="text-sm font-normal">Item</span></p>
          </div>
        </div>

        {/* TABEL FULL DATA */}
        <div className="mb-4">
          <h3 className="text-sm font-bold uppercase mb-3">Rincian Transaksi</h3>
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="border-y-2 border-black">
                <th className="py-2 px-2">No</th>
                <th className="py-2 px-2">Waktu Transaksi</th>
                <th className="py-2 px-2">ID Transaksi</th>
                <th className="py-2 px-2">Kasir</th>
                <th className="py-2 px-2">Metode</th>
                <th className="py-2 px-2">Status</th>
                <th className="py-2 px-2 text-right">Subtotal</th>
                <th className="py-2 px-2 text-right">Pajak</th>
                <th className="py-2 px-2 text-right">Total Tagihan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-zinc-500 italic">Tidak ada transaksi pada periode ini.</td>
                </tr>
              ) : (
                transactions.map((tx, idx) => {
                  const isVoid = tx.status === "Dibatalkan (Void)";
                  return (
                    <tr key={tx.id} className={isVoid ? "text-zinc-400" : "text-black"}>
                      <td className="py-2 px-2">{idx + 1}</td>
                      <td className="py-2 px-2">{formatDate(tx.timestamp)}</td>
                      <td className="py-2 px-2 font-mono">{tx.transactionId || "-"}</td>
                      <td className="py-2 px-2">{tx.kasir}</td>
                      <td className="py-2 px-2">{tx.paymentMethod}</td>
                      <td className="py-2 px-2 font-bold">{isVoid ? "VOID" : "Sukses"}</td>
                      <td className={`py-2 px-2 text-right ${isVoid ? "line-through" : ""}`}>{formatRupiah(tx.subTotal || 0)}</td>
                      <td className={`py-2 px-2 text-right ${isVoid ? "line-through" : ""}`}>{formatRupiah(tx.tax || 0)}</td>
                      <td className={`py-2 px-2 text-right font-bold ${isVoid ? "line-through" : ""}`}>{formatRupiah(tx.total)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER TTD */}
        <div className="mt-12 flex justify-end">
          <div className="text-center">
            <p className="text-xs mb-16">Dicetak pada: {new Date().toLocaleString("id-ID")}</p>
            <p className="text-sm font-bold border-b border-black inline-block px-8 pb-1">Administrator</p>
          </div>
        </div>

      </div>
    </>
  );
}