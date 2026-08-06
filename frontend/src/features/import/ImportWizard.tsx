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
  Table as TableIcon,
  ShieldAlert,
  Play,
  FileCheck,
  Check,
  Info,
  Brain,
  LayoutTemplate,
  ChevronRight,
  Code,
  BugPlay,
  Rows3,
  Layers,
  Sparkles,
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
  getImportTemplates,
  generateOllamaMapping,
  type ImportPreviewReport,
  type ImportExecutionResult,
  type ValidationError,
  type ImportTemplate,
  type OllamaMappingResult,
  type RowPreview,
  type WorksheetScore,
} from '@/api/endpoints/importApi';
import { MappingPreviewComponent } from './components/MappingPreviewComponent';
import { ExcelHeaderExtractor } from './services/ExcelHeaderExtractor';
import { OllamaMappingService } from './services/OllamaMappingService';
import { MappingCacheService } from './services/MappingCacheService';
import { ApiError } from '@/api/client';

interface ImportWizardProps {
  defaultEntity?: string;
  onComplete?: () => void;
}

const STEP_LABELS = [
  { stepNum: 1, title: 'Upload Excel' },
  { stepNum: 2, title: 'Workbook Analysis' },
  { stepNum: 3, title: 'Worksheet & Header' },
  { stepNum: 4, title: 'Project Structure' },
  { stepNum: 5, title: 'AI Mapping' },
  { stepNum: 6, title: 'Validation' },
  { stepNum: 7, title: 'Import' },
];

