import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function AuthPage() {
  const { login, register, setupRequired, isAuthenticated, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string })?.from || '/containers';

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (evt: FormEvent) => {
    evt.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (setupRequired) {
        await register(username, password);
      } else {
        await login(username, password);
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to authenticate');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="page-header">
          <div>
            <p className="inline-hint">Docker Web Manager</p>
            <h2 className="page-title">{setupRequired ? 'Create admin account' : 'Sign in'}</h2>
            <p className="inline-hint">Stage 7 security is now enabled.</p>
          </div>
        </div>
        {loading ? (
          <div className="loading">Checking authentication state…</div>
        ) : (
          <form className="form-grid" onSubmit={handleSubmit}>
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && <div className="error-box">{error}</div>}
            <button className="button primary" type="submit" disabled={submitting}>
              {setupRequired ? 'Create admin' : 'Login'}
            </button>
            <p className="inline-hint">
              {setupRequired
                ? 'This initial administrator unlocks the dashboard.'
                : 'Use your administrator credentials to continue.'}
            </p>
          </form>
        )}
      </div>
      <div className="auth-copy card">
        <h3>What changed in Stage 7?</h3>
        <ul>
          <li>Single-user authentication protects every endpoint.</li>
          <li>Dangerous actions are rate limited to prevent abuse.</li>
          <li>Configurations like stack root and theme are editable from the UI.</li>
        </ul>
      </div>
    </div>
  );
}

export default AuthPage;
