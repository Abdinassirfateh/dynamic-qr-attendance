import { useNavigate } from 'react-router-dom';

const courses = [
  { id: 1, name: 'Software Engineering', code: 'SWE3090', attendance: 85 },
  { id: 2, name: 'Database Systems', code: 'BIS3050', attendance: 72 },
  { id: 3, name: 'Web Development', code: 'BIS3020', attendance: 90 },
];

export default function StudentDashboard() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.headerText}>Student Portal</h2>
        <button aria-label="Logout" onClick={() => navigate('/')} style={styles.logout}>Logout</button>
      </header>

      <main style={styles.main}>
        <h3>Welcome, Fateh 👋</h3>
        <p style={{ color: '#666' }}>Select a course to mark attendance</p>

        <section aria-label="Enrolled courses">
          {courses.map(course => (
            <div key={course.id} style={styles.card}>
              <div>
                <strong>{course.name}</strong>
                <p style={styles.code}>{course.code}</p>
              </div>
              <div style={styles.right}>
                <span style={{ ...styles.badge, background: course.attendance >= 75 ? '#e8f5e9' : '#ffebee', color: course.attendance >= 75 ? '#2e7d32' : '#c62828' }}>
                  {course.attendance}%
                </span>
                <button aria-label={`Mark attendance for ${course.name}`} style={styles.button}>
                  Scan QR
                </button>
              </div>
            </div>
          ))}
        </section>

        <section aria-label="Attendance summary" style={styles.summary}>
          <h4>Attendance Summary</h4>
          <table style={styles.table} aria-label="Course attendance table">
            <thead>
              <tr style={styles.tableHeader}>
                <th>Course</th><th>Code</th><th>Attendance</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.id} style={styles.tableRow}>
                  <td>{c.name}</td>
                  <td>{c.code}</td>
                  <td>{c.attendance}%</td>
                  <td style={{ color: c.attendance >= 75 ? 'green' : 'red' }}>
                    {c.attendance >= 75 ? '✅ On Track' : '⚠️ At Risk'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
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
  right: { display: 'flex', alignItems: 'center', gap: '1rem' },
  badge: { padding: '0.3rem 0.75rem', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem' },
  button: { background: '#1a237e', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' },
  summary: { background: '#fff', padding: '1.5rem', borderRadius: '10px', marginTop: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '1rem' },
  tableHeader: { background: '#f5f5f5', textAlign: 'left' },
  tableRow: { borderBottom: '1px solid #eee' },
};
