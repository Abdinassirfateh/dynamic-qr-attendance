const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, studentId, email, password, role } = req.body;

    if (role === 'Student' && (!studentId || !/^\d{6,15}$/.test(studentId))) {
      return res.status(400).json({ error: 'Valid student ID (6–15 digits) required for student accounts.' });
    }

    const userExists = await pool.query('SELECT FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) return res.status(401).json({ error: 'User already exists' });

    if (studentId) {
      const idExists = await pool.query('SELECT FROM users WHERE student_id = $1', [studentId]);
      if (idExists.rows.length > 0) return res.status(401).json({ error: 'Student ID already registered' });
    }

    const saltRounds = 10;
    const bcryptPassword = await bcrypt.hash(password, saltRounds);
    const userId = crypto.randomUUID();

    const newUser = await pool.query(
      `INSERT INTO users (user_id, first_name, last_name, student_id, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING user_id, first_name, last_name, student_id, email, role`,
      [userId, firstName, lastName, studentId || null, email, bcryptPassword, role]
    );

    // ── AUTO-ENROLL NEW STUDENTS ────────────────────────────────────
    if (role === 'Student') {
      // 1. Enroll in the 5 fixed courses (existing behaviour)
      const fixedCourses = ['SWE3090', 'APT1050', 'APT3010', 'SWE4060', 'APT3060'];
      for (const courseId of fixedCourses) {
        await pool.query(
          `INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, courseId]
        );
      }
      // 2. Also enroll in any course where this student_id is on the imported roster
      if (studentId) {
        const rosterRows = await pool.query(
          'SELECT DISTINCT course_id FROM course_rosters WHERE student_id = $1',
          [studentId]
        );
        for (const row of rosterRows.rows) {
          await pool.query(
            `INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [userId, row.course_id]
          );
        }
      }
    }
    // ───────────────────────────────────────────────────────────────
    const token = jwt.sign(
      { userid: newUser.rows[0].user_id, role: newUser.rows[0].role },
      process.env.JWT_SECRET,
      { expiresIn: '10h' }
    );

    res.json({ token, user: newUser.rows[0] });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server Error during registration' });
  }
});

// 2. LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid Credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid Credentials' });
    }

    const token = jwt.sign(
      { user_id: user.rows[0].user_id, role: user.rows[0].role },
      process.env.JWT_SECRET,
      { expiresIn: '10h' }
    );

    res.json({
      token,
      user: {
        user_id: user.rows[0].user_id,
        first_name: user.rows[0].first_name,
        last_name: user.rows[0].last_name,
        student_id: user.rows[0].student_id,
        email: user.rows[0].email,
        role: user.rows[0].role
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server Error during login' });
  }
});

// 3. ADMIN: CREATE USER â€” single clean version
router.post('/admin/create-user', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, studentId } = req.body;

    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const allowedRoles = ['Student', 'Lecturer', 'Admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    if (role === 'Student' && (!studentId || !/^\d{6,15}$/.test(studentId))) {
      return res.status(400).json({ error: 'Valid student ID (6–15 digits) required for student accounts.' });
    }

    const userExists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: 'Email already in use.' });
    }

    if (studentId) {
      const idExists = await pool.query('SELECT 1 FROM users WHERE student_id = $1', [studentId]);
      if (idExists.rows.length > 0) {
        return res.status(409).json({ error: 'Student ID already registered.' });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    const insert = await pool.query(
      `INSERT INTO users (user_id, first_name, last_name, student_id, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING user_id, first_name, last_name, student_id, email, role`,
      [userId, firstName, lastName, studentId || null, email, hash, role]
    );

    res.status(201).json({ user: insert.rows[0] });
  } catch (err) {
    console.error('Admin create-user error:', err.message);
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use.' });
    res.status(500).json({ error: 'Server error while creating user.' });
  }
});

// 4. ADMIN: LIST ALL USERS â€” single clean version, no created_at dependency
router.get('/admin/users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT user_id, first_name, last_name, email, role, password_hash, 'Active' AS status
       FROM users
       ORDER BY
         CASE role WHEN 'Admin' THEN 1 WHEN 'Lecturer' THEN 2 ELSE 3 END,
         last_name ASC,
         first_name ASC`
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Admin list-users error:', err.message);
    res.status(500).json({ error: 'Server error while fetching users.' });
  }
});
// 5. DELETE USER (Admin only)
router.delete('/admin/delete-user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Delete related records first to avoid foreign key errors
    await pool.query('DELETE FROM enrollments WHERE student_id = $1', [userId]);
    await pool.query('DELETE FROM attendance_records WHERE student_id = $1', [userId]);
    await pool.query('DELETE FROM anomaly_logs WHERE attempted_student_id = $1::text', [userId]);
    await pool.query('DELETE FROM lecturer_courses WHERE lecturer_id = $1', [userId]);
    await pool.query('DELETE FROM sessions WHERE lecturer_id = $1', [userId]);

    // Now delete the user
    const result = await pool.query(
      'DELETE FROM users WHERE user_id = $1 RETURNING user_id, first_name, last_name',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ message: `${result.rows[0].first_name} ${result.rows[0].last_name} deleted successfully.` });
  } catch (err) {
    console.error('Delete user error:', err.message);
    res.status(500).json({ error: 'Server error while deleting user.' });
  }
});

module.exports = router;