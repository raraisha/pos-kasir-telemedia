"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../../config/firebase";

interface ActivityLog {
  id: string;
  user: string;
  role: string;
  action: string;
  details: string;
  timestamp: any;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).format(date);
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Mengambil 100 log aktivitas terakhir
      const q = query(collection(db, "activity_logs"), orderBy("timestamp", "desc"), limit(100));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityLog[];
      setLogs(data);
    } catch (error) {
      console.error("Gagal memuat log:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6 font-sans pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">Log Aktivitas Sistem</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">Pantau semua tindakan yang dilakukan oleh Kasir dan Admin.</p>
        </div>
        <button 
          onClick={fetchLogs} 
          className="w-full sm:w-auto px-4 py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-sm font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh Data
        </button>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Waktu</th>
                <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Pengguna</th>
                <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Aktivitas</th>
                <th className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 sm:px-6 py-10 text-center text-xs sm:text-sm text-zinc-500">Memuat data log...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 sm:px-6 py-10 text-center text-xs sm:text-sm text-zinc-500">Belum ada aktivitas terekam.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-[10px] sm:text-xs text-zinc-500 font-mono whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${log.role === 'admin' ? 'bg-purple-500' : 'bg-blue-500'}`}></span>
                        <span className="text-xs sm:text-sm font-bold text-zinc-900">{log.user}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm font-semibold text-zinc-800 whitespace-nowrap">{log.action}</td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-zinc-600 min-w-[200px]">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}