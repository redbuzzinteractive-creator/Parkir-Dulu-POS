import { useState, useEffect } from 'react';
import { 
  Coffee, Layers, FileSpreadsheet, Clock, 
  AlertTriangle, Compass, ShieldAlert, LogOut, RotateCcw
} from 'lucide-react';
import logoImg from './assets/images/parkir_dulu_logo_1783140895737.jpg';
import { CashierTab } from './components/CashierTab';
import { InventoryTab } from './components/InventoryTab';
import { ReportsTab } from './components/ReportsTab';
import { 
  Product, RawMaterial, Transaction, Employee, 
  ShiftSchedule, AttendanceLog, OperationalExpense, 
  PaymentMethod, ExpenseCategory 
} from './types';
import { initAuth, googleSignIn, logout } from './lib/auth';
import { User } from 'firebase/auth';

const ALLOWED_EMAILS = [
  'redbuzzinteractive@gmail.com',
  'fmmalik23@gmail.com'
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'cashier' | 'inventory' | 'reports'>('cashier');
  const [loading, setLoading] = useState(true);
  
  // Auth States
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // App state loaded from database.json on backend
  const [products, setProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [expenses, setExpenses] = useState<OperationalExpense[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<{
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  }[]>([]);
  const [lastAutosaveTime, setLastAutosaveTime] = useState<Date | null>(null);
  const [isAutosaving, setIsAutosaving] = useState(false);

  // Clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  const executeResetDatabase = async () => {
    try {
      const response = await fetch('/api/db/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.db) {
          setProducts(result.db.products || []);
          setRawMaterials(result.db.rawMaterials || []);
          setTransactions(result.db.transactions || []);
          setEmployees(result.db.employees || []);
          setSchedules(result.db.schedules || []);
          setAttendanceLogs(result.db.attendanceLogs || []);
          setExpenses(result.db.expenses || []);
          alert('Semua data berhasil di-reset ke kondisi awal!');
        } else {
          alert('Gagal me-reset data: ' + (result.message || 'Error tidak diketahui'));
        }
      } else {
        alert('Gagal me-reset data pada server.');
      }
    } catch (err) {
      console.error('Error resetting database:', err);
      alert('Terjadi kesalahan jaringan saat mencoba me-reset data.');
    } finally {
      setShowResetConfirm(false);
    }
  };

  // Fetch full state from backend
  const fetchDatabase = async () => {
    try {
      const response = await fetch('/api/db');
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
        setRawMaterials(data.rawMaterials || []);
        setTransactions(data.transactions || []);
        setEmployees(data.employees || []);
        setSchedules(data.schedules || []);
        setAttendanceLogs(data.attendanceLogs || []);
        setExpenses(data.expenses || []);
      }
    } catch (err) {
      console.error('Error fetching database:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check authentication state on mount
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        if (currentUser.email && ALLOWED_EMAILS.includes(currentUser.email.toLowerCase())) {
          setUser(currentUser);
          setToken(currentToken);
          setNeedsAuth(false);
          setAccessDenied(false);
          fetchDatabase();
        } else {
          setUser(currentUser);
          setToken(currentToken);
          setAccessDenied(true);
          setNeedsAuth(false);
          setLoading(false);
        }
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
        setAccessDenied(false);
        setLoading(false); // Done initializing auth, show login screen
      }
    );

    // Auto-update clock every second
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    return () => {
      clearInterval(timer);
      if (unsubscribe && typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}`;
      console.log('Connecting to real-time sync server at:', wsUrl);
      
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Connected to real-time sync server.');
        // Send join event with user details
        ws?.send(JSON.stringify({
          type: 'join',
          user: {
            uid: user?.uid,
            email: user?.email,
            displayName: user?.displayName,
            photoURL: user?.photoURL
          }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'db_updated' && data.db) {
            console.log('Received real-time DB update');
            setProducts(data.db.products || []);
            setRawMaterials(data.db.rawMaterials || []);
            setTransactions(data.db.transactions || []);
            setEmployees(data.db.employees || []);
            setSchedules(data.db.schedules || []);
            setAttendanceLogs(data.db.attendanceLogs || []);
            setExpenses(data.db.expenses || []);
          } else if (data.type === 'presence' && data.users) {
            console.log('Received active presence update:', data.users);
            setOnlineUsers(data.users);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed. Reconnecting...');
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws?.close();
      };
    }

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [user]);

  // Periodic 5-minute autosave to backend storage
  useEffect(() => {
    if (!user || needsAuth || accessDenied) return;

    const interval = setInterval(async () => {
      console.log('Initiating periodic 5-minute autosave...');
      setIsAutosaving(true);
      try {
        const response = await fetch('/api/db/autosave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            products,
            rawMaterials,
            transactions,
            employees,
            schedules,
            attendanceLogs,
            expenses
          })
        });
        if (response.ok) {
          const resData = await response.json();
          setLastAutosaveTime(new Date());
          console.log('Periodic 5-minute autosave successful:', resData);
        } else {
          console.error('Failed to trigger periodic autosave');
        }
      } catch (err) {
        console.error('Error during periodic autosave:', err);
      } finally {
        setIsAutosaving(false);
      }
    }, 5 * 60 * 1000); // 5 minutes (300,000 ms)

    return () => clearInterval(interval);
  }, [user, needsAuth, accessDenied, products, rawMaterials, transactions, employees, schedules, attendanceLogs, expenses]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        const currentUser = result.user;
        if (currentUser.email && ALLOWED_EMAILS.includes(currentUser.email.toLowerCase())) {
          setUser(currentUser);
          setToken(result.accessToken);
          setNeedsAuth(false);
          setAccessDenied(false);
          setLoading(true);
          await fetchDatabase();
        } else {
          setUser(currentUser);
          setToken(result.accessToken);
          setAccessDenied(true);
          setNeedsAuth(false);
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('Login failed:', err);
      alert('Gagal login dengan akun Google Anda.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Apakah Anda yakin ingin keluar dari aplikasi?')) {
      try {
        await logout();
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
        setAccessDenied(false);
      } catch (err) {
        console.error('Logout failed:', err);
      }
    }
  };


  // Generic DB Sync function to trigger backend database.json update
  const syncDB = async (key: string, data: any) => {
    try {
      const response = await fetch('/api/db/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, data })
      });
      if (response.ok) {
        await fetchDatabase(); // refetch to make sure frontend matches backend perfectly
      } else {
        console.error(`Failed to sync ${key}`);
      }
    } catch (err) {
      console.error(`Sync error on ${key}:`, err);
    }
  };

  // Actions
  const handleAddTransaction = async (txData: {
    items: { productId: string; name: string; quantity: number; price: number }[];
    totalAmount: number;
    paymentMethod: PaymentMethod;
    notes?: string;
  }) => {
    try {
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData)
      });
      if (res.ok) {
        const result = await res.json();
        await fetchDatabase(); // refetch updated transactions and stocks
        return result;
      }
      throw new Error('Failed to create transaction');
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleSimulatePayment = async (txId: string) => {
    try {
      const res = await fetch('/api/payments/simulate-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txId })
      });
      if (res.ok) {
        await fetchDatabase(); // refetch newly paid transaction and decreased stocks
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateRawMaterials = async (updatedMaterials: RawMaterial[]) => {
    setRawMaterials(updatedMaterials);
    await syncDB('rawMaterials', updatedMaterials);
  };

  const handleUpdateProducts = async (updatedProducts: Product[]) => {
    setProducts(updatedProducts);
    await syncDB('products', updatedProducts);
  };

  const handleUpdateEmployees = async (updatedEmployees: Employee[]) => {
    setEmployees(updatedEmployees);
    await syncDB('employees', updatedEmployees);
  };

  const handleUpdateSchedules = async (updatedSchedules: ShiftSchedule[]) => {
    setSchedules(updatedSchedules);
    await syncDB('schedules', updatedSchedules);
  };

  const handleUpdateAttendanceLogs = async (updatedLogs: AttendanceLog[]) => {
    setAttendanceLogs(updatedLogs);
    await syncDB('attendanceLogs', updatedLogs);
  };

  const handleAddExpense = async (expenseData: {
    category: ExpenseCategory;
    amount: number;
    description: string;
    date?: string;
  }) => {
    const todayStr = expenseData.date || '2026-07-03';
    const newExpense: OperationalExpense = {
      id: `exp-${Date.now()}`,
      date: todayStr,
      category: expenseData.category,
      amount: expenseData.amount,
      description: expenseData.description
    };
    
    const updatedExpenses = [newExpense, ...expenses];
    setExpenses(updatedExpenses);
    await syncDB('expenses', updatedExpenses);
  };

  // Warning indicators for low materials
  const lowMaterialsCount = rawMaterials.filter(m => m.stock <= m.minStock).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Coffee className="w-10 h-10 text-amber-500 animate-bounce" />
          <p className="text-sm text-slate-400 font-medium">Memuat Pembukuan Kedai Kopi...</p>
        </div>
      </div>
    );
  }

  if (accessDenied && user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center font-sans p-4 relative overflow-hidden">
        {/* Abstract background blobs to match high quality standard */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-rose-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-rose-600/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md bg-slate-850 border border-rose-500/20 p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center relative z-10">
          
          {/* Access Denied Icon */}
          <div className="w-20 h-20 bg-rose-950/40 text-rose-500 rounded-full flex items-center justify-center border border-rose-500/30 shadow-xl mb-6">
            <ShieldAlert className="w-10 h-10 text-rose-500 animate-pulse" />
          </div>

          <h1 className="text-xl font-black text-rose-400 uppercase tracking-tight">
            Akses Ditolak
          </h1>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">
            Hanya Pengelola Terdaftar Yang Diizinkan
          </p>

          <div className="w-full h-px bg-slate-700/60 my-6"></div>

          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            Email Anda <strong className="text-amber-400 font-mono text-[11px] bg-slate-900 py-1 px-2 rounded border border-slate-750">{user.email}</strong> tidak memiliki izin akses untuk Sistem Pembukuan PARKIR DULU.
          </p>
          <p className="text-[10px] text-slate-400 mb-6">
            Jika ini adalah sebuah kesalahan, silakan hubungi Administrator atau coba masuk kembali dengan akun Google pengelola yang terdaftar.
          </p>

          <button 
            onClick={async () => {
              await logout();
              setUser(null);
              setToken(null);
              setNeedsAuth(true);
              setAccessDenied(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all border border-slate-700 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Keluar &amp; Ganti Akun Google</span>
          </button>

          <div className="mt-8 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
            Parkir Dulu © 2026 • Secure OAuth Access
          </div>
        </div>
      </div>
    );
  }

  if (needsAuth || !user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center font-sans p-4 relative overflow-hidden">
        {/* Abstract background blobs to match high quality standard */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-600/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md bg-slate-850 border border-slate-700/60 p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center relative z-10">
          
          {/* Circular Logo */}
          <div className="w-28 h-28 bg-slate-900 rounded-full overflow-hidden flex items-center justify-center border-2 border-amber-500 shadow-xl mb-6 relative">
            <img 
              src={logoImg} 
              alt="PARKIR DULU Logo" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
          </div>

          <h1 className="text-2xl font-black text-white uppercase tracking-tight">
            PARKIR DULU
          </h1>
          <p className="text-xs text-amber-500 font-bold uppercase tracking-wider mt-1">
            Jajanan Sehat Harga Bersahabat
          </p>
          <p className="italic text-[10px] text-slate-400 mt-0.5">
            "Kelewat puter balik"
          </p>

          <div className="w-full h-px bg-slate-700/60 my-6"></div>

          <p className="text-xs text-slate-300 leading-relaxed mb-6">
            Selamat datang di Sistem Pembukuan &amp; Inventaris Kedai. Silakan login menggunakan akun Google Anda untuk mengakses kasir, data inventaris, dan laporan keuangan.
          </p>

          {isLoggingIn ? (
            <div className="flex flex-col items-center gap-2 py-3">
              <Coffee className="w-6 h-6 text-amber-500 animate-spin" />
              <p className="text-[10px] text-slate-400 font-medium">Menghubungkan ke Google Auth...</p>
            </div>
          ) : (
            /* Sign in with Google Button formatted strictly to look official */
            <button 
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-100 text-slate-800 rounded-xl font-bold text-sm shadow-md transition-all border border-slate-200 cursor-pointer"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
              <span>Masuk dengan Google</span>
            </button>
          )}

          <div className="mt-8 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
            Parkir Dulu © 2026 • Secure OAuth Access
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col font-sans">
      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-800 border-b border-slate-700 shadow-md px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-4">
          
          {/* Logo and Shop Name */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-full overflow-hidden flex items-center justify-center border border-amber-500 shadow-inner">
                <img 
                  src={logoImg} 
                  alt="PARKIR DULU Logo" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h1 className="font-extrabold text-base tracking-tight text-white uppercase flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span>PARKIR DULU</span>
                  <span className="text-[9px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider self-start sm:self-auto leading-none">
                    Jajanan Sehat Harga Bersahabat
                  </span>
                </h1>
                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                  <span>Sistem Pembukuan &amp; Inventaris v2.4</span>
                  <span className="text-slate-700">•</span>
                  <span className="italic text-amber-400 font-semibold">"Kelewat puter balik"</span>
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'cashier', label: 'Kasir & POS', icon: <Coffee className="w-4 h-4" /> },
              { 
                id: 'inventory', 
                label: 'Bahan Baku', 
                icon: <Layers className="w-4 h-4" />,
                badge: lowMaterialsCount > 0 ? lowMaterialsCount : undefined
              },
              { id: 'reports', label: 'Laporan Laba Rugi', icon: <FileSpreadsheet className="w-4 h-4" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all relative ${
                  activeTab === tab.id
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ml-1 ${
                    activeTab === tab.id 
                      ? 'bg-slate-900 text-amber-400 border border-amber-500/20' 
                      : 'bg-rose-950 text-rose-300 border border-rose-800/30'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Right Section: Clock and User Profile */}
          <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto shrink-0">
            {/* Reset Data Button */}
            {user && (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center justify-center w-9 h-9 rounded-lg sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 hover:border-rose-700 text-rose-300 hover:text-rose-200 text-xs font-bold transition-all cursor-pointer shadow-sm shrink-0"
                title="Reset Semua Data ke Kondisi Awal"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline ml-1.5">Reset Data</span>
              </button>
            )}



            {/* Live UTC Clock & Date display */}
            <div className="hidden md:flex items-center gap-2 bg-slate-900 border border-slate-700 py-1.5 px-3 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10.5px] font-mono text-slate-300 font-bold">
                {currentTime.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} | {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            {/* Logged in User Profile */}
            {user && (
              <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-700 rounded-lg p-1.5 px-3 relative group justify-center cursor-pointer shrink-0 hover:border-slate-600 transition-colors">
                <div className="flex flex-col items-start">
                  <span className="text-[10px] font-black text-slate-200 leading-none">{user.displayName || 'Staff'}</span>
                  <span className="text-[8px] text-slate-400 font-semibold leading-normal mt-0.5">{user.email}</span>
                </div>
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'Avatar'} 
                    className="w-8 h-8 rounded-md border border-amber-500/60 object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-md bg-amber-600 text-slate-950 font-black flex items-center justify-center text-xs border border-amber-500/60 shrink-0">
                    {(user.displayName || 'S').charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="hidden sm:block p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800/80 transition-colors ml-1"
                  title="Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>

                {/* Dropdown menu on Hover */}
                <div className="absolute bottom-full mb-2 right-0 hidden group-hover:flex flex-col bg-slate-950 border border-slate-700 text-[10px] text-slate-300 p-2.5 rounded shadow-2xl z-50 whitespace-nowrap min-w-[140px] gap-2">
                  <div className="flex flex-col border-b border-slate-800 pb-1.5">
                    <span className="font-extrabold text-white text-xs">{user.displayName || 'Staff'}</span>
                    <span className="text-[9px] text-slate-500">{user.email}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLogout();
                    }}
                    className="flex items-center gap-1.5 py-1.5 px-2.5 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-rose-200 text-[10px] font-bold w-full transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar / Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-5 overflow-hidden">
        {/* Low Stock Warning Banner */}
        {lowMaterialsCount > 0 && activeTab !== 'inventory' && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center justify-between text-xs font-semibold text-rose-300 animate-fade-in shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Ada {lowMaterialsCount} bahan baku yang menipis! Segera lakukan restok agar penjualan tidak terhambat.</span>
            </div>
            <button
              onClick={() => setActiveTab('inventory')}
              className="px-2.5 py-1 bg-amber-600 text-white rounded hover:bg-amber-500 font-bold whitespace-nowrap ml-3 text-[10px] uppercase tracking-wider"
            >
              Lihat Gudang
            </button>
          </div>
        )}

        {/* Dynamic Tab Rendering */}
        {activeTab === 'cashier' && (
          <CashierTab
            products={products}
            rawMaterials={rawMaterials}
            onAddTransaction={handleAddTransaction}
            onSimulatePayment={handleSimulatePayment}
            transactions={transactions}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryTab
            rawMaterials={rawMaterials}
            products={products}
            onUpdateRawMaterials={handleUpdateRawMaterials}
            onUpdateProducts={handleUpdateProducts}
            onAddExpense={handleAddExpense}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsTab
            transactions={transactions}
            rawMaterials={rawMaterials}
            products={products}
            attendanceLogs={attendanceLogs}
            expenses={expenses}
            onAddExpense={handleAddExpense}
            user={user}
            token={token}
          />
        )}
      </main>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <RotateCcw className="w-6 h-6" />
              <h3 className="text-base font-black uppercase tracking-wider">Reset Semua Data Pembukuan?</h3>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Tindakan ini akan menghapus semua riwayat transaksi baru, pengeluaran operasional tambahan, dan perubahan stok gudang. Data pembukuan dan inventaris kedai <span className="font-bold text-white">Parkir Dulu</span> akan dikembalikan sepenuhnya ke data default.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 border border-slate-600 hover:bg-slate-700/50 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 uppercase tracking-wider transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={executeResetDatabase}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-rose-900/40 transition-all cursor-pointer"
              >
                Ya, Reset Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
