import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SpeechReader from '../components/SpeechReader';
import API_URL from '../config';

export default function Register() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentId, setStudentId] = useState(''); // ← ADD THIS
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Student');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, studentId, email, password, role }), // ← ADD studentId
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');
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
          <h1 style={styles.title}>Create Account</h1>
          <p style={styles.subtitle} id="register-desc">Join MySignInApp</p>

          {error && (
            <div role="alert" aria-live="assertive" style={styles.errorMessage}>
              {error}
            </div>
          )}

          <form
            onSubmit={handleRegister}
            style={styles.form}
            aria-label="Registration form"
            aria-describedby="register-desc"
            noValidate
          >
            <div style={styles.row}>
              <div style={styles.fieldGroup}>
                <label htmlFor="firstName" style={styles.label}>First Name</label>
                <input
                  id="firstName"
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                  style={styles.input}
                />
              </div>
              <div style={styles.fieldGroup}>
                <label htmlFor="lastName" style={styles.label}>Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                  style={styles.input}
                />
              </div>
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
              </select>
            </div>

            {/* ── ADD THIS BLOCK ── */}
            {role === 'Student' && (
              <div style={styles.fieldGroup}>
                <label htmlFor="studentId" style={styles.label}>Student ID (6–15 digits)</label>
                <input
                  id="studentId"
                  type="text"
                  placeholder="e.g. 672001"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  required
                  maxLength={15}
                  style={styles.input}
                />
              </div>
            )}

            <div style={styles.fieldGroup}>
              <label htmlFor="email" style={styles.label}>USIU Email</label>
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
                placeholder="Secure Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={styles.input}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              style={styles.button}
            >
              {isLoading ? 'Creating Account...' : 'Register'}
            </button>
          </form>

          <div style={styles.footer}>
            <button
              onClick={() => navigate('/')}
              style={styles.linkBtn}
              aria-label="Go to login page"
            >
              Already have an account? <strong>Log in here</strong>
            </button>
          </div>
        </main>
      </div>
    </>
  );
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f7f9' },
  card: { background: '#fff', padding: '2.5rem', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', width: '100%', maxWidth: '450px' },
  title: { textAlign: 'center', color: '#1a237e', marginBottom: '0.25rem', fontSize: '2rem', letterSpacing: '-0.5px' },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: '1.5rem', fontSize: '0.95rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  row: { display: 'flex', gap: '1rem' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 },
  label: { fontSize: '0.85rem', fontWeight: '600', color: '#444' },
  input: { padding: '0.75rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '1rem', background: '#fff', width: '100%', boxSizing: 'border-box' },
  button: { padding: '0.8rem', background: '#1a237e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1rem', cursor: 'pointer', fontWeight: '600', marginTop: '0.5rem' },
  errorMessage: { color: '#d32f2f', background: '#fdecea', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem', textAlign: 'center', marginBottom: '1rem', border: '1px solid #f5c2c7' },
  footer: { marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1rem', textAlign: 'center' },
  linkBtn: { background: 'transparent', border: 'none', color: '#1a237e', cursor: 'pointer', fontSize: '0.9rem' },
};