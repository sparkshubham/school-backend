import { prisma } from '../config/db.js';
import { tenantWhere, toApi } from '../utils/serialize.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { hashPassword } from '../utils/password.js';

const DEFAULT_PASSWORD = 'Teacher@123';

async function createTeacherLogin(teacher, { email, password, phone, tenantId }) {
  if (!email) throw new AppError('Email is required to create a teacher login');
  const existing = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), tenantId },
  });
  if (existing) throw new AppError('A login already exists for this email');
  const tempPassword = password || DEFAULT_PASSWORD;
  const user = await prisma.user.create({
    data: {
      tenantId,
      name: teacher.name,
      email: email.toLowerCase().trim(),
      password: await hashPassword(tempPassword),
      phone: phone || teacher.phone,
      role: 'teacher',
      linkedTeacherId: teacher.id,
    },
  });
  const updated = await prisma.teacher.update({
    where: { id: teacher.id },
    data: { userId: user.id, email: teacher.email || email },
  });
  return { teacher: updated, user, temporaryPassword: tempPassword };
}

export const createTeacher = asyncHandler(async (req, res) => {
  const body = { ...req.body, tenantId: req.tenantId };
  const teacher = await prisma.teacher.create({
    data: {
      tenantId: req.tenantId,
      employeeId: body.employeeId,
      name: body.name,
      dob: body.dob || null,
      gender: body.gender || null,
      phone: body.phone || null,
      email: body.email || null,
      qualification: body.qualification || null,
      experience: body.experience != null ? Number(body.experience) : null,
      joiningDate: body.joiningDate || null,
      department: body.department || null,
      designation: body.designation || null,
      salary: body.salary != null ? Number(body.salary) : null,
      status: body.status || 'active',
    },
  });
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
    ...toApi(login?.teacher || teacher),
    loginEmail: login?.user.email || null,
    temporaryPassword: login?.temporaryPassword || null,
    loginCreated: Boolean(login),
  });
});

export const createOrResetLogin = asyncHandler(async (req, res) => {
  const teacher = await prisma.teacher.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!teacher) throw new AppError('Teacher not found', 404);
  const email = (req.body.email || teacher.email || '').toLowerCase().trim();
  if (!email) throw new AppError('Add an email on the teacher profile first');
  const tempPassword = req.body.password || DEFAULT_PASSWORD;

  if (teacher.userId) {
    const user = await prisma.user.findUnique({ where: { id: teacher.userId } });
    if (!user) throw new AppError('Linked login is missing. Clear userId and try again.', 400);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email,
        password: await hashPassword(tempPassword),
        status: 'active',
      },
    });
    const updated = await prisma.teacher.update({
      where: { id: teacher.id },
      data: { email },
    });
    return res.json({
      teacher: toApi(updated),
      loginEmail: email,
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
    teacher: toApi(login.teacher),
    loginEmail: login.user.email,
    temporaryPassword: login.temporaryPassword,
    reset: false,
  });
});
