import { useEffect, useMemo, useState } from 'react';
import ResourceTable, { Column } from '../components/ResourceTable';
import { ImageSummary } from '../types';
import { deleteImage, fetchImages } from '../api';

function ImagesPage() {
  const [images, setImages] = useState<ImageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchImages();
      setImages(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (image: ImageSummary) => {
    if (!confirm(`Delete image ${image.tags?.[0] ?? image.short_id ?? image.id}?`)) return;
    await deleteImage(image.id);
    await loadData();
  };

  const formatSize = (size?: number) => {
    if (!size) return '—';
    const gb = size / 1024 / 1024 / 1024;
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = size / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const columns: Column<ImageSummary>[] = useMemo(
    () => [
      {
        header: 'Tag',
        accessor: (item) => item.tags?.join(', ') || '(untagged)',
      },
      {
        header: 'Image ID',
        accessor: (item) => item.short_id ?? item.id,
        width: '200px',
      },
      {
        header: 'Size',
        accessor: (item) => formatSize(item.size),
        width: '120px',
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
        <h2 className="page-title">Images</h2>
        <button className="button" onClick={loadData}>
          Refresh
        </button>
      </div>
      {error ? <div className="badge danger">{error}</div> : null}
      {loading ? <div className="loading">Loading images...</div> : <ResourceTable columns={columns} data={images} />}
    </div>
  );
}

export default ImagesPage;
