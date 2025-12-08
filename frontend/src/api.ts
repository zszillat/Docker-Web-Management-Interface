import {
  ComposeServiceSummary,
  ContainerSummary,
  ImageSummary,
  NetworkSummary,
  StackFiles,
  StackInfo,
  CleanupResponse,
  CleanupSelection,
  SystemDfSummary,
  VolumeSummary,
  AppConfig,
} from './types';

const envApiBase = import.meta.env.VITE_API_URL as string | undefined;
const devFallback =
  typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:8003'
    : undefined;
const inferredOrigin =
  typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : undefined;
const API_BASE = envApiBase ?? devFallback ?? inferredOrigin ?? 'http://localhost:8003';

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

function url(path: string) {
  return `${API_BASE}${path}`;
}

function websocketUrl(path: string) {
  if (API_BASE.startsWith('https')) {
    return API_BASE.replace('https', 'wss') + path;
  }
  if (API_BASE.startsWith('http')) {
    return API_BASE.replace('http', 'ws') + path;
  }
  return `ws://${API_BASE.replace(/^ws:\/\//, '')}${path}`;
}

function withAuthHeaders(options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  return headers;
}

function withAuthQuery(path: string) {
  if (!authToken) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}token=${encodeURIComponent(authToken)}`;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

async function request(path: string, options: RequestInit = {}) {
  const headers = withAuthHeaders(options);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(url(path), { ...options, headers });
  if (response.status === 401 && unauthorizedHandler) {
    unauthorizedHandler();
  }
  return response;
}

export async function fetchAuthStatus() {
  const res = await request('/auth/status');
  if (!res.ok) throw new Error('Unable to check authentication status');
  return res.json();
}

export async function registerAdmin(payload: { username: string; password: string }) {
  const res = await request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error((await res.json()).detail ?? 'Failed to register admin');
  return res.json();
}

export async function login(payload: { username: string; password: string }) {
  const res = await request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Invalid credentials');
  return res.json();
}

export async function fetchCurrentUser() {
  const res = await request('/auth/me');
  if (!res.ok) throw new Error('Session expired');
  return res.json();
}

export async function fetchContainers(): Promise<ContainerSummary[]> {
  const res = await request('/containers');
  if (!res.ok) throw new Error('Failed to load containers');
  const data = await res.json();
  return data.containers ?? [];
}

export async function startContainer(id: string) {
  const res = await request(`/containers/${id}/start`, { method: 'POST' });
  if (!res.ok) throw new Error('Unable to start container');
}

export async function stopContainer(id: string) {
  const res = await request(`/containers/${id}/stop`, { method: 'POST' });
  if (!res.ok) throw new Error('Unable to stop container');
}

export function containerLogStream(id: string) {
  return new WebSocket(websocketUrl(withAuthQuery(`/ws/containers/${id}/logs`)));
}

export function containerShellStream(id: string) {
  return new WebSocket(websocketUrl(withAuthQuery(`/ws/containers/${id}/shell`)));
}

export async function fetchVolumes(): Promise<VolumeSummary[]> {
  const res = await request('/volumes');
  if (!res.ok) throw new Error('Failed to load volumes');
  const data = await res.json();
  return data.volumes ?? [];
}

export async function deleteVolume(name: string) {
  const res = await request(`/volumes/${name}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Unable to delete volume');
}

export async function fetchNetworks(): Promise<NetworkSummary[]> {
  const res = await request('/networks');
  if (!res.ok) throw new Error('Failed to load networks');
  const data = await res.json();
  return data.networks ?? [];
}

export async function deleteNetwork(id: string) {
  const res = await request(`/networks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Unable to delete network');
}

export async function fetchImages(): Promise<ImageSummary[]> {
  const res = await request('/images');
  if (!res.ok) throw new Error('Failed to load images');
  const data = await res.json();
  return data.images ?? [];
}

export async function deleteImage(id: string) {
  const res = await request(`/images/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Unable to delete image');
}

export async function fetchStacks(): Promise<StackInfo[]> {
  const res = await request('/stacks');
  if (!res.ok) throw new Error('Failed to load stacks');
  const data = await res.json();
  return data.stacks ?? [];
}

export async function fetchStackContainers(stackName: string): Promise<ComposeServiceSummary[]> {
  const res = await request(`/stacks/${stackName}/ps`);
  if (!res.ok) throw new Error('Failed to load stack containers');
  const data = await res.json();
  return data.containers ?? [];
}

export async function bringStackUp(stackName: string) {
  const res = await request(`/stacks/${stackName}/up`, { method: 'POST' });
  if (!res.ok) throw new Error('Unable to start stack');
}

export async function bringStackDown(stackName: string) {
  const res = await request(`/stacks/${stackName}/down`, { method: 'POST' });
  if (!res.ok) throw new Error('Unable to stop stack');
}

export function stackDeployStream(stackName: string, action: 'up' | 'down' = 'up') {
  return new WebSocket(websocketUrl(withAuthQuery(`/ws/stacks/${stackName}/deploy?action=${action}`)));
}

export async function createStack(payload: { name: string; compose_content: string; env_content?: string }) {
  const res = await request('/stacks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create stack');
}

export async function fetchStackFiles(stackName: string): Promise<StackFiles> {
  const res = await request(`/stacks/${stackName}/files`);
  if (!res.ok) throw new Error('Failed to load stack files');
  const data = await res.json();
  return { compose_content: data.compose_content, env_content: data.env_content };
}

export async function updateStack(stackName: string, payload: StackFiles) {
  const res = await request(`/stacks/${stackName}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update stack');
}

export async function fetchSystemUsage(): Promise<SystemDfSummary> {
  const res = await request('/system/df');
  if (!res.ok) throw new Error('Failed to load system usage');
  const data = await res.json();
  return data.summary;
}

export async function runCleanup(payload: CleanupSelection): Promise<CleanupResponse> {
  const res = await request('/cleanup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Cleanup failed');
  return res.json();
}

export async function fetchConfigSettings(): Promise<AppConfig> {
  const res = await request('/config');
  if (!res.ok) throw new Error('Failed to load configuration');
  return res.json();
}

export async function updateConfigSettings(payload: Partial<AppConfig>): Promise<AppConfig> {
  const res = await request('/config', { method: 'PUT', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Failed to update configuration');
  return res.json();
}
