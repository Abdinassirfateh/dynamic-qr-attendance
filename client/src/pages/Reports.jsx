import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Reports() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/');
      return;
    }
    setUser(JSON.parse(storedUser));
    fetchData();
  }, [navigate]);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      const [sessionsRes, anomaliesRes] = await Promise.all([
        fetch('/api/sessions/history', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/sessions/anomalies/all', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (sessionsRes.ok) setSessions(await sessionsRes.json());
      if (anomaliesRes.ok) setAnomalies(await anomaliesRes.json());
    } catch (err) {
      console.error("Failed to fetch reports data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleString('en-KE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getDuration = (start, end) => {
    if (!start || !end) return '—';
    const diff = Math.round((new Date(end) - new Date(start)) / 60000);
    return `${diff} min`;
  };

  if (!user) return null;

  return (
    <div style={styles.layout}>
      {/* SIDEBAR */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.logo}>MySignInApp</h2>
        </div>
        <nav style={styles.nav}>
          <p style={styles.navLink} onClick={() => navigate('/lecturer')}>Dashboard</p>
          <p style={styles.navLink}>Sessions</p>
          <p style={styles.activeNavLink}>Reports</p>
        </nav>
        <div style={styles.sidebarFooter}>
          <div style={styles.profileBox}>
            <p style={{ fontWeight: 'bold', margin: 0 }}>Prof. {user.last_name}</p>
            <p style={{ fontSize: '0.8rem', color: '#ccc', margin: 0 }}>Lecturer</p>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={styles.main}>
        <header style={styles.header}>
          <div style={{ ...styles.greetingBox, borderLeft: '5px solid #1a237e' }}>
            <h3 style={{ margin: '0 0 0.25rem 0', color: '#333' }}>Reports</h3>
            <p style={{ color: '#666', margin: 0 }}>View session history and security alerts.</p>
          </div>
        </header>

        {/* SUMMARY STATS */}
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <strong style={styles.statNumber}>{sessions.length}</strong>
            <p style={styles.statLabel}>Total Sessions</p>
          </div>
          <div style={styles.statBox}>
            <strong style={styles.statNumber}>
              {sessions.reduce((acc, s) => acc + parseInt(s.attendance_count || 0), 0)}
            </strong>
            <p style={styles.statLabel}>Total Attendances</p>
          </div>
          <div style={{ ...styles.statBox, borderTop: '3px solid #d32f2f' }}>
            <strong style={{ ...styles.statNumber, color: '#d32f2f' }}>{anomalies.length}</strong>
            <p style={styles.statLabel}>Security Alerts</p>
          </div>
        </div>

        {/* TABS */}
        <div style={styles.tabRow}>
          <button
            style={activeTab === 'sessions' ? styles.activeTab : styles.tab}
            onClick={() => setActiveTab('sessions')}
          >
            Session History
          </button>
          <button
            style={activeTab === 'security' ? styles.activeTab : styles.tab}
            onClick={() => setActiveTab('security')}
          >
            🚨 Security Alerts {anomalies.length > 0 && (
              <span style={styles.badge}>{anomalies.length}</span>
            )}
          </button>
        </div>

        {loading ? (
          <p style={{ color: '#666', padding: '2rem' }}>Loading...</p>
        ) : activeTab === 'sessions' ? (

          /* SESSION HISTORY TAB */
          <div style={styles.tableCard}>
            {sessions.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
                No closed sessions yet.
              </p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.th}>Course</th>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Start Time</th>
                    <th style={styles.th}>End Time</th>
                    <th style={styles.th}>Duration</th>
                    <th style={styles.th}>Attended</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.session_id} style={styles.tableRow}>
                      <td style={styles.td}>
                        <strong>{session.course_id}</strong>
                      </td>
                      <td style={styles.td}>
                        {new Date(session.start_time).toLocaleDateString('en-KE', {
                          weekday: 'short', day: '2-digit', month: 'short'
                        })}
                      </td>
                      <td style={styles.td}>
                        {new Date(session.start_time).toLocaleTimeString('en-KE', {
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td style={styles.td}>
                        {session.end_time ? new Date(session.end_time).toLocaleTimeString('en-KE', {
                          hour: '2-digit', minute: '2-digit'
                        }) : '—'}
                      </td>
                      <td style={styles.td}>{getDuration(session.start_time, session.end_time)}</td>
                      <td style={styles.td}>
                        <span style={styles.countBadge}>{session.attendance_count} students</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        ) : (

          /* SECURITY ALERTS TAB */
          <div style={styles.tableCard}>
            {anomalies.length === 0 ? (
              <p style={{ color: '#2e7d32', textAlign: 'center', padding: '2rem' }}>
                ✅ No security alerts recorded.
              </p>
            ) : (
              anomalies.map((alert) => (
                <div key={alert.id} style={styles.alertRow}>
                  <div style={styles.alertLeft}>
                    <span style={styles.alertIcon}>🚨</span>
                    <div>
                      <p style={styles.alertReason}>{alert.flag_reason}</p>
                      <p style={styles.alertMeta}>
                        {alert.first_name ? `${alert.first_name} ${alert.last_name}` : 'Unknown Student'}
                        {alert.email ? ` • ${alert.email}` : ''}
                      </p>
                      <p style={styles.alertMeta}>
                        Device: {alert.device_id?.substring(0, 20)}...
                      </p>
                    </div>
                  </div>
                  <div style={styles.alertRight}>
                    <p style={styles.alertTime}>{formatDateTime(alert.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  layout: { display: 'flex', minHeight: '100vh', background: '#f4f7f9', fontFamily: "'Inter', sans-serif" },
  sidebar: { width: '250px', background: '#0d1b2a', color: '#fff', display: 'flex', flexDirection: 'column', padding: '1.5rem' },
  sidebarHeader: { marginBottom: '2rem' },
  logo: { margin: 0, fontSize: '1.4rem', borderBottom: '1px solid #ffffff20', paddingBottom: '1rem' },
  nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  navLink: { cursor: 'pointer', opacity: 0.7, margin: 0, padding: '0.75rem 1rem', borderRadius: '6px' },
  activeNavLink: { cursor: 'pointer', fontWeight: 'bold', margin: 0, background: '#1b263b', padding: '0.75rem 1rem', borderRadius: '6px' },
  sidebarFooter: { borderTop: '1px solid #ffffff20', paddingTop: '1.5rem' },
  profileBox: { marginBottom: '1rem' },
  logoutBtn: { width: '100%', background: 'transparent', border: '1px solid #ffffff50', color: '#fff', padding: '0.6rem', borderRadius: '6px', cursor: 'pointer' },
  main: { flex: 1, padding: '2rem', overflowY: 'auto' },
  header: { marginBottom: '1.5rem' },
  greetingBox: { background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' },
  statsRow: { display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  statBox: { background: '#fff', padding: '1.5rem', borderRadius: '8px', flex: '1 1 150px', textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', borderTop: '3px solid #1a237e' },
  statNumber: { fontSize: '2rem', color: '#1a237e', display: 'block' },
  statLabel: { color: '#666', margin: '0.25rem 0 0', fontSize: '0.85rem' },
  tabRow: { display: 'flex', gap: '0.5rem', marginBottom: '1rem' },
  tab: { padding: '0.6rem 1.2rem', borderRadius: '6px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '0.9rem', color: '#666' },
  activeTab: { padding: '0.6rem 1.2rem', borderRadius: '6px', border: '1px solid #1a237e', background: '#1a237e', cursor: 'pointer', fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' },
  badge: { background: '#d32f2f', color: '#fff', borderRadius: '10px', padding: '0.1rem 0.5rem', fontSize: '0.75rem', marginLeft: '0.5rem' },
  tableCard: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  tableHeader: { background: '#f8f9fa' },
  th: { padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#555', borderBottom: '1px solid #eee' },
  tableRow: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '1rem', fontSize: '0.9rem', color: '#333' },
  countBadge: { background: '#e8f5e9', color: '#2e7d32', padding: '0.3rem 0.8rem', borderRadius: '4px', fontWeight: '600', fontSize: '0.85rem' },
  alertRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1rem 1.5rem', borderBottom: '1px solid #fff5f5', background: '#fff5f5' },
  alertLeft: { display: 'flex', gap: '1rem', alignItems: 'flex-start' },
  alertIcon: { fontSize: '1.2rem', marginTop: '2px' },
  alertReason: { margin: '0 0 0.25rem', fontWeight: '600', color: '#c62828', fontSize: '0.9rem' },
  alertMeta: { margin: '0 0 0.2rem', color: '#666', fontSize: '0.8rem' },
  alertRight: { textAlign: 'right', minWidth: '120px' },
  alertTime: { margin: 0, fontSize: '0.8rem', color: '#888' },
};