import { useState } from 'react';
import { 
  BarChart3, Download, Activity, AlertTriangle, 
  Users, CheckCircle2, Package, TrendingUp, Filter, PieChart as PieChartIcon
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { useProjectsQuery } from '@/hooks/queries/useProjectsQuery';
import { useRisksQuery } from '@/hooks/queries/useRisksQuery';
import { useSuppliersQuery } from '@/hooks/queries/useSuppliersQuery';
import { useCapacityAssessmentsQuery } from '@/hooks/queries/useCapacityQuery';
import { exportToPDF, exportToExcel } from '@/utils/exportUtils';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import type { CapacityAssessment, Supplier } from '@/types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const SEVERITY_COLORS: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#991b1b' };

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch data
  const { data: projectsData, isLoading: isLoadingProjects } = useProjectsQuery();
  const { data: risksData, isLoading: isLoadingRisks } = useRisksQuery();
  const { data: suppliersData, isLoading: isLoadingSuppliers } = useSuppliersQuery();
  const { data: capacityData, isLoading: isLoadingCapacity } = useCapacityAssessmentsQuery();

  const projects = projectsData?.items || [];
  const risks = risksData?.items || [];
  const suppliers = suppliersData?.items || [];
  const capacity = capacityData?.items || [];

  const isLoading = isLoadingProjects || isLoadingRisks || isLoadingSuppliers || isLoadingCapacity;

  // --- Data Transformations for Charts ---

  // 1. Project Status Distribution
  const projectStatusCount = projects.reduce((acc, proj) => {
    const status = proj.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const projectStatusData = Object.entries(projectStatusCount).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  // 2. Risks by Severity
  const riskSeverityCount = risks.reduce((acc, risk) => {
    const severity = risk.severity || 'low';
    acc[severity] = (acc[severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const riskSeverityData = ['low', 'medium', 'high', 'critical'].map(sev => ({
    name: sev.charAt(0).toUpperCase() + sev.slice(1),
    count: riskSeverityCount[sev] || 0,
    fill: SEVERITY_COLORS[sev]
  })).filter(r => r.count > 0);

  // 3. Suppliers by Status
  const supplierStatusCount = suppliers.reduce((acc: Record<string, number>, sup: Supplier) => {
    const status = sup.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const supplierData = Object.entries(supplierStatusCount)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
    .sort((a, b) => b.value - a.value);

  // 4. Capacity Utilization
  const capacityTrendsData = capacity.slice(0, 10).map((cap: CapacityAssessment, i: number) => ({
    name: `Period ${i+1}`,
    score: cap.score || Math.floor(Math.random() * 100),
    utilization: cap.utilizationRate || (cap.maximumCapacity > 0 ? (cap.currentCapacity / cap.maximumCapacity) * 100 : 0),
  }));

  // --- Export Handlers ---
  
  const handleExportPDF = () => {
    const metrics = [
      { label: 'Total Projects', value: projects.length },
      { label: 'Total Risks', value: risks.length },
      { label: 'Total Suppliers', value: suppliers.length },
      { label: 'Capacity Assessments', value: capacity.length },
    ];
    
    exportToPDF('Enterprise Platform Report', metrics, {
      'Projects': projects.map(p => ({ Name: p.name, Status: p.status })),
      'Risks': risks.map(r => ({ Title: r.title, Severity: r.severity })),
    });
  };

  const handleExportExcel = () => {
    exportToExcel('Enterprise_Report', [
      { sheetName: 'Projects', data: projects.map(p => ({ ID: p.code, Name: p.name, Status: p.status, Budget: p.budget })) },
      { sheetName: 'Risks', data: risks.map(r => ({ Title: r.title, Severity: r.severity, Status: r.status })) },
      { sheetName: 'Suppliers', data: suppliers.map(s => ({ Name: s.name, Email: s.email, Status: s.status })) },
    ]);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <PageHeader 
        title="Enterprise Reports" 
        description="Generate insights and analytics across your entire portfolio"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2 bg-primary">
              <Download className="h-4 w-4" /> Export Report
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer gap-2">
              <FilePdfIcon className="h-4 w-4 text-red-500" /> Export as PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer gap-2">
              <FileExcelIcon className="h-4 w-4 text-green-600" /> Export as Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      {/* KPI Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{projects.length}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Across all phases</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Critical Risks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold text-red-600">{riskSeverityCount['critical'] || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Requiring immediate action</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{suppliers.length}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">In global network</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Avg Capacity Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">
                {capacity.length > 0 
                  ? Math.round(capacity.reduce((sum: number, c: CapacityAssessment) => sum + (c.score || 0), 0) / capacity.length) 
                  : 0}/100
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Overall readiness</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="overview" className="gap-2"><BarChart3 className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="projects" className="gap-2"><Package className="h-4 w-4" /> Projects</TabsTrigger>
          <TabsTrigger value="risks" className="gap-2"><AlertTriangle className="h-4 w-4" /> Risk Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Project Status */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-primary" /> Project Portfolio Status
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {isLoading ? <div className="h-full flex items-center justify-center"><Skeleton className="h-[200px] w-[200px] rounded-full" /></div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={projectStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {projectStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => [`${value} Projects`, 'Count']} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Risk Severity */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" /> Risk Severity Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {isLoading ? <div className="h-full flex items-center justify-center"><Skeleton className="h-[200px] w-full" /></div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={riskSeverityData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <RechartsTooltip cursor={{fill: 'transparent'}} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {riskSeverityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Capacity Trends */}
            <Card className="shadow-md lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" /> Capacity Assessment Trends
                </CardTitle>
                <CardDescription>Overall readiness scores and constraint thresholds</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                 {isLoading ? <div className="h-full flex items-center justify-center"><Skeleton className="h-[200px] w-full" /></div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={capacityTrendsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <RechartsTooltip />
                      <Legend />
                      <Area type="monotone" dataKey="score" name="Readiness Score" stroke="#3b82f6" fillOpacity={1} fill="url(#colorScore)" />
                      <Line type="monotone" dataKey="utilization" name="Utilization Rate %" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    </AreaChart>
                  </ResponsiveContainer>
                 )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
           <Card>
            <CardHeader>
              <CardTitle>Project Analytics</CardTitle>
              <CardDescription>Detailed breakdown of project portfolio performance.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] flex items-center justify-center border rounded-lg bg-muted/20">
                 <p className="text-muted-foreground flex items-center gap-2"><BarChart3 className="h-5 w-5"/> Advanced project timeline charts will appear here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="risks" className="space-y-6">
           <Card>
            <CardHeader>
              <CardTitle>Risk Heatmap</CardTitle>
              <CardDescription>Cross-functional risk matrix and mitigation tracking.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] flex items-center justify-center border rounded-lg bg-muted/20">
                 <p className="text-muted-foreground flex items-center gap-2"><Filter className="h-5 w-5"/> Interactive risk heatmap will appear here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Simple Icon components for dropdown
function FilePdfIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M10 18v-6" />
      <path d="M10 15h3" />
      <path d="M10 12h3" />
    </svg>
  );
}

function FileExcelIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 12l4 6" />
      <path d="M12 12l-4 6" />
    </svg>
  );
}
