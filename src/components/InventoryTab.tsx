import React, { useState } from 'react';
import { 
  Layers, Plus, RotateCcw, AlertTriangle, ArrowRight, CheckCircle2, 
  HelpCircle, Settings, Edit, ShoppingCart, DollarSign, ListFilter, Trash2
} from 'lucide-react';
import { RawMaterial, Product, Ingredient } from '../types';

interface InventoryTabProps {
  rawMaterials: RawMaterial[];
  products: Product[];
  onUpdateRawMaterials: (materials: RawMaterial[]) => Promise<void>;
  onUpdateProducts: (products: Product[]) => Promise<void>;
  onAddExpense: (expenseData: { category: 'utility' | 'rent' | 'marketing' | 'other' | 'salary'; amount: number; description: string }) => Promise<void>;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
  rawMaterials,
  products,
  onUpdateRawMaterials,
  onUpdateProducts,
  onAddExpense
}) => {
  // Stock restock modal state
  const [restockMaterialId, setRestockMaterialId] = useState<string | null>(null);
  const [restockQuantity, setRestockQuantity] = useState('');
  const [restockCost, setRestockCost] = useState('');
  const [restockNotes, setRestockNotes] = useState('');

  // Add material state
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [newMatName, setNewMatName] = useState('');
  const [newMatStock, setNewMatStock] = useState('');
  const [newMatUnit, setNewMatUnit] = useState('gram');
  const [newMatMinStock, setNewMatMinStock] = useState('');
  const [newMatUnitCost, setNewMatUnitCost] = useState('');

  // Recipe linking state
  const [selectedProductForRecipe, setSelectedProductForRecipe] = useState<Product | null>(null);
  const [recipeIngredientMaterialId, setRecipeIngredientMaterialId] = useState('');
  const [recipeIngredientQty, setRecipeIngredientQty] = useState('');

  // Add product state
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<'coffee' | 'non-coffee' | 'food' | 'snack'>('coffee');

  // Modal sub-tab state & edit values
  const [modalTab, setModalTab] = useState<'recipe' | 'edit'>('recipe');
  const [editProdName, setEditProdName] = useState('');
  const [editProdPrice, setEditProdPrice] = useState('');
  const [editProdCategory, setEditProdCategory] = useState<'coffee' | 'non-coffee' | 'food' | 'snack'>('coffee');

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockMaterialId) return;

    const qty = parseFloat(restockQuantity);
    const cost = parseFloat(restockCost);
    if (isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) {
      alert('Mohon masukkan jumlah dan total biaya yang valid.');
      return;
    }

    const updated = rawMaterials.map(m => {
      if (m.id === restockMaterialId) {
        // Calculate new weighted-average unit cost
        const currentTotalCost = m.stock * m.unitCost;
        const newTotalCost = currentTotalCost + cost;
        const newStock = m.stock + qty;
        const newUnitCost = newStock > 0 ? Math.round(newTotalCost / newStock) : m.unitCost;

        return {
          ...m,
          stock: newStock,
          unitCost: newUnitCost
        };
      }
      return m;
    });

    try {
      await onUpdateRawMaterials(updated);

      // Record this purchase as an Operational Expense (HPP / Bahan Baku category)
      const materialName = rawMaterials.find(m => m.id === restockMaterialId)?.name || 'Bahan Baku';
      await onAddExpense({
        category: 'other',
        amount: cost,
        description: `Restok ${qty} ${rawMaterials.find(m => m.id === restockMaterialId)?.unit} ${materialName} (${restockNotes || 'Tanpa catatan'})`
      });

      // Clear state
      setRestockMaterialId(null);
      setRestockQuantity('');
      setRestockCost('');
      setRestockNotes('');
      alert('Restok berhasil dicatat dan masuk ke pengeluaran operasional!');
    } catch (err) {
      console.error(err);
      alert('Gagal memperbarui stok bahan baku.');
    }
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatName.trim() || !newMatStock || !newMatMinStock || !newMatUnitCost) {
      alert('Mohon isi semua field bahan baku baru.');
      return;
    }

    const newMaterial: RawMaterial = {
      id: `mat-${Date.now()}`,
      name: newMatName.trim(),
      stock: parseFloat(newMatStock),
      unit: newMatUnit,
      minStock: parseFloat(newMatMinStock),
      unitCost: parseFloat(newMatUnitCost)
    };

    try {
      await onUpdateRawMaterials([...rawMaterials, newMaterial]);
      setIsAddingMaterial(false);
      setNewMatName('');
      setNewMatStock('');
      setNewMatMinStock('');
      setNewMatUnitCost('');
      alert('Bahan baku baru berhasil ditambahkan!');
    } catch (err) {
      console.error(err);
      alert('Gagal menambahkan bahan baku.');
    }
  };

  const handleAddRecipeIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForRecipe || !recipeIngredientMaterialId || !recipeIngredientQty) return;

    const qty = parseFloat(recipeIngredientQty);
    if (isNaN(qty) || qty <= 0) {
      alert('Mohon masukkan takaran bahan baku yang valid.');
      return;
    }

    const updatedProducts = products.map(p => {
      if (p.id === selectedProductForRecipe.id) {
        const ingredients = p.ingredients ? [...p.ingredients] : [];
        const existingIdx = ingredients.findIndex(i => i.materialId === recipeIngredientMaterialId);
        
        if (existingIdx !== -1) {
          ingredients[existingIdx].quantityNeeded = qty;
        } else {
          ingredients.push({ materialId: recipeIngredientMaterialId, quantityNeeded: qty });
        }

        return { ...p, ingredients };
      }
      return p;
    });

    try {
      await onUpdateProducts(updatedProducts);
      
      // Update local product state in recipe modal
      const refreshedProd = updatedProducts.find(p => p.id === selectedProductForRecipe.id);
      if (refreshedProd) {
        setSelectedProductForRecipe(refreshedProd);
      }

      setRecipeIngredientMaterialId('');
      setRecipeIngredientQty('');
      alert('Resep berhasil diperbarui!');
    } catch (err) {
      console.error(err);
      alert('Gagal memperbarui resep menu.');
    }
  };

  const handleRemoveRecipeIngredient = async (materialId: string) => {
    if (!selectedProductForRecipe) return;

    const updatedProducts = products.map(p => {
      if (p.id === selectedProductForRecipe.id) {
        const ingredients = (p.ingredients || []).filter(i => i.materialId !== materialId);
        return { ...p, ingredients };
      }
      return p;
    });

    try {
      await onUpdateProducts(updatedProducts);
      
      // Update local product state
      const refreshedProd = updatedProducts.find(p => p.id === selectedProductForRecipe.id);
      if (refreshedProd) {
        setSelectedProductForRecipe(refreshedProd);
      }
      alert('Bahan berhasil dihapus dari resep.');
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus bahan resep.');
    }
  };

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newProdPrice);
    if (!newProdName.trim() || isNaN(price) || price < 0) {
      alert('Mohon isi semua field produk baru dengan benar.');
      return;
    }

    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      name: newProdName.trim(),
      price: price,
      category: newProdCategory,
      ingredients: []
    };

    try {
      await onUpdateProducts([...products, newProduct]);
      setIsAddingProduct(false);
      setNewProdName('');
      setNewProdPrice('');
      setNewProdCategory('coffee');
      alert('Menu baru berhasil ditambahkan! Silakan atur resep bahannya jika diperlukan.');
    } catch (err) {
      console.error(err);
      alert('Gagal menambahkan menu baru.');
    }
  };

  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForRecipe) return;

    const price = parseFloat(editProdPrice);
    if (!editProdName.trim() || isNaN(price) || price < 0) {
      alert('Mohon masukkan nama dan harga jual yang valid.');
      return;
    }

    const updatedProducts = products.map(p => {
      if (p.id === selectedProductForRecipe.id) {
        return {
          ...p,
          name: editProdName.trim(),
          price: price,
          category: editProdCategory
        };
      }
      return p;
    });

    try {
      await onUpdateProducts(updatedProducts);
      const refreshedProd = updatedProducts.find(p => p.id === selectedProductForRecipe.id);
      if (refreshedProd) {
        setSelectedProductForRecipe(refreshedProd);
      }
      alert('Detail menu berhasil diperbarui!');
    } catch (err) {
      console.error(err);
      alert('Gagal memperbarui detail menu.');
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProductForRecipe) return;
    if (!confirm(`Yakin ingin menghapus menu "${selectedProductForRecipe.name}"? Semua data resep menu ini juga akan terhapus.`)) return;

    const updatedProducts = products.filter(p => p.id !== selectedProductForRecipe.id);

    try {
      await onUpdateProducts(updatedProducts);
      setSelectedProductForRecipe(null);
      alert('Menu berhasil dihapus!');
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus menu.');
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    const mat = rawMaterials.find(m => m.id === materialId);
    if (!mat) return;
    
    if (!confirm(`Yakin ingin menghapus bahan baku "${mat.name}"? Bahan ini akan dihapus dari gudang dan seluruh resep menu yang menggunakannya.`)) {
      return;
    }

    const updatedMaterials = rawMaterials.filter(m => m.id !== materialId);

    const updatedProducts = products.map(p => {
      const ingredients = (p.ingredients || []).filter(i => i.materialId !== materialId);
      return { ...p, ingredients };
    });

    try {
      await onUpdateRawMaterials(updatedMaterials);
      await onUpdateProducts(updatedProducts);
      alert('Bahan baku berhasil dihapus!');
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus bahan baku.');
    }
  };

  const getStockStatus = (mat: RawMaterial) => {
    if (mat.stock <= 0) return { label: 'Habis', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    if (mat.stock <= mat.minStock) return { label: 'Menipis', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' };
    return { label: 'Aman', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  };

  return (
    <div className="space-y-4">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-white uppercase tracking-tight flex items-center gap-2">
            <Layers className="text-amber-500 w-5 h-5" />
            Stok & Bahan Baku Kedai
          </h2>
          <p className="text-[10px] text-slate-400 font-medium">
            Kelola ketersediaan kopi, susu, sirup gula, dan hubungkan resep menu untuk automasi pencatatan stok.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsAddingMaterial(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-bold uppercase tracking-wider transition-colors self-start shadow-sm border border-slate-600"
          >
            <Plus className="w-3.5 h-3.5 text-slate-300" />
            Tambah Bahan Baku
          </button>
          <button
            onClick={() => setIsAddingProduct(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors self-start shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            Tambah Menu / Produk
          </button>
        </div>
      </div>

      {/* Main Stock Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Raw Materials Inventory Table */}
        <div className="md:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md flex flex-col">
          <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Gudang Penyimpanan Bahan Baku</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                  <th className="py-2.5 px-1">Nama Bahan</th>
                  <th className="py-2.5 px-1">Jumlah Stok</th>
                  <th className="py-2.5 px-1">Status</th>
                  <th className="py-2.5 px-1">Biaya / Unit</th>
                  <th className="py-2.5 px-1 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {rawMaterials.map((mat) => {
                  const status = getStockStatus(mat);
                  return (
                    <tr key={mat.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="py-2.5 px-1 font-bold text-slate-100">
                        {mat.name}
                      </td>
                      <td className="py-2.5 px-1 font-mono text-white font-bold">
                        {mat.stock.toLocaleString('id-ID')} <span className="text-[10px] text-slate-400 font-sans font-normal">{mat.unit}</span>
                      </td>
                      <td className="py-2.5 px-1">
                        <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-1 text-slate-300 font-bold font-mono">
                        Rp {mat.unitCost.toLocaleString('id-ID')} <span className="text-[9px] text-slate-500 font-normal">/{mat.unit}</span>
                      </td>
                      <td className="py-2.5 px-1 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setRestockMaterialId(mat.id)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-700 border border-slate-700 text-amber-400 rounded text-[9px] font-bold uppercase tracking-wider transition-all"
                          >
                            Restok
                          </button>
                          <button
                            onClick={() => handleDeleteMaterial(mat.id)}
                            className="p-1 bg-slate-900 hover:bg-rose-950 border border-slate-700 text-rose-400 hover:text-rose-300 rounded transition-all"
                            title="Hapus Bahan Baku"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recipes & Menu HPP Configuration Panel */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md flex flex-col">
          <div className="mb-3">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">Resep Menu & HPP</h3>
            <p className="text-[10px] text-slate-400 font-medium">Hubungkan resep menu minuman dengan stok agar bahan baku otomatis berkurang tiap penjualan.</p>
          </div>

          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {products.map((product) => {
              // Calculate estimated HPP
              const hpp = (product.ingredients || []).reduce((sum, ing) => {
                const mat = rawMaterials.find(m => m.id === ing.materialId);
                return sum + (mat ? mat.unitCost * ing.quantityNeeded : 0);
              }, 0);

              return (
                <div 
                  key={product.id} 
                  className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-700/50 flex items-center justify-between hover:bg-slate-700/40 transition-all cursor-pointer"
                  onClick={() => {
                    setSelectedProductForRecipe(product);
                    setModalTab('recipe');
                    setEditProdName(product.name);
                    setEditProdPrice(product.price.toString());
                    setEditProdCategory(product.category);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs text-slate-100 truncate">{product.name}</h5>
                    <div className="flex gap-2 items-center text-[10px] text-slate-400 mt-1">
                      <span>Harga: <strong className="text-white font-mono">Rp {product.price.toLocaleString('id-ID')}</strong></span>
                      <span>HPP: <strong className="text-emerald-400 font-mono">Rp {hpp.toLocaleString('id-ID')}</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[9px] font-bold text-slate-300 border border-slate-750 bg-slate-900 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      {(product.ingredients || []).length} bahan
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductForRecipe(product);
                        setModalTab('recipe');
                        setEditProdName(product.name);
                        setEditProdPrice(product.price.toString());
                        setEditProdCategory(product.category);
                      }}
                      className="p-1 text-slate-400 hover:text-amber-400 rounded transition-colors"
                      title="Kelola Resep & Detail"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Yakin ingin menghapus menu "${product.name}"? Semua data resep menu ini juga akan terhapus.`)) {
                          const updatedProducts = products.filter(p => p.id !== product.id);
                          try {
                            await onUpdateProducts(updatedProducts);
                            alert('Menu berhasil dihapus!');
                          } catch (err) {
                            console.error(err);
                            alert('Gagal menghapus menu.');
                          }
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
                      title="Hapus Menu"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODAL: RESTOCK MATERIAL */}
      {restockMaterialId && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-700 text-slate-200">
            <h3 className="font-extrabold text-white text-xs uppercase tracking-wider mb-1">Restok Bahan Baku</h3>
            <p className="text-[10px] text-slate-400 mb-3">
              Restok bahan baku <strong className="text-amber-400">{rawMaterials.find(m => m.id === restockMaterialId)?.name}</strong>. Data ini akan otomatis dicatat sebagai pengeluaran pembukuan.
            </p>

            <form onSubmit={handleRestock} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Jumlah ({rawMaterials.find(m => m.id === restockMaterialId)?.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold font-mono"
                    placeholder="Contoh: 1000"
                    value={restockQuantity}
                    onChange={(e) => setRestockQuantity(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Biaya (Rp)</label>
                  <input
                    type="number"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold font-mono"
                    placeholder="Total harga beli"
                    value={restockCost}
                    onChange={(e) => setRestockCost(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Catatan / Supplier</label>
                <input
                  type="text"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="Contoh: Beli di Pasar Kopi Indah"
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockMaterialId(null)}
                  className="flex-1 py-1.5 border border-slate-700 rounded text-xs font-bold text-slate-400 hover:bg-slate-900 uppercase tracking-wider"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold uppercase tracking-wider shadow-sm"
                >
                  Simpan Restok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD RAW MATERIAL */}
      {isAddingMaterial && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-700 text-slate-200">
            <h3 className="font-extrabold text-white text-xs uppercase tracking-wider mb-3">Tambah Bahan Baku Baru</h3>

            <form onSubmit={handleAddMaterial} className="space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nama Bahan Baku</label>
                <input
                  type="text"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                  placeholder="Contoh: Sirup Hazelnut, Bubuk Matcha"
                  value={newMatName}
                  onChange={(e) => setNewMatName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stok Awal</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold font-mono"
                    placeholder="Contoh: 1000"
                    value={newMatStock}
                    onChange={(e) => setNewMatStock(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Satuan</label>
                  <select
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                    value={newMatUnit}
                    onChange={(e) => setNewMatUnit(e.target.value)}
                  >
                    <option value="gram">gram (g)</option>
                    <option value="ml">mililiter (ml)</option>
                    <option value="pcs">pieces (pcs)</option>
                    <option value="butir">butir</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Batas Minimal Stok</label>
                  <input
                    type="number"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold font-mono"
                    placeholder="Peringatan jika di bawah"
                    value={newMatMinStock}
                    onChange={(e) => setNewMatMinStock(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Biaya Awal / Unit (Rp)</label>
                  <input
                    type="number"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold font-mono"
                    placeholder="Harga beli / unit"
                    value={newMatUnitCost}
                    onChange={(e) => setNewMatUnitCost(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingMaterial(false)}
                  className="flex-1 py-1.5 border border-slate-700 rounded text-xs font-bold text-slate-400 hover:bg-slate-900 uppercase tracking-wider"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold uppercase tracking-wider shadow-sm"
                >
                  Simpan Bahan Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE RECIPE & PRODUCT DETAILS */}
      {selectedProductForRecipe && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-5 shadow-xl border border-slate-700 flex flex-col max-h-[90vh] text-slate-200">
            <h3 className="font-extrabold text-white text-xs uppercase tracking-wider mb-2">
              Kelola Menu: {selectedProductForRecipe.name}
            </h3>
            
            {/* Modal Tabs */}
            <div className="flex gap-2 border-b border-slate-700 pb-2 mb-3 shrink-0">
              <button 
                onClick={() => setModalTab('recipe')}
                className={`px-3 py-1.5 rounded text-[10px] font-bold transition-all uppercase tracking-wider ${
                  modalTab === 'recipe' 
                    ? 'bg-amber-600 text-white shadow-sm' 
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                Resep &amp; HPP
              </button>
              <button 
                onClick={() => {
                  setModalTab('edit');
                  setEditProdName(selectedProductForRecipe.name);
                  setEditProdPrice(selectedProductForRecipe.price.toString());
                  setEditProdCategory(selectedProductForRecipe.category);
                }}
                className={`px-3 py-1.5 rounded text-[10px] font-bold transition-all uppercase tracking-wider ${
                  modalTab === 'edit' 
                    ? 'bg-amber-600 text-white shadow-sm' 
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                Ubah Detail Menu
              </button>
            </div>

            {modalTab === 'recipe' ? (
              <>
                <p className="text-[10px] text-slate-400 mb-3 shrink-0">
                  Konfigurasi resep agar ketika menu ini terjual, stok bahan baku akan otomatis berkurang lurus.
                </p>

                {/* List current recipe ingredients */}
                <div className="flex-1 overflow-y-auto mb-3 border-b border-slate-700 pb-3 space-y-2">
                  <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Bahan Baku Saat Ini:</h5>
                  {(selectedProductForRecipe.ingredients || []).map((ing) => {
                    const mat = rawMaterials.find(m => m.id === ing.materialId);
                    return (
                      <div key={ing.materialId} className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-700/60">
                        <span className="text-xs font-bold text-slate-200">{mat?.name || 'Bahan tidak dikenal'}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold text-white">
                            {ing.quantityNeeded} {mat?.unit}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipeIngredient(ing.materialId)}
                            className="text-[9px] font-bold text-rose-400 hover:text-rose-300 uppercase tracking-wider hover:underline"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {(!selectedProductForRecipe.ingredients || selectedProductForRecipe.ingredients.length === 0) && (
                    <div className="text-center py-6 text-xs text-slate-500 font-medium">
                      Resep masih kosong. Silakan tambahkan bahan baku di bawah.
                    </div>
                  )}
                </div>

                {/* Add ingredient form */}
                <form onSubmit={handleAddRecipeIngredient} className="bg-slate-900/50 p-3 rounded border border-slate-700 space-y-2.5 mb-3 shrink-0">
                  <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tambah / Sesuaikan Bahan:</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Pilih Bahan Baku</label>
                      <select
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 font-bold"
                        value={recipeIngredientMaterialId}
                        onChange={(e) => setRecipeIngredientMaterialId(e.target.value)}
                        required
                      >
                        <option value="">-- Pilih Bahan --</option>
                        {rawMaterials.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                        Takaran {recipeIngredientMaterialId && `(${rawMaterials.find(m => m.id === recipeIngredientMaterialId)?.unit})`}
                      </label>
                      <input
                        type="number"
                        step="any"
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold font-mono"
                        placeholder="Contoh: 18"
                        value={recipeIngredientQty}
                        onChange={(e) => setRecipeIngredientQty(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold uppercase tracking-wider shadow"
                  >
                    Simpan Bahan Resep
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col justify-between overflow-y-auto">
                <form onSubmit={handleEditProductSubmit} className="space-y-4 py-2 shrink-0">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nama Menu / Produk</label>
                    <input
                      type="text"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                      value={editProdName}
                      onChange={(e) => setEditProdName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Kategori</label>
                      <select
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                        value={editProdCategory}
                        onChange={(e) => setEditProdCategory(e.target.value as any)}
                      >
                        <option value="coffee">Kopi (Coffee)</option>
                        <option value="non-coffee">Non-Kopi (Non-Coffee)</option>
                        <option value="food">Makanan Utama (Food)</option>
                        <option value="snack">Camilan (Snack)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Harga Jual (Rp)</label>
                      <input
                        type="number"
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold font-mono"
                        value={editProdPrice}
                        onChange={(e) => setEditProdPrice(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold uppercase tracking-wider shadow"
                  >
                    Simpan Perubahan
                  </button>
                </form>

                <div className="pt-4 border-t border-slate-700 mt-4 shrink-0">
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-rose-300">Hapus Menu Ini?</h4>
                      <p className="text-[10px] text-slate-400">Tindakan ini permanen dan menghapus resep menu ini.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDeleteProduct}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedProductForRecipe(null)}
              className="w-full py-2 bg-slate-900 text-slate-200 hover:bg-slate-700 rounded text-xs font-bold uppercase tracking-wider border border-slate-700 mt-3 shrink-0"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ADD PRODUCT */}
      {isAddingProduct && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-700 text-slate-200">
            <h3 className="font-extrabold text-white text-xs uppercase tracking-wider mb-3">Tambah Menu / Produk Baru</h3>

            <form onSubmit={handleAddProductSubmit} className="space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nama Menu / Produk</label>
                <input
                  type="text"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                  placeholder="Contoh: Es Kopi Susu Senja"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Kategori</label>
                  <select
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value as any)}
                  >
                    <option value="coffee">Kopi (Coffee)</option>
                    <option value="non-coffee">Non-Kopi (Non-Coffee)</option>
                    <option value="food">Makanan Utama (Food)</option>
                    <option value="snack">Camilan (Snack)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Harga Jual (Rp)</label>
                  <input
                    type="number"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold font-mono"
                    placeholder="Contoh: 18000"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingProduct(false)}
                  className="flex-1 py-1.5 border border-slate-700 rounded text-xs font-bold text-slate-400 hover:bg-slate-900 uppercase tracking-wider"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold uppercase tracking-wider shadow-sm"
                >
                  Simpan Menu Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
