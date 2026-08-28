"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, serverTimestamp, writeBatch, increment } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import Receipt from "../_components/Receipt";

// --- INTERFACES ---
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  color?: string; 
}

interface CartItem extends Product {
  quantity: number;
}

export default function KasirPage() {
  const router = useRouter();

  // --- STATE KONEKSI & OFFLINE QUEUE ---
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // --- STATE DATA USER / KASIR ---
  const [cashierName, setCashierName] = useState("Memuat...");

  // --- STATE PENGATURAN TOKO ---
  const [taxPercentage, setTaxPercentage] = useState<number>(11);
  const [defaultDiscount, setDefaultDiscount] = useState<number>(0);

  // --- STATE KATALOG ---
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(["Semua"]);
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [loading, setLoading] = useState(true);

  // --- STATE KERANJANG & TRANSAKSI ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentTrxId, setCurrentTrxId] = useState(""); 
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false); // <-- STATE BARU UNTUK CART MOBILE

  // State Modal QTY Pop-up
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [tempQty, setTempQty] = useState<number | "">(1); 

  // State Modal Pembayaran
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"Tunai" | "QRIS" | "Kartu">("Tunai");
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // State Modal Success & Void
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [adminPin, setAdminPin] = useState("");

  // State Pop-up Custom
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false); 
  const [isConfirmLogoutOpen, setIsConfirmLogoutOpen] = useState(false);

  // --- 1. INISIALISASI ANTREAN OFFLINE ---
  useEffect(() => {
    const offlineTx = JSON.parse(localStorage.getItem("pos_offline_tx") || "[]");
    setOfflineQueueCount(offlineTx.length);
  }, []);

  // --- 2. DETEKSI STATUS KONEKSI & AUTO-SYNC ---
  useEffect(() => {
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineTransactions();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- FUNGSI SINKRONISASI DATA OFFLINE ---
  const syncOfflineTransactions = async () => {
    const offlineTx = JSON.parse(localStorage.getItem("pos_offline_tx") || "[]");
    if (offlineTx.length === 0) return;

    try {
      setModalMessage("Sedang mensinkronkan data offline ke server...");
      const batch = writeBatch(db);
      
      offlineTx.forEach((tx: any) => {
        const txRef = doc(collection(db, "transactions"));
        batch.set(txRef, { ...tx, timestamp: serverTimestamp(), isOfflineSync: true });

        tx.items.forEach((item: any) => {
          const productRef = doc(db, "products", item.id);
          batch.update(productRef, { stock: increment(-item.quantity) });
        });

        const logRef = doc(collection(db, "activity_logs"));
        batch.set(logRef, {
          user: tx.kasir,
          role: "kasir",
          action: "Sync Transaksi Offline",
          details: `ID Struk: ${tx.transactionId} | Total: Rp ${tx.total}`,
          timestamp: serverTimestamp()
        });
      });

      await batch.commit();
      
      localStorage.removeItem("pos_offline_tx");
      setOfflineQueueCount(0);
      setModalMessage(`Sukses! ${offlineTx.length} transaksi offline berhasil diunggah.`);

      const querySnapshot = await getDocs(collection(db, "products"));
      setProducts(querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Product[]);
    } catch (error) {
      console.error("Gagal sync offline", error);
      setModalMessage("Gagal mensinkronkan data offline. Pastikan koneksi stabil.");
    }
  };

  // --- 3. CEK USER LOGIN & AMBIL PENGATURAN ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) setCashierName(userDoc.data().nama || user.email);
          else setCashierName(user.email || "Kasir");
        } catch (error) {
          setCashierName("Kasir");
        }
      } else {
        router.replace("/login"); 
      }
    });

    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, "settings", "store_config"));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (typeof data.taxRate === "number") setTaxPercentage(data.taxRate);
          if (typeof data.defaultDiscount === "number") setDefaultDiscount(data.defaultDiscount);
        }
      } catch (e) {
        console.error("Gagal memuat pengaturan toko:", e);
      }
    };
    fetchSettings();

    return () => unsubscribe();
  }, [router]);

  // --- 4. FETCH DATA KATALOG ---
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const data = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as Product[];

        setProducts(data);
        const uniqueCategories = Array.from(new Set(data.map(p => p.category)));
        setCategories(["Semua", ...uniqueCategories]);
      } catch (error) {
        console.error("Gagal memuat produk:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p => activeCategory === "Semua" || p.category === activeCategory);

  const generateTrxId = () => {
    const d = new Date();
    const datePart = `${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;
    const randomPart = Math.floor(1000 + Math.random() * 9000); 
    return `TRX-${datePart}-${randomPart}`;
  };

  useEffect(() => {
    if (cart.length > 0 && !currentTrxId) setCurrentTrxId(generateTrxId());
    else if (cart.length === 0) setCurrentTrxId(""); 
  }, [cart, currentTrxId]);

  // --- FUNGSI KERANJANG ---
  const handleProductClick = (product: Product) => {
    if (product.stock <= 0) return;
    setSelectedProduct(product);
    setTempQty(1); 
  };

  const confirmAddToCart = () => {
    if (!selectedProduct) return;
    const finalQty = typeof tempQty === "number" && tempQty > 0 ? tempQty : 1;

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === selectedProduct.id);
      const currentQtyInCart = existing ? existing.quantity : 0;
      
      if (currentQtyInCart + finalQty > selectedProduct.stock) {
        setModalMessage(`Gagal! Stok produk ini hanya tersisa ${selectedProduct.stock}.`);
        return prevCart; 
      }
      
      if (existing) {
        return prevCart.map((item) => item.id === selectedProduct.id ? { ...item, quantity: item.quantity + finalQty } : item);
      }
      return [...prevCart, { ...selectedProduct, quantity: finalQty }];
    });
    setSelectedProduct(null);
  };

  const handleDirectCartQtyChange = (id: string, newVal: string, maxStock: number) => {
    const val = parseInt(newVal);
    
    setCart((prevCart) => prevCart.map((item) => {
      if (item.id === id) {
        if (isNaN(val) || val < 1) {
          return { ...item, quantity: 1 };
        }
        if (val > maxStock) {
          setModalMessage(`Maksimal stok tercapai! Sisa stok hanya ${maxStock}.`);
          return { ...item, quantity: maxStock };
        }
        return { ...item, quantity: val };
      }
      return item;
    }));
  };

  const updateQuantityByButton = (id: string, delta: number) => {
    setCart((prevCart) => prevCart.map((item) => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        if (delta > 0 && newQty > item.stock) {
          setModalMessage(`Maksimal stok tercapai! Sisa stok hanya ${item.stock}.`);
          return item; 
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter((item) => item.quantity > 0));
  };

  const clearCart = () => setIsConfirmClearOpen(true);

  // --- KALKULASI ---
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const actualDiscount = Math.min(defaultDiscount, subTotal);
  const afterDiscount = subTotal - actualDiscount;
  const taxRateDecimal = taxPercentage / 100;
  const tax = afterDiscount * taxRateDecimal;
  const total = afterDiscount + tax;
  const change = paymentMethod === "Tunai" ? cashReceived - total : 0;

  const formatRupiah = (number: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(number);

  // --- CHECKOUT ---
  const handleCheckout = async () => {
    if (paymentMethod === "Tunai" && cashReceived < total) {
      setModalMessage("Uang tunai yang diterima kurang dari total tagihan!");
      return;
    }

    setIsProcessing(true);
    const txData = {
      transactionId: currentTrxId, 
      status: "Berhasil", 
      items: cart,
      subTotal, discount: actualDiscount, tax, total, 
      paymentMethod, cashReceived: paymentMethod === "Tunai" ? cashReceived : total, change,
      kasir: cashierName, dateString: new Date().toLocaleString("id-ID")
    };

    try {
      if (isOnline) {
        const docRef = await addDoc(collection(db, "transactions"), { ...txData, timestamp: serverTimestamp() });
        const batch = writeBatch(db);
        cart.forEach((item) => {
          const productRef = doc(db, "products", item.id);
          batch.update(productRef, { stock: increment(-item.quantity) }); 
        });
        await batch.commit();

        await addDoc(collection(db, "activity_logs"), {
          user: cashierName, role: "kasir", action: "Membuat Transaksi Baru",
          details: `ID Struk: ${currentTrxId} | Total: Rp ${total}`, timestamp: serverTimestamp()
        });
        setLastTransaction({ ...txData, id: docRef.id });
      } else {
        const offlineTransactions = JSON.parse(localStorage.getItem("pos_offline_tx") || "[]");
        const offlineRecord = { ...txData, timestampFallback: new Date().toISOString() };
        offlineTransactions.push(offlineRecord);
        localStorage.setItem("pos_offline_tx", JSON.stringify(offlineTransactions));
        
        setOfflineQueueCount(offlineTransactions.length);
        setLastTransaction({ ...offlineRecord, id: currentTrxId }); 
      }
      setIsPaymentModalOpen(false);
      setIsMobileCartOpen(false); // Tutup drawer jika transaksi sukses (khusus mobile)
      setIsSuccessModalOpen(true);
    } catch (error) {
      setModalMessage("Gagal memproses transaksi. Silakan coba lagi.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinishTransaction = async () => {
    const savedCart = [...cart]; 
    setCart([]); setCashReceived(0); setPaymentMethod("Tunai");
    setIsSuccessModalOpen(false); setLastTransaction(null);

    if (isOnline) {
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        setProducts(querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Product[]);
      } catch (e) {
        console.error(e);
      }
    } else {
      setProducts(prevProducts => prevProducts.map(p => {
        const boughtItem = savedCart.find(c => c.id === p.id);
        if (boughtItem) return { ...p, stock: p.stock - boughtItem.quantity };
        return p;
      }));
    }
  };

  const handleLogoutClick = () => setIsConfirmLogoutOpen(true);
  const executeLogout = async () => {
    if (offlineQueueCount > 0) {
      alert("TIDAK BISA KELUAR! Sinkronkan transaksi offline terlebih dahulu.");
      return;
    }
    await signOut(auth); router.replace("/login");
  };

  const submitVoidTransaction = async () => {
    if (adminPin === "123456") {
      try {
        if (lastTransaction?.id && isOnline) {
          await updateDoc(doc(db, "transactions", lastTransaction.id), {
            status: "Dibatalkan (Void)", voidedAt: serverTimestamp(), voidedBy: "Admin"
          });

          if (lastTransaction.items && lastTransaction.items.length > 0) {
            const batch = writeBatch(db);
            lastTransaction.items.forEach((item: any) => {
              const productRef = doc(db, "products", item.id);
              batch.update(productRef, { stock: increment(item.quantity) }); 
            });
            await batch.commit();
          }

          setModalMessage("Transaksi dibatalkan! Stok dikembalikan.");
          const querySnapshot = await getDocs(collection(db, "products"));
          setProducts(querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Product[]);
        } else if (!isOnline) setModalMessage("Void tidak bisa saat offline.");

        setIsVoidModalOpen(false); setIsSuccessModalOpen(false);
        setLastTransaction(null); setAdminPin("");
      } catch (error) {
        setModalMessage("Gagal membatalkan transaksi.");
      }
    } else {
      setModalMessage("PIN Salah!"); setAdminPin("");
    }
  };

  return (
    <div className="flex h-screen bg-zinc-100 overflow-hidden font-sans selection:bg-blue-200 relative">

      {/* ================= AREA KIRI (Katalog) ================= */}
      <div className="flex-1 flex flex-col no-print w-full lg:w-auto">
        <header className="bg-slate-900 shadow-md px-4 sm:px-6 py-4 flex justify-between items-center z-10 text-white">
          <div className="flex items-center gap-2 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">TELEMEDIA.ID</h1>
              <p className="text-xs text-slate-400 mt-1 font-medium hidden sm:block">Kasir Aktif: <span className="text-white font-bold uppercase">{cashierName}</span></p>
            </div>
            
            <div className="flex items-center ml-2">
              <span className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all ${isOnline ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                {isOnline ? "🟢 Online" : "🔴 Offline"}
              </span>
              
              {offlineQueueCount > 0 && (
                <button 
                  onClick={syncOfflineTransactions} disabled={!isOnline}
                  className={`ml-2 sm:ml-3 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold border transition-all ${
                    isOnline ? 'bg-amber-500 text-white border-amber-600 animate-pulse' : 'bg-zinc-800 text-amber-500 border-amber-900/50 opacity-80'
                  }`}
                >
                  ⏳ {offlineQueueCount} Sync
                </button>
              )}
            </div>
          </div>

          <button onClick={handleLogoutClick} className="px-3 py-2 text-xs sm:text-sm font-semibold text-white bg-red-600/80 rounded-lg hover:bg-red-600 transition-colors">
            Keluar
          </button>
        </header>

        <div className="px-4 sm:px-6 py-3 bg-white border-b flex gap-2 sm:gap-3 overflow-x-auto no-scrollbar shadow-sm z-0">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-full whitespace-nowrap text-xs sm:text-sm font-bold transition-all ${
                activeCategory === cat ? "bg-blue-600 text-white shadow-md" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-6">
          {loading ? (
            <div className="flex justify-center items-center h-full text-zinc-500 font-medium">Memuat Menu...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
              {filteredProducts.map((product) => {
                const isOutOfStock = (product.stock || 0) <= 0;

                return (
                  <button 
                    key={product.id} 
                    onClick={() => handleProductClick(product)}
                    disabled={isOutOfStock}
                    className={`flex flex-col h-40 bg-white border border-zinc-200 rounded-2xl shadow-sm transition-all overflow-hidden text-left relative ${
                      isOutOfStock ? "opacity-50 grayscale cursor-not-allowed" : "hover:border-blue-400 hover:shadow-md active:scale-95"
                    }`}
                  >
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-white/40 flex items-center justify-center z-10">
                        <span className="bg-red-500 text-white text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full shadow-sm rotate-[-12deg]">HABIS</span>
                      </div>
                    )}
                    <div className={`h-20 w-full ${product.color || 'bg-zinc-200'}`}></div>
                    <div className="p-2 sm:p-3 flex flex-col justify-between flex-1">
                      <span className="font-bold text-xs sm:text-sm text-zinc-800 leading-tight line-clamp-2">{product.name}</span>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-blue-600 font-extrabold text-sm sm:text-base">{formatRupiah(product.price)}</span>
                        <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded ${isOutOfStock ? 'bg-red-100 text-red-600' : 'bg-zinc-100 text-zinc-500'}`}>
                          Stok: {product.stock || 0}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= FLOATING TOMBOL KERANJANG MOBILE ================= */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-30 no-print">
        <button 
          onClick={() => setIsMobileCartOpen(true)}
          className="w-full bg-blue-600 text-white rounded-2xl p-4 shadow-[0_10px_25px_-5px_rgba(37,99,235,0.5)] flex justify-between items-center active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/20 px-3 py-1 rounded-lg font-bold">
              {totalItems} Item
            </div>
          </div>
          <div className="text-lg font-extrabold flex items-center gap-2">
            {formatRupiah(total)}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </button>
      </div>

      {/* BACKDROP UNTUK KERANJANG DI MOBILE */}
      {isMobileCartOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileCartOpen(false)}
        />
      )}

      {/* ================= AREA KANAN (Keranjang) ================= */}
      <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-slate-900 flex flex-col shadow-2xl no-print text-white border-l border-slate-800 transition-transform duration-300 transform lg:relative lg:translate-x-0 ${isMobileCartOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-start bg-slate-900">
          <div>
            <h2 className="text-lg font-extrabold text-white">Pesanan Saat Ini</h2>
            {currentTrxId && <p className="text-xs font-mono font-medium text-slate-400 mt-1">ID: {currentTrxId}</p>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={clearCart} disabled={cart.length === 0} className="text-sm font-bold text-red-400 hover:text-red-300 disabled:opacity-50">Kosongkan</button>
            <button onClick={() => setIsMobileCartOpen(false)} className="lg:hidden w-8 h-8 flex items-center justify-center bg-slate-800 rounded-full text-slate-300">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900/90">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 font-medium">
              <p>Belum ada item dipilih</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="p-4 bg-slate-800 border border-slate-700 rounded-xl flex flex-col shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <span className="font-bold text-slate-100 text-sm max-w-[65%]">{item.name}</span>
                  <span className="font-extrabold text-white text-sm">{formatRupiah(item.price * item.quantity)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{formatRupiah(item.price)} / item</span>
                  <div className="flex items-center gap-1.5 bg-slate-700 rounded-lg p-1">
                    <button onClick={() => updateQuantityByButton(item.id, -1)} className="w-7 h-7 rounded bg-slate-600 text-white font-bold active:scale-95 hover:bg-slate-500 flex items-center justify-center">-</button>
                    <input 
                      type="number" 
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleDirectCartQtyChange(item.id, e.target.value, item.stock)}
                      className="w-12 h-7 bg-slate-800 text-white font-bold text-center text-sm border border-slate-600 rounded focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button onClick={() => updateQuantityByButton(item.id, 1)} className="w-7 h-7 rounded bg-blue-500 text-white font-bold active:scale-95 hover:bg-blue-400 flex items-center justify-center">+</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-900 border-t border-slate-800 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
          <div className="space-y-2 mb-5">
            <div className="flex justify-between text-slate-400 text-sm font-medium"><span>Subtotal</span><span>{formatRupiah(subTotal)}</span></div>
            {actualDiscount > 0 && (
              <div className="flex justify-between text-amber-400 text-sm font-medium"><span>Diskon Toko</span><span>- {formatRupiah(actualDiscount)}</span></div>
            )}
            <div className="flex justify-between text-slate-400 text-sm font-medium"><span>PPN ({taxPercentage}%)</span><span>{formatRupiah(tax)}</span></div>
            <div className="flex justify-between text-2xl font-extrabold text-white pt-3 border-t border-slate-700 mt-2">
              <span>Total</span>
              <span className="text-blue-400">{formatRupiah(total)}</span>
            </div>
          </div>
          <button
            onClick={() => { setCashReceived(total); setIsPaymentModalOpen(true); }}
            disabled={cart.length === 0}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold rounded-xl text-lg shadow-lg disabled:opacity-50 transition-all"
          >
            Lanjut Pembayaran
          </button>
        </div>
      </div>

      {/* ================= MODAL QTY POP-UP (KOLOM KETIK) ================= */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-200">
            {/* ... Modal Konten Qty tidak berubah secara struktur, hanya ditambah p-4 di wrapper parent */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-extrabold text-zinc-900">{selectedProduct.name}</h3>
              <p className="text-blue-600 font-bold text-lg">{formatRupiah(selectedProduct.price)}</p>
              <p className="text-xs text-zinc-500 font-medium mt-1">Sisa Stok: {selectedProduct.stock}</p>
            </div>

            <div className="flex items-center justify-center gap-4 mb-6">
              <button 
                onClick={() => setTempQty(typeof tempQty === "number" ? Math.max(1, tempQty - 1) : 1)} 
                className="w-14 h-14 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-2xl transition-colors active:scale-95 flex items-center justify-center"
              >
                -
              </button>
              
              <input 
                type="number" min="1" value={tempQty}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (isNaN(val)) {
                    setTempQty(""); 
                  } else if (val > selectedProduct.stock) {
                    setTempQty(selectedProduct.stock);
                    setModalMessage(`Maksimal stok tercapai! Sisa stok hanya ${selectedProduct.stock}.`);
                  } else {
                    setTempQty(val);
                  }
                }}
                className="w-24 text-5xl font-extrabold text-zinc-900 text-center border-b-2 border-zinc-300 focus:border-blue-600 focus:outline-none bg-transparent pb-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />

              <button 
                onClick={() => {
                  const existingItem = cart.find(i => i.id === selectedProduct.id);
                  const inCart = existingItem ? existingItem.quantity : 0;
                  const currentVal = typeof tempQty === "number" ? tempQty : 0;
                  if (currentVal + inCart >= selectedProduct.stock) {
                    setModalMessage(`Mentok! Stok sisa ${selectedProduct.stock}`);
                  } else {
                    setTempQty(currentVal + 1);
                  }
                }} 
                className="w-14 h-14 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold text-2xl transition-colors active:scale-95 flex items-center justify-center"
              >
                +
              </button>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setSelectedProduct(null)} className="flex-1 py-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-xl transition-colors">Batal</button>
              <button 
                onClick={confirmAddToCart} disabled={tempQty === "" || tempQty < 1}
                className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-md active:scale-95"
              >
                Tambahkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL PEMBAYARAN ================= */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-900 text-white text-center relative shrink-0">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Tagihan</h3>
              <div className="text-3xl sm:text-4xl font-extrabold text-blue-400">{formatRupiah(total)}</div>
            </div>

            <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
              <h4 className="font-bold text-zinc-800 mb-3 text-sm uppercase tracking-wider">Metode Pembayaran</h4>
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
                {["Tunai", "QRIS", "Kartu"].map((method) => (
                  <button key={method} onClick={() => setPaymentMethod(method as any)}
                    className={`py-2 sm:py-3 rounded-xl text-sm sm:text-base font-bold border-2 transition-all ${paymentMethod === method ? "border-blue-600 bg-blue-50 text-blue-700" : "border-zinc-200 text-zinc-500"}`}
                  >
                    {method}
                  </button>
                ))}
              </div>

              {paymentMethod === "Tunai" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Uang Diterima</label>
                    <input
                      type="number" value={cashReceived || ""} onChange={(e) => setCashReceived(Number(e.target.value))}
                      className="w-full text-2xl sm:text-3xl font-extrabold px-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl text-zinc-900 focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <button onClick={() => setCashReceived(total)} className="py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-[10px] sm:text-sm font-bold text-zinc-700">Pas</button>
                    <button onClick={() => setCashReceived(20000)} className="py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-[10px] sm:text-sm font-bold text-zinc-700">20rb</button>
                    <button onClick={() => setCashReceived(50000)} className="py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-[10px] sm:text-sm font-bold text-zinc-700">50rb</button>
                    <button onClick={() => setCashReceived(100000)} className="py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-[10px] sm:text-sm font-bold text-zinc-700">100rb</button>
                  </div>

                  <div className="flex justify-between items-center p-3 sm:p-4 bg-zinc-100 rounded-xl mt-4">
                    <span className="font-bold text-zinc-600 text-sm sm:text-base">Kembalian</span>
                    <span className={`font-extrabold text-lg sm:text-xl ${change < 0 ? 'text-red-500' : 'text-zinc-900'}`}>
                      {change < 0 ? "Kurang" : formatRupiah(change)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-200 flex gap-3 shrink-0">
              <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-3 sm:py-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-xl transition-all">
                Batal
              </button>
              <button onClick={handleCheckout} disabled={isProcessing || (paymentMethod === "Tunai" && cashReceived < total)}
                className="flex-1 py-3 sm:py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-xl transition-all"
              >
                {isProcessing ? "Proses..." : "Bayar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL LAINNYA (Success, Void, Confirm) ================= */}
      {/* Struktur pop up notif/void dibuat p-4 parent agar tidak tertutup layar penuh di hp kecil */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 bg-slate-900/90 z-[300] flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="bg-white p-6 sm:p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center flex flex-col items-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 mb-1">
              {lastTransaction?.timestampFallback ? "Tersimpan Offline!" : "Transaksi Berhasil!"}
            </h2>
            <p className="text-xs font-mono font-bold text-zinc-400 mb-2">{lastTransaction?.transactionId}</p>
            <p className="text-zinc-500 font-medium mb-6">Kembalian: <span className="text-zinc-900 font-bold">{formatRupiah(lastTransaction?.change || 0)}</span></p>

            <div className="w-full space-y-2 sm:space-y-3">
              <button onClick={() => window.print()} className="w-full py-3 sm:py-4 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Cetak Struk
              </button>
              <button onClick={handleFinishTransaction} className="w-full py-3 sm:py-4 bg-zinc-100 hover:bg-zinc-200 active:scale-95 text-zinc-800 font-bold rounded-xl transition-all">
                Selesai (Baru)
              </button>
              <button onClick={() => setIsVoidModalOpen(true)} className="w-full py-2 sm:py-3 mt-1 sm:mt-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold rounded-xl transition-all">
                Batalkan (Void)
              </button>
            </div>
          </div>
        </div>
      )}

      {isVoidModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[400] flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-900 mb-2">Void Transaksi</h3>
            <input 
              type="password" placeholder="PIN Admin" value={adminPin} onChange={(e) => setAdminPin(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-100 border border-zinc-300 rounded-xl text-center font-bold tracking-widest text-lg focus:outline-none focus:border-red-500 mb-6"
            />
            <div className="flex gap-3">
              <button onClick={() => { setIsVoidModalOpen(false); setAdminPin(""); }} className="flex-1 py-3 sm:py-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl">Batal</button>
              <button onClick={submitVoidTransaction} className="flex-1 py-3 sm:py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md">Otorisasi</button>
            </div>
          </div>
        </div>
      )}

      {modalMessage && (
        <div className="fixed inset-0 bg-black/60 z-[500] flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-xl">i</div>
            <h3 className="text-lg font-extrabold text-zinc-900 mb-2">Perhatian</h3>
            <p className="text-sm text-zinc-600 mb-6">{modalMessage}</p>
            <button onClick={() => setModalMessage(null)} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md active:scale-95">OK</button>
          </div>
        </div>
      )}

      {isConfirmClearOpen && (
        <div className="fixed inset-0 bg-black/60 z-[500] flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-extrabold text-zinc-900 mb-2">Kosongkan Keranjang</h3>
            <p className="text-sm text-zinc-600 mb-6">Yakin ingin menghapus semua item dalam pesanan saat ini?</p>
            <div className="flex gap-3">
              <button onClick={() => setIsConfirmClearOpen(false)} className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl transition-all">Tidak</button>
              <button onClick={() => { setCart([]); setIsConfirmClearOpen(false); }} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all">Ya, Kosongkan</button>
            </div>
          </div>
        </div>
      )}

      {isConfirmLogoutOpen && (
        <div className="fixed inset-0 bg-black/60 z-[500] flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-extrabold text-zinc-900 mb-2">Keluar Aplikasi</h3>
            <p className="text-sm text-zinc-600 mb-6">Yakin ingin keluar dari layar kasir?</p>
            <div className="flex gap-3">
              <button onClick={() => setIsConfirmLogoutOpen(false)} className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl transition-all">Tidak</button>
              <button onClick={executeLogout} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all">Ya, Keluar</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= KOMPONEN STRUK THERMAL ================= */}
      <Receipt data={lastTransaction} />

    </div>
  );
}