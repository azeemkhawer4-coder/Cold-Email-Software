import React, { useState } from 'react';
import { ShieldCheck, Lock, User, Mail, Building, Key, CheckCircle2, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface LocalAuthModalProps {
  isSetup: boolean; // false = first-run setup; true = login
  onAuthSuccess: (user: any) => void;
  onContinueLocal?: () => void;
}

export const LocalAuthModal: React.FC<LocalAuthModalProps> = ({ isSetup, onAuthSuccess, onContinueLocal }) => {
  const [mode, setMode] = useState<'setup' | 'login'>(isSetup ? 'login' : 'setup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [workspaceName, setWorkspaceName] = useState('Apex Growth Labs');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'setup') {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch('/api/auth/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
            workspaceName: workspaceName.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to complete setup');
        onAuthSuccess(data.user);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(true);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invalid credentials');
        onAuthSuccess(data.user);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070b14] p-4">
      <div className="surface-card rounded-2xl border border-slate-700/80 p-8 max-w-md w-full space-y-6 shadow-2xl relative overflow-hidden">
        {/* Subtle glow accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -translate-y-12 translate-x-12" />

        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-500/30 px-3 py-1 text-xs font-semibold text-blue-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Local SQLite Architecture
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {mode === 'setup' ? 'First-Run Administrator Setup' : 'Local Master Login'}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {mode === 'setup'
              ? 'Create your local administrator credentials to password-protect this workspace, or continue directly in local single-user mode.'
              : 'Sign in to access your local OutboundOS workspace.'}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs relative z-10">
          {mode === 'setup' && (
            <div>
              <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-400" />
                Administrator Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Workspace Owner"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              Email Address *
            </label>
            <input
              type="email"
              required
              placeholder="admin@local.host or your corporate email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          {mode === 'setup' && (
            <div>
              <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-slate-400" />
                Workspace / Organization Name
              </label>
              <input
                type="text"
                placeholder="Apex Growth Labs"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-medium mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                Master Password *
              </span>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer flex items-center gap-1"
              >
                {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                <span>{showPassword ? 'Hide' : 'Show'}</span>
              </button>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder={mode === 'setup' ? 'Minimum 6 characters' : 'Enter password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          {mode === 'setup' && (
            <div>
              <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-slate-400" />
                Confirm Password *
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Re-type password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 font-bold text-white hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 transition cursor-pointer shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 mt-2"
          >
            <span>{isLoading ? 'Processing...' : mode === 'setup' ? 'Create Administrator & Start' : 'Sign In Locally'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          {!isSetup && onContinueLocal && (
            <button
              type="button"
              onClick={onContinueLocal}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            >
              Continue in Local Single-User Mode
            </button>
          )}
        </form>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Database: data/outboundos.sqlite</span>
          {isSetup && (
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'setup' : 'login');
                setError(null);
              }}
              className="text-blue-400 hover:text-blue-300 cursor-pointer font-medium"
            >
              {mode === 'login' ? 'Need Setup?' : 'Switch to Sign In'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
