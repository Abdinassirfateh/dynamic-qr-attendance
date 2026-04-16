const express = require('express');
const multer  = require('multer');
const XLSX    = require('xlsx');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── AUTH MIDDLEWARE (copied so this file is self-contained) ────────
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

const authorizeRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: 'Access denied.' });
  next();
};

// ── 1. CREATE A COURSE ─────────────────────────────────────────────
// POST /api/courses/create
router.post('/create', verifyToken, authorizeRole('Lecturer', 'Admin'), async (req, res) => {
  try {
    const { courseId, courseName } = req.body;
    const lecturerId = req.user.user_id;

    if (!courseId || !courseName)
      return res.status(400).json({ error: 'Course code and name are required.' });

    const cleanCode = courseId.trim().toUpperCase();
    const cleanName = courseName.trim();

    // Upsert the course (update name if code already exists)
    await pool.query(
      `INSERT INTO courses (course_id, course_name)
       VALUES ($1, $2)
       ON CONFLICT (course_id) DO UPDATE SET course_name = EXCLUDED.course_name`,
      [cleanCode, cleanName]
    );

    // Link this lecturer to the course
    await pool.query(
      `INSERT INTO lecturer_courses (lecturer_id, course_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [lecturerId, cleanCode]
    );

    res.status(201).json({
      message: 'Course created successfully.',
      courseId: cleanCode,
      courseName: cleanName,
    });
  } catch (err) {
    console.error('Create course error:', err.message);
    res.status(500).json({ error: 'Server error creating course.' });
  }
});

// ── 2. GET MY COURSES WITH ROSTER COUNTS ───────────────────────────
// GET /api/courses/my-courses
router.get('/my-courses', verifyToken, authorizeRole('Lecturer', 'Admin'), async (req, res) => {
  try {
    const lecturerId = req.user.user_id;

    const result = await pool.query(
      `SELECT c.course_id, c.course_name,
              COUNT(cr.id)::int AS roster_count
       FROM lecturer_courses lc
       JOIN courses c ON lc.course_id = c.course_id
       LEFT JOIN course_rosters cr ON cr.course_id = c.course_id
       WHERE lc.lecturer_id = $1
       GROUP BY c.course_id, c.course_name
       ORDER BY c.course_id`,
      [lecturerId]
    );

    res.json({ courses: result.rows });
  } catch (err) {
    console.error('Get my courses error:', err.message);
    res.status(500).json({ error: 'Server error fetching courses.' });
  }
});

// ── 3. IMPORT BLACKBOARD ROSTER (Excel upload) ─────────────────────
// POST /api/courses/:courseId/import-roster
// Expected Excel format: Column A = Surname, Column B = First Name, Column C = Student ID
// Row 1 is the header row and is automatically skipped.
router.post(
  '/:courseId/import-roster',
  verifyToken,
  authorizeRole('Lecturer', 'Admin'),
  upload.single('roster'),
  async (req, res) => {
    try {
      const { courseId } = req.params;

      if (!req.file)
        return res.status(400).json({ error: 'No file uploaded.' });

      // Parse the uploaded Excel file from memory
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet    = workbook.Sheets[workbook.SheetNames[0]];
      const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length < 2)
        return res.status(400).json({ error: 'File appears to be empty or has no data rows.' });

      // Parse each data row (skip header row at index 0)
      const students = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 3) continue;

        const lastName  = String(row[0] ?? '').trim();
        const firstName = String(row[1] ?? '').trim();
        // Excel sometimes stores numeric IDs as floats (664201.0) — remove the decimal
        const studentId = String(row[2] ?? '').replace(/\.0+$/, '').trim();

        if (!lastName || !firstName || !studentId) continue;
        if (!/^\d{6,15}$/.test(studentId)) continue; // skip malformed IDs

        students.push({ lastName, firstName, studentId });
      }

      if (students.length === 0)
        return res.status(400).json({ error: 'No valid student rows found. Check the file format: Surname | First Name | Student ID.' });

      // Upsert each student into course_rosters
      let imported = 0;
      for (const s of students) {
        await pool.query(
          `INSERT INTO course_rosters (course_id, student_id, first_name, last_name)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (course_id, student_id)
           DO UPDATE SET first_name = EXCLUDED.first_name,
                         last_name  = EXCLUDED.last_name`,
          [courseId, s.studentId, s.firstName, s.lastName]
        );
        imported++;

        // Auto-enroll if this student has already registered in the app
        const userRow = await pool.query(
          'SELECT user_id FROM users WHERE student_id = $1',
          [s.studentId]
        );
        if (userRow.rows.length > 0) {
          await pool.query(
            `INSERT INTO enrollments (student_id, course_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [userRow.rows[0].user_id, courseId]
          );
        }
      }

      res.json({
        message: `Successfully imported ${imported} student${imported !== 1 ? 's' : ''} into ${courseId}.`,
        count: imported,
      });
    } catch (err) {
      console.error('Import roster error:', err.message);
      res.status(500).json({ error: 'Server error importing roster: ' + err.message });
    }
  }
);

// ── 4. VIEW ROSTER FOR A COURSE ────────────────────────────────────
// GET /api/courses/:courseId/roster
router.get('/:courseId/roster', verifyToken, authorizeRole('Lecturer', 'Admin'), async (req, res) => {
  try {
    const { courseId } = req.params;

    const result = await pool.query(
      `SELECT cr.student_id,
              cr.first_name,
              cr.last_name,
              cr.imported_at,
              CASE WHEN u.user_id IS NOT NULL THEN true ELSE false END AS registered
       FROM course_rosters cr
       LEFT JOIN users u ON u.student_id = cr.student_id
       WHERE cr.course_id = $1
       ORDER BY cr.last_name, cr.first_name`,
      [courseId]
    );

    res.json({ roster: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('Get roster error:', err.message);
    res.status(500).json({ error: 'Server error fetching roster.' });
  }
});

module.exports = router;