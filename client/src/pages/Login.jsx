import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SpeechReader from '../components/SpeechReader';
import API_URL from '../config';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Student');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to login');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.user.role === 'Student') navigate('/student');
      else if (data.user.role === 'Lecturer') navigate('/lecturer');
      else navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SpeechReader targetId="main-content" />
      <div style={styles.container}>
        <main id="main-content" style={styles.card} role="main">
          <h1 style={styles.title}>MySignInApp</h1>
          <p style={styles.subtitle} id="login-desc">Sign in to continue</p>

          {error && (
            <div role="alert" aria-live="assertive" style={styles.errorMessage}>
              {error}
            </div>
          )}

          <form
            onSubmit={handleLogin}
            style={styles.form}
            aria-label="Login form"
            aria-describedby="login-desc"
            noValidate
          >
            <div style={styles.fieldGroup}>
              <label htmlFor="email" style={styles.label}>Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="USIU Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label htmlFor="password" style={styles.label}>Password</label>
              <input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label htmlFor="role" style={styles.label}>Role</label>
              <select
                id="role"
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={styles.input}
              >
                <option value="Student">Student</option>
                <option value="Lecturer">Lecturer</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              style={styles.button}
            >
              {isLoading ? 'Authenticating...' : 'Login'}
            </button>
          </form>

          <div style={styles.footer}>
            <button
              onClick={() => navigate('/register')}
              style={styles.linkBtn}
              aria-label="Go to registration page"
            >
              Need an account? <strong>Register here</strong>
            </button>
          </div>
        </main>
      </div>
    </>
  );
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f7f9' },
  card: { background: '#fff', padding: '2.5rem', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px' },
  title: { textAlign: 'center', color: '#1a237e', marginBottom: '0.25rem', fontSize: '2rem', letterSpacing: '-0.5px' },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: '1.5rem', fontSize: '0.95rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  label: { fontSize: '0.85rem', fontWeight: '600', color: '#444' },
  input: { padding: '0.75rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '1rem', background: '#fff' },
  button: { padding: '0.8rem', background: '#1a237e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1rem', cursor: 'pointer', fontWeight: '600' },
  errorMessage: { color: '#d32f2f', background: '#fdecea', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem', textAlign: 'center', marginBottom: '1rem', border: '1px solid #f5c2c7' },
  footer: { marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1rem', textAlign: 'center' },
  linkBtn: { background: 'transparent', border: 'none', color: '#1a237e', cursor: 'pointer', fontSize: '0.9rem' },
};