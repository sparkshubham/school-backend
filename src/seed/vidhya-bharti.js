import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { PLANS } from '../config/constants.js';
import { Tenant } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { Branch } from '../models/Branch.js';
import { AcademicSession } from '../models/AcademicSession.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { Section } from '../models/Section.js';
import { Subject } from '../models/Subject.js';
import { ClassSubject } from '../models/ClassSubject.js';
import { Student } from '../models/Student.js';
import { Parent } from '../models/Parent.js';
import { Teacher } from '../models/Teacher.js';
import { Attendance } from '../models/Attendance.js';
import { Period, TimetableSlot } from '../models/Timetable.js';
import { Exam, ExamSubject, Mark } from '../models/Exam.js';
import { FeeStructure, FeeInvoice, FeePayment } from '../models/Fee.js';
import { Homework } from '../models/Homework.js';
import { Notice, Event, Enquiry, LeaveRequest, Complaint } from '../models/Ops.js';
import { Book, BookIssue } from '../models/Library.js';
import { Vehicle, TransportRoute, StudentTransport } from '../models/Transport.js';
import { SubscriptionPayment } from '../models/Subscription.js';

const SLUG = 'vidhya-bharti';
const ADMIN_PASS = 'Admin@123';
const TEACHER_PASS = 'Teacher@123';
const PARENT_PASS = 'Parent@123';
const STUDENT_PASS = 'Student@123';

function d(y, m, day) {
  return new Date(y, m - 1, day);
}

function gradeFor(pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 33) return 'D';
  return 'F';
}

const TENANT_MODELS = [
  User, Branch, AcademicSession, SchoolClass, Section, Subject, ClassSubject,
  Student, Parent, Teacher, Attendance, Period, TimetableSlot,
  Exam, ExamSubject, Mark, FeeStructure, FeeInvoice, FeePayment,
  Homework, Notice, Event, Enquiry, LeaveRequest, Complaint,
  Book, BookIssue, Vehicle, TransportRoute, StudentTransport, SubscriptionPayment,
];

async function wipeIfExists() {
  const existing = await Tenant.findOne({ slug: SLUG });
  if (!existing) return;
  const tid = existing._id;
  for (const Model of TENANT_MODELS) {
    await Model.deleteMany({ tenantId: tid });
  }
  await Tenant.deleteOne({ _id: tid });
}

const STAFF = [
  { name: 'Gaytri Soni', emp: 'VBM-T01', dept: 'English', desig: 'TGT English', gender: 'female', email: 'gaytri.soni@vidhyabharti.school' },
  { name: 'Rekha Patwa', emp: 'VBM-T02', dept: 'Hindi', desig: 'TGT Hindi', gender: 'female', email: 'rekha.patwa@vidhyabharti.school' },
  { name: 'Kailash Kumhar', emp: 'VBM-T03', dept: 'Mathematics', desig: 'TGT Maths', gender: 'male', email: 'kailash.kumhar@vidhyabharti.school' },
  { name: 'Saroj Sharma', emp: 'VBM-T04', dept: 'Science', desig: 'TGT Science', gender: 'female', email: 'saroj.sharma@vidhyabharti.school' },
  { name: 'Rakesh Sharma', emp: 'VBM-VP01', dept: 'Administration', desig: 'Vice Principal', gender: 'male', email: 'rakesh.sharma@vidhyabharti.school', role: 'principal' },
  { name: 'Ratnesh Prajapat', emp: 'VBM-T05', dept: 'Computer', desig: 'Computer Teacher', gender: 'male', email: 'ratnesh.prajapat@vidhyabharti.school' },
  { name: 'Balkrishan Farzi', emp: 'VBM-T06', dept: 'Social Science', desig: 'TGT SST', gender: 'male', email: 'balkrishan.farzi@vidhyabharti.school' },
  { name: 'Rani Jeengar', emp: 'VBM-T07', dept: 'Primary', desig: 'PRT', gender: 'female', email: 'rani.jeengar@vidhyabharti.school' },
  { name: 'Krishan Prajapat', emp: 'VBM-T08', dept: 'Mathematics', desig: 'TGT Maths', gender: 'male', email: 'krishan.prajapat@vidhyabharti.school' },
];

