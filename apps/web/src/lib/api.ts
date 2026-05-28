const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface User {
  id: string;
  email: string;
  credits: number;
  role: 'user' | 'admin';
  createdAt?: string;
}

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
  status: 'pending' | 'processing' | 'done' | 'failed';
  resultUrl: string | null;
  referenceImageUrl: string | null;
  quality: string;
  size: string;
  provider: string;
  creditCost: number;
  tokensUsed: TokensUsed | null;
  errorMessage: string | null;
  createdAt: string;
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
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  login(email: string, password: string) {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  getCredits() {
    return this.request<{ credits: number }>('/credits');
  }

  createGeneration(data: {
    prompt: string;
    model: string;
    quality?: string;
    size?: string;
    provider?: string;
    referenceImageUrl?: string;
  }) {
    return this.request<Generation>('/generations/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getGeneration(id: string) {
    return this.request<Generation>(`/generations/${id}`);
  }

  getUserGenerations(
    userId: string,
    params?: { type?: string; limit?: number; offset?: number },
  ) {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
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
    hasReference?: boolean;
    type?: string;
  }) {
    const query = new URLSearchParams({
      provider: params.provider,
      model: params.model,
      size: params.size,
      quality: params.quality,
      hasReference: String(params.hasReference ?? false),
    });
    if (params.type) query.set('type', params.type);
    return this.request<{ credits: number; usd: number }>(
      `/generations/cost?${query.toString()}`,
    );
  }

  getAdminStats() {
    return this.request<AdminStats>('/admin/stats');
  }

  getAdminUsers(params?: { search?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
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
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.userId) query.set('userId', params.userId);
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.request<{ items: AdminGeneration[]; total: number }>(
      `/admin/generations${qs ? `?${qs}` : ''}`,
    );
  }

  addAdminCredits(userId: string, amount: number, reason?: string) {
    return this.request<{ credits: number }>(`/admin/users/${userId}/credits`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    });
  }
}

export const api = new ApiClient();

export interface SizeOption   { id: string; label: string }
export interface QualityOption { id: string; label: string }
export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  sizes: SizeOption[];
  qualities: QualityOption[];
}

const DEFAULT_SIZES: SizeOption[] = [
  { id: '1:1',  label: '1:1 ריבוע' },
  { id: '16:9', label: '16:9 לרוחב' },
  { id: '9:16', label: '9:16 לאורך' },
  { id: '4:3',  label: '4:3 סטנדרטי' },
];

const DEFAULT_QUALITIES: QualityOption[] = [
  { id: 'fast',     label: 'מהיר' },
  { id: 'standard', label: 'רגיל' },
  { id: 'hd',       label: 'HD'   },
];

export const MODELS: ModelOption[] = [
  // {
  //   id: 'flux-schnell',
  //   name: 'Flux Schnell',
  //   provider: 'mock',
  //   sizes: DEFAULT_SIZES,
  //   qualities: DEFAULT_QUALITIES,
  // },
  // {
  //   id: 'flux-dev',
  //   name: 'Flux Dev',
  //   provider: 'replicate',
  //   sizes: DEFAULT_SIZES,
  //   qualities: DEFAULT_QUALITIES,
  // },
  // {
  //   id: 'sd3',
  //   name: 'Stable Diffusion 3',
  //   provider: 'stability',
  //   sizes: DEFAULT_SIZES,
  //   qualities: DEFAULT_QUALITIES,
  // },
  {
    id: 'gpt-image-1',
    name: 'OpenAI Image 1',
    provider: 'openai',
    sizes: [
      { id: '1:1',  label: '1024×1024 (ריבוע)' },
      { id: '16:9', label: '1536×1024 (לרוחב)' },
      { id: '9:16', label: '1024×1536 (לאורך)' },
    ],
    qualities: [
      { id: 'fast',     label: 'Low – מהיר'         },
      { id: 'standard', label: 'Medium – רגיל'       },
      { id: 'hd',       label: 'High – איכות גבוהה' },
    ],
  },
  {
    id: 'gpt-image-2',
    name: 'OpenAI Image 2',
    provider: 'openai',
    sizes: [
      { id: '1:1',  label: '1024×1024 (ריבוע)' },
      { id: '16:9', label: '1536×1024 (לרוחב)' },
      { id: '9:16', label: '1024×1536 (לאורך)' },
    ],
    qualities: [
      { id: 'fast',     label: 'Low – מהיר'         },
      { id: 'standard', label: 'Medium – רגיל'       },
      { id: 'hd',       label: 'High – איכות גבוהה' },
    ],
  },
  // {
  //   id: 'fal-flux',
  //   name: 'Fal Flux',
  //   provider: 'fal',
  //   sizes: DEFAULT_SIZES,
  //   qualities: DEFAULT_QUALITIES,
  // },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Nano Banana Pro',
    provider: 'google',
    sizes: DEFAULT_SIZES,
    qualities: DEFAULT_QUALITIES,
  },
  {
    id: 'gemini-3.1-flash-image',
    name: 'Nano Banana 2',
    provider: 'google',
    sizes: DEFAULT_SIZES,
    qualities: DEFAULT_QUALITIES,
  },
  {
    id: 'gemini-2.5-flash-image',
    name: 'Nano Banana',
    provider: 'google',
    sizes: DEFAULT_SIZES,
    qualities: DEFAULT_QUALITIES,
  },
];

/** @deprecated Use api.getGenerationCostPreview() for accurate backend pricing. */
export function estimateCost(
  quality: string,
  hasReference: boolean,
): number {
  const base = quality === 'hd' ? 10 : 5;
  return hasReference ? base + 5 : base;
}
