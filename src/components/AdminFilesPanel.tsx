'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface FileDetail {
  id: string;
  fileName: string;
  fileSize: number;
  textLength: number;
  summary: string;
  audioUrl?: string;
  videoUrl?: string;
  adminNotes?: string;
  flagged: boolean;
  downloadedByAdminAt?: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    credits: number;
    role: string;
  };
  videoGeneration?: {
    id: string;
    status: string;
  } | null;
}

interface FileListItem {
  id: string;
  fileName: string;
  fileSize: number;
  summary: string;
  hasAudio: boolean;
  hasVideo: boolean;
  videoStatus?: string | null;
  adminNotes?: string;
  flagged: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserWithFiles {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  credits: number;
  role: string;
  status: string;
  files: FileListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function AdminFilesPanel() {
  const [view, setView] = useState<'all' | 'user'>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [fileDetails, setFileDetails] = useState<FileDetail | null>(null);
  const [userFiles, setUserFiles] = useState<UserWithFiles | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [flagged, setFlagged] = useState(false);

  // Fetch file details
  const fetchFileDetails = async (fileId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/files/${fileId}`);
      const json = await res.json();
      if (json.ok) {
        setFileDetails(json.data);
        setAdminNote(json.data.adminNotes || '');
        setFlagged(json.data.flagged);
      }
    } catch (err) {
      console.error('Failed to fetch file details', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user's files
  const fetchUserFiles = async (userId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/files?page=1&pageSize=20`);
      const json = await res.json();
      if (json.ok) {
        setUserFiles(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch user files', err);
    } finally {
      setLoading(false);
    }
  };

  // Download file
  const handleDownloadFile = async (fileId: string) => {
    try {
      const res = await fetch(`/api/admin/files/download/${fileId}`);
      const json = await res.json();
      
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${json.fileName.replace(/\s+/g, '_')}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download file', err);
    }
  };

  // Delete file
  const handleDeleteFile = async (fileId: string, hardDelete = false) => {
    if (!confirm(hardDelete ? 'Permanently delete this file?' : 'Mark file as deleted?')) return;
    
    try {
      const res = await fetch(`/api/admin/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hardDelete }),
      });
      const json = await res.json();
      if (json.ok) {
        // Refresh current view
        if (selectedUserId && userFiles) {
          fetchUserFiles(selectedUserId);
        }
      }
    } catch (err) {
      console.error('Failed to delete file', err);
    }
  };

  // Save admin notes
  const handleSaveNotes = async (fileId: string) => {
    try {
      const res = await fetch(`/api/admin/files/${fileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes: adminNote, flagged }),
      });
      const json = await res.json();
      if (json.ok) {
        if (fileDetails) {
          setFileDetails({ ...fileDetails, adminNotes: adminNote, flagged });
        }
      }
    } catch (err) {
      console.error('Failed to save notes', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setView('all'); setSelectedUserId(null); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            view === 'all'
              ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30'
              : 'bg-white/5 text-foreground-secondary border border-white/10'
          }`}
        >
          📁 All Files
        </button>
        <button
          onClick={() => setView('user')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            view === 'user'
              ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30'
              : 'bg-white/5 text-foreground-secondary border border-white/10'
          }`}
        >
          👤 User Files
        </button>
      </div>

      {view === 'all' && (
        <div className="space-y-4">
          <h2 className="text-xl font-serif text-white">All User Files</h2>
          
          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-secondary">🔍</span>
            <input
              type="text"
              placeholder="Search files by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-foreground-secondary focus:outline-none focus:border-accent-gold/50"
            />
          </div>

          {/* Files Table */}
          <div className="glass-lg rounded-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="text-left px-5 py-3 text-foreground-secondary font-medium">File</th>
                    <th className="text-left px-5 py-3 text-foreground-secondary font-medium">Owner</th>
                    <th className="text-left px-5 py-3 text-foreground-secondary font-medium">Size</th>
                    <th className="text-left px-5 py-3 text-foreground-secondary font-medium">Type</th>
                    <th className="text-left px-5 py-3 text-foreground-secondary font-medium">Date</th>
                    <th className="text-right px-5 py-3 text-foreground-secondary font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-foreground-secondary">Loading...</td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-foreground-secondary">
                        Fetching files... (This will be populated from /api/admin/files)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'user' && (
        <div className="space-y-4">
          <h2 className="text-xl font-serif text-white">Access User Dashboard</h2>
          
          {/* User ID Input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter User ID..."
              value={selectedUserId || ''}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-foreground-secondary focus:outline-none focus:border-accent-gold/50"
            />
            <button
              onClick={() => selectedUserId && fetchUserFiles(selectedUserId)}
              className="px-6 py-2 bg-accent-gold/20 text-accent-gold border border-accent-gold/30 rounded-lg hover:bg-accent-gold/30 transition-all font-medium text-sm"
            >
              Load Files
            </button>
          </div>

          {userFiles && (
            <div className="space-y-4">
              {/* User Info */}
              <div className="glass-lg rounded-xl border border-white/10 p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-foreground-secondary">Name</p>
                    <p className="text-white font-medium">{userFiles.user.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-secondary">Email</p>
                    <p className="text-white font-medium text-sm">{userFiles.user.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-secondary">Credits</p>
                    <p className="text-white font-medium">{userFiles.user.credits}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-secondary">Total Files</p>
                    <p className="text-white font-medium">{userFiles.pagination.total}</p>
                  </div>
                </div>
              </div>

              {/* Files List */}
              <div className="glass-lg rounded-xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="text-left px-5 py-3 text-foreground-secondary font-medium">File Name</th>
                        <th className="text-left px-5 py-3 text-foreground-secondary font-medium">Size</th>
                        <th className="text-left px-5 py-3 text-foreground-secondary font-medium">Media</th>
                        <th className="text-left px-5 py-3 text-foreground-secondary font-medium">Flagged</th>
                        <th className="text-right px-5 py-3 text-foreground-secondary font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userFiles.files.map((file) => (
                        <tr
                          key={file.id}
                          onClick={() => fetchFileDetails(file.id)}
                          className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                        >
                          <td className="px-5 py-3 text-white truncate max-w-xs">{file.fileName}</td>
                          <td className="px-5 py-3 text-foreground-secondary text-xs">{formatBytes(file.fileSize)}</td>
                          <td className="px-5 py-3 text-sm">
                            <span className="space-x-1">
                              {file.hasAudio && <span>🔊</span>}
                              {file.hasVideo && <span>🎬</span>}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {file.flagged ? <span className="text-red-400 text-xs font-medium">⚠️ Flagged</span> : <span className="text-foreground-secondary text-xs">—</span>}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadFile(file.id);
                                }}
                                className="px-2 py-1 text-xs bg-accent-neon-blue/20 text-accent-neon-blue border border-accent-neon-blue/30 rounded hover:bg-accent-neon-blue/30"
                              >
                                ⬇️
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFile(file.id);
                                }}
                                className="px-2 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* File Details Modal */}
              {fileDetails && (
                <div className="glass-lg rounded-xl border border-white/10 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-serif text-white">{fileDetails.fileName}</h3>
                      <p className="text-xs text-foreground-secondary mt-1">
                        Uploaded by {fileDetails.owner.name} • {formatDistanceToNow(new Date(fileDetails.createdAt))} ago
                      </p>
                    </div>
                    <button
                      onClick={() => setFileDetails(null)}
                      className="text-foreground-secondary hover:text-white text-lg"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <p className="text-xs text-foreground-secondary mb-2">Summary Preview</p>
                      <p className="text-sm text-white bg-white/5 p-3 rounded border border-white/10 max-h-[200px] overflow-y-auto">
                        {fileDetails.summary}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-foreground-secondary mb-1">Admin Notes</p>
                        <textarea
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                          placeholder="Add notes about this file..."
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white placeholder:text-foreground-secondary text-sm resize-none h-20 focus:outline-none focus:border-accent-gold/50"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={flagged}
                          onChange={(e) => setFlagged(e.target.checked)}
                          className="rounded border-white/20"
                        />
                        <label className="text-sm text-white cursor-pointer">Flag for review</label>
                      </div>

                      <button
                        onClick={() => handleSaveNotes(fileDetails.id)}
                        className="w-full px-4 py-2 bg-accent-gold/20 text-accent-gold border border-accent-gold/30 rounded hover:bg-accent-gold/30 transition-all text-sm font-medium"
                      >
                        Save Notes
                      </button>
                    </div>
                  </div>

                  {/* File Actions */}
                  <div className="flex gap-2 pt-4 border-t border-white/10">
                    <button
                      onClick={() => handleDownloadFile(fileDetails.id)}
                      className="flex-1 px-4 py-2 bg-accent-neon-blue/20 text-accent-neon-blue border border-accent-neon-blue/30 rounded hover:bg-accent-neon-blue/30 transition-all text-sm font-medium"
                    >
                      ⬇️ Download
                    </button>
                    <button
                      onClick={() => handleDeleteFile(fileDetails.id)}
                      className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-all text-sm font-medium"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
