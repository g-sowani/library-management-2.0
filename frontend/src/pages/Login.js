import React, { useEffect, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Select from '../components/Select';

function Login() {
  const { login } = useAuth();
  const location = useLocation();
  const [isRegister, setIsRegister] = useState(Boolean(location.state?.register));
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState('');

  const [libraryAction, setLibraryAction] = useState('create');
  const [libraryName, setLibraryName] = useState('');
  const [libraryCode, setLibraryCode] = useState('');
  const [libraries, setLibraries] = useState([]);

  const needsLibraryCode = isRegister && (role === 'member' || (role === 'admin' && libraryAction === 'join'));
  const selectedLibrary = libraries.find((lib) => lib.code === libraryCode) || null;

  useEffect(() => {
    api.get('/libraries').then((r) => setLibraries(r.data)).catch(() => {});
  }, []);

  // Google's button callback is registered once via `initialize`, so it can only
  // see fresh form values through a ref rather than through its own closure.
  const formStateRef = useRef();
  formStateRef.current = { isRegister, username, role, libraryAction, libraryName, libraryCode, needsLibraryCode };

  const [googleClientId, setGoogleClientId] = useState('');
  const googleBtnRef = useRef(null);

  useEffect(() => {
    api.get('/auth/google/config').then((r) => setGoogleClientId(r.data.client_id)).catch(() => {});
  }, []);

  const handleGoogleCredential = async (response) => {
    const credential = response.credential;
    const { isRegister, username, role, libraryAction, libraryName, libraryCode, needsLibraryCode } = formStateRef.current;
    setError('');
    try {
      if (isRegister) {
        if (!username) {
          setError('Please enter a username above, then continue with Google');
          return;
        }
        if (needsLibraryCode && !libraryCode) {
          setError('Please select a library above, then continue with Google');
          return;
        }
        if (role === 'admin' && libraryAction === 'create' && !libraryName) {
          setError('Please enter a library name above, then continue with Google');
          return;
        }
        const payload = { credential, username, role };
        if (role === 'admin' && libraryAction === 'create') {
          payload.library_action = 'create';
          payload.library_name = libraryName;
        } else {
          payload.library_action = 'join';
          payload.library_code = libraryCode;
        }
        const res = await api.post('/auth/google-register', payload);
        login(res.data);
      } else {
        const res = await api.post('/auth/google-login', { credential });
        login(res.data);
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'no_account') {
        setIsRegister(true);
        setError('No account found for that Google email. Fill in the details below, then continue with Google again to finish registering.');
      } else {
        setError(data?.error || 'Something went wrong');
      }
    }
  };

  useEffect(() => {
    if (!googleClientId) return;
    let cancelled = false;
    const tryRender = () => {
      if (cancelled) return;
      if (window.google?.accounts?.id && googleBtnRef.current) {
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredential,
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: isRegister ? 'signup_with' : 'signin_with',
        });
      } else {
        setTimeout(tryRender, 100);
      }
    };
    tryRender();
    return () => { cancelled = true; };
  }, [googleClientId, isRegister]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (needsLibraryCode && !libraryCode) {
      setError('Please select a library');
      return;
    }
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      let payload = { username, password };
      if (isRegister) {
        payload = { ...payload, email, role };
        if (role === 'admin' && libraryAction === 'create') {
          payload.library_action = 'create';
          payload.library_name = libraryName;
        } else {
          payload.library_action = 'join';
          payload.library_code = libraryCode;
        }
      }
      const res = await api.post(endpoint, payload);
      login(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    }
  };

  return (
    <div className="login-page">
      <form className="login-box" onSubmit={handleSubmit}>
        <Link to="/" className="login-back-link">&larr; Back to home</Link>
        <h1>{isRegister ? 'Register' : 'Sign In'}</h1>
        {error && <div className="error">{error}</div>}
        <div className="modal-form-grid">
          <div className="form-group">
            <label>Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          {isRegister && (
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          )}
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {isRegister && (
            <div className="form-group">
              <label>Role</label>
              <Select value={role} onChange={e => setRole(e.target.value)}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
          )}
          {isRegister && role === 'admin' && (
            <div className="form-group form-group-full">
              <label>Library</label>
              <div className="tier-picker tier-picker-row">
                <button
                  type="button"
                  className={`tier-picker-option${libraryAction === 'create' ? ' active' : ''}`}
                  onClick={() => setLibraryAction('create')}
                >
                  <span>
                    <span className="tier-picker-option-name">Create a new library</span>
                    <div className="tier-picker-option-desc">Start a brand-new library and get a join code to share</div>
                  </span>
                </button>
                <button
                  type="button"
                  className={`tier-picker-option${libraryAction === 'join' ? ' active' : ''}`}
                  onClick={() => setLibraryAction('join')}
                >
                  <span>
                    <span className="tier-picker-option-name">Join an existing library</span>
                    <div className="tier-picker-option-desc">Enter another admin's library join code</div>
                  </span>
                </button>
              </div>
              {libraryAction === 'create' ? (
                <input
                  style={{ marginTop: 8 }}
                  placeholder="Library name"
                  value={libraryName}
                  onChange={(e) => setLibraryName(e.target.value)}
                  required
                />
              ) : (
                <div style={{ marginTop: 8 }}>
                  <Select value={libraryCode} onChange={(e) => setLibraryCode(e.target.value)}>
                    <option value="">Search by library name or code…</option>
                    {libraries.map((lib) => (
                      <option key={lib.code} value={lib.code}>{lib.name} ({lib.code})</option>
                    ))}
                  </Select>
                  {selectedLibrary && (
                    <p className="field-hint">Joining <strong>{selectedLibrary.name}</strong></p>
                  )}
                </div>
              )}
            </div>
          )}
          {isRegister && role === 'member' && (
            <div className="form-group form-group-full">
              <label>Library</label>
              <Select value={libraryCode} onChange={(e) => setLibraryCode(e.target.value)}>
                <option value="">Search by library name or code…</option>
                {libraries.map((lib) => (
                  <option key={lib.code} value={lib.code}>{lib.name} ({lib.code})</option>
                ))}
              </Select>
              {selectedLibrary && (
                <p className="field-hint">Joining <strong>{selectedLibrary.name}</strong></p>
              )}
              <p className="field-hint">
                You can pick a membership tier later from My Profile once you're signed in.
              </p>
            </div>
          )}
        </div>
        <div className="login-actions">
          <button className="btn btn-full" type="submit">
            {isRegister ? 'Register' : 'Sign In'}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-full"
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            style={{ marginTop: 8 }}
          >
            {isRegister ? 'Back to Sign In' : 'Create Account'}
          </button>
          {googleClientId && (
            <>
              <div className="login-divider" style={{ margin: '16px 0', textAlign: 'center', opacity: 0.6 }}>or</div>
              {isRegister && (
                <p className="field-hint" style={{ marginBottom: 8 }}>
                  Fill in the username and library fields above first, then continue with Google.
                </p>
              )}
              <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center' }} />
            </>
          )}
        </div>
      </form>
    </div>
  );
}

export default Login;
