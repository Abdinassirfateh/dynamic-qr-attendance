const express = require('express');
const pool = require('../db'); 
const XLSX = require('xlsx');
const jwt = require('jsonwebtoken');
const router = express.Router();

// JWT Authentication Middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// Role-based authorization middleware
const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role))
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    next();
  };
};

// 1. START A SESSION
router.post('/start', verifyToken, authorizeRole('Lecturer', 'Admin'), async (req, res) => {
  try {
    const { courseId, sessionDeadline } = req.body;
    const lecturerId = req.user.user_id;
    await pool.query(
      'INSERT INTO courses (course_id, course_name) VALUES ($1, $1) ON CONFLICT (course_id) DO NOTHING',
      [courseId]
    );
    const newSession = await pool.query(
      "INSERT INTO sessions (course_id, lecturer_id, status, session_deadline) VALUES ($1, $2, 'Active', $3) RETURNING *",
      [courseId, lecturerId, sessionDeadline || null]
    );
    res.json(newSession.rows[0]);
  } catch (err) {
    console.error("Error starting session:", err.message);
    res.status(500).json({ error: 'Server error while starting session' });
  }
});

// 2. SAVE THE ROTATING 60-SECOND TOKEN
router.post('/rotate', async (req, res) => {
  try {
    const { sessionId, token } = req.body;
    const expiresAt = new Date(Date.now() + 70000);
    const newQr = await pool.query(
      "INSERT INTO qr_codes (session_id, token, expires_at) VALUES ($1, $2, $3) RETURNING *",
      [sessionId, token, expiresAt]
    );
    res.json(newQr.rows[0]);
  } catch (err) {
    console.error("Error saving QR token:", err.message);
    res.status(500).json({ error: 'Server error while saving token' });
  }
});

// 3. END THE SESSION
router.post('/end', verifyToken, authorizeRole('Lecturer', 'Admin'), async (req, res) => {
  try {
    const { sessionId } = req.body;
    const endedSession = await pool.query(
      "UPDATE sessions SET status = 'Closed', end_time = CURRENT_TIMESTAMP WHERE session_id = $1 RETURNING *",
      [sessionId]
    );
    res.json(endedSession.rows[0]);
  } catch (err) {
    console.error("Error ending session:", err.message);
    res.status(500).json({ error: 'Server error while ending session' });
  }
});

// 4. LOG STUDENT ATTENDANCE VIA SCANNED TOKEN
router.post('/attend', verifyToken, authorizeRole('Student'), async (req, res) => {
  try {
    console.log("INCOMING SCAN TRIGGERED! Data:", req.body);
    const { token, deviceId } = req.body;
    const studentId = req.user.user_id;
    if (!deviceId) return res.status(400).json({ error: 'Security failed: No device fingerprint.' });
    const qrCheck = await pool.query("SELECT session_id, expires_at FROM qr_codes WHERE token = $1", [token]);
    if (qrCheck.rows.length === 0) return res.status(400).json({ error: 'Invalid QR code.' });
    const { session_id, expires_at } = qrCheck.rows[0];
    if (new Date() > new Date(expires_at)) return res.status(400).json({ error: 'QR code has expired. Please scan the current code.' });
    const deviceCheck = await pool.query(
      "SELECT * FROM attendance_records WHERE device_id = $1 AND student_id != $2",
      [deviceId, studentId]
    );
    if (deviceCheck.rows.length > 0) {
      console.log("BLOCKING BUDDY PUNCH AND LOGGING ANOMALY!");
      await pool.query(
        "INSERT INTO anomaly_logs (session_id, attempted_student_id, device_id, flag_reason) VALUES ($1, $2, $3, $4)",
        [session_id, studentId, deviceId, 'CRITICAL: Attempted Proxy Sign-In (Buddy Punching)']
      );
      return res.status(403).json({ error: 'SECURITY ALERT: This device has already been used to sign in a different student.' });
    }
    const duplicateCheck = await pool.query(
      "SELECT * FROM attendance_records WHERE session_id = $1 AND student_id = $2",
      [session_id, studentId]
    );
    if (duplicateCheck.rows.length > 0) return res.status(400).json({ error: 'You are already marked present for this class!' });
    await pool.query(
      "INSERT INTO attendance_records (session_id, student_id, device_id, status) VALUES ($1, $2, $3, 'Present')",
      [session_id, studentId, deviceId]
    );
    console.log("Attendance Saved Successfully!");
    res.json({ message: 'Attendance successfully logged!' });
  } catch (err) {
    console.error("Error logging attendance:", err.message);
    res.status(500).json({ error: 'Server error while logging attendance' });
  }
});

