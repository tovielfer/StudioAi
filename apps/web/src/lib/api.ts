const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface User {
  id: string;
  email: string;
  nickname?: string | null;
  credits: number;
  role: 'user' | 'admin';
  isBlocked?: boolean;
  emailVerified?: boolean;
  createdAt?: string;
  generationsCount?: number;
}

export type AdminUsersSort =
  | 'newest'
  | 'oldest'
  | 'generations'
  | 'credits'
  | 'email';

export interface AuthResponse {
  token: string;
  user: User;
}

export interface TokensUsed {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_tokens_details?: {
    text_tokens?: number;
    image_tokens?: number;
  };
  output_tokens_details?: {
    text_tokens?: number;
    image_tokens?: number;
  };
}

export interface Generation {
  id: string;
  userId: string;
  type: string;
  prompt: string;
  model: string;
  status: 'pending' | 'processing' | 'done' | 'failed' | 'cancelled';
  resultUrl: string | null;
  referenceImageUrls: string[] | null;
  quality: string | null;
  size: string;
  resolution: string | null;
  provider: string;
  durationSeconds: number | null;
  generateAudio: boolean | null;
  creditCost: number;
  pricingRuleId: string | null;
  actualCostUsd: number | null;
  tokensUsed: TokensUsed | null;
  errorMessage: string | null;
  providerErrorRaw: string | null;
  createdAt: string;
  deletedAt?: string | null;
}

export interface AdminStats {
  usersTotal: number;
  generationsTotal: number;
  creditsIssued: number;
  creditsSpent: number;
  generationsByStatus: Record<string, number>;
}

export interface AdminGeneration extends Generation {
  userEmail: string | null;
}

export type CreditTransactionDirection = 'credit' | 'debit';

export interface AdminCreditTransaction {
  id: string;
  userId: string;
  userEmail: string | null;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface AdminCreditTransactionSummary {
  issued: number;
  spent: number;
  net: number;
}

export interface AdminCostStat {
  type: string;
  provider: string;
  model: string;
  size: string;
  quality: string;
  resolution: string;
  hasReference: boolean;
  count: number;
  totalCredits: number;
  avgCredits: number;
  totalCostUsd: number;
  avgCostUsd: number;
  costedCount: number;
  missingCostCount: number;
  minCostUsd: number | null;
  maxCostUsd: number | null;
  refCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalInputImageTokens: number;
  totalOutputImageTokens: number;
}

export interface PricingRuleMetrics {
  generationCount: number;
  doneCount: number;
  failedCount: number;
  totalCredits: number;
  avgCredits: number;
  totalActualCostUsd: number;
  avgActualCostUsd: number;
  estimatedGrossUsd: number;
  estimatedMarginUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalInputImageTokens: number;
  totalOutputImageTokens: number;
}

export interface AdminPricingRule {
  id: string;
  type: string;
  provider: string | null;
  model: string | null;
  size: string | null;
  quality: string | null;
  resolution: string | null;
  baseUsd: number;
  referenceImageUsd: number;
  margin: number;
  creditCostOverride: number | null;
  isModelDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  calculatedUsd: number;
  calculatedCredits: number;
  calculatedIls: number;
  referenceCalculatedUsd: number;
  referenceCalculatedCredits: number;
  referenceCalculatedIls: number;
  underpriced: boolean;
  metrics: PricingRuleMetrics;
}

export interface CreditPackage {
  id: string;
  name: string;
  priceIls: number;
  credits: number;
  badge: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export type OrderStatus = 'pending' | 'approved' | 'rejected';

export interface Order {
  id: string;
  userId: string;
  userEmail?: string | null;
  packageId: string | null;
  packageName: string;
  priceIls: number;
  credits: number;
  status: OrderStatus;
  note: string | null;
  decidedByUserId?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface PricingRuleAuditLog {
  id: string;
  ruleId: string;
  adminUserId: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export type FeedbackType =
  | 'request'
  | 'note'
  | 'improvement'
  | 'shortcut'
  | 'other'
  | 'email';

export type FeedbackStatus = 'open' | 'in_progress' | 'answered' | 'closed';

export interface FeedbackSubmission {
  id: string;
  userId: string | null;
  userEmail?: string | null;
  contactEmail?: string | null;
  type: FeedbackType;
  title: string;
  message: string;
  status: FeedbackStatus;
  adminReply: string | null;
  answeredAt: string | null;
  userReplyRead?: boolean;
  adminRead?: boolean;
  createdAt: string;
  lastMessageAt?: string | null;
}

export type FeedbackMessageDirection = 'inbound' | 'outbound';

export interface FeedbackMessage {
  id: string;
  feedbackId: string;
  direction: FeedbackMessageDirection;
  authorType: 'user' | 'admin' | 'system';
  body: string;
  createdAt: string;
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}${path}`, { ...options, headers });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Request failed: ${res.status}`);
    }

