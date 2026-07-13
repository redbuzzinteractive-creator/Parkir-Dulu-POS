import express from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { 
  INITIAL_RAW_MATERIALS, 
  INITIAL_PRODUCTS, 
  INITIAL_EMPLOYEES, 
  getInitialSchedulesAndLogs, 
  getInitialTransactions, 
  INITIAL_EXPENSES 
} from './src/data';
import { Transaction, RawMaterial, Product, ShiftSchedule, AttendanceLog, Employee, OperationalExpense } from './src/types';

const app = express();
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), 'database.json');

// Store active connections with user profiles
interface OnlineUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

const clients = new Map<WebSocket, OnlineUser | null>();

function broadcast(message: any) {
  const payload = JSON.stringify(message);
  for (const [client, _] of clients.entries()) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (err) {
        console.error('Error sending WS broadcast:', err);
      }
    }
  }
}

function broadcastDBUpdate(db: any) {
  broadcast({
    type: 'db_updated',
    db
  });
}

function broadcastPresence() {
  const users: OnlineUser[] = [];
  const seenUids = new Set<string>();
  
  for (const user of clients.values()) {
    if (user && !seenUids.has(user.uid)) {
      users.push(user);
      seenUids.add(user.uid);
    }
  }
  
  broadcast({
    type: 'presence',
    users
  });
}

app.use(express.json());

// Helper to initialize and read DB
function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const { schedules, logs } = getInitialSchedulesAndLogs();
    const initialData = {
      rawMaterials: INITIAL_RAW_MATERIALS,
      products: INITIAL_PRODUCTS,
      employees: INITIAL_EMPLOYEES,
      schedules: schedules,
      attendanceLogs: logs,
      transactions: getInitialTransactions(),
      expenses: INITIAL_EXPENSES
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }
  try {
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading database file, resetting...', err);
    // Return standard initial fallback
    const { schedules, logs } = getInitialSchedulesAndLogs();
    return {
      rawMaterials: INITIAL_RAW_MATERIALS,
      products: INITIAL_PRODUCTS,
      employees: INITIAL_EMPLOYEES,
      schedules: schedules,
      attendanceLogs: logs,
      transactions: getInitialTransactions(),
      expenses: INITIAL_EXPENSES
    };
  }
}

function writeDB(data: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing to database file:', err);
  }
}

// Automatically deduct stock for ingredients of transaction items
function deductInventoryStock(db: any, items: any[]) {
  const updatedMaterials = [...db.rawMaterials] as RawMaterial[];
  
  for (const item of items) {
    const product = db.products.find((p: Product) => p.id === item.productId) as Product | undefined;
    if (product && product.ingredients) {
      for (const ingredient of product.ingredients) {
        const materialIndex = updatedMaterials.findIndex(m => m.id === ingredient.materialId);
        if (materialIndex !== -1) {
          // Deduct quantity * item.quantity
          updatedMaterials[materialIndex].stock = Math.max(
            0,
            updatedMaterials[materialIndex].stock - ingredient.quantityNeeded * item.quantity
          );
        }
      }
    }
  }
  
  db.rawMaterials = updatedMaterials;
  return db;
}

// ------------------- API ROUTES -------------------

// 1. Get entire database
app.get('/api/db', (req, res) => {
  const db = readDB();
  res.json(db);
});

// 2. Sync / update full keys (for administrative edits like schedule, employees, expenses)
app.post('/api/db/update', (req, res) => {
  const { key, data } = req.body;
  const db = readDB();
  
  if (key && db[key] !== undefined) {
    db[key] = data;
    writeDB(db);
    broadcastDBUpdate(db);
    res.json({ success: true, message: `Successfully updated ${key}` });
  } else {
    res.status(400).json({ success: false, message: 'Invalid key specified' });
  }
});

// 2c. Autosave full database state (triggered every 5 minutes from client)
app.post('/api/db/autosave', (req, res) => {
  try {
    const newState = req.body;
    const db = readDB();
    
    const allowedKeys = ['rawMaterials', 'products', 'employees', 'schedules', 'attendanceLogs', 'transactions', 'expenses'];
    let updated = false;
    for (const key of allowedKeys) {
      if (newState[key] !== undefined && Array.isArray(newState[key])) {
        db[key] = newState[key];
        updated = true;
      }
    }
    
    if (updated) {
      writeDB(db);
      broadcastDBUpdate(db);
      res.json({ success: true, message: 'Autosave berhasil disinkronkan.', timestamp: new Date().toISOString() });
    } else {
      res.status(400).json({ success: false, message: 'Tidak ada data valid untuk disinkronkan.' });
    }
  } catch (err: any) {
    console.error('Autosave failed:', err);
    res.status(500).json({ success: false, message: 'Gagal melakukan autosave data.' });
  }
});

