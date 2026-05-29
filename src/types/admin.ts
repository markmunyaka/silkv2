// ===================================================================
// Admin Dashboard – Shared TypeScript Types
// ===================================================================

// ---------- Users ----------
export type UserRole = 'standard' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'frozen';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  credits: number;
  isSubscribed: boolean;
  subscriptionPlan: string | null;
  fileCount: number;
  violationReason: string | null;
  frozenAt: string | null;
  bannedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserPayload {
  role?: UserRole;
  status?: AccountStatus;
  credits?: number;
  violationReason?: string | null;
}

// ---------- System Metrics ----------
export interface SystemMetrics {
  apiLatencyMs: number;
  llmTokensConsumed: number;
  activeWorkers: number;
  uptimeHours: number;
  memoryUsageMb: number;
  dbSizeMb: number;
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  details?: string;
}

// ---------- Files / Documents ----------
export type FileFormat = 'PDF' | 'Audio' | 'Video' | 'DOCX';
export type FileProcessingStatus = 'completed' | 'processing' | 'failed' | 'queued';

export interface AdminFileRecord {
  id: string;
  fileName: string;
  format: FileFormat;
  sizeBytes: number;
  ownerName: string;
  ownerEmail: string;
  processingStatus: FileProcessingStatus;
  hasVideo: boolean;
  createdAt: string;
}

// ---------- Tab Analytics ----------
export interface TrendDataPoint {
  date: string;
  value: number;
}

export interface AnalyticsOverview {
  totalUsers: number;
  usersTrend: TrendDataPoint[];
  totalFiles: number;
  filesTrend: TrendDataPoint[];
  totalVideos: number;
  videosTrend: TrendDataPoint[];
  totalEmailsSent: number;
  emailsTrend: TrendDataPoint[];
  totalLeadsScraped: number;
  apiCallsToday: number;
  storageUsedMb: number;
}

// ---------- API Response Shapes ----------
export interface AdminApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- Action Payloads ----------
export interface SystemActionResponse {
  action: string;
  status: 'completed' | 'failed';
  message: string;
  timestamp: string;
}

// ---------- System Settings ----------
export interface SystemSettings {
  siteName: string;
  siteDescription: string;
  defaultCredits: number;
  allowedFileTypes: string;
  maxFileSizeMb: number;
  maintenanceMode: boolean;
  enableRegistration: boolean;
  requireEmailVerification: boolean;
  enableVideoGeneration: boolean;
  enableMailer: boolean;
  enableLeadScraper: boolean;
  enableAnalytics: boolean;
  enableApiAccess: boolean;
  webhookUrl: string;
  webhookEnabled: boolean;
  retentionDays: number;
  maxUsersAllowed: number;
}

// ---------- Notification ----------
export interface AdminNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}