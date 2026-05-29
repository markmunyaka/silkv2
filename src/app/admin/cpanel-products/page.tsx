'use client';

import { useState, useEffect } from 'react';

interface CpanelProduct {
  id: string;
  name: string;
  specs: string;
  diskSpace: string;
  bandwidth: string;
  websites: number;
  emailAccounts: number;
  databases: number;
  ssl: boolean;
  location: string;
  price: number;
  priceUnit: string;
  stock: number;
  isActive: boolean;
  features: string[];
  createdAt: string;
}

const defaultProduct = {
  name: '', specs: '', diskSpace: '', bandwidth: '',
  websites: 1, emailAccounts: 5, databases: 10, ssl: true,
  location: '🇺🇸 USA · New York', price: 0, priceUnit: 'month',
  stock: 0, isActive: true, features: ['cPanel / WHM Access'],
};

export default function CpanelProductsPage() {
  const [products, setProducts] = useState<CpanelProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultProduct);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchProducts = () => {
    setLoading(true);
    fetch('/api/admin/store/cpanel')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setProducts(json.data);
        else setProducts([]);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleEdit = (p: CpanelProduct) => {
    setForm({
      name: p.name, specs: p.specs, diskSpace: p.diskSpace, bandwidth: p.bandwidth,
      websites: p.websites, emailAccounts: p.emailAccounts, databases: p.databases,
      ssl: p.ssl, location: p.location, price: p.price, priceUnit: p.priceUnit,
      stock: p.stock, isActive: p.isActive, features: p.features,
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    const res = await fetch(`/api/admin/store/cpanel?id=${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.ok) fetchProducts();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const url = '/api/admin/store/cpanel';
      const method = editingId ? 'PATCH' : 'POST';
      const body = editingId ? { id: editingId, ...form } : form;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to save');
      setShowForm(false);
      setEditingId(null);
      setForm(defaultProduct);
      fetchProducts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-foreground-secondary">Manage your cPanel hosting product catalog</p>
        </div>
        <button onClick={() => { setEditingId(null); setForm(defaultProduct); setShowForm(true); }} className="px-5 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-lg transition-all">
          + Add cPanel Product
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">{error}</div>}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-lg rounded-2xl border border-white/10 p-6 w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-serif text-white">{editingId ? 'Edit cPanel Product' : 'New cPanel Product'}</h3>
              <button onClick={() => setShowForm(false)} className="text-foreground-secondary hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-foreground-secondary mb-1">Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full py-2 px-3 text-sm rounded-lg border border-white/10 bg-white/5 text-white focus:border-accent-gold focus:outline-none" required /></div>
                <div><label className="block text-xs text-foreground-secondary mb-1">Specs</label><input value={form.specs} onChange={(e) => setForm({ ...form, specs: e.target.value })} className="w-full py-2 px-3 text-sm rounded-lg border border-white/10 bg-white/5 text-white focus:border-accent-gold focus:outline-none" /></div>
                <div><label className="block text-xs text-foreground-secondary mb-1">Disk Space</label><input value={form.diskSpace} onChange={(e) => setForm({ ...form, diskSpace: e.target.value })} className="w-full py-2 px-3 text-sm rounded-lg border border-white/10 bg-white/5 text-white focus:border-accent-gold focus:outline-none" /></div>
                <div><label className="block text-xs text-foreground-secondary mb-1">Bandwidth</label><input value={form.bandwidth} onChange={(e) => setForm({ ...form, bandwidth: e.target.value })} className="w-full py-2 px-3 text-sm rounded-lg border border-white/10 bg-white/5 text-white focus:border-accent-gold focus:outline-none" /></div>
                <div><label className="block text-xs text-foreground-secondary mb-1">Websites (-1 = unlimited)</label><input type="number" value={form.websites} onChange={(e) => setForm({ ...form, websites: parseInt(e.target.value) || 0 })} className="w-full py-2 px-3 text-sm rounded-lg border border-white/10 bg-white/5 text-white focus:border-accent-gold focus:outline-none" /></div>
                <div><label className="block text-xs text-foreground-secondary mb-1">Email Accounts (-1 = unlimited)</label><input type="number" value={form.emailAccounts} onChange={(e) => setForm({ ...form, emailAccounts: parseInt(e.target.value) || 0 })} className="w-full py-2 px-3 text-sm rounded-lg border border-white/10 bg-white/5 text-white focus:border-accent-gold focus:outline-none" /></div>
                <div><label className="block text-xs text-foreground-secondary mb-1">Databases (-1 = unlimited)</label><input type="number" value={form.databases} onChange={(e) => setForm({ ...form, databases: parseInt(e.target.value) || 0 })} className="w-full py-2 px-3 text-sm rounded-lg border border-white/10 bg-white/5 text-white focus:border-accent-gold focus:outline-none" /></div>
                <div><label className="block text-xs text-foreground-secondary mb-1">Location</label><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full py-2 px-3 text-sm rounded-lg border border-white/10 bg-white/5 text-white focus:border-accent-gold focus:outline-none" /></div>
                <div><label className="block text-xs text-foreground-secondary mb-1">Price *</label><input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="w-full py-2 px-3 text-sm rounded-lg border border-white/10 bg-white/5 text-white focus:border-accent-gold focus:outline-none" required /></div>
                <div><label className="block text-xs text-foreground-secondary mb-1">Price Unit</label><select value={form.priceUnit} onChange={(e) => setForm({ ...form, priceUnit: e.target.value })} className="w-full py-2 px-3 text-sm rounded-lg border border-white/10 bg-white/5 text-white focus:border-accent-gold focus:outline-none"><option value="month">Per Month</option><option value="year">Per Year</option></select></div>
                <div><label className="block text-xs text-foreground-secondary mb-1">Stock *</label><input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} className="w-full py-2 px-3 text-sm rounded-lg border border-white/10 bg-white/5 text-white focus:border-accent-gold focus:outline-none" required /></div>
              </div>
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">SSL Included</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.ssl} onChange={(e) => setForm({ ...form, ssl: e.target.checked })} className="accent-accent-gold" /><span className="text-sm text-foreground-secondary">{form.ssl ? 'Yes' : 'No'}</span></label>
              </div>
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">Features (one per line)</label>
                <textarea value={form.features.join('\n')} onChange={(e) => setForm({ ...form, features: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} rows={4} className="w-full py-2 px-3 text-sm rounded-lg border border-white/10 bg-white/5 text-white focus:border-accent-gold focus:outline-none" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="accent-accent-gold" />
                <span className="text-sm text-foreground-secondary">Active (visible in store)</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 text-sm rounded-xl border border-white/10 text-foreground-secondary hover:text-white">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-accent-gold to-accent-gold-light text-black disabled:opacity-50">
                  {saving ? 'Saving...' : editingId ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="glass-lg rounded-xl p-8 text-center"><p className="text-foreground-secondary">Loading...</p></div>
      ) : products.length === 0 ? (
        <div className="glass-lg rounded-xl p-12 text-center">
          <span className="text-4xl block mb-3">🌐</span>
          <p className="text-lg text-white mb-1">No cPanel products yet</p>
          <p className="text-sm text-foreground-secondary">Click "Add cPanel Product" to create your first one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <div key={p.id} className="glass-lg rounded-xl p-5 border border-white/5 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🌐</span>
                  <div>
                    <p className="text-white font-medium">{p.name}</p>
                    <p className="text-xs text-foreground-secondary">{p.specs} · {p.diskSpace} · ${p.price}/{p.priceUnit}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.stock > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{p.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(p)} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-foreground-secondary hover:text-white">Edit</button>
                <button onClick={() => handleDelete(p.id)} className="px-3 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}