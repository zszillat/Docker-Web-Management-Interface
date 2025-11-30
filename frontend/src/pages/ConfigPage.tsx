import { FormEvent, useEffect, useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import { AppConfig } from '../types';

const defaultConfig: AppConfig = { stack_root: '', frontend_port: 18675, theme: 'light' };

function ConfigPage() {
  const { config, loading, updateConfig } = useConfig();
  const [form, setForm] = useState<AppConfig>(defaultConfig);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setForm(config);
    }
  }, [config]);

  const handleSubmit = async (evt: FormEvent) => {
    evt.preventDefault();
    setStatus('Saving…');
    try {
      const payload = {
        stack_root: form.stack_root,
        frontend_port: Number(form.frontend_port),
        theme: form.theme,
      } as AppConfig;
      const updated = await updateConfig(payload);
      setForm(updated);
      setStatus('Settings saved and applied.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save configuration');
    }
  };

  return (
    <div className="page-grid">
      <div className="page-column">
        <div className="page-header">
          <div>
            <p className="inline-hint">Security &amp; polish</p>
            <h2 className="page-title">Instance configuration</h2>
          </div>
        </div>
        <div className="card">
          {loading && !config ? (
            <div className="loading">Loading configuration…</div>
          ) : (
            <form className="form-grid" onSubmit={handleSubmit}>
              <label>
                Stack root directory
                <input
                  value={form.stack_root}
                  onChange={(e) => setForm({ ...form, stack_root: e.target.value })}
                  placeholder="/mnt/storage/yaml"
                  required
                />
              </label>
              <label>
                Frontend port
                <input
                  type="number"
                  value={form.frontend_port}
                  min={1}
                  onChange={(e) => setForm({ ...form, frontend_port: Number(e.target.value) })}
                />
              </label>
              <label>
                Theme
                <select value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value as AppConfig['theme'] })}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              {status && <div className="inline-hint status-hint">{status}</div>}
              <button className="button primary" type="submit" disabled={loading}>
                Save changes
              </button>
            </form>
          )}
        </div>
      </div>
      <div className="page-column">
        <div className="card">
          <h3>Safety notes</h3>
          <ul>
            <li>All endpoints now require authentication.</li>
            <li>Dangerous actions like deletes and compose down are rate limited.</li>
            <li>Theme changes take effect instantly across the UI.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ConfigPage;
