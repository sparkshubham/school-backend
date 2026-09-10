import { Teacher } from '../models/Teacher.js';
import { User } from '../models/User.js';
import { tenantScope } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../utils/errors.js';

const DEFAULT_PASSWORD = 'Teacher@123';

async function createTeacherLogin(teacher, { email, password, phone, tenantId }) {
  if (!email) throw new AppError('Email is required to create a teacher login');
  const existing = await User.findOne({ email: email.toLowerCase().trim(), tenantId });
  if (existing) throw new AppError('A login already exists for this email');
  const tempPassword = password || DEFAULT_PASSWORD;
  const user = await User.create({
    tenantId,
    name: teacher.name,
    email: email.toLowerCase().trim(),
    password: tempPassword,
    phone: phone || teacher.phone,
    role: 'teacher',
    linkedTeacherId: teacher._id,
  });
  teacher.userId = user._id;
  teacher.email = teacher.email || email;
  await teacher.save();
  return { user, temporaryPassword: tempPassword };
}

export const createTeacher = asyncHandler(async (req, res) => {
  const body = { ...req.body, tenantId: req.tenantId };
  const teacher = await Teacher.create(body);
  let login = null;
  if (body.email) {
    login = await createTeacherLogin(teacher, {
      email: body.email,
      password: body.password,
      phone: body.phone,
      tenantId: req.tenantId,
    });
  }
  res.status(201).json({
    ...teacher.toObject(),
    loginEmail: login?.user.email || null,
    temporaryPassword: login?.temporaryPassword || null,
    loginCreated: Boolean(login),
  });
});

export const createOrResetLogin = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findOne(tenantScope({ _id: req.params.id }, req));
  if (!teacher) throw new AppError('Teacher not found', 404);
  const email = (req.body.email || teacher.email || '').toLowerCase().trim();
  if (!email) throw new AppError('Add an email on the teacher profile first');
  const tempPassword = req.body.password || DEFAULT_PASSWORD;

  if (teacher.userId) {
    const user = await User.findById(teacher.userId).select('+password');
    if (!user) throw new AppError('Linked login is missing. Clear userId and try again.', 400);
    user.email = email;
    user.password = tempPassword;
    user.status = 'active';
    await user.save();
    teacher.email = email;
    await teacher.save();
    return res.json({
      teacher,
      loginEmail: user.email,
      temporaryPassword: tempPassword,
      reset: true,
    });
  }

  const login = await createTeacherLogin(teacher, {
    email,
    password: tempPassword,
    phone: teacher.phone,
    tenantId: req.tenantId,
  });
  res.json({
    teacher,
    loginEmail: login.user.email,
    temporaryPassword: login.temporaryPassword,
    reset: false,
  });
});
