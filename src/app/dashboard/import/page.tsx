"use client";

import { useState, useRef } from "react";
import { collection, doc, writeBatch, serverTimestamp, addDoc } from "firebase/firestore";
import { db } from "../../../config/firebase";
import * as XLSX from "xlsx";

interface MappedRow {
  _docId: string | null;
  _row: number;
  _errors: string[];
  [key: string]: any;
}

export default function ImportPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [fileMeta, setFileMeta] = useState("");
  
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  
  // State Target Koleksi Firestore
  const [targetCollection, setTargetCollection] = useState("products");
  
  // State Mapping Dinamis (Menyimpan { targetField: string, type: 'string' | 'number' })
  const [columnMapping, setColumnMapping] = useState<Record<string, { field: string; type: string }>>({});
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  
  const [isImporting, setIsImporting] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressText, setProgressText] = useState("Siap diimport");
  const [logs, setLogs] = useState<{ text: string; type: "ok" | "err" | "inf" }[]>();
  const [importResult, setImportResult] = useState<{ ok: number; fail: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Daftar Field Standar untuk Koleksi "products"
  const standardProductFields = [
    { value: "__skip__", label: "— Lewati (Skip) —" },
    { value: "name", label: "Nama Produk (name)" },
    { value: "price", label: "Harga (price)" },
    { value: "stock", label: "Stok (stock)" },
    { value: "category", label: "Kategori (category)" },
    { value: "color", label: "Warna Label (color)" },
  ];

  // --- HANDLE FILE UPLOAD ---
  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      alert("Format file tidak didukung! Gunakan .xlsx, .xls, atau .csv");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dataBuffer = e.target?.result;
        const wb = XLSX.read(dataBuffer, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];

        if (json.length === 0) {
          alert("File kosong atau format tidak valid!");
          return;
        }

        setRawData(json);
        const fileHeaders = Object.keys(json[0]);
        setHeaders(fileHeaders);

        setFileName(file.name);
        setFileMeta(`${json.length} baris • ${fileHeaders.length} kolom • ${(file.size / 1024).toFixed(1)} KB`);
        setCurrentStep(2);
      } catch (err: any) {
        alert("Gagal membaca file: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const clearFile = () => {
    setRawData([]);
    setHeaders([]);
    setFileName("");
    setFileMeta("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setCurrentStep(1);
  };

  // --- SETUP MAPPING DINAMIS DENGAN AUTODETECT ---
  const prepareMappingUI = () => {
    if (!targetCollection.trim()) {
      alert("Nama koleksi Firestore wajib diisi!");
      return;
    }

    const initialMapping: Record<string, { field: string; type: string }> = {};
    
    headers.forEach(h => {
      const headerLower = h.toLowerCase().trim();
      let targetField = "__skip__";
      let type = "string";

      if (targetCollection === "products") {
        if (headerLower.includes("nama") || headerLower.includes("name")) targetField = "name";
        else if (headerLower.includes("harga") || headerLower.includes("price")) { targetField = "price"; type = "number"; }
        else if (headerLower.includes("stok") || headerLower.includes("stock")) { targetField = "stock"; type = "number"; }
        else if (headerLower.includes("kategori") || headerLower.includes("category")) targetField = "category";
        else if (headerLower.includes("warna") || headerLower.includes("color")) targetField = "color";
      } else {
        targetField = headerLower.replace(/\s+/g, "_");
        if (headerLower.includes("harga") || headerLower.includes("price") || headerLower.includes("stok") || headerLower.includes("total") || headerLower.includes("qty")) {
          type = "number";
        }
      }

      initialMapping[h] = { field: targetField, type: type };
    });
    
    setColumnMapping(initialMapping);
    setCurrentStep(3);
  };

  // --- BUILD PREVIEW DENGAN KONVERSI TIPE DATA ---
  const buildPreview = () => {
    const rows: MappedRow[] = rawData.map((row, i) => {
      const out: any = {};
      const errors: string[] = [];

      if (targetCollection === "products") {
        out.category = "Umum";
        out.color = "bg-zinc-100";
      }

      for (const [excelCol, mappingConfig] of Object.entries(columnMapping)) {
        const { field: dbField, type } = mappingConfig;
        
        if (!dbField || dbField === "__skip__") continue;
        
        let val = row[excelCol] ?? "";
        
        if (type === "number") {
          const numVal = Number(val);
          if (isNaN(numVal)) {
            errors.push(`${dbField} bukan angka valid`);
            out[dbField] = 0; 
          } else {
            out[dbField] = numVal;
          }
        } else {
          out[dbField] = String(val).trim();
        }
      }

      if (targetCollection === "products") {
        if (!out.name) errors.push("Nama produk kosong");
        if (out.price === undefined) errors.push("Harga kosong");
      }

      return { _docId: null, _row: i + 2, _errors: errors, ...out };
    });

    setMappedRows(rows);
    setCurrentStep(4);
  };

  // --- START IMPORT KE FIRESTORE ---
  const startImport = async () => {
    const collName = targetCollection.trim();
    if (!collName) {
      alert("Nama koleksi tujuan belum diisi!");
      return;
    }

    setIsImporting(true);
    setLogs([{ text: `📦 Koleksi target: ${collName} | Total: ${mappedRows.length} baris`, type: "inf" }]);
    setProgressPct(0);

    let ok = 0;
    let fail = 0;
    const BATCH_SIZE = 499;

    for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
      const chunk = mappedRows.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      chunk.forEach(row => {
        const { _docId, _row, _errors, ...data } = row;
        const ref = doc(collection(db, collName));
        batch.set(ref, data);
      });

      try {
        await batch.commit();
        ok += chunk.length;
        setLogs(prev => [...(prev || []), { text: `✅ Berhasil mengimport ${chunk.length} data ke koleksi '${collName}'`, type: "ok" }]);
      } catch (err: any) {
        fail += chunk.length;
        setLogs(prev => [...(prev || []), { text: `❌ Gagal batch: ${err.message}`, type: "err" }]);
      }

      const pct = Math.round(((i + chunk.length) / mappedRows.length) * 100);
      setProgressPct(pct);
      setProgressText(`${Math.min(i + BATCH_SIZE, mappedRows.length)} dari ${mappedRows.length} diproses...`);
    }

    try {
      await addDoc(collection(db, "activity_logs"), {
        user: "Admin",
        role: "admin",
        action: "Import Data Excel",
        details: `Mengimport ${ok} data ke koleksi '${collName}'`,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }

    setIsImporting(false);
    setImportResult({ ok, fail });
    setCurrentStep(5);
  };

  const errCount = mappedRows.filter(r => r._errors.length > 0).length;
  const okCount = mappedRows.length - errCount;

  return (
    <div className="space-y-6 font-sans">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Import Data Universal</h1>
          <p className="text-sm text-zinc-500 mt-1">Upload file Excel atau CSV untuk diimport ke tabel/koleksi apa saja di Firestore.</p>
        </div>
      </div>

      {/* STEPPER */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm overflow-x-auto">
        {[
          { num: 1, label: "Upload File" },
          { num: 2, label: "Pilih Koleksi" },
          { num: 3, label: "Mapping Kolom" },
          { num: 4, label: "Preview Data" },
          { num: 5, label: "Selesai" },
        ].map((s, idx) => (
          <div key={s.num} className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              currentStep === s.num ? "bg-zinc-900 text-white shadow-sm" :
              currentStep > s.num ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-400 border border-zinc-200"
            }`}>
              {currentStep > s.num ? "✓" : s.num}
            </div>
            <span className={`text-xs font-semibold hidden sm:inline ${currentStep === s.num ? "text-zinc-900" : "text-zinc-400"}`}>
              {s.label}
            </span>
            {idx < 4 && <div className="w-6 sm:w-12 h-0.5 bg-zinc-200 mx-1"></div>}
          </div>
        ))}
      </div>

      {/* PANEL 1: UPLOAD */}
      {currentStep === 1 && (
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-8 text-center space-y-6">
          <div className="border-2 border-dashed border-zinc-200 hover:border-zinc-400 rounded-2xl p-10 cursor-pointer bg-zinc-50/50 transition-all relative">
            <input 
              type="file" 
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv" 
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
            />
            <div className="text-4xl mb-3">📊</div>
            <h3 className="font-bold text-zinc-800 text-base">Seret file ke sini atau klik untuk upload</h3>
            <p className="text-xs text-zinc-500 mt-1">Mendukung format .xlsx, .xls, dan .csv</p>
          </div>
        </div>
      )}

      {/* PANEL 2: PILIH / KETIK KOLEKSI FIRESTORE */}
      {currentStep === 2 && (
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-zinc-900">Tentukan Target Koleksi Firestore</h3>
            <p className="text-xs text-zinc-500 mt-0.5">File terpilih: <span className="font-semibold text-zinc-800">{fileName} ({fileMeta})</span></p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5 ml-1">Pilih Koleksi Umum atau Ketik Sendiri</label>
              <select 
                value={targetCollection}
                onChange={(e) => setTargetCollection(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-800 focus:outline-none focus:border-zinc-400 cursor-pointer mb-3"
              >
                <option value="products">📦 products (Stok Produk)</option>
                <option value="transactions">📈 transactions (Riwayat Transaksi)</option>
                <option value="users">👥 users (Data Pengguna / Kasir)</option>
                <option value="activity_logs">📋 activity_logs (Log Aktivitas)</option>
              </select>

              <input 
                type="text" 
                placeholder="Atau ketik nama koleksi bebas (misal: categories, vouchers)..." 
                value={targetCollection}
                onChange={(e) => setTargetCollection(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-800 focus:outline-none focus:border-zinc-400"
              />
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-zinc-100">
            <button onClick={clearFile} className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold text-sm rounded-xl transition-colors">← Ganti File</button>
            <button onClick={prepareMappingUI} className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm rounded-xl shadow-sm transition-all">Lanjut Mapping Kolom →</button>
          </div>
        </div>
      )}

      {/* PANEL 3: MAPPING KOLOM (PILIHAN DARI DROPDOWN) */}
      {currentStep === 3 && (
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-zinc-900">Mapping Kolom ke Database ({targetCollection})</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Pilih nama field database untuk kolom Excel Anda. Pastikan tipe datanya juga benar.</p>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {headers.map((excelCol) => (
              <div key={excelCol} className="grid grid-cols-1 md:grid-cols-3 items-center gap-4 bg-zinc-50/50 p-4 rounded-xl border border-zinc-200/60">
                <div className="md:col-span-1">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Kolom Excel</p>
                  <p className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg inline-block">{excelCol}</p>
                </div>
                
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Pilih Field Firestore</label>
                  
                  {targetCollection === "products" ? (
                    // Jika koleksi products, tampilkan dropdown pilihan baku
                    <select
                      value={columnMapping[excelCol]?.field || "__skip__"}
                      onChange={(e) => {
                        const newField = e.target.value;
                        const autoType = (newField === "price" || newField === "stock") ? "number" : "string";
                        setColumnMapping({ 
                          ...columnMapping, 
                          [excelCol]: { field: newField, type: autoType } 
                        });
                      }}
                      className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-800 focus:outline-none cursor-pointer"
                    >
                      {standardProductFields.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    // Jika koleksi lain, bebas input teks
                    <input 
                      type="text" 
                      value={columnMapping[excelCol]?.field || ""}
                      onChange={(e) => setColumnMapping({ 
                        ...columnMapping, 
                        [excelCol]: { ...columnMapping[excelCol], field: e.target.value } 
                      })}
                      placeholder="Ketik field tujuan..."
                      className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-800 focus:outline-none"
                    />
                  )}
                </div>

                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Format Data</label>
                  <select
                    value={columnMapping[excelCol]?.type || "string"}
                    onChange={(e) => setColumnMapping({ 
                      ...columnMapping, 
                      [excelCol]: { ...columnMapping[excelCol], type: e.target.value } 
                    })}
                    className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-800 focus:outline-none cursor-pointer"
                  >
                    <option value="string">Teks (String)</option>
                    <option value="number">Angka (Number)</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4 border-t border-zinc-100">
            <button onClick={() => setCurrentStep(2)} className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold text-sm rounded-xl transition-colors">← Kembali</button>
            <button onClick={buildPreview} className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm rounded-xl shadow-sm transition-all">Preview Data →</button>
          </div>
        </div>
      )}

      {/* PANEL 4: PREVIEW */}
      {currentStep === 4 && (
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
              <p className="text-2xl font-extrabold text-zinc-900">{mappedRows.length}</p>
              <p className="text-xs font-bold text-zinc-500 mt-1">Total Baris</p>
            </div>
            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200/60">
              <p className="text-2xl font-extrabold text-emerald-600">{okCount}</p>
              <p className="text-xs font-bold text-emerald-600 mt-1">Siap Import</p>
            </div>
            <div className="bg-red-50/50 p-4 rounded-2xl border border-red-200/60">
              <p className="text-2xl font-extrabold text-red-600">{errCount}</p>
              <p className="text-xs font-bold text-red-600 mt-1">Bermasalah</p>
            </div>
          </div>

          <div className="border border-zinc-200 rounded-xl overflow-x-auto max-h-[350px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-zinc-50 sticky top-0 border-b border-zinc-200">
                <tr>
                  <th className="p-3 font-semibold text-zinc-500">#</th>
                  {Object.values(columnMapping).filter(v => v.field && v.field !== "__skip__").map(config => (
                    <th key={config.field} className="p-3 font-semibold text-zinc-500 uppercase">{config.field} <span className="lowercase font-normal text-zinc-400">({config.type})</span></th>
                  ))}
                  <th className="p-3 font-semibold text-zinc-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {mappedRows.slice(0, 50).map((r, idx) => (
                  <tr key={idx} className={r._errors.length > 0 ? "bg-red-50/40" : "hover:bg-zinc-50"}>
                    <td className="p-3 text-zinc-400">{r._row}</td>
                    {Object.values(columnMapping).filter(v => v.field && v.field !== "__skip__").map(config => (
                      <td key={config.field} className="p-3 font-medium text-zinc-800">{String(r[config.field] ?? "")}</td>
                    ))}
                    <td className="p-3">
                      {r._errors.length === 0 ? <span className="text-emerald-600 font-bold">✅ OK</span> : <span className="text-red-600 font-bold">⚠️ {r._errors.join(", ")}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between pt-4 border-t border-zinc-100">
            <button onClick={() => setCurrentStep(3)} className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold text-sm rounded-xl transition-colors">← Kembali</button>
            <button onClick={startImport} disabled={isImporting || okCount === 0} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold text-sm rounded-xl shadow-sm transition-all">🚀 Mulai Import Data</button>
          </div>
        </div>
      )}

      {/* PANEL 5: PROSES & SELESAI */}
      {currentStep === 5 && (
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6 space-y-6 text-center">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Proses Import Data Selesai</h3>
            <p className="text-xs text-zinc-500 mt-1">{progressText}</p>
          </div>

          <div className="w-full bg-zinc-100 h-3 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${progressPct}%` }}></div>
          </div>

          <div className="bg-slate-900 text-left p-4 rounded-xl font-mono text-xs text-emerald-400 max-h-48 overflow-y-auto space-y-1">
            {logs?.map((l, idx) => (
              <div key={idx} className={l.type === 'err' ? 'text-red-400' : l.type === 'inf' ? 'text-slate-400' : 'text-emerald-400'}>
                {l.text}
              </div>
            ))}
          </div>

          {importResult && (
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-800">
              🎉 Berhasil mengimport <span className="text-emerald-600">{importResult.ok}</span> data ke koleksi <span className="underline">{targetCollection}</span>.
            </div>
          )}

          <div className="pt-4 border-t border-zinc-100 flex justify-center">
            <button onClick={() => { clearFile(); setCurrentStep(1); setImportResult(null); }} className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm rounded-xl shadow-sm transition-all">
              📂 Import File Lainnya
            </button>
          </div>
        </div>
      )}

    </div>
  );
}