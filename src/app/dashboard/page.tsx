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

interface PaymentStats {
  method: string;
  count: number;
  revenue: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  
  // State Filter Waktu Dinamis
  const [timeRange, setTimeRange] = useState("hari-ini");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // States Data
  const [stats, setStats] = useState({
    totalProductsSoldToday: 0,
    totalRevenue: 0,
    totalTransactions: 0,
  });
  const [topProducts, setTopProducts] = useState<ProductSales[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentStats[]>([]);

  // Format Rupiah
  const formatRupiah = (number: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const now = new Date();

        // 1. Ambil Produk Terjual "Hari Ini" Secara Statis (Tidak Terpengaruh Filter)
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayQuery = query(
          collection(db, "transactions"),
          where("timestamp", ">=", startOfToday)
        );
        const todaySnap = await getDocs(todayQuery);
        
        let productsSoldTodayCount = 0;
        todaySnap.forEach((doc) => {
          const data = doc.data() as Transaction;
          if (data.status !== "Dibatalkan (Void)" && data.items && Array.isArray(data.items)) {
            data.items.forEach((item) => {
              productsSoldTodayCount += item.quantity || 0;
            });
          }
        });

        // 2. Tentukan Rentang Waktu (Filter Utama Dashboard)
        let start: Date | null = null;
        let end: Date | null = new Date(); // Default end
        
        if (timeRange === "hari-ini") {
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (timeRange === "minggu-ini") {
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        } else if (timeRange === "bulan-ini") {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (timeRange === "kustom" && startDate && endDate) {
          start = new Date(startDate);
          start.setHours(0, 0, 0, 0); 
          end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
        } else if (timeRange === "semua") {
          start = null;
          end = null;
        }

        // 3. Buat Query Firebase Berdasarkan Filter Waktu Pilihan
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

        const transactionsSnap = await getDocs(txQuery);
        
        let revenue = 0;
        let txCount = 0;
        const productSalesMap: Record<string, ProductSales> = {};
        const paymentMap: Record<string, PaymentStats> = {};

        // 4. Proses Loop Transaksi Filtered
        transactionsSnap.forEach((doc) => {
          const data = doc.data() as Transaction;
          data.id = doc.id;
          
          if (data.status !== "Dibatalkan (Void)") {
            revenue += data.total || 0;
            txCount++;

            // Kalkulasi Produk Terjual
            if (data.items && Array.isArray(data.items)) {
              data.items.forEach((item) => {
                if (!productSalesMap[item.id]) {
                  productSalesMap[item.id] = { name: item.name, qty: 0, revenue: 0 };
                }
                productSalesMap[item.id].qty += item.quantity;
                productSalesMap[item.id].revenue += (item.price * item.quantity);
              });
            }

            // Kalkulasi Metode Pembayaran
            const method = data.paymentMethod || "Tunai";
            if (!paymentMap[method]) {
              paymentMap[method] = { method: method, count: 0, revenue: 0 };
            }
            paymentMap[method].count += 1;
            paymentMap[method].revenue += data.total || 0;
          }
        });

        const sortedProducts = Object.values(productSalesMap).sort((a, b) => b.qty - a.qty);
        const sortedPayments = Object.values(paymentMap).sort((a, b) => b.revenue - a.revenue);

        // Update semua State
        setStats({
          totalProductsSoldToday: productsSoldTodayCount, 
          totalRevenue: revenue,
          totalTransactions: txCount, 
        });
        setTopProducts(sortedProducts);
        setPaymentStats(sortedPayments);

      } catch (error) {
        console.error("Gagal memuat data dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [timeRange, startDate, endDate]); 

  return (
    <div className="space-y-6 sm:space-y-8 font-sans pb-10">
      
      {/* Header Halaman & Filter Waktu Dinamis */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">Dashboard Admin</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Ringkasan performa toko dan aktivitas transaksi.
          </p>
        </div>
        
        {/* Dropdown Filter Range Waktu */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:block">Periode:</label>
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
              className="w-full sm:w-auto px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer shadow-sm"
            >
              <option value="hari-ini">Hari Ini</option>
              <option value="minggu-ini">7 Hari Terakhir</option>
              <option value="bulan-ini">Bulan Ini</option>
              <option value="kustom">Pilih Tanggal Kustom</option>
              <option value="semua">Semua Waktu</option>
            </select>
          </div>

          {/* Muncul Jika Opsi "Pilih Tanggal Kustom" Dipilih */}
          {timeRange === "kustom" && (
            <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="w-full sm:w-auto px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-zinc-400"
              />
              <span className="text-zinc-400 font-medium text-xs">s/d</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="w-full sm:w-auto px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-zinc-400"
              />
            </div>
          )}
        </div>
      </div>

      {/* Grid Statistik Kartu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white border border-zinc-200 p-5 sm:p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500">Pendapatan Bersih</p>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-zinc-900 truncate">
            {loading ? "..." : formatRupiah(stats.totalRevenue)}
          </p>
        </div>

        <div className="bg-white border border-zinc-200 p-5 sm:p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500">Transaksi Sukses</p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-zinc-900">
            {loading ? "..." : stats.totalTransactions} <span className="text-xs sm:text-sm font-medium text-zinc-400">order</span>
          </p>
        </div>

        <div className="bg-white border border-zinc-200 p-5 sm:p-6 rounded-2xl shadow-sm sm:col-span-2 lg:col-span-1">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500" title="Tetap dihitung berdasarkan hari ini, terlepas dari filter waktu di atas.">Produk Terjual Hari Ini</p>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-zinc-900">
            {loading ? "..." : stats.totalProductsSoldToday} <span className="text-xs sm:text-sm font-medium text-zinc-400">item</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        
        {/* ================= Bagian Kiri: Tabel Penjualan Produk ================= */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
            <h2 className="text-base sm:text-lg font-semibold text-zinc-900">Summary Penjualan Produk</h2>
          </div>
          
          <div className="overflow-x-auto flex-1 max-h-[400px]">
            <table className="w-full text-left border-collapse min-w-[400px]">
              <thead>
                <tr className="bg-white border-b border-zinc-100 sticky top-0 z-10 shadow-sm">
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Nama Produk</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center whitespace-nowrap">Terjual</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right whitespace-nowrap">Pendapatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-4 sm:px-6 py-8 text-center text-sm text-zinc-500">Memuat data...</td>
                  </tr>
                ) : topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 sm:px-6 py-8 text-center text-sm text-zinc-500">Belum ada penjualan di periode ini.</td>
                  </tr>
                ) : (
                  topProducts.map((product, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm font-semibold text-zinc-900">{product.name}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-zinc-600 text-center">
                        <span className="bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-md">{product.qty}</span>
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm font-bold text-zinc-900 text-right whitespace-nowrap">{formatRupiah(product.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= Bagian Kanan: Summary Metode Pembayaran ================= */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
            <h2 className="text-base sm:text-lg font-semibold text-zinc-900">Summary per Pembayaran</h2>
          </div>
          
          <div className="overflow-x-auto flex-1 max-h-[400px]">
            <table className="w-full text-left border-collapse min-w-[350px]">
              <thead>
                <tr className="bg-white border-b border-zinc-100 sticky top-0 z-10 shadow-sm">
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Metode</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center whitespace-nowrap">Trx</th>
                  <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right whitespace-nowrap">Total Pendapatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-4 sm:px-6 py-8 text-center text-sm text-zinc-500">Memuat data...</td>
                  </tr>
                ) : paymentStats.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 sm:px-6 py-8 text-center text-sm text-zinc-500">Belum ada transaksi di periode ini.</td>
                  </tr>
                ) : (
                  paymentStats.map((payment, idx) => {
                    const badgeColor = 
                      payment.method.toLowerCase().includes("qris") ? "bg-purple-50 text-purple-700 border-purple-200" :
                      payment.method.toLowerCase().includes("tunai") ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      payment.method.toLowerCase().includes("kartu") ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-blue-50 text-blue-700 border-blue-200";

                    return (
                      <tr key={idx} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 sm:px-6 sm:py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold border whitespace-nowrap ${badgeColor}`}>
                            {payment.method}
                          </span>
                        </td>
                        <td className="px-4 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-zinc-600 text-center font-semibold">
                          {payment.count}
                        </td>
                        <td className="px-4 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm font-bold text-zinc-900 text-right whitespace-nowrap">
                          {formatRupiah(payment.revenue)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}