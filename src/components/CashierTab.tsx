import React, { useState } from 'react';
import { 
  Search, ShoppingBag, Trash2, Plus, Minus, QrCode, 
  Wallet, CreditCard, DollarSign, CheckCircle2, ShoppingCart, HelpCircle 
} from 'lucide-react';
import { Product, RawMaterial, Transaction, PaymentMethod } from '../types';

interface CashierTabProps {
  products: Product[];
  rawMaterials: RawMaterial[];
  onAddTransaction: (transactionData: {
    items: { productId: string; name: string; quantity: number; price: number }[];
    totalAmount: number;
    paymentMethod: PaymentMethod;
    notes?: string;
  }) => Promise<any>;
  onSimulatePayment: (txId: string) => Promise<void>;
  transactions: Transaction[];
}

export const CashierTab: React.FC<CashierTabProps> = ({
  products,
  rawMaterials,
  onAddTransaction,
  onSimulatePayment,
  transactions
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [checkoutResult, setCheckoutResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [mobileActiveSubTab, setMobileActiveSubTab] = useState<'menu' | 'cart'>('menu');

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Cart operations
  const addToCart = (product: Product) => {
    // Check ingredient limits if any ingredients exist
    if (!hasEnoughStock(product, 1)) {
      alert(`Stok bahan baku tidak mencukupi untuk membuat ${product.name}!`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (!hasEnoughStock(product, existing.quantity + 1)) {
          alert(`Stok bahan baku tidak mencukupi untuk menambah porsi ${product.name}!`);
          return prev;
        }
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === productId);
      if (!existing) return prev;

      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        return prev.filter(item => item.product.id !== productId);
      }

      if (delta > 0 && !hasEnoughStock(existing.product, newQty)) {
        alert(`Stok bahan baku tidak mencukupi untuk menambah porsi ${existing.product.name}!`);
        return prev;
      }

      return prev.map(item => 
        item.product.id === productId 
          ? { ...item, quantity: newQty } 
          : item
      );
    });
  };

  const clearCart = () => setCart([]);

  // Check if there is enough raw materials for a product at a given quantity
  const hasEnoughStock = (product: Product, quantity: number): boolean => {
    if (!product.ingredients || product.ingredients.length === 0) return true;
    
    return product.ingredients.every(ingredient => {
      const material = rawMaterials.find(m => m.id === ingredient.materialId);
      if (!material) return false;
      // Sum other cart items using same material
      const otherUsage = cart
        .filter(item => item.product.id !== product.id)
        .reduce((sum, item) => {
          const ing = item.product.ingredients.find(i => i.materialId === ingredient.materialId);
          return sum + (ing ? ing.quantityNeeded * item.quantity : 0);
        }, 0);

      const totalNeeded = (ingredient.quantityNeeded * quantity) + otherUsage;
      return material.stock >= totalNeeded;
    });
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  };

  const getPaymentIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'cash': return <DollarSign className="w-5 h-5" />;
      case 'qris': return <QrCode className="w-5 h-5" />;
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'coffee': return 'Kopi';
      case 'non-coffee': return 'Non-Kopi';
      case 'food': return 'Makanan';
      case 'snack': return 'Cemilan';
      default: return cat;
    }
  };

  // Submit checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setMobileActiveSubTab('cart');
    setLoading(true);

    const items = cart.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      price: item.product.price
    }));

    const totalAmount = getCartTotal();

    try {
      const result = await onAddTransaction({
        items,
        totalAmount,
        paymentMethod,
        notes: notes || undefined
      });
      
      setCheckoutResult(result);
      if (paymentMethod === 'cash') {
        setCart([]);
        setNotes('');
        setCashReceived('');
      }
    } catch (err) {
      console.error(err);
      alert('Gagal memproses checkout.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatedPayment = async () => {
    if (!checkoutResult?.transaction) return;
    setLoading(true);
    try {
      await onSimulatePayment(checkoutResult.transaction.id);
      setCheckoutResult((prev: any) => ({
        ...prev,
        transaction: {
          ...prev.transaction,
          paymentStatus: 'success'
        }
      }));
      setCart([]);
      setNotes('');
    } catch (err) {
      console.error(err);
      alert('Gagal mensimulasikan pembayaran.');
    } finally {
      setLoading(false);
    }
  };

  const total = getCartTotal();
  const parsedCashReceived = parseFloat(cashReceived.replace(/[^0-9]/g, '')) || 0;
  const change = parsedCashReceived >= total ? parsedCashReceived - total : 0;

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 h-auto lg:h-[calc(100vh-140px)]">
      {/* Mobile view sub-tabs toggler */}
      <div className="flex lg:hidden bg-slate-800 p-1 rounded-lg border border-slate-700">
        <button
          onClick={() => setMobileActiveSubTab('menu')}
          className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
            mobileActiveSubTab === 'menu'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>Menu ({filteredProducts.length})</span>
        </button>
        <button
          onClick={() => setMobileActiveSubTab('cart')}
          className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-1.5 relative ${
            mobileActiveSubTab === 'cart'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Keranjang ({cart.reduce((sum, item) => sum + item.quantity, 0)})</span>
          {cart.length > 0 && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
          )}
        </button>
      </div>

      {/* Left side: Menu Products Selection */}
      <div className={`lg:col-span-7 flex flex-col h-[520px] lg:h-full bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md overflow-hidden ${
        mobileActiveSubTab === 'menu' ? 'flex' : 'hidden lg:flex'
      }`}>
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari menu kopi, makanan..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {['all', 'coffee', 'non-coffee', 'food', 'snack'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {cat === 'all' ? 'Semua' : getCategoryLabel(cat)}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {filteredProducts.map((product) => {
            const hasStock = hasEnoughStock(product, 1);
            return (
              <div
                key={product.id}
                onClick={() => hasStock && addToCart(product)}
                className={`flex flex-col justify-between p-3 rounded-lg border transition-all text-left ${
                  hasStock 
                    ? 'bg-slate-900/40 border-slate-700 hover:bg-slate-700/40 hover:border-amber-600/50 cursor-pointer text-slate-200' 
                    : 'bg-slate-950/20 border-slate-800/80 opacity-40 cursor-not-allowed text-slate-400'
                }`}
              >
                <div>
                  <span className="inline-block text-[9px] font-bold px-2 py-0.5 bg-slate-900 text-amber-400 border border-amber-500/20 rounded-md mb-2 uppercase tracking-wider">
                    {getCategoryLabel(product.category)}
                  </span>
                  <h4 className="font-bold text-slate-100 text-xs leading-snug line-clamp-2">
                    {product.name}
                  </h4>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="font-bold text-white font-mono text-xs">
                    Rp {product.price.toLocaleString('id-ID')}
                  </span>
                  {hasStock ? (
                    <span className="p-1 bg-amber-600 text-white rounded hover:bg-amber-500 transition-colors">
                      <Plus className="w-3 h-3" />
                    </span>
                  ) : (
                    <span className="text-[9px] text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">
                      Habis
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 text-xs font-medium">
              Tidak ada menu kopi atau makanan yang cocok.
            </div>
          )}
        </div>
      </div>

      {/* Right side: Cart and Checkout Actions */}
      <div className={`lg:col-span-5 flex flex-col h-[580px] lg:h-full bg-slate-800 rounded-xl border border-slate-700 shadow-md overflow-hidden ${
        mobileActiveSubTab === 'cart' ? 'flex' : 'hidden lg:flex'
      }`}>
        {checkoutResult ? (
          /* Payment Processing Screen */
          <div className="flex flex-col h-full p-4 justify-between overflow-y-auto">
            <div className="text-center">
              <div className="inline-flex p-3 bg-slate-900 border border-slate-700 rounded-full mb-3 text-amber-500 animate-pulse">
                {getPaymentIcon(checkoutResult.transaction.paymentMethod)}
              </div>
              <h3 className="font-bold text-base text-white">
                {checkoutResult.transaction.paymentStatus === 'success' 
                  ? 'Transaksi Berhasil!' 
                  : 'Menunggu Pembayaran'}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                Ref: {checkoutResult.transaction.paymentGatewayRef || checkoutResult.transaction.id}
              </p>

              {/* Total Card */}
              <div className="mt-3 p-3.5 bg-slate-900 rounded-lg border border-slate-700 text-center">
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">Total Tagihan</span>
                <span className="text-xl font-extrabold text-emerald-400 font-mono block mt-1">
                  Rp {checkoutResult.transaction.totalAmount.toLocaleString('id-ID')}
                </span>
                <div className="text-[10px] text-slate-400 mt-1 font-medium">
                  Metode: <span className="uppercase font-bold text-amber-400">{checkoutResult.transaction.paymentMethod}</span>
                </div>
              </div>

              {/* Specific Gateway Details */}
              {checkoutResult.transaction.paymentStatus === 'pending' && (
                <div className="mt-4 flex flex-col items-center">
                  {checkoutResult.qrCodeData ? (
                    <div className="flex flex-col items-center p-3 border border-slate-700 rounded-lg bg-slate-900 max-w-xs w-full">
                      <div className="bg-rose-500 text-white text-[9px] font-bold px-2 py-0.5 rounded mb-2 uppercase tracking-widest">
                        QRIS DYNAMIC
                      </div>
                      {/* Generates a nice SVG or CSS grid that looks like a QR Code */}
                      <div className="w-40 h-40 bg-white p-2 flex items-center justify-center border-4 border-slate-800 rounded relative">
                        <QrCode className="w-28 h-28 text-slate-900" />
                        <span className="absolute bottom-1 text-[8px] font-mono font-bold text-slate-500 bg-white px-1">SCAN QRIS SIMULATOR</span>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-2 text-center leading-normal">
                        Scan QRIS di atas menggunakan OVO, GoPay, Dana, LinkAja, atau Mobile Banking Anda.
                      </p>
                    </div>
                  ) : (
                    <div className="w-full text-left p-3 bg-slate-900/60 rounded-lg border border-slate-700">
                      <p className="text-[11px] text-amber-400 font-medium">
                        {checkoutResult.isReal 
                          ? 'Link pembayaran Midtrans/Xendit asli berhasil dibuat.' 
                          : 'Simulator Gateway Pembayaran aktif (Belum ada API key).'}
                      </p>
                      <a
                        href={checkoutResult.paymentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2.5 inline-flex items-center justify-center w-full px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold uppercase tracking-wider shadow"
                      >
                        Buka Halaman Checkout {checkoutResult.isReal ? 'Asli' : 'Simulasi'}
                      </a>
                    </div>
                  )}

                  {/* Simulator action */}
                  <button
                    onClick={handleSimulatedPayment}
                    disabled={loading}
                    className="mt-4 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-700 text-white rounded text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Bayar Sekarang (Simulasi Sukses)
                  </button>
                  <p className="text-[9px] text-slate-500 mt-1 text-center">
                    Klik tombol di atas untuk mensimulasikan pembayaran lunas dari pelanggan.
                  </p>
                </div>
              )}

              {checkoutResult.transaction.paymentStatus === 'success' && (
                <div className="mt-6 flex flex-col items-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2" />
                  <p className="text-xs text-slate-200 font-bold">Pembayaran lunas diterima!</p>
                  <p className="text-[10px] text-slate-400 mt-1">Stok bahan baku telah dikurangi secara otomatis.</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setCheckoutResult(null)}
              className="mt-4 w-full py-2 bg-slate-900 text-slate-200 hover:bg-slate-700 rounded text-xs font-bold uppercase tracking-wider border border-slate-700"
            >
              Kembali ke Kasir
            </button>
          </div>
        ) : (
          /* POS Cart & Checkout Selection Screen */
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-3 border-b border-slate-700 flex items-center justify-between bg-slate-900/30">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-white text-xs uppercase tracking-wider">Keranjang Belanja</h3>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 uppercase tracking-wider"
                >
                  <Trash2 className="w-3 h-3" />
                  Kosongkan
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center justify-between border-b border-slate-700/50 pb-2.5">
                  <div className="flex-1 min-w-0 pr-2">
                    <h5 className="font-bold text-white text-xs truncate">{item.product.name}</h5>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Rp {item.product.price.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateCartQuantity(item.product.id, -1)}
                      className="p-1 rounded border border-slate-700 hover:bg-slate-900 text-slate-400 transition-colors"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="font-bold text-xs text-white w-4 text-center font-mono">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQuantity(item.product.id, 1)}
                      className="p-1 rounded border border-slate-700 hover:bg-slate-900 text-slate-400 transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                    <span className="font-bold text-xs text-emerald-400 font-mono w-16 text-right">
                      Rp {(item.product.price * item.quantity).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <ShoppingBag className="w-10 h-10 stroke-1 mb-2 text-slate-600" />
                  <p className="text-xs font-semibold text-slate-400">Belum ada item kopi atau makanan.</p>
                </div>
              )}
            </div>

            {/* Payment Configuration Area */}
            {cart.length > 0 && (
              <div className="p-3 border-t border-slate-700 bg-slate-900/40 space-y-3">
                {/* Notes Input */}
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Catatan Pesanan (Meja/Takeaway)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Meja 5, Ice Less Sugar"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Metode Pembayaran</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'cash', label: 'Tunai' },
                      { key: 'qris', label: 'QRIS' }
                    ].map((method) => (
                      <button
                        key={method.key}
                        onClick={() => setPaymentMethod(method.key as PaymentMethod)}
                        className={`py-1 px-1 rounded border text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all capitalize ${
                          paymentMethod === method.key
                            ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <span className="scale-75 opacity-90">{getPaymentIcon(method.key as PaymentMethod)}</span>
                        <span>{method.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cash Payment Details */}
                {paymentMethod === 'cash' && (
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-700 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Tunai Diterima:</span>
                      <div className="relative w-32">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">Rp</span>
                        <input
                          type="text"
                          className="w-full pl-6 pr-2 py-0.5 bg-slate-850 border border-slate-700 rounded text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-right"
                          placeholder="0"
                          value={cashReceived}
                          onChange={(e) => {
                             const val = e.target.value.replace(/[^0-9]/g, '');
                             setCashReceived(val ? parseInt(val).toLocaleString('id-ID') : '');
                          }}
                        />
                      </div>
                    </div>
                    {parsedCashReceived > 0 && (
                      <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-dashed border-slate-700">
                        <span className="text-slate-400">Uang Kembalian:</span>
                        <span className={`font-mono ${change > 0 ? 'text-emerald-400 font-extrabold' : 'text-slate-300'}`}>
                          Rp {change.toLocaleString('id-ID')}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Totals and Checkout Trigger */}
                <div className="pt-2 border-t border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-slate-300 uppercase tracking-widest">Total Tagihan:</span>
                    <span className="font-extrabold text-lg text-emerald-400 font-mono">
                      Rp {total.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={loading || (paymentMethod === 'cash' && parsedCashReceived < total && total > 0)}
                    className="w-full py-2 px-4 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-700 disabled:cursor-not-allowed text-white rounded text-xs font-bold uppercase tracking-widest shadow-sm transition-colors"
                  >
                    {loading ? 'Memproses...' : paymentMethod === 'cash' ? 'Selesaikan Transaksi (Cash)' : 'Buat Tagihan Gateway / QRIS'}
                  </button>
                  {paymentMethod === 'cash' && parsedCashReceived < total && total > 0 && (
                    <p className="text-[9px] text-rose-400 text-center mt-1 font-bold">
                      * Uang tunai yang diterima kurang dari total tagihan
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
