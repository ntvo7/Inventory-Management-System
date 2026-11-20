import { formatPrice } from '../api.js';

export default function ProductTable({ products, onSelect }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Price</th>
            <th>Category</th>
            <th>Quantity</th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr>
              <td colSpan={4}>No products found.</td>
            </tr>
          ) : (
            products.map((p) => (
              <tr key={p.s_id} onClick={() => onSelect(p)}>
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
