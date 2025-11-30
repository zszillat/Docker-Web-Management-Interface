import { useEffect, useMemo, useState } from 'react';
import ResourceTable, { Column } from '../components/ResourceTable';
import { VolumeSummary } from '../types';
import { deleteVolume, fetchVolumes } from '../api';

function VolumesPage() {
  const [volumes, setVolumes] = useState<VolumeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchVolumes();
      setVolumes(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (volume: VolumeSummary) => {
    if (!confirm(`Delete volume ${volume.name}?`)) return;
    await deleteVolume(volume.name);
    await loadData();
  };

  const columns: Column<VolumeSummary>[] = useMemo(
    () => [
      {
        header: 'Name',
        accessor: (item) => item.name,
      },
      {
        header: 'Driver',
        accessor: (item) => item.driver ?? 'local',
        width: '160px',
      },
      {
        header: 'Mountpoint',
        accessor: (item) => item.mountpoint ?? '—',
      },
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
        <h2 className="page-title">Volumes</h2>
        <button className="button" onClick={loadData}>
          Refresh
        </button>
      </div>
      {error ? <div className="badge danger">{error}</div> : null}
      {loading ? <div className="loading">Loading volumes...</div> : <ResourceTable columns={columns} data={volumes} />}
    </div>
  );
}

export default VolumesPage;
