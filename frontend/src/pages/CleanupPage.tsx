import { useEffect, useMemo, useState } from 'react';
import { fetchSystemUsage, runCleanup } from '../api';
import { CleanupResponse, CleanupSelection, SystemDfSummary } from '../types';

const defaultSelection: CleanupSelection = {
  containers: false,
  volumes: true,
  networks: true,
  images: true,
};

function formatBytes(value?: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(value) / Math.log(1024));
  const size = value / 1024 ** i;
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[i]}`;
}

function CleanupPage() {
  const [usage, setUsage] = useState<SystemDfSummary | null>(null);
  const [selection, setSelection] = useState<CleanupSelection>(defaultSelection);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CleanupResponse | null>(null);
  const [running, setRunning] = useState(false);

  const loadUsage = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSystemUsage();
      setUsage(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsage();
  }, []);

  const handleSelectionChange = (key: keyof CleanupSelection) => {
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const cleanupTargets = useMemo(() =>
    Object.entries(selection)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key),
  [selection]);

  const handleCleanup = async () => {
    if (cleanupTargets.length === 0) {
      alert('Select at least one target to prune.');
      return;
    }
    const confirmed = window.confirm(
      `This will prune ${cleanupTargets.join(', ')}. Are you sure you want to continue?`,
    );
    if (!confirmed) return;

    try {
      setRunning(true);
      setError(null);
      const response = await runCleanup(selection);
      setResult(response);
      setUsage(response.after);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const renderSummary = (summary: SystemDfSummary | null, title: string) => (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <div className="inline-hint">Pulled from docker system df</div>
        </div>
        {summary ? <span className="badge">Total: {formatBytes(summary.total_size)}</span> : null}
      </div>
      {summary ? (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Images</div>
            <div className="stat-value">{summary.images.count} items</div>
            <div className="inline-hint">{formatBytes(summary.images.size)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Containers</div>
            <div className="stat-value">{summary.containers.count} items</div>
            <div className="inline-hint">{formatBytes(summary.containers.size)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Volumes</div>
            <div className="stat-value">{summary.volumes.count} items</div>
            <div className="inline-hint">{formatBytes(summary.volumes.size)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Build cache</div>
            <div className="stat-value">{summary.build_cache.count} entries</div>
            <div className="inline-hint">{formatBytes(summary.build_cache.size)}</div>
          </div>
        </div>
      ) : (
        <div className="loading">No usage data available</div>
      )}
    </div>
  );

  return (
    <div className="page-grid">
      <div className="page-column">
        <div className="page-header">
          <h2 className="page-title">System cleanup</h2>
          <button className="button" onClick={loadUsage} disabled={running}>
            Refresh stats
          </button>
        </div>
        {error ? <div className="badge danger">{error}</div> : null}
        {loading ? <div className="loading">Loading docker system df...</div> : renderSummary(usage, 'Current usage')}
        {result ? (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <div>
                <h3 style={{ margin: 0 }}>Last run</h3>
                <div className="inline-hint">Space reclaimed</div>
              </div>
              <span className="badge success">{formatBytes(result.reclaimed_bytes)}</span>
            </div>
            <div className="stat-grid compact">
              <div className="stat-card">
                <div className="stat-label">Before</div>
                <div className="stat-value">{formatBytes(result.before.total_size)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">After</div>
                <div className="stat-value">{formatBytes(result.after.total_size)}</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Cleanup options</h3>
        <p className="inline-hint">Select which unused resources to prune. Containers are disabled by default.</p>
        <div className="checkbox-list">
          {(['containers', 'volumes', 'networks', 'images'] as (keyof CleanupSelection)[]).map((key) => (
            <label key={key} className="checkbox-row">
              <div>
                <span style={{ textTransform: 'capitalize' }}>{key}</span>
                <div className="inline-hint">
                  {key === 'containers'
                    ? 'Removes stopped containers'
                    : key === 'volumes'
                      ? 'Prunes unused volumes'
                      : key === 'networks'
                        ? 'Cleans unused networks'
                        : 'Removes unused images'}
                </div>
              </div>
              <input
                type="checkbox"
                checked={selection[key]}
                onChange={() => handleSelectionChange(key)}
                disabled={running}
              />
            </label>
          ))}
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="button" onClick={() => setSelection(defaultSelection)} disabled={running}>
            Reset
          </button>
          <button className="button primary" onClick={handleCleanup} disabled={running}>
            {running ? 'Pruning...' : 'Run cleanup'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CleanupPage;
