"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface SidebarProps {
  adminName: string;
  onLogout: () => void;
}

export default function Sidebar({ adminName, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Perbaikan class CSS agar rapi saat isCollapsed
  const getLinkStyle = (path: string) => {
    const isActive = pathname === path;
    
    // Jika collapsed, kita pusatkan (justify-center), jika tidak, rata kiri (justify-start)
    return `flex items-center ${isCollapsed ? "justify-center p-3" : "justify-start gap-3 px-4 py-3"} rounded-xl text-sm font-medium transition-all ${
      isActive
        ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-900/30" 
        : "text-slate-400 hover:bg-slate-800 hover:text-white"
    }`;
  };

  return (
    <aside className={`print:hidden ${isCollapsed ? "w-20" : "w-64"} bg-slate-900 border-r border-slate-800 p-4 sm:p-6 flex flex-col justify-between hidden md:flex transition-all duration-300 relative shadow-xl`}>
      <div>
        {/* Header / Logo & Tombol Collapse */}
        <div className={`flex items-center ${isCollapsed ? "justify-center flex-col gap-4" : "justify-between"} mb-8`}>
          {!isCollapsed && (
            <div className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2 overflow-hidden whitespace-nowrap">
              <div className="w-9 h-9 bg-blue-600 text-white flex items-center justify-center rounded-xl text-sm font-bold shadow-md shadow-blue-600/30 shrink-0">
                P
              </div>
              <span className="leading-tight">TELEMEDIA.ID <br/><span className="text-slate-400 font-medium text-xs">POS Dashboard</span></span>
            </div>
          )}

          {/* Tombol Lipat / Expand */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors ${isCollapsed ? "" : "ml-auto shrink-0"}`}
            title={isCollapsed ? "Luaskan Sidebar" : "Kecilkan Sidebar"}
          >
            {isCollapsed ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
            )}
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="space-y-2">
          <Link href="/dashboard" className={getLinkStyle("/dashboard")} title="Ringkasan">
            <span className="text-lg shrink-0">📊</span>
            {!isCollapsed && <span className="whitespace-nowrap">Ringkasan</span>}
          </Link>

          <Link href="/dashboard/products" className={getLinkStyle("/dashboard/products")} title="Kelola Produk">
            <span className="text-lg shrink-0">📦</span>
            {!isCollapsed && <span className="whitespace-nowrap">Kelola Produk</span>}
          </Link>

          <Link href="/dashboard/cashiers" className={getLinkStyle("/dashboard/cashiers")} title="Kelola Kasir">
            <span className="text-lg shrink-0">👥</span>
            {!isCollapsed && <span className="whitespace-nowrap">Kelola Kasir</span>}
          </Link>

          <Link href="/dashboard/transactions" className={getLinkStyle("/dashboard/transactions")} title="Transaksi">
            <span className="text-lg shrink-0">📈</span>
            {!isCollapsed && <span className="whitespace-nowrap">Transaksi</span>}
          </Link>

          <Link href="/dashboard/logs" className={getLinkStyle("/dashboard/logs")} title="Log Aktivitas">
            <span className="text-lg shrink-0">📋</span>
            {!isCollapsed && <span className="whitespace-nowrap">Log Aktivitas</span>}
          </Link>

          <Link href="/dashboard/import" className={getLinkStyle("/dashboard/import")} title="Impor Data">
            <span className="text-lg shrink-0">📥</span>
            {!isCollapsed && <span className="whitespace-nowrap">Impor Data</span>}
          </Link>

          <Link href="/dashboard/reports" className={getLinkStyle("/dashboard/reports")} title="Laporan">
            <span className="text-lg shrink-0">📝</span>
            {!isCollapsed && <span className="whitespace-nowrap">Laporan</span>}
          </Link>

          <Link href="/dashboard/settings" className={getLinkStyle("/dashboard/settings")} title="Pengaturan">
            <span className="text-lg shrink-0">⚙️</span>
            {!isCollapsed && <span className="whitespace-nowrap">Pengaturan</span>}
          </Link>
        </nav>
      </div>

      {/* User Info & Logout */}
      <div className="pt-6 border-t border-slate-800 flex flex-col items-center">
        {!isCollapsed && (
          <div className="mb-4 px-2 overflow-hidden whitespace-nowrap w-full text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Masuk sebagai:</p>
            <p className="text-sm font-bold text-slate-200 truncate">{adminName}</p>
          </div>
        )}

        <button
          onClick={onLogout}
          title="Keluar"
          className={`w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 active:scale-[0.98] text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            isCollapsed ? "justify-center px-0" : "justify-center px-4"
          }`}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!isCollapsed && <span className="whitespace-nowrap">Keluar</span>}
        </button>
      </div>
    </aside>
  );
}