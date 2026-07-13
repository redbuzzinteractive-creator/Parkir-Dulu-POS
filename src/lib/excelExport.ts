import * as XLSX from 'xlsx';
import { Transaction, RawMaterial, Product, AttendanceLog, OperationalExpense } from '../types';

interface ExportData {
  transactions: Transaction[];
  rawMaterials: RawMaterial[];
  products: Product[];
  attendanceLogs: AttendanceLog[];
  expenses: OperationalExpense[];
  totals: {
    revenue: number;
    hpp: number;
    operational: number;
    netProfit: number;
    margin: string;
  };
  userName: string;
}

export const downloadExcelReport = (data: ExportData) => {
  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Create workbook
  const wb = XLSX.utils.book_new();

  // 1. Ringkasan Keuangan Sheet
  const ringkasanData = [
    ['PARKIR DULU - LAPORAN KEUANGAN & LABA RUGI (P&L)'],
    ['Slogan:', 'Jajanan Sehat Harga Bersahabat - Kelewat Puter Balik'],
    ['Tanggal Export:', dateStr],
    ['Dibuat Oleh:', data.userName],
    [],
    ['RINGKASAN METRIK KEUANGAN', 'NILAI (RUPIAH)', 'KETERANGAN'],
    ['Pendapatan Kotor (Omset)', data.totals.revenue, `${data.transactions.filter(t => t.paymentStatus === 'success').length} Pesanan Lunas`],
    ['HPP (Bahan Baku)', data.totals.hpp, 'Berdasarkan resep terpakai'],
    ['Biaya Operasional', data.totals.operational, 'Utilitas, sewa, restok'],
    [],
    ['LABA BERSIH', data.totals.netProfit, `Margin Laba: ${data.totals.margin}`],
    [],
    ['Status Finansial:', data.totals.netProfit >= 0 ? 'SURPLUS / UNTUNG' : 'DEFISIT / RUGI'],
  ];
  const wsRingkasan = XLSX.utils.aoa_to_sheet(ringkasanData);

  // 2. Detail Pengeluaran Sheet
  const pengeluaranData = [
    ['DAFTAR PENGELUARAN OPERASIONAL & BIAYA'],
    ['Tanggal', 'Kategori', 'Keterangan', 'Nominal Biaya'],
    ...data.expenses.map(exp => {
      let catLabel = exp.category;
      if (exp.category === 'utility') catLabel = 'Listrik & Air';
      else if (exp.category === 'rent') catLabel = 'Sewa Lapak';
      else if (exp.category === 'marketing') catLabel = 'Promosi & Iklan';
      else if (exp.category === 'other') catLabel = 'Lain-lain / Es Batu';
      return [exp.date, catLabel, exp.description, exp.amount];
    }),
  ];
  const wsPengeluaran = XLSX.utils.aoa_to_sheet(pengeluaranData);

  // 3. Menu Terlaris Sheet
  const productSalesMap: { [name: string]: number } = {};
  data.transactions
    .filter(t => t.paymentStatus === 'success')
    .forEach(tx => {
      tx.items.forEach(it => {
        productSalesMap[it.name] = (productSalesMap[it.name] || 0) + it.quantity;
      });
    });
  const menuTerlarisList = Object.entries(productSalesMap)
    .map(([name, qty]) => [name, qty])
    .sort((a, b) => (b[1] as number) - (a[1] as number));

  const menuTerlarisData = [
    ['LAPORAN MENU PALING LARIS (SALES VOLUME)'],
    ['Nama Menu / Produk', 'Jumlah Terjual (Porsi)'],
    ...menuTerlarisList,
  ];
  const wsMenuTerlaris = XLSX.utils.aoa_to_sheet(menuTerlarisData);

  // 4. Daftar Transaksi Sheet
  const transaksiData = [
    ['DAFTAR TRANSAKSI PENJUALAN LUNAS'],
    ['ID Transaksi', 'Tanggal & Waktu', 'Detail Item', 'Metode Pembayaran', 'Status', 'Total Pendapatan'],
    ...data.transactions
      .filter(t => t.paymentStatus === 'success')
      .map(t => {
        const itemDetail = t.items.map(it => `${it.name} (${it.quantity}x)`).join(', ');
        return [
          t.id,
          new Date(t.timestamp).toLocaleString('id-ID'),
          itemDetail,
          t.paymentMethod.toUpperCase(),
          t.paymentStatus.toUpperCase(),
          t.totalAmount,
        ];
      }),
  ];
  const wsTransaksi = XLSX.utils.aoa_to_sheet(transaksiData);

  // Add column widths to make it highly professional and easily readable
  const wscolsRingkasan = [
    { wch: 30 },
    { wch: 25 },
    { wch: 40 }
  ];
  const wscolsPengeluaran = [
    { wch: 15 },
    { wch: 20 },
    { wch: 45 },
    { wch: 20 }
  ];
  const wscolsMenuTerlaris = [
    { wch: 30 },
    { wch: 25 }
  ];
  const wscolsTransaksi = [
    { wch: 15 },
    { wch: 25 },
    { wch: 50 },
    { wch: 20 },
    { wch: 15 },
    { wch: 20 }
  ];

  wsRingkasan['!cols'] = wscolsRingkasan;
  wsPengeluaran['!cols'] = wscolsPengeluaran;
  wsMenuTerlaris['!cols'] = wscolsMenuTerlaris;
  wsTransaksi['!cols'] = wscolsTransaksi;

  // Append sheets to workbook
  XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan Keuangan');
  XLSX.utils.book_append_sheet(wb, wsPengeluaran, 'Detail Pengeluaran');
  XLSX.utils.book_append_sheet(wb, wsMenuTerlaris, 'Menu Terlaris');
  XLSX.utils.book_append_sheet(wb, wsTransaksi, 'Daftar Transaksi');

  // Trigger file download
  XLSX.writeFile(wb, `Laporan_Keuangan_Parkir_Dulu_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
