import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Scanner } from '@yudiel/react-qr-scanner';
import fpPromise from '@fingerprintjs/fingerprintjs';
import SpeechReader from '../components/SpeechReader';
import API_URL from '../config';

const weeklyAttendanceData = [
  { week:'Wk 1',  SWE3090:100, APT1050:50,  APT3010:67  },
  { week:'Wk 2',  SWE3090:83,  APT1050:33,  APT3010:67  },
  { week:'Wk 3',  SWE3090:100, APT1050:100, APT3010:100 },
  { week:'Wk 4',  SWE3090:83,  APT1050:100, APT3010:33  },
  { week:'Wk 5',  SWE3090:83,  APT1050:83,  APT3010:67  },
  { week:'Wk 6',  SWE3090:100, APT1050:100, APT3010:100 },
  { week:'Wk 7',  SWE3090:50,  APT1050:83,  APT3010:100 },
  { week:'Wk 8',  SWE3090:83,  APT1050:67,  APT3010:100 },
  { week:'Wk 9',  SWE3090:83,  APT1050:100, APT3010:100 },
  { week:'Wk 10', SWE3090:83,  APT1050:100, APT3010:67  },
  { week:'Wk 11', SWE3090:83,  APT1050:100, APT3010:67  },
  { week:'Wk 12', SWE3090:50,  APT1050:83,  APT3010:33  },
  { week:'Wk 13', SWE3090:67,  APT1050:33,  APT3010:100 },
  { week:'Wk 14', SWE3090:67,  APT1050:50,  APT3010:100 },
];

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'6px',verticalAlign:'middle'}} aria-hidden="true">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'6px',verticalAlign:'middle'}} aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const formatCountdown = (seconds) => {
  if (seconds <= 0) return 'Closed';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2,'0')} left`;
};

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeCourseToScan, setActiveCourseToScan] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [activeSessions, setActiveSessions] = useState({});
  const [countdowns, setCountdowns] = useState({});
  const countdownRef = useRef({});

  useEffect(() => {
    const getFingerprint = async () => {
      const fp = await fpPromise.load();
      const result = await fp.get();
      setDeviceId(result.visitorId);
    };
    getFingerprint();
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) { navigate('/'); return; }
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== 'Student') { navigate('/'); return; }
    setUser(parsedUser);
  }, [navigate]);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const token = localStorage.getItem('token');
        const [coursesRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/api/sessions/student/courses`,      { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/sessions/student/course-stats`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const coursesData = await coursesRes.json();
        const statsData   = statsRes.ok ? await statsRes.json() : [];
        const statsMap = {};
        statsData.forEach(s => {
          statsMap[s.course_id] = s.total_sessions > 0 ? Math.round((s.attended_sessions / s.total_sessions) * 100) : 100;
        });
        const mapped = coursesData.courses.map((row, i) => ({
          id: i+1, name: row.course_name, code: row.course_id, attendance: statsMap[row.course_id] ?? 100,
        }));
        setCourses(mapped);
      } catch (err) { console.error(err); }
      finally { setLoadingCourses(false); }
    };
    if (user) fetchCourses();
  }, [user]);

  useEffect(() => {
    if (activeTab !== 'history' || !user) return;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/sessions/student/history`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setAttendanceHistory(await res.json());
      } catch (err) { console.error(err); }
      finally { setLoadingHistory(false); }
    };
    fetchHistory();
  }, [activeTab, user]);

  useEffect(() => {
    const fetchActiveSessions = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/sessions/active`, { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) {
          const data = await response.json();
          const sessionMap = {};
          data.forEach(session => {
            sessionMap[session.course_id] = { sessionId: session.session_id, deadline: session.session_deadline ? new Date(session.session_deadline) : null };
          });
          setActiveSessions(sessionMap);
          const newCountdowns = {};
          data.forEach(session => {
            if (session.session_deadline) {
              const remaining = Math.round((new Date(session.session_deadline) - new Date()) / 1000);
              newCountdowns[session.course_id] = Math.max(0, remaining);
            }
          });
          countdownRef.current = newCountdowns;
          setCountdowns({...newCountdowns});
        }
      } catch (err) { console.error(err); }
    };
    fetchActiveSessions();
    const pollInterval = setInterval(fetchActiveSessions, 30000);
    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    const ticker = setInterval(() => {
      const updated = {};
      Object.keys(countdownRef.current).forEach(code => {
        updated[code] = Math.max(0, countdownRef.current[code] - 1);
      });
      countdownRef.current = updated;
      setCountdowns({...updated});
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  const isAtRisk = courses.some(c => c.attendance < 75);
  const averageAttendance = courses.length === 0 ? 0 : Math.round(courses.reduce((acc, curr) => acc + curr.attendance, 0) / courses.length);

  const openScanner = (courseCode) => {
    if (!deviceId) { alert('Security check loading... Please wait 2 seconds and try again.'); return; }
    if (!activeSessions[courseCode]) { alert(`No active session found for ${courseCode}.`); return; }
    const countdown = countdowns[courseCode];
    if (countdown !== undefined && countdown <= 0) { alert(`The session for ${courseCode} has closed.`); return; }
    setActiveCourseToScan(courseCode);
    setIsScanning(true);
    setScanResult(null);
    setScanError('');
  };

  const handleScan = async (scannedText) => {
    if (!scannedText || scanResult) return;
    try {
      const qrData = JSON.parse(scannedText);
      if (qrData.course !== activeCourseToScan) {
        setScanError(`You scanned a code for ${qrData.course}, but selected ${activeCourseToScan}.`);
        return;
      }
      setIsScanning(false);
      const response = await fetch(`${API_URL}/api/sessions/attend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ token: qrData.token, deviceId }),
      });
      const result = await response.json();
      if (!response.ok) setScanError(result.error);
      else setScanResult({ course: qrData.course, status: 'Attendance Logged Successfully!', token: qrData.token });
    } catch (err) { setScanError('Debug Error: ' + err.message); }
  };

  const handleLogout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/'); };
  if (!user) return null;

  const CourseCards = ({ fullWidth = false }) => (
    <section style={fullWidth ? {...styles.courseGrid, flex:'1 1 100%'} : styles.courseGrid} aria-label="Active courses">
      <h4 style={{margin:'0 0 0.5rem 0',color:'#333',width:'100%'}}>Active Courses</h4>
      {loadingCourses ? <p>Loading your courses...</p> : courses.length === 0 ? <p>You are not enrolled in any courses.</p> : courses.map(course => {
        const session = activeSessions[course.code];
        const countdown = countdowns[course.code];
        const hasActiveSession = !!session;
        const isExpired = countdown !== undefined && countdown <= 0;
        const isUrgent = countdown !== undefined && countdown > 0 && countdown <= 120;
        return (
          <div key={course.id} style={styles.card}>
            <div>
              <strong style={{fontSize:'1.1rem',color:'#222'}}>{course.name}</strong>
              <p style={styles.code}>{course.code}</p>
              {hasActiveSession && !isExpired && (
                <p style={{margin:'0.3rem 0 0',fontSize:'0.8rem',fontWeight:'600',color:isUrgent?'#d32f2f':'#2e7d32'}} aria-live="polite">
                  Session open — {formatCountdown(countdown)}
                </p>
              )}
              {hasActiveSession && isExpired && <p style={{margin:'0.3rem 0 0',fontSize:'0.8rem',color:'#d32f2f',fontWeight:'600'}}>Session closed</p>}
              {!hasActiveSession && <p style={{margin:'0.3rem 0 0',fontSize:'0.8rem',color:'#999'}}>No active session</p>}
            </div>
            <div style={styles.right}>
              <div
                style={{...styles.badge, background:course.attendance>=75?'#e8f5e9':'#ffebee', color:course.attendance>=75?'#2e7d32':'#d32f2f', border:course.attendance>=75?'1px solid #c8e6c9':'1px solid #ffcdd2'}}
                aria-label={`${course.code} attendance ${course.attendance}%`}
              >
                {course.attendance}% {course.attendance>=75?'On Track':'At Risk'}
              </div>
              <button
                aria-label={`Scan QR code for ${course.code}: ${course.name}`}
                onClick={() => openScanner(course.code)}
                disabled={!hasActiveSession || isExpired}
                style={{...styles.scanBtn, background:(!hasActiveSession||isExpired)?'#ccc':isUrgent?'#d32f2f':'#1a237e', cursor:(!hasActiveSession||isExpired)?'not-allowed':'pointer'}}
              >
                {!hasActiveSession ? 'No Session' : isExpired ? 'Closed' : 'Scan QR'}
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );

  return (
    <>
      <SpeechReader targetId="main-content" />
      <div style={styles.layout}>

        {/* ── SCANNER MODAL ── */}
        {isScanning && (
          <div style={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="scanner-title">
            <div style={styles.modalContent}>
              <h3 id="scanner-title" style={{margin:'0 0 0.5rem 0',color:'#1a237e'}}>Scanning for {activeCourseToScan}</h3>
              {countdowns[activeCourseToScan] !== undefined && (
                <p style={{margin:'0 0 1rem',fontWeight:'600',color:countdowns[activeCourseToScan]<=60?'#d32f2f':'#2e7d32',fontSize:'0.95rem'}} aria-live="polite" aria-atomic="true">
                  {formatCountdown(countdowns[activeCourseToScan])}
                </p>
              )}
              {scanError && <p role="alert" style={styles.errorText}>{scanError}</p>}
              <div style={styles.cameraContainer} aria-label="QR code camera scanner">
                <Scanner
                  onScan={detectedCodes => { if (detectedCodes?.length > 0) handleScan(detectedCodes[0].rawValue); }}
                  onError={err => console.log(err)}
                  options={{ delayBetweenScanAttempts: 300 }}
                />
              </div>
              <button onClick={() => setIsScanning(false)} style={styles.cancelBtn} aria-label="Cancel QR scan">Cancel Scan</button>
            </div>
          </div>
        )}

        {/* ── SIDEBAR ── */}
        <aside style={styles.sidebar} role="complementary" aria-label="Student navigation sidebar">
          <div style={styles.sidebarHeader}><h2 style={styles.logo}>MySignInApp</h2></div>
          <nav style={styles.nav} role="navigation" aria-label="Main navigation">
            <button style={activeTab==='dashboard'?styles.activeNavLink:styles.navLink} onClick={()=>setActiveTab('dashboard')} aria-current={activeTab==='dashboard'?'page':undefined}>Dashboard</button>
            <button style={activeTab==='courses'?styles.activeNavLink:styles.navLink} onClick={()=>setActiveTab('courses')} aria-current={activeTab==='courses'?'page':undefined}>My Courses</button>
            <button style={activeTab==='history'?styles.activeNavLink:styles.navLink} onClick={()=>setActiveTab('history')} aria-current={activeTab==='history'?'page':undefined}>History</button>
          </nav>
          <div style={styles.sidebarFooter}>
            <div style={styles.profileBox}>
              <p style={{fontWeight:'bold',margin:0}}>{user.first_name} {user.last_name}</p>
              <p style={{fontSize:'0.8rem',color:'#ccc',margin:0}}>Student</p>
              <p style={{fontSize:'0.6rem',color:'#888',margin:'5px 0 0 0',wordBreak:'break-all'}}>Device: {deviceId||'Loading...'}</p>
            </div>
            <button aria-label="Logout of MySignInApp" onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main id="main-content" style={styles.main} role="main" aria-label="Student dashboard">
          <header style={styles.header}>
            <div style={{...styles.greetingBox, borderLeft:isAtRisk?'5px solid #d32f2f':'5px solid #2e7d32'}}>
              <h3 style={{margin:'0 0 0.5rem 0',color:'#333'}}>Welcome back, {user.first_name}.</h3>
              {isAtRisk ? (
                <div role="alert" style={{display:'flex',alignItems:'center',color:'#d32f2f',fontWeight:'bold'}}>
                  <AlertIcon /><span>Action Required: Your attendance in one or more courses has fallen below the 75% threshold.</span>
                </div>
              ) : (
                <div role="status" style={{display:'flex',alignItems:'center',color:'#2e7d32',fontWeight:'bold'}}>
                  <CheckIcon /><span>Status Good: You are on track with an average of {averageAttendance}% attendance.</span>
                </div>
              )}
            </div>
          </header>

          {scanResult && (
            <div role="status" style={styles.successBanner}>
              <CheckIcon />
              <span style={{fontWeight:'bold',marginRight:'10px'}}>Successfully Scanned {scanResult.course}!</span>
              <span style={{fontSize:'0.9rem',opacity:0.8}}>Token: {scanResult.token.substring(0,15)}...</span>
              <button onClick={()=>setScanResult(null)} style={styles.dismissBtn} aria-label="Dismiss scan success message">Dismiss</button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div style={styles.topRow}>
              <section style={styles.chartCard} aria-label="Attendance trends line chart for 14 weeks">
                <h4 style={{margin:'0 0 1.5rem 0',color:'#333'}}>Attendance Trends (14 Weeks)</h4>
                <div style={{width:'100%',height:250}}>
                  <ResponsiveContainer>
                    <LineChart data={weeklyAttendanceData} margin={{top:5,right:20,bottom:5,left:0}}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee"/>
                      <XAxis dataKey="week" tick={{fill:'#666',fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:'#666',fontSize:12}} axisLine={false} tickLine={false} domain={[0,100]}/>
                      <Tooltip contentStyle={{borderRadius:'8px',border:'none',boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}/>
                      <Legend iconType="circle" wrapperStyle={{fontSize:'12px',paddingTop:'10px'}}/>
                      <Line type="monotone" dataKey="SWE3090" stroke="#1a237e" strokeWidth={3} dot={{r:3}} activeDot={{r:6}}/>
                      <Line type="monotone" dataKey="APT1050" stroke="#d32f2f" strokeWidth={3} dot={{r:3}} activeDot={{r:6}}/>
                      <Line type="monotone" dataKey="APT3010" stroke="#0288d1" strokeWidth={3} dot={{r:3}} activeDot={{r:6}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <CourseCards />
            </div>
          )}

          {activeTab === 'courses' && (
            <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
              <CourseCards fullWidth />
            </div>
          )}

          {activeTab === 'history' && (
            <section style={styles.historyCard} aria-label="My attendance history">
              <h4 style={{margin:'0 0 1.5rem',color:'#333'}}>My Attendance History</h4>
              {loadingHistory ? <p style={{color:'#666'}}>Loading your history...</p> : attendanceHistory.length === 0 ? (
                <p style={{color:'#888'}}>No attendance records found yet.</p>
              ) : (
                <div style={{overflowX:'auto'}}>
                  <table style={styles.table} aria-label="Attendance history records">
                    <thead>
                      <tr style={styles.tableHeader}>
                        <th style={styles.th} scope="col">#</th>
                        <th style={styles.th} scope="col">Course</th>
                        <th style={styles.th} scope="col">Session Date</th>
                        <th style={styles.th} scope="col">Time Marked</th>
                        <th style={styles.th} scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceHistory.map((r,i) => (
                        <tr key={i} style={{...styles.tableRow,background:i%2===0?'#fff':'#fafafa'}}>
                          <td style={styles.td}>{i+1}</td>
                          <td style={styles.td}><strong style={{color:'#1a237e'}}>{r.course_id}</strong><br/><span style={{fontSize:'0.8rem',color:'#888'}}>{r.course_name}</span></td>
                          <td style={styles.td}>{new Date(r.start_time).toLocaleDateString('en-KE',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</td>
                          <td style={styles.td}>{new Date(r.marked_at).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}</td>
                          <td style={styles.td}><span style={{background:'#e8f5e9',color:'#2e7d32',padding:'0.3rem 0.7rem',borderRadius:'4px',fontWeight:'bold',fontSize:'0.8rem'}}>✓ Present</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
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
  header:{marginBottom:'1.5rem'},
  greetingBox:{background:'#fff',padding:'1.5rem',borderRadius:'8px',boxShadow:'0 2px 10px rgba(0,0,0,0.03)'},
  topRow:{display:'flex',gap:'1.5rem',alignItems:'flex-start',flexWrap:'wrap'},
  chartCard:{background:'#fff',padding:'1.5rem',borderRadius:'8px',boxShadow:'0 2px 10px rgba(0,0,0,0.03)',flex:'2 1 400px'},
  courseGrid:{display:'flex',flexDirection:'column',gap:'0.75rem',flex:'1 1 280px'},
  card:{background:'#fff',padding:'1rem 1.25rem',borderRadius:'8px',display:'flex',justifyContent:'space-between',alignItems:'center',boxShadow:'0 2px 10px rgba(0,0,0,0.03)'},
  code:{color:'#666',fontSize:'0.85rem',margin:'0.2rem 0 0'},
  right:{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'0.5rem'},
  badge:{padding:'0.3rem 0.6rem',borderRadius:'4px',fontSize:'0.78rem',fontWeight:'bold'},
  scanBtn:{color:'#fff',border:'none',padding:'0.5rem 1rem',borderRadius:'6px',fontWeight:'600',fontSize:'0.85rem'},
  successBanner:{background:'#e8f5e9',border:'1px solid #c8e6c9',color:'#2e7d32',padding:'1rem 1.5rem',borderRadius:'8px',marginBottom:'1.5rem',display:'flex',alignItems:'center',gap:'0.5rem',flexWrap:'wrap'},
  dismissBtn:{marginLeft:'auto',background:'transparent',border:'none',color:'#2e7d32',cursor:'pointer',fontWeight:'bold',fontSize:'1rem'},
  historyCard:{background:'#fff',padding:'1.5rem',borderRadius:'8px',boxShadow:'0 2px 10px rgba(0,0,0,0.03)'},
  table:{width:'100%',borderCollapse:'collapse'},
  tableHeader:{borderBottom:'2px solid #eee'},
  th:{textAlign:'left',padding:'0.75rem 1rem',color:'#666',fontWeight:'600',fontSize:'0.85rem'},
  tableRow:{borderBottom:'1px solid #f0f0f0'},
  td:{padding:'0.75rem 1rem',color:'#333',fontSize:'0.9rem'},
  modalOverlay:{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',display:'flex',justifyContent:'center',alignItems:'center',zIndex:1000},
  modalContent:{background:'#fff',padding:'2rem',borderRadius:'12px',width:'90%',maxWidth:'380px',textAlign:'center',boxShadow:'0 10px 40px rgba(0,0,0,0.2)'},
  cameraContainer:{borderRadius:'8px',overflow:'hidden',marginBottom:'1rem'},
  cancelBtn:{background:'#d32f2f',color:'#fff',border:'none',padding:'0.75rem 2rem',borderRadius:'6px',cursor:'pointer',fontWeight:'600',fontSize:'0.95rem',width:'100%'},
  errorText:{color:'#d32f2f',background:'#ffebee',padding:'0.5rem 0.75rem',borderRadius:'6px',fontSize:'0.85rem',marginBottom:'0.75rem',textAlign:'left'},
};