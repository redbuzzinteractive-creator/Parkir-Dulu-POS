import React, { useState } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Plus, Calendar, 
  ShoppingBag, ClipboardList, Wallet, FileSpreadsheet, HelpCircle,
  CheckCircle2, ArrowRight
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, BarChart, Bar 
} from 'recharts';
import { Transaction, RawMaterial, Product, AttendanceLog, OperationalExpense, ExpenseCategory } from '../types';
import { User } from 'firebase/auth';
import { createAndPopulateSpreadsheet } from '../lib/googleSheets';
import { downloadExcelReport } from '../lib/excelExport';

interface ReportsTabProps {
  transactions: Transaction[];
  rawMaterials: RawMaterial[];
  products: Product[];
  attendanceLogs: AttendanceLog[];
  expenses: OperationalExpense[];
  onAddExpense: (expenseData: { category: ExpenseCategory; amount: number; description: string; date?: string }) => Promise<void>;
  user: User | null;
  token: string | null;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  transactions,
  rawMaterials,
  products,
  attendanceLogs,
  expenses,
  onAddExpense,
  user,
  token
}) => {
  // Google Sheets Export States
  const [isExportingSheet, setIsExportingSheet] = useState(false);
  const [exportedSheetUrl, setExportedSheetUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Expense Logging Form State
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('utility');
  const [expDesc, setExpDesc] = useState('');
  const [expDate, setExpDate] = useState('2026-07-03');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  // Helper: Calculate exact HPP (COGS) for a specific transaction
  const calculateTransactionHpp = (tx: Transaction): number => {
    let txHpp = 0;
    for (const item of tx.items) {
      const prod = products.find(p => p.id === item.productId);
      if (prod && prod.ingredients) {
        let itemIngredientsCost = 0;
        for (const ing of prod.ingredients) {
          const mat = rawMaterials.find(m => m.id === ing.materialId);
          if (mat) {
            itemIngredientsCost += ing.quantityNeeded * mat.unitCost;
          }
        }
        txHpp += itemIngredientsCost * item.quantity;
      }
    }
    return txHpp;
  };

  // 1. Calculate General Financial Aggregates
  const successfulTx = transactions.filter(t => t.paymentStatus === 'success');
  const totalRevenue = successfulTx.reduce((sum, t) => sum + t.totalAmount, 0);
  
  // Calculate COGS / HPP
  const totalHpp = successfulTx.reduce((sum, tx) => sum + calculateTransactionHpp(tx), 0);
  
  // Calculate Operational Expenses
  const totalOpExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Total expenses overall (COGS + Ops)
  const totalExpensesCombined = totalHpp + totalOpExpenses;
  const netProfit = totalRevenue - totalExpensesCombined;

  // 2. Format Chart Data Grouped By Date
  const getChartData = () => {
    const dates = Array.from(new Set([
      ...successfulTx.map(t => t.timestamp.substring(0, 10)),
      ...expenses.map(e => e.date)
    ])).sort();

    return dates.map(date => {
      // Sales on this date
      const daySales = successfulTx
        .filter(t => t.timestamp.startsWith(date))
        .reduce((sum, t) => sum + t.totalAmount, 0);

      // COGS on this date
      const dayHpp = successfulTx
        .filter(t => t.timestamp.startsWith(date))
        .reduce((sum, tx) => sum + calculateTransactionHpp(tx), 0);

      // Ops Expenses on this date
      const dayOps = expenses
        .filter(e => e.date === date)
        .reduce((sum, e) => sum + e.amount, 0);

      const combinedExp = dayHpp + dayOps;
      const profit = daySales - combinedExp;

      // Format date for display (e.g., 03 Jul)
      const dayParts = date.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const formattedDate = dayParts.length === 3 
        ? `${parseInt(dayParts[2])} ${months[parseInt(dayParts[1]) - 1]}` 
        : date;

      return {
        dateLabel: formattedDate,
        'Pendapatan': daySales,
        'HPP (Bahan Baku)': dayHpp,
        'Operasional': dayOps,
        'Laba Bersih': profit
      };
    });
  };

  // 3. Product Sales Volume Analysis
  const getProductSalesVolume = () => {
    const counts: { [name: string]: number } = {};
    successfulTx.forEach(tx => {
      tx.items.forEach(it => {
        counts[it.name] = (counts[it.name] || 0) + it.quantity;
      });
    });

    return Object.entries(counts)
      .map(([name, qty]) => ({ name, 'Terjual': qty }))
      .sort((a, b) => b['Terjual'] - a['Terjual'])
      .slice(0, 5);
  };

  // Submit Expense Form
  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expAmount);
    if (isNaN(amt) || amt <= 0 || !expDesc.trim()) {
      alert('Mohon isi jumlah nominal dan keterangan biaya dengan benar.');
      return;
    }

    const finalCategory = isCustomCategory ? customCategory.trim() : expCategory;
    if (isCustomCategory && !customCategory.trim()) {
      alert('Mohon isi nama kategori kustom baru.');
      return;
    }

    try {
      await onAddExpense({
        category: finalCategory,
        amount: amt,
        description: expDesc.trim(),
        date: expDate
      });
      setIsAddingExpense(false);
      setExpAmount('');
      setExpDesc('');
      setCustomCategory('');
      setIsCustomCategory(false);
      setExpCategory('utility');
      alert('Pengeluaran baru berhasil ditambahkan!');
    } catch (err) {
      console.error(err);
      alert('Gagal mencatat pengeluaran.');
    }
  };

  const getCategoryLabel = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'utility': return 'Listrik/Air/Es';
      case 'rent': return 'Sewa Lapak';
      case 'marketing': return 'Promosi/Iklan';
      case 'salary': return 'Gaji Karyawan';
      case 'other': return 'Bahan Baku / Lainnya';
      default: return cat;
    }
  };

  const handleExportToGoogleSheets = async () => {
    if (!token || !user) {
      alert('Sesi Google Sheets tidak aktif. Silakan masuk kembali lewat tombol login.');
      return;
    }

    setIsExportingSheet(true);
    setExportError(null);
    setExportedSheetUrl(null);

    const marginPercentage = totalRevenue > 0 
      ? ((netProfit / totalRevenue) * 100).toFixed(1) + '%' 
      : '0%';

    try {
      const result = await createAndPopulateSpreadsheet(token, {
        transactions,
        rawMaterials,
        products,
        attendanceLogs,
        expenses,
        totals: {
          revenue: totalRevenue,
          hpp: totalHpp,
          operational: totalOpExpenses,
          netProfit,
          margin: marginPercentage
        },
        userName: user.displayName || user.email || 'Staff'
      });

      setExportedSheetUrl(result.spreadsheetUrl);
      alert('Laporan keuangan berhasil diexport ke Google Sheet Anda!');
    } catch (err: any) {
      console.error(err);
      setExportError(err.message || 'Gagal mengekspor laporan ke Google Sheet.');
      alert('Gagal mengekspor laporan ke Google Sheet. Silakan coba login ulang jika masa berlaku sesi telah habis.');
    } finally {
      setIsExportingSheet(false);
    }
  };

  const handleExportToExcel = () => {
    const marginPercentage = totalRevenue > 0 
      ? ((netProfit / totalRevenue) * 100).toFixed(1) + '%' 
      : '0%';

    try {
      downloadExcelReport({
        transactions,
        rawMaterials,
        products,
        attendanceLogs,
        expenses,
        totals: {
          revenue: totalRevenue,
          hpp: totalHpp,
          operational: totalOpExpenses,
          netProfit,
          margin: marginPercentage
        },
        userName: user?.displayName || user?.email || 'Staff'
      });
    } catch (err: any) {
      console.error(err);
      alert('Gagal mengunduh laporan Excel: ' + (err.message || err));
    }
  };

  const chartData = getChartData();
  const salesVolumeData = getProductSalesVolume();

  return (
    <div className="space-y-4">
      {/* Header and Download Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2 uppercase tracking-wider">
            <FileSpreadsheet className="text-amber-500 w-4 h-4" />
            Laporan Keuangan Laba Rugi (P&L)
          </h2>
          <p className="text-[10px] text-slate-400">
            Pemantauan performa kas kedai kopi Anda. Margin laba dihitung real-time berdasarkan HPP bahan baku dan absensi karyawan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <button
            onClick={handleExportToExcel}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Unduh Laporan
          </button>
          <button
            onClick={() => setIsAddingExpense(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Catat Pengeluaran Operasional
          </button>
        </div>
      </div>

      {/* Google Sheet Link Success Banner */}
      {exportedSheetUrl && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-400 animate-fade-in shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-extrabold block text-slate-100">Laporan Berhasil Diexport!</span>
              <span className="text-[10px] text-slate-300">Data keuangan lengkap Anda telah berhasil diunggah ke Google Sheets Anda.</span>
            </div>
          </div>
          <a
            href={exportedSheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold uppercase text-[9px] tracking-wider transition-all whitespace-nowrap self-start sm:self-auto"
          >
            Buka Google Sheet
            <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Revenue */}
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 shadow-md">
          <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-widest">Pendapatan Kotor</span>
          <span className="text-base font-black text-slate-100 block mt-1 font-mono">
            Rp {totalRevenue.toLocaleString('id-ID')}
          </span>
          <span className="text-[9px] text-emerald-400 font-bold block mt-1 uppercase tracking-wider">
            {successfulTx.length} pesanan lunas
          </span>
        </div>

        {/* Total COGS (HPP) */}
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 shadow-md">
          <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-widest">HPP Bahan Baku</span>
          <span className="text-base font-black text-rose-400 block mt-1 font-mono">
            Rp {totalHpp.toLocaleString('id-ID')}
          </span>
          <span className="text-[9px] text-slate-400 font-bold block mt-1 uppercase tracking-wider">
            Rasio: {totalRevenue > 0 ? ((totalHpp / totalRevenue) * 100).toFixed(1) : '0'}%
          </span>
        </div>

        {/* Total Op Expenses */}
        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 shadow-md">
          <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-widest">Operasional</span>
          <span className="text-base font-black text-rose-400 block mt-1 font-mono">
            Rp {totalOpExpenses.toLocaleString('id-ID')}
          </span>
          <span className="text-[9px] text-slate-400 font-bold block mt-1 uppercase tracking-wider">
            Utilitas, sewa, restok
          </span>
        </div>

        {/* Net Profit */}
        <div className={`p-3 rounded-xl border shadow-md col-span-2 lg:col-span-1 bg-slate-800 ${
          netProfit >= 0 
            ? 'border-emerald-500/30 text-emerald-400' 
            : 'border-rose-500/30 text-rose-400'
        }`}>
          <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-widest">Laba Bersih</span>
          <span className="text-lg font-black block mt-1 font-mono">
            Rp {netProfit.toLocaleString('id-ID')}
          </span>
          <span className="text-[9px] font-extrabold block mt-1 uppercase tracking-wider">
            Margin: {totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0'}%
          </span>
        </div>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend Area Chart */}
        <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md">
          <h3 className="font-bold text-slate-200 text-xs uppercase tracking-wider mb-4">Grafik Keuangan Harian</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fill: '#94a3b8' }} stroke="#475569" />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} stroke="#475569" />
                <Tooltip 
                  formatter={(value) => [`Rp ${value.toLocaleString('id-ID')}`]} 
                  labelStyle={{ fontSize: 10, fontWeight: 'bold', color: '#f8fafc' }} 
                  contentStyle={{ fontSize: 11, backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }} 
                />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                <Area type="monotone" dataKey="Pendapatan" stroke="#10b981" fillOpacity={1} fill="url(#colorSales)" strokeWidth={2} />
                <Area type="monotone" dataKey="Laba Bersih" stroke="#f59e0b" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Best Selling Drinks Bar Chart */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md">
          <h3 className="font-bold text-slate-200 text-xs uppercase tracking-wider mb-4">5 Menu Paling Laris</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesVolumeData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} stroke="#475569" />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} stroke="#475569" />
                <Tooltip 
                  formatter={(value) => [`${value} Porsi`]} 
                  contentStyle={{ fontSize: 11, backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }} 
                />
                <Bar dataKey="Terjual" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Operational Expenses Ledger */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md">
        <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Buku Pengeluaran Operasional</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 font-bold uppercase tracking-wider text-[9px] pb-2">
                <th className="py-2.5 px-1">Tanggal</th>
                <th className="py-2.5 px-1">Kategori Pengeluaran</th>
                <th className="py-2.5 px-1">Keterangan / Detil</th>
                <th className="py-2.5 px-1 text-right">Nominal Biaya</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-slate-300">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="py-2.5 px-1 font-bold font-mono text-slate-400">{exp.date}</td>
                  <td className="py-2.5 px-1">
                    <span className="px-2 py-0.5 bg-slate-900 text-slate-300 border border-slate-700 text-[9px] font-extrabold rounded uppercase tracking-wider">
                      {getCategoryLabel(exp.category)}
                    </span>
                  </td>
                  <td className="py-2.5 px-1 text-slate-300 font-bold">{exp.description}</td>
                  <td className="py-2.5 px-1 text-right font-black text-rose-400 font-mono">
                    Rp {exp.amount.toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-slate-500 font-semibold">Belum ada catatan pengeluaran operasional.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD OPERATIONAL EXPENSE */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-700 text-slate-200">
            <h3 className="font-extrabold text-white text-xs uppercase tracking-wider mb-3">Catat Pengeluaran Operasional Baru</h3>

            <form onSubmit={handleAddExpenseSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tanggal</label>
                  <input
                    type="date"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold font-mono"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Kategori</label>
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsCustomCategory(!isCustomCategory);
                        setCustomCategory('');
                      }}
                      className="text-[9px] font-black text-amber-500 hover:text-amber-400 uppercase tracking-wider cursor-pointer"
                    >
                      {isCustomCategory ? '← Pilih List' : '+ Kategori Baru'}
                    </button>
                  </div>
                  {isCustomCategory ? (
                    <input
                      type="text"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                      placeholder="Nama kategori baru"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      required
                    />
                  ) : (
                    <select
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                    >
                      {Array.from(new Set([
                        'utility',
                        'rent',
                        'marketing',
                        'other',
                        ...expenses.map(e => e.category)
                      ])).filter(cat => cat !== 'salary').map(cat => (
                        <option key={cat} value={cat}>
                          {getCategoryLabel(cat)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nominal Pengeluaran (Rp)</label>
                <input
                  type="number"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold font-mono"
                  placeholder="Contoh: 150000"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Keterangan Pengeluaran</label>
                <textarea
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  rows={2}
                  placeholder="Contoh: Pembelian es kristal harian & air mineral galon"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingExpense(false)}
                  className="flex-1 py-1.5 border border-slate-700 rounded text-xs font-bold text-slate-400 hover:bg-slate-900 uppercase tracking-wider"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold uppercase tracking-wider shadow"
                >
                  Simpan Pengeluaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
