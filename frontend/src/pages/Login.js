import React, { useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Select from '../components/Select';

function Login() {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const payload = isRegister ? { username, password, role } : { username, password };
      const res = await api.post(endpoint, payload);
      login(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    }
  };

  return (
    <div className="login-page">
      <form className="login-box" onSubmit={handleSubmit}>
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
