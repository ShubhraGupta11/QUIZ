const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB database
connectDB();

const app = express();

// Standard middleware
app.use(cors());
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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
