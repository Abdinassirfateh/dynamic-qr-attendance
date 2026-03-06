import { useNavigate } from 'react-router-dom';

const users = [
  { id: 1, name: 'Fateh Abdinassir', role: 'Student', status: 'Active' },
  { id: 2, name: 'Prof. Okanda', role: 'Lecturer', status: 'Active' },
  { id: 3, name: 'Jane Mwangi', role: 'Student', status: 'Flagged' },
];

const alerts = [
  { id: 1, message: 'Suspicious scan detected — Jane Mwangi (SWE3090)', type: 'warning' },
  { id: 2, message: 'John Doe attendance below 75% — BIS3050', type: 'risk' },
];

export default function AdminPanel() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.headerText}>Admin Panel</h2>
        <button aria-label="Logout" onClick={() => navigate('/')} style={styles.logout}>Logout</button>
      </header>

      <main style={styles.main}>
        <h3>System Overview</h3>

        <div style={styles.statsRow}>
          <div style={styles.stat}><strong>6,700</strong><p>Total Students</p></div>
          <div style={styles.stat}><strong>124</strong><p>Active Sessions</p></div>
          <div style={styles.stat}><strong>2</strong><p>Active Alerts</p></div>
        </div>

        <section aria-label="System alerts" style={styles.section}>
          <h4>🔔 Alerts</h4>
          {alerts.map(alert => (
            <div key={alert.id} style={{ ...styles.alert, background: alert.type === 'warning' ? '#fff3e0' : '#ffebee' }}>
              {alert.message}
            </div>
          ))}
        </section>

        <section aria-label="User management" style={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4>👥 Users</h4>
            <button aria-label="Export attendance report" style={styles.exportBtn}>Export Report</button>
          </div>
          <table style={styles.table} aria-label="User management table">
            <thead>
              <tr style={styles.tableHeader}>
                <th>Name</th><th>Role</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={styles.tableRow}>
                  <td>{u.name}</td>
                  <td>{u.role}</td>
                  <td style={{ color: u.status === 'Active' ? 'green' : 'orange' }}>{u.status}</td>
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
  main: { padding: '2rem', maxWidth: '900px', margin: '0 auto' },
  statsRow: { display: 'flex', gap: '1rem', marginBottom: '1.5rem' },
  stat: { background: '#fff', flex: 1, padding: '1.25rem', borderRadius: '10px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' },
  section: { background: '#fff', padding: '1.5rem', borderRadius: '10px', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' },
  alert: { padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.9rem' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '1rem' },
  tableHeader: { background: '#f5f5f5', textAlign: 'left' },
  tableRow: { borderBottom: '1px solid #eee' },
  exportBtn: { background: '#1a237e', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' },
};
