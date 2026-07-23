import { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  RefreshCw,
  SlidersHorizontal,
  Table as TableIcon,
  ShieldAlert,
  Play,
  FileCheck,
  Check,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/useToast';
import {
  previewImport,
  executeImport,
  downloadErrorReport,
  downloadTemplateFile,
  type ImportPreviewReport,
  type ImportExecutionResult,
  type ValidationError,
} from '@/api/endpoints/importApi';

interface ImportWizardProps {
  defaultEntity?: string;
  onComplete?: () => void;
}

const ENTITIES = [
  { key: 'projects', label: 'Projects', desc: 'Import CMF Project codes, names, budgets, and dates' },
  { key: 'suppliers', label: 'Suppliers', desc: 'Import vendor records, contact details, and locations' },
  { key: 'parts', label: 'Parts', desc: 'Import project parts, part numbers, units, and materials' },
  { key: 'capacity', label: 'Capacity Assessments', desc: 'Import monthly capacity and target metrics' },
  { key: 'risks', label: 'Risks', desc: 'Import project risks, severity levels, and probabilities' },
];

export function ImportWizard({ defaultEntity = 'projects', onComplete }: ImportWizardProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard Step (1 to 6)
  const [step, setStep] = useState<number>(1);
  const [entityType, setEntityType] = useState<string>(defaultEntity);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // State after Step 1 & 2
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewReport, setPreviewReport] = useState<ImportPreviewReport | null>(null);

  // Custom mapping state (excelHeader -> dbFieldKey)
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Execution configuration (Step 5)
  const [mode, setMode] = useState<'insert' | 'upsert'>('insert');
  const [strategy, setStrategy] = useState<'skip_invalid' | 'rollback_all'>('skip_invalid');
  const [isExecuting, setIsExecuting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Final summary state (Step 6)
  const [executionResult, setExecutionResult] = useState<ImportExecutionResult | null>(null);

  // Error table filter
  const [errorFilter, setErrorFilter] = useState<'all' | 'empty' | 'type' | 'duplicate'>('all');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        toast.error('Please select a valid Excel file (.xlsx or .xls)');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        toast.error('Please drop a valid Excel file (.xlsx or .xls)');
        return;
      }
      setSelectedFile(file);
    }
  };

  // Step 1 -> Step 2: Upload and generate preview
  const runPreview = async (customMap?: Record<string, string>) => {
    if (!selectedFile) return;
    setIsLoadingPreview(true);
    try {
      const report = await previewImport(selectedFile, entityType, customMap);
      setPreviewReport(report);

      // Initialize mapping state from auto mapping
      const initialMap: Record<string, string> = {};
      Object.entries(report.columnMapping).forEach(([excelCol, dbKey]) => {
        if (dbKey) {
          initialMap[excelCol] = dbKey;
        }
      });
      setMapping(initialMap);

      if (step === 1) setStep(2);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to parse Excel file preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Step 5: Execute import
  const runExecution = async () => {
    if (!selectedFile || !previewReport) return;
    setIsExecuting(true);
    setImportProgress(20);

    const progressInterval = setInterval(() => {
      setImportProgress((prev) => (prev < 90 ? prev + 15 : prev));
    }, 200);

    try {
      const result = await executeImport(selectedFile, entityType, mapping, mode, strategy);
      clearInterval(progressInterval);
      setImportProgress(100);
      setExecutionResult(result);
      toast.success(result.message);
      setStep(6);
    } catch (err: any) {
      clearInterval(progressInterval);
      setImportProgress(0);
      toast.error(err?.message || 'Import failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadTemplateFile(entityType);
    } catch (err: any) {
      toast.error('Failed to download template. Make sure you are logged in.');
    }
  };

  const handleDownloadErrorFile = async () => {
    if (!previewReport || previewReport.validationErrors.length === 0) return;
    try {
      const blob = await downloadErrorReport(previewReport.validationErrors, previewReport.fileName);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `error_report_${previewReport.fileName}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Failed to download error report');
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSelectedFile(null);
    setPreviewReport(null);
    setMapping({});
    setExecutionResult(null);
    setImportProgress(0);
  };

  // Filtered validation errors table
  const filteredErrors = previewReport?.validationErrors.filter((err) => {
    if (errorFilter === 'all') return true;
    if (errorFilter === 'empty') return err.errorType === 'EmptyValue';
    if (errorFilter === 'type') return err.errorType === 'InvalidDataType';
    if (errorFilter === 'duplicate') return err.errorType === 'DuplicateInFile';
    return true;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Wizard Header Progress Steps */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {[
            { stepNum: 1, title: 'Upload' },
            { stepNum: 2, title: 'Preview' },
            { stepNum: 3, title: 'Validation' },
            { stepNum: 4, title: 'Mapping' },
            { stepNum: 5, title: 'Import' },
            { stepNum: 6, title: 'Summary' },
          ].map((item, idx) => {
            const isCompleted = step > item.stepNum;
            const isCurrent = step === item.stepNum;
            return (
              <div key={item.stepNum} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                      ? 'bg-primary/20 text-primary border-2 border-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : item.stepNum}
                </div>
                <span className={`text-xs font-medium ${isCurrent ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                  {item.title}
                </span>
                {idx < 5 && <div className="h-0.5 w-6 bg-muted hidden md:block" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 1: UPLOAD FILE */}
      {step === 1 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" /> Step 1: Upload Excel File
            </CardTitle>
            <CardDescription>
              Select the dataset category and upload your business Excel sheet (.xlsx, .xls)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Entity Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Select Target Module *</label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select Module" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITIES.map((e) => (
                      <SelectItem key={e.key} value={e.key}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {ENTITIES.find((e) => e.key === entityType)?.desc}
                </p>
              </div>

              {/* Sample Template Link */}
              <div className="space-y-2">
                <label className="text-sm font-semibold">Sample Template</label>
                <div className="flex items-center gap-2 pt-0.5">
                  <Button variant="outline" className="w-full h-11" onClick={handleDownloadTemplate}>
                    <Download className="mr-2 h-4 w-4 text-primary" />
                    Download {ENTITIES.find((e) => e.key === entityType)?.label} Template
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Includes formatted headers and sample values for auto-mapping.
                </p>
              </div>
            </div>

            {/* Drag & Drop File Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                selectedFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary hover:bg-muted/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
              </div>
              {selectedFile ? (
                <div>
                  <h4 className="font-semibold text-lg text-primary">{selectedFile.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB — Ready to process
                  </p>
                  <Button size="sm" variant="ghost" className="mt-2 text-xs text-destructive">
                    Change file
                  </Button>
                </div>
              ) : (
                <div>
                  <h4 className="font-semibold text-base">Drag & drop your Excel file here</h4>
                  <p className="text-xs text-muted-foreground mt-1">Supports Microsoft Excel (.xlsx, .xls)</p>
                  <Button size="sm" className="mt-4">
                    Browse File
                  </Button>
                </div>
              )}
            </div>

            {/* Next Button */}
            <div className="flex justify-end">
              <Button
                disabled={!selectedFile || isLoadingPreview}
                onClick={() => runPreview()}
                size="lg"
                className="gap-2"
              >
                {isLoadingPreview ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Processing Excel...
                  </>
                ) : (
                  <>
                    Proceed to Preview <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: PREVIEW */}
      {step === 2 && previewReport && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <TableIcon className="h-5 w-5 text-primary" /> Step 2: Excel Preview
                </CardTitle>
                <CardDescription>
                  Previewing raw content from <span className="font-semibold">{previewReport.fileName}</span> (
                  {previewReport.totalRows} total data rows)
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-sm px-3 py-1">
                {previewReport.entityDisplayName} Module
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border bg-card">
                <div className="text-xs font-medium text-muted-foreground">Detected Sheet Headers</div>
                <div className="text-2xl font-bold mt-1 text-primary">{previewReport.headers.length} Columns</div>
              </div>
              <div className="p-4 rounded-xl border bg-card">
                <div className="text-xs font-medium text-muted-foreground">Total Rows Found</div>
                <div className="text-2xl font-bold mt-1">{previewReport.totalRows} Rows</div>
              </div>
              <div className="p-4 rounded-xl border bg-card">
                <div className="text-xs font-medium text-muted-foreground">Auto-Mapped Fields</div>
                <div className="text-2xl font-bold mt-1 text-emerald-600">
                  {Object.values(previewReport.columnMapping).filter(Boolean).length} / {previewReport.headers.length}
                </div>
              </div>
            </div>

            {/* Preview Table */}
            <div className="border rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted sticky top-0">
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    {previewReport.availableSchemaColumns.map((col) => (
                      <TableHead key={col.key} className="font-semibold">
                        {col.label} {col.required && <span className="text-destructive">*</span>}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewReport.previewRows.slice(0, 25).map((row, idx) => (
                    <TableRow key={idx} className={row._has_error ? 'bg-destructive/10' : undefined}>
                      <TableCell className="text-center text-xs text-muted-foreground">{row._row_index}</TableCell>
                      {previewReport.availableSchemaColumns.map((col) => (
                        <TableCell key={col.key} className="text-sm">
                          {row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : <span className="text-muted-foreground italic">-</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Upload
              </Button>
              <Button onClick={() => setStep(3)} size="lg" className="gap-2">
                View Validation Report <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: VALIDATION */}
      {step === 3 && previewReport && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" /> Step 3: Data Validation Report
                </CardTitle>
                <CardDescription>
                  Automated structural, mandatory field, duplicate, and type checks
                </CardDescription>
              </div>
              {previewReport.validationErrors.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleDownloadErrorFile} className="gap-2">
                  <Download className="h-4 w-4" /> Download Error Log
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Metric Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border bg-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Total Rows</span>
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold mt-1">{previewReport.totalRows}</div>
              </div>

              <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-600">Valid Rows</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold mt-1 text-emerald-600">{previewReport.validRowsCount}</div>
              </div>

              <div className="p-4 rounded-xl border bg-destructive/10 border-destructive/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-destructive">Invalid Rows</span>
                  <XCircle className="h-4 w-4 text-destructive" />
                </div>
                <div className="text-2xl font-bold mt-1 text-destructive">{previewReport.errorRowsCount}</div>
              </div>

              <div className="p-4 rounded-xl border bg-amber-500/10 border-amber-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-600">Validation Errors</span>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold mt-1 text-amber-600">
                  {previewReport.validationErrors.length}
                </div>
              </div>
            </div>

            {/* Validation Errors Table */}
            {previewReport.validationErrors.length === 0 ? (
              <div className="p-8 text-center rounded-xl border bg-emerald-500/5 border-emerald-500/20">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-2" />
                <h4 className="text-lg font-bold text-emerald-700">All Rows Valid!</h4>
                <p className="text-sm text-emerald-600 mt-1">
                  No structural, duplicate, or data type errors were found in this Excel sheet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Validation Error Details ({filteredErrors.length})</span>
                  <div className="flex items-center gap-2">
                    <Select value={errorFilter} onValueChange={(val: any) => setErrorFilter(val)}>
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="Filter errors" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Errors</SelectItem>
                        <SelectItem value="empty">Missing Mandatory</SelectItem>
                        <SelectItem value="type">Invalid Data Type</SelectItem>
                        <SelectItem value="duplicate">Duplicate Rows</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-muted sticky top-0">
                      <TableRow>
                        <TableHead className="w-16">Row #</TableHead>
                        <TableHead>Field / Column</TableHead>
                        <TableHead>Error Type</TableHead>
                        <TableHead>Raw Cell Value</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredErrors.map((err, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-semibold text-xs">{err.rowIndex || 'Header'}</TableCell>
                          <TableCell className="font-medium text-sm">{err.columnName}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                err.errorType === 'EmptyValue'
                                  ? 'destructive'
                                  : err.errorType === 'DuplicateInFile'
                                  ? 'secondary'
                                  : 'outline'
                              }
                            >
                              {err.errorType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {err.rawValue ? String(err.rawValue) : <span className="text-muted-foreground italic">(empty)</span>}
                          </TableCell>
                          <TableCell className="text-xs text-destructive font-medium">{err.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Preview
              </Button>
              <Button onClick={() => setStep(4)} size="lg" className="gap-2">
                Configure Column Mapping <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: COLUMN MAPPING */}
      {step === 4 && previewReport && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" /> Step 4: Map Excel Columns to Database Fields
            </CardTitle>
            <CardDescription>
              Verify auto-matched fields or manually assign target schema attributes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>Target Database Field</TableHead>
                    <TableHead>Type & Rules</TableHead>
                    <TableHead>Excel Sheet Column Header</TableHead>
                    <TableHead className="w-28 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewReport.availableSchemaColumns.map((spec) => {
                    // Find currently mapped excel column for this field
                    const mappedExcelHeader = Object.entries(mapping).find(([_, dbKey]) => dbKey === spec.key)?.[0] || '';

                    return (
                      <TableRow key={spec.key}>
                        <TableCell>
                          <div className="font-semibold text-sm">
                            {spec.label} {spec.required && <span className="text-destructive">*</span>}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">{spec.key}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {spec.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mappedExcelHeader || '__ignore__'}
                            onValueChange={(val) => {
                              const newMapping = { ...mapping };
                              // Clear previous mapping for this spec.key
                              Object.keys(newMapping).forEach((k) => {
                                if (newMapping[k] === spec.key) delete newMapping[k];
                              });
                              if (val !== '__ignore__') {
                                newMapping[val] = spec.key;
                              }
                              setMapping(newMapping);
                            }}
                          >
                            <SelectTrigger className="w-full h-9">
                              <SelectValue placeholder="Select Excel Column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__ignore__">-- Unmapped / Ignore --</SelectItem>
                              {previewReport.headers.map((h) => (
                                <SelectItem key={h} value={h}>
                                  {h}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          {mappedExcelHeader ? (
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700">
                              Mapped
                            </Badge>
                          ) : spec.required ? (
                            <Badge variant="destructive">Required</Badge>
                          ) : (
                            <Badge variant="outline">Optional</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setStep(3)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Validation
              </Button>
              <Button onClick={() => setStep(5)} size="lg" className="gap-2">
                Configure Strategy & Import <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 5: IMPORT EXECUTION */}
      {step === 5 && previewReport && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" /> Step 5: Execution Mode & Transaction Options
            </CardTitle>
            <CardDescription>
              Choose insertion strategy and handle duplicate business records
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mode Selection */}
              <div className="p-5 rounded-xl border space-y-3 bg-card">
                <label className="text-sm font-bold flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-primary" /> Import Mode
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                    <input
                      type="radio"
                      name="mode"
                      value="insert"
                      checked={mode === 'insert'}
                      onChange={() => setMode('insert')}
                    />
                    <div>
                      <div className="font-semibold text-sm">Insert Only</div>
                      <div className="text-xs text-muted-foreground">Skip records that already exist in the database</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                    <input
                      type="radio"
                      name="mode"
                      value="upsert"
                      checked={mode === 'upsert'}
                      onChange={() => setMode('upsert')}
                    />
                    <div>
                      <div className="font-semibold text-sm">Insert or Update (Upsert)</div>
                      <div className="text-xs text-muted-foreground">Update existing matching records with new Excel values</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Failure Strategy */}
              <div className="p-5 rounded-xl border space-y-3 bg-card">
                <label className="text-sm font-bold flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-primary" /> Failure Handling Strategy
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                    <input
                      type="radio"
                      name="strategy"
                      value="skip_invalid"
                      checked={strategy === 'skip_invalid'}
                      onChange={() => setStrategy('skip_invalid')}
                    />
                    <div>
                      <div className="font-semibold text-sm">Skip Invalid Rows (Recommended)</div>
                      <div className="text-xs text-muted-foreground">Import all valid rows and log skipped errors</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                    <input
                      type="radio"
                      name="strategy"
                      value="rollback_all"
                      checked={strategy === 'rollback_all'}
                      onChange={() => setStrategy('rollback_all')}
                    />
                    <div>
                      <div className="font-semibold text-sm">Rollback All on Error</div>
                      <div className="text-xs text-muted-foreground">Abort entire transaction if any single row fails validation</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Execution Progress */}
            {isExecuting && (
              <div className="p-6 rounded-xl border bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" /> Executing import transaction...
                  </span>
                  <span className="text-xs font-bold text-primary">{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <Button variant="outline" disabled={isExecuting} onClick={() => setStep(4)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Mapping
              </Button>
              <Button disabled={isExecuting} onClick={runExecution} size="lg" className="gap-2 font-bold">
                {isExecuting ? 'Importing Data...' : 'Start Execution Now'} <Play className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 6: SUMMARY */}
      {step === 6 && executionResult && (
        <Card className="shadow-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mb-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-emerald-700">Import Completed Successfully!</CardTitle>
            <CardDescription>
              Import audit trail has been created for <span className="font-semibold">{executionResult.fileName}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border bg-card text-center">
                <div className="text-xs font-semibold text-muted-foreground">New Records Created</div>
                <div className="text-3xl font-extrabold text-emerald-600 mt-1">+{executionResult.importedCount}</div>
              </div>
              <div className="p-4 rounded-xl border bg-card text-center">
                <div className="text-xs font-semibold text-muted-foreground">Existing Records Updated</div>
                <div className="text-3xl font-extrabold text-blue-600 mt-1">{executionResult.updatedCount}</div>
              </div>
              <div className="p-4 rounded-xl border bg-card text-center">
                <div className="text-xs font-semibold text-muted-foreground">Skipped / Ignored</div>
                <div className="text-3xl font-extrabold text-amber-600 mt-1">{executionResult.skippedCount}</div>
              </div>
              <div className="p-4 rounded-xl border bg-card text-center">
                <div className="text-xs font-semibold text-muted-foreground">Duration</div>
                <div className="text-3xl font-extrabold text-muted-foreground mt-1">
                  {(executionResult.durationMs / 1000).toFixed(2)}s
                </div>
              </div>
            </div>

            {/* Audit Log Confirmation */}
            <div className="p-4 rounded-xl border bg-muted/30 flex items-start gap-3">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground">Audit Log Recorded</div>
                <p>
                  System logged transaction ID <span className="font-mono">{executionResult.id}</span>. You can view
                  historical import metrics anytime in the Import History tab.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-center gap-4 pt-2">
              <Button variant="outline" onClick={resetWizard} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Import Another File
              </Button>
              {onComplete && (
                <Button onClick={onComplete} className="gap-2">
                  <Check className="h-4 w-4" /> View Module Data
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
