const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
const Semester = require('./src/models/Semester');
const Subject = require('./src/models/Subject');
const Chapter = require('./src/models/Chapter');
const Question = require('./src/models/Question');
const Attempt = require('./src/models/Attempt');

dotenv.config();

const SEMESTERS = Array.from({ length: 7 }, (_, i) => ({
  name: `Semester ${i + 1}`,
  order: i + 1,
}));

const SUBJECTS = {
  "Semester 1": [
    { name: "Mathematics I" },
    { name: "Physics" },
    { name: "Programming Basics" },
  ],
  "Semester 2": [
    { name: "Mathematics II" },
    { name: "Data Structures" },
    { name: "Digital Electronics" },
  ],
  "Semester 3": [
    { name: "DBMS" },
    { name: "OOP with Java" },
    { name: "Computer Networks" },
  ],
};

const CHAPTERS = {
  "Mathematics I": ["Algebra", "Calculus", "Trigonometry"],
  "Physics": ["Mechanics", "Optics", "Thermodynamics"],
  "Programming Basics": ["Variables & Loops", "Functions", "Arrays"],
  "Data Structures": ["Stacks & Queues", "Linked Lists", "Trees", "Graphs"],
  "DBMS": ["ER Model", "Normalization", "SQL Queries", "Transactions"],
};

const SAMPLE_QUESTIONS = {
  "Variables & Loops": [
    {
      text: "Which of the following best describes a variable in programming?",
      options: ["A fixed value", "A named storage location", "A type of loop", "A syntax error"],
      correctOptionIndex: 1,
      difficulty: "easy"
    },
    {
      text: "Which loop guarantees that the body of the loop is executed at least once?",
      options: ["for loop", "while loop", "do-while loop", "foreach loop"],
      correctOptionIndex: 2,
      difficulty: "easy"
    }
  ],
  "Normalization": [
    {
      text: "Which normal form deals with multi-valued dependencies?",
      options: ["1NF", "2NF", "3NF", "4NF"],
      correctOptionIndex: 3,
      difficulty: "hard"
    },
    {
      text: "A table is in 2NF if it is in 1NF and what other condition is met?",
      options: [
        "No transitive dependencies exist",
        "No partial dependencies exist",
        "It contains no multi-valued dependencies",
        "All key columns are defined"
      ],
      correctOptionIndex: 1,
      difficulty: "medium"
    }
  ]
};

async function seed() {
  try {
    const connStr = process.env.MONGO_URI || 'mongodb://localhost:27017/smartquiz';
    console.log(`Connecting to database for seeding: ${connStr}`);
    await mongoose.connect(connStr);

    // 1. Clear database
    console.log('Clearing existing collections...');
    await User.deleteMany({});
    await Semester.deleteMany({});
    await Subject.deleteMany({});
    await Chapter.deleteMany({});
    await Question.deleteMany({});
    await Attempt.deleteMany({});
    console.log('Database cleared!');

    // 2. Create Users
    console.log('Creating demo users...');
    const studentUser = await User.create({
      name: 'John Student',
      email: 'student@smartquiz.com',
      password: 'student123', // Will be hashed by pre-save hook
      role: 'student',
    });

    const facultyUser = await User.create({
      name: 'Dr. Sarah Faculty',
      email: 'faculty@smartquiz.com',
      password: 'faculty123', // Will be hashed by pre-save hook
      role: 'faculty',
    });

    console.log('Demo users created successfully!');
    console.log(`Student login: student@smartquiz.com / student123`);
    console.log(`Faculty login: faculty@smartquiz.com / faculty123`);

    // 3. Create Semesters
    console.log('Creating semesters...');
    const semestersMap = {};
    for (const sem of SEMESTERS) {
      const createdSem = await Semester.create(sem);
      semestersMap[sem.name] = createdSem._id;
    }
    console.log(`Created ${SEMESTERS.length} semesters.`);

    // 4. Create Subjects
    console.log('Creating subjects...');
    const subjectsMap = {};
    for (const semName of Object.keys(SUBJECTS)) {
      const semId = semestersMap[semName];
      for (const sub of SUBJECTS[semName]) {
        const createdSub = await Subject.create({
          name: sub.name,
          semesterId: semId,
        });
        subjectsMap[sub.name] = createdSub._id;
      }
    }
    console.log('Created subjects.');

    // 5. Create Chapters
    console.log('Creating chapters...');
    const chaptersMap = {};
    for (const subName of Object.keys(CHAPTERS)) {
      const subId = subjectsMap[subName];
      for (const chapName of CHAPTERS[subName]) {
        const createdChap = await Chapter.create({
          name: chapName,
          subjectId: subId,
        });
        chaptersMap[chapName] = createdChap._id;
      }
    }
    console.log('Created chapters.');

    // 6. Create Sample Questions
    console.log('Creating sample questions...');
    let qCount = 0;
    for (const chapName of Object.keys(SAMPLE_QUESTIONS)) {
      const chapId = chaptersMap[chapName];
      if (!chapId) continue;
      
      for (const q of SAMPLE_QUESTIONS[chapName]) {
        await Question.create({
          chapterId: chapId,
          text: q.text,
          options: q.options,
          correctOptionIndex: q.correctOptionIndex,
          marks: 2,
          difficulty: q.difficulty,
        });
        qCount++;
      }
    }
    console.log(`Created ${qCount} sample questions.`);

    console.log('Seeding finished successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
