import { useState, useMemo, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
  type Updater,
} from '@tanstack/react-table';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  Download,
  Trash2,
  AlertCircle,
  FileText,
  Loader2,
  Columns3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  onPageChange?: (page: number) => void;
  total?: number;
  currentPage?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  searchValue?: string;
  selectable?: boolean;
  onSelectedRowsChange?: (selected: TData[]) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  onExport?: () => void;
  exportLoading?: boolean;
  sorting?: SortingState;
  onSortingChange?: (sorting: Updater<SortingState>) => void;
  filterable?: boolean;
  rightContent?: ReactNode;
}

function DataTableInternal<TData extends object>({
  columns,
  data,
  pageSize = 10,
  pageSizeOptions = [10, 20, 30, 50],
  searchable = true,
  searchPlaceholder = 'Search...',
  onSearch,
  searchValue,
  selectable = false,
  onSelectedRowsChange,
  loading = false,
  error = null,
  onRetry,
  emptyMessage = 'No data found.',
  emptyIcon,
  onExport,
  exportLoading = false,
  sorting: externalSorting,
  onSortingChange: externalOnSortingChange,
  filterable = true,
  rightContent,
}: DataTableProps<TData>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const sorting = externalSorting ?? internalSorting;
  const onSortingChange = externalOnSortingChange ?? setInternalSorting;

  const pagination = {
    pageIndex: 0,
    pageSize,
  };

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
    onSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
  });

  const selectedRows = useMemo(() => {
    return table.getSelectedRowModel().rows.map((row) => row.original);
  }, [rowSelection, data]);

  if (error) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
        <h3 className="mb-2 text-lg font-semibold">Error Loading Data</h3>
        <p className="mb-4 text-sm text-muted-foreground">{error}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Try Again
          </Button>
        )}
      </div>
    );
  }

  const sortableHeader = (header: { id: string; isPlaceholder: boolean; column: { columnDef: { header: unknown }; getToggleSortingHandler: () => (() => void) | undefined; getIsSorted: () => false | 'asc' | 'desc' }; getContext: () => unknown }) => {
    if (header.isPlaceholder) return null;
    const sorted = header.column.getIsSorted();
    const SortIcon = sorted === 'asc' ? ChevronUp : sorted === 'desc' ? ChevronDown : ChevronsUpDown;
    return (
      <button
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        onClick={header.column.getToggleSortingHandler()}
      >
        {flexRender(header.column.columnDef.header as never, header.getContext() as never)}
        <SortIcon className="h-3.5 w-3.5" />
      </button>
    );
  };

  const hasNameColumn = columns.some((c: unknown) => {
    const col = c as Record<string, unknown>;
    return col.accessorKey === 'name' || col.id === 'name';
  });
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        {searchable && !onSearch && hasNameColumn && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder={searchPlaceholder}
              value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
              onChange={(e) => table.getColumn('name')?.setFilterValue(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm shadow-soft transition-all duration-200 placeholder:text-muted-foreground/60 hover:border-muted-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring"
            />
          </div>
        )}
        {searchable && onSearch && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder={searchPlaceholder}
              value={searchValue ?? ''}
              onChange={(e) => onSearch(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm shadow-soft transition-all duration-200 placeholder:text-muted-foreground/60 hover:border-muted-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring"
            />
          </div>
        )}
        <div className="flex-1" />
        {rightContent}
        {filterable && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    onCheckedChange={(value) => col.toggleVisibility(!!value)}
                  >
                    {col.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport} disabled={exportLoading}>
            {exportLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.column.getCanSort() ? sortableHeader(header as never) : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {columns.map((_, colIndex) => (
                    <TableCell key={colIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    {emptyIcon ?? <FileText className="mb-2 h-8 w-8 text-muted-foreground/40" />}
                    <p>{emptyMessage}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {selectable && <span>{table.getSelectedRowModel().rows.length} of {table.getRowCount()} selected</span>}
          {pageSizeOptions.length > 1 && (
            <div className="flex items-center gap-1">
              <span>Rows per page:</span>
              <select
                className="rounded-lg border border-input bg-background px-2 py-1 text-sm shadow-soft transition-colors hover:border-muted-foreground/25"
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  table.setPageSize(newSize);
                }}
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

const DataTable = DataTableInternal;

(DataTable as unknown as { displayName: string }).displayName = 'DataTable';

export { DataTable };
export type { DataTableProps, ColumnDef, SortingState, ColumnFiltersState, VisibilityState, RowSelectionState };
