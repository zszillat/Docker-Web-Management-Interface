import { useEffect, useMemo, useState } from 'react';
import ResourceTable, { Column } from '../components/ResourceTable';
import { NetworkSummary } from '../types';
import { deleteNetwork, fetchNetworks } from '../api';

function NetworksPage() {
  const [networks, setNetworks] = useState<NetworkSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchNetworks();
      setNetworks(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (network: NetworkSummary) => {
    if (!confirm(`Delete network ${network.name}?`)) return;
    await deleteNetwork(network.id);
    await loadData();
  };

  const columns: Column<NetworkSummary>[] = useMemo(
    () => [
      { header: 'Name', accessor: (item) => item.name },
      { header: 'Driver', accessor: (item) => item.driver ?? '—', width: '160px' },
      { header: 'Scope', accessor: (item) => item.scope ?? 'local', width: '120px' },
      {
        header: 'Actions',
        accessor: (item) => (
          <button className="button danger" onClick={() => handleDelete(item)}>
            Delete
          </button>
        ),
        width: '140px',
      },
    ],
    []
  );

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Networks</h2>
        <button className="button" onClick={loadData}>
          Refresh
        </button>
      </div>
      {error ? <div className="badge danger">{error}</div> : null}
      {loading ? <div className="loading">Loading networks...</div> : <ResourceTable columns={columns} data={networks} />}
    </div>
  );
}

export default NetworksPage;
