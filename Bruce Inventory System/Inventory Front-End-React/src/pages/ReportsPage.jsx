import { useMemo, useState } from 'react';
import FilterBar from '../components/FilterBar.jsx';
import ProductTable from '../components/ProductTable.jsx';
import { filterProducts, LOW_STOCK_THRESHOLD } from '../api.js';
import { useProducts } from '../useProducts.js';

export default function ReportsPage() {
  const { products, loading, error } = useProducts();
  const [nameFilter, setNameFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const filtered = useMemo(
    () => filterProducts(products, nameFilter, categoryFilter),
    [products, nameFilter, categoryFilter]
  );
  // same rules as server.js /reports: low = 1 to 9 on hand, out = 0
  const low = filtered.filter((p) => p.instock > 0 && p.instock < LOW_STOCK_THRESHOLD);
  const out = filtered.filter((p) => p.instock === 0);

  return (
    <main>
      <h2>Report</h2>

      <div className="action-buttons print-hide">
        <button className="btn btn-print" onClick={() => window.print()}>Print Report</button>
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
      />

      {loading && <p className="status">Loading products…</p>}
      {error && <p className="status error">{error}</p>}
      {!loading && !error && (
        <>
          <h3>Low Stock Products</h3>
          <ProductTable products={low} quantityLabel="Onhand" />
          <h3>Out of Stock Products</h3>
          <ProductTable products={out} quantityLabel="Onhand" />
        </>
      )}
    </main>
  );
}
