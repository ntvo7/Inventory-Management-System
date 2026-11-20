import { formatPrice } from '../api.js';

// onSelect is optional: Dashboard rows open the edit modal, Reports rows are read-only
export default function ProductTable({ products, onSelect, quantityLabel = 'Quantity' }) {
  return (
    <div className="table-wrap">
      <table className={onSelect ? '' : 'report-table'}>
        <thead>
          <tr>
            <th>Product</th>
            <th>Price</th>
            <th>Category</th>
            <th>{quantityLabel}</th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr>
              <td colSpan={4}>No products found.</td>
            </tr>
          ) : (
            products.map((p) => (
              <tr key={p.s_id} onClick={onSelect ? () => onSelect(p) : undefined}>
                <td>{p.s_name}</td>
                <td>{formatPrice(p.s_price)}</td>
                <td>{p.s_category}</td>
                <td>{p.instock}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
