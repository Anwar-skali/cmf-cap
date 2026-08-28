import { useState, useRef, useMemo, Fragment } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Check,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Layers,
  FileJson,
  PenSquare,
  Table as TableIcon,
  Brain,
  LayoutTemplate,
  Loader2,
  Save,
  Rocket,
  Rows3,
  Sparkles,
  ScanSearch,
  AlignVerticalJustifyStart,
  AlignHorizontalJustifyStart,
  Wand2,
  Info,
  Trash2,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { templatesApi } from '@/api/templates';
import { CMFTemplate, TemplateSection, TemplateField, FieldType } from '@/types/template';
import { ProjectStructureExtractor, StructureExtractResult } from './services/ProjectStructureExtractor';
import type { WorksheetScore, OrientationMode } from '@/features/import/services/ExcelHeaderExtractor';
import { ExcelHeaderExtractor } from '@/features/import/services/ExcelHeaderExtractor';

interface StructureImportWizardProps {
  initialMode?: 'excel' | 'json' | 'manual';
  onClose: () => void;
  onSaved?: (created: CMFTemplate) => void;
}

type WizardMode = 'excel' | 'json' | 'manual';
type WizardStep = 'source' | 'excel-file' | 'json' | 'analysis' | 'structure' | 'metadata';

/** The three project roles that can be assigned permissions on fields. */
const PROJECT_ROLES = [
  { key: 'capacity_manager', label: 'Cap. Manager', color: 'blue' },
  { key: 'sqd',              label: 'SQD',          color: 'violet' },
  { key: 'buyer',            label: 'Buyer',        color: 'amber' },
] as const;

/** Toggle a role in/out of a string[] (immutable). */
function toggleRole(list: string[] | undefined, role: string): string[] {
  const arr = list ?? [];
  return arr.includes(role) ? arr.filter((r) => r !== role) : [...arr, role];
}

const FIELD_TYPE_OPTIONS: FieldType[] = [
  'text',
  'textarea',
  'integer',
  'decimal',
  'currency',
  'date',
  'boolean',
  'email',
  'phone',
  'dropdown',
  'multiselect',
  'checkbox',
  'radio',
  'status',
  'percentage',
  'file_upload',
  'user',
  'supplier',
  'project',
];

const SELECTABLE_TYPES: FieldType[] = ['status', 'dropdown', 'radio', 'multiselect'];

/** Options must be editable for selectable field types; others render simple inputs. */
function isSelectableType(type: string): boolean {
  return SELECTABLE_TYPES.includes(type as FieldType);
}

/** Serialize a field's DropdownOption[] into an editable comma-separated string. */
function optionsToText(options: TemplateField['options']): string {
  return (options || []).map((o) => o.value).join(', ');
}

/** Parse a comma/newline-separated string into DropdownOption[] (canonical CMF shape). */
function textToOptions(text: string): { value: string; label: string; order?: number }[] {
  return text
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((value, i) => ({ value, label: value, order: i + 1 }));
}

const STEP_META: Record<WizardStep, { num: number; title: string; icon: React.ReactNode }> = {
  source: { num: 1, title: 'Source', icon: <Layers className="h-3.5 w-3.5" /> },
  'excel-file': { num: 2, title: 'Upload Excel', icon: <Upload className="h-3.5 w-3.5" /> },
  json: { num: 2, title: 'Import JSON', icon: <FileJson className="h-3.5 w-3.5" /> },
  analysis: { num: 3, title: 'Workbook Analysis', icon: <ScanSearch className="h-3.5 w-3.5" /> },
  structure: { num: 4, title: 'Structure Review', icon: <Rows3 className="h-3.5 w-3.5" /> },
  metadata: { num: 5, title: 'Save', icon: <Save className="h-3.5 w-3.5" /> },
};

