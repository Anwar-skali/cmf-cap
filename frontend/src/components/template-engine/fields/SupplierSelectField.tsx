import React from 'react';
import { useSuppliersQuery } from '@/hooks/queries/useSuppliersQuery';

interface SupplierSelectFieldProps {
  id: string;
  value: any;
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_SUPPLIERS = [
  { id: 'def_plastic_omnium', name: 'Plastic Omnium Exterior', code: 'PO-01' },
  { id: 'def_valeo', name: 'Valeo Automotive Systems', code: 'VAL-01' },
  { id: 'def_faurecia', name: 'Faurecia Clean Mobility', code: 'FAU-01' },
  { id: 'def_michelin', name: 'Michelin Tires Corp', code: 'MICH-01' },
  { id: 'def_bosch', name: 'Robert Bosch GmbH', code: 'BOSCH-01' },
  { id: 'def_continental', name: 'Continental Automotive', code: 'CONT-01' },
  { id: 'def_magna', name: 'Magna International', code: 'MAG-01' },
  { id: 'def_zf', name: 'ZF Friedrichshafen AG', code: 'ZF-01' },
];

/**
 * Dropdown that loads suppliers from the API.
 * Stores supplier ID as value for stable references.
 * Always controlled (value is always a string, never undefined).
 */
export const SupplierSelectField: React.FC<SupplierSelectFieldProps> = ({
  id,
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const { data, isLoading, isError } = useSuppliersQuery({ pageSize: 200 });
  const apiSuppliers = data?.items ?? [];

  // Combine API suppliers and default fallback suppliers
  const supplierOptions = [...apiSuppliers];
  DEFAULT_SUPPLIERS.forEach((def) => {
    if (!supplierOptions.some((s) => s.id === def.id || s.name.toLowerCase() === def.name.toLowerCase())) {
      supplierOptions.push(def as any);
    }
  });

  // Always a string — prevents uncontrolled → controlled warning
  const strValue = value != null ? String(value) : '';

  // Resolve to ID if the stored value is a name (legacy migration)
  const resolveToId = (): string => {
    if (!strValue) return '';
    // Already an ID
    if (supplierOptions.some((s) => s.id === strValue)) return strValue;
    // Legacy: stored as name — find matching ID
    const byName = supplierOptions.find(
      (s) => s.name.toLowerCase() === strValue.toLowerCase()
    );
    if (byName) return byName.id;
    // Unknown value — keep as-is
    return strValue;
  };

  const resolvedValue = resolveToId();

  // Check if current value exists in option list
  const hasValueInOptions =
    !resolvedValue ||
    supplierOptions.some((s) => s.id === resolvedValue);

  return (
    <select
      id={id}
      value={resolvedValue}
      onChange={(e) => {
        // When the value changes, migrate legacy name to id if needed
        onChange(e.target.value);
      }}
      disabled={disabled || isLoading}
      className={`${className} cursor-pointer`}
    >
      <option value="" className="bg-card text-muted-foreground">
        {isLoading
          ? '-- Loading suppliers...'
          : isError
          ? '-- Failed to load suppliers --'
          : '-- Select Supplier --'}
      </option>

      {/* If stored value is unknown (e.g. free text), show it so it's not lost */}
      {resolvedValue && !hasValueInOptions && (
        <option value={resolvedValue} className="bg-card text-primary font-bold">
          {resolvedValue} (unknown)
        </option>
      )}

      {supplierOptions.map((s) => (
        <option key={s.id} value={s.id} className="bg-card text-foreground">
          {s.name} {s.code ? `(${s.code})` : ''}
        </option>
      ))}
    </select>
  );
};

/**
 * Helper to resolve a stored supplier ID/name to a display name.
 * Use this in the master table view and other read-only display contexts.
 */
export const resolveSupplierName = (
  value: string,
  apiSuppliers: Array<{ id: string; name: string; code?: string }>
): string => {
  if (!value) return '';
  const match = apiSuppliers.find(
    (s) =>
      s.id === value ||
      s.name.toLowerCase() === value.toLowerCase()
  );
  return match ? match.name : value;
};
