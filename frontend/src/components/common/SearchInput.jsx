import { FiSearch } from 'react-icons/fi';

export const SearchInput = ({ value, onChange, placeholder = 'Search...' }) => (
  <div className="relative">
    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="input pl-9 w-64"
    />
  </div>
);
