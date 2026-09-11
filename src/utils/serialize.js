const RELATION_TO_FK = [
  ['class', 'classId'],
  ['section', 'sectionId'],
  ['session', 'sessionId'],
  ['subject', 'subjectId'],
  ['teacher', 'teacherId'],
  ['student', 'studentId'],
  ['user', 'userId'],
  ['parent', 'parentId'],
  ['book', 'bookId'],
  ['vehicle', 'vehicleId'],
  ['route', 'routeId'],
  ['period', 'periodId'],
  ['invoice', 'invoiceId'],
  ['exam', 'examId'],
  ['examSubject', 'examSubjectId'],
  ['branch', 'branchId'],
  ['takenByUser', 'takenBy'],
  ['author', 'createdBy'],
  ['raiser', 'raisedBy'],
  ['reviewer', 'reviewedBy'],
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

export function toApi(doc) {
  if (doc == null) return doc;
  if (Array.isArray(doc)) return doc.map(toApi);
  if (doc instanceof Date) return doc;
  if (!isPlainObject(doc)) return doc;

  const obj = { ...doc };
  if (obj.password !== undefined) delete obj.password;

  if (obj.id != null) {
    obj._id = obj.id;
    delete obj.id;
  }

  for (const [rel, fk] of RELATION_TO_FK) {
    if (obj[rel] != null) {
      obj[fk] = toApi(obj[rel]);
      delete obj[rel];
    }
  }

  if (obj.records) obj.records = toApi(obj.records);
  if (obj.items) obj.items = toApi(obj.items);
  if (obj.stops) obj.stops = toApi(obj.stops);
  if (obj.students) obj.students = toApi(obj.students);
  if (obj.submissions) obj.submissions = toApi(obj.submissions);
  if (obj.payments) obj.payments = toApi(obj.payments);
  if (obj.subjects) obj.subjects = toApi(obj.subjects);
  if (obj.marks) obj.marks = toApi(obj.marks);

  if (obj.firstName != null) {
    obj.name = [obj.firstName, obj.lastName].filter(Boolean).join(' ');
  }

  return obj;
}

export function emptyToNull(value) {
  if (value === '' || value === undefined) return null;
  return value;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function toPrismaDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return value;
  const s = value.trim();
  if (!s) return null;
  if (DATE_ONLY.test(s)) return new Date(`${s}T00:00:00.000Z`);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isDateLikeKey(key) {
  return /date$/i.test(key) || key === 'dob' || /(At)$/.test(key);
}

export function flattenInput(body = {}) {
  const data = { ...body };
  delete data.id;
  delete data._id;
  delete data.createdAt;
  delete data.updatedAt;
  delete data.loginEmail;
  delete data.temporaryPassword;
  delete data.loginCreated;
  delete data.createLogin;
  delete data.parentEmail;
  delete data.parentName;
  delete data.parentPassword;
  delete data.parentPhone;
  delete data.adminEmail;
  delete data.adminPassword;
  delete data.adminName;
  delete data.password;

  for (const [key, value] of Object.entries(data)) {
    if (value === '') {
      data[key] = null;
    } else if (isPlainObject(value) && (value._id || value.id) && !Array.isArray(value)) {
      data[key] = value._id || value.id;
    } else if (typeof value === 'string' && isDateLikeKey(key)) {
      data[key] = toPrismaDate(value);
    }
  }
  return data;
}

export function tenantWhere(req, extra = {}) {
  const where = { ...extra };
  if (req.user?.role === 'super_admin' && req.query.tenantId) {
    where.tenantId = req.query.tenantId;
  } else if (req.user?.role !== 'super_admin') {
    where.tenantId = req.tenantId;
  }
  return where;
}

export function dateOnly(value) {
  const converted = toPrismaDate(value);
  if (!converted) return converted;
  return new Date(Date.UTC(converted.getUTCFullYear(), converted.getUTCMonth(), converted.getUTCDate()));
}
