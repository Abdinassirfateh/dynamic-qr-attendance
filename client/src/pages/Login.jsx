import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    const role = e.target.role.value;
    if (role === 'student') navigate('/student');
    else if (role === 'lecturer') navigate('/lecturer');
    else navigate('/admin');
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Welcome to MySignInUp</h1>
        <p style={styles.subtitle}>Sign in to continue</p>
        <form onSubmit={handleLogin} style={styles.form}>
          <input aria-label="Email address" type="email" placeholder="Email" required style={styles.input} />
          <input aria-label="Password" type="password" placeholder="Password" required style={styles.input} />
          <select name="role" aria-label="Select your role" style={styles.input}>
            <option value="student">Student</option>
            <option value="lecturer">Lecturer</option>
            <option value="admin">Administrator</option>
          </select>
          <button type="submit" style={styles.button}>Login</button>
        </form>
        <p style={styles.back} onClick={() => navigate('/')} role="button" aria-label="Go back to welcome page">← Back to Home</p>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8' },
  card: { background: '#fff', padding: '2.5rem', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' },
  title: { textAlign: 'center', color: '#1a237e', marginBottom: '0.25rem' },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: '1.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  input: { padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' },
  button: { padding: '0.75rem', background: '#1a237e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' },
  back: { textAlign: 'center', marginTop: '1rem', color: '#1a237e', cursor: 'pointer', fontSize: '0.9rem' },
};
