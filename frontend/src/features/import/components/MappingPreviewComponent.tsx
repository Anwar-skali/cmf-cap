/**
 * MappingPreviewComponent
 *
 * Displays the AI-generated (Ollama RAG) or fuzzy-fallback semantic mapping
 * between Excel column headers and template database fields. Allows the user
 * to manually override any mapping before confirming.
 */
import { useState } from 'react';
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Cpu,
  Layers,
  Zap,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { FieldDefinition, OllamaMappingItem, OllamaMappingResult } from '@/api/endpoints/importApi';

interface MappingPreviewProps {
  mappingResult: OllamaMappingResult;
  /** Current user-editable mapping: db_field_key -> excel_header | null */
  mapping: Record<string, string | null>;
  onMappingChange: (newMapping: Record<string, string | null>) => void;
}

function ConfidenceBadge({ confidence, source }: { confidence: number; source: string }) {
  const pct = Math.round(confidence * 100);

  if (source === 'none' || confidence === 0) {
    return (
      <Badge variant="destructive" className="text-xs gap-1">
        <XCircle className="h-3 w-3" /> No Match
      </Badge>
    );
  }

  if (pct >= 90) {
    return (
      <Badge className="text-xs gap-1 bg-emerald-500/15 text-emerald-700 border-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> {pct}% High
      </Badge>
    );
  }
  if (pct >= 70) {
    return (
      <Badge className="text-xs gap-1 bg-amber-500/15 text-amber-700 border-amber-400">
        <AlertTriangle className="h-3 w-3" /> {pct}% Med
      </Badge>
    );
  }
  return (
    <Badge className="text-xs gap-1 bg-destructive/10 text-destructive border-destructive/30">
      <XCircle className="h-3 w-3" /> {pct}% Low
    </Badge>
  );
}

function SourceBadge({ source }: { source: string }) {
  switch (source) {
    case 'ollama_llm':
      return (
        <Badge className="text-xs gap-1 bg-violet-500/10 text-violet-700 border-violet-300">
          <Brain className="h-3 w-3" /> Ollama AI
        </Badge>
      );
    case 'mapping_memory':
      return (
        <Badge className="text-xs gap-1 bg-blue-500/10 text-blue-700 border-blue-300">
          <Layers className="h-3 w-3" /> Cached
        </Badge>
      );
    case 'exact_match':
      return (
        <Badge className="text-xs gap-1 bg-emerald-500/10 text-emerald-700 border-emerald-300">
          <CheckCircle2 className="h-3 w-3" /> Exact
        </Badge>
      );
    case 'alias_match':
      return (
        <Badge className="text-xs gap-1 bg-cyan-500/10 text-cyan-700 border-cyan-300">
          <Zap className="h-3 w-3" /> Alias
        </Badge>
      );
    case 'fuzzy_fallback':
      return (
        <Badge className="text-xs gap-1 bg-orange-500/10 text-orange-700 border-orange-300">
          <Cpu className="h-3 w-3" /> Fuzzy
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          —
        </Badge>
      );
  }
}

