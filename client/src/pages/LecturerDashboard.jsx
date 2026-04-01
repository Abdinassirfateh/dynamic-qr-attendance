import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import SpeechReader from '../components/SpeechReader';

const COURSE_CONFIG = {
  SWE3090: { name: 'Software Engineering Project', students: 45, days: [2,4], startHour:11, startMinute:0, endHour:12, endMinute:40 },
  APT1050: { name: 'Database Systems',             students: 38, days: [1,3], startHour:13, startMinute:0, endHour:15, endMinute:0  },
  APT3010: { name: 'Introduction to AI',           students: 50, days: [5],   startHour:8,  startMinute:0, endHour:11, endMinute:0  },
  SWE4060: { name: 'Project Management',           students: 40, days: [2,4], startHour:15, startMinute:30,endHour:17, endMinute:10 },
  APT3060: { name: 'Mobile Programming',           students: 35, days: [2,4], startHour:17, startMinute:30,endHour:19, endMinute:10 },
};

const TESTING_MODE = true;

const PlayIcon     = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'6px',verticalAlign:'middle'}} aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
const StopIcon     = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'6px',verticalAlign:'middle'}} aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>;
const ClockIcon    = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'6px',verticalAlign:'middle'}} aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'5px',verticalAlign:'middle'}} aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const PrintIcon    = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'5px',verticalAlign:'middle'}} aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;

