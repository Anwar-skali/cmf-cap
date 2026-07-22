import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(6, 'New password must be at least 6 characters')
    .max(100, 'New password is too long'),
  confirmNewPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Passwords do not match',
  path: ['confirmNewPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  description: z.string().optional(),
  status: z.string().default('draft'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  clientName: z.string().optional(),
  notes: z.string().optional(),
  priority: z.number().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const createPartSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  name: z
    .string()
    .min(1, 'Part name is required')
    .max(200, 'Part name is too long'),
  partNumber: z
    .string()
    .min(1, 'Part number is required')
    .max(100, 'Part number is too long'),
  description: z.string().max(1000, 'Description is too long').optional(),
  quantity: z
    .number()
    .positive('Quantity must be positive')
    .int('Quantity must be a whole number'),
  unit: z.string().min(1, 'Unit is required').max(50, 'Unit is too long'),
  material: z.string().max(200, 'Material is too long').optional(),
  weight: z.number().positive('Weight must be positive').optional(),
  supplierId: z.string().optional(),
  notes: z.string().max(2000, 'Notes are too long').optional(),
});

export const updatePartSchema = createPartSchema.partial();

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  contactPerson: z.string().min(1, 'Contact person is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional(),
  status: z.enum(['active', 'inactive', 'blacklisted']),
  notes: z.string().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const createCapacityAssessmentSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  supplierId: z.string().min(1, 'Supplier is required'),
  assessmentDate: z.string().min(1, 'Assessment date is required'),
  score: z
    .number()
    .min(0, 'Score must be at least 0')
    .max(100, 'Score must be at most 100')
    .optional(),
  maxScore: z
    .number()
    .positive('Max score must be positive')
    .default(100),
  findings: z.string().max(2000, 'Findings are too long').optional(),
  recommendation: z.string().max(2000, 'Recommendation is too long').optional(),
  nextAssessmentDate: z.string().optional(),
});

export const createRiskSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  title: z
    .string()
    .min(1, 'Risk title is required')
    .max(200, 'Risk title is too long'),
  description: z
    .string()
    .min(1, 'Risk description is required')
    .max(2000, 'Description is too long'),
  severity: z.enum(['critical', 'high', 'medium', 'low'], {
    errorMap: () => ({ message: 'Please select a severity level' }),
  }),
  probability: z.enum(['rare', 'unlikely', 'possible', 'likely', 'almost_certain'], {
    errorMap: () => ({ message: 'Please select a probability level' }),
  }),
  impact: z.string().max(2000, 'Impact description is too long').optional(),
  mitigationPlan: z.string().max(2000, 'Mitigation plan is too long').optional(),
  ownerId: z.string().min(1, 'Risk owner is required'),
  targetDate: z.string().optional(),
  category: z.string().max(100, 'Category is too long').optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type CreateProjectFormData = z.infer<typeof createProjectSchema>;
export type UpdateProjectFormData = z.infer<typeof updateProjectSchema>;
export type CreatePartFormData = z.infer<typeof createPartSchema>;
export type UpdatePartFormData = z.infer<typeof updatePartSchema>;
export type CreateSupplierFormData = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierFormData = z.infer<typeof updateSupplierSchema>;
export type CreateCapacityAssessmentFormData = z.infer<typeof createCapacityAssessmentSchema>;
export type CreateRiskFormData = z.infer<typeof createRiskSchema>;
