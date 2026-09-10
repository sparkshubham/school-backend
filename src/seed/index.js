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
import { Plan, SubscriptionPayment } from '../models/Subscription.js';

const PASS = 'Admin@123';

function d(y, m, day) {
  return new Date(y, m - 1, day);
}

async function reset() {
  const cols = await mongoose.connection.db.collections();
  for (const c of cols) await c.deleteMany({});
}

async function seed() {
  await connectDb(process.env.MONGO_URI);
  await reset();

  for (const [key, p] of Object.entries(PLANS)) {
    await Plan.create({ name: p.label, key, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly, modules: p.modules });
  }

  await User.create({
    name: 'EduNest Super Admin',
    email: 'superadmin@edunest.io',
    password: PASS,
    phone: '9000000000',
    role: 'super_admin',
  });

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 10);
  const expired = d(2026, 6, 1);

  const [greenwood, sunrise, valley] = await Tenant.create([
    {
      name: 'Greenwood Public School',
      slug: 'greenwood',
      email: 'admin@greenwood.school',
      phone: '01482-240100',
      website: 'https://greenwood.school',
      address: 'Azad Nagar, Bhilwara',
      city: 'Bhilwara',
      state: 'Rajasthan',
      pincode: '311001',
      principalName: 'Dr. Meera Sharma',
      registrationNo: 'RJ-EDU-2014-8821',
      affiliation: 'CBSE 1730291',
      academicSession: '2026-27',
      status: 'active',
      plan: 'professional',
      modules: PLANS.professional.modules,
      subscriptionEndsAt: d(2027, 3, 31),
    },
    {
      name: 'Sunrise International Academy',
      slug: 'sunrise',
      email: 'admin@sunrise.edu',
      phone: '0141-220011',
      city: 'Jaipur',
      state: 'Rajasthan',
      principalName: 'Mr. Anil Gupta',
      status: 'trial',
      plan: 'basic',
      modules: PLANS.basic.modules,
      trialEndsAt: trialEnd,
    },
    {
      name: 'Valley Convent School',
      slug: 'valley',
      email: 'admin@valley.edu',
      city: 'Udaipur',
      state: 'Rajasthan',
      status: 'expired',
      plan: 'enterprise',
      modules: PLANS.enterprise.modules,
      subscriptionEndsAt: expired,
    },
  ]);

  await SubscriptionPayment.create([
    { tenantId: greenwood._id, amount: 99990, plan: 'professional', period: 'yearly', status: 'paid', paidAt: d(2026, 4, 5) },
    { tenantId: greenwood._id, amount: 99990, plan: 'professional', period: 'yearly', status: 'paid', paidAt: d(2025, 4, 2) },
    { tenantId: valley._id, amount: 199990, plan: 'enterprise', period: 'yearly', status: 'paid', paidAt: d(2025, 4, 10) },
  ]);

  await User.create({
    tenantId: sunrise._id,
    name: 'Sunrise Admin',
    email: 'admin@sunrise.edu',
    password: PASS,
    role: 'school_admin',
  });

  const tid = greenwood._id;
  const branch = await Branch.create({
    tenantId: tid,
    name: 'Main Campus',
    code: 'MAIN',
    address: 'Azad Nagar, Bhilwara',
    phone: '01482-240100',
    isMain: true,
  });

  const admin = await User.create({
    tenantId: tid,
    branchId: branch._id,
    name: 'Rajesh Mehta',
    email: 'admin@greenwood.school',
    password: PASS,
    phone: '9829011111',
    role: 'school_admin',
  });

  const session = await AcademicSession.create({
    tenantId: tid,
    name: '2026-27',
    startDate: d(2026, 4, 1),
    endDate: d(2027, 3, 31),
    isCurrent: true,
  });

  const classDocs = [];
  for (let n = 1; n <= 12; n += 1) {
    classDocs.push(await SchoolClass.create({ tenantId: tid, name: `Class ${n}`, numeric: n, order: n }));
  }
  const class10 = classDocs[9];
  const class9 = classDocs[8];

  const secA = await Section.create({ tenantId: tid, classId: class10._id, name: 'A', capacity: 40 });
  const secB = await Section.create({ tenantId: tid, classId: class10._id, name: 'B', capacity: 40 });
  await Section.create({ tenantId: tid, classId: class9._id, name: 'A', capacity: 40 });

  const subjectNames = [
    ['Mathematics', 'MATH'],
    ['English', 'ENG'],
    ['Hindi', 'HIN'],
    ['Science', 'SCI'],
    ['Social Science', 'SST'],
    ['Computer', 'CS'],
    ['Physics', 'PHY'],
    ['Chemistry', 'CHE'],
    ['Biology', 'BIO'],
  ];
  const subjects = {};
  for (const [name, code] of subjectNames) {
    subjects[code] = await Subject.create({ tenantId: tid, name, code });
  }

  const teacherSeed = [
    ['Priya Verma', 'T-101', 'Mathematics', 'PGT Maths', 'priya.verma@greenwood.school'],
    ['Amit Joshi', 'T-102', 'English', 'PGT English', 'amit.joshi@greenwood.school'],
    ['Neha Singh', 'T-103', 'Science', 'TGT Science', 'neha.singh@greenwood.school'],
    ['Rakesh Yadav', 'T-104', 'Hindi', 'TGT Hindi', 'rakesh.yadav@greenwood.school'],
    ['Sonal Jain', 'T-105', 'Computer', 'PGT Computer', 'sonal.jain@greenwood.school'],
    ['Vikram Rathore', 'T-106', 'Social Science', 'TGT SST', 'vikram.rathore@greenwood.school'],
  ];
  const teachers = [];
  for (const [name, emp, dept, desig, email] of teacherSeed) {
    const user = await User.create({
      tenantId: tid,
      name,
      email,
      password: 'Teacher@123',
      role: 'teacher',
      phone: '98' + Math.floor(20000000 + Math.random() * 70000000),
    });
    const t = await Teacher.create({
      tenantId: tid,
      userId: user._id,
      employeeId: emp,
      name,
      email,
      phone: user.phone,
      gender: name.startsWith('Priya') || name.startsWith('Neha') || name.startsWith('Sonal') ? 'female' : 'male',
      qualification: 'M.A., B.Ed',
      experience: 6 + teachers.length,
      joiningDate: d(2018, 6, 15),
      department: dept,
      designation: desig,
      salary: 45000 + teachers.length * 3000,
    });
    user.linkedTeacherId = t._id;
    await user.save();
    teachers.push(t);
  }

  const map = [
    [subjects.MATH, teachers[0]],
    [subjects.ENG, teachers[1]],
    [subjects.SCI, teachers[2]],
    [subjects.HIN, teachers[3]],
    [subjects.CS, teachers[4]],
    [subjects.SST, teachers[5]],
  ];
  for (const [sub, teach] of map) {
    await ClassSubject.create({
      tenantId: tid,
      classId: class10._id,
      sectionId: secA._id,
      subjectId: sub._id,
      teacherId: teach._id,
    });
  }

  const studentRows = [
    ['Rahul', 'Sharma', 'male', 1],
    ['Aman', 'Gupta', 'male', 2],
    ['Priya', 'Meena', 'female', 3],
    ['Neha', 'Jain', 'female', 4],
    ['Rohit', 'Singh', 'male', 5],
    ['Ananya', 'Rathore', 'female', 6],
    ['Kabir', 'Malik', 'male', 7],
    ['Isha', 'Agarwal', 'female', 8],
    ['Arjun', 'Choudhary', 'male', 9],
    ['Diya', 'Kapoor', 'female', 10],
    ['Vivaan', 'Sharma', 'male', 11],
    ['Sara', 'Khan', 'female', 12],
  ];

  const students = [];
  let firstParent = null;
  for (const [first, last, gender, roll] of studentRows) {
    const admissionNo = `2026${String(roll).padStart(4, '0')}`;
    const parentName = gender === 'female' ? `Mr. ${last}` : `Mr. ${last}`;
    const parentEmail = roll === 1 ? 'parent@greenwood.school' : `parent.${last.toLowerCase()}${roll}@greenwood.school`;
    const pUser = await User.create({
      tenantId: tid,
      name: parentName,
      email: parentEmail,
      password: 'Parent@123',
      role: 'parent',
      phone: '97' + String(10000000 + roll * 1111),
    });
    const parent = await Parent.create({
      tenantId: tid,
      userId: pUser._id,
      name: `${first} ${last}'s Father`,
      relation: 'father',
      phone: pUser.phone,
      email: parentEmail,
      occupation: 'Business',
      students: [],
    });
    pUser.linkedParentId = parent._id;
    await pUser.save();
    if (roll === 1) firstParent = parent;

    const sUser = await User.create({
      tenantId: tid,
      name: `${first} ${last}`,
      email: roll === 1 ? 'student@greenwood.school' : `${first.toLowerCase()}.${last.toLowerCase()}@greenwood.school`,
      password: 'Student@123',
      role: 'student',
    });

    const student = await Student.create({
      tenantId: tid,
      branchId: branch._id,
      userId: sUser._id,
      parentId: parent._id,
      admissionNo,
      rollNo: String(roll),
      firstName: first,
      lastName: last,
      dob: d(2011, ((roll % 12) + 1), 8 + roll),
      gender,
      bloodGroup: ['A+', 'B+', 'O+', 'AB+', 'O-'][roll % 5],
      classId: class10._id,
      sectionId: secA._id,
      sessionId: session._id,
      previousSchool: roll % 3 === 0 ? 'Little Flower School' : '',
      admissionDate: d(2024, 4, 10),
      address: `${roll * 12}, Gandhi Nagar`,
      city: 'Bhilwara',
      state: 'Rajasthan',
      pincode: '311001',
      fatherName: `Mr. ${last}`,
      fatherPhone: pUser.phone,
      motherName: `Mrs. ${last}`,
      email: sUser.email,
    });
    sUser.linkedStudentId = student._id;
    await sUser.save();
    parent.students = [student._id];
    await parent.save();
    students.push(student);
  }

  const today = new Date(2026, 7, 19);
  for (let offset = 0; offset < 8; offset += 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    if (date.getDay() === 0) continue;
    await Attendance.create({
      tenantId: tid,
      classId: class10._id,
      sectionId: secA._id,
      date,
      takenBy: admin._id,
      records: students.map((s, i) => {
        let status = 'present';
        if (i === 2 && offset === 0) status = 'absent';
        if (i === 3 && offset === 0) status = 'late';
        if (i === 4 && offset < 2) status = 'leave';
        if (offset === 3 && i % 5 === 0) status = 'absent';
        return { studentId: s._id, status };
      }),
    });
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
  const cycle = map;
  for (const day of days) {
    let i = 0;
    for (const p of periods) {
      if (p.isBreak) continue;
      const pair = cycle[i % cycle.length];
      await TimetableSlot.create({
        tenantId: tid,
        classId: class10._id,
        sectionId: secA._id,
        day,
        periodId: p._id,
        subjectId: pair[0]._id,
        teacherId: pair[1]._id,
        room: 'R-12',
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
  const examSubs = [];
  const marksMap = {
    MATH: [91, 78, 64, 88, 55, 82, 70, 95, 60, 84, 73, 89],
    ENG: [78, 81, 69, 90, 62, 85, 74, 88, 71, 80, 67, 92],
    SCI: [84, 76, 71, 86, 58, 90, 79, 93, 66, 81, 75, 87],
    HIN: [88, 80, 73, 91, 64, 77, 82, 85, 70, 79, 68, 90],
    CS: [95, 88, 80, 92, 70, 86, 84, 97, 75, 89, 81, 94],
  };
  for (const [code, teachPair] of [
    ['MATH', map[0]],
    ['ENG', map[1]],
    ['SCI', map[2]],
    ['HIN', map[3]],
    ['CS', map[4]],
  ]) {
    const es = await ExamSubject.create({
      tenantId: tid,
      examId: exam._id,
      subjectId: teachPair[0]._id,
      classId: class10._id,
      maxMarks: 100,
      passMarks: 33,
      date: d(2026, 9, 12),
    });
    examSubs.push([es, marksMap[code]]);
  }
  for (const [es, scores] of examSubs) {
    for (let i = 0; i < students.length; i += 1) {
      const obtained = scores[i];
      await Mark.create({
        tenantId: tid,
        examId: exam._id,
        examSubjectId: es._id,
        studentId: students[i]._id,
        obtained,
        grade: obtained >= 90 ? 'A+' : obtained >= 80 ? 'A' : obtained >= 70 ? 'B+' : obtained >= 60 ? 'B' : obtained >= 50 ? 'C' : 'D',
      });
    }
  }
  await Exam.create({
    tenantId: tid,
    sessionId: session._id,
    name: 'Annual Examination',
    type: 'final',
    startDate: d(2027, 2, 20),
    endDate: d(2027, 3, 5),
    status: 'scheduled',
  });

  const structure = await FeeStructure.create({
    tenantId: tid,
    classId: class10._id,
    sessionId: session._id,
    items: [
      { name: 'Admission Fee', amount: 10000 },
      { name: 'Tuition Fee', amount: 30000 },
      { name: 'Transport', amount: 12000 },
      { name: 'Exam Fee', amount: 2000 },
      { name: 'Activity Fee', amount: 3000 },
    ],
  });
  const totalFee = structure.items.reduce((s, i) => s + i.amount, 0);
  for (let i = 0; i < students.length; i += 1) {
    const paid = i < 7 ? (i < 4 ? totalFee : 25000) : 0;
    const invoice = await FeeInvoice.create({
      tenantId: tid,
      studentId: students[i]._id,
      sessionId: session._id,
      invoiceNo: `INV-2026-${String(i + 1).padStart(4, '0')}`,
      items: structure.items,
      total: totalFee,
      paid,
      due: totalFee - paid,
      dueDate: d(2026, 8, 25),
      status: paid === totalFee ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
    });
    if (paid) {
      await FeePayment.create({
        tenantId: tid,
        invoiceId: invoice._id,
        studentId: students[i]._id,
        amount: paid,
        method: i % 2 === 0 ? 'upi' : 'cash',
        receiptNo: `RCP-2026-${String(i + 1).padStart(4, '0')}`,
        paidAt: d(2026, 8, 10 + (i % 8)),
      });
    }
  }

  await Homework.create([
    {
      tenantId: tid,
      classId: class10._id,
      sectionId: secA._id,
      subjectId: subjects.SCI._id,
      teacherId: teachers[2]._id,
      title: 'Science Chapter 5 — Chemical Reactions',
      description: 'Complete NCERT exercises 5.1 to 5.8. Submit a short lab observation note.',
      dueDate: d(2026, 8, 22),
    },
    {
      tenantId: tid,
      classId: class10._id,
      sectionId: secA._id,
      subjectId: subjects.MATH._id,
      teacherId: teachers[0]._id,
      title: 'Quadratic Equations worksheet',
      description: 'Solve the attached worksheet. Show all steps.',
      dueDate: d(2026, 8, 21),
    },
  ]);

  await Notice.create([
    {
      tenantId: tid,
      title: 'Independence Day celebration',
      body: 'Flag hoisting at 8:00 AM on 15 August. All students in house uniform.',
      audience: 'all',
      pinned: true,
      createdBy: admin._id,
    },
    {
      tenantId: tid,
      title: 'Fee reminder — August installment',
      body: 'Pending fees should be cleared on or before 25 August 2026 to avoid late charges.',
      audience: 'parents',
      createdBy: admin._id,
    },
    {
      tenantId: tid,
      title: 'PTM for Class 10',
      body: 'Parent-teacher meeting on 28 August, 9:00 AM to 12:00 PM.',
      audience: 'class',
      classId: class10._id,
      createdBy: admin._id,
    },
  ]);

  await Event.create([
    { tenantId: tid, title: 'Sports Day', type: 'sports', startDate: d(2026, 8, 30), endDate: d(2026, 8, 30), description: 'Annual athletics meet.' },
    { tenantId: tid, title: 'Parent Meeting', type: 'meeting', startDate: d(2026, 8, 28), description: 'Class 10 PTM' },
    { tenantId: tid, title: 'Annual Examination', type: 'exam', startDate: d(2027, 2, 20), endDate: d(2027, 3, 5) },
  ]);

  await Enquiry.create([
    { tenantId: tid, studentName: 'Harsh Patel', parentName: 'Suresh Patel', phone: '9876500011', classApplying: 'Class 10', previousSchool: 'St. Marys', source: 'Walk-in', status: 'interested', followUpDate: d(2026, 8, 21) },
    { tenantId: tid, studentName: 'Kiara Sharma', parentName: 'Pooja Sharma', phone: '9876500022', classApplying: 'Class 9', source: 'Website', status: 'new' },
    { tenantId: tid, studentName: 'Dev Joshi', parentName: 'Nitin Joshi', phone: '9876500033', classApplying: 'Class 11', source: 'Referral', status: 'visit_scheduled', followUpDate: d(2026, 8, 20) },
  ]);

  await LeaveRequest.create({
    tenantId: tid,
    userId: teachers[2].userId,
    role: 'teacher',
    type: 'sick',
    fromDate: d(2026, 8, 20),
    toDate: d(2026, 8, 21),
    reason: 'Medical appointment',
    status: 'pending',
  });

  await Complaint.create({
    tenantId: tid,
    raisedBy: firstParent.userId,
    category: 'transport',
    title: 'Bus delay on Gandhi Nagar stop',
    body: 'The morning bus has been 15–20 minutes late this week.',
    status: 'open',
  });

  const books = await Book.create([
    { tenantId: tid, isbn: '9788174506429', name: 'NCERT Mathematics Class 10', author: 'NCERT', category: 'Textbook', rack: 'A-1', quantity: 40, available: 36 },
    { tenantId: tid, isbn: '9780143333418', name: 'The Diary of a Young Girl', author: 'Anne Frank', category: 'Literature', rack: 'B-3', quantity: 8, available: 6 },
  ]);
  await BookIssue.create({
    tenantId: tid,
    bookId: books[1]._id,
    studentId: students[0]._id,
    issueDate: d(2026, 8, 10),
    dueDate: d(2026, 8, 24),
    status: 'issued',
  });

  const bus = await Vehicle.create({
    tenantId: tid,
    number: 'RJ-06-GA-2405',
    type: 'bus',
    capacity: 40,
    driverName: 'Rajesh',
    driverPhone: '9828099999',
  });
  const route = await TransportRoute.create({
    tenantId: tid,
    name: 'Bhilwara City',
    vehicleId: bus._id,
    stops: [
      { name: 'Azad Nagar', order: 1, pickupTime: '07:10' },
      { name: 'Kumbha Circle', order: 2, pickupTime: '07:20' },
      { name: 'Gandhi Nagar', order: 3, pickupTime: '07:30' },
      { name: 'School', order: 4, pickupTime: '07:45' },
    ],
  });
  await StudentTransport.create({
    tenantId: tid,
    studentId: students[0]._id,
    routeId: route._id,
    stopName: 'Gandhi Nagar',
  });

  console.log('\nEduNest seed complete.\n');
  console.log('  Super Admin   superadmin@edunest.io      Admin@123');
  console.log('  School Admin  admin@greenwood.school     Admin@123');
  console.log('  Teacher       priya.verma@greenwood.school  Teacher@123');
  console.log('  Parent        parent@greenwood.school    Parent@123');
  console.log('  Student       student@greenwood.school   Student@123\n');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
