import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

const courses = [
  { id: 1, name: 'Software Engineering', code: 'SWE3090', students: 45 },
  { id: 2, name: 'Database Systems', code: 'BIS3050', students: 38 },
];

export default function LecturerDashboard() {
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState(null);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.headerText}>Lecturer Dashboard</h2>
        <button aria-label="Logout" onClick={() => navigate('/')} style={styles.logout}>Logout</button>
      </header>

      <main style={styles.main}>
        <h3>Welcome, Prof. Okanda 👋</h3>

        <section aria-label="Your courses">
          {courses.map(course => (
            <div key={course.id} style={styles.card}>
              <div>
                <strong>{course.name}</strong>
                <p style={styles.code}>{course.code} · {course.students} students</p>
              </div>
              <button
                aria-label={`Start attendance session for ${course.name}`}
                style={styles.button}
                onClick={() => setActiveSession(course)}
              >
                Start Session
              </button>
            </div>
          ))}
        </section>

        {activeSession && (
          <section aria-label="Active attendance session" style={styles.qrSection}>
            <h4>Active Session: {activeSession.name}</h4>
            <p style={{ color: '#666' }}>QR Code refreshes every 7 seconds</p>
            <div style={styles.qrBox} aria-label="QR Code display area">
              <p style={{ color: '#999', fontSize: '0.9rem' }}>[ QR Code Displays Here ]</p>
              <p style={{ fontSize: '1.5rem' }}>⬛⬛⬛</p>
              <p style={styles.timer}>Next refresh in: <strong>7s</strong></p>
            </div>
            <div style={styles.counter}>
              <span>Students Present: <strong>0 / {activeSession.students}</strong></span>
              <button aria-label="End session" onClick={() => setActiveSession(null)} style={styles.endButton}>End Session</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f0f4f8' },
  header: { background: '#1a237e', color: '#fff', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerText: { margin: 0, color: '#fff' },
  logout: { background: 'transparent', border: '1px solid #fff', color: '#fff', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer' },
  main: { padding: '2rem', maxWidth: '800px', margin: '0 auto' },
  card: { background: '#fff', padding: '1rem 1.5rem', borderRadius: '10px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' },
  code: { color: '#888', fontSize: '0.85rem', margin: '0.25rem 0 0' },
  button: { background: '#1a237e', color: '#fff', border: 'none', padding: '0.5rem 1.2rem', borderRadius: '6px', cursor: 'pointer' },
  qrSection: { background: '#fff', padding: '1.5rem', borderRadius: '10px', marginTop: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', textAlign: 'center' },
  qrBox: { border: '2px dashed #1a237e', borderRadius: '10px', padding: '2rem', margin: '1rem auto', maxWidth: '250px' },
  timer: { color: '#e53935', marginTop: '0.5rem' },
  counter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0 0.5rem' },
  endButton: { background: '#e53935', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' },
};
