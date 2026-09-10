import { Router } from 'express';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { attachTenant } from '../middleware/tenant.js';
import * as dash from '../controllers/dashboard.controller.js';
import * as school from '../controllers/school.controller.js';
import * as students from '../controllers/student.controller.js';
import * as attendance from '../controllers/attendance.controller.js';
import * as fees from '../controllers/fee.controller.js';
import * as exams from '../controllers/exam.controller.js';
import * as teachers from '../controllers/teacher.controller.js';
import { createCrud, mountCrud } from '../utils/crud.js';
import { Teacher } from '../models/Teacher.js';
import { Parent } from '../models/Parent.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { Section } from '../models/Section.js';
import { Subject } from '../models/Subject.js';
import { ClassSubject } from '../models/ClassSubject.js';
import { AcademicSession } from '../models/AcademicSession.js';
import { Branch } from '../models/Branch.js';
import { Period, TimetableSlot } from '../models/Timetable.js';
import { Homework } from '../models/Homework.js';
import { Notice, Event, Enquiry, LeaveRequest, Complaint } from '../models/Ops.js';
import { Book, BookIssue } from '../models/Library.js';
import { Vehicle, TransportRoute, StudentTransport } from '../models/Transport.js';
import { User } from '../models/User.js';

const r = Router();
r.use(requireAuth, attachTenant);

r.get('/dashboard/super', requireRoles('super_admin'), dash.superDashboard);
r.get('/dashboard/school', dash.schoolDashboard);
r.get('/dashboard/teacher', dash.teacherDashboard);
r.get('/dashboard/parent', dash.parentDashboard);
r.get('/dashboard/student', dash.studentDashboard);

r.get('/schools', requireRoles('super_admin'), school.listSchools);
r.post('/schools', requireRoles('super_admin'), school.createSchool);
r.get('/schools/:id', requireRoles('super_admin'), school.getSchool);
r.patch('/schools/:id', requireRoles('super_admin'), school.updateSchool);
r.post('/schools/:id/impersonate', requireRoles('super_admin'), school.loginAsAdmin);

r.get('/school/profile', school.getProfile);
r.patch('/school/profile', requireRoles('school_admin', 'principal'), school.updateProfile);

r.get('/students', students.listStudents);
r.get('/students/:id', students.getStudent);
r.post('/students', students.createStudent);
r.patch('/students/:id', students.updateStudent);
r.delete('/students/:id', students.removeStudent);

r.get('/attendance/sheet', attendance.getSheet);
r.post('/attendance/sheet', attendance.saveSheet);
r.get('/attendance/reports', attendance.reports);

r.get('/fees/structures', fees.listStructures);
r.post('/fees/structures', fees.saveStructure);
r.patch('/fees/structures/:id', fees.saveStructure);
r.post('/fees/generate', fees.generateInvoices);
r.get('/fees/invoices', fees.listInvoices);
r.post('/fees/collect', fees.collect);
r.get('/fees/payments', fees.payments);
r.get('/fees/reports', fees.feeReport);

r.get('/exams', exams.listExams);
r.post('/exams', exams.createExam);
r.patch('/exams/:id', exams.updateExam);
r.get('/exams/:id/subjects', exams.listSubjects);
r.post('/exams/:id/subjects', exams.addSubject);
r.post('/exams/marks', exams.saveMarks);
r.get('/exams/:id/results', exams.results);
r.get('/exams/:examId/students/:studentId', exams.studentResult);

r.post('/teachers', teachers.createTeacher);
r.post('/teachers/:id/login', teachers.createOrResetLogin);

const crudMounts = [
  ['/teachers', Teacher, { populate: ['userId'], searchFields: ['name', 'employeeId', 'email'] }],
  ['/parents', Parent, { populate: ['students', 'userId'], searchFields: ['name', 'email', 'phone'] }],
  ['/classes', SchoolClass, { searchFields: ['name'] }],
  ['/sections', Section, { populate: ['classId'], searchFields: ['name'] }],
  ['/subjects', Subject, { searchFields: ['name', 'code'] }],
  ['/class-subjects', ClassSubject, { populate: ['classId', 'sectionId', 'subjectId', 'teacherId'] }],
  ['/sessions', AcademicSession, { searchFields: ['name'] }],
  ['/branches', Branch, { searchFields: ['name', 'code'] }],
  ['/periods', Period, { searchFields: ['name'] }],
  ['/timetable', TimetableSlot, { populate: ['classId', 'sectionId', 'periodId', 'subjectId', 'teacherId'] }],
  ['/homework', Homework, { populate: ['classId', 'sectionId', 'subjectId', 'teacherId'], searchFields: ['title'] }],
  ['/notices', Notice, { searchFields: ['title', 'body'] }],
  ['/events', Event, { searchFields: ['title'] }],
  ['/enquiries', Enquiry, { searchFields: ['studentName', 'parentName', 'phone'] }],
  ['/leaves', LeaveRequest, { populate: ['userId'], searchFields: ['reason'] }],
  ['/complaints', Complaint, { searchFields: ['title', 'body'] }],
  ['/books', Book, { searchFields: ['name', 'author', 'isbn'] }],
  ['/book-issues', BookIssue, { populate: ['bookId', 'studentId'] }],
  ['/vehicles', Vehicle, { searchFields: ['number', 'driverName'] }],
  ['/routes', TransportRoute, { populate: ['vehicleId'], searchFields: ['name'] }],
  ['/student-transport', StudentTransport, { populate: ['studentId', 'routeId'] }],
  ['/users', User, { searchFields: ['name', 'email'] }],
];

for (const [path, Model, options] of crudMounts) {
  const sub = Router();
  mountCrud(sub, createCrud(Model, options));
  r.use(path, sub);
}

export default r;
