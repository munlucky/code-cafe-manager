import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderPlus,
  GitBranch,
  HardDrive,
  Clock,
  ArrowRight,
  Coffee,
  Trash2,
  FolderOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Terminal,
} from 'lucide-react';
import type { Cafe } from '../../types/design';

interface EnvironmentStatus {
  git: { installed: boolean; version?: string };
  node: { installed: boolean; version?: string };
  pnpm: { installed: boolean; version?: string };
}

interface GitRepoStatus {
  isGitRepo: boolean;
  hasRemote: boolean;
  remoteName?: string;
  remoteUrl?: string;
  currentBranch?: string;
}

interface NewGlobalLobbyProps {
  cafes: Cafe[];
  onCreateCafe: (path: string) => void;
  onSelectCafe: (id: string) => void;
  onDeleteCafe: (id: string) => void;
}

export const NewGlobalLobby: React.FC<NewGlobalLobbyProps> = ({
  cafes,
  onCreateCafe,
  onSelectCafe,
  onDeleteCafe,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [envStatus, setEnvStatus] = useState<EnvironmentStatus | null>(null);
  const [gitStatus, setGitStatus] = useState<GitRepoStatus | null>(null);
  const [isCheckingEnv, setIsCheckingEnv] = useState(false);
  const [isCheckingGit, setIsCheckingGit] = useState(false);
  const [isInitializingGit, setIsInitializingGit] = useState(false);

  // Check environment on mount
  useEffect(() => {
    const checkEnv = async () => {
      setIsCheckingEnv(true);
      try {
        const res = await window.codecafe.system.checkEnvironment();
        if (res.success && res.data) {
          setEnvStatus(res.data);
        }
      } catch (error) {
        console.error('Failed to check environment:', error);
      } finally {
        setIsCheckingEnv(false);
      }
    };
    checkEnv();
  }, []);

  // Check git status when path changes
  useEffect(() => {
    if (!newPath) {
      setGitStatus(null);
      return;
    }

    const checkGit = async () => {
      setIsCheckingGit(true);
      try {
        const res = await window.codecafe.system.checkGitRepo(newPath);
        if (res.success && res.data) {
          setGitStatus(res.data);
        }
      } catch (error) {
        console.error('Failed to check git repo:', error);
        setGitStatus(null);
      } finally {
        setIsCheckingGit(false);
      }
    };

    const timeoutId = setTimeout(checkGit, 500);
    return () => clearTimeout(timeoutId);
  }, [newPath]);

  const handleBrowse = useCallback(async () => {
    try {
      const res = await window.codecafe.dialog.selectFolder();
      if (res.success && res.data) {
        setNewPath(res.data);
      }
    } catch (error) {
      console.error('Failed to open folder dialog:', error);
    }
  }, []);

  const handleGitInit = useCallback(async () => {
    if (!newPath) return;
    setIsInitializingGit(true);
    try {
      const res = await window.codecafe.system.gitInit(newPath);
      if (res.success) {
        // Re-check git status
        const gitRes = await window.codecafe.system.checkGitRepo(newPath);
        if (gitRes.success && gitRes.data) {
          setGitStatus(gitRes.data);
        }
      }
    } catch (error) {
      console.error('Failed to initialize git:', error);
    } finally {
      setIsInitializingGit(false);
    }
  }, [newPath]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPath && gitStatus?.isGitRepo) {
      onCreateCafe(newPath);
      setNewPath('');
      setGitStatus(null);
      setIsCreating(false);
    }
  };

  const canConnect = newPath && gitStatus?.isGitRepo && !isCheckingGit;

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-bold text-cafe-100 mb-3 tracking-tight">
            Global Lobby
          </h1>
          <p className="text-cafe-400 text-lg font-light">
            Manage your coding environments and brew new workflows.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center px-5 py-3 bg-brand hover:bg-brand-hover text-white rounded-xl transition-all shadow-lg shadow-brand/20 hover:shadow-brand/40 font-medium transform hover:-translate-y-0.5"
        >
          <FolderPlus className="w-5 h-5 mr-2" />
          Register Cafe
        </button>
      </div>

      {/* Environment Status Banner */}
      {envStatus && (!envStatus.git.installed || !envStatus.node.installed) && (
        <div className="mb-6 bg-amber-900/20 border border-amber-700/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <p className="text-amber-200 font-medium mb-2">
                Environment Setup Required
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                {!envStatus.git.installed && (
                  <span className="text-amber-300">
                    Git is not installed. Please install Git to use CodeCafe.
                  </span>
                )}
                {!envStatus.node.installed && (
                  <span className="text-amber-300">
                    Node.js is not installed. Some features may not work.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isCreating && (
        <div className="mb-10 bg-cafe-800 border border-cafe-700 rounded-2xl p-8 animate-in fade-in slide-in-from-top-4 shadow-2xl shadow-black/50">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-brand/20 rounded-lg mr-3">
              <FolderPlus className="w-6 h-6 text-brand" />
            </div>
            <h3 className="text-xl font-semibold text-cafe-100">
              Register New Cafe
            </h3>
          </div>

          {/* Environment Check */}
          <div className="mb-6 p-4 bg-cafe-900/50 rounded-xl border border-cafe-700/50">
            <p className="text-xs font-bold text-cafe-500 mb-3 uppercase tracking-wider">
              Environment Status
            </p>
            <div className="flex flex-wrap gap-4">
              {isCheckingEnv ? (
                <span className="text-cafe-400 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking environment...
                </span>
              ) : envStatus ? (
                <>
                  <div className="flex items-center gap-2">
                    {envStatus.git.installed ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-cafe-300 text-sm">
                      Git{' '}
                      {envStatus.git.version && (
                        <span className="text-cafe-500">
                          ({envStatus.git.version})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {envStatus.node.installed ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-cafe-300 text-sm">
                      Node.js{' '}
                      {envStatus.node.version && (
                        <span className="text-cafe-500">
                          ({envStatus.node.version})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {envStatus.pnpm.installed ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <span className="text-cafe-500">-</span>
                    )}
                    <span className="text-cafe-300 text-sm">
                      pnpm{' '}
                      {envStatus.pnpm.version && (
                        <span className="text-cafe-500">
                          ({envStatus.pnpm.version})
                        </span>
                      )}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-cafe-500">Unable to check environment</span>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-cafe-500 mb-2 uppercase tracking-wider">
                Project Repository Path
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative group">
                  <HardDrive className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cafe-500 group-focus-within:text-brand transition-colors" />
                  <input
                    type="text"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    placeholder="/Users/username/dev/my-project"
                    className="w-full bg-cafe-950 border border-cafe-700 text-cafe-200 pl-12 pr-4 py-3.5 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none font-mono text-sm transition-all"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={handleBrowse}
                  className="px-4 py-3.5 bg-cafe-700 hover:bg-cafe-600 text-cafe-200 rounded-xl transition-colors flex items-center gap-2 font-medium"
                >
                  <FolderOpen className="w-5 h-5" />
                  Browse
                </button>
              </div>
            </div>

            {/* Git Status */}
            {newPath && (
              <div className="p-4 bg-cafe-900/50 rounded-xl border border-cafe-700/50">
                <p className="text-xs font-bold text-cafe-500 mb-3 uppercase tracking-wider">
                  Repository Status
                </p>
                {isCheckingGit ? (
                  <span className="text-cafe-400 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking repository...
                  </span>
                ) : gitStatus ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {gitStatus.isGitRepo ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          <span className="text-cafe-300 text-sm">
                            Git repository detected
                          </span>
                          {gitStatus.currentBranch && (
                            <span className="text-cafe-500 text-sm">
                              (branch: {gitStatus.currentBranch})
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-amber-400" />
                          <span className="text-amber-300 text-sm">
                            Not a Git repository
                          </span>
                          <button
                            type="button"
                            onClick={handleGitInit}
                            disabled={isInitializingGit}
                            className="ml-2 px-3 py-1 bg-brand hover:bg-brand-hover text-white text-xs rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            {isInitializingGit ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Terminal className="w-3 h-3" />
                            )}
                            Initialize Git
                          </button>
                        </>
                      )}
                    </div>
                    {gitStatus.isGitRepo && gitStatus.hasRemote && (
                      <div className="flex items-center gap-2 text-sm text-cafe-400">
                        <GitBranch className="w-3.5 h-3.5" />
                        <span>Remote: {gitStatus.remoteName}</span>
                        <span className="text-cafe-600 truncate max-w-[300px]">
                          ({gitStatus.remoteUrl})
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-cafe-500 text-sm">
                    Enter a path to check repository status
                  </span>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewPath('');
                  setGitStatus(null);
                }}
                className="px-6 py-3.5 text-cafe-400 hover:text-cafe-200 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canConnect}
                className="px-8 py-3.5 bg-cafe-100 hover:bg-white text-cafe-900 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors font-bold shadow-lg"
              >
                Connect
              </button>
            </div>
          </form>
        </div>
      )}

      {cafes.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-cafe-800 rounded-3xl bg-cafe-900/30">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-cafe-800 mb-6 shadow-inner">
            <Coffee className="w-10 h-10 text-cafe-600" />
          </div>
          <h3 className="text-2xl font-bold text-cafe-200 mb-3">
            No Cafes Registered
          </h3>
          <p className="text-cafe-500 max-w-md mx-auto mb-8 leading-relaxed">
            Your lobby is empty. Start by registering a local Git repository to
            begin orchestrating your code workflows.
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="text-brand-light hover:text-brand font-semibold flex items-center justify-center mx-auto transition-colors"
          >
            Register your first Cafe <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cafes.map((cafe) => (
            <div
              key={cafe.id}
              onClick={() => onSelectCafe(cafe.id)}
              className="group bg-cafe-800 hover:bg-cafe-700/80 border border-cafe-700/50 hover:border-brand/30 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-1 relative overflow-hidden"
            >
              {/* Decorative gradient blob */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full filter blur-2xl transform translate-x-10 -translate-y-10 group-hover:bg-brand/10 transition-all duration-500"></div>

              <div className="flex justify-between items-start mb-5 relative z-10">
                <div className="p-3 bg-cafe-900 rounded-xl border border-cafe-800 group-hover:border-brand/20 transition-colors shadow-sm">
                  <GitBranch className="w-6 h-6 text-brand" />
                </div>
                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide border ${
                    cafe.activeOrdersCount > 0
                      ? 'bg-brand/10 text-brand-light border-brand/20'
                      : 'bg-cafe-900 text-cafe-500 border-cafe-800'
                  }`}
                >
                  {cafe.activeOrdersCount} ACTIVE
                </span>
              </div>

              <h3 className="text-xl font-bold text-cafe-100 mb-1.5 tracking-tight group-hover:text-white transition-colors">
                {cafe.name}
              </h3>
              <p className="text-cafe-500 text-xs font-mono truncate mb-8 flex items-center">
                <HardDrive className="w-3 h-3 mr-1.5 opacity-50" />
                {cafe.path}
              </p>

              <div className="flex items-center justify-between text-xs text-cafe-500 pt-5 border-t border-cafe-700 group-hover:border-cafe-600 transition-colors">
                <div className="flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  Last brewed: Today
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        confirm(
                          `Delete "${cafe.name}"? This will remove the cafe from the registry.`
                        )
                      ) {
                        onDeleteCafe(cafe.id);
                      }
                    }}
                    className="p-1.5 text-cafe-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Delete Cafe"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex items-center text-brand-light opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300 font-medium">
                    Enter Cafe <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
