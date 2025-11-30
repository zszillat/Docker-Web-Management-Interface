import { useEffect, useMemo, useState } from 'react';
import ResourceTable, { Column } from '../components/ResourceTable';
import LogViewer from '../components/LogViewer';
import ShellTerminal from '../components/ShellTerminal';
import { ContainerSummary } from '../types';
import { containerLogStream, containerShellStream, fetchContainers, startContainer, stopContainer } from '../api';

function ContainersPage() {
  const [containers, setContainers] = useState<ContainerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<ContainerSummary | null>(null);
  const [shellContainer, setShellContainer] = useState<ContainerSummary | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchContainers();
      setContainers(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStart = async (container: ContainerSummary) => {
    await startContainer(container.id);
    await loadData();
  };

  const handleStop = async (container: ContainerSummary) => {
    await stopContainer(container.id);
    if (shellContainer?.id === container.id) {
      setShellContainer(null);
    }
    await loadData();
  };

  const columns: Column<ContainerSummary>[] = useMemo(
    () => [
      {
        header: 'Name',
        accessor: (item) => (
          <div>
            <div style={{ fontWeight: 700 }}>{item.name}</div>
            <div className="inline-hint">{Array.isArray(item.image) ? item.image.join(', ') : item.image}</div>
          </div>
        ),
      },
      {
        header: 'Status',
        accessor: (item) => {
          const statusLower = item.status.toLowerCase();
          const badgeClass = statusLower.includes('up')
            ? 'badge success'
            : statusLower.includes('exited')
              ? 'badge danger'
              : 'badge warning';
          return <span className={badgeClass}>{item.status}</span>;
        },
        width: '160px',
      },
      {
        header: 'Actions',
        accessor: (item) => {
          const isRunning = item.status.toLowerCase().includes('up');
          return (
            <div className="actions">
              <button className="button" onClick={() => setSelectedContainer(item)}>
                View logs
              </button>
              <button className="button" onClick={() => setShellContainer(item)} disabled={!isRunning}>
                Open shell
              </button>
              {isRunning ? (
                <button className="button" onClick={() => handleStop(item)}>
                  Stop
                </button>
              ) : (
                <button className="button primary" onClick={() => handleStart(item)}>
                  Start
                </button>
              )}
            </div>
          );
        },
        width: '280px',
      },
    ],
    []
  );

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Containers</h2>
        <button className="button" onClick={loadData}>
          Refresh
        </button>
      </div>
      {error ? <div className="badge danger">{error}</div> : null}
      {loading ? <div className="loading">Loading containers...</div> : <ResourceTable columns={columns} data={containers} />}

      {selectedContainer ? (
        <LogViewer
          title={`Live logs — ${selectedContainer.name}`}
          streamFactory={() => containerLogStream(selectedContainer.id)}
          onClose={() => setSelectedContainer(null)}
        />
      ) : null}

      {shellContainer ? (
        <ShellTerminal
          title={`Shell — ${shellContainer.name}`}
          streamFactory={() => containerShellStream(shellContainer.id)}
          onClose={() => setShellContainer(null)}
        />
      ) : null}
    </div>
  );
}

export default ContainersPage;
