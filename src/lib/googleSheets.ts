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

export const createAndPopulateSpreadsheet = async (
  accessToken: string,
  data: ExportData
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // 1. Create a blank Spreadsheet with a clean title and 4 sheets
  const createResponse = await fetch('https://sheets.googleapis.com/v1/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: `PARKIR DULU - Laporan Keuangan (${dateStr})`,
      },
      sheets: [
        { properties: { title: 'Ringkasan Keuangan' } },
        { properties: { title: 'Detail Pengeluaran' } },
        { properties: { title: 'Menu Terlaris' } },
        { properties: { title: 'Daftar Transaksi' } },
      ],
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error('Failed to create sheet:', errorText);
    throw new Error('Gagal membuat Google Spreadsheet baru.');
  }

  const sheetInfo = await createResponse.json();
  const spreadsheetId = sheetInfo.spreadsheetId;
  const spreadsheetUrl = sheetInfo.spreadsheetUrl;

  // 2. Prepare values for each sheet
  
  // Sheet 1: Ringkasan Keuangan
  const ringkasanValues = [
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

  // Sheet 2: Detail Pengeluaran
  const pengeluaranValues = [
    ['DAFTAR PENGELUARAN OPERASIONAL & BIAYA'],
    ['Tanggal', 'Kategori', 'Keterangan', 'Nominal Biaya'],
    ...data.expenses.map(exp => {
      let catLabel: string = exp.category;
      if (exp.category === 'utility') catLabel = 'Listrik & Air';
      else if (exp.category === 'rent') catLabel = 'Sewa Lapak';
      else if (exp.category === 'marketing') catLabel = 'Promosi & Iklan';
      else if (exp.category === 'other') catLabel = 'Lain-lain / Es Batu';
      
      return [exp.date, catLabel, exp.description, exp.amount];
    }),
  ];

  // Sheet 3: Menu Terlaris
  // Calculate quantity sold for each product
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

  const menuTerlarisValues = [
    ['LAPORAN MENU PALING LARIS (SALES VOLUME)'],
    ['Nama Menu / Produk', 'Jumlah Terjual (Porsi)'],
    ...menuTerlarisList,
  ];

  // Sheet 4: Daftar Transaksi
  const transaksiValues = [
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

  // 3. Write data to each sheet via batchUpdate endpoint
  const valueRangeBody = {
    valueInputOption: 'USER_ENTERED',
    data: [
      {
        range: "'Ringkasan Keuangan'!A1",
        values: ringkasanValues,
      },
      {
        range: "'Detail Pengeluaran'!A1",
        values: pengeluaranValues,
      },
      {
        range: "'Menu Terlaris'!A1",
        values: menuTerlarisValues,
      },
      {
        range: "'Daftar Transaksi'!A1",
        values: transaksiValues,
      },
    ],
  };

  const updateResponse = await fetch(
    `https://sheets.googleapis.com/v1/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(valueRangeBody),
    }
  );

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    console.error('Failed to populate sheet data:', errorText);
    throw new Error('Gagal mengisi data laporan keuangan ke Google Spreadsheet.');
  }

  // 4. Send format adjustments (bold headers, auto-resize columns, etc.)
  // We can send a batchUpdate request to apply formatting to make it look highly professional!
  try {
    const formatBody = {
      requests: [
        // Make Ringkasan Header Bold and Large
        {
          repeatCell: {
            range: {
              sheetId: sheetInfo.sheets[0].properties.sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                textFormat: {
                  fontSize: 14,
                  bold: true,
                },
              },
            },
            fields: 'userEnteredFormat.textFormat',
          },
        },
        // Bold headers on all sheets
        ...sheetInfo.sheets.map((s: any, idx: number) => {
          const startHeaderRow = idx === 0 ? 5 : 1;
          const endHeaderRow = idx === 0 ? 6 : 2;
          return {
            repeatCell: {
              range: {
                sheetId: s.properties.sheetId,
                startRowIndex: startHeaderRow,
                endRowIndex: endHeaderRow,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: {
                    bold: true,
                  },
                  backgroundColor: {
                    red: 0.95,
                    green: 0.95,
                    blue: 0.95,
                  },
                },
              },
              fields: 'userEnteredFormat.textFormat,userEnteredFormat.backgroundColor',
            },
          };
        }),
        // Auto-fit column widths for all sheets
        ...sheetInfo.sheets.map((s: any) => ({
          autoResizeDimensions: {
            dimensions: {
              sheetId: s.properties.sheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 6,
            },
          },
        })),
      ],
    };

    await fetch(`https://sheets.googleapis.com/v1/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formatBody),
    });
  } catch (fmtError) {
    // If formatting fails, it's non-blocking, we still have the raw data populated
    console.warn('Google Sheets formatting failed but data was uploaded:', fmtError);
  }

  return { spreadsheetId, spreadsheetUrl };
};
