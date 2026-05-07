const mongoose = require('mongoose');

// We use this schema to define what a "Course" looks like in our database
const courseSchema = new mongoose.Schema({
  // Every course needs a unique code, like 'CS101'
  courseCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true, // Automatically converts 'cs101' to 'CS101'
    trim: true,      // Removes accidental spaces like ' CS101 '
  },
  
  // The name of the course, e.g., 'Introduction to Computer Science'
  title: {
    type: String,
    required: true,
    trim: true,
  },
  
  // The professor or teacher leading the course
  instructor: {
    type: String,
    required: true,
    trim: true,
  },
  
  // A brief summary of what students will learn
  description: {
    type: String,
    default: '',
  },
  
  // The maximum number of students allowed to take this course
  totalSeats: {
    type: Number,
    required: true,
    min: 1, // Must have at least 1 seat
  },
  
  // How many students have actually signed up so far
  enrolledCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // The academic weight of the course, usually 3 or 4 credits
  credits: {
    type: Number,
    default: 3,
    min: 1,
  },
  
  // Who is this course for? e.g., '1' for freshmen, 'ALL' for everyone
  targetYear: {
    type: String,
    enum: ['1', '2', '3', '4', '5', 'ALL'],
    default: 'ALL',
  },
  
  // When is this course usually offered? Odd/Even semesters
  targetSemester: {
    type: String,
    enum: ['Odd', 'Even', 'ALL'],
    default: 'ALL',
  },
  
  // Which branches (like CSE, CCE) can take this?
  targetBranch: {
    type: [String],
    default: ['ALL']
  },
  
  // Is this course required or optional?
  courseType: {
    type: String,
    enum: ['MANDATORY', 'ELECTIVE', 'OPEN_ELECTIVE'],
    default: 'ELECTIVE',
  },
}, { 
  timestamps: true // Automatically keeps track of when the course was created and last updated
});

// --- Helper Functions (Virtuals) ---
// These don't get saved in the database directly, but they are calculated on-the-fly when we need them

// Calculates how many empty seats are left
courseSchema.virtual('availableSeats').get(function () {
  return this.totalSeats - this.enrolledCount;
});

// Checks if the course is completely full
courseSchema.virtual('isFull').get(function () {
  return this.enrolledCount >= this.totalSeats;
});

// Make sure our virtuals are included when we send data back as JSON
courseSchema.set('toJSON', { virtuals: true });

// Finally, we create the model and share it so other parts of the app can use it
module.exports = mongoose.model('Course', courseSchema);
