import { CATEGORIES } from '../api.js';

// Name + category filter used by Dashboard and Reports. Filters apply as you type.
export default function FilterBar({ name, category, onNameChange, onCategoryChange, count, total }) {
  return (
    <div className="filter-section print-hide">
      <div className="filter-form">
        <label htmlFor="nfilter" className="form-label">Filter by Product Name:</label>
        <input
          id="nfilter"
          className="form-select"
          placeholder="Enter Name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
        <label htmlFor="filter" className="form-label">Category:</label>
        <select
          id="filter"
          className="form-select"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="">All</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {count !== undefined && (
          <span className="result-count">
            Showing {count} of {total}
          </span>
        )}
      </div>
    </div>
  );
}
