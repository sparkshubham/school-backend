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
  ['/teachers', 'teacher', { include: { user: { omit: { password: true } } }, searchFields: ['name', 'employeeId', 'email'] }],
  ['/parents', 'parent', { include: { students: true, user: { omit: { password: true } } }, searchFields: ['name', 'email', 'phone'] }],
  ['/classes', 'schoolClass', { searchFields: ['name'] }],
  ['/sections', 'section', { include: { class: true }, searchFields: ['name'] }],
  ['/subjects', 'subject', { searchFields: ['name', 'code'] }],
  ['/class-subjects', 'classSubject', { include: { class: true, section: true, subject: true, teacher: true } }],
  ['/sessions', 'academicSession', { searchFields: ['name'] }],
  ['/branches', 'branch', { searchFields: ['name', 'code'] }],
  ['/periods', 'period', { searchFields: ['name'] }],
  ['/timetable', 'timetableSlot', { include: { class: true, section: true, period: true, subject: true, teacher: true } }],
  ['/homework', 'homework', { include: { class: true, section: true, subject: true, teacher: true }, searchFields: ['title'] }],
  ['/notices', 'notice', { searchFields: ['title', 'body'] }],
  ['/events', 'calendarEvent', { searchFields: ['title'] }],
  ['/enquiries', 'enquiry', { searchFields: ['studentName', 'parentName', 'phone'] }],
  ['/leaves', 'leaveRequest', { include: { user: { omit: { password: true } } }, searchFields: ['reason'] }],
  ['/complaints', 'complaint', { searchFields: ['title', 'body'] }],
  ['/books', 'book', { searchFields: ['name', 'author', 'isbn'] }],
  ['/book-issues', 'bookIssue', { include: { book: true, student: true } }],
  ['/vehicles', 'vehicle', { searchFields: ['number', 'driverName'] }],
  ['/routes', 'transportRoute', { include: { vehicle: true, stops: { orderBy: { order: 'asc' } } }, searchFields: ['name'] }],
  ['/student-transport', 'studentTransport', { include: { student: true, route: true } }],
  ['/users', 'user', { searchFields: ['name', 'email'] }],
];

for (const [path, model, options] of crudMounts) {
  const sub = Router();
  mountCrud(sub, createCrud(model, options));
  r.use(path, sub);
}

export default r;
