"use client";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";

// --- INTERFACES ---
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface TransactionData {
  transactionId?: string;
  total: number;
  subTotal: number;
  discount?: number;
  tax: number;
  paymentMethod: string;
  cashReceived: number;
  change: number;
  kasir: string;
  dateString: string;
  items: CartItem[];
}

interface ReceiptProps {
  data: TransactionData | any; 
}

export default function Receipt({ data }: ReceiptProps) {
  // State untuk menyimpan konfigurasi toko dari Firestore
  const [storeConfig, setStoreConfig] = useState({
    storeName: "NAMA TOKO ANDA",
    storeAddress: "Jl. Contoh Jalan Raya No. 123",
    storePhone: "0812-3456-7890",
    receiptFooter: "Terima kasih atas kunjungan Anda!",
  });

  // Ambil data pengaturan toko saat komponen dimuat
  useEffect(() => {
    const fetchStoreConfig = async () => {
      try {
        const docSnap = await getDoc(doc(db, "settings", "store_config"));
        if (docSnap.exists()) {
          const cfg = docSnap.data();
          setStoreConfig({
            storeName: cfg.storeName || "NAMA TOKO ANDA",
            storeAddress: cfg.storeAddress || "Jl. Contoh Alamat",
            storePhone: cfg.storePhone || "-",
            receiptFooter: cfg.receiptFooter || "Terima kasih atas kunjungan Anda!",
          });
        }
      } catch (err) {
        console.error("Gagal memuat konfigurasi struk:", err);
      }
    };
    fetchStoreConfig();
  }, []);

  if (!data) return null;

  const formatAngka = (number: number) => {
    return new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 0,
    }).format(number);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        /* 1. Sembunyikan struk di layar normal (Monitor/HP) */
        #print-area {
          display: none;
        }

        /* 2. Pengaturan KHUSUS saat tombol Print ditekan */
        @media print {
          #print-area { 
            display: block !important;
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 58mm; /* Lebar kertas kasir thermal 58mm */
            font-family: 'Courier New', Courier, monospace; 
            font-size: 11px;
            color: #000;
            background: #fff;
            z-index: 9999;
          }
          
          .no-print {
            display: none !important;
          }
          
          @page { margin: 0; }
        }
      `}} />

      {/* --- KONTEN STRUK DINAMIS --- */}
      <div id="print-area">
        
        {/* Header Toko (Sesuai Pengaturan Admin) */}
        <div style={{ textAlign: "center", marginBottom: "8px", marginTop: "10px" }}>
          <h2 style={{ margin: "0", fontSize: "14px", fontWeight: "bold" }}>{storeConfig.storeName}</h2>
          <p style={{ margin: "2px 0 0 0", fontSize: "10px" }}>{storeConfig.storeAddress}</p>
          <p style={{ margin: "0", fontSize: "10px" }}>Telp: {storeConfig.storePhone}</p>
        </div>

        {/* Info Transaksi */}
        <div style={{ borderBottom: "1px dashed #000", paddingBottom: "4px", marginBottom: "4px", fontSize: "10px" }}>
          <p style={{ margin: "0" }}>Waktu : {data.dateString}</p>
          <p style={{ margin: "0" }}>No    : {data.transactionId}</p>
          <p style={{ margin: "0" }}>Kasir : {data.kasir}</p>
        </div>

        {/* Daftar Barang */}
        <table style={{ width: "100%", fontSize: "10px", borderBottom: "1px dashed #000", paddingBottom: "4px", marginBottom: "4px" }}>
          <tbody>
            {data.items?.map((item: CartItem, idx: number) => (
              <tr key={idx}>
                <td style={{ paddingBottom: "3px", verticalAlign: "top" }}>
                  <div style={{ display: "block", fontWeight: "bold" }}>{item.name}</div>
                  <div>{item.quantity} x {formatAngka(item.price)}</div>
                </td>
                <td style={{ textAlign: "right", verticalAlign: "bottom", paddingBottom: "3px" }}>
                  {formatAngka(item.quantity * item.price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Rincian Total & Diskon */}
        <table style={{ width: "100%", fontSize: "10px", borderBottom: "1px dashed #000", paddingBottom: "4px", marginBottom: "8px" }}>
          <tbody>
            <tr>
              <td>Subtotal</td>
              <td style={{ textAlign: "right" }}>{formatAngka(data.subTotal)}</td>
            </tr>

            {/* Tampilkan baris diskon hanya jika ada potongan */}
            {data.discount > 0 && (
              <tr>
                <td>Diskon Toko</td>
                <td style={{ textAlign: "right" }}>- {formatAngka(data.discount)}</td>
              </tr>
            )}

            <tr>
              <td>PPN / Pajak</td>
              <td style={{ textAlign: "right" }}>{formatAngka(data.tax)}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: "bold", paddingTop: "4px", fontSize: "11px" }}>TOTAL</td>
              <td style={{ textAlign: "right", fontWeight: "bold", paddingTop: "4px", fontSize: "11px" }}>
                {formatAngka(data.total)}
              </td>
            </tr>
            <tr>
              <td style={{ paddingTop: "4px" }}>Bayar ({data.paymentMethod})</td>
              <td style={{ textAlign: "right", paddingTop: "4px" }}>{formatAngka(data.cashReceived)}</td>
            </tr>
            <tr>
              <td>Kembali</td>
              <td style={{ textAlign: "right" }}>{formatAngka(data.change)}</td>
            </tr>
          </tbody>
        </table>

        {/* Footer (Sesuai Pengaturan Admin) */}
        <div style={{ textAlign: "center", fontSize: "10px" }}>
          <p style={{ margin: "0", fontWeight: "bold" }}>{storeConfig.receiptFooter}</p>
        </div>
        
        <br />
        <br />
      </div>
    </>
  );
}