import { useEffect, useState } from 'react';
import { FileSpreadsheet, Clock, CheckCircle2, AlertTriangle, User, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getImportHistory, type ImportHistoryRecord } from '@/api/endpoints/importApi';

export function ImportHistoryTable() {
  const [history, setHistory] = useState<ImportHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const records = await getImportHistory(50);
      setHistory(records);
    } catch (err) {
      console.error('Failed to fetch import history', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Import History & Audit Log</h3>
          <p className="text-xs text-muted-foreground">Historical records of all bulk Excel data ingestions</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHistory} disabled={isLoading} className="gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>File Name</TableHead>
              <TableHead className="text-center">Total Rows</TableHead>
              <TableHead className="text-center">Created / Updated</TableHead>
              <TableHead className="text-center">Skipped</TableHead>
              <TableHead className="text-center">Duration</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                  Loading import history logs...
                </TableCell>
              </TableRow>
            ) : history.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                  No past import transactions found.
                </TableCell>
              </TableRow>
            ) : (
              history.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="text-xs font-medium">
                    {record.createdAt ? new Date(record.createdAt).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {record.userEmail}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {record.entityType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-medium text-xs">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-primary shrink-0" />
                      {record.fileName}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-bold text-xs">{record.totalRows}</TableCell>
                  <TableCell className="text-center text-xs">
                    <span className="text-emerald-600 font-bold">+{record.importedCount}</span> /{' '}
                    <span className="text-blue-600 font-bold">{record.updatedCount}</span>
                  </TableCell>
                  <TableCell className="text-center text-xs text-amber-600 font-semibold">
                    {record.skippedCount}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {(record.durationMs / 1000).toFixed(2)}s
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        record.status === 'completed'
                          ? 'secondary'
                          : record.status === 'partial'
                          ? 'warning'
                          : 'destructive'
                      }
                      className={record.status === 'completed' ? 'bg-emerald-500/10 text-emerald-700' : undefined}
                    >
                      {record.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
