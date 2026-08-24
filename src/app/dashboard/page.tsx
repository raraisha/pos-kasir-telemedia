"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "../../config/firebase";

// --- INTERFACES ---
interface Transaction {
  id: string;
  transactionId?: string;
  total: number;
  paymentMethod: string;
  kasir: string;
  status?: string;
  timestamp: any;
  items: any[];
}

interface ProductSales {
  name: string;
  qty: number;
  revenue: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  
  // State Filter Waktu
  const [timeRange, setTimeRange] = useState("hari-ini");

  // States Data
  const [stats, setStats] = useState({
    totalProductsSoldToday: 0, // <-- Diubah untuk menampung total produk terjual hari ini
    totalRevenue: 0,
    totalTransactions: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [topProducts, setTopProducts] = useState<ProductSales[]>([]);

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
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // 1. Ambil Transaksi Hari Ini Secara Spesifik untuk Kartu Statistik
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const todayQuery = query(
          collection(db, "transactions"),
          where("timestamp", ">=", startOfToday)
        );
        const todaySnap = await getDocs(todayQuery);
        
        let productsSoldTodayCount = 0;
        todaySnap.forEach((doc) => {
          const data = doc.data() as Transaction;
          // Hanya hitung jika transaksi berhasil (tidak Void)
          if (data.status !== "Dibatalkan (Void)" && data.items && Array.isArray(data.items)) {
            data.items.forEach((item) => {
              productsSoldTodayCount += item.quantity || 0;
            });
          }
        });

        // 2. Tentukan Rentang Waktu untuk Filter Tabel & Grafik Utama
        let startDate: Date | null = null;
        if (timeRange === "hari-ini") {
          startDate = startOfToday;
        } else if (timeRange === "minggu-ini") {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        } else if (timeRange === "bulan-ini") {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        // 3. Buat Query Firebase Berdasarkan Filter Waktu Pilihan
        let txQuery;
        if (startDate) {
          txQuery = query(
            collection(db, "transactions"),
            where("timestamp", ">=", startDate),
            orderBy("timestamp", "desc")
          );
        } else {
          txQuery = query(
            collection(db, "transactions"),
            orderBy("timestamp", "desc")
          );
        }

        const transactionsSnap = await getDocs(txQuery);
        
        let revenue = 0;
        let txCount = 0;
        const productSalesMap: Record<string, ProductSales> = {};
        const recentTx: Transaction[] = [];

        // 4. Proses Loop Transaksi Filtered
        transactionsSnap.forEach((doc) => {
          const data = doc.data() as Transaction;
          data.id = doc.id;
          
          recentTx.push(data); 

          if (data.status !== "Dibatalkan (Void)") {
            revenue += data.total || 0;
            txCount++;

            if (data.items && Array.isArray(data.items)) {
              data.items.forEach((item) => {
                if (!productSalesMap[item.id]) {
                  productSalesMap[item.id] = { name: item.name, qty: 0, revenue: 0 };
                }
                productSalesMap[item.id].qty += item.quantity;
                productSalesMap[item.id].revenue += (item.price * item.quantity);
              });
            }
          }
        });

        const sortedProducts = Object.values(productSalesMap).sort((a, b) => b.qty - a.qty);

        // Update semua State
        setStats({
          totalProductsSoldToday: productsSoldTodayCount, // <-- Masukkan hasil hitung hari ini
          totalRevenue: revenue,
          totalTransactions: txCount, 
        });
        setRecentTransactions(recentTx.slice(0, 5)); 
        setTopProducts(sortedProducts);

      } catch (error) {
        console.error("Gagal memuat data dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [timeRange]); 

  return (
    <div className="space-y-8 font-sans">
      
      {/* Header Halaman & Filter Waktu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Dashboard Admin</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Ringkasan performa toko dan aktivitas transaksi.
          </p>
        </div>
        
        {/* Dropdown Filter Range Waktu */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Periode:</label>
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer shadow-sm"
          >
            <option value="hari-ini">Hari Ini</option>
            <option value="minggu-ini">7 Hari Terakhir</option>
            <option value="bulan-ini">Bulan Ini</option>
            <option value="semua">Semua Waktu</option>
          </select>
        </div>
      </div>

      {/* Grid Statistik Kartu */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pendapatan Bersih</p>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-zinc-900">
            {loading ? "..." : formatRupiah(stats.totalRevenue)}
          </p>
        </div>

        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Transaksi Sukses</p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-zinc-900">
            {loading ? "..." : stats.totalTransactions} <span className="text-sm font-medium text-zinc-400">order</span>
          </p>
        </div>

        {/* --- KARTU YANG DIGANTI MENJADI PENJUALAN PRODUK HARI INI --- */}
        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Produk Terjual Hari Ini</p>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-zinc-900">
            {loading ? "..." : stats.totalProductsSoldToday} <span className="text-sm font-medium text-zinc-400">item</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ================= Bagian Kiri: Tabel Penjualan Produk ================= */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
            <h2 className="text-lg font-semibold text-zinc-900">Summary Penjualan Produk</h2>
          </div>
          
          <div className="overflow-x-auto flex-1 max-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-zinc-100 sticky top-0 z-10 shadow-sm">
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nama Produk</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">Terjual</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Pendapatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-zinc-500">Memuat data...</td>
                  </tr>
                ) : topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-zinc-500">Belum ada penjualan di periode ini.</td>
                  </tr>
                ) : (
                  topProducts.map((product, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-zinc-900">{product.name}</td>
                      <td className="px-6 py-4 text-sm text-zinc-600 text-center">
                        <span className="bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-md">{product.qty}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-zinc-900 text-right">{formatRupiah(product.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= Bagian Kanan: Transaksi Terakhir ================= */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
            <h2 className="text-lg font-semibold text-zinc-900">5 Transaksi Terakhir</h2>
          </div>
          
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-zinc-100">
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Waktu / ID</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-zinc-500">Memuat data...</td>
                  </tr>
                ) : recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-zinc-500">Belum ada transaksi.</td>
                  </tr>
                ) : (
                  recentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm text-zinc-900 font-medium">{formatDate(tx.timestamp)}</p>
                        <p className="text-xs text-zinc-500 mt-1">{tx.transactionId}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                          tx.status === 'Dibatalkan (Void)' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {tx.status || 'Berhasil'}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm font-bold text-right ${tx.status === 'Dibatalkan (Void)' ? 'text-zinc-400 line-through' : 'text-zinc-900'}`}>
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
    </div>
  );
}