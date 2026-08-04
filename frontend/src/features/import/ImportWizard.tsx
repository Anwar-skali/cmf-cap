import { useState, useRef, useEffect } from 'react';
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
  Brain,
  LayoutTemplate,
  ChevronRight,
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
  getImportTemplates,
  extractExcelHeaders,
  type ImportPreviewReport,
  type ImportExecutionResult,
  type ValidationError,
  type ImportTemplate,
  type OllamaMappingResult,
} from '@/api/endpoints/importApi';
import { MappingPreviewComponent } from './components/MappingPreviewComponent';
import { ExcelHeaderExtractor } from './services/ExcelHeaderExtractor';
import { OllamaMappingService } from './services/OllamaMappingService';
import { MappingCacheService } from './services/MappingCacheService';

interface ImportWizardProps {
  defaultEntity?: string;
  onComplete?: () => void;
}

const STEP_LABELS = [
  { stepNum: 1, title: 'Template' },
  { stepNum: 2, title: 'Upload' },
  { stepNum: 3, title: 'AI Mapping' },
  { stepNum: 4, title: 'Preview' },
  { stepNum: 5, title: 'Validation' },
  { stepNum: 6, title: 'Import' },
  { stepNum: 7, title: 'Summary' },
];

export function ImportWizard({ defaultEntity = 'projects', onComplete }: ImportWizardProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard step
  const [step, setStep] = useState<number>(1);

  // Step 1: Template selection
  const [availableTemplates, setAvailableTemplates] = useState<ImportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ImportTemplate | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Step 2: File upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientHeaders, setClientHeaders] = useState<string[]>([]);
  const [isExtractingHeaders, setIsExtractingHeaders] = useState(false);

  // Step 3: AI Mapping
  const [isGeneratingMapping, setIsGeneratingMapping] = useState(false);
  const [ollamaMappingResult, setOllamaMappingResult] = useState<OllamaMappingResult | null>(null);
  // wizardMapping: db_field_key -> excel_header | null
  const [wizardMapping, setWizardMapping] = useState<Record<string, string | null>>({});

  // Step 4: Preview (deterministic validation)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewReport, setPreviewReport] = useState<ImportPreviewReport | null>(null);

  // Step 5: Validation error filter
  const [errorFilter, setErrorFilter] = useState<'all' | 'empty' | 'type' | 'duplicate'>('all');

  // Step 6: Execution
  const [mode, setMode] = useState<'insert' | 'upsert'>('insert');
  const [strategy, setStrategy] = useState<'skip_invalid' | 'rollback_all'>('skip_invalid');
  const [isExecuting, setIsExecuting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Step 7: Summary
  const [executionResult, setExecutionResult] = useState<ImportExecutionResult | null>(null);

  // Load templates on mount
  useEffect(() => {
    (async () => {
      setIsLoadingTemplates(true);
      try {
        const templates = await getImportTemplates();
        setAvailableTemplates(templates);
        if (templates.length > 0) setSelectedTemplate(templates[0]);
      } catch {
        toast.error('Failed to load project templates.');
      } finally {
        setIsLoadingTemplates(false);
      }
    })();
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const file = files[0];
    if (!file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
      toast.error('Please select a valid Excel file (.xlsx, .xls, .xlsm)');
      return;
    }
    setSelectedFile(file);
    await extractHeadersFromFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
      toast.error('Please drop a valid Excel file (.xlsx, .xls, .xlsm)');
      return;
    }
    setSelectedFile(file);
    await extractHeadersFromFile(file);
  };

  const extractHeadersFromFile = async (file: File) => {
    setIsExtractingHeaders(true);
    try {
      // Client-side extraction for instant feedback
      const result = await ExcelHeaderExtractor.extractFromFile(file);
      setClientHeaders(result.headers);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to read Excel headers.');
    } finally {
      setIsExtractingHeaders(false);
    }
  };

  // Step 3: Run Ollama RAG mapping
  const runAiMapping = async () => {
    if (!selectedFile || !selectedTemplate) return;
    setIsGeneratingMapping(true);
    try {
      const headers = clientHeaders.length > 0 ? clientHeaders : (await ExcelHeaderExtractor.extractFromFile(selectedFile)).headers;
      // Do not re-attach selectedFile when headers array is already populated
      const result = await OllamaMappingService.generateMapping(selectedTemplate.code, headers);
      setOllamaMappingResult(result);

      // Build initial wizard mapping from AI result
      const initialMap = OllamaMappingService.toWizardMapping(result);

      // Check mapping memory for cached overrides
      const cached = MappingCacheService.loadLocally(selectedTemplate.code);
      if (cached) {
        for (const [fieldKey, excelHeader] of Object.entries(cached)) {
          if (headers.includes(excelHeader)) {
            initialMap[fieldKey] = excelHeader;
          }
        }
      }

      setWizardMapping(initialMap);
      setStep(3);

      const mappingSec = result.executionTimes?.totalMappingMs
        ? (result.executionTimes.totalMappingMs / 1000).toFixed(1)
        : null;

      if (result.ollamaActive) {
        toast.success(`Ollama AI (${result.model}) generated semantic mapping${mappingSec ? ` in ${mappingSec}s` : ''}.`);
      } else if (result.ollamaReachable) {
        toast.info('Ollama AI connected but returned empty result. Used fuzzy matching engine as fallback.');
      } else {
        toast.warning('Ollama server offline (port 11434). Used deterministic alias + substring matching engine.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate column mapping.');
    } finally {
      setIsGeneratingMapping(false);
    }
  };

  // Step 4: Run deterministic preview/validation on server
  const runPreview = async () => {
    if (!selectedFile || !selectedTemplate) return;
    setIsLoadingPreview(true);
    try {
      // Convert wizardMapping (db_field_key -> excel) to execute format (excel -> db_field_key)
      const executeMapping = OllamaMappingService.toExecuteMapping(wizardMapping);
      const report = await previewImport(selectedFile, selectedTemplate.code, executeMapping);
      setPreviewReport(report);
      setStep(4);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to parse Excel file preview.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Step 6: Execute import
  const runExecution = async () => {
    if (!selectedFile || !previewReport || !selectedTemplate) return;
    setIsExecuting(true);
    setImportProgress(20);

    const progressInterval = setInterval(() => {
      setImportProgress((prev) => (prev < 90 ? prev + 15 : prev));
    }, 200);

    try {
      const executeMapping = OllamaMappingService.toExecuteMapping(wizardMapping);
      const result = await executeImport(selectedFile, selectedTemplate.code, executeMapping, mode, strategy);
      clearInterval(progressInterval);
      setImportProgress(100);
      setExecutionResult(result);
      toast.success(result.message);

      // Persist confirmed mapping to cache + server memory
      await MappingCacheService.syncToServer(selectedTemplate.code, wizardMapping);

      setStep(7);
    } catch (err: any) {
      clearInterval(progressInterval);
      setImportProgress(0);
      toast.error(err?.message || 'Import failed.');
    } finally {
      setIsExecuting(false);
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
    } catch {
      toast.error('Failed to download error report.');
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSelectedFile(null);
    setClientHeaders([]);
    setOllamaMappingResult(null);
    setWizardMapping({});
    setPreviewReport(null);
    setExecutionResult(null);
    setImportProgress(0);
    setErrorFilter('all');
  };

  const filteredErrors = previewReport?.validationErrors.filter((err) => {
    if (errorFilter === 'all') return true;
    if (errorFilter === 'empty') return err.errorType === 'EmptyValue';
    if (errorFilter === 'type') return err.errorType === 'InvalidDataType';
    if (errorFilter === 'duplicate') return err.errorType === 'DuplicateInFile';
    return true;
  }) || [];

  const fieldDefs = ollamaMappingResult?.fieldDefinitions ?? [];
  const requiredUnmapped = fieldDefs.filter(
    (f) => f.required && (!wizardMapping[f.key] || wizardMapping[f.key] === '__ignore__'),
  ).length;

  return (
    <div className="space-y-6">
      {/* Wizard Step Progress */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {STEP_LABELS.map((item, idx) => {
            const isCompleted = step > item.stepNum;
            const isCurrent = step === item.stepNum;
            return (
              <div key={item.stepNum} className="flex items-center gap-1.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                      ? 'bg-primary/20 text-primary border-2 border-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : item.stepNum}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isCurrent ? 'text-foreground font-bold' : 'text-muted-foreground'
                  }`}
                >
                  {item.title}
                </span>
                {idx < STEP_LABELS.length - 1 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 hidden md:block" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          STEP 1: Template Selection
         ═══════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-primary" /> Step 1: Select Project Template
            </CardTitle>
            <CardDescription>
              Choose the CMF project template that defines the schema for this Excel import. The template's
              field definitions will be used as the AI knowledge source.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoadingTemplates ? (
              <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin" /> Loading templates...
              </div>
            ) : availableTemplates.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-destructive/30 bg-destructive/5">
                <XCircle className="mx-auto h-10 w-10 text-destructive mb-2" />
                <p className="font-semibold text-destructive">No published templates found.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Go to <strong>Templates</strong> module to seed or publish templates (K0, K9, etc.).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableTemplates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl)}
                    className={`text-left p-5 rounded-xl border-2 transition-all hover:shadow-md ${
                      selectedTemplate?.id === tmpl.id
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-muted hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-extrabold ${
                          selectedTemplate?.id === tmpl.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {tmpl.code}
                      </div>
                      {selectedTemplate?.id === tmpl.id && (
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      )}
                    </div>
                    <div className="mt-3">
                      <div className="font-bold text-sm">{tmpl.name}</div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {tmpl.description || 'No description available.'}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          v{tmpl.version}
                        </Badge>
                        <Badge className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-300">
                          {tmpl.status}
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                disabled={!selectedTemplate}
                onClick={() => setStep(2)}
                size="lg"
                className="gap-2"
              >
                Continue to File Upload <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STEP 2: File Upload
         ═══════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" /> Step 2: Upload Excel File
                </CardTitle>
                <CardDescription>
                  Upload your Excel workbook for template{' '}
                  <span className="font-bold text-foreground">{selectedTemplate?.code}</span> —{' '}
                  {selectedTemplate?.name}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-sm px-3 py-1 hidden sm:flex">
                {selectedTemplate?.code}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                selectedFile
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/30 hover:border-primary hover:bg-muted/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
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
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                  {isExtractingHeaders ? (
                    <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" /> Extracting headers...
                    </div>
                  ) : clientHeaders.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-emerald-700">
                        <CheckCircle2 className="inline h-4 w-4 mr-1" />
                        {clientHeaders.length} column headers detected
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5 justify-center max-w-lg mx-auto">
            {clientHeaders.slice(0, 8).map((h, idx) => (
              <Badge key={`${h}-${idx}`} variant="secondary" className="text-xs">
                {h}
              </Badge>
            ))}
                        {clientHeaders.length > 8 && (
                          <Badge variant="outline" className="text-xs">
                            +{clientHeaders.length - 8} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : null}
                  <Button size="sm" variant="ghost" className="mt-3 text-xs text-muted-foreground">
                    Click to change file
                  </Button>
                </div>
              ) : (
                <div>
                  <h4 className="font-semibold text-base">Drag & drop your Excel file here</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports Microsoft Excel (.xlsx, .xls, .xlsm)
                  </p>
                  <Button size="sm" className="mt-4">
                    Browse File
                  </Button>
                </div>
              )}
            </div>

            {/* Privacy Notice */}
            <div className="flex items-start gap-3 p-3 rounded-xl border bg-muted/30 text-xs text-muted-foreground">
              <Brain className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
              <p>
                <span className="font-semibold text-foreground">Privacy Note:</span> Only your Excel{' '}
                <strong>column headers</strong> will be sent to the local Ollama AI model for semantic mapping.{' '}
                <strong>No row data is ever transmitted to the LLM.</strong> All row-level validation and
                import logic runs deterministically on the server.
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                disabled={!selectedFile || isExtractingHeaders || isGeneratingMapping}
                onClick={runAiMapping}
                size="lg"
                className="gap-2"
              >
                {isGeneratingMapping ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Generating AI Mapping...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" /> Generate AI Mapping <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STEP 3: AI Semantic Mapping Review
         ═══════════════════════════════════════════════════════════════ */}
      {step === 3 && ollamaMappingResult && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Brain className="h-5 w-5 text-violet-600" /> Step 3: AI Semantic Column Mapping
                </CardTitle>
                <CardDescription>
                  Review and adjust the AI-generated mapping between your Excel columns and the{' '}
                  <span className="font-bold text-foreground">{selectedTemplate?.code}</span> template database
                  fields. All mappings can be manually overridden.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {requiredUnmapped > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {requiredUnmapped} Required Unmapped
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {(ollamaMappingResult.excelHeaders ?? clientHeaders).length} Excel Columns
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <MappingPreviewComponent
              mappingResult={ollamaMappingResult}
              mapping={wizardMapping}
              onMappingChange={setWizardMapping}
            />

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Upload
              </Button>
              <div className="flex items-center gap-3">
                {requiredUnmapped > 0 && (
                  <p className="text-xs text-destructive">
                    ⚠ {requiredUnmapped} required field(s) not mapped
                  </p>
                )}
                <Button
                  onClick={runPreview}
                  disabled={isLoadingPreview}
                  size="lg"
                  className="gap-2"
                >
                  {isLoadingPreview ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Validating...
                    </>
                  ) : (
                    <>
                      Confirm Mapping & Preview <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STEP 4: Excel Preview (first 25 rows)
         ═══════════════════════════════════════════════════════════════ */}
      {step === 4 && previewReport && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <TableIcon className="h-5 w-5 text-primary" /> Step 4: Data Preview
                </CardTitle>
                <CardDescription>
                  Previewing mapped content from{' '}
                  <span className="font-semibold">{previewReport.fileName}</span> ({previewReport.totalRows}{' '}
                  total rows)
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-sm px-3 py-1">
                {previewReport.entityDisplayName}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border bg-card">
                <div className="text-xs font-medium text-muted-foreground">Headers Detected</div>
                <div className="text-2xl font-bold mt-1 text-primary">{previewReport.headers.length}</div>
              </div>
              <div className="p-4 rounded-xl border bg-card">
                <div className="text-xs font-medium text-muted-foreground">Total Rows</div>
                <div className="text-2xl font-bold mt-1">{previewReport.totalRows}</div>
              </div>
              <div className="p-4 rounded-xl border bg-card">
                <div className="text-xs font-medium text-muted-foreground">Mapped Fields</div>
                <div className="text-2xl font-bold mt-1 text-emerald-600">
                  {Object.values(previewReport.columnMapping).filter(Boolean).length} /{' '}
                  {previewReport.headers.length}
                </div>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted sticky top-0">
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    {previewReport.availableSchemaColumns.map((col, idx) => (
                      <TableHead key={`${col.key}-${idx}`} className="font-semibold">
                        {col.label} {col.required && <span className="text-destructive">*</span>}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewReport.previewRows.slice(0, 25).map((row, idx) => (
                    <TableRow key={`row-${row._row_index ?? idx}`} className={row._has_error ? 'bg-destructive/10' : undefined}>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {row._row_index}
                      </TableCell>
                      {previewReport.availableSchemaColumns.map((col, colIdx) => (
                        <TableCell key={`cell-${col.key}-${colIdx}`} className="text-sm">
                          {row[col.key] !== undefined && row[col.key] !== null ? (
                            String(row[col.key])
                          ) : (
                            <span className="text-muted-foreground italic">-</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Mapping
              </Button>
              <Button onClick={() => setStep(5)} size="lg" className="gap-2">
                View Validation Report <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STEP 5: Validation Report
         ═══════════════════════════════════════════════════════════════ */}
      {step === 5 && previewReport && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" /> Step 5: Data Validation Report
                </CardTitle>
                <CardDescription>
                  Deterministic structural, mandatory field, duplicate, and type checks on all rows
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
                  <span className="text-xs font-semibold text-emerald-600">Valid</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold mt-1 text-emerald-600">{previewReport.validRowsCount}</div>
              </div>
              <div className="p-4 rounded-xl border bg-destructive/10 border-destructive/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-destructive">Invalid</span>
                  <XCircle className="h-4 w-4 text-destructive" />
                </div>
                <div className="text-2xl font-bold mt-1 text-destructive">{previewReport.errorRowsCount}</div>
              </div>
              <div className="p-4 rounded-xl border bg-amber-500/10 border-amber-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-600">Errors Found</span>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold mt-1 text-amber-600">
                  {previewReport.validationErrors.length}
                </div>
              </div>
            </div>

            {previewReport.validationErrors.length === 0 ? (
              <div className="p-8 text-center rounded-xl border bg-emerald-500/5 border-emerald-500/20">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-2" />
                <h4 className="text-lg font-bold text-emerald-700">All Rows Valid!</h4>
                <p className="text-sm text-emerald-600 mt-1">
                  No structural, duplicate, or data type errors found.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    Error Details ({filteredErrors.length})
                  </span>
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
                <div className="border rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-muted sticky top-0">
                      <TableRow>
                        <TableHead className="w-16">Row #</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Error Type</TableHead>
                        <TableHead>Raw Value</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredErrors.map((err, idx) => (
                        <TableRow key={`err-${err.rowIndex}-${err.columnName}-${idx}`}>
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
                            {err.rawValue ? (
                              String(err.rawValue)
                            ) : (
                              <span className="text-muted-foreground italic">(empty)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-destructive">{err.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(4)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Preview
              </Button>
              <Button onClick={() => setStep(6)} size="lg" className="gap-2">
                Configure Import Strategy <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STEP 6: Import Execution Config
         ═══════════════════════════════════════════════════════════════ */}
      {step === 6 && previewReport && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" /> Step 6: Execution Mode & Transaction Options
            </CardTitle>
            <CardDescription>
              Choose insertion strategy and how to handle duplicate or invalid business records
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mode */}
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
                      <div className="text-xs text-muted-foreground">
                        Skip records that already exist in the database
                      </div>
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
                      <div className="text-xs text-muted-foreground">
                        Update existing matching records with new Excel values
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Strategy */}
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
                      <div className="text-xs text-muted-foreground">
                        Import all valid rows and log skipped errors
                      </div>
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
                      <div className="text-xs text-muted-foreground">
                        Abort entire transaction if any single row fails
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

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

            <div className="flex justify-between">
              <Button variant="outline" disabled={isExecuting} onClick={() => setStep(5)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button disabled={isExecuting} onClick={runExecution} size="lg" className="gap-2 font-bold">
                {isExecuting ? 'Importing Data...' : 'Start Import Now'} <Play className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STEP 7: Completion Summary
         ═══════════════════════════════════════════════════════════════ */}
      {step === 7 && executionResult && (
        <Card className="shadow-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mb-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-emerald-700">Import Completed!</CardTitle>
            <CardDescription>
              Audit trail created for{' '}
              <span className="font-semibold">{executionResult.fileName}</span> using template{' '}
              <span className="font-semibold">{selectedTemplate?.code}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border bg-card text-center">
                <div className="text-xs font-semibold text-muted-foreground">New Records</div>
                <div className="text-3xl font-extrabold text-emerald-600 mt-1">
                  +{executionResult.importedCount}
                </div>
              </div>
              <div className="p-4 rounded-xl border bg-card text-center">
                <div className="text-xs font-semibold text-muted-foreground">Updated</div>
                <div className="text-3xl font-extrabold text-blue-600 mt-1">
                  {executionResult.updatedCount}
                </div>
              </div>
              <div className="p-4 rounded-xl border bg-card text-center">
                <div className="text-xs font-semibold text-muted-foreground">Skipped</div>
                <div className="text-3xl font-extrabold text-amber-600 mt-1">
                  {executionResult.skippedCount}
                </div>
              </div>
              <div className="p-4 rounded-xl border bg-card text-center">
                <div className="text-xs font-semibold text-muted-foreground">Duration</div>
                <div className="text-3xl font-extrabold text-muted-foreground mt-1">
                  {(executionResult.durationMs / 1000).toFixed(2)}s
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border bg-muted/30 flex items-start gap-3">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground">Audit Log Recorded & Mapping Memory Updated</div>
                <p>
                  Transaction ID{' '}
                  <span className="font-mono">{executionResult.id}</span> has been logged. Your column mappings
                  for template <strong>{selectedTemplate?.code}</strong> have been saved to mapping memory for
                  faster future imports.
                </p>
              </div>
            </div>

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
