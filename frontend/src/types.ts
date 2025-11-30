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