export function MappingPreviewComponent({ mappingResult, mapping, onMappingChange }: MappingPreviewProps) {
  const [showPrompt, setShowPrompt] = useState(false);

  const fieldDefinitions = mappingResult.fieldDefinitions ?? [];
  const excelHeaders = mappingResult.excelHeaders ?? [];
  const ollamaActive = mappingResult.ollamaActive ?? false;
  const ollamaReachable = mappingResult.ollamaReachable ?? false;
  const executionTimes = mappingResult.executionTimes;
  const promptUsed = mappingResult.promptUsed ?? '';
  const model = mappingResult.model || '';

  // Stats
  const mappingEntries = Object.values(mappingResult.mapping || {});
  const highConf = mappingEntries.filter((m) => m.confidence >= 0.9 && m.excel).length;
  const medConf = mappingEntries.filter((m) => m.confidence >= 0.7 && m.confidence < 0.9 && m.excel).length;
  const noMatch = mappingEntries.filter((m) => !m.excel || m.confidence === 0).length;
  const requiredUnmapped = fieldDefinitions.filter(
    (f: FieldDefinition) => f.required && (!mapping[f.key] || mapping[f.key] === '__ignore__'),
  ).length;

  return (
    <div className="space-y-4">
      {/* AI Engine Status Banner */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border text-sm font-medium ${
          ollamaActive
            ? 'bg-violet-500/5 border-violet-400/30 text-violet-800'
            : ollamaReachable
            ? 'bg-blue-500/5 border-blue-400/30 text-blue-800'
            : 'bg-amber-500/5 border-amber-400/30 text-amber-800'
        }`}
      >
        <div className="flex items-center gap-3">
          {ollamaActive ? (
            <>
              <Brain className="h-5 w-5 text-violet-600 shrink-0" />
              <span>
                <span className="font-bold">Ollama AI Active</span> — Semantic mapping generated by local{' '}
                <code className="font-mono text-xs font-bold bg-violet-500/10 px-1.5 py-0.5 rounded">{model}</code> model via RAG.
              </span>
            </>
          ) : ollamaReachable ? (
            <>
              <Cpu className="h-5 w-5 text-blue-600 shrink-0" />
              <span>
                <span className="font-bold">Ollama Connected (Fuzzy Mode)</span> — Local Ollama server is online on port 11434, used deterministic fallback.
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <span>
                <span className="font-bold">Local Ollama Not Reachable</span> — Local Ollama service is unavailable at http://localhost:11434. Using deterministic fallback matching. Start Ollama (<code className="font-mono text-xs bg-amber-500/10 px-1 py-0.5 rounded">ollama serve</code>) to enable AI mapping.
              </span>
            </>
          )}
        </div>

        {/* Timing Metrics Badge */}
        {executionTimes && (
          <div className="flex items-center gap-2 text-xs shrink-0 self-end sm:self-auto">
            <span className="text-muted-foreground font-mono">
              Headers: <strong className="text-foreground">{executionTimes.headerResolutionMs ?? 0}ms</strong> | Load: <strong className="text-foreground">{executionTimes.templateLoadingMs ?? 0}ms</strong> | AI: <strong className="text-violet-700">{executionTimes.ollamaResponseTimeMs ? `${(executionTimes.ollamaResponseTimeMs / 1000).toFixed(1)}s` : '0s'}</strong> | Total: <strong className="text-primary">{(executionTimes.totalMappingMs ? executionTimes.totalMappingMs / 1000 : 0).toFixed(2)}s</strong>
            </span>
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border bg-card text-center">
          <div className="text-xs text-muted-foreground">Excel Columns</div>
          <div className="text-xl font-bold mt-0.5">{excelHeaders.length}</div>
        </div>
        <div className="p-3 rounded-xl border bg-emerald-500/5 text-center">
          <div className="text-xs text-emerald-700">High Confidence</div>
          <div className="text-xl font-bold mt-0.5 text-emerald-700">{highConf}</div>
        </div>
        <div className="p-3 rounded-xl border bg-amber-500/5 text-center">
          <div className="text-xs text-amber-700">Medium Confidence</div>
          <div className="text-xl font-bold mt-0.5 text-amber-700">{medConf}</div>
        </div>
        <div className="p-3 rounded-xl border bg-destructive/5 text-center">
          <div className="text-xs text-destructive">
            {requiredUnmapped > 0 ? `⚠ ${requiredUnmapped} Required Unmapped` : 'Unmapped'}
          </div>
          <div className={`text-xl font-bold mt-0.5 ${requiredUnmapped > 0 ? 'text-destructive' : ''}`}>{noMatch}</div>
        </div>
      </div>

      {/* Mapping Table */}
      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/60">
            <TableRow>
              <TableHead className="w-[30%] font-semibold">Database Field</TableHead>
              <TableHead className="w-[25%] font-semibold">Excel Column</TableHead>
              <TableHead className="w-[18%] font-semibold">Confidence</TableHead>
              <TableHead className="w-[15%] font-semibold">Source</TableHead>
              <TableHead className="w-[12%] text-center font-semibold">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fieldDefinitions.map((field: FieldDefinition, idx: number) => {
              const aiItem: OllamaMappingItem | undefined = mappingResult.mapping[field.key];
              const currentExcel = mapping[field.key] ?? null;
              const isMapped = currentExcel && currentExcel !== '__ignore__';

              return (
                <TableRow
                  key={`${field.key}-${idx}`}
                  className={
                    field.required && !isMapped
                      ? 'bg-destructive/5 border-l-4 border-l-destructive'
                      : isMapped && aiItem?.confidence && aiItem.confidence >= 0.9
                      ? 'border-l-4 border-l-emerald-400'
                      : ''
                  }
                >
                  {/* DB Field */}
                  <TableCell className="py-3">
                    <div className="font-semibold text-sm">
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">{field.key}</div>
                    {field.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 italic">{field.description}</div>
                    )}
                  </TableCell>

                  {/* Excel Column Selector */}
                  <TableCell className="py-3">
                    <Select
                      value={currentExcel ?? '__ignore__'}
                      onValueChange={(val) => {
                        const newMap = { ...mapping };
                        // Unset old mapping for this field across all keys
                        Object.keys(newMap).forEach((k) => {
                          if (k === field.key) delete newMap[k];
                        });
                        if (val !== '__ignore__') {
                          newMap[field.key] = val;
                        } else {
                          newMap[field.key] = null;
                        }
                        onMappingChange(newMap);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs max-w-[200px]">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__ignore__">
                          <span className="text-muted-foreground italic">— Unmapped / Ignore —</span>
                        </SelectItem>
                        {excelHeaders.map((h: string, hIdx: number) => (
                          <SelectItem key={`hdr-${h}-${hIdx}`} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Confidence */}
                  <TableCell className="py-3">
                    {aiItem ? (
                      <ConfidenceBadge confidence={aiItem.confidence} source={aiItem.source} />
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        N/A
                      </Badge>
                    )}
                  </TableCell>

                  {/* Source */}
                  <TableCell className="py-3">
                    {aiItem ? (
                      <SourceBadge source={aiItem.source} />
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        —
                      </Badge>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="text-center py-3">
                    {isMapped ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 text-xs">Mapped</Badge>
                    ) : field.required ? (
                      <Badge variant="destructive" className="text-xs">
                        Required!
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Optional
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* RAG Prompt Inspector */}
      {promptUsed && (
        <div className="rounded-xl border overflow-hidden">
          <button
            onClick={() => setShowPrompt((s) => !s)}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-medium"
          >
            <span className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              RAG Prompt Inspector — View the exact prompt sent to Ollama
            </span>
            {showPrompt ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {showPrompt && (
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap text-muted-foreground bg-muted/20 max-h-64 overflow-y-auto">
              {promptUsed}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