// 2b. Reset database to initial values
app.post('/api/db/reset', (req, res) => {
  try {
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }
    const freshDb = readDB();
    broadcastDBUpdate(freshDb);
    res.json({ success: true, message: 'Database berhasil di-reset ke data awal.', db: freshDb });
  } catch (err: any) {
    console.error('Failed to reset database:', err);
    res.status(500).json({ success: false, message: 'Gagal melakukan reset database.' });
  }
});

// 3. Create a transaction
app.post('/api/payments/create', (req, res) => {
  const { items, totalAmount, paymentMethod, notes } = req.body;
  const db = readDB();

  const newTxId = `tx-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const newTransaction: Transaction = {
    id: newTxId,
    timestamp,
    items,
    totalAmount,
    paymentMethod,
    paymentStatus: paymentMethod === 'cash' ? 'success' : 'pending',
    notes,
    paymentGatewayRef: paymentMethod === 'cash' ? undefined : `PG-SIM-${Math.floor(100000 + Math.random() * 900000)}`
  };

  // If cash, deduct inventory immediately
  let updatedDb = db;
  if (paymentMethod === 'cash') {
    updatedDb = deductInventoryStock(db, items);
  }

  updatedDb.transactions.unshift(newTransaction);
  writeDB(updatedDb);
  broadcastDBUpdate(updatedDb);

  // Generate specific simulation data for digital payments
  let qrCodeData = '';
  let paymentUrl = '';

  if (paymentMethod === 'qris') {
    // Standard Indonesian QRIS spec simulation
    qrCodeData = `00020101021226570022ID.CO.QRIS.WWW.EXAMPLE0118936005200118203923520453115502015802ID5915KEDAI_KOPI_SIM6007JAKARTA610512111620707032145`;
  } else if (['gopay', 'dana', 'ovo'].includes(paymentMethod)) {
    paymentUrl = `https://payment-simulator.example.com/${paymentMethod}/${newTransaction.paymentGatewayRef}`;
  } else if (paymentMethod === 'midtrans') {
    // If user configured Midtrans environment variables, we can perform a real fetch or simulate
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (serverKey) {
      // Real Midtrans Snap Transaction API Call
      const authHeader = Buffer.from(`${serverKey}:`).toString('base64');
      const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
      const midtransUrl = isProduction 
        ? 'https://app.midtrans.com/snap/v1/transactions' 
        : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

      fetch(midtransUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Basic ${authHeader}`
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: newTxId,
            gross_amount: totalAmount
          },
          item_details: items.map((it: any) => ({
            id: it.productId,
            price: it.price,
            quantity: it.quantity,
            name: it.name
          })),
          credit_card: { secure: true }
        })
      })
      .then(r => r.json())
      .then((snapRes: any) => {
        if (snapRes.token) {
          // Update transaction with real PG info
          const currentDb = readDB();
          const txIndex = currentDb.transactions.findIndex((t: any) => t.id === newTxId);
          if (txIndex !== -1) {
            currentDb.transactions[txIndex].paymentGatewayRef = snapRes.token;
            writeDB(currentDb);
            broadcastDBUpdate(currentDb);
          }
          res.json({
            success: true,
            transaction: { ...newTransaction, paymentGatewayRef: snapRes.token },
            paymentUrl: snapRes.redirect_url,
            token: snapRes.token,
            isReal: true
          });
        } else {
          throw new Error(snapRes.error_messages ? snapRes.error_messages.join(', ') : 'Midtrans API error');
        }
      })
      .catch((err) => {
        console.error('Midtrans integration failed, falling back to Sandbox Simulator:', err.message);
        res.json({
          success: true,
          transaction: newTransaction,
          paymentUrl: `https://checkout.sandbox.midtrans.com/v1/payment-links/${newTransaction.paymentGatewayRef}`,
          isReal: false,
          error: err.message
        });
      });
      return; // prevent fallback response below
    } else {
      paymentUrl = `https://checkout.sandbox.midtrans.com/v1/payment-links/${newTransaction.paymentGatewayRef}`;
    }
  } else if (paymentMethod === 'xendit') {
    const xenditKey = process.env.XENDIT_SECRET_KEY;
    if (xenditKey) {
      // Real Xendit Invoice API Call
      const authHeader = Buffer.from(`${xenditKey}:`).toString('base64');
      fetch('https://api.xendit.co/v2/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${authHeader}`
        },
        body: JSON.stringify({
          external_id: newTxId,
          amount: totalAmount,
          description: `Pembelian Kedai Kopi Order ${newTxId}`,
          items: items.map((it: any) => ({
            name: it.name,
            quantity: it.quantity,
            price: it.price,
            category: 'Kopi & Makanan'
          }))
        })
      })
      .then(r => r.json())
      .then((xenRes: any) => {
        if (xenRes.invoice_url) {
          const currentDb = readDB();
          const txIndex = currentDb.transactions.findIndex((t: any) => t.id === newTxId);
          if (txIndex !== -1) {
            currentDb.transactions[txIndex].paymentGatewayRef = xenRes.id;
            writeDB(currentDb);
            broadcastDBUpdate(currentDb);
          }
          res.json({
            success: true,
            transaction: { ...newTransaction, paymentGatewayRef: xenRes.id },
            paymentUrl: xenRes.invoice_url,
            isReal: true
          });
        } else {
          throw new Error(xenRes.message || 'Xendit API error');
        }
      })
      .catch((err) => {
        console.error('Xendit integration failed, falling back to Sandbox Simulator:', err.message);
        res.json({
          success: true,
          transaction: newTransaction,
          paymentUrl: `https://checkout.xendit.co/web/invoices/${newTransaction.paymentGatewayRef}`,
          isReal: false,
          error: err.message
        });
      });
      return; // prevent fallback response below
    } else {
      paymentUrl = `https://checkout.xendit.co/web/invoices/${newTransaction.paymentGatewayRef}`;
    }
  }

  res.json({
    success: true,
    transaction: newTransaction,
    qrCodeData,
    paymentUrl,
    isReal: false
  });
});