// 5. GET ACTIVE SESSIONS FOR STUDENT DASHBOARD
router.get('/active', verifyToken, authorizeRole('Student'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT session_id, course_id, session_deadline, start_time
      FROM sessions
      WHERE status = 'Active'
      AND (session_deadline IS NULL OR session_deadline > NOW())
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching active sessions:", err.message);
    res.status(500).json({ error: 'Server error fetching active sessions' });
  }
});

// 6. GET RECENT SECURITY ANOMALIES
router.get('/anomalies', verifyToken, authorizeRole('Lecturer', 'Admin'), async (req, res) => {
  try {
    const anomalies = await pool.query(`
      SELECT flag_reason, created_at, attempted_student_id 
      FROM anomaly_logs 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    res.json(anomalies.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error fetching anomalies' });
  }
});

// 7. GET ATTENDANCE RECORDS FOR A SESSION
router.get('/attendance/:sessionId', verifyToken, authorizeRole('Lecturer', 'Admin'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const attendanceRecords = await pool.query(`
      SELECT ar.attendance_id, ar.student_id, u.first_name, u.last_name,
             u.email, ar.status, ar.marked_at, ar.device_id
      FROM attendance_records ar
      JOIN users u ON ar.student_id = u.user_id
      WHERE ar.session_id = $1
      ORDER BY ar.marked_at ASC
    `, [sessionId]);
    res.json({ sessionId, totalAttendance: attendanceRecords.rows.length, records: attendanceRecords.rows });
  } catch (err) {
    console.error("Error fetching attendance records:", err.message);
    res.status(500).json({ error: 'Server error while fetching attendance records' });
  }
});

// 8. GET SESSION HISTORY FOR LECTURER (legacy route)
router.get('/history', verifyToken, authorizeRole('Lecturer', 'Admin'), async (req, res) => {
  try {
    const lecturerId = req.user.user_id;
    const sessions = await pool.query(`
      SELECT s.session_id, s.course_id, s.start_time, s.end_time, s.status,
             COUNT(ar.attendance_id) AS attendance_count
      FROM sessions s
      LEFT JOIN attendance_records ar ON s.session_id = ar.session_id
      WHERE s.lecturer_id = $1 AND s.status = 'Closed'
      GROUP BY s.session_id, s.course_id, s.start_time, s.end_time, s.status
      ORDER BY s.start_time DESC
    `, [lecturerId]);
    res.json(sessions.rows);
  } catch (err) {
    console.error("Error fetching session history:", err.message);
    res.status(500).json({ error: 'Server error fetching session history' });
  }
});

// 9. GET FULL ANOMALY HISTORY
router.get('/anomalies/all', verifyToken, authorizeRole('Lecturer', 'Admin'), async (req, res) => {
  try {
    const anomalies = await pool.query(`
      SELECT al.id, al.session_id, al.attempted_student_id, al.device_id,
             al.flag_reason, al.created_at, u.first_name, u.last_name, u.email
      FROM anomaly_logs al
      LEFT JOIN users u ON al.attempted_student_id = u.user_id::text
      ORDER BY al.created_at DESC
    `);
    res.json(anomalies.rows);
  } catch (err) {
    console.error("Error fetching full anomalies:", err.message);
    res.status(500).json({ error: 'Server error fetching anomalies' });
  }
});

// 10. GET COURSES FOR CURRENT LECTURER
router.get('/lecturer/courses', verifyToken, authorizeRole('Lecturer', 'Admin'), async (req, res) => {
  try {
    const lecturerId = req.user.user_id;
    const result = await pool.query(
      `SELECT c.course_id, c.course_name
       FROM lecturer_courses lc
       JOIN courses c ON lc.course_id = c.course_id
       WHERE lc.lecturer_id = $1
       ORDER BY c.course_id`,
      [lecturerId]
    );
    res.json({ courses: result.rows });
  } catch (err) {
    console.error('Error fetching lecturer courses:', err.message);
    res.status(500).json({ error: 'Server error fetching lecturer courses.' });
  }
});

// 11. GET COURSES FOR CURRENT STUDENT
router.get('/student/courses', verifyToken, authorizeRole('Student'), async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const result = await pool.query(
      `SELECT c.course_id, c.course_name
       FROM enrollments e
       JOIN courses c ON e.course_id = c.course_id
       WHERE e.student_id = $1
       ORDER BY c.course_id`,
      [studentId]
    );
    res.json({ courses: result.rows });
  } catch (err) {
    console.error('Error fetching student courses:', err.message);
    res.status(500).json({ error: 'Server error fetching student courses.' });
  }
});

// 12. EXPORT ATTENDANCE AS EXCEL â€” FIXED (removed localStorage, added student fallback)
router.get('/export/:courseId', verifyToken, authorizeRole('Lecturer', 'Admin'), async (req, res) => {
  try {
    const { courseId } = req.params;

    const courseRes = await pool.query('SELECT course_name FROM courses WHERE course_id = $1', [courseId]);
    const courseName = courseRes.rows[0]?.course_name || courseId;

    const lecturerRes = await pool.query(
      'SELECT first_name, last_name FROM users WHERE user_id = $1',
      [req.user.user_id]
    );
    const lecturer = lecturerRes.rows[0];
    const lecturerName = lecturer ? `Dr. ${lecturer.first_name} ${lecturer.last_name}` : 'Lecturer';

    const sessionsRes = await pool.query(
      `SELECT session_id, start_time FROM sessions
       WHERE course_id = $1 AND status = 'Closed'
       ORDER BY start_time ASC`,
      [courseId]
    );
    const courseSessions = sessionsRes.rows;

    if (courseSessions.length === 0)
      return res.status(404).json({ error: 'No closed sessions found for this course.' });

    // Try enrollments table first, fall back to students from attendance records
    let students = [];
    try {
      const studentsRes = await pool.query(
        `SELECT u.user_id, u.first_name, u.last_name, u.email
         FROM enrollments e
         JOIN users u ON e.student_id = u.user_id
         WHERE e.course_id = $1
         ORDER BY u.last_name, u.first_name`,
        [courseId]
      );
      students = studentsRes.rows;
    } catch (e) { /* enrollments table may not exist */ }

    if (students.length === 0) {
      const fallbackRes = await pool.query(
        `SELECT DISTINCT u.user_id, u.first_name, u.last_name, u.email
         FROM attendance_records ar
         JOIN sessions s ON ar.session_id = s.session_id
         JOIN users u ON ar.student_id = u.user_id
         WHERE s.course_id = $1
         ORDER BY u.last_name, u.first_name`,
        [courseId]
      );
      students = fallbackRes.rows;
    }

    if (students.length === 0)
      return res.status(404).json({ error: 'No students found for this course.' });

    const attendRes = await pool.query(
      `SELECT ar.student_id, ar.session_id
       FROM attendance_records ar
       JOIN sessions s ON ar.session_id = s.session_id
       WHERE s.course_id = $1`,
      [courseId]
    );
    const attendMap = {};
    attendRes.rows.forEach(row => {
      if (!attendMap[row.student_id]) attendMap[row.student_id] = new Set();
      attendMap[row.student_id].add(row.session_id);
    });

    const firstDate = new Date(courseSessions[0].start_time);
    const firstMonday = new Date(firstDate);
    firstMonday.setDate(firstDate.getDate() - ((firstDate.getDay() + 6) % 7));
    firstMonday.setHours(0, 0, 0, 0);

    const getWeekNum = (dateStr) => {
      const d = new Date(dateStr);
      return Math.floor((d - firstMonday) / (7 * 24 * 60 * 60 * 1000)) + 1;
    };

    const maxWeek = Math.max(...courseSessions.map(s => getWeekNum(s.start_time)));
    const sessionsByWeek = {};
    courseSessions.forEach(s => {
      const wk = getWeekNum(s.start_time);
      if (!sessionsByWeek[wk]) sessionsByWeek[wk] = [];
      sessionsByWeek[wk].push(s);
    });

    const wb = XLSX.utils.book_new();
    const wsData = [];

    wsData.push(['#', 'USIU-A']);

    const row2 = new Array(30).fill('');
    row2[3] = 'INSTRUCTOR'; row2[8] = lecturerName;
    row2[16] = 'COURSE'; row2[19] = courseId;
    row2[23] = 'SEMESTER/YEAR'; row2[28] = 'SS/26';
    wsData.push(row2);

    const row3 = new Array(30).fill('');
    row3[3] = 'ATTENDANCE (1 = Present, 0 = Absent)';
    wsData.push(row3);

    const headerRow = ['#', 'ID NO.', 'NAMES'];
    for (let wk = 1; wk <= maxWeek; wk++) headerRow.push(`wk${wk}`, '');
    headerRow.push('Total Present', 'Absent', 'Attendance %');
    wsData.push(headerRow);

    students.forEach((stu, idx) => {
      const row = [idx + 1, stu.email.split('@')[0].toUpperCase(), `${stu.last_name}, ${stu.first_name}`];
      let totalPresent = 0;
      const attended = attendMap[stu.user_id] || new Set();
      for (let wk = 1; wk <= maxWeek; wk++) {
        const sessInWk = sessionsByWeek[wk] || [];
        const s1 = sessInWk[0] ? (attended.has(sessInWk[0].session_id) ? 1 : 0) : '';
        const s2 = sessInWk[1] ? (attended.has(sessInWk[1].session_id) ? 1 : 0) : '';
        row.push(s1, s2 === '' ? '' : s2);
        if (s1 === 1) totalPresent++;
        if (s2 === 1) totalPresent++;
      }
      const totalSessions = courseSessions.length;
      const absent = totalSessions - totalPresent;
      const pct = totalSessions > 0 ? ((totalPresent / totalSessions) * 100).toFixed(1) + '%' : '0%';
      row.push(totalPresent, absent, pct);
      wsData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 4 }, { wch: 14 }, { wch: 25 },
      ...Array(maxWeek * 2).fill({ wch: 5 }),
      { wch: 14 }, { wch: 8 }, { wch: 13 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `${courseId}-Attendance-SS2026.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);

  } catch (err) {
    console.error('Excel export error:', err.message);
    res.status(500).json({ error: 'Failed to generate Excel file: ' + err.message });
  }
});

