const express = require('express');
const http = require('http');
const cors = require('cors');
const compression = require('compression');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { registerLiveQuizHandlers } = require('./live/socketHandlers');

// Load environment variables
dotenv.config();

// Connect to MongoDB database
connectDB();

const app = express();

// Standard middleware
app.use(cors());
app.use(compression()); // gzip JSON responses — meaningfully cuts transfer time for larger payloads (e.g. 100 generated questions)
app.use(express.json());

// Main entry welcome route
app.get('/', (req, res) => {
  res.json({ message: 'SmartQuiz API Server is running!' });
});

// Route registration
app.use('/api/auth', require('./routes/auth'));
app.use('/api/semesters', require('./routes/semesters'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/chapters', require('./routes/chapters'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/attempts', require('./routes/attempts'));
app.use('/api/faculty', require('./routes/ai')); // mount AI generation at /api/faculty
app.use('/api/stats', require('./routes/stats'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/doubts', require('./routes/doubts'));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});
registerLiveQuizHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