// 4. Simulate a payment completion (client-side trigger for testing payments)
app.post('/api/payments/simulate-pay', (req, res) => {
  const { transactionId } = req.body;
  const db = readDB();

  const txIndex = db.transactions.findIndex((t: Transaction) => t.id === transactionId);
  if (txIndex !== -1) {
    const tx = db.transactions[txIndex];
    if (tx.paymentStatus !== 'success') {
      tx.paymentStatus = 'success';
      // Deduct raw materials on success
      const updatedDb = deductInventoryStock(db, tx.items);
      writeDB(updatedDb);
      broadcastDBUpdate(updatedDb);
      res.json({ success: true, transaction: tx, message: 'Simulated payment succeeded!' });
    } else {
      res.json({ success: true, transaction: tx, message: 'Transaction is already successful.' });
    }
  } else {
    res.status(404).json({ success: false, message: 'Transaction not found' });
  }
});

// 5. Real Midtrans / Xendit Callback Webhook handler
app.post('/api/payments/callback', (req, res) => {
  const body = req.body;
  const db = readDB();
  console.log('Received Payment Gateway Callback:', JSON.stringify(body, null, 2));

  let orderId = '';
  let paymentStatus: 'success' | 'failed' | 'pending' = 'pending';

  // Parse Midtrans Notification
  if (body.order_id && body.transaction_status) {
    orderId = body.order_id;
    const status = body.transaction_status;
    if (['capture', 'settlement'].includes(status)) {
      paymentStatus = 'success';
    } else if (['cancel', 'deny', 'expire'].includes(status)) {
      paymentStatus = 'failed';
    } else if (status === 'pending') {
      paymentStatus = 'pending';
    }
  } 
  // Parse Xendit Invoice Notification
  else if (body.external_id && body.status) {
    orderId = body.external_id;
    const status = body.status;
    if (status === 'PAID') {
      paymentStatus = 'success';
    } else if (status === 'EXPIRED') {
      paymentStatus = 'failed';
    }
  }

  if (orderId) {
    const txIndex = db.transactions.findIndex((t: Transaction) => t.id === orderId);
    if (txIndex !== -1) {
      const tx = db.transactions[txIndex];
      const oldStatus = tx.paymentStatus;
      tx.paymentStatus = paymentStatus;

      // Deduct inventory stock if status is newly set to success
      let finalDb = db;
      if (paymentStatus === 'success' && oldStatus !== 'success') {
        finalDb = deductInventoryStock(db, tx.items);
      }
      writeDB(finalDb);
      broadcastDBUpdate(finalDb);
      return res.status(200).send('OK');
    }
  }

  res.status(400).send('Transaction not found or invalid format');
});

// ------------------- VITE DEV SERVER / STATIC SERVING -------------------

async function startServer() {
  // One-time cleanup to clear all existing raw materials and products from database.json if they exist
  if (fs.existsSync(DB_PATH)) {
    try {
      const content = fs.readFileSync(DB_PATH, 'utf-8');
      const db = JSON.parse(content);
      if ((db.rawMaterials && db.rawMaterials.length > 0) || (db.products && db.products.length > 0)) {
        console.log('One-time cleanup: Removing all raw materials and products from database...');
        db.rawMaterials = [];
        db.products = [];
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
      }
    } catch (err) {
      console.error('One-time database cleanup failed:', err);
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    clients.set(ws, null);
    console.log('Client connected to WS. Total connections:', clients.size);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'join') {
          clients.set(ws, data.user);
          broadcastPresence();
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected from WS. Total connections:', clients.size);
      broadcastPresence();
    });

    ws.on('error', (err) => {
      console.error('WebSocket client error:', err);
      clients.delete(ws);
      broadcastPresence();
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
