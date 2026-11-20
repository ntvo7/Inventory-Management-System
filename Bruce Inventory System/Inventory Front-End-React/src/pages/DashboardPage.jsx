import { useMemo, useState } from 'react';
import FilterBar from '../components/FilterBar.jsx';
import ProductTable from '../components/ProductTable.jsx';
import ProductModal from '../components/ProductModal.jsx';
import * as api from '../api.js';
import { useProducts } from '../useProducts.js';

export default function DashboardPage() {
  const { products, loading, error, reload } = useProducts();
  const [nameFilter, setNameFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // null = closed, { mode: 'add' } or { mode: 'update', product }
  const [modal, setModal] = useState(null);

  // Filtering happens in the browser as you type: no page reload
  const visible = useMemo(
    () => api.filterProducts(products, nameFilter, categoryFilter),
    [products, nameFilter, categoryFilter]
  );

  async function handleSave(product) {
    if (modal.mode === 'add') await api.addProduct(product);
    else await api.updateProduct({ ...product, s_id: modal.product.s_id });
    await reload(); // refresh the table first, so the modal closes onto up-to-date data
    setModal(null);
  }

  async function handleDelete() {
    await api.deleteProduct(modal.product.s_id);
    await reload();
    setModal(null);
  }

  return (
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
        <ProductTable products={visible} onSelect={(product) => setModal({ mode: 'update', product })} />
      )}

      {modal && (
        <ProductModal
          mode={modal.mode}
          product={modal.product}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </main>
  );
}
