import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createStack, fetchStackContainers, fetchStackFiles, fetchStacks, stackDeployStream, updateStack } from '../api';
import { ComposeServiceSummary, StackFiles, StackInfo } from '../types';

function ComposePage() {
  const [stacks, setStacks] = useState<StackInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containers, setContainers] = useState<Record<string, ComposeServiceSummary[]>>({});
  const [containersLoading, setContainersLoading] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [deployAction, setDeployAction] = useState<'up' | 'down'>('up');
  const [editorStack, setEditorStack] = useState<string>('');
  const [composeContent, setComposeContent] = useState(sampleCompose);
  const [envContent, setEnvContent] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  const loadStacks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchStacks();
      setStacks(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStacks();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const loadContainers = async (stackName: string) => {
    setContainersLoading((prev) => ({ ...prev, [stackName]: true }));
    try {
      const data = await fetchStackContainers(stackName);
      setContainers((prev) => ({ ...prev, [stackName]: data }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setContainersLoading((prev) => ({ ...prev, [stackName]: false }));
    }
  };

  const handleDeploy = (stackName: string, action: 'up' | 'down') => {
    setDeploying(stackName);
    setDeployAction(action);
    setDeployLogs([]);
    if (wsRef.current) {
      wsRef.current.close();
    }
    const ws = stackDeployStream(stackName, action);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      setDeployLogs((prev) => [...prev, event.data]);
    };

    ws.onclose = () => {
      setDeploying(null);
    };

    ws.onerror = () => {
      setDeployLogs((prev) => [...prev, 'Deployment stream encountered an error.']);
    };
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createStack({ name: editorStack, compose_content: composeContent, env_content: envContent });
      await loadStacks();
      setEditorStack('');
      setComposeContent(sampleCompose);
      setEnvContent('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEdit = async (stackName: string) => {
    try {
      const files = await fetchStackFiles(stackName);
      setEditorStack(stackName);
      setComposeContent(files.compose_content);
      setEnvContent(files.env_content ?? '');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdate = async () => {
    if (!editorStack) return;
    const payload: StackFiles = { compose_content: composeContent, env_content: envContent };
    try {
      await updateStack(editorStack, payload);
      await loadStacks();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const stackRows = useMemo(() => {
    if (stacks.length === 0) {
      return (
        <tr>
          <td colSpan={3} className="loading">
            No compose stacks detected. Create one using the form on the right.
          </td>
        </tr>
      );
    }

    return stacks.map((stack) => (
      <Fragment key={stack.name}>
        <tr>
          <td>
            <div style={{ fontWeight: 700 }}>{stack.name}</div>
            <div className="inline-hint">{stack.compose_file}</div>
          </td>
          <td>{stack.path}</td>
          <td>
            <div className="actions">
              <button
                className="button"
                onClick={() => {
                  setExpanded((prev) => (prev === stack.name ? null : stack.name));
                  if (!containers[stack.name]) {
                    loadContainers(stack.name);
                  }
                }}
              >
                {expanded === stack.name ? 'Hide containers' : 'View containers'}
              </button>
              <button className="button primary" onClick={() => handleDeploy(stack.name, 'up')}>
                Deploy
              </button>
              <button className="button" onClick={() => handleDeploy(stack.name, 'down')}>
                Stop
              </button>
              <button className="button" onClick={() => handleEdit(stack.name)}>
                Edit files
              </button>
            </div>
          </td>
        </tr>
        {expanded === stack.name ? (
          <tr>
            <td colSpan={3}>
              {containersLoading[stack.name] ? (
                <div className="loading">Loading containers...</div>
              ) : (
                <StackContainersTable containers={containers[stack.name] ?? []} />
              )}
            </td>
          </tr>
        ) : null}
      </Fragment>
    ));
  }, [containers, containersLoading, expanded, stacks]);

  return (
    <div className="page-grid">
      <div className="card">
        <div className="page-header">
          <h2 className="page-title">Compose stacks</h2>
          <button className="button" onClick={loadStacks}>
            Refresh
          </button>
        </div>
        {error ? <div className="badge danger">{error}</div> : null}
        {loading ? (
          <div className="loading">Loading compose stacks...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '220px' }}>Stack</th>
                <th>Path</th>
                <th style={{ width: '320px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>{stackRows}</tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="page-header">
          <h2 className="page-title">Create or edit stack</h2>
          <span className="inline-hint">Save compose and .env files directly from the UI.</span>
        </div>
        <form className="form-grid" onSubmit={handleCreate}>
          <label>
            Stack name
            <input
              required
              type="text"
              placeholder="e.g. media-server"
              value={editorStack}
              onChange={(e) => setEditorStack(e.target.value)}
            />
          </label>
          <label>
            docker-compose.yaml
            <textarea
              required
              rows={12}
              value={composeContent}
              onChange={(e) => setComposeContent(e.target.value)}
            />
          </label>
          <label>
            .env content
            <textarea rows={6} value={envContent} onChange={(e) => setEnvContent(e.target.value)} />
          </label>
          <div className="actions">
            <button className="button primary" type="submit">
              Save as new stack
            </button>
            <button className="button" type="button" onClick={handleUpdate} disabled={!editorStack}>
              Update existing
            </button>
          </div>
        </form>
      </div>

      {deployLogs.length > 0 || deploying ? (
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="log-header">
            <div>
              Deployment output — {deploying ?? 'completed'} ({deployAction})
            </div>
            {deploying ? (
              <span className="badge warning">Live</span>
            ) : (
              <span className="badge success">Finished</span>
            )}
          </div>
          <div className="log-viewer" style={{ maxHeight: 280 }}>
            {deployLogs.length === 0 ? 'Waiting for output...' : deployLogs.join('\n')}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StackContainersTable({ containers }: { containers: ComposeServiceSummary[] }) {
  if (containers.length === 0) {
    return <div className="loading">No containers found for this stack.</div>;
  }

  return (
    <table className="table nested">
      <thead>
        <tr>
          <th>Name</th>
          <th>Status</th>
          <th>Ports</th>
        </tr>
      </thead>
      <tbody>
        {containers.map((container) => (
          <tr key={container.name}>
            <td>
              <div style={{ fontWeight: 700 }}>{container.name}</div>
              <div className="inline-hint">{container.service}</div>
            </td>
            <td>{container.status ?? container.state ?? 'Unknown'}</td>
            <td>{container.ports ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const sampleCompose = `version: '3.8'
services:
  app:
    image: nginx:alpine
    ports:
      - "8080:80"
`;

export default ComposePage;
