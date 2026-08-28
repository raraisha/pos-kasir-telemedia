"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

interface SidebarProps {
  adminName: string;
  onLogout: () => void;
}

export default function Sidebar({ adminName, onLogout }: SidebarProps) {
  const pathname = usePathname();
  
  // State untuk mode Desktop (Luas/Sempit)
  const [isCollapsed, setIsCollapsed] = useState(false);
  // State untuk mode Mobile (Buka/Tutup)
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Otomatis menutup sidebar di mobile setiap kali berpindah halaman
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Fungsi dinamis untuk class CSS menu link
  const getLinkStyle = (path: string) => {
    const isActive = pathname === path;
    
    // Di mode mobile selalu rata kiri (justify-start), di mode desktop mengikuti isCollapsed
    const layoutClasses = isCollapsed
      ? "justify-start px-4 py-3 md:justify-center md:p-3" 
      : "justify-start px-4 py-3";

    return `flex items-center gap-3 ${layoutClasses} rounded-xl text-sm font-medium transition-all ${
      isActive
        ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-900/30" 
        : "text-slate-400 hover:bg-slate-800 hover:text-white"
    }`;
  };

  return (
    <>
      {/* ================= TOMBOL HAMBURGER MOBILE ================= */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-40 md:hidden p-2.5 bg-slate-900 text-white rounded-lg shadow-md border border-slate-700 focus:outline-none active:scale-95 transition-transform"
        title="Buka Menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* ================= BACKDROP MOBILE ================= */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* ================= SIDEBAR ================= */}
      <aside 
        className={`print:hidden fixed inset-y-0 left-0 z-50 md:relative flex flex-col justify-between bg-slate-900 border-r border-slate-800 p-4 sm:p-6 transition-all duration-300 shadow-xl 
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} 
        ${isCollapsed ? "md:w-20" : "md:w-64"} w-64`}
      >
        <div>
          {/* Header / Logo & Tombol Toggle */}
          <div className={`flex items-center mb-8 ${isCollapsed ? "md:flex-col md:justify-center md:gap-4 justify-between" : "justify-between"}`}>
            
            {/* Logo (Sembunyi di Desktop jika Collapsed, Selalu tampil di Mobile) */}
            <div className={`text-xl font-extrabold text-white tracking-tight flex items-center gap-2 overflow-hidden whitespace-nowrap ${isCollapsed ? "md:hidden" : ""}`}>
              <div className="w-9 h-9 bg-blue-600 text-white flex items-center justify-center rounded-xl text-sm font-bold shadow-md shadow-blue-600/30 shrink-0">
                P
              </div>
              <span className="leading-tight">TELEMEDIA.ID <br/><span className="text-slate-400 font-medium text-xs">POS Dashboard</span></span>
            </div>

            {/* Tombol Tutup (Hanya tampil di Mobile) */}
            <button 
              onClick={() => setIsMobileOpen(false)}
              className="md:hidden p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {/* Tombol Lipat / Expand (Hanya tampil di Desktop) */}
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`hidden md:block p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors ${isCollapsed ? "" : "ml-auto shrink-0"}`}
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
            {[
              { path: "/dashboard", icon: "📊", label: "Ringkasan" },
              { path: "/dashboard/products", icon: "📦", label: "Kelola Produk" },
              { path: "/dashboard/cashiers", icon: "👥", label: "Kelola Kasir" },
              { path: "/dashboard/transactions", icon: "📈", label: "Transaksi" },
              { path: "/dashboard/logs", icon: "📋", label: "Log Aktivitas" },
              { path: "/dashboard/import", icon: "📥", label: "Impor Data" },
              { path: "/dashboard/reports", icon: "📝", label: "Laporan" },
              { path: "/dashboard/settings", icon: "⚙️", label: "Pengaturan" },
            ].map((menu) => (
              <Link key={menu.path} href={menu.path} className={getLinkStyle(menu.path)} title={menu.label}>
                <span className="text-lg shrink-0">{menu.icon}</span>
                {/* Teks sembunyi saat mode collapsed di desktop, tetap muncul di mobile */}
                <span className={`whitespace-nowrap ${isCollapsed ? "md:hidden" : ""}`}>
                  {menu.label}
                </span>
              </Link>
            ))}
          </nav>
        </div>

        {/* User Info & Logout */}
        <div className="pt-6 border-t border-slate-800 flex flex-col items-center">
          
          <div className={`mb-4 px-2 overflow-hidden whitespace-nowrap w-full text-left ${isCollapsed ? "md:hidden" : ""}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Masuk sebagai:</p>
            <p className="text-sm font-bold text-slate-200 truncate">{adminName}</p>
          </div>

          <button
            onClick={onLogout}
            title="Keluar"
            className={`w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 active:scale-[0.98] text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              isCollapsed ? "justify-start px-4 md:justify-center md:px-0" : "justify-center px-4"
            }`}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className={`whitespace-nowrap ${isCollapsed ? "md:hidden" : ""}`}>Keluar</span>
          </button>
        </div>
      </aside>
    </>
  );
}