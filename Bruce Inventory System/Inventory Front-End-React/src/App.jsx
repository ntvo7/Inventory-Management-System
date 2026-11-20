import { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import FilterBar from './components/FilterBar.jsx';
import ProductTable from './components/ProductTable.jsx';
import ProductModal from './components/ProductModal.jsx';
import * as api from './api.js';

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [nameFilter, setNameFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // null = closed, { mode: 'add' } or { mode: 'update', product }
  const [modal, setModal] = useState(null);

  async function loadProducts() {
    try {
      setError('');
      setProducts(await api.getProducts());
    } catch (e) {
      setError(`Could not load products. Is the Flask backend running? (${e.message})`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  // Filtering happens in the browser as you type: no page reload
  const visible = useMemo(
    () => api.filterProducts(products, nameFilter, categoryFilter),
    [products, nameFilter, categoryFilter]
  );

  async function handleSave(product) {
    if (modal.mode === 'add') await api.addProduct(product);
    else await api.updateProduct({ ...product, s_id: modal.product.s_id });
    setModal(null);
    await loadProducts();
  }

  async function handleDelete() {
    await api.deleteProduct(modal.product.s_id);
    setModal(null);
    await loadProducts();
  }

  return (
    <div className="layout">
      <Sidebar active="dashboard" />
      <div className="content">
        <main>
          <h2>Inventory</h2>

          <div className="action-buttons">
            <button className="btn btn-add-product" onClick={() => setModal({ mode: 'add' })}>
              Add Product
            </button>
            <button
              className="btn btn-show-all"
              onClick={() => {
                setNameFilter('');
                setCategoryFilter('');
              }}
            >
              Show All
            </button>
          </div>

          <FilterBar
            name={nameFilter}
            category={categoryFilter}
            onNameChange={setNameFilter}
            onCategoryChange={setCategoryFilter}
            count={visible.length}
            total={products.length}
          />

          {loading && <p className="status">Loading products…</p>}
          {error && <p className="status error">{error}</p>}
          {!loading && !error && (
            <ProductTable
              products={visible}
              onSelect={(product) => setModal({ mode: 'update', product })}
            />
          )}
        </main>

        {modal && (
          <ProductModal
            mode={modal.mode}
            product={modal.product}
            onSave={handleSave}
            onDelete={handleDelete}
            onClose={() => setModal(null)}
          />
        )}

        <footer>© Starburn Technology · React prototype</footer>
      </div>
    </div>
  );
}
