export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  SCHOOL_ADMIN: 'school_admin',
  PRINCIPAL: 'principal',
  TEACHER: 'teacher',
  ACCOUNTANT: 'accountant',
  LIBRARIAN: 'librarian',
  RECEPTIONIST: 'receptionist',
  PARENT: 'parent',
  STUDENT: 'student',
  STAFF: 'staff',
};

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  school_admin: 'School Admin',
  principal: 'Principal',
  teacher: 'Teacher',
  accountant: 'Accountant',
  librarian: 'Librarian',
  receptionist: 'Receptionist',
  parent: 'Parent',
  student: 'Student',
  staff: 'Staff',
};

export const PLANS = {
  basic: {
    label: 'Basic',
    priceMonthly: 4999,
    priceYearly: 49990,
    modules: ['students', 'teachers', 'attendance', 'fees', 'exams', 'notices', 'events'],
  },
  professional: {
    label: 'Professional',
    priceMonthly: 9999,
    priceYearly: 99990,
    modules: [
      'students', 'teachers', 'attendance', 'fees', 'exams', 'notices', 'events',
      'homework', 'timetable', 'admissions', 'library', 'transport', 'hr', 'payroll', 'parent_app',
    ],
  },
  enterprise: {
    label: 'Enterprise',
    priceMonthly: 19999,
    priceYearly: 199990,
    modules: [
      'students', 'teachers', 'attendance', 'fees', 'exams', 'notices', 'events',
      'homework', 'timetable', 'admissions', 'library', 'transport', 'hr', 'payroll', 'parent_app',
      'branches', 'advanced_reports', 'api', 'whatsapp', 'branding', 'hostel', 'inventory', 'accounting',
    ],
  },
};

export const ATTENDANCE_STATUS = ['present', 'absent', 'late', 'half_day', 'leave'];
export const ENQUIRY_STATUS = [
  'new', 'contacted', 'interested', 'visit_scheduled', 'application', 'selected', 'rejected', 'admitted',
];
export const INVOICE_STATUS = ['unpaid', 'partial', 'paid', 'overdue'];
export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank_transfer', 'online'];
export const LEAVE_TYPES = ['casual', 'sick', 'earned', 'emergency'];
export const COMPLAINT_STATUS = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];
