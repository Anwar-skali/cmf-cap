export enum UserRole {
  ADMIN = 'admin',
  CAPACITY_MANAGER = 'capacity_manager',
  BUYER = 'buyer',
  SQD = 'sqd',
  VIEWER = 'viewer',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  organization?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  role?: 'buyer' | 'capacity_manager' | 'sqd';
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export type ProjectStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled';

export interface Project {
  id: string;
  name: string;
  code: string;
  description?: string;
  status: ProjectStatus;
  priority: number;
  startDate?: string;
  endDate?: string;
  budget?: number;
  currency: string;
  buyerId?: string;
  sqdId?: string;
  capacityManagerId?: string;
  templateId?: string;
  templateVersion?: string;
  data?: Record<string, any>;
  manager?: User;
  clientName?: string;
  notes?: string;
  partsCount: number;
  suppliersCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFilter {
  search?: string;
  status?: ProjectStatus;
  managerId?: string;
  template_id?: string;
  templateId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  page_size?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateProjectRequest {
  name: string;
  code?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  currency?: string;
  buyerId?: string;
  sqdId?: string;
  capacityManagerId?: string;
  clientName?: string;
  notes?: string;
  priority?: number;
  templateId?: string;
  templateVersion?: string;
  data?: Record<string, any>;
}

export type PartStatus = 'active' | 'inactive' | 'obsolete';

export interface ProjectPart {
  id: string;
  projectId: string;
  name: string;
  partNumber: string;
  description?: string;
  status: PartStatus;
  quantity: number;
  unit: string;
  material?: string;
  weight?: number;
  supplierId?: string;
  supplier?: Supplier;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectPartRequest {
  projectId: string;
  name: string;
  partNumber: string;
  description?: string;
  quantity: number;
  unit: string;
  material?: string;
  weight?: number;
  supplierId?: string;
  notes?: string;
}

export type SupplierStatus = 'active' | 'inactive' | 'blacklisted';

export interface Supplier {
  id: string;
  name: string;
  code: string;
  contactPerson: string;
  email: string;
  phone?: string;
  address?: string;
  website?: string;
  status: SupplierStatus;
  certifications?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierFilter {
  search?: string;
  status?: SupplierStatus;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateSupplierRequest {
  name: string;
  code: string;
  contactPerson: string;
  email: string;
  phone?: string;
  address?: string;
  website?: string;
  certifications?: string[];
  notes?: string;
}

export type CapacityStatus = 'pending' | 'assessed' | 'confirmed' | 'rejected';
export type CapacityRiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface CapacityAssessment {
  id: string;
  assessmentDate?: string;
  month: number;
  year: number;
  currentCapacity: number;
  maximumCapacity: number;
  utilizationRate?: number;
  leadTimeDays?: number;
  cate?: string;
  gate?: string;
  targetWeek?: string;
  forecastWeek?: string;
  completedWeek?: string;
  riskLevel?: CapacityRiskLevel | string;
  bottleneck?: string;
  notes?: string;
  status: CapacityStatus;
  projectPartId: string;
  supplierId: string;
  assessedBy?: string;
  partNumber?: string;
  partName?: string;
  supplierName?: string;
  supplierCode?: string;
  projectName?: string;
  title?: string;
  description?: string;
  score?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCapacityAssessmentRequest {
  month: number;
  year: number;
  currentCapacity: number;
  maximumCapacity: number;
  projectPartId: string;
  supplierId: string;
  assessmentDate?: string;
  leadTimeDays?: number;
  cate?: string;
  gate?: string;
  targetWeek?: string;
  forecastWeek?: string;
  completedWeek?: string;
  riskLevel?: string;
  bottleneck?: string;
  notes?: string;
  status?: string;
  assessedBy?: string;
}

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';
export type RiskProbability = 'rare' | 'unlikely' | 'possible' | 'likely' | 'almost_certain';
export type RiskStatus = 'open' | 'mitigating' | 'mitigated' | 'closed';

export interface Risk {
  id: string;
  title: string;
  description?: string;
  riskType?: string;
  severity: RiskSeverity;
  probability: RiskProbability;
  riskScore: number;
  impact?: string;
  mitigation?: string;
  contingency?: string;
  status: RiskStatus;
  dueDate?: string;
  resolvedAt?: string;
  projectPartId: string;
  assignedTo?: string;
  identifiedBy?: string;
  projectName?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRiskRequest {
  title: string;
  projectPartId: string;
  description?: string;
  riskType?: string;
  severity: RiskSeverity;
  probability: RiskProbability;
  impact?: string;
  mitigation?: string;
  contingency?: string;
  status?: RiskStatus;
  dueDate?: string;
  assignedTo?: string;
  identifiedBy?: string;
}

export type DocumentType = 'contract' | 'specification' | 'drawing' | 'report' | 'certificate' | 'other';

export interface Document {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType?: string;
  documentType: DocumentType;
  version: number;
  isLatest: boolean;
  projectId?: string;
  projectPartId?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentRequest {
  projectId?: string;
  partId?: string;
  supplierId?: string;
  name: string;
  type: DocumentType;
  description?: string;
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'approved'
  | 'rejected'
  | 'submitted'
  | 'reviewed'
  | 'assigned'
  | 'status_changed';

export interface ActivityLog {
  id: string;
  userId: string;
  user?: User;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  entityName?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface MonthlyCapacity {
  month: number;
  year: number;
  totalCapacity: number;
  utilized: number;
  rate: number;
}

export interface RiskDistributionSummary {
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  delayedProjects: number;
  projectsOnTrack: number;
  projectUseCases: number;
  delayedProjectUseCases: number;
  totalSuppliers: number;
  activeSuppliers: number;
  totalRisks: number;
  openRisks: number;
  criticalRisks: number;
  mitigatedRisks: number;
  openQualityIssues: number;
  criticalQualityIssues: number;
  openActions: number;
  supplierQualityStatus: string;
  totalCapacity: number;
  allocatedCapacity: number;
  usedCapacity: number;
  remainingCapacity: number;
  capacityGap: number;
  averageUtilizationPct: number;
  capacityCoveragePercentage: number;
  projectsByCustomer: Array<{ customer: string; count: number }>;
  upcomingMilestones: number;
  recentActivities: ActivityLog[];
  monthlyCapacity: MonthlyCapacity[];
  riskDistribution: RiskDistributionSummary;
  projectStatusDistribution: Record<string, number>;
  upcomingDeadlines?: Project[];
}

export interface CapacityCoverage {
  supplierId: string;
  supplierName: string;
  totalAssessments: number;
  averageScore: number;
  lastAssessmentDate?: string;
  status: CapacityStatus;
}

export interface RiskDistribution {
  severity: RiskSeverity;
  count: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
  page?: number;
  page_size?: number;
  pageSize?: number;
  total_pages?: number;
  totalPages?: number;
}

export interface BulkDeleteProjectsRequest {
  project_ids: string[];
}

export interface BulkDeleteProjectsResponse {
  deleted_count: number;
  deleted_ids: string[];
}

export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}
