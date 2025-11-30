export interface ContainerSummary {
  id: string;
  name: string;
  status: string;
  image: string[] | string;
  labels?: Record<string, string>;
  ports?: Record<string, unknown>;
}

export interface VolumeSummary {
  name: string;
  mountpoint?: string;
  driver?: string;
  labels?: Record<string, string>;
  scope?: string;
}

export interface NetworkSummary {
  id: string;
  name: string;
  driver?: string;
  scope?: string;
  labels?: Record<string, string>;
}

export interface ImageSummary {
  id: string;
  short_id?: string;
  tags: string[];
  labels?: Record<string, string>;
  size?: number;
}

export interface StackInfo {
  name: string;
  path: string;
  compose_file: string;
}

export interface ComposeServiceSummary {
  name: string;
  service?: string;
  state?: string;
  status?: string;
  ports?: string;
}

export interface StackFiles {
  compose_content: string;
  env_content?: string;
}

export interface SystemDfSummary {
  total_size: number;
  images: { count: number; size: number };
  containers: { count: number; size: number };
  volumes: { count: number; size: number };
  build_cache: { count: number; size: number };
}

export interface CleanupSelection {
  containers: boolean;
  volumes: boolean;
  networks: boolean;
  images: boolean;
}

export interface CleanupResponse {
  before: SystemDfSummary;
  after: SystemDfSummary;
  reclaimed_bytes: number;
}

export interface AppConfig {
  stack_root: string;
  frontend_port: number;
  theme: 'light' | 'dark';
}
