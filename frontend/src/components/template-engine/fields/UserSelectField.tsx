import React from 'react';
import { useUsersQuery } from '@/hooks/queries/useUsersQuery';

interface UserSelectFieldProps {
  id: string;
  value: any;
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
  role?: string; // optional role filter e.g. 'buyer', 'sqd'
}

/**
 * Dropdown that loads real users from the /api/v1/users backend endpoint.
 * Falls back gracefully to an empty list with a clear loading/error state.
 * Always controlled (value is always a string, never undefined).
 */
export const UserSelectField: React.FC<UserSelectFieldProps> = ({
  id,
  value,
  onChange,
  disabled = false,
  className = '',
  role,
}) => {
  const { data, isLoading, isError } = useUsersQuery({ pageSize: 200 });
  const apiUsers = data?.items ?? [];

  // Filter by role if specified
  const users = role
    ? apiUsers.filter((u) => u.role?.toLowerCase() === role.toLowerCase())
    : apiUsers;

  const getUserLabel = (u: (typeof apiUsers)[0]): string => {
    const firstName = u.firstName || u.first_name || '';
    const lastName = u.lastName || u.last_name || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const roleLabel = u.role ? ` (${u.role.replace(/_/g, ' ')})` : '';
    return fullName ? `${fullName}${roleLabel}` : `${u.email}${roleLabel}`;
  };

  // Always a string — prevents uncontrolled → controlled warning
  const strValue = value != null ? String(value) : '';

  // If the stored value is not in the current user list, show it as a standalone option
  const hasValueInList =
    !strValue ||
    users.some((u) => u.id === strValue || u.email === strValue);

  return (
    <select
      id={id}
      value={strValue}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || isLoading}
      className={`${className} cursor-pointer`}
    >
      <option value="" className="bg-card text-muted-foreground">
        {isLoading ? '-- Loading users...' : isError ? '-- Failed to load users --' : '-- Assign User --'}
      </option>

      {/* Preserve existing stored value if not found in list */}
      {strValue && !hasValueInList && (
        <option value={strValue} className="bg-card text-primary font-bold">
          {strValue} (stored)
        </option>
      )}

      {users.map((u) => (
        <option key={u.id} value={u.id} className="bg-card text-foreground">
          {getUserLabel(u)}
        </option>
      ))}
    </select>
  );
};