// 13. ADMIN STATS
router.get('/admin/stats', verifyToken, authorizeRole('Admin'), async (req, res) => {
  try {
    const [students, activeSessions, anomalies] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'Student'"),
      pool.query("SELECT COUNT(*) FROM sessions WHERE status = 'Active'"),
      pool.query("SELECT COUNT(*) FROM anomaly_logs WHERE created_at > NOW() - INTERVAL '7 days'")
    ]);
    res.json({
      totalStudents: parseInt(students.rows[0].count),
      activeSessions: parseInt(activeSessions.rows[0].count),
      activeAlerts: parseInt(anomalies.rows[0].count),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error fetching admin stats' });
  }
});

// 14. STUDENT HISTORY
router.get('/student/history', verifyToken, authorizeRole('Student'), async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const result = await pool.query(
      `SELECT ar.marked_at, s.course_id, s.start_time, c.course_name, ar.status
       FROM attendance_records ar
       JOIN sessions s ON ar.session_id = s.session_id
       JOIN courses c ON s.course_id = c.course_id
       WHERE ar.student_id = $1
       ORDER BY ar.marked_at DESC
       LIMIT 50`,
      [studentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error fetching student history' });
  }
});

// 15. STUDENT COURSE STATS
router.get('/student/course-stats', verifyToken, authorizeRole('Student'), async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const result = await pool.query(
      `SELECT s.course_id,
              COUNT(DISTINCT s.session_id) AS total_sessions,
              COUNT(DISTINCT ar.session_id) AS attended_sessions
       FROM enrollments e
       JOIN sessions s ON s.course_id = e.course_id AND s.status = 'Closed'
       LEFT JOIN attendance_records ar ON ar.session_id = s.session_id AND ar.student_id = $1
       WHERE e.student_id = $1
       GROUP BY s.course_id`,
      [studentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error fetching course stats' });
  }
});