export function ImportWizard({ defaultEntity = 'projects', onComplete }: ImportWizardProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard step
  const [step, setStep] = useState<number>(1);

  // Step 1: File Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Step 2: Workbook Analysis (sheet scoring)
  const [isAnalyzingWorkbook, setIsAnalyzingWorkbook] = useState(false);
  const [sheetScores, setSheetScores] = useState<WorksheetScore[]>([]);
  const [detectedSheet, setDetectedSheet] = useState<string>('');
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [sheetConfidence, setSheetConfidence] = useState<number>(0);

  // Step 3: Header Row Detection
  const [clientHeaders, setClientHeaders] = useState<string[]>([]);
  const [detectedHeaderRow, setDetectedHeaderRow] = useState<number>(1);
  const [selectedHeaderRow, setSelectedHeaderRow] = useState<number>(1);
  const [headerConfidence, setHeaderConfidence] = useState<number>(0);
  const [rowPreviews, setRowPreviews] = useState<RowPreview[]>([]);
  const [isExtractingHeaders, setIsExtractingHeaders] = useState(false);

  // Step 4: Template selection
  const [availableTemplates, setAvailableTemplates] = useState<ImportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ImportTemplate | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Step 5: AI Mapping
  const [isGeneratingMapping, setIsGeneratingMapping] = useState(false);
  const [aiProgressStep, setAiProgressStep] = useState<
    'idle' | 'reading_excel' | 'loading_template' | 'calling_ollama' | 'parsing_response' | 'completed'
  >('idle');
  const [ollamaMappingResult, setOllamaMappingResult] = useState<OllamaMappingResult | null>(null);
  const [wizardMapping, setWizardMapping] = useState<Record<string, string | null>>({});

  // Step 6: Preview (deterministic validation)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewReport, setPreviewReport] = useState<ImportPreviewReport | null>(null);
  const [errorFilter, setErrorFilter] = useState<'all' | 'empty' | 'type' | 'duplicate'>('all');

  // Step 7: Execution
  const [mode, setMode] = useState<'insert' | 'upsert'>('insert');
  const [strategy, setStrategy] = useState<'skip_invalid' | 'rollback_all'>('skip_invalid');
  const [isExecuting, setIsExecuting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [executionResult, setExecutionResult] = useState<ImportExecutionResult | null>(null);

  // Debug Panel Toggle
  const [showDebugPanel, setShowDebugPanel] = useState(false);

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

  // Handler: Select/drop file in Step 1
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const file = files[0];
    if (!file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
      toast.error('Please select a valid Excel file (.xlsx, .xls, .xlsm)');
      return;
    }
    setSelectedFile(file);
    await analyzeAndExtract(file);
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
    await analyzeAndExtract(file);
  };

  // Analyze workbook sheets and set up Step 2 & 3
  const analyzeAndExtract = async (file: File, sheetOverride?: string, rowOverride?: number) => {
    setIsAnalyzingWorkbook(true);
    setIsExtractingHeaders(true);
    try {
      const result = await ExcelHeaderExtractor.extractFromFile(file, rowOverride, sheetOverride);
      setClientHeaders(result.headers);
      setSheetScores(result.sheetScores);
      setDetectedSheet(result.sheetName);
      setSelectedSheet(sheetOverride ?? result.sheetName);
      setSheetConfidence(result.sheetConfidence);
      setDetectedHeaderRow(result.detectedHeaderRow);
      if (rowOverride == null) {
        setSelectedHeaderRow(result.detectedHeaderRow);
      }
      setHeaderConfidence(result.headerConfidence);
      setRowPreviews(result.rowPreviews);

      // Auto advance to Step 2 if coming from Step 1
      if (step === 1) {
        setStep(2);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to analyze Excel file worksheets.');
    } finally {
      setIsAnalyzingWorkbook(false);
      setIsExtractingHeaders(false);
    }
  };

  const handleSheetChange = async (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (selectedFile) {
      await analyzeAndExtract(selectedFile, sheetName, undefined);
    }
  };

  const handleHeaderRowChange = async (rowNum: number) => {
    setSelectedHeaderRow(rowNum);
    if (selectedFile) {
      await analyzeAndExtract(selectedFile, selectedSheet, rowNum);
    }
  };

  // Step 5: Run Ollama RAG mapping
  const runAiMapping = async () => {
    if (!selectedFile || !selectedTemplate) return;
    setIsGeneratingMapping(true);
    setAiProgressStep('reading_excel');
    try {
      setAiProgressStep('loading_template');
      await new Promise((resolve) => setTimeout(resolve, 80));

      setAiProgressStep('calling_ollama');
      const result = await OllamaMappingService.generateMapping(
        selectedTemplate.code,
        clientHeaders,
        undefined,
        selectedHeaderRow,
        selectedSheet,
      );

      setAiProgressStep('parsing_response');
      setOllamaMappingResult(result);

      const initialMap = OllamaMappingService.toWizardMapping(result);

      // Check mapping memory for cached overrides
      const cached = MappingCacheService.loadLocally(selectedTemplate.code);
      if (cached) {
        for (const [fieldKey, excelHeader] of Object.entries(cached)) {
          if (clientHeaders.includes(excelHeader)) {
            initialMap[fieldKey] = excelHeader;
          }
        }
      }

      setWizardMapping(initialMap);
      setAiProgressStep('completed');
      setStep(5);

      const mappingSec = result.executionTimes?.totalMappingMs
        ? (result.executionTimes.totalMappingMs / 1000).toFixed(1)
        : null;

      if (result.ollamaActive) {
        toast.success(`✔ AI Mapping Active — ${result.model} mapped columns in ${mappingSec ?? '<10'}s.`);
      } else if (result.ollamaReachable) {
        const reason = result.fallbackReason || 'Ollama returned no valid column matches.';
        toast.info(`⚠ Ollama Connected — Fuzzy Fallback: ${reason}`);
      } else {
        const reason = result.fallbackReason || 'Ollama server unreachable.';
        toast.warning(`⚠ Ollama Offline — Switched to deterministic fuzzy matching.`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate column mapping.');
    } finally {
      setIsGeneratingMapping(false);
    }
  };

  // Step 6: Run deterministic preview/validation
  const runPreview = async () => {
    if (!selectedFile || !selectedTemplate) return;
    setIsLoadingPreview(true);
    try {
      const executeMapping = OllamaMappingService.toExecuteMapping(wizardMapping);
      const report = await previewImport(selectedFile, selectedTemplate.code, executeMapping);
      setPreviewReport(report);
      setStep(6);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to parse Excel file preview.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Step 7: Execute import
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

      await MappingCacheService.syncToServer(selectedTemplate.code, wizardMapping);
      setStep(7);
    } catch (err: any) {
      clearInterval(progressInterval);
      setImportProgress(0);
      toast.error(err?.message || 'Import failed due to an error.');
    } finally {
      setIsExecuting(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSelectedFile(null);
    setSheetScores([]);
    setDetectedSheet('');
    setSelectedSheet('');
    setSheetConfidence(0);
    setClientHeaders([]);
    setDetectedHeaderRow(1);
    setSelectedHeaderRow(1);
    setHeaderConfidence(0);
    setRowPreviews([]);
    setOllamaMappingResult(null);
    setWizardMapping({});
    setPreviewReport(null);
    setExecutionResult(null);
    setImportProgress(0);
    setErrorFilter('all');
    setShowDebugPanel(false);
  };

  const filteredErrors =
    previewReport?.validationErrors.filter((err) => {
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
          STEP 1: Upload Excel File
         ═══════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" /> Step 1: Upload Supplier Excel Workbook
            </CardTitle>
            <CardDescription>
              Upload your automotive supplier Excel file (.xlsx, .xls, .xlsm). The system will automatically analyze all
              worksheets and detect the tabular project data sheet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all border-muted-foreground/30 hover:border-primary hover:bg-muted/30"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                <FileSpreadsheet className="h-9 w-9 text-primary" />
              </div>
              <h4 className="font-semibold text-lg">Drag & drop your Excel file here</h4>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Supports professional multi-sheet workbooks (Dashboards, Pivot Tables, Charts, and CMF K9 project sheets).
              </p>
              <Button size="lg" className="mt-5 gap-2">
                <Upload className="h-4 w-4" /> Browse Excel File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STEP 2: Workbook Analysis (Scored Worksheets)
         ═══════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" /> Step 2: Workbook Analysis (Worksheet Scoring)
                </CardTitle>
                <CardDescription>
                  Evaluated {sheetScores.length} worksheets in{' '}
                  <span className="font-bold text-foreground">{selectedFile?.name}</span>. The data sheet with highest
                  project confidence is automatically selected.
                </CardDescription>
              </div>
              {selectedSheet && (
                <Badge className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-300 px-3 py-1">
                  ✓ Selected: {selectedSheet} ({sheetConfidence}% Confidence)
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isAnalyzingWorkbook ? (
              <div className="py-12 text-center text-muted-foreground space-y-3">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
                <p className="font-medium text-sm">Analyzing workbook worksheets and calculating confidence scores...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sheetScores.map((s) => {
                    const isSelected = s.sheetName === selectedSheet;
                    const isDetected = s.sheetName === detectedSheet;
                    return (
                      <div
                        key={s.sheetName}
                        onClick={() => handleSheetChange(s.sheetName)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : s.isDashboardName
                            ? 'border-muted opacity-60 bg-muted/20'
                            : 'border-muted hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet
                              className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                            />
                            <span className="font-bold text-sm line-clamp-1">{s.sheetName}</span>
                          </div>
                          <Badge
                            variant={s.confidence >= 80 ? 'default' : s.confidence >= 40 ? 'secondary' : 'outline'}
                            className={`text-[10px] shrink-0 ${
                              s.confidence >= 80
                                ? 'bg-emerald-500/15 text-emerald-700 border-emerald-300'
                                : s.confidence < 20
                                ? 'text-muted-foreground opacity-60'
                                : ''
                            }`}
                          >
                            {s.confidence}% Score
                          </Badge>
                        </div>

                        <div className="mt-3 text-xs text-muted-foreground space-y-1">
                          <div className="flex justify-between">
                            <span>Populated Rows:</span>
                            <span className="font-medium text-foreground">{s.populatedRows}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Max Columns:</span>
                            <span className="font-medium text-foreground">{s.maxColumns}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Keyword Hits:</span>
                            <span className="font-medium text-foreground">{s.keywordHits}</span>
                          </div>
                        </div>

                        {s.preview.length > 0 && (
                          <div className="mt-3 pt-2 border-t flex flex-wrap gap-1">
                            {s.preview.slice(0, 4).map((c, idx) => (
                              <span key={idx} className="text-[10px] bg-muted px-1.5 py-0.5 rounded line-clamp-1">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}

                        {isDetected && (
                          <div className="mt-2 text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Highest Confidence Data Sheet
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Change File
              </Button>
              <Button onClick={() => setStep(3)} size="lg" className="gap-2">
                Continue to Header Detection <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STEP 3: Worksheet & Header Detection (Scanned Top 20 Rows)
         ═══════════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Rows3 className="h-5 w-5 text-primary" /> Step 3: Worksheet & Header Row Detection
                </CardTitle>
                <CardDescription>
                  Scanned top 20 rows of worksheet{' '}
                  <span className="font-bold text-foreground">{selectedSheet}</span>. Review auto-detected header row
                  and column headers.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-300">
                  Sheet: {selectedSheet} ({sheetConfidence}%)
                </Badge>
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                  Header: Row {selectedHeaderRow} ({headerConfidence}%)
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Header Preview & Controls Card */}
            <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-muted-foreground">Worksheet:</span>
                  <Select value={selectedSheet} onValueChange={handleSheetChange} disabled={isExtractingHeaders}>
                    <SelectTrigger className="h-9 w-52 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetScores.map((s) => (
                        <SelectItem key={s.sheetName} value={s.sheetName} className="text-xs">
                          {s.sheetName} ({s.confidence}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-muted-foreground">Header Row:</span>
                  <Select
                    value={String(selectedHeaderRow)}
                    onValueChange={(v) => handleHeaderRowChange(Number(v))}
                    disabled={isExtractingHeaders}
                  >
                    <SelectTrigger className="h-9 w-36 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rowPreviews.map((rp) => (
                        <SelectItem key={rp.rowNumber} value={String(rp.rowNumber)} className="text-xs">
                          Row {rp.rowNumber} ({rp.confidence ?? 80}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Detected Column Headers List */}
              <div>
                <h5 className="text-xs font-bold text-muted-foreground mb-2">
                  Detected Column Headers ({clientHeaders.length}):
                </h5>
                <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border bg-muted/30 max-h-36 overflow-y-auto">
                  {clientHeaders.map((h, idx) => (
                    <Badge key={`${h}-${idx}`} variant="secondary" className="text-xs">
                      {h}
                    </Badge>
                  ))}
                  {clientHeaders.length === 0 && (
                    <p className="text-xs italic text-muted-foreground">No headers found in selected row.</p>
                  )}
                </div>
              </div>

              {/* Row Table Selector */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-muted-foreground">Row Scoring Preview (Top 20 Rows):</h5>
                <div className="overflow-x-auto border rounded-lg max-h-56">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-3 font-medium w-16">Row</th>
                        <th className="text-left py-2 px-3 font-medium w-24">Confidence</th>
                        <th className="text-left py-2 px-3 font-medium">Cell Contents Preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowPreviews.map((rp) => {
                        const isSelectedRow = rp.rowNumber === selectedHeaderRow;
                        return (
                          <tr
                            key={rp.rowNumber}
                            onClick={() => handleHeaderRowChange(rp.rowNumber)}
                            className={`border-b cursor-pointer transition-colors hover:bg-muted/40 ${
                              isSelectedRow ? 'bg-primary/10 border-primary/30 font-semibold' : ''
                            }`}
                          >
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5">
                                {isSelectedRow && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                                <span className={isSelectedRow ? 'text-primary font-bold' : ''}>Row {rp.rowNumber}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 font-mono text-xs">
                              {rp.confidence ?? 80}%
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex flex-wrap gap-1">
                                {rp.preview.slice(0, 7).map((cell, i) => (
                                  <span
                                    key={i}
                                    className={`px-2 py-0.5 rounded text-[10px] ${
                                      isSelectedRow
                                        ? 'bg-primary/20 text-primary font-medium'
                                        : 'bg-muted text-muted-foreground'
                                    }`}
                                  >
                                    {cell}
                                  </span>
                                ))}
                                {rp.preview.length > 7 && (
                                  <span className="text-[10px] text-muted-foreground">+{rp.preview.length - 7}</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Workbook Analysis
              </Button>
              <Button onClick={() => setStep(4)} size="lg" className="gap-2">
                Continue to Template Selection <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STEP 4: Select Project Structure (Template Selection)
         ═══════════════════════════════════════════════════════════════ */}
      {step === 4 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-primary" /> Step 4: Select Target CMF Template
            </CardTitle>
            <CardDescription>
              Choose the CMF project template that defines the database schema for mapping headers from sheet{' '}
              <span className="font-bold text-foreground">{selectedSheet}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoadingTemplates ? (
              <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin" /> Loading published templates...
              </div>
            ) : availableTemplates.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-destructive/30 bg-destructive/5">
                <XCircle className="mx-auto h-10 w-10 text-destructive mb-2" />
                <p className="font-semibold text-destructive">No published templates found.</p>
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

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setStep(3)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Worksheet & Header Detection
              </Button>
              <Button disabled={!selectedTemplate} onClick={runAiMapping} size="lg" className="gap-2">
                <Brain className="h-4 w-4" /> Generate AI Column Mapping <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STEP 5: AI Semantic Column Mapping
         ═══════════════════════════════════════════════════════════════ */}
      {step === 5 && ollamaMappingResult && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Brain className="h-5 w-5 text-violet-600" /> Step 5: AI Semantic Column Mapping Review
                </CardTitle>
                <CardDescription>
                  Review AI-generated mappings between Excel columns from sheet{' '}
                  <span className="font-bold text-foreground">{selectedSheet}</span> (Row {selectedHeaderRow}) and{' '}
                  <span className="font-bold text-foreground">{selectedTemplate?.code}</span> schema fields.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {requiredUnmapped > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {requiredUnmapped} Required Unmapped
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {clientHeaders.length} Excel Columns
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
              <Button variant="outline" onClick={() => setStep(4)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Template Selection
              </Button>
              <Button onClick={runPreview} disabled={isLoadingPreview} size="lg" className="gap-2">
                {isLoadingPreview ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Validating...
                  </>
                ) : (
                  <>
                    Confirm Mapping & Validate Preview <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STEP 6: Import Validation & Preview
         ═══════════════════════════════════════════════════════════════ */}
      {step === 6 && previewReport && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" /> Step 6: Import Preview & Validation
            </CardTitle>
            <CardDescription>
              Parsed {previewReport.totalRows} rows from {previewReport.fileName} ({selectedSheet}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border bg-card">
                <div className="text-xs text-muted-foreground font-medium">Total Rows</div>
                <div className="text-2xl font-extrabold mt-1">{previewReport.totalRows}</div>
              </div>
              <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-200">
                <div className="text-xs text-emerald-700 font-medium">Valid Rows</div>
                <div className="text-2xl font-extrabold text-emerald-700 mt-1">{previewReport.validRowsCount}</div>
              </div>
              <div className="p-4 rounded-xl border bg-destructive/5 border-destructive/20">
                <div className="text-xs text-destructive font-medium">Error Rows</div>
                <div className="text-2xl font-extrabold text-destructive mt-1">{previewReport.errorRowsCount}</div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setStep(5)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to AI Mapping
              </Button>
              <Button onClick={runExecution} disabled={isExecuting} size="lg" className="gap-2">
                {isExecuting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Importing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" /> Execute Import <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STEP 7: Execution Summary
         ═══════════════════════════════════════════════════════════════ */}
      {step === 7 && executionResult && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" /> Step 7: Import Execution Completed
            </CardTitle>
            <CardDescription>{executionResult.message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border bg-card">
                <div className="text-xs text-muted-foreground font-medium">Imported</div>
                <div className="text-2xl font-extrabold text-emerald-600 mt-1">{executionResult.importedCount}</div>
              </div>
              <div className="p-4 rounded-xl border bg-card">
                <div className="text-xs text-muted-foreground font-medium">Updated</div>
                <div className="text-2xl font-extrabold text-blue-600 mt-1">{executionResult.updatedCount}</div>
              </div>
              <div className="p-4 rounded-xl border bg-card">
                <div className="text-xs text-muted-foreground font-medium">Skipped</div>
                <div className="text-2xl font-extrabold text-amber-600 mt-1">{executionResult.skippedCount}</div>
              </div>
              <div className="p-4 rounded-xl border bg-card">
                <div className="text-xs text-muted-foreground font-medium">Failed</div>
                <div className="text-2xl font-extrabold text-red-600 mt-1">{executionResult.failedCount}</div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button onClick={resetWizard} size="lg" className="gap-2">
                <RefreshCw className="h-4 w-4" /> Import Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          COMPREHENSIVE DEBUG PANEL (All 10 Requested Items)
         ═══════════════════════════════════════════════════════════════ */}
      <div className="border rounded-xl bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            className="gap-2 text-xs font-mono text-muted-foreground hover:text-foreground"
          >
            <Code className="h-4 w-4" /> {showDebugPanel ? 'Hide Diagnostic Debug Panel' : 'Show Diagnostic Debug Panel (10 Items)'}
          </Button>
          <Badge variant="outline" className="font-mono text-[10px]">
            Debug Metrics
          </Badge>
        </div>

        {showDebugPanel && (
          <div className="space-y-4 pt-3 border-t text-xs font-mono">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 p-3 rounded-lg bg-muted/40 border">
                <h5 className="font-bold text-foreground">1. Workbook Worksheets</h5>
                <div className="flex flex-wrap gap-1">
                  {sheetScores.map((s) => (
                    <Badge key={s.sheetName} variant="secondary" className="text-[10px]">
                      {s.sheetName}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/40 border">
                <h5 className="font-bold text-foreground">2. Worksheet Scores</h5>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {sheetScores.map((s) => (
                    <div key={s.sheetName} className="flex justify-between text-[11px]">
                      <span>{s.sheetName}</span>
                      <span className="font-bold">{s.confidence}% (Score: {s.score})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/40 border">
                <h5 className="font-bold text-foreground">3. Selected Worksheet</h5>
                <p className="text-primary font-bold">{selectedSheet || 'None selected'} ({sheetConfidence}% Confidence)</p>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/40 border">
                <h5 className="font-bold text-foreground">4. Detected Header Row</h5>
                <p className="text-primary font-bold">Row {selectedHeaderRow} ({headerConfidence}% Confidence)</p>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/40 border">
                <h5 className="font-bold text-foreground">5. Header Confidence</h5>
                <p className="text-emerald-600 font-bold">{headerConfidence}%</p>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/40 border">
                <h5 className="font-bold text-foreground">6. Normalized Headers ({clientHeaders.length})</h5>
                <p className="text-muted-foreground line-clamp-2">
                  {clientHeaders.map((h) => h.toLowerCase().trim().replace(/_/g, ' ')).join(', ')}
                </p>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/40 border">
                <h5 className="font-bold text-foreground">7. Template Fields ({fieldDefs.length})</h5>
                <p className="text-muted-foreground line-clamp-2">
                  {fieldDefs.map((f) => f.key).join(', ')}
                </p>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/40 border">
                <h5 className="font-bold text-foreground">8. Prompt sent to Ollama</h5>
                <p className="text-muted-foreground max-h-20 overflow-y-auto whitespace-pre-wrap">
                  {ollamaMappingResult?.promptUsed || 'No prompt sent yet.'}
                </p>
              </div>
            </div>

            <div className="space-y-2 p-3 rounded-lg bg-muted/40 border">
              <h5 className="font-bold text-foreground">9. Raw LLM Response</h5>
              <pre className="text-[10px] bg-background p-2 rounded max-h-32 overflow-y-auto">
                {ollamaMappingResult?.promptUsed ? 'JSON raw output received' : 'None'}
              </pre>
            </div>

            <div className="space-y-2 p-3 rounded-lg bg-muted/40 border">
              <h5 className="font-bold text-foreground">10. Final Synthesized Mapping</h5>
              <pre className="text-[10px] bg-background p-2 rounded max-h-36 overflow-y-auto">
                {JSON.stringify(wizardMapping, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
