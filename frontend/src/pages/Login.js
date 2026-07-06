import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Select from '../components/Select';

const TIER_OPTIONS = [
  { id: 'silver', name: 'Silver', desc: '1 book at a time · Standard access', priceKey: 'silver_rate' },
  { id: 'gold', name: 'Gold', desc: '3 books at a time · Community & Games access', priceKey: 'gold_rate' },
  { id: 'family', name: 'Family', desc: 'Up to 4 members · 1 book each', priceKey: 'family_rate' },
];

function Login() {
  const { login } = useAuth();
  const location = useLocation();
  const [isRegister, setIsRegister] = useState(Boolean(location.state?.register));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('member');
  const [requestedTier, setRequestedTier] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/membership/pricing').then((r) => setPricing(r.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const payload = isRegister
        ? { username, password, role, requested_tier: role === 'member' ? requestedTier : null }
        : { username, password };
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
        <div className="form-group">
          <label>Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} required />
        </div>
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
        {isRegister && role === 'member' && (
          <div className="form-group">
            <label>
              Membership tier{' '}
              <span className="muted" style={{ textTransform: 'none', fontSize: '0.75rem' }}>
                (optional — you can request one later)
              </span>
            </label>
            <div className="tier-picker">
              {TIER_OPTIONS.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={`tier-picker-option${requestedTier === t.id ? ' active' : ''}`}
                  onClick={() => setRequestedTier(requestedTier === t.id ? null : t.id)}
                >
                  <span>
                    <span className="tier-picker-option-name">{t.name}</span>
                    <div className="tier-picker-option-desc">{t.desc}</div>
                  </span>
                  {pricing && (
                    <span className="tier-picker-option-price">
                      ${pricing[t.priceKey].toFixed(2)}/mo
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="field-hint">
              You can pay the membership fee in person; your tier activates once
              an admin approves your request.
            </p>
          </div>
        )}
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
      </form>
    </div>
  );
}

export default Login;