function toInternalName(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function clampCode(str: string): string {
  return toInternalName(str).toUpperCase().replace(/^_+|_+$/g, '') || 'CUSTOM_STRUCT';
}

/** Recursively set a field's included flag across sections/groups */
function applyFieldSelection(
  sections: TemplateSection[],
  setSections: React.Dispatch<React.SetStateAction<TemplateSection[]>>,
  sectionIdx: number,
  groupIdx: number,
  fieldIdx: number,
  updater: (f: TemplateField) => TemplateField,
) {
  setSections((prev) =>
    prev.map((sec, si) =>
      si !== sectionIdx
        ? sec
        : {
            ...sec,
            groups: sec.groups.map((grp, gi) =>
              gi !== groupIdx
                ? grp
                : { ...grp, fields: grp.fields.map((fld, fi) => (fi !== fieldIdx ? fld : updater(fld))) },
            ),
          },
    ),
  );
}

/** Toggle all fields across all sections and groups in the entire structure */
function toggleAllFieldsInStructure(
  setSections: React.Dispatch<React.SetStateAction<TemplateSection[]>>,
  enabled: boolean,
) {
  setSections((prev) =>
    prev.map((sec) => ({
      ...sec,
      groups: sec.groups.map((grp) => ({
        ...grp,
        fields: grp.fields.map((fld) => ({
          ...fld,
          visible: enabled,
        })),
      })),
    })),
  );
}

/** Toggle all fields in a specific section */
function toggleAllFieldsInSection(
  setSections: React.Dispatch<React.SetStateAction<TemplateSection[]>>,
  sectionIdx: number,
  enabled: boolean,
) {
  setSections((prev) =>
    prev.map((sec, si) =>
      si !== sectionIdx
        ? sec
        : {
            ...sec,
            groups: sec.groups.map((grp) => ({
              ...grp,
              fields: grp.fields.map((fld) => ({
                ...fld,
                visible: enabled,
              })),
            })),
          },
    ),
  );
}

/** Toggle all fields in a specific group */
function toggleAllFieldsInGroup(
  setSections: React.Dispatch<React.SetStateAction<TemplateSection[]>>,
  sectionIdx: number,
  groupIdx: number,
  enabled: boolean,
) {
  setSections((prev) =>
    prev.map((sec, si) =>
      si !== sectionIdx
        ? sec
        : {
            ...sec,
            groups: sec.groups.map((grp, gi) =>
              gi !== groupIdx
                ? grp
                : {
                    ...grp,
                    fields: grp.fields.map((fld) => ({
                      ...fld,
                      visible: enabled,
                    })),
                  },
            ),
          },
    ),
  );
}

export function StructureImportWizard({ initialMode = 'excel', onClose, onSaved }: StructureImportWizardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Tracks which field rows have their permissions panel open. Key = "si-gi-fi" */
  const [openPerms, setOpenPerms] = useState<Record<string, boolean>>({});
  const togglePerms = (si: number, gi: number, fi: number) =>
    setOpenPerms((prev) => { const k = `${si}-${gi}-${fi}`; return { ...prev, [k]: !prev[k] }; });

  const [mode, setMode] = useState<WizardMode>(initialMode);
  const [step, setStep] = useState<WizardStep>(initialMode === 'manual' ? 'structure' : initialMode === 'json' ? 'json' : 'source');

  // Excel source
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [orientation, setOrientation] = useState<OrientationMode>('AUTO');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>('');

  // Raw output of live workbook scan (async, fires as soon as a file is uploaded)
  const [liveSheetScores, setLiveSheetScores] = useState<WorksheetScore[]>([]);
  const [liveDetectedSheet, setLiveDetectedSheet] = useState<string>('');

  // JSON source
  const [jsonText, setJsonText] = useState<string>('');
  const [isParsingJson, setIsParsingJson] = useState(false);

  // Extracted structure (both excel & json paths)
  const [extractResult, setExtractResult] = useState<StructureExtractResult | null>(null);
  const [editableSections, setEditableSections] = useState<TemplateSection[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  // Metadata
  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [version, setVersion] = useState<string>('1.0');
  const [description, setDescription] = useState<string>('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [isSaving, setIsSaving] = useState(false);

  const isJsonMode = mode === 'json';

  // ── Excel helpers ─────────────────────────────────────────────────────────

  const performLiveScan = async (file: File) => {
    try {
      const info = await ExcelHeaderExtractor.extractFromFile(file, undefined, undefined, undefined, 'AUTO');
      setLiveSheetScores(info.sheetScores || []);
      setLiveDetectedSheet(info.sheetName || '');
    } catch {
      setLiveSheetScores([]);
      setLiveDetectedSheet('');
    }
  };

  const runExcelExtraction = async (file: File, sheetOverride?: string, orientOverride?: OrientationMode) => {
    setIsAnalyzing(true);
    setAnalysisError('');
    try {
      const effectiveOrientation = orientOverride ?? orientation;
      const result = await ProjectStructureExtractor.extractFromExcel(
        file,
        effectiveOrientation,
        name || undefined,
        code || undefined,
        sheetOverride,
      );
      setExtractResult(result);
      setSelectedSheet(sheetOverride ?? result.detectedSheet ?? '');
      setEditableSections(result.sections);
      if (step === 'excel-file' || step === 'source' || step === 'analysis') setStep('analysis');
    } catch (err: any) {
      setAnalysisError(err?.message || 'Failed to extract project structure from the Excel file.');
      toast.error(err?.message || 'Failed to extract structure from the Excel file.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const file = files[0];
    if (!file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
      toast.error('Please select a valid Excel file (.xlsx, .xls, .xlsm)');
      return;
    }
    setSelectedFile(file);
    setName('');
    setCode('');
    setVersion('1.0');
    setEditableSections([]);
    setExtractResult(null);
    void performLiveScan(file);
    setStep('excel-file');
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
    setName('');
    setCode('');
    setVersion('1.0');
    setEditableSections([]);
    setExtractResult(null);
    void performLiveScan(file);
    setStep('excel-file');
  };

  const handleAnalyze = () => {
    if (!selectedFile) {
      toast.error('Please upload an Excel file first.');
      return;
    }
    runExcelExtraction(selectedFile, undefined, orientation);
  };

  const handleSheetChange = (sheetName: string) => {
    if (!selectedFile) return;
    setSelectedSheet(sheetName);
    runExcelExtraction(selectedFile, sheetName, orientation);
  };

  const handleOrientationChange = (orient: OrientationMode) => {
    setOrientation(orient);
    if (selectedFile && extractResult) {
      runExcelExtraction(selectedFile, selectedSheet || undefined, orient);
    }
  };

  // ── JSON helpers ──────────────────────────────────────────────────────────

  const handleParseJson = () => {
    if (!jsonText.trim()) {
      toast.error('Please paste a JSON structure file.');
      return;
    }
    setIsParsingJson(true);
    setAnalysisError('');
    try {
      const result = ProjectStructureExtractor.extractFromJson(jsonText);
      setExtractResult(result);
      setEditableSections(result.sections);
      setStep('structure');
    } catch (err: any) {
      setAnalysisError(err?.message || 'Invalid JSON structure file.');
      toast.error(err?.message || 'Invalid JSON structure file.');
    } finally {
      setIsParsingJson(false);
    }
  };

  const handleUploadJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result || '');
        setJsonText(text);
        const result = ProjectStructureExtractor.extractFromJson(text, file.name);
        setExtractResult(result);
        setEditableSections(result.sections);
        setStep('structure');
      } catch (err: any) {
        toast.error(err?.message || 'Invalid JSON structure file.');
      }
    };
    reader.onerror = () => toast.error('Failed to read JSON file.');
    reader.readAsText(file);
  };

  // ── Metadata / Save ───────────────────────────────────────────────────────

  const deriveName = () =>
    name.trim() ||
    extractResult?.name ||
    (selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'Custom Project Structure');

  const deriveCode = () => clampCode(code || extractResult?.code || deriveName());

  const totalFields = useMemo(
    () =>
      editableSections.reduce(
        (acc, sec) => acc + sec.groups.reduce((gAcc, grp) => gAcc + grp.fields.length, 0),
        0,
      ),
    [editableSections],
  );

  const totalTables = useMemo(
    () => editableSections.reduce((acc, sec) => acc + sec.groups.length, 0),
    [editableSections],
  );
  const relationshipCount = extractResult?.detectedRelationshipCount ?? 0;
  const relationships = extractResult?.relationships ?? [];

  // Required selectable fields must have options (or a default) to be usable in
  // project creation. Track problems so the review step can warn and publishing can be blocked.
  const selectableProblems = useMemo(() => {
    const problems: string[] = [];
    editableSections.forEach((sec) =>
      sec.groups.forEach((grp) =>
        grp.fields.forEach((fld) => {
          if (fld.visible === false) return;
          if (!isSelectableType(fld.type)) return;
          if (!fld.required) return;
          const hasOptions = Array.isArray(fld.options) && fld.options.length > 0;
          const hasDefault =
            fld.defaultValue !== undefined && fld.defaultValue !== null && fld.defaultValue !== '';
          if (!hasOptions && !hasDefault) {
            problems.push(fld.label || fld.internalName || 'Unnamed field');
          }
        }),
      ),
    );
    return problems;
  }, [editableSections]);

  const handleSave = async (publish: boolean) => {
    if (!deriveName().trim() || !deriveCode()) {
      toast.error('Structure name and code are required.');
      return;
    }
    if (publish && selectableProblems.length > 0) {
      toast.error(
        `Cannot publish: required selectable field(s) have no options — ${selectableProblems.join(', ')}`,
      );
      return;
    }
    setIsSaving(true);
    try {
      const schemaJson = {
        code: deriveCode(),
        name: deriveName(),
        version: version.trim() || '1.0',
        status: publish ? 'PUBLISHED' : 'DRAFT',
        description: description.trim() || undefined,
        orientation: extractResult?.orientation,
        sections: editableSections.map((sec) => ({
          ...sec,
          groups: sec.groups
            .map((grp) => ({
              ...grp,
              fields: grp.fields.filter((f) => f.visible !== false),
            }))
            .filter((grp) => grp.fields.length > 0),
        })),
        modules: editableSections.length,
        tables: totalTables,
        fieldCount: totalFields,
        relationships: relationships,
        dashboardConfig: {
          kpis: [],
          charts: [],
        },
      };

      const created = await templatesApi.createStructureTemplate({
        code: deriveCode(),
        name: deriveName(),
        description: description.trim() || undefined,
        version: version.trim() || '1.0',
        status: publish ? 'PUBLISHED' : 'DRAFT',
        schema_json: schemaJson,
      });

      toast.success(`Project Structure "${created.name}" ${publish ? 'published' : 'saved as draft'}!`);
      onSaved?.(created);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save Project Structure.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── UI: step order / stepper ──────────────────────────────────────────────

  const stepList: WizardStep[] = isJsonMode
    ? ['source', 'json', 'structure', 'metadata']
    : ['source', 'excel-file', 'analysis', 'structure', 'metadata'];

  const stepIndex = stepList.indexOf(step);
  const goNext = (target: WizardStep) => setStep(target);

  const renderStepper = () => (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        {stepList.map((s, idx) => {
          const isCompleted = stepIndex > idx;
          const isCurrent = stepIndex === idx;
          return (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  isCompleted
                    ? 'bg-primary text-primary-foreground'
                    : isCurrent
                    ? 'bg-primary/20 text-primary border-2 border-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </div>
              <span
                className={`text-xs font-medium ${isCurrent ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
              >
                {STEP_META[s].title}
              </span>
              {idx < stepList.length - 1 && <span className="mx-0.5 text-muted-foreground/40">›</span>}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {renderStepper()}

      {/* ══════════ STEP: SOURCE ────────── */}
      {step === 'source' && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" /> Step 1: Choose Source
            </CardTitle>
            <CardDescription>
              Create a NEW Project Structure (Template) — this does not create a project or import data.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                key: 'excel' as WizardMode,
                icon: <FileSpreadsheet className="h-5 w-5 text-emerald-600" />,
                title: 'From Excel File',
                desc: 'Analyze a workbook and auto-generate a Structure from detected fields & orientation.',
              },
              {
                key: 'json' as WizardMode,
                icon: <FileJson className="h-5 w-5 text-blue-600" />,
                title: 'Import JSON Schema',
                desc: 'Paste or upload an existing CMF Template JSON to adopt as the Project Structure.',
              },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setMode(opt.key);
                  if (opt.key === 'json') goNext('json');
                  else goNext('excel-file');
                }}
                className="flex flex-col items-start text-left p-5 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:shadow-md transition-all gap-3"
              >
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">{opt.icon}</div>
                <span className="text-sm font-bold text-foreground">{opt.title}</span>
                <span className="text-xs text-muted-foreground leading-relaxed">{opt.desc}</span>
              </button>
            ))}

            {/* Manual Definition — Coming Soon */}
            <div
              className="relative flex flex-col items-start text-left p-5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 gap-3 opacity-50 cursor-not-allowed select-none"
              aria-disabled="true"
            >
              {/* Coming Soon badge */}
              <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2z"/><polyline points="12 6 12 12 16 14"/></svg>
                Coming Soon
              </span>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <PenSquare className="h-5 w-5 text-violet-600" />
              </div>
              <span className="text-sm font-bold text-foreground">Manual Definition</span>
              <span className="text-xs text-muted-foreground leading-relaxed">Define name, code, and schema manually (no source file required).</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════ STEP: JSON INPUT ────────── */}
      {isJsonMode && step === 'json' && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <FileJson className="h-5 w-5 text-blue-600" /> Import Project Structure JSON
                </CardTitle>
                <CardDescription>
                  Paste a CMF Template JSON object below (or upload a .json file). The sections/fields shape will be adopted as the new Structure.
                </CardDescription>
              </div>
              <label className="cursor-pointer">
                <input type="file" accept=".json,application/json" className="hidden" onChange={handleUploadJsonFile} />
                <Button type="button" variant="outline" size="sm" className="rounded-full text-xs font-bold gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> Upload .json
                </Button>
              </label>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder={'{\n  "code": "CUSTOM",\n  "name": "Custom Structure",\n  "sections": [\n    {\n      "name": "General",\n      "groups": [{ "name": "Details", "fields": [{ "label": "Part Name", "type": "text" }] }]\n    }\n  ]\n}'}
              className="font-mono text-xs min-h-[260px] bg-slate-950 text-blue-300 border-slate-800"
            />
            {analysisError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-300/50 bg-rose-50 text-rose-700 px-3 py-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {analysisError}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => goNext('source')} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleParseJson} size="lg" disabled={isParsingJson} className="gap-2">
                {isParsingJson ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                Parse & Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════ STEP: EXCEL FILE UPLOAD + ORIENTATION ────────── */}
      {mode === 'excel' && step === 'excel-file' && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" /> Upload Excel Workbook
            </CardTitle>
            <CardDescription>Supports VERTICAL (Col A = field name, Col B = value) and HORIZONTAL (Row 1 = headers) layouts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all border-muted-foreground/30 hover:border-primary hover:bg-muted/30"
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.xlsm" className="hidden" onChange={handleFileSelect} />
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-3">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
              </div>
              <h4 className="font-semibold text-base">Drag & drop your Excel file here</h4>
              <p className="text-sm text-muted-foreground mt-1">or click to browse (.xlsx, .xls, .xlsm)</p>
            </div>

            {selectedFile && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-300/50 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{selectedFile.name}</span>
                <span className="ml-auto font-normal text-emerald-700">Workbook scanned live ✓</span>
              </div>
            )}

            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Wand2 className="h-4 w-4 text-primary" /> Layout Orientation
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  { value: 'AUTO' as OrientationMode, label: 'Auto-detect', icon: <Wand2 className="h-4 w-4" />, desc: 'Best fit for the file' },
                  { value: 'VERTICAL' as OrientationMode, label: 'Vertical', icon: <AlignVerticalJustifyStart className="h-4 w-4" />, desc: 'Key / value columns' },
                  { value: 'HORIZONTAL' as OrientationMode, label: 'Horizontal', icon: <AlignHorizontalJustifyStart className="h-4 w-4" />, desc: 'Row-per-record table' },
                ]).map((o) => (
                  <button
                    key={o.value}
                    onClick={() => handleOrientationChange(o.value)}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left text-xs ${
                      orientation === o.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/30'
                    }`}
                  >
                    <span className={orientation === o.value ? 'text-primary' : 'text-muted-foreground'}>{o.icon}</span>
                    <span className="font-bold">{o.label}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{o.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {analysisError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-300/50 bg-rose-50 text-rose-700 px-3 py-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {analysisError}
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => goNext('source')} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleAnalyze} size="lg" disabled={!selectedFile || isAnalyzing} className="gap-2">
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                {isAnalyzing ? 'Analyzing Workbook...' : 'Analyze Workbook'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════ STEP: WORKBOOK ANALYSIS (SHEET SCORING) ────────── */}
      {mode === 'excel' && step === 'analysis' && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" /> Workbook Analysis
                </CardTitle>
                <CardDescription>
                  Choose which worksheet to derive the Structure from. Scores are computed by the shared worksheet-scoring engine.
                </CardDescription>
              </div>
              {extractResult?.orientation && (
                <Badge
                  variant="outline"
                  className={`text-xs font-bold ${
                    extractResult.orientation === 'VERTICAL'
                      ? 'border-violet-400/60 text-violet-700 bg-violet-50'
                      : 'border-sky-400/60 text-sky-700 bg-sky-50'
                  }`}
                >
                  Mode: {extractResult.orientation}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {isAnalyzing ? (
              <div className="py-12 text-center text-muted-foreground space-y-3">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
                <p className="font-medium text-sm">Re-analyzing workbook with selected worksheet...</p>
              </div>
            ) : (
              <>
                {(liveSheetScores.length > 0 || extractResult?.sheetScores?.length) && (
                  <div className="rounded-xl border border-emerald-300/50 bg-emerald-50 dark:bg-emerald-950/20 p-4 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                        Recommended data sheet:
                      </span>
                      <span className="text-sm font-extrabold text-foreground">
                        {selectedSheet || liveDetectedSheet || extractResult?.detectedSheet || '—'}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {extractResult?.detectedFieldCount ?? 0} fields • {extractResult?.detectedModuleCount ?? 0} sections
                      detected from the selected worksheet.
                    </p>
                  </div>
                )}

                <div className="rounded-xl border overflow-hidden">
                  <div className="p-3 bg-muted/40 border-b flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">Worksheets</span>
                  </div>
                  {(liveSheetScores.length > 0 || extractResult?.sheetScores?.length) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 p-3">
                      {(liveSheetScores.length > 0 ? liveSheetScores : extractResult?.sheetScores || []).map((s) => {
                        const isSelected = s.sheetName === selectedSheet;
                        const isDetected = s.sheetName === (extractResult?.detectedSheet || liveDetectedSheet);
                        return (
                          <div
                            key={s.sheetName}
                            onClick={() => handleSheetChange(s.sheetName)}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              isSelected ? 'border-primary bg-primary/5' : isDetected ? 'border-emerald-400/50' : 'border-muted hover:border-primary/40'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <TableIcon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                <span className="font-bold text-sm truncate">{s.sheetName}</span>
                              </div>
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {s.confidence}% Score
                              </Badge>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5">
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                {s.classification || 'PROJECT_DATA'}
                              </span>
                              {isDetected && (
                                <span className="text-[10px] font-bold text-emerald-700">Recommended ✓</span>
                              )}
                            </div>
                            <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                              <div className="flex justify-between">
                                <span>Rows:</span>
                                <span className="font-medium text-foreground">{s.populatedRows}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Columns:</span>
                                <span className="font-medium text-foreground">{s.maxColumns}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Field Matches:</span>
                                <span className="font-medium text-emerald-600">{s.projectFieldMatches ?? s.keywordHits}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      No worksheet scores available. Click <strong>Analyze Workbook</strong> to score worksheets.
                    </div>
                  )}
                </div>

                {analysisError && (
                  <div className="flex items-center gap-2 rounded-lg border border-rose-300/50 bg-rose-50 text-rose-700 px-3 py-2 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {analysisError}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Button variant="outline" onClick={() => goNext('excel-file')} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Upload File
                  </Button>
                  <Button
                    onClick={() => goNext('structure')}
                    size="lg"
                    disabled={!extractResult}
                    className="gap-2"
                  >
                    Review Structure <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ══════════ STEP: STRUCTURE REVIEW & EDIT ────────── */}
      {step === 'structure' && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Rows3 className="h-5 w-5 text-primary" /> Structure Review
                </CardTitle>
                <CardDescription>
                  Confirm the detected module / table / field layout. Uncheck any field you do not want in the new
                  Structure.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAllFieldsInStructure(setEditableSections, true)}
                  className="h-7 text-xs font-bold text-blue-600 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer"
                >
                  Enable All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAllFieldsInStructure(setEditableSections, false)}
                  className="h-7 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Disable All
                </Button>
                <Badge variant="outline" className="text-xs">{totalFields} Fields</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[46vh] overflow-y-auto pr-1">
            {extractResult && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 min-w-10 max-w-32 items-center justify-center rounded-xl bg-blue-600/15 text-blue-600 font-black text-xs border border-blue-500/30 px-2 shrink-0 truncate">
                      {deriveCode()}
                    </div>
                    <div>
                      <span className="text-sm font-extrabold text-foreground block">{deriveName()}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {deriveCode()} • Version {version.trim() || '1.0'} • {status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-background/80 p-2.5 rounded-lg border">
                    <span className="text-muted-foreground block text-[10px]">Modules</span>
                    <span className="font-bold text-foreground">{extractResult.detectedModuleCount ?? editableSections.length}</span>
                  </div>
                  <div className="bg-background/80 p-2.5 rounded-lg border">
                    <span className="text-muted-foreground block text-[10px]">Tables</span>
                    <span className="font-bold text-foreground">{extractResult.detectedTableCount ?? totalTables}</span>
                  </div>
                  <div className="bg-background/80 p-2.5 rounded-lg border">
                    <span className="text-muted-foreground block text-[10px]">Fields</span>
                    <span className="font-bold text-foreground">{totalFields}</span>
                  </div>
                  <div className="bg-background/80 p-2.5 rounded-lg border">
                    <span className="text-muted-foreground block text-[10px]">Relationships</span>
                    <span className="font-bold text-foreground">{relationshipCount}</span>
                  </div>
                </div>
                {extractResult.orientation && (
                  <p className="text-[11px] text-muted-foreground">
                    Source orientation: <strong className="text-foreground">{extractResult.orientation}</strong>
                  </p>
                )}
              </div>
            )}

            {selectableProblems.length > 0 && (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-700">
                    Required selectable fields have no options
                  </span>
                </div>
                <p className="text-[11px] text-amber-800/90 leading-relaxed">
                  These required fields will render as empty selects and make project creation impossible.
                  Add options (or a default value) for each field before publishing this structure.
                </p>
                <ul className="text-[11px] font-bold text-amber-700 space-y-0.5 pl-1">
                  {selectableProblems.map((label) => (
                    <li key={label}>• {label}</li>
                  ))}
                </ul>
              </div>
            )}

            {editableSections.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <LayoutTemplate className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  No structure yet. For manual mode, fill in the metadata in the next step and save.
                </p>
              </div>
            ) : (
              editableSections.map((sec, si) => {
                const secFields = sec.groups.flatMap((g) => g.fields);
                const secTotalCount = secFields.length;
                const secEnabledCount = secFields.filter((f) => f.visible !== false).length;
                const secAllEnabled = secTotalCount > 0 && secEnabledCount === secTotalCount;
                const secSomeEnabled = secEnabledCount > 0 && secEnabledCount < secTotalCount;

                return (
                <div key={sec.id || `sec-${si}`} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-blue-600 shrink-0" />
                      <Input
                        value={sec.name}
                        onChange={(e) =>
                          setEditableSections((prev) =>
                            prev.map((s, i) => (i === si ? { ...s, name: e.target.value } : s)),
                          )
                        }
                        className="h-8 w-64 text-xs font-bold"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Section Master Checkbox Toggle */}
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors select-none">
                        <input
                          type="checkbox"
                          checked={secAllEnabled}
                          ref={(el) => {
                            if (el) el.indeterminate = secSomeEnabled;
                          }}
                          onChange={(e) => toggleAllFieldsInSection(setEditableSections, si, e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-[11px] font-bold">
                          {secAllEnabled ? 'All on' : secSomeEnabled ? `${secEnabledCount}/${secTotalCount} on` : 'All off'}
                        </span>
                      </label>
                      <Badge variant="secondary" className="text-[10px]">
                        {secEnabledCount}/{secTotalCount} fields
                      </Badge>
                    </div>
                  </div>

                  {sec.groups.map((grp, gi) => {
                    const grpTotalCount = grp.fields.length;
                    const grpEnabledCount = grp.fields.filter((f) => f.visible !== false).length;
                    const grpAllEnabled = grpTotalCount > 0 && grpEnabledCount === grpTotalCount;
                    const grpSomeEnabled = grpEnabledCount > 0 && grpEnabledCount < grpTotalCount;

                    return (
                    <div key={grp.id || `grp-${si}-${gi}`} className="pl-2 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2 py-0.5">
                        <div className="flex items-center gap-2">
                          {/* Group Master Checkbox Toggle */}
                          <input
                            type="checkbox"
                            checked={grpAllEnabled}
                            ref={(el) => {
                              if (el) el.indeterminate = grpSomeEnabled;
                            }}
                            onChange={(e) => toggleAllFieldsInGroup(setEditableSections, si, gi, e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            title={grpAllEnabled ? 'Disable all fields in group' : 'Enable all fields in group'}
                          />
                          <TableIcon className="h-3 w-3 text-blue-500 shrink-0" />
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-foreground">
                            {grp.name || 'General'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {grpEnabledCount}/{grpTotalCount} enabled
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleAllFieldsInGroup(setEditableSections, si, gi, true)}
                            className="text-[10px] font-bold text-blue-600 hover:underline px-1 py-0.5 cursor-pointer"
                          >
                            All
                          </button>
                          <span className="text-muted-foreground text-[10px]">|</span>
                          <button
                            type="button"
                            onClick={() => toggleAllFieldsInGroup(setEditableSections, si, gi, false)}
                            className="text-[10px] font-bold text-muted-foreground hover:underline px-1 py-0.5 cursor-pointer"
                          >
                            None
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {grp.fields.map((fld, fi) => {
                          const permKey = `${si}-${gi}-${fi}`;
                          const isPermOpen = !!openPerms[permKey];
                          const viewRoles  = fld.permissions?.rolesAllowedToView  ?? [];
                          const editRoles  = fld.permissions?.rolesAllowedToEdit  ?? [];
                          const hasPerms   = viewRoles.length > 0 || editRoles.length > 0;
                          // Detect the single restricting role (if any) for the inline badge
                          const ROLE_KEYS = ['buyer', 'capacity_manager', 'sqd'] as const;
                          const autoRole = editRoles.find((r) => (ROLE_KEYS as readonly string[]).includes(r)) as
                            | 'buyer' | 'capacity_manager' | 'sqd' | undefined;
                          const roleMeta: Record<'buyer'|'capacity_manager'|'sqd', {label:string;cls:string}> = {
                            buyer:            { label: 'Buyer',       cls: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300' },
                            capacity_manager: { label: 'Cap. Mgr',   cls: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300' },
                            sqd:              { label: 'SQD',         cls: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/30 dark:text-violet-300' },
                          };
                          return (
                          <Fragment key={fld.id || `fld-${si}-${gi}-${fi}`}>
                          {/* ── Main field row ── */}
                          <div
                            className={`rounded-lg border text-xs ${
                              fld.visible === false ? 'opacity-50 bg-muted/40' : ''
                            }`}
                          >
                            <div className="grid grid-cols-12 gap-2 items-center px-2.5 py-2">
                              <div className="col-span-1 flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={fld.visible !== false}
                                  onChange={(e) =>
                                    applyFieldSelection(editableSections, setEditableSections, si, gi, fi, (f) => ({
                                      ...f,
                                      visible: e.target.checked,
                                    }))
                                  }
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </div>
                              <div className="col-span-4">
                                <input
                                  type="text"
                                  value={fld.label}
                                  onChange={(e) =>
                                    applyFieldSelection(editableSections, setEditableSections, si, gi, fi, (f) => ({
                                      ...f,
                                      label: e.target.value,
                                      internalName: toInternalName(e.target.value) || f.internalName,
                                    }))
                                  }
                                  className="w-full h-7 rounded-md border border-slate-300 dark:border-slate-700 px-2 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                {autoRole && (
                                  <span
                                    className={`mt-0.5 inline-flex items-center gap-0.5 rounded border px-1.5 py-px text-[9px] font-bold ${roleMeta[autoRole].cls}`}
                                    title={`Auto-restricted to ${roleMeta[autoRole].label} only`}
                                  >
                                    🔒 {roleMeta[autoRole].label} only
                                  </span>
                                )}
                              </div>
                              <div className="col-span-2 font-mono text-[10px] text-muted-foreground truncate" title={fld.internalName}>
                                {fld.internalName}
                              </div>
                              <div className="col-span-2">
                                <select
                                  value={fld.type}
                                  onChange={(e) =>
                                    applyFieldSelection(editableSections, setEditableSections, si, gi, fi, (f) => ({
                                      ...f,
                                      type: e.target.value as FieldType,
                                    }))
                                  }
                                  className="w-full h-7 rounded-md border border-slate-300 dark:border-slate-700 px-1.5 text-[11px] bg-background focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                >
                                  {FIELD_TYPE_OPTIONS.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-span-3 flex items-center justify-end gap-1.5">
                                <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!fld.required}
                                    onChange={(e) =>
                                      applyFieldSelection(editableSections, setEditableSections, si, gi, fi, (f) => ({
                                        ...f,
                                        required: e.target.checked,
                                      }))
                                    }
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 cursor-pointer"
                                  />
                                  Req
                                </label>
                                {/* Permissions toggle button */}
                                <button
                                  onClick={() => togglePerms(si, gi, fi)}
                                  title="Field permissions"
                                  className={`flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold transition-colors ${
                                    hasPerms
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                      : 'text-muted-foreground hover:text-blue-600'
                                  }`}
                                >
                                  <ShieldCheck className="h-3 w-3" />
                                  <ChevronDown className={`h-2.5 w-2.5 transition-transform ${isPermOpen ? 'rotate-180' : ''}`} />
                                </button>
                                <button
                                  onClick={() =>
                                    applyFieldSelection(editableSections, setEditableSections, si, gi, fi, (f) => ({
                                      ...f,
                                      visible: false,
                                    }))
                                  }
                                  className="text-muted-foreground hover:text-rose-600 cursor-pointer"
                                  title="Disable field"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* ── Options row (selectable types) ── */}
                            {isSelectableType(fld.type) && fld.visible !== false && (
                              <div className="grid grid-cols-12 gap-2 items-center border-t border-slate-200 dark:border-slate-700 px-2.5 pb-2 pt-1 text-[11px] bg-slate-50/50 dark:bg-slate-900/40">
                                <div className="col-span-1" />
                                <div className="col-span-7 space-y-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Options (comma-separated)
                                  </span>
                                  <input
                                    type="text"
                                    value={optionsToText(fld.options)}
                                    placeholder="e.g. GREEN, ORANGE, RED, OPEN"
                                    onChange={(e) =>
                                      applyFieldSelection(editableSections, setEditableSections, si, gi, fi, (f) => ({
                                        ...f,
                                        options: textToOptions(e.target.value),
                                      }))
                                    }
                                    className="w-full h-7 rounded-md border border-slate-300 dark:border-slate-700 px-2 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                                <div className="col-span-4 space-y-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Default value
                                  </span>
                                  <input
                                    type="text"
                                    value={fld.defaultValue ?? ''}
                                    placeholder="(optional)"
                                    onChange={(e) =>
                                      applyFieldSelection(editableSections, setEditableSections, si, gi, fi, (f) => ({
                                        ...f,
                                        defaultValue: e.target.value || undefined,
                                      }))
                                    }
                                    className="w-full h-7 rounded-md border border-slate-300 dark:border-slate-700 px-2 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                              </div>
                            )}

                            {/* ── Permissions panel ── */}
                            {isPermOpen && fld.visible !== false && (
                              <div className="border-t border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/20 px-3 py-3 space-y-2">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <ShieldCheck className="h-3 w-3 text-blue-600" />
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                                    Role Permissions
                                  </span>
                                  <span className="text-[10px] text-muted-foreground ml-1">— click to toggle View / Edit access per role</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  {PROJECT_ROLES.map((role) => {
                                    const canView = viewRoles.includes(role.key);
                                    const canEdit = editRoles.includes(role.key);
                                    // colour map
                                    const viewCls = canView
                                      ? role.color === 'blue'   ? 'bg-blue-600 text-white border-blue-600'
                                        : role.color === 'violet' ? 'bg-violet-600 text-white border-violet-600'
                                        : 'bg-amber-500 text-white border-amber-500'
                                      : 'bg-background text-muted-foreground border-slate-300 dark:border-slate-700 hover:border-blue-400';
                                    const editCls = canEdit
                                      ? role.color === 'blue'   ? 'bg-blue-600 text-white border-blue-600'
                                        : role.color === 'violet' ? 'bg-violet-600 text-white border-violet-600'
                                        : 'bg-amber-500 text-white border-amber-500'
                                      : 'bg-background text-muted-foreground border-slate-300 dark:border-slate-700 hover:border-blue-400';
                                    return (
                                      <div key={role.key} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-background p-2 space-y-1.5">
                                        <span className={`block text-[10px] font-extrabold uppercase tracking-wider ${
                                          role.color === 'blue' ? 'text-blue-700' : role.color === 'violet' ? 'text-violet-700' : 'text-amber-700'
                                        }`}>{role.label}</span>
                                        <div className="flex gap-1">
                                          <button
                                            onClick={() =>
                                              applyFieldSelection(editableSections, setEditableSections, si, gi, fi, (f) => ({
                                                ...f,
                                                permissions: {
                                                  ...f.permissions,
                                                  rolesAllowedToView: toggleRole(f.permissions?.rolesAllowedToView, role.key),
                                                },
                                              }))
                                            }
                                            className={`flex-1 rounded border px-1 py-0.5 text-[9px] font-bold transition-colors ${viewCls}`}
                                          >
                                            👁 View
                                          </button>
                                          <button
                                            onClick={() =>
                                              applyFieldSelection(editableSections, setEditableSections, si, gi, fi, (f) => ({
                                                ...f,
                                                permissions: {
                                                  ...f.permissions,
                                                  rolesAllowedToEdit: toggleRole(f.permissions?.rolesAllowedToEdit, role.key),
                                                },
                                              }))
                                            }
                                            className={`flex-1 rounded border px-1 py-0.5 text-[9px] font-bold transition-colors ${editCls}`}
                                          >
                                            ✏ Edit
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="text-[9px] text-muted-foreground leading-relaxed pt-0.5">
                                  Active = coloured chip. No selection = all roles can access (open field).
                                  If only View is set, the role can see but not modify the field.
                                </p>
                              </div>
                            )}
                          </div>

                          </Fragment>
                          );
                        })}
                      </div>
                    </div>
                  ); })}
                </div>
              ); })
            )}
          </CardContent>
          <div className="px-6 pb-6 flex items-center justify-between border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => goNext(isJsonMode ? 'json' : mode === 'manual' ? 'structure' : 'analysis')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={() => goNext('metadata')} size="lg" disabled={!deriveName() && editableSections.length === 0} className="gap-2">
              Continue to Details <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* ══════════ STEP: METADATA & SAVE ────────── */}
      {step === 'metadata' && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Save className="h-5 w-5 text-primary" /> Structure Metadata
            </CardTitle>
            <CardDescription>
              Name, code, and version of the new Project Structure. Saves a Template — no project record is created.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="struct-name" className="text-xs font-bold">Structure Name</Label>
                <Input
                  id="struct-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={extractResult?.name || 'e.g. Custom Project Structure'}
                  className="rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="struct-code" className="text-xs font-bold">Code</Label>
                <Input
                  id="struct-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={extractResult?.code || 'e.g. CUSTOM_STRUCT'}
                  className="rounded-xl font-mono text-sm uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="struct-version" className="text-xs font-bold">Version</Label>
                <Input
                  id="struct-version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0"
                  className="rounded-xl font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setStatus('DRAFT')}
                    className={`rounded-xl border-2 px-3 py-2 text-xs font-bold transition-all text-left ${
                      status === 'DRAFT' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">Draft</div>
                    <span className="text-[10px] font-normal text-muted-foreground">In progress</span>
                  </button>
                  <button
                    onClick={() => setStatus('PUBLISHED')}
                    className={`rounded-xl border-2 px-3 py-2 text-xs font-bold transition-all text-left ${
                      status === 'PUBLISHED' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">Published</div>
                    <span className="text-[10px] font-normal text-muted-foreground">Available to projects</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="struct-desc" className="text-xs font-bold">Description</Label>
              <Textarea
                id="struct-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={extractResult?.description}
                className="rounded-xl text-sm min-h-[70px]"
              />
            </div>

            <div className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-[11px] text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
              <span>
                Final structure: <strong className="text-foreground">{deriveName()}</strong> (<code className="font-mono">{deriveCode()}</code>)
                with {editableSections.length} modules, {totalTables} tables, {totalFields} fields
                {relationshipCount > 0 ? `, ${relationshipCount} relationships` : ''}. This creates a{' '}
                <strong className="text-foreground">Template</strong> — no project will be created.
              </span>
            </div>

            {analysisError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-300/50 bg-rose-50 text-rose-700 px-3 py-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {analysisError}
              </div>
            )}

            {selectableProblems.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-[11px] text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Required selectable field(s) have no options —{' '}
                  <strong className="text-amber-800">{selectableProblems.join(', ')}</strong>. Publishing is blocked
                  until options or a default value are added.
                </span>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-3">
              <Button variant="outline" onClick={() => goNext('structure')} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Edit Structure
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleSave(false)}
                  disabled={isSaving}
                  variant="outline"
                  className="gap-2 rounded-full"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Draft
                </Button>
                <Button
                  onClick={() => handleSave(true)}
                  disabled={isSaving || selectableProblems.length > 0}
                  className="gap-2 rounded-full bg-[#0066CC] hover:bg-[#0052A3]"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Publish
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}