const FIRST = ['Aarav', 'Rohan', 'Yash', 'Kunal', 'Harsh', 'Anaya', 'Kavya', 'Isha', 'Pooja', 'Nisha', 'Dev', 'Mohit', 'Meera', 'Sneha', 'Aditya', 'Riya', 'Vivek', 'Divya', 'Ankit', 'Tanvi', 'Om', 'Jiya', 'Laksh', 'Khushi', 'Reyansh'];
const LAST = ['Sharma', 'Soni', 'Patwa', 'Kumhar', 'Prajapat', 'Jeengar', 'Jain', 'Meena', 'Gurjar', 'Sen'];

function dummyStudent(i) {
  const first = FIRST[i % FIRST.length];
  const last = LAST[Math.floor(i / FIRST.length) % LAST.length];
  const female = ['Anaya', 'Kavya', 'Isha', 'Pooja', 'Nisha', 'Meera', 'Sneha', 'Riya', 'Divya', 'Tanvi', 'Jiya', 'Khushi'].includes(first);
  const classNo = (i % 10) + 1;
  const roll = Math.floor(i / 10) + 1;
  return { first, last, gender: female ? 'female' : 'male', classNo, roll, index: i };
}

async function seed() {
  await connectDb(process.env.MONGO_URI);
  await wipeIfExists();

  const school = await Tenant.create({
    name: 'Vidhya Bharti Mandal',
    slug: SLUG,
    email: 'admin@vidhyabharti.school',
    phone: '01482-256700',
    website: 'https://vidhyabharti.school',
    address: 'Vidhya Bharti Campus, Secondary School',
    city: 'Bhilwara',
    state: 'Rajasthan',
    pincode: '311001',
    principalName: 'Rakesh Sharma',
    registrationNo: 'RJ-EDU-VBM-2008-441',
    affiliation: 'RBSE Secondary',
    academicSession: '2026-27',
    status: 'active',
    plan: 'professional',
    modules: PLANS.professional.modules,
    subscriptionEndsAt: d(2027, 3, 31),
  });
  const tid = school._id;

  await SubscriptionPayment.create({
    tenantId: tid,
    amount: 99990,
    plan: 'professional',
    period: 'yearly',
    status: 'paid',
    paidAt: d(2026, 4, 8),
  });

  const branch = await Branch.create({
    tenantId: tid,
    name: 'Main Campus',
    code: 'MAIN',
    address: 'Vidhya Bharti Campus, Bhilwara',
    phone: '01482-256700',
    isMain: true,
  });

  const admin = await User.create({
    tenantId: tid,
    branchId: branch._id,
    name: 'School Admin',
    email: 'admin@vidhyabharti.school',
    password: ADMIN_PASS,
    phone: '9829026700',
    role: 'school_admin',
  });

  const session = await AcademicSession.create({
    tenantId: tid,
    name: '2026-27',
    startDate: d(2026, 4, 1),
    endDate: d(2027, 3, 31),
    isCurrent: true,
  });

  const classes = {};
  const sections = {};
  for (let n = 1; n <= 10; n += 1) {
    const cls = await SchoolClass.create({ tenantId: tid, name: `Class ${n}`, numeric: n, order: n });
    classes[n] = cls;
    sections[n] = await Section.create({ tenantId: tid, classId: cls._id, name: 'A', capacity: 40 });
  }

  const subjectDefs = [
    ['Hindi', 'HIN'],
    ['English', 'ENG'],
    ['Mathematics', 'MATH'],
    ['EVS', 'EVS'],
    ['Science', 'SCI'],
    ['Social Science', 'SST'],
    ['Sanskrit', 'SAN'],
    ['Computer', 'CS'],
    ['Drawing', 'DRW'],
  ];
  const subjects = {};
  for (const [name, code] of subjectDefs) {
    subjects[code] = await Subject.create({ tenantId: tid, name, code });
  }

  const teachers = [];
  for (const s of STAFF) {
    const user = await User.create({
      tenantId: tid,
      name: s.name,
      email: s.email,
      password: TEACHER_PASS,
      role: s.role || 'teacher',
      phone: '98' + String(20000000 + teachers.length * 11113).slice(0, 8),
    });
    const t = await Teacher.create({
      tenantId: tid,
      userId: user._id,
      employeeId: s.emp,
      name: s.name,
      email: s.email,
      phone: user.phone,
      gender: s.gender,
      qualification: s.role === 'principal' ? 'M.A., B.Ed' : 'B.A., B.Ed',
      experience: 8 + teachers.length,
      joiningDate: d(2016, 7, 1),
      department: s.dept,
      designation: s.desig,
      salary: s.role === 'principal' ? 65000 : 32000 + teachers.length * 1500,
    });
    user.linkedTeacherId = t._id;
    await user.save();
    teachers.push({ ...s, doc: t, user });
  }

  const byName = Object.fromEntries(teachers.map((t) => [t.name, t.doc]));
  const subjectTeacher = [
    [subjects.ENG, byName['Gaytri Soni']],
    [subjects.HIN, byName['Rekha Patwa']],
    [subjects.MATH, byName['Kailash Kumhar']],
    [subjects.SCI, byName['Saroj Sharma']],
    [subjects.SST, byName['Balkrishan Farzi']],
    [subjects.CS, byName['Ratnesh Prajapat']],
    [subjects.EVS, byName['Rani Jeengar']],
    [subjects.SAN, byName['Krishan Prajapat']],
    [subjects.DRW, byName['Rani Jeengar']],
  ];
  for (let n = 1; n <= 10; n += 1) {
    const list = n <= 5
      ? [subjects.HIN, subjects.ENG, subjects.MATH, subjects.EVS, subjects.CS, subjects.DRW]
      : [subjects.HIN, subjects.ENG, subjects.MATH, subjects.SCI, subjects.SST, subjects.CS, subjects.SAN];
    for (const sub of list) {
      const pair = subjectTeacher.find((p) => String(p[0]._id) === String(sub._id));
      await ClassSubject.create({
        tenantId: tid,
        classId: classes[n]._id,
        sectionId: sections[n]._id,
        subjectId: sub._id,
        teacherId: pair?.[1]._id || byName['Rakesh Sharma']._id,
      });
    }
  }

  const students = [];
  for (let i = 0; i < 50; i += 1) {
    const row = dummyStudent(i);
    const admissionNo = `VBM2026${String(i + 1).padStart(4, '0')}`;
    const parentEmail = i === 0 ? 'parent@vidhyabharti.school' : `parent.${row.last.toLowerCase()}${i + 1}@vidhyabharti.school`;
    const pUser = await User.create({
      tenantId: tid,
      name: `Mr. ${row.last}`,
      email: parentEmail,
      password: PARENT_PASS,
      role: 'parent',
      phone: '97' + String(10000000 + (i + 1) * 137).slice(0, 8),
    });
    const parent = await Parent.create({
      tenantId: tid,
      userId: pUser._id,
      name: `${row.first} ${row.last}'s Father`,
      relation: 'father',
      phone: pUser.phone,
      email: parentEmail,
      occupation: 'Self employed',
      students: [],
    });
    pUser.linkedParentId = parent._id;
    await pUser.save();

    const studentEmail = i === 0 ? 'student@vidhyabharti.school' : `${row.first.toLowerCase()}.${row.last.toLowerCase()}${i + 1}@vidhyabharti.school`;
    const sUser = await User.create({
      tenantId: tid,
      name: `${row.first} ${row.last}`,
      email: studentEmail,
      password: STUDENT_PASS,
      role: 'student',
    });

    const student = await Student.create({
      tenantId: tid,
      branchId: branch._id,
      userId: sUser._id,
      parentId: parent._id,
      admissionNo,
      rollNo: String(row.roll),
      firstName: row.first,
      lastName: row.last,
      dob: d(2016 - row.classNo, (i % 12) + 1, (i % 27) + 1),
      gender: row.gender,
      bloodGroup: ['A+', 'B+', 'O+', 'AB+', 'O-'][i % 5],
      classId: classes[row.classNo]._id,
      sectionId: sections[row.classNo]._id,
      sessionId: session._id,
      admissionDate: d(2024, 4, 8),
      address: `${i + 12}, Gandhi Nagar`,
      city: 'Bhilwara',
      state: 'Rajasthan',
      pincode: '311001',
      fatherName: `Mr. ${row.last}`,
      fatherPhone: pUser.phone,
      motherName: `Mrs. ${row.last}`,
      email: studentEmail,
    });
    sUser.linkedStudentId = student._id;
    await sUser.save();
    parent.students = [student._id];
    await parent.save();
    students.push(student);
  }

  const today = new Date(2026, 7, 19);
  for (let n = 1; n <= 10; n += 1) {
    const classStudents = students.filter((_, idx) => dummyStudent(idx).classNo === n);
    for (let offset = 0; offset < 6; offset += 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - offset);
      if (date.getDay() === 0) continue;
      await Attendance.create({
        tenantId: tid,
        classId: classes[n]._id,
        sectionId: sections[n]._id,
        date,
        takenBy: admin._id,
        records: classStudents.map((s, i) => {
          let status = 'present';
          if (offset === 0 && i === 0) status = 'absent';
          if (offset === 1 && i === 2) status = 'late';
          if (offset === 2 && i === 1) status = 'leave';
          return { studentId: s._id, status };
        }),
      });
    }
  }

  const periods = [];
  const periodDefs = [
    ['1', '08:00', '08:45', 1, false],
    ['2', '08:45', '09:30', 2, false],
    ['Break', '09:30', '09:45', 3, true],
    ['3', '09:45', '10:30', 4, false],
    ['4', '10:30', '11:15', 5, false],
    ['5', '11:15', '12:00', 6, false],
  ];
  for (const [name, start, end, order, isBreak] of periodDefs) {
    periods.push(await Period.create({ tenantId: tid, name, startTime: start, endTime: end, order, isBreak }));
  }
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const class10Subs = [subjects.MATH, subjects.ENG, subjects.SCI, subjects.HIN, subjects.SST];
  const class10Teachers = [byName['Kailash Kumhar'], byName['Gaytri Soni'], byName['Saroj Sharma'], byName['Rekha Patwa'], byName['Balkrishan Farzi']];
  for (const day of days) {
    let i = 0;
    for (const p of periods) {
      if (p.isBreak) continue;
      await TimetableSlot.create({
        tenantId: tid,
        classId: classes[10]._id,
        sectionId: sections[10]._id,
        day,
        periodId: p._id,
        subjectId: class10Subs[i % class10Subs.length]._id,
        teacherId: class10Teachers[i % class10Teachers.length]._id,
        room: 'R-10',
      });
      i += 1;
    }
  }

  const exam = await Exam.create({
    tenantId: tid,
    sessionId: session._id,
    name: 'Half Yearly Examination',
    type: 'term',
    startDate: d(2026, 9, 10),
    endDate: d(2026, 9, 22),
    status: 'completed',
  });
  await Exam.create({
    tenantId: tid,
    sessionId: session._id,
    name: 'Annual Examination',
    type: 'final',
    startDate: d(2027, 2, 20),
    endDate: d(2027, 3, 5),
    status: 'scheduled',
  });

  const examSubs10 = [];
  for (const [sub, teach] of [
    [subjects.MATH, byName['Kailash Kumhar']],
    [subjects.ENG, byName['Gaytri Soni']],
    [subjects.SCI, byName['Saroj Sharma']],
    [subjects.HIN, byName['Rekha Patwa']],
    [subjects.SST, byName['Balkrishan Farzi']],
  ]) {
    examSubs10.push(
      await ExamSubject.create({
        tenantId: tid,
        examId: exam._id,
        subjectId: sub._id,
        classId: classes[10]._id,
        maxMarks: 100,
        passMarks: 33,
        date: d(2026, 9, 12),
      })
    );
  }
  const class10Students = students.filter((_, idx) => dummyStudent(idx).classNo === 10);
  for (const es of examSubs10) {
    for (let i = 0; i < class10Students.length; i += 1) {
      const obtained = 58 + ((i * 11 + es.maxMarks) % 38);
      await Mark.create({
        tenantId: tid,
        examId: exam._id,
        examSubjectId: es._id,
        studentId: class10Students[i]._id,
        obtained,
        grade: gradeFor(obtained),
      });
    }
  }

  for (let n = 1; n <= 10; n += 1) {
    const tuition = n <= 5 ? 18000 : n <= 8 ? 24000 : 30000;
    const structure = await FeeStructure.create({
      tenantId: tid,
      classId: classes[n]._id,
      sessionId: session._id,
      items: [
        { name: 'Admission Fee', amount: 5000 },
        { name: 'Tuition Fee', amount: tuition },
        { name: 'Exam Fee', amount: 1500 },
        { name: 'Activity Fee', amount: 2000 },
      ],
    });
    const total = structure.items.reduce((s, i) => s + i.amount, 0);
    const classStudents = students.filter((_, idx) => dummyStudent(idx).classNo === n);
    for (let i = 0; i < classStudents.length; i += 1) {
      const paid = i === 0 ? total : i === 1 ? Math.round(total / 2) : 0;
      const invoice = await FeeInvoice.create({
        tenantId: tid,
        studentId: classStudents[i]._id,
        sessionId: session._id,
        invoiceNo: `VBM-INV-26-${n}${String(i + 1).padStart(2, '0')}`,
        items: structure.items,
        total,
        paid,
        due: total - paid,
        dueDate: d(2026, 8, 25),
        status: paid === total ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
      });
      if (paid) {
        await FeePayment.create({
          tenantId: tid,
          invoiceId: invoice._id,
          studentId: classStudents[i]._id,
          amount: paid,
          method: i % 2 === 0 ? 'upi' : 'cash',
          receiptNo: `VBM-RCP-26-${n}${String(i + 1).padStart(2, '0')}`,
          paidAt: d(2026, 8, 12),
        });
      }
    }
  }

  await Homework.create([
    {
      tenantId: tid,
      classId: classes[10]._id,
      sectionId: sections[10]._id,
      subjectId: subjects.SCI._id,
      teacherId: byName['Saroj Sharma']._id,
      title: 'Science — Metals and Non-metals',
      description: 'Read the chapter and complete in-text questions.',
      dueDate: d(2026, 8, 22),
    },
    {
      tenantId: tid,
      classId: classes[5]._id,
      sectionId: sections[5]._id,
      subjectId: subjects.MATH._id,
      teacherId: byName['Kailash Kumhar']._id,
      title: 'Fractions worksheet',
      description: 'Complete page 42–44.',
      dueDate: d(2026, 8, 21),
    },
  ]);

  await Notice.create([
    { tenantId: tid, title: 'Independence Day assembly', body: 'All students in house uniform. Flag hoisting at 8:00 AM.', audience: 'all', pinned: true, createdBy: admin._id },
    { tenantId: tid, title: 'Fee reminder', body: 'Clear pending fees by 25 August 2026.', audience: 'parents', createdBy: admin._id },
    { tenantId: tid, title: 'PTM — Classes 1 to 10', body: 'Parent meeting on 28 August, 9 AM to 1 PM.', audience: 'all', createdBy: admin._id },
  ]);

  await Event.create([
    { tenantId: tid, title: 'Sports Day', type: 'sports', startDate: d(2026, 8, 30), endDate: d(2026, 8, 30) },
    { tenantId: tid, title: 'Parent Meeting', type: 'meeting', startDate: d(2026, 8, 28) },
    { tenantId: tid, title: 'Annual Examination', type: 'exam', startDate: d(2027, 2, 20), endDate: d(2027, 3, 5) },
  ]);

  await Enquiry.create([
    { tenantId: tid, studentName: 'Harshita Sen', parentName: 'Mukesh Sen', phone: '9876511111', classApplying: 'Class 6', source: 'Walk-in', status: 'interested', followUpDate: d(2026, 8, 21) },
    { tenantId: tid, studentName: 'Rohit Gurjar', parentName: 'Suresh Gurjar', phone: '9876511222', classApplying: 'Class 1', source: 'Website', status: 'new' },
    { tenantId: tid, studentName: 'Nandini Jain', parentName: 'Alok Jain', phone: '9876511333', classApplying: 'Class 9', source: 'Referral', status: 'visit_scheduled', followUpDate: d(2026, 8, 20) },
  ]);

  await LeaveRequest.create({
    tenantId: tid,
    userId: byName['Gaytri Soni'].userId,
    role: 'teacher',
    type: 'casual',
    fromDate: d(2026, 8, 22),
    toDate: d(2026, 8, 22),
    reason: 'Family function',
    status: 'pending',
  });

  const firstParent = await Parent.findById(students[0].parentId);
  await Complaint.create({
    tenantId: tid,
    raisedBy: firstParent.userId,
    category: 'general',
    title: 'Drinking water cooler on first floor',
    body: 'The cooler has been out of order for two days.',
    status: 'open',
  });

  const books = await Book.create([
    { tenantId: tid, isbn: '9788174501000', name: 'RBSE Hindi Class 10', author: 'RBSE', category: 'Textbook', rack: 'A-1', quantity: 40, available: 35 },
    { tenantId: tid, isbn: '9788174501001', name: 'Bal Bharati Maths 5', author: 'SCERT', category: 'Textbook', rack: 'A-2', quantity: 30, available: 28 },
  ]);
  await BookIssue.create({
    tenantId: tid,
    bookId: books[0]._id,
    studentId: class10Students[0]._id,
    issueDate: d(2026, 8, 10),
    dueDate: d(2026, 8, 24),
    status: 'issued',
  });

  const bus = await Vehicle.create({
    tenantId: tid,
    number: 'RJ-06-GA-3311',
    type: 'bus',
    capacity: 40,
    driverName: 'Mohan Lal',
    driverPhone: '9828033110',
  });
  const route = await TransportRoute.create({
    tenantId: tid,
    name: 'City Route',
    vehicleId: bus._id,
    stops: [
      { name: 'Azad Nagar', order: 1, pickupTime: '07:15' },
      { name: 'Kumbha Circle', order: 2, pickupTime: '07:25' },
      { name: 'Gandhi Nagar', order: 3, pickupTime: '07:35' },
      { name: 'School', order: 4, pickupTime: '07:50' },
    ],
  });
  await StudentTransport.create({ tenantId: tid, studentId: students[0]._id, routeId: route._id, stopName: 'Gandhi Nagar' });

  console.log('\nVidhya Bharti Mandal seeded.\n');
  console.log('  School Admin     admin@vidhyabharti.school           Admin@123');
  console.log('  Vice Principal   rakesh.sharma@vidhyabharti.school   Teacher@123');
  console.log('  Teacher          gaytri.soni@vidhyabharti.school     Teacher@123');
  console.log('  Parent           parent@vidhyabharti.school          Parent@123');
  console.log('  Student          student@vidhyabharti.school         Student@123');
  console.log('\n  9 staff, 50 students, Classes 1–10 (secondary).\n');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