// 16. LECTURER SESSION HISTORY (with course name)
router.get('/lecturer/history', verifyToken, authorizeRole('Lecturer', 'Admin'), async (req, res) => {
  try {
    const lecturerId = req.user.user_id;
    const result = await pool.query(
      `SELECT s.session_id, s.course_id, c.course_name,
              s.start_time, s.end_time, s.status,
              COUNT(ar.attendance_id) AS attendance_count
       FROM sessions s
       JOIN courses c ON s.course_id = c.course_id
       LEFT JOIN attendance_records ar ON s.session_id = ar.session_id
       WHERE s.lecturer_id = $1 AND s.status = 'Closed'
       GROUP BY s.session_id, s.course_id, c.course_name, s.start_time, s.end_time, s.status
       ORDER BY s.start_time DESC
       LIMIT 30`,
      [lecturerId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error fetching lecturer history' });
  }
});

// 17. GET STUDENT CHART DATA (Add this at the bottom before module.exports)
router.get('/student/chart-data', verifyToken, authorizeRole('Student'), async (req, res) => {
  try {
    const studentId = req.user.user_id;

    // 1. Get all closed sessions for the student's courses
    const sessionsQuery = await pool.query(`
      SELECT s.session_id, s.course_id, s.start_time
      FROM sessions s
      JOIN enrollments e ON s.course_id = e.course_id
      WHERE e.student_id = $1 AND s.status = 'Closed'
      ORDER BY s.start_time ASC
    `, [studentId]);

    if (sessionsQuery.rows.length === 0) return res.json([]);

    // 2. Get the student's actual attendance records
    const attendanceQuery = await pool.query(`
      SELECT session_id FROM attendance_records WHERE student_id = $1
    `, [studentId]);
    const attendedSessions = new Set(attendanceQuery.rows.map(r => r.session_id));

    // 3. Dynamically calculate Week 1 (First Monday of the earliest session)
    // This makes it automatically work for the next semester!
    const firstDate = new Date(sessionsQuery.rows[0].start_time);
    const firstMonday = new Date(firstDate);
    firstMonday.setDate(firstDate.getDate() - ((firstDate.getDay() + 6) % 7));
    firstMonday.setHours(0, 0, 0, 0);

    const getWeekNum = (dateStr) => {
      const d = new Date(dateStr);
      return Math.floor((d - firstMonday) / (7 * 24 * 60 * 60 * 1000)) + 1;
    };

    // 4. Calculate Cumulative Attendance per Week
    const currentWeek = getWeekNum(new Date());
    const maxWeek = Math.min(14, Math.max(1, currentWeek)); // Cap at 14 weeks, but go up to current week
    const weeklyData = [];
    
    // Track running totals
    const courseTotals = {};
    const courseAttended = {};
    sessionsQuery.rows.forEach(s => {
      courseTotals[s.course_id] = 0;
      courseAttended[s.course_id] = 0;
    });

    for (let w = 1; w <= maxWeek; w++) {
      let weekObj = { week: `Wk ${w}` };
      const sessionsThisWeek = sessionsQuery.rows.filter(s => getWeekNum(s.start_time) === w);

      // Update running totals for this week
      sessionsThisWeek.forEach(s => {
        courseTotals[s.course_id]++;
        if (attendedSessions.has(s.session_id)) {
          courseAttended[s.course_id]++;
        }
      });

      // Calculate percentage for this week
      Object.keys(courseTotals).forEach(course => {
        if (courseTotals[course] > 0) {
          weekObj[course] = Math.round((courseAttended[course] / courseTotals[course]) * 100);
        } else {
          weekObj[course] = 100; // Default to 100% if no classes have happened yet
        }
      });

      weeklyData.push(weekObj);
    }

    res.json(weeklyData);
  } catch (err) {
    console.error("Error generating chart data:", err.message);
    res.status(500).json({ error: 'Server error generating chart data' });
  }
});

module.exports = router;