export default function LecturerDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lecturerCourses, setLecturerCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [timeLeft, setTimeLeft] = useState(7);
  const [qrData, setQrData] = useState('');
  const [liveCount, setLiveCount] = useState(0);
  const [liveRecords, setLiveRecords] = useState([]);
  const [earlyMinutes, setEarlyMinutes] = useState({});
  const [lateMinutes, setLateMinutes] = useState({});
  const [sessionError, setSessionError] = useState('');
  const [exportingCourse, setExportingCourse] = useState(null);
  const [printingSession, setPrintingSession] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) { navigate('/'); return; }
    const parsed = JSON.parse(storedUser);
    if (parsed.role !== 'Lecturer' && parsed.role !== 'Admin') { navigate('/'); return; }
    setUser(parsed);
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchCourses = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/sessions/lecturer/courses', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const mapped = (data.courses || []).map((row, i) => {
          const cfg = COURSE_CONFIG[row.course_id];
          if (!cfg) return null;
          return { id: i+1, code: row.course_id, ...cfg };
        }).filter(Boolean);
        setLecturerCourses(mapped);
      } catch (err) { console.error(err); }
      finally { setLoadingCourses(false); }
    };
    fetchCourses();
  }, [user]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/sessions/lecturer/history', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok) setSessionHistory(data);
      } catch (err) { console.error(err); }
      finally { setLoadingHistory(false); }
    };
    fetchHistory();
  }, [activeTab]);

  useEffect(() => {
    let rotationInterval, countdownInterval;
    if (activeSession?.dbSessionId) {
      generateAndSaveToken(activeSession.code, activeSession.dbSessionId);
      rotationInterval = setInterval(() => { generateAndSaveToken(activeSession.code, activeSession.dbSessionId); setTimeLeft(7); }, 7000);
      countdownInterval = setInterval(() => setTimeLeft(prev => prev > 0 ? prev - 1 : 7), 1000);
    }
    return () => { clearInterval(rotationInterval); clearInterval(countdownInterval); };
  }, [activeSession]);

  useEffect(() => {
    let pollInterval;
    if (activeSession?.dbSessionId) {
      const fetchLive = async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`/api/sessions/attendance/${activeSession.dbSessionId}`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            setLiveCount(data.totalAttendance);
            setLiveRecords(data.records || []);
          }
        } catch (err) { console.error(err); }
      };
      fetchLive();
      pollInterval = setInterval(fetchLive, 10000);
    } else { setLiveCount(0); setLiveRecords([]); }
    return () => clearInterval(pollInterval);
  }, [activeSession]);

  const getLateAdjustment = code => lateMinutes[code] || 0;
  const changeAdjustment = (code, delta) => setEarlyMinutes(prev => ({ ...prev, [code]: Math.min(30, Math.max(0, (prev[code]||0)+delta)) }));
  const changeLateAdjustment = (code, delta) => setLateMinutes(prev => ({ ...prev, [code]: Math.min(30, Math.max(0, (prev[code]||0)+delta)) }));

  const handleStartSession = async (course) => {
    const now = new Date();
    if (!TESTING_MODE && !course.days.includes(now.getDay())) {
      setSessionError(`${course.code} does not run today.`); return;
    }
    const scheduledEnd = new Date();
    scheduledEnd.setHours(course.endHour, course.endMinute, 0, 0);
    const sessionDeadline = new Date(scheduledEnd.getTime() + (15 + getLateAdjustment(course.code)) * 60000);
    setSessionError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ courseId: course.code, sessionDeadline: sessionDeadline.toISOString() }),
      });
      const data = await res.json();
      if (res.ok) setActiveSession({ ...course, dbSessionId: data.session_id, sessionDeadline });
    } catch (err) { console.error(err); }
  };

  const generateAndSaveToken = async (courseCode, dbSessionId) => {
    const secureToken = `${crypto.randomUUID()}-${Date.now()}`;
    const qrPayload = JSON.stringify({ course: courseCode, token: secureToken, timestamp: Date.now() });
    setQrData(qrPayload);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/sessions/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId: dbSessionId, token: secureToken }),
      });
    } catch (err) { console.error(err); }
  };

  const handleEndSession = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/sessions/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId: activeSession.dbSessionId }),
      });
      setActiveSession(null);
    } catch (err) { console.error(err); }
  };

  const handleExportExcel = async (courseCode) => {
    setExportingCourse(courseCode);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/sessions/export/${courseCode}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const d = await res.json(); alert(d.error); return; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${courseCode}-Attendance-SS2026.xlsx`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch (err) { alert('Export failed: ' + err.message); }
    finally { setExportingCourse(null); }
  };

  const handlePrintPDF = async (sessionId, courseCode) => {
    setPrintingSession(sessionId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/sessions/attendance/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch attendance data');
      const data = await res.json();
      const sessionDate = data.records?.[0]?.marked_at
        ? new Date(data.records[0].marked_at).toLocaleDateString('en-KE', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
        : new Date().toLocaleDateString('en-KE', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
      const rows = (data.records || []).map((r, i) => `
        <tr>
          <td>${i+1}</td><td>${r.first_name} ${r.last_name}</td><td>${r.email}</td>
          <td style="color:#2e7d32;font-weight:bold">${r.status}</td>
          <td>${new Date(r.marked_at).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}</td>
        </tr>`).join('');
      const htmlContent = `<!DOCTYPE html><html><head>
        <title>Attendance Report — ${courseCode}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:2rem;color:#222}
          h2{color:#1a237e;margin-bottom:0.25rem}
          .meta{color:#666;font-size:0.9rem;margin-bottom:1.5rem}
          table{width:100%;border-collapse:collapse;margin-top:1rem}
          th{background:#1a237e;color:white;padding:0.6rem 0.8rem;text-align:left;font-size:0.85rem}
          td{padding:0.5rem 0.8rem;border-bottom:1px solid #eee;font-size:0.85rem}
          tr:nth-child(even){background:#f9f9f9}
          .footer{margin-top:2rem;font-size:0.8rem;color:#999;border-top:1px solid #eee;padding-top:1rem}
        </style>
      </head><body>
        <h2>Attendance Report — ${courseCode}</h2>
        <div class="meta"><strong>Session Date:</strong> ${sessionDate} &nbsp;|&nbsp; <strong>Total Present:</strong> ${data.totalAttendance || (data.records?.length ?? 0)}</div>
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Status</th><th>Time Marked</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">Generated by MySignInApp &nbsp;•&nbsp; USIU-A &nbsp;•&nbsp; ${new Date().toLocaleDateString('en-KE')}</div>
      </body></html>`;

      ['print-frame','print-close-btn','print-action-btn'].forEach(id => { const el = document.getElementById(id); if (el) document.body.removeChild(el); });
      const iframe = document.createElement('iframe');
      iframe.id = 'print-frame';
      iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:9999;background:white;';
      document.body.appendChild(iframe);
      iframe.contentDocument.open(); iframe.contentDocument.write(htmlContent); iframe.contentDocument.close();

      const closeBtn = document.createElement('button');
      closeBtn.id = 'print-close-btn'; closeBtn.textContent = '✕ Close';
      closeBtn.setAttribute('aria-label','Close print preview');
      closeBtn.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:10000;background:#d32f2f;color:white;border:none;padding:0.6rem 1.2rem;border-radius:6px;cursor:pointer;font-weight:bold;font-size:0.95rem;';
      closeBtn.onclick = () => ['print-frame','print-close-btn','print-action-btn'].forEach(id => { const el = document.getElementById(id); if (el) document.body.removeChild(el); });

      const printBtn = document.createElement('button');
      printBtn.id = 'print-action-btn'; printBtn.textContent = '🖨️ Print / Save PDF';
      printBtn.setAttribute('aria-label','Print or save as PDF');
      printBtn.style.cssText = 'position:fixed;top:1rem;right:9rem;z-index:10000;background:#1a237e;color:white;border:none;padding:0.6rem 1.2rem;border-radius:6px;cursor:pointer;font-weight:bold;font-size:0.95rem;';
      printBtn.onclick = () => iframe.contentWindow.print();
      document.body.appendChild(closeBtn); document.body.appendChild(printBtn);
    } catch (err) { alert('Print failed: ' + err.message); }
    finally { setPrintingSession(null); }
  };

  const handleLogout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/'); };
  if (!user) return null;

  return (
    <>
      <SpeechReader targetId="main-content" />
      <div style={styles.layout}>

        {/* ── SIDEBAR ── */}
        <aside style={styles.sidebar} role="complementary" aria-label="Lecturer navigation sidebar">
          <div style={styles.sidebarHeader}>
            <h2 style={styles.logo}>MySignInApp</h2>
          </div>
          <nav style={styles.nav} role="navigation" aria-label="Main navigation">
            <button style={activeTab==='dashboard' ? styles.activeNavLink : styles.navLink} onClick={() => setActiveTab('dashboard')} aria-current={activeTab==='dashboard'?'page':undefined}>Dashboard</button>
            <button style={activeTab==='history' ? styles.activeNavLink : styles.navLink} onClick={() => setActiveTab('history')} aria-current={activeTab==='history'?'page':undefined}>Session History</button>
          </nav>
          <div style={styles.sidebarFooter}>
            <div style={styles.profileBox}>
              <p style={{fontWeight:'bold',margin:0}}>Prof. {user.last_name}</p>
              <p style={{fontSize:'0.8rem',color:'#ccc',margin:0}}>Lecturer</p>
            </div>
            <button onClick={handleLogout} style={styles.logoutBtn} aria-label="Logout of MySignInApp">Logout</button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main id="main-content" style={styles.main} role="main" aria-label="Lecturer dashboard">
          <header style={styles.header}>
            <div style={{...styles.greetingBox, borderLeft:'5px solid #1a237e'}}>
              <h3 style={{margin:'0 0 0.5rem 0',color:'#333'}}>Welcome back, Prof. {user.last_name}.</h3>
              <p style={{color:'#666',margin:0}}>Manage your courses and live attendance sessions below.</p>
            </div>
          </header>

          {TESTING_MODE && (
            <div style={styles.testBanner} role="status">🧪 Testing Mode ON — time restrictions disabled.</div>
          )}

          {activeTab === 'dashboard' && (
            <>
              {activeSession ? (
                <section style={styles.activeSessionCard} aria-label={`Live session: ${activeSession.code}`}>
                  <div style={styles.sessionHeader}>
                    <div>
                      <span style={styles.liveBadge} role="status"><ClockIcon /> LIVE SESSION</span>
                      <h4 style={{margin:'0.5rem 0 0',fontSize:'1.2rem',color:'#222'}}>{activeSession.code}: {activeSession.name}</h4>
                    </div>
                    <div style={{display:'flex',gap:'0.75rem'}}>
                      <button onClick={() => handleExportExcel(activeSession.code)} style={{...styles.exportBtn,background:'#2e7d32'}} aria-label={`Export Excel for ${activeSession.code}`}>
                        <DownloadIcon/>{exportingCourse===activeSession.code?'Exporting...':'Export Excel'}
                      </button>
                      <button onClick={handleEndSession} style={styles.endButton} aria-label={`End session for ${activeSession.code}`}>
                        <StopIcon/> End Session
                      </button>
                    </div>
                  </div>
                  <div style={styles.sessionBody}>
                    <div style={styles.qrContainer} role="region" aria-label="Live QR code">
                      <div style={styles.qrBox}>
                        <QRCodeSVG value={qrData} size={200} bgColor="#ffffff" fgColor="#1a237e" level="Q" aria-hidden="true"/>
                      </div>
                      <p style={styles.timerText} aria-live="polite" aria-atomic="true">
                        Rotates in <strong style={{color:'#1a237e',fontSize:'1.2rem'}}>{timeLeft}s</strong>
                      </p>
                      <p style={{fontSize:'0.85rem',color:'#666',margin:'0 0 0.5rem'}}>Dynamic encryption enabled</p>
                      {activeSession.sessionDeadline && (
                        <p style={{fontSize:'0.9rem',fontWeight:'600',margin:0,color:new Date()>new Date(activeSession.sessionDeadline)?'#d32f2f':'#2e7d32'}}>
                          🕐 Closes at {new Date(activeSession.sessionDeadline).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}
                        </p>
                      )}
                    </div>
                    <div style={styles.statsContainer}>
                      <div style={styles.statBox}>
                        <p style={{margin:0,color:'#666',fontWeight:'600'}}>Live Attendance</p>
                        <h2 style={{margin:'0.5rem 0 0',color:'#1a237e',fontSize:'2.5rem'}} aria-live="polite" aria-label={`${liveCount} of ${activeSession.students} students present`}>
                          {liveCount} / {activeSession.students}
                        </h2>
                        <p style={{margin:0,fontSize:'0.85rem',color:'#888'}}>Students Present</p>
                      </div>
                      {liveRecords.length > 0 && (
                        <div style={{background:'#f8f9fa',borderRadius:'8px',padding:'1rem',border:'1px solid #eceff1',maxHeight:'220px',overflowY:'auto'}} role="region" aria-label="Recent sign-ins">
                          <p style={{margin:'0 0 0.5rem',fontWeight:'600',color:'#333',fontSize:'0.85rem'}}>Recent Sign-ins</p>
                          {liveRecords.slice(-5).reverse().map((r,i) => (
                            <div key={i} style={{fontSize:'0.8rem',padding:'0.3rem 0',borderBottom:'1px solid #eee',display:'flex',justifyContent:'space-between'}}>
                              <span>{r.first_name} {r.last_name}</span>
                              <span style={{color:'#2e7d32',fontWeight:'600'}}>{new Date(r.marked_at).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              ) : (
                <section style={styles.courseGrid} aria-label="My courses">
                  <h4 style={{margin:'0 0 1rem 0',color:'#333'}}>My Courses</h4>
                  {sessionError && (
                    <div role="alert" style={styles.errorBanner}>
                      ⚠️ {sessionError}
                      <button onClick={()=>setSessionError('')} style={styles.dismissError} aria-label="Dismiss error">✕</button>
                    </div>
                  )}
                  {loadingCourses ? <p>Loading your courses...</p> : lecturerCourses.length === 0 ? <p>No courses assigned yet.</p> : (
                    lecturerCourses.map(course => {
                      const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                      const validDays = course.days.map(d=>dayNames[d]).join(' & ');
                      const adj = earlyMinutes[course.code] || 0;
                      const lateAdj = getLateAdjustment(course.code);
                      return (
                        <div key={course.id} style={styles.card}>
                          <div>
                            <strong style={{fontSize:'1.1rem',color:'#222'}}>{course.name}</strong>
                            <p style={styles.code}>{course.code} • {course.students} Enrolled</p>
                            <p style={{fontSize:'0.8rem',color:'#888',margin:'0.25rem 0 0'}}>
                              📅 {validDays} &nbsp;•&nbsp; 🕐 {course.startHour}:{String(course.startMinute).padStart(2,'0')} – {course.endHour}:{String(course.endMinute).padStart(2,'0')}
                            </p>
                          </div>
                          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'0.5rem'}}>
                            <div style={styles.adjusterRow}>
                              <span style={styles.adjusterLabel}>Start early:</span>
                              <button style={styles.adjBtn} onClick={()=>changeAdjustment(course.code,-5)} aria-label={`Decrease early start for ${course.code}`}>−</button>
                              <span style={styles.adjValue} aria-live="polite">{adj} min</span>
                              <button style={styles.adjBtn} onClick={()=>changeAdjustment(course.code,5)} aria-label={`Increase early start for ${course.code}`}>+</button>
                            </div>
                            <div style={styles.adjusterRow}>
                              <span style={styles.adjusterLabel}>End late:</span>
                              <button style={styles.adjBtn} onClick={()=>changeLateAdjustment(course.code,-5)} aria-label={`Decrease late end for ${course.code}`}>−</button>
                              <span style={styles.adjValue} aria-live="polite">{lateAdj} min</span>
                              <button style={styles.adjBtn} onClick={()=>changeLateAdjustment(course.code,5)} aria-label={`Increase late end for ${course.code}`}>+</button>
                            </div>
                            <div style={{display:'flex',gap:'0.5rem'}}>
                              <button style={{...styles.exportBtn,background:'#2e7d32',padding:'0.5rem 0.8rem',fontSize:'0.8rem'}} onClick={()=>handleExportExcel(course.code)} aria-label={`Export Excel for ${course.code}`}>
                                <DownloadIcon/>{exportingCourse===course.code?'...':'Excel'}
                              </button>
                              <button style={styles.startBtn} onClick={()=>handleStartSession(course)} aria-label={`Start session for ${course.code}: ${course.name}`}>
                                <PlayIcon/> Start Session
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </section>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <section style={styles.section} aria-label="Session history">
              <h4 style={{margin:'0 0 1rem',color:'#333'}}>Session History</h4>
              {loadingHistory ? <p>Loading...</p> : sessionHistory.length === 0 ? <p>No closed sessions yet.</p> : (
                <table style={styles.table} aria-label="Past sessions">
                  <thead>
                    <tr style={styles.tableHeader}>
                      <th style={styles.th} scope="col">Course</th>
                      <th style={styles.th} scope="col">Date</th>
                      <th style={styles.th} scope="col">Time</th>
                      <th style={styles.th} scope="col">Present</th>
                      <th style={styles.th} scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionHistory.map(s => (
                      <tr key={s.session_id} style={styles.tableRow}>
                        <td style={styles.td}><strong>{s.course_id}</strong><br/><span style={{fontSize:'0.8rem',color:'#888'}}>{s.course_name}</span></td>
                        <td style={styles.td}>{new Date(s.start_time).toLocaleDateString('en-KE',{weekday:'short',day:'numeric',month:'short'})}</td>
                        <td style={styles.td}>
                          {new Date(s.start_time).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})} – {s.end_time ? new Date(s.end_time).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'}) : '—'}
                        </td>
                        <td style={styles.td}>
                          <span style={{background:'#e8f5e9',color:'#2e7d32',padding:'0.3rem 0.6rem',borderRadius:'4px',fontWeight:'bold'}}>{s.attendance_count} students</span>
                        </td>
                        <td style={styles.td}>
                          <div style={{display:'flex',gap:'0.5rem'}}>
                            <button onClick={()=>handlePrintPDF(s.session_id,s.course_id)} style={{...styles.exportBtn,background:'#7b1fa2',padding:'0.4rem 0.7rem',fontSize:'0.8rem'}} aria-label={`Print PDF for ${s.course_id}`}>
                              <PrintIcon/>{printingSession===s.session_id?'Loading...':'Print PDF'}
                            </button>
                            <button onClick={()=>handleExportExcel(s.course_id)} style={{...styles.exportBtn,padding:'0.4rem 0.7rem',fontSize:'0.8rem'}} aria-label={`Export Excel for ${s.course_id}`}>
                              <DownloadIcon/>{exportingCourse===s.course_id?'...':'Excel'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
  header:{marginBottom:'2rem'},
  greetingBox:{background:'#fff',padding:'1.5rem',borderRadius:'8px',boxShadow:'0 2px 10px rgba(0,0,0,0.03)'},
  testBanner:{background:'#fff8e1',border:'1px solid #ffc107',color:'#f57f17',padding:'0.6rem 1rem',borderRadius:'8px',marginBottom:'1rem',fontSize:'0.85rem',fontWeight:'600'},
  courseGrid:{display:'flex',flexDirection:'column',gap:'1rem'},
  section:{background:'#fff',padding:'1.5rem',borderRadius:'8px',boxShadow:'0 2px 10px rgba(0,0,0,0.03)'},
  card:{background:'#fff',padding:'1.5rem',borderRadius:'8px',display:'flex',justifyContent:'space-between',alignItems:'center',boxShadow:'0 2px 10px rgba(0,0,0,0.03)'},
  code:{color:'#666',fontSize:'0.9rem',margin:'0.3rem 0 0'},
  startBtn:{background:'#1a237e',color:'#fff',border:'none',padding:'0.6rem 1.2rem',borderRadius:'6px',cursor:'pointer',fontWeight:'600',fontSize:'0.9rem',display:'flex',alignItems:'center'},
  exportBtn:{background:'#1a237e',color:'#fff',border:'none',padding:'0.6rem 1rem',borderRadius:'6px',cursor:'pointer',fontWeight:'600',fontSize:'0.85rem',display:'flex',alignItems:'center'},
  activeSessionCard:{background:'#fff',padding:'2rem',borderRadius:'8px',boxShadow:'0 4px 15px rgba(0,0,0,0.05)'},
  sessionHeader:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:'1px solid #eee',paddingBottom:'1.5rem',marginBottom:'1.5rem'},
  liveBadge:{background:'#ffebee',color:'#c62828',padding:'0.4rem 0.8rem',borderRadius:'4px',fontSize:'0.85rem',fontWeight:'bold',border:'1px solid #ffcdd2',display:'inline-flex',alignItems:'center'},
  endButton:{background:'#d32f2f',color:'#fff',border:'none',padding:'0.6rem 1.2rem',borderRadius:'6px',cursor:'pointer',fontWeight:'600',display:'flex',alignItems:'center'},
  sessionBody:{display:'flex',gap:'2rem',flexWrap:'wrap'},
  qrContainer:{flex:'2 1 300px',textAlign:'center',padding:'2rem',border:'2px dashed #cfd8dc',borderRadius:'8px',background:'#f8f9fa'},
  qrBox:{background:'#fff',padding:'1rem',display:'inline-block',borderRadius:'8px',boxShadow:'0 2px 10px rgba(0,0,0,0.05)',marginBottom:'1rem'},
  timerText:{fontSize:'1.1rem',margin:'0 0 0.5rem 0',color:'#333'},
  statsContainer:{flex:'1 1 200px',display:'flex',flexDirection:'column',gap:'1rem'},
  statBox:{background:'#f8f9fa',padding:'2rem',borderRadius:'8px',textAlign:'center',border:'1px solid #eceff1',display:'flex',flexDirection:'column',justifyContent:'center'},
  errorBanner:{background:'#fff3e0',border:'1px solid #ff9800',color:'#e65100',padding:'1rem',borderRadius:'8px',marginBottom:'0.5rem',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'0.9rem',width:'100%',boxSizing:'border-box'},
  dismissError:{background:'transparent',border:'none',color:'#e65100',cursor:'pointer',fontSize:'1rem',fontWeight:'bold'},
  adjusterRow:{display:'flex',alignItems:'center',gap:'0.4rem',background:'#f0f4f8',padding:'0.3rem 0.6rem',borderRadius:'6px'},
  adjusterLabel:{fontSize:'0.75rem',color:'#666'},
  adjBtn:{background:'#1a237e',color:'#fff',border:'none',width:'24px',height:'24px',borderRadius:'4px',cursor:'pointer',fontWeight:'bold',fontSize:'1rem',display:'flex',alignItems:'center',justifyContent:'center'},
  adjValue:{fontSize:'0.85rem',fontWeight:'600',color:'#333',minWidth:'40px',textAlign:'center'},
  table:{width:'100%',borderCollapse:'collapse'},
  tableHeader:{borderBottom:'2px solid #eee'},
  th:{textAlign:'left',padding:'1rem 0.5rem',color:'#666',fontWeight:'600',fontSize:'0.9rem'},
  tableRow:{borderBottom:'1px solid #eee'},
  td:{padding:'0.8rem 0.5rem',color:'#333',fontSize:'0.9rem'},
};