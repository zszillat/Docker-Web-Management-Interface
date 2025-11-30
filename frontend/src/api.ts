import {
  ComposeServiceSummary,
  ContainerSummary,
  ImageSummary,
  NetworkSummary,
  StackFiles,
  StackInfo,
  VolumeSummary,
} from './types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';

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

export async function fetchContainers(): Promise<ContainerSummary[]> {
  const res = await fetch(url('/containers'));
  if (!res.ok) throw new Error('Failed to load containers');
  const data = await res.json();
  return data.containers ?? [];
}

export async function startContainer(id: string) {
  const res = await fetch(url(`/containers/${id}/start`), { method: 'POST' });
  if (!res.ok) throw new Error('Unable to start container');
}

export async function stopContainer(id: string) {
  const res = await fetch(url(`/containers/${id}/stop`), { method: 'POST' });
  if (!res.ok) throw new Error('Unable to stop container');
}

export function containerLogStream(id: string) {
  return new WebSocket(websocketUrl(`/ws/containers/${id}/logs`));
}

export async function fetchVolumes(): Promise<VolumeSummary[]> {
  const res = await fetch(url('/volumes'));
  if (!res.ok) throw new Error('Failed to load volumes');
  const data = await res.json();
  return data.volumes ?? [];
}

export async function deleteVolume(name: string) {
  const res = await fetch(url(`/volumes/${name}`), { method: 'DELETE' });
  if (!res.ok) throw new Error('Unable to delete volume');
}

export async function fetchNetworks(): Promise<NetworkSummary[]> {
  const res = await fetch(url('/networks'));
  if (!res.ok) throw new Error('Failed to load networks');
  const data = await res.json();
  return data.networks ?? [];
}

export async function deleteNetwork(id: string) {
  const res = await fetch(url(`/networks/${id}`), { method: 'DELETE' });
  if (!res.ok) throw new Error('Unable to delete network');
}

export async function fetchImages(): Promise<ImageSummary[]> {
  const res = await fetch(url('/images'));
  if (!res.ok) throw new Error('Failed to load images');
  const data = await res.json();
  return data.images ?? [];
}

export async function deleteImage(id: string) {
  const res = await fetch(url(`/images/${id}`), { method: 'DELETE' });
  if (!res.ok) throw new Error('Unable to delete image');
}

export async function fetchStacks(): Promise<StackInfo[]> {
  const res = await fetch(url('/stacks'));
  if (!res.ok) throw new Error('Failed to load stacks');
  const data = await res.json();
  return data.stacks ?? [];
}

export async function fetchStackContainers(stackName: string): Promise<ComposeServiceSummary[]> {
  const res = await fetch(url(`/stacks/${stackName}/ps`));
  if (!res.ok) throw new Error('Failed to load stack containers');
  const data = await res.json();
  return data.containers ?? [];
}

export async function bringStackUp(stackName: string) {
  const res = await fetch(url(`/stacks/${stackName}/up`), { method: 'POST' });
  if (!res.ok) throw new Error('Unable to start stack');
}

export async function bringStackDown(stackName: string) {
  const res = await fetch(url(`/stacks/${stackName}/down`), { method: 'POST' });
  if (!res.ok) throw new Error('Unable to stop stack');
}

export function stackDeployStream(stackName: string, action: 'up' | 'down' = 'up') {
  return new WebSocket(websocketUrl(`/ws/stacks/${stackName}/deploy?action=${action}`));
}

export async function createStack(payload: { name: string; compose_content: string; env_content?: string }) {
  const res = await fetch(url('/stacks'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create stack');
}

export async function fetchStackFiles(stackName: string): Promise<StackFiles> {
  const res = await fetch(url(`/stacks/${stackName}/files`));
  if (!res.ok) throw new Error('Failed to load stack files');
  const data = await res.json();
  return { compose_content: data.compose_content, env_content: data.env_content };
}

export async function updateStack(stackName: string, payload: StackFiles) {
  const res = await fetch(url(`/stacks/${stackName}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update stack');
}
