const fs = require('fs/promises');
const { createReadStream } = require('fs');
const Backup = require('../models/Backup');
const backupService = require('../services/backupService');

exports.list = async (req, res) => {
  try {
    const [status, backups] = await Promise.all([
      backupService.getBackupStatus(),
      Backup.find().sort({ createdAt: -1 }).limit(500).select('-__v').lean(),
    ]);
    res.json({ success: true, status, backups });
  } catch (error) {
    console.error('Failed to load database backups:', backupService.safeErrorMessage(error));
    res.status(500).json({ success: false, message: 'Unable to load database backups.' });
  }
};

exports.create = async (req, res) => {
  try {
    const backup = await backupService.createBackup({
      type: 'manual',
      createdBy: req.user,
      ipAddress: req.ip,
    });
    res.status(201).json({ success: true, backup });
  } catch (error) {
    console.error('Manual database backup failed:', backupService.safeErrorMessage(error));
    res.status(500).json({ success: false, message: 'Database backup failed. Check the server logs for details.' });
  }
};

exports.download = async (req, res) => {
  let backup;
  let activityLogged = false;
  const logDownload = (status, error = null, filename = backup?.filename || null) => {
    if (activityLogged) return;
    activityLogged = true;
    backupService.logBackupActivity({
      admin: req.user,
      action: 'DOWNLOAD_BACKUP_PDF',
      filename,
      status,
      ipAddress: req.ip,
      error,
    });
  };

  try {
    backup = await backupService.getBackupById(req.params.id);
    if (!backup || backup.status !== 'SUCCESS') {
      logDownload('FAILED', 'Backup not found.');
      return res.status(404).json({ success: false, message: 'Backup not found.' });
    }

    const filePath = backupService.getBackupFilePath(backup);
    const stats = await fs.lstat(filePath);
    if (!stats.isFile()) {
      logDownload('FAILED', 'Backup file is not a regular file.');
      return res.status(404).json({ success: false, message: 'Backup not found.' });
    }

    const pdfFilename = backup.filename.replace(/\.json\.gz$/, '.pdf');
    if (pdfFilename === backup.filename) throw new Error('Invalid stored backup filename.');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.once('finish', () => logDownload('SUCCESS'));
    res.once('close', () => {
      if (!res.writableFinished) logDownload('FAILED', 'PDF download ended before completion.');
    });
    await backupService.createBackupPdf(backup, res);
  } catch (error) {
    logDownload('FAILED', error);
    if (error.code === 'ENOENT') {
      if (!res.headersSent) return res.status(404).json({ success: false, message: 'Backup file is unavailable.' });
    }
    console.error('Database backup download failed:', backupService.safeErrorMessage(error));
    if (!res.headersSent) return res.status(500).json({ success: false, message: 'Unable to generate backup PDF.' });
    res.destroy(error);
  }
};

exports.downloadArchive = async (req, res) => {
  let backup;
  let activityLogged = false;
  const logDownload = (status, error = null, filename = backup?.filename || null) => {
    if (activityLogged) return;
    activityLogged = true;
    backupService.logBackupActivity({
      admin: req.user,
      action: 'DOWNLOAD_BACKUP_ARCHIVE',
      filename,
      status,
      ipAddress: req.ip,
      error,
    });
  };

  try {
    backup = await backupService.getBackupById(req.params.id);
    if (!backup || backup.status !== 'SUCCESS') {
      logDownload('FAILED', 'Backup not found.');
      return res.status(404).json({ success: false, message: 'Backup not found.' });
    }

    const filePath = backupService.getBackupFilePath(backup);
    const stats = await fs.lstat(filePath);
    if (!stats.isFile()) {
      logDownload('FAILED', 'Backup file is not a regular file.');
      return res.status(404).json({ success: false, message: 'Backup not found.' });
    }

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.once('finish', () => logDownload('SUCCESS'));
    res.once('close', () => {
      if (!res.writableFinished) logDownload('FAILED', 'Archive download ended before completion.');
    });

    const archive = createReadStream(filePath);
    archive.once('error', error => {
      logDownload('FAILED', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Unable to read backup archive.' });
      } else {
        res.destroy(error);
      }
    });
    archive.pipe(res);
  } catch (error) {
    logDownload('FAILED', error);
    if (error.code === 'ENOENT') {
      return res.status(404).json({ success: false, message: 'Backup file is unavailable.' });
    }
    console.error('Database backup archive download failed:', backupService.safeErrorMessage(error));
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Unable to download backup archive.' });
    }
    res.destroy(error);
  }
};

exports.remove = async (req, res) => {
  try {
    const backup = await backupService.getBackupById(req.params.id);
    if (!backup) {
      await backupService.logBackupActivity({
        admin: req.user,
        action: 'DELETE_BACKUP',
        status: 'FAILED',
        ipAddress: req.ip,
        error: 'Backup not found.',
      });
      return res.status(404).json({ success: false, message: 'Backup not found.' });
    }

    if (backup.status === 'IN_PROGRESS') {
      return res.status(409).json({ success: false, message: 'An in-progress backup cannot be deleted.' });
    }

    if (backup.status === 'SUCCESS') {
      const filePath = backupService.getBackupFilePath(backup);
      await fs.rm(filePath, { force: true });
    }
    await Backup.deleteOne({ _id: backup._id });
    await backupService.logBackupActivity({
      admin: req.user,
      action: 'DELETE_BACKUP',
      filename: backup.filename,
      status: 'SUCCESS',
      ipAddress: req.ip,
    });
    res.json({ success: true, message: 'Backup deleted.' });
  } catch (error) {
    await backupService.logBackupActivity({
      admin: req.user,
      action: 'DELETE_BACKUP',
      status: 'FAILED',
      ipAddress: req.ip,
      error,
    });
    console.error('Database backup deletion failed:', backupService.safeErrorMessage(error));
    res.status(500).json({ success: false, message: 'Unable to delete backup.' });
  }
};
