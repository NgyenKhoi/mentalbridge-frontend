export type DataState = 'AVAILABLE' | 'UNAVAILABLE' | 'STALE';

export interface AuthoritativeBlock<T> {
  status: DataState;
  source: string;
  asOf: string;
  data: T | null;
  error?: string | null;
}

export interface IdentityAccountsData {
  total: number;
  active: number;
  pendingActivation: number;
  disabled: number;
  deletionPending: number;
  roles: {
    users: number;
    specialists: number;
    administrators: number;
  };
}

export interface ConsultationOperationsData {
  specialists: {
    total: number;
    pendingReview: number;
    active: number;
    rejected: number;
    suspended: number;
  };
  appointments: {
    total: number;
    requested: number;
    confirmed: number;
    inProgress: number;
    sessionEnded: number;
    completed: number;
    cancelled: number;
    rejected: number;
    expired: number;
    userNoShow: number;
    specialistNoShow: number;
    bothNoShow: number;
  };
}

export interface NotificationOperationsData {
  inApp: {
    total: number;
    delivered: number;
    pending: number;
    failed: number;
    cancelled: number;
    unread: number;
    read: number;
  };
  emailReminders: {
    total: number;
    pending: number;
    processing: number;
    delivered: number;
    failed: number;
    suppressed: number;
    invalidated: number;
  };
}

export interface CommunityOperationsData {
  openModerationCases: number;
  totalModerationCases: number;
}

export interface UnintegratedMetric {
  id: string;
  title: string;
  targetDomain: string;
  status: 'UNAVAILABLE';
  rationale: string;
  authoritativeOwnerNeeded: string;
}

export interface AdminOperationsDashboardResponse {
  asOf: string;
  identity: AuthoritativeBlock<IdentityAccountsData>;
  consultation: AuthoritativeBlock<ConsultationOperationsData>;
  notifications: AuthoritativeBlock<NotificationOperationsData>;
  community: AuthoritativeBlock<CommunityOperationsData>;
  unintegrated: UnintegratedMetric[];
}

