import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SpeechReader from '../components/SpeechReader';
import API_URL from '../config';

const AlertTriangle = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'8px',verticalAlign:'middle'}} aria-hidden="true">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

export default function AdminPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({ totalStudents:0, activeSessions:0, activeAlerts:0 });
  const [alerts, setAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', password:'', role:'Lecturer', studentId:'' });

  const token = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_URL}/api/sessions/admin/stats`, { headers: authHeader });
        if (res.ok) { const d = await res.json(); setStats(d); }
      } catch (err) { console.error(err); } finally { setLoadingStats(false); }
    };
    const fetchAlerts = async () => {
      try {
        const res = await fetch(`${API_URL}/api/sessions/anomalies/all`, { headers: authHeader });
        if (res.ok) { const d = await res.json(); setAlerts(d); }
      } catch (err) { console.error(err); } finally { setLoadingAlerts(false); }
    };
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/admin/users`, { headers: authHeader });
        if (res.ok) { const d = await res.json(); setUsers(d.users || []); }
      } catch (err) { console.error(err); } finally { setLoadingUsers(false); }
    };
    fetchStats(); fetchAlerts(); fetchUsers();
  }, []);

  const handleChange = e => setForm(prev => ({...prev, [e.target.name]: e.target.value}));

  const handleCreateUser = async (e) => {
    e.preventDefault(); setSaving(true); setFormError(''); setFormSuccess('');
    try {
      const payload = { firstName:form.firstName.trim(), lastName:form.lastName.trim(), email:form.email.trim(), password:form.password, role:form.role };
      if (form.role === 'Student') payload.studentId = form.studentId.trim();
      const res = await fetch(`${API_URL}/api/auth/admin/create-user`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', ...authHeader },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      setUsers(prev => [{...data.user, status:'Active'}, ...prev]);
      setStats(prev => ({...prev, totalStudents: form.role==='Student' ? prev.totalStudents+1 : prev.totalStudents}));
      setFormSuccess(`✅ ${data.user.first_name} ${data.user.last_name} created successfully.`);
      setForm({ firstName:'', lastName:'', email:'', password:'', role:'Lecturer', studentId:'' });
      setShowModal(false);
    } catch (err) { setFormError(err.message); }
    finally { setSaving(false); }
  };

  // ── DELETE USER ──────────────────────────────────────────────────
  const handleDeleteUser = async (userId, fullName, role) => {
    setDeleteError('');
    if (!window.confirm(`Are you sure you want to delete ${fullName}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/auth/admin/delete-user/${userId}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');
      // Remove from list instantly
      setUsers(prev => prev.filter(u => u.user_id !== userId));
      // Update student count if needed
      if (role === 'Student') {
        setStats(prev => ({...prev, totalStudents: Math.max(0, prev.totalStudents - 1)}));
      }
      setFormSuccess(`🗑️ ${fullName} has been deleted.`);
    } catch (err) {
      setDeleteError(err.message);
    }
  };
  // ────────────────────────────────────────────────────────────────

  return (
    <>
      <SpeechReader targetId="main-content" />
      <div style={styles.layout}>

        {/* ── SIDEBAR ── */}
        <aside style={styles.sidebar} role="complementary" aria-label="Admin navigation sidebar">
          <div style={styles.sidebarHeader}><h2 style={styles.logo}>MySignInApp</h2></div>
          <nav style={styles.nav} role="navigation" aria-label="Admin navigation">
            <button style={activeTab==='overview'?styles.activeNavLink:styles.navLink} onClick={()=>setActiveTab('overview')} aria-current={activeTab==='overview'?'page':undefined}>Overview</button>
            <button style={activeTab==='alerts'?styles.activeNavLink:styles.navLink} onClick={()=>setActiveTab('alerts')} aria-current={activeTab==='alerts'?'page':undefined}>Security Alerts</button>
            <button style={activeTab==='users'?styles.activeNavLink:styles.navLink} onClick={()=>setActiveTab('users')} aria-current={activeTab==='users'?'page':undefined}>User Management</button>
          </nav>
          <div style={styles.sidebarFooter}>
            <div style={styles.profileBox}>
              <p style={{fontWeight:'bold',margin:0}}>System Admin</p>
              <p style={{fontSize:'0.8rem',color:'#ccc',margin:0}}>Administrator</p>
            </div>
            <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/'); }} style={styles.logoutBtn} aria-label="Logout of MySignInApp">Logout</button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main id="main-content" style={styles.main} role="main" aria-label="Admin panel">
          <header style={styles.header}>
            <div style={{...styles.greetingBox, borderLeft:'5px solid #0288d1'}}>
              <h3 style={{margin:'0 0 0.5rem',color:'#333'}}>System Administration</h3>
              <p style={{color:'#666',margin:0}}>Monitoring attendance integrity and campus anomalies.</p>
            </div>
          </header>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <>
              <div style={styles.statsRow} role="region" aria-label="System statistics">
                <div style={styles.stat}>
                  <strong style={styles.statNumber} aria-label={`Total students: ${loadingStats?'loading':stats.totalStudents}`}>{loadingStats?'...':stats.totalStudents}</strong>
                  <p style={styles.statLabel}>Total Students</p>
                </div>
                <div style={styles.stat}>
                  <strong style={styles.statNumber} aria-label={`Active sessions: ${loadingStats?'loading':stats.activeSessions}`}>{loadingStats?'...':stats.activeSessions}</strong>
                  <p style={styles.statLabel}>Active Sessions</p>
                </div>
                <div style={styles.stat}>
                  <strong style={{...styles.statNumber, color:stats.activeAlerts>0?'#d32f2f':'#2e7d32'}} aria-label={`Active alerts: ${loadingStats?'loading':stats.activeAlerts}`}>{loadingStats?'...':stats.activeAlerts}</strong>
                  <p style={styles.statLabel}>Alerts (Last 7 Days)</p>
                </div>
              </div>
              <section style={styles.section} aria-label="Recent security flags">
                <h4 style={{margin:'0 0 1rem',color:'#333'}}>Recent Security Flags</h4>
                {loadingAlerts ? <p>Loading alerts...</p> : alerts.length === 0 ? (
                  <p style={{color:'#2e7d32',fontWeight:'600'}} role="status">✅ No anomalies detected. System is clean.</p>
                ) : (
                  alerts.slice(0,5).map((alert,i) => (
                    <div key={i} role="alert" style={{...styles.alertRow, borderLeft:'4px solid #d32f2f', background:'#fff5f5'}}>
                      <div style={{display:'flex',alignItems:'flex-start'}}>
                        <AlertTriangle/>
                        <div>
                          <span style={{fontWeight:'600',color:'#333',fontSize:'0.9rem'}}>{alert.flag_reason}</span>
                          <p style={{margin:'0.2rem 0 0',fontSize:'0.8rem',color:'#888'}}>
                            Student: {alert.first_name?`${alert.first_name} ${alert.last_name}`:alert.attempted_student_id} &nbsp;|&nbsp; {new Date(alert.created_at).toLocaleString('en-KE')}
                          </p>
                        </div>
                      </div>
                      <span style={{fontSize:'0.75rem',color:'#d32f2f',fontWeight:'bold',whiteSpace:'nowrap'}}>HIGH</span>
                    </div>
                  ))
                )}
                {alerts.length > 5 && (
                  <button style={{background:'none',border:'none',color:'#666',fontSize:'0.85rem',marginTop:'0.5rem',cursor:'pointer',textDecoration:'underline',padding:0}} onClick={()=>setActiveTab('alerts')} aria-label={`View all ${alerts.length} security alerts`}>
                    View all {alerts.length} alerts →
                  </button>
                )}
              </section>
            </>
          )}

          {/* ── SECURITY ALERTS TAB ── */}
          {activeTab === 'alerts' && (
            <section style={styles.section} aria-label="All security alerts">
              <h4 style={{margin:'0 0 1rem',color:'#333'}}>All Security Alerts</h4>
              {loadingAlerts ? <p>Loading...</p> : alerts.length === 0 ? (
                <p style={{color:'#2e7d32',fontWeight:'600'}} role="status">✅ No anomalies detected.</p>
              ) : (
                <table style={styles.table} aria-label="Security alerts table">
                  <thead>
                    <tr style={styles.tableHeader}>
                      <th style={styles.th} scope="col">Flag Reason</th>
                      <th style={styles.th} scope="col">Student</th>
                      <th style={styles.th} scope="col">Device ID</th>
                      <th style={styles.th} scope="col">Date & Time</th>
                      <th style={styles.th} scope="col">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert,i) => (
                      <tr key={i} style={styles.tableRow}>
                        <td style={styles.td}><span style={{color:'#d32f2f',fontWeight:'600',fontSize:'0.85rem'}}>{alert.flag_reason}</span></td>
                        <td style={styles.td}>{alert.first_name?`${alert.first_name} ${alert.last_name}`:'—'}<br/><span style={{fontSize:'0.75rem',color:'#888'}}>{alert.email||''}</span></td>
                        <td style={styles.td}><span style={{fontSize:'0.75rem',color:'#666',wordBreak:'break-all'}}>{alert.device_id?.substring(0,20)}...</span></td>
                        <td style={styles.td}>{new Date(alert.created_at).toLocaleString('en-KE')}</td>
                        <td style={styles.td}><span style={{background:'#ffebee',color:'#d32f2f',padding:'0.2rem 0.5rem',borderRadius:'4px',fontSize:'0.8rem',fontWeight:'bold'}}>HIGH</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {/* ── USER MANAGEMENT TAB ── */}
          {activeTab === 'users' && (
            <section style={styles.section} aria-label="User management">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
                <h4 style={{margin:0,color:'#333'}}>System Users ({users.length})</h4>
                <button onClick={()=>{ setShowModal(true); setFormError(''); setFormSuccess(''); setDeleteError(''); }} style={{...styles.exportBtn,background:'#2e7d32'}} aria-label="Add new user to the system">+ Add User</button>
              </div>

              {/* Success / Error banners */}
              {formSuccess && <p role="status" style={{color:'#2e7d32',marginBottom:'1rem',fontWeight:'600',background:'#e8f5e9',padding:'0.75rem',borderRadius:'6px'}}>{formSuccess}</p>}
              {deleteError && <p role="alert" style={{color:'#d32f2f',marginBottom:'1rem',fontWeight:'600',background:'#ffebee',padding:'0.75rem',borderRadius:'6px'}}>⚠️ {deleteError}</p>}

              {loadingUsers ? <p>Loading users...</p> : users.length === 0 ? <p style={{color:'#888'}}>No users found.</p> : (
                <table style={styles.table} aria-label="System users table">
                  <thead>
                    <tr style={styles.tableHeader}>
                      <th style={styles.th} scope="col">Name</th>
                      <th style={styles.th} scope="col">Email</th>
                      <th style={styles.th} scope="col">Role</th>
                      <th style={styles.th} scope="col">Status</th>
                                            <th style={styles.th} scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.user_id} style={styles.tableRow}>
                        <td style={styles.td}><strong>{u.first_name} {u.last_name}</strong></td>
                        <td style={styles.td}>{u.email}</td>
                        <td style={styles.td}>
                          <span style={{background:u.role==='Admin'?'#e3f2fd':u.role==='Lecturer'?'#fff8e1':'#f3e5f5', color:u.role==='Admin'?'#0288d1':u.role==='Lecturer'?'#f57f17':'#7b1fa2', padding:'0.2rem 0.6rem',borderRadius:'4px',fontSize:'0.8rem',fontWeight:'bold'}}>{u.role}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={{background:'#e8f5e9',color:'#2e7d32',padding:'0.3rem 0.6rem',borderRadius:'4px',fontSize:'0.8rem',fontWeight:'bold'}}>{u.status||'Active'}</span>
                        </td>
                        <td style={styles.td}>
                          <button
                            onClick={() => handleDeleteUser(u.user_id, `${u.first_name} ${u.last_name}`, u.role)}
                            aria-label={`Delete ${u.first_name} ${u.last_name}`}
                            style={styles.deleteBtn}
                          >
                            🗑 Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {/* ── ADD USER MODAL ── */}
          {showModal && (
            <div style={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="modal-title">
              <div style={styles.modalContent}>
                <h3 id="modal-title" style={{marginTop:0,color:'#333'}}>Create New User</h3>
                {formError && <p role="alert" style={{color:'#d32f2f',background:'#ffebee',padding:'0.5rem 0.75rem',borderRadius:'4px',margin:'0 0 1rem'}}>{formError}</p>}
                <form onSubmit={handleCreateUser} aria-label="Create new user form" noValidate>
                  {[['firstName','First Name','text'],['lastName','Last Name','text'],['email','Email','email'],['password','Password','password']].map(([name,label,type]) => (
                    <div key={name} style={styles.formRow}>
                      <label htmlFor={`field-${name}`} style={styles.label}>{label}</label>
                      <input id={`field-${name}`} type={type} name={name} value={form[name]} onChange={handleChange} style={styles.input} required autoComplete={name==='password'?'new-password':name==='email'?'email':'off'}/>
                    </div>
                  ))}
                  <div style={styles.formRow}>
                    <label htmlFor="field-role" style={styles.label}>Role</label>
                    <select id="field-role" name="role" value={form.role} onChange={handleChange} style={styles.input}>
                      <option value="Lecturer">Lecturer</option>
                      <option value="Student">Student</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                  {form.role === 'Student' && (
                    <div style={styles.formRow}>
                      <label htmlFor="field-studentId" style={styles.label}>Student ID (6 digits)</label>
                      <input id="field-studentId" type="text" name="studentId" value={form.studentId} onChange={handleChange} style={styles.input} placeholder="e.g. 672541" maxLength={6}/>
                    </div>
                  )}
                  <div style={{display:'flex',gap:'0.75rem',marginTop:'1.5rem'}}>
                    <button type="submit" disabled={saving} aria-busy={saving} style={{...styles.exportBtn,flex:1,justifyContent:'center',padding:'0.75rem',fontSize:'0.95rem'}}>
                      {saving?'Creating...':'Create User'}
                    </button>
                    <button type="button" onClick={()=>setShowModal(false)} style={{...styles.exportBtn,flex:1,justifyContent:'center',padding:'0.75rem',fontSize:'0.95rem',background:'#666'}} aria-label="Cancel and close modal">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

const styles = {
  layout:{display:'flex',minHeight:'100vh',background:'#f4f7f9',fontFamily:"'Inter',sans-serif"},
  sidebar:{width:'250px',background:'#0d1b2a',color:'#fff',display:'flex',flexDirection:'column',padding:'1.5rem'},
  sidebarHeader:{marginBottom:'2rem'},
  logo:{margin:0,fontSize:'1.4rem',borderBottom:'1px solid #ffffff20',paddingBottom:'1rem'},
  nav:{flex:1,display:'flex',flexDirection:'column',gap:'0.5rem'},
  navLink:{cursor:'pointer',opacity:0.7,margin:0,padding:'0.75rem 1rem',borderRadius:'6px',background:'none',border:'none',color:'#fff',textAlign:'left',width:'100%',fontSize:'1rem'},
  activeNavLink:{cursor:'pointer',fontWeight:'bold',margin:0,background:'#1b263b',padding:'0.75rem 1rem',borderRadius:'6px',border:'none',color:'#fff',textAlign:'left',width:'100%',fontSize:'1rem'},
  sidebarFooter:{borderTop:'1px solid #ffffff20',paddingTop:'1.5rem'},
  profileBox:{marginBottom:'1rem'},
  logoutBtn:{width:'100%',background:'transparent',border:'1px solid #ffffff50',color:'#fff',padding:'0.6rem',borderRadius:'6px',cursor:'pointer'},
  main:{flex:1,padding:'2rem',overflowY:'auto'},
  header:{marginBottom:'2rem'},
  greetingBox:{background:'#fff',padding:'1.5rem',borderRadius:'8px',boxShadow:'0 2px 10px rgba(0,0,0,0.03)'},
  statsRow:{display:'flex',gap:'1.5rem',marginBottom:'2rem',flexWrap:'wrap'},
  stat:{background:'#fff',padding:'1.5rem 2rem',borderRadius:'8px',boxShadow:'0 2px 10px rgba(0,0,0,0.03)',flex:'1 1 150px',textAlign:'center'},
  statNumber:{fontSize:'2.5rem',color:'#1a237e',display:'block'},
  statLabel:{margin:'0.5rem 0 0',color:'#666',fontSize:'0.9rem'},
  section:{background:'#fff',padding:'1.5rem',borderRadius:'8px',boxShadow:'0 2px 10px rgba(0,0,0,0.03)',marginBottom:'1.5rem'},
  alertRow:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'0.75rem 1rem',borderRadius:'6px',marginBottom:'0.5rem'},
  exportBtn:{background:'#1a237e',color:'#fff',border:'none',padding:'0.6rem 1rem',borderRadius:'6px',cursor:'pointer',fontWeight:'600',fontSize:'0.85rem',display:'flex',alignItems:'center'},
  deleteBtn:{background:'#d32f2f',color:'#fff',border:'none',padding:'0.3rem 0.75rem',borderRadius:'4px',fontSize:'0.8rem',fontWeight:'600',cursor:'pointer'},
  table:{width:'100%',borderCollapse:'collapse'},
  tableHeader:{borderBottom:'2px solid #eee'},
  th:{textAlign:'left',padding:'1rem 0.5rem',color:'#666',fontWeight:'600',fontSize:'0.9rem'},
  tableRow:{borderBottom:'1px solid #eee'},
  td:{padding:'0.8rem 0.5rem',color:'#333',fontSize:'0.9rem'},
  modalOverlay:{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',justifyContent:'center',alignItems:'center',zIndex:1000},
  modalContent:{background:'#fff',padding:'2rem',borderRadius:'8px',width:'90%',maxWidth:'420px',boxShadow:'0 10px 40px rgba(0,0,0,0.15)'},
  formRow:{marginBottom:'1rem'},
  label:{display:'block',fontSize:'0.85rem',fontWeight:'600',color:'#444',marginBottom:'0.3rem'},
  input:{width:'100%',padding:'0.7rem',borderRadius:'6px',border:'1px solid #ddd',fontSize:'0.95rem',boxSizing:'border-box'},
};