import { Student } from '../models/Student.js';
import { User } from '../models/User.js';
import { Parent } from '../models/Parent.js';
import { tenantScope } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../utils/errors.js';

const populate = [
  { path: 'classId', select: 'name numeric' },
  { path: 'sectionId', select: 'name' },
  { path: 'sessionId', select: 'name' },
  { path: 'parentId' },
];

export const listStudents = asyncHandler(async (req, res) => {
  const filter = tenantScope({ status: req.query.status || { $ne: 'deleted' } }, req);
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.sectionId) filter.sectionId = req.query.sectionId;
  const q = (req.query.q || '').trim();
  if (q) {
    filter.$or = [
      { firstName: new RegExp(q, 'i') },
      { lastName: new RegExp(q, 'i') },
      { admissionNo: new RegExp(q, 'i') },
      { rollNo: new RegExp(q, 'i') },
    ];
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const [items, total] = await Promise.all([
    Student.find(filter)
      .populate(populate)
      .sort({ rollNo: 1, firstName: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Student.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

export const getStudent = asyncHandler(async (req, res) => {
  const item = await Student.findOne(tenantScope({ _id: req.params.id }, req)).populate(populate);
  if (!item) throw new AppError('Student not found', 404);
  res.json(item);
});

export const createStudent = asyncHandler(async (req, res) => {
  const body = { ...req.body, tenantId: req.tenantId };
  const student = await Student.create(body);
  if (body.createLogin && body.email) {
    const user = await User.create({
      tenantId: req.tenantId,
      name: `${body.firstName} ${body.lastName || ''}`.trim(),
      email: body.email,
      password: body.password || 'Student@123',
      phone: body.phone,
      role: 'student',
      linkedStudentId: student._id,
    });
    student.userId = user._id;
    await student.save();
  }
  if (body.parentEmail && body.parentName) {
    let parent = await Parent.findOne({ tenantId: req.tenantId, email: body.parentEmail });
    if (!parent) {
      const pUser = await User.create({
        tenantId: req.tenantId,
        name: body.parentName,
        email: body.parentEmail,
        password: body.parentPassword || 'Parent@123',
        phone: body.fatherPhone || body.parentPhone,
        role: 'parent',
      });
      parent = await Parent.create({
        tenantId: req.tenantId,
        userId: pUser._id,
        name: body.parentName,
        phone: body.fatherPhone,
        email: body.parentEmail,
        students: [student._id],
      });
      pUser.linkedParentId = parent._id;
      await pUser.save();
    } else {
      parent.students.push(student._id);
      await parent.save();
    }
    student.parentId = parent._id;
    await student.save();
  }
  res.status(201).json(student);
});

export const updateStudent = asyncHandler(async (req, res) => {
  const item = await Student.findOneAndUpdate(
    tenantScope({ _id: req.params.id }, req),
    req.body,
    { new: true, runValidators: true }
  );
  if (!item) throw new AppError('Student not found', 404);
  res.json(item);
});

export const removeStudent = asyncHandler(async (req, res) => {
  const item = await Student.findOneAndUpdate(
    tenantScope({ _id: req.params.id }, req),
    { status: 'inactive' },
    { new: true }
  );
  if (!item) throw new AppError('Student not found', 404);
  res.json({ ok: true });
});