    return res.json();
  }

  register(email: string, password: string) {
    return this.request<{ message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  verifyEmail(token: string) {
    return this.request<AuthResponse>(`/auth/verify-email?token=${token}`);
  }

  login(email: string, password: string) {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  forgotPassword(email: string) {
    return this.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  resetPassword(token: string, newPassword: string) {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  getCredits() {
    return this.request<{ credits: number }>('/credits');
  }

  createGeneration(data: {
    prompt: string;
    model: string;
    type?: string;
    quality?: string;
    size?: string;
    resolution?: string;
    provider?: string;
    referenceImageUrls?: string[];
    durationSeconds?: number;
    generateAudio?: boolean;
  }) {
    return this.request<Generation>('/generations/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Starts a brand-new generation that reuses every parameter of an existing one
  // (prompt, model, type, size, quality, resolution, provider, references, and
  // the video-only controls). Used by the immediate "create again" action on
  // failed/cancelled items.
  recreateGeneration(gen: Generation) {
    return this.createGeneration({
      prompt: gen.prompt,
      model: gen.model,
      type: gen.type,
      quality: gen.quality ?? undefined,
      size: gen.size,
      resolution: gen.resolution ?? undefined,
      provider: gen.provider,
      referenceImageUrls: gen.referenceImageUrls ?? undefined,
      durationSeconds: gen.durationSeconds ?? undefined,
      generateAudio: gen.generateAudio ?? undefined,
    });
  }

  getGeneration(id: string) {
    return this.request<Generation>(`/generations/${id}`);
  }

  sendGenerationByEmail(id: string) {
    return this.request<{ success: boolean }>(
      `/generations/${id}/send-email`,
      { method: 'POST' },
    );
  }

  deleteGeneration(id: string) {
    return this.request<{ success: boolean }>(`/generations/${id}`, {
      method: 'DELETE',
    });
  }

  getUserGenerations(
    userId: string,
    params?: {
      type?: string;
      excludeStatus?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.excludeStatus) query.set('excludeStatus', params.excludeStatus);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.request<{ items: Generation[]; total: number }>(
      `/generations/user/${userId}${qs ? `?${qs}` : ''}`,
    );
  }

  uploadReference(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.request<{ url: string }>('/generations/upload-reference', {
      method: 'POST',
      body: form,
    });
  }

  getGenerationCostPreview(params: {
    provider: string;
    model: string;
    size: string;
    quality: string;
    resolution?: string;
    hasReference?: boolean;
    type?: string;
    durationSeconds?: number;
    generateAudio?: boolean;
  }) {
    const query = new URLSearchParams({
      provider: params.provider,
      model: params.model,
      size: params.size,
      quality: params.quality,
      hasReference: String(params.hasReference ?? false),
    });
    if (params.resolution) query.set('resolution', params.resolution);
    if (params.type) query.set('type', params.type);
    if (params.durationSeconds != null) {
      query.set('durationSeconds', String(params.durationSeconds));
    }
    if (params.generateAudio != null) {
      query.set('generateAudio', String(params.generateAudio));
    }
    return this.request<{ credits: number; usd: number; priceIls: number }>(
      `/generations/cost?${query.toString()}`,
    );
  }

  // --- Packages & orders (public/user) ---

  getPackages() {
    return this.request<CreditPackage[]>('/packages');
  }

  createOrder(packageId: string, note?: string) {
    return this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify({ packageId, note }),
    });
  }

  getMyOrders() {
    return this.request<Order[]>('/orders');
  }

  payOrder(orderId: string, singleUseToken: string) {
    return this.request<{ order: Order; credits: number }>(
      `/orders/${orderId}/pay`,
      {
        method: 'POST',
        body: JSON.stringify({ singleUseToken }),
      },
    );
  }

  getModels(type?: 'image' | 'video') {
    const qs = type ? `?type=${type}` : '';
    return this.request<ModelOption[]>(`/generations/models${qs}`);
  }

  getAdminStats() {
    return this.request<AdminStats>('/admin/stats');
  }

  getAdminUsers(params?: {
    search?: string;
    sort?: AdminUsersSort;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.request<{ items: User[]; total: number }>(
      `/admin/users${qs ? `?${qs}` : ''}`,
    );
  }

  getAdminGenerations(params?: {
    status?: string;
    userId?: string;
    search?: string;
    type?: string;
    provider?: string;
    model?: string;
    quality?: string;
    size?: string;
    resolution?: string;
    hasReference?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.userId) query.set('userId', params.userId);
    if (params?.search) query.set('search', params.search);
    if (params?.type) query.set('type', params.type);
    if (params?.provider) query.set('provider', params.provider);
    if (params?.model) query.set('model', params.model);
    if (params?.quality) query.set('quality', params.quality);
    if (params?.size) query.set('size', params.size);
    if (params?.resolution) query.set('resolution', params.resolution);
    if (typeof params?.hasReference === 'boolean') {
      query.set('hasReference', String(params.hasReference));
    }
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.request<{ items: AdminGeneration[]; total: number }>(
      `/admin/generations${qs ? `?${qs}` : ''}`,
    );
  }

  sendAdminGenerationByEmail(id: string) {
    return this.request<{ success: boolean }>(
      `/admin/generations/${id}/send-email`,
      { method: 'POST' },
    );
  }

  cancelAdminGeneration(id: string) {
    return this.request<AdminGeneration>(`/admin/generations/${id}/cancel`, {
      method: 'POST',
    });
  }

  addAdminCredits(userId: string, amount: number, reason?: string) {
    return this.request<{ credits: number }>(`/admin/users/${userId}/credits`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    });
  }

  sendAdminUserEmail(userId: string, subject: string, message: string) {
    return this.request<{ success: boolean }>(
      `/admin/users/${userId}/send-email`,
      {
        method: 'POST',
        body: JSON.stringify({ subject, message }),
      },
    );
  }

  updateAdminUser(
    userId: string,
    data: { nickname?: string | null; isBlocked?: boolean },
  ) {
    return this.request<User>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  getAdminCreditTransactions(params?: {
    search?: string;
    userId?: string;
    direction?: CreditTransactionDirection;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.userId) query.set('userId', params.userId);
    if (params?.direction) query.set('direction', params.direction);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.request<{
      items: AdminCreditTransaction[];
      total: number;
      summary: AdminCreditTransactionSummary;
    }>(`/admin/credit-transactions${qs ? `?${qs}` : ''}`);
  }

  getAdminCostStats() {
    return this.request<AdminCostStat[]>('/admin/cost-stats');
  }

  getAdminPricingRules() {
    return this.request<AdminPricingRule[]>('/admin/pricing-rules');
  }

  updateAdminPricingRule(
    id: string,
    data: {
      baseUsd?: number;
      referenceImageUsd?: number;
      margin?: number;
      creditCostOverride?: number | null;
      isActive?: boolean;
    },
  ) {
    return this.request<AdminPricingRule>(`/admin/pricing-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  getAdminPricingRuleGenerations(
    id: string,
    params?: { limit?: number; offset?: number },
  ) {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.request<{ items: AdminGeneration[]; total: number }>(
      `/admin/pricing-rules/${id}/generations${qs ? `?${qs}` : ''}`,
    );
  }

  getAdminPricingRuleAuditLog(id: string) {
    return this.request<PricingRuleAuditLog[]>(
      `/admin/pricing-rules/${id}/audit-log`,
    );
  }

  // --- Admin packages & orders ---

  getAdminBillingConfig() {
    return this.request<{
      usdIls: number;
      targetMargin: number;
      creditValueIls: number;
    }>('/admin/billing-config');
  }

  getAdminPackages() {
    return this.request<CreditPackage[]>('/admin/packages');
  }

  createAdminPackage(data: {
    name: string;
    priceIls: number;
    credits: number;
    badge?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    return this.request<CreditPackage>('/admin/packages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateAdminPackage(
    id: string,
    data: {
      name?: string;
      priceIls?: number;
      credits?: number;
      badge?: string | null;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.request<CreditPackage>(`/admin/packages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  getAdminOrders(status?: OrderStatus) {
    const qs = status ? `?status=${status}` : '';
    return this.request<Order[]>(`/admin/orders${qs}`);
  }

  getAdminOrdersPendingCount() {
    return this.request<{ pending: number }>('/admin/orders/pending-count');
  }

  approveAdminOrder(id: string) {
    return this.request<Order>(`/admin/orders/${id}/approve`, {
      method: 'POST',
    });
  }

  rejectAdminOrder(id: string) {
    return this.request<Order>(`/admin/orders/${id}/reject`, {
      method: 'POST',
    });
  }

  createFeedback(data: {
    type: FeedbackType;
    title?: string;
    message: string;
  }) {
    return this.request<FeedbackSubmission>('/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  createPublicFeedback(data: {
    type: FeedbackType;
    title?: string;
    message: string;
    contactEmail: string;
  }) {
    return this.request<FeedbackSubmission>('/feedback/public', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getMyFeedback(params?: { limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.request<{ items: FeedbackSubmission[]; total: number }>(
      `/feedback${qs ? `?${qs}` : ''}`,
    );
  }

  getMyFeedbackMessages(id: string) {
    return this.request<{ items: FeedbackMessage[] }>(
      `/feedback/${id}/messages`,
    );
  }

  replyMyFeedback(id: string, message: string) {
    return this.request<FeedbackSubmission>(`/feedback/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  getMyFeedbackUnreadCount() {
    return this.request<{ unread: number }>('/feedback/unread-count');
  }

  markMyFeedbackRead() {
    return this.request<{ unread: number }>('/feedback/mark-read', {
      method: 'POST',
    });
  }

  getAdminFeedbackUnreadCount() {
    return this.request<{ unread: number }>('/feedback/admin/unread-count');
  }

  markAdminFeedbackRead() {
    return this.request<{ unread: number }>('/feedback/admin/mark-read', {
      method: 'POST',
    });
  }

  getAdminFeedback(params?: { limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.request<{ items: FeedbackSubmission[]; total: number }>(
      `/feedback/admin${qs ? `?${qs}` : ''}`,
    );
  }

  updateAdminFeedback(
    id: string,
    data: { status?: FeedbackStatus; adminReply?: string },
  ) {
    return this.request<FeedbackSubmission>(`/feedback/admin/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  getAdminFeedbackMessages(id: string) {
    return this.request<{ items: FeedbackMessage[] }>(
      `/feedback/admin/${id}/messages`,
    );
  }

  replyAdminFeedback(id: string, message: string) {
    return this.request<FeedbackSubmission>(`/feedback/admin/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }
}

export const api = new ApiClient();

export interface SizeOption   { id: string; label: string }
export interface QualityOption { id: string; label: string }
export interface ResolutionOption { id: string; label: string }
export interface DurationOption { id: string; label: string }
export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  type?: 'image' | 'video';
  sizes: SizeOption[];
  qualities: QualityOption[];
  // Resolution tiers (1K/2K/4K). Empty when the model has a single fixed
  // resolution; the UI only renders the selector when there is a choice.
  resolutions: ResolutionOption[];
  // Video only: selectable clip durations (seconds). Empty/undefined for a
  // single fixed duration.
  durations?: DurationOption[];
  // Video only: whether the model can generate native audio.
  supportsAudio?: boolean;
}

/** @deprecated Use api.getGenerationCostPreview() for accurate backend pricing. */
export function estimateCost(
  quality: string,
  hasReference: boolean,
): number {
  const base = quality === 'high' ? 10 : 5;
  return hasReference ? base + 5 : base;
}
