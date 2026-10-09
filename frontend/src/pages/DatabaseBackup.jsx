import { useCallback, useEffect, useState } from 'react';
import {
  FiAlertCircle, FiCheckCircle, FiClock, FiDatabase, FiDownload,
  FiHardDrive, FiRefreshCw, FiShield, FiTrash2
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { PageLoader, Spinner } from '../components/common/Spinner';
import { backupService } from '../services';

const formatBytes = bytes => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** unit)).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const formatDate = value => value
  ? new Date(value).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
  : 'No successful backup yet';

const pdfFilename = filename => filename.replace(/\.json\.gz$/, '.pdf');

const STATUS_STYLES = {
  SUCCESS: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  IN_PROGRESS: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

const BackupStatus = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'}`}>
    {status === 'SUCCESS' ? <FiCheckCircle /> : status === 'FAILED' ? <FiAlertCircle /> : <FiClock />}
    {(status || 'UNKNOWN').replace('_', ' ')}
  </span>
);

export default function DatabaseBackup() {
  const [backups, setBackups] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [backupToDelete, setBackupToDelete] = useState(null);

  const loadBackups = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const response = await backupService.getAll();
      setBackups(response.data.backups || []);
      setStatus(response.data.status);
    } catch {
      toast.error('Unable to load database backups.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => { loadBackups(); }, [loadBackups]);

  const downloadArchive = async (backup, { showError = true, showSuccess = true } = {}) => {
    setDownloadingId(backup._id);
    try {
      const response = await backupService.downloadArchive(backup._id);
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/gzip' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = backup.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (showSuccess) toast.success('Full database archive downloaded. Store it somewhere secure.');
      return true;
    } catch {
      if (showError) toast.error('Unable to download this backup archive.');
      return false;
    } finally {
      setDownloadingId(null);
    }
  };

  const createBackup = async () => {
    if (!window.confirm('Create a full database backup and download it to this device? The archive contains sensitive account data.')) return;
    setCreating(true);
    try {
      const response = await backupService.create();
      const backup = response.data.backup;
      await loadBackups(false);
      const downloaded = await downloadArchive(backup, { showError: false, showSuccess: false });
      if (downloaded) {
        toast.success('Full backup created and downloaded. Store the archive somewhere secure.');
      } else {
        toast.error('Backup created on the server, but the archive could not be downloaded. Use Download Archive in backup history.');
      }
    } catch {
      toast.error('Database backup failed. Please check the server logs.');
      await loadBackups(false);
    } finally {
      setCreating(false);
    }
  };

  const downloadBackup = async backup => {
    setDownloadingId(backup._id);
    try {
      const response = await backupService.download(backup._id);
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = pdfFilename(backup.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('PDF download started.');
    } catch {
      toast.error('Unable to download this backup.');
    } finally {
      setDownloadingId(null);
    }
  };

  const deleteBackup = async () => {
    if (!backupToDelete) return;
    setDeletingId(backupToDelete._id);
    try {
      await backupService.remove(backupToDelete._id);
      toast.success('Backup deleted.');
      setBackupToDelete(null);
      await loadBackups(false);
    } catch {
      toast.error('Unable to delete this backup.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <PageLoader />;

  const latestBackup = status?.latestBackup;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Database Backup</h1>
          <p className="mt-1 text-sm text-slate-500">Manage secure backups of SFA database records.</p>
        </div>
        <button onClick={createBackup} disabled={creating}
          className="btn-primary inline-flex items-center justify-center gap-2 py-2.5 disabled:opacity-60">
          {creating ? <Spinner size="sm" /> : <FiDatabase />}
          {creating ? 'Creating and downloading...' : 'Create & Download Full Backup'}
        </button>
      </div>

      {creating && (
        <div className="card flex items-center gap-3 border border-primary-200 p-4 text-sm text-slate-600 dark:border-primary-900 dark:text-slate-300">
          <Spinner size="sm" />
          <span>Creating, compressing, and downloading the full database archive. Keep this page open until it completes.</span>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500"><FiShield /> Backup system</div>
          <p className={`mt-3 text-lg font-semibold ${status?.enabled && status?.scheduleActive ? 'text-green-600' : 'text-amber-600'}`}>
            {status?.enabled && status?.scheduleActive ? 'Active' : 'Needs attention'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {status?.enabled ? `Daily schedule: ${status?.schedule} (${status?.timezone})` : 'Backups are disabled in server configuration.'}
          </p>
          {status?.scheduleError && <p className="mt-2 text-xs text-red-500">{status.scheduleError}</p>}
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500"><FiClock /> Last successful archive</div>
          <p className="mt-3 text-base font-semibold text-slate-900 dark:text-white">{formatDate(latestBackup?.createdAt)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {latestBackup && <BackupStatus status={latestBackup.status} />}
            <span className="text-xs text-slate-400">{latestBackup ? formatBytes(latestBackup.size) : 'A backup has not completed yet'}</span>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500"><FiDatabase /> Available backups</div>
          <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{status?.backupCount ?? 0}</p>
          <p className="mt-1 text-xs text-slate-400">Retention: {status?.retentionDays ?? 'Not configured'} days</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500"><FiHardDrive /> Secure archive storage</div>
          <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{formatBytes(status?.storageUsed || 0)}</p>
          <p className="mt-1 text-xs text-slate-400">Compressed backup files</p>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Backup history</h2>
            <p className="mt-1 text-xs text-slate-500">Download the full archive for recovery; PDFs are readable summaries only. Full archives contain sensitive account data, so store them securely.</p>
          </div>
          <button onClick={() => loadBackups()} disabled={loading}
            className="btn-secondary inline-flex items-center gap-2 text-sm">
            <FiRefreshCw /> Refresh
          </button>
        </div>
        {backups.length === 0 ? (
          <div className="p-12 text-center">
            <FiDatabase className="mx-auto mb-3 text-4xl text-slate-300" />
            <p className="font-medium text-slate-700 dark:text-slate-200">No backups available</p>
            <p className="mt-1 text-sm text-slate-500">Create a backup now or wait for the next scheduled run.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">File name</th>
                  <th className="px-5 py-3 font-semibold">Stored size</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {backups.map(backup => (
                  <tr key={backup._id} className="text-slate-700 dark:text-slate-300">
                    <td className="whitespace-nowrap px-5 py-4">{formatDate(backup.createdAt)}</td>
                    <td className="max-w-[280px] truncate px-5 py-4 font-mono text-xs" title={pdfFilename(backup.filename)}>{pdfFilename(backup.filename)}</td>
                    <td className="whitespace-nowrap px-5 py-4">{formatBytes(backup.size)}</td>
                    <td className="px-5 py-4 capitalize">{backup.type}</td>
                    <td className="px-5 py-4">
                      <BackupStatus status={backup.status} />
                      {backup.error && <p className="mt-1 max-w-xs text-xs text-red-500">{backup.error}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {backup.status === 'SUCCESS' && (
                          <>
                            <button onClick={() => downloadArchive(backup)} disabled={downloadingId === backup._id}
                              className="btn-secondary inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
                              aria-label={`Download full archive ${backup.filename}`}>
                              {downloadingId === backup._id ? <Spinner size="sm" /> : <FiDownload />}
                              Download Archive
                            </button>
                            <button onClick={() => downloadBackup(backup)} disabled={downloadingId === backup._id}
                              className="btn-secondary inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
                              aria-label={`Download readable PDF ${backup.filename}`}>
                              {downloadingId === backup._id ? <Spinner size="sm" /> : <FiDownload />}
                              PDF Report
                            </button>
                          </>
                        )}
                        {backup.status !== 'IN_PROGRESS' && (
                          <button onClick={() => setBackupToDelete(backup)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/20"
                            aria-label={`Delete ${backup.filename}`}>
                            <FiTrash2 /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(backupToDelete)}
        title="Delete backup?"
        message="Are you sure you want to permanently delete this backup?"
        onConfirm={deleteBackup}
        onCancel={() => setBackupToDelete(null)}
        loading={Boolean(deletingId)}
      />
    </div>
  );
}
