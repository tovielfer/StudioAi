const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface User {
  id: string;
  email: string;
  credits: number;
}

export interface AuthResponse {
  token: string;
  user: User;
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
  errorMessage: string | null;
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
}

export const api = new ApiClient();

export interface SizeOption   { id: string; label: string }
export interface QualityOption { id: string; label: string; credits: number }
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
  { id: 'fast',     label: 'מהיר', credits: 5 },
  { id: 'standard', label: 'רגיל', credits: 5 },
  { id: 'hd',       label: 'HD',   credits: 10 },
];

export const MODELS: ModelOption[] = [
  {
    id: 'flux-schnell',
    name: 'Flux Schnell',
    provider: 'mock',
    sizes: DEFAULT_SIZES,
    qualities: DEFAULT_QUALITIES,
  },
  {
    id: 'flux-dev',
    name: 'Flux Dev',
    provider: 'replicate',
    sizes: DEFAULT_SIZES,
    qualities: DEFAULT_QUALITIES,
  },
  {
    id: 'sd3',
    name: 'Stable Diffusion 3',
    provider: 'stability',
    sizes: DEFAULT_SIZES,
    qualities: DEFAULT_QUALITIES,
  },
  {
    id: 'gpt-image-1',
    name: 'OpenAI Image',
    provider: 'openai',
    sizes: [
      { id: '1:1',  label: '1024×1024 (ריבוע)' },
      { id: '16:9', label: '1536×1024 (לרוחב)' },
      { id: '9:16', label: '1024×1536 (לאורך)' },
    ],
    qualities: [
      { id: 'fast',     label: 'Low – מהיר',          credits: 5  },
      { id: 'standard', label: 'Medium – רגיל',        credits: 5  },
      { id: 'hd',       label: 'High – איכות גבוהה',  credits: 10 },
    ],
  },
  {
    id: 'fal-flux',
    name: 'Fal Flux',
    provider: 'fal',
    sizes: DEFAULT_SIZES,
    qualities: DEFAULT_QUALITIES,
  },
];

export function estimateCost(
  quality: string,
  hasReference: boolean,
): number {
  const base = quality === 'hd' ? 10 : 5;
  return hasReference ? base + 5 : base;
}
