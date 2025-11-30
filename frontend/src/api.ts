import { ContainerSummary, ImageSummary, NetworkSummary, VolumeSummary } from './types';

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
