const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const pool = require('./db');

const app = express();

// ✅ EXPRESS CORS
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://dynamic-qr-attendance-abdinassirfatehs-projects.vercel.app'
  ],
  credentials: true
}));

app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/sessions', require('./routes/sessions'));

// ✅ STEP 1: Create the HTTP server first
const server = http.createServer(app);

// ✅ STEP 2: Create io using that server
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://dynamic-qr-attendance-abdinassirfatehs-projects.vercel.app'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// ✅ STEP 3: Socket.io event handlers
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  let rotationInterval = null;

  socket.on('start_session', async (sessionId) => {
    socket.join(sessionId);
    console.log(`Lecturer started session: ${sessionId}`);

    if (rotationInterval) clearInterval(rotationInterval);

    rotationInterval = setInterval(async () => {
      const newToken = `qr_token_${Math.random().toString(36).substring(7)}`;
      try {
        const expiresAt = new Date(Date.now() + 10000);
        await pool.query(
          'INSERT INTO qr_codes (session_id, token, expires_at) VALUES ($1, $2, $3)',
          [sessionId, newToken, expiresAt]
        );
        io.to(sessionId).emit('new_qr_code', { token: newToken });
      } catch (err) {
        console.error('Error saving QR token:', err.message);
      }
    }, 8000);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    if (rotationInterval) {
      clearInterval(rotationInterval);
      rotationInterval = null;
    }
  });
});

// ✅ STEP 4: Test route
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    res.json({
      message: 'Database connection successful!',
      tables: result.rows.map(row => row.table_name)
    });
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed.' });
  }
});

// ✅ STEP 5: Start the server last
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});