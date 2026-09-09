// Thin typed wrapper around the contextBridge `window.api.invoke` call.
// Every IPC handler in electron/ipc/*.cjs returns { success, data } or
// { success: false, error }. This wrapper unwraps that so callers can use
// plain async/await and try/catch with a user-friendly Error message.

declare global {
  interface Window {
    api: {
      invoke: (channel: string, ...args: any[]) => Promise<{ success: boolean; data?: any; error?: string; code?: string }>;
    };
  }
}

export async function call<T = any>(channel: string, ...args: any[]): Promise<T> {
  const result = await window.api.invoke(channel, ...args);
  if (!result || result.success !== true) {
    throw new Error(result?.error || "Something went wrong. Please try again.");
  }
  return result.data as T;
}

export const api = {
  // Setup / auth
  setupStatus: () => call("setup:status"),
  setupComplete: (payload: any) => call("setup:complete", payload),
  login: (payload: { username: string; password: string }) => call("auth:login", payload),
  logout: () => call("auth:logout"),
  currentUser: () => call("auth:currentUser"),
  changePassword: (payload: any) => call("auth:changePassword", payload),
  resetPassword: (payload: any) => call("auth:resetPassword", payload),

  // Users / roles
  users: {
    list: () => call("users:list"),
    create: (payload: any) => call("users:create", payload),
    update: (id: number, payload: any) => call("users:update", id, payload),
    setStatus: (id: number, status: string) => call("users:setStatus", id, status),
  },
  roles: {
    list: () => call("roles:list"),
    permissions: () => call("permissions:list"),
    getPermissions: (roleId: number) => call("roles:getPermissions", roleId),
    create: (payload: any) => call("roles:create", payload),
    updatePermissions: (roleId: number, ids: number[]) => call("roles:updatePermissions", roleId, ids),
    delete: (roleId: number) => call("roles:delete", roleId),
  },

  // Settings
  settings: {
    getSchool: () => call("settings:getSchool"),
    updateSchool: (payload: any) => call("settings:updateSchool", payload),
    getMisc: () => call("settings:getMisc"),
    setMisc: (obj: any) => call("settings:setMisc", obj),
    getGradingScale: () => call("settings:getGradingScale"),
    saveGradingScale: (rows: any[]) => call("settings:saveGradingScale", rows),
  },

  // Academic
  academic: {
    listSessions: () => call("academic:listSessions"),
    createSession: (payload: any) => call("academic:createSession", payload),
    setCurrentSession: (id: number) => call("academic:setCurrentSession", id),
    listClasses: () => call("academic:listClasses"),
    createClass: (payload: any) => call("academic:createClass", payload),
    updateClass: (id: number, payload: any) => call("academic:updateClass", id, payload),
    listSections: (classId?: number) => call("academic:listSections", classId),
    createSection: (payload: any) => call("academic:createSection", payload),
    updateSection: (id: number, payload: any) => call("academic:updateSection", id, payload),
    listSubjects: () => call("academic:listSubjects"),
    createSubject: (payload: any) => call("academic:createSubject", payload),
    updateSubject: (id: number, payload: any) => call("academic:updateSubject", id, payload),
    listClassSubjects: (classId: number) => call("academic:listClassSubjects", classId),
    assignSubject: (payload: any) => call("academic:assignSubject", payload),
    removeClassSubject: (id: number) => call("academic:removeClassSubject", id),
  },

  loadDemoData: () => call("system:loadDemoData"),

  // Students / parents / admissions
  students: {
    search: (params: any) => call("students:search", params),
    getById: (id: number) => call("students:getById", id),
    create: (payload: any) => call("students:create", payload),
    update: (id: number, payload: any) => call("students:update", id, payload),
    setStatus: (id: number, status: string) => call("students:setStatus", id, status),
    linkParent: (studentId: number, parentId: number, isPrimary?: boolean) => call("students:linkParent", studentId, parentId, isPrimary),
    unlinkParent: (studentId: number, parentId: number) => call("students:unlinkParent", studentId, parentId),
    importBulk: (rows: any[]) => call("students:importBulk", rows),
  },
  parents: {
    search: (params: any) => call("parents:search", params),
    getById: (id: number) => call("parents:getById", id),
    create: (payload: any) => call("parents:create", payload),
    update: (id: number, payload: any) => call("parents:update", id, payload),
    setStatus: (id: number, status: string) => call("parents:setStatus", id, status),
  },
  admissions: {
    list: (params?: any) => call("admissions:list", params),
    getById: (id: number) => call("admissions:getById", id),
    create: (payload: any) => call("admissions:create", payload),
    moveStage: (id: number, stage: string, extra?: any) => call("admissions:moveStage", id, stage, extra),
    enroll: (id: number, extra?: any) => call("admissions:enroll", id, extra),
  },

  // Teachers / staff
  teachers: {
    search: (params?: any) => call("teachers:search", params),
    getById: (id: number) => call("teachers:getById", id),
    create: (payload: any) => call("teachers:create", payload),
    update: (id: number, payload: any) => call("teachers:update", id, payload),
    assignClass: (teacherId: number, payload: any) => call("teachers:assignClass", teacherId, payload),
    removeAssignment: (assignmentId: number) => call("teachers:removeAssignment", assignmentId),
  },
  staff: {
    search: (params?: any) => call("staff:search", params),
    getById: (id: number) => call("staff:getById", id),
    create: (payload: any) => call("staff:create", payload),
    update: (id: number, payload: any) => call("staff:update", id, payload),
  },

  // Attendance / timetable / homework / notices
  attendance: {
    getClass: (params: any) => call("attendance:getClass", params),
    saveClass: (payload: any) => call("attendance:saveClass", payload),
    studentSummary: (studentId: number, range?: any) => call("attendance:studentSummary", studentId, range),
    classMonthly: (params: any) => call("attendance:classMonthly", params),
    getStaff: (params: any) => call("attendance:getStaff", params),
    saveStaff: (payload: any) => call("attendance:saveStaff", payload),
  },
  timetable: {
    getSection: (sectionId: number) => call("timetable:getSection", sectionId),
    getTeacher: (teacherId: number) => call("timetable:getTeacher", teacherId),
    saveSlot: (payload: any) => call("timetable:saveSlot", payload),
    deleteSlot: (id: number) => call("timetable:deleteSlot", id),
  },
  homework: {
    list: (params?: any) => call("homework:list", params),
    create: (payload: any) => call("homework:create", payload),
    setStatus: (id: number, status: string) => call("homework:setStatus", id, status),
    delete: (id: number) => call("homework:delete", id),
  },
  notices: {
    list: (params?: any) => call("notices:list", params),
    create: (payload: any) => call("notices:create", payload),
    delete: (id: number) => call("notices:delete", id),
  },

  // Exams
  exams: {
    list: (params?: any) => call("exams:list", params),
    getById: (id: number) => call("exams:getById", id),
    create: (payload: any) => call("exams:create", payload),
    updateStatus: (id: number, status: string) => call("exams:updateStatus", id, status),
    getMarksGrid: (examSubjectId: number) => call("exams:getMarksGrid", examSubjectId),
    saveMarks: (payload: any) => call("exams:saveMarks", payload),
    computeResults: (examId: number) => call("exams:computeResults", examId),
    reportCard: (examId: number, studentId: number) => call("exams:reportCard", examId, studentId),
    saveRemarks: (payload: any) => call("exams:saveRemarks", payload),
  },

  // Fees
  fees: {
    listCategories: () => call("fees:listCategories"),
    createCategory: (payload: any) => call("fees:createCategory", payload),
    listStructures: (params?: any) => call("fees:listStructures", params),
    saveStructure: (payload: any) => call("fees:saveStructure", payload),
    deleteStructure: (id: number) => call("fees:deleteStructure", id),
  },
  scholarships: {
    listForStudent: (studentId: number) => call("scholarships:listForStudent", studentId),
    listAll: () => call("scholarships:listAll"),
    create: (payload: any) => call("scholarships:create", payload),
    setStatus: (id: number, status: string) => call("scholarships:setStatus", id, status),
  },
  invoices: {
    listForStudent: (studentId: number) => call("invoices:listForStudent", studentId),
    getById: (id: number) => call("invoices:getById", id),
    generate: (payload: any) => call("invoices:generate", payload),
    bulkGenerate: (payload: any) => call("invoices:bulkGenerate", payload),
    outstanding: (params?: any) => call("invoices:outstanding", params),
    void: (id: number, reason?: string) => call("invoices:void", id, reason),
  },
  payments: {
    search: (q: string) => call("payments:search", q),
    collect: (payload: any) => call("payments:collect", payload),
    getReceipt: (paymentId: number) => call("payments:getReceipt", paymentId),
    listByStudent: (studentId: number) => call("payments:listByStudent", studentId),
    report: (params?: any) => call("payments:report", params),
  },
  ledger: {
    getStudent: (studentId: number) => call("ledger:getStudent", studentId),
    setOpeningBalance: (payload: any) => call("ledger:setOpeningBalance", payload),
  },

  // Expenses / payroll
  expenses: {
    listCategories: () => call("expenses:listCategories"),
    createCategory: (name: string) => call("expenses:createCategory", name),
    list: (params?: any) => call("expenses:list", params),
    create: (payload: any) => call("expenses:create", payload),
    delete: (id: number) => call("expenses:delete", id),
  },
  payroll: {
    getMonthRoster: (month: string) => call("payroll:getMonthRoster", month),
    saveEntry: (payload: any) => call("payroll:saveEntry", payload),
    markPaid: (runId: number, paidDate?: string) => call("payroll:markPaid", runId, paidDate),
    getSlip: (runId: number) => call("payroll:getSlip", runId),
    history: (params?: any) => call("payroll:history", params),
  },

  // Dashboard / reports / search / notifications / audit / backup
  dashboard: {
    kpis: () => call("dashboard:kpis"),
    enrollmentTrend: (months?: number) => call("dashboard:enrollmentTrend", months),
    collectionTrend: (months?: number) => call("dashboard:collectionTrend", months),
    attendanceTrend: (days?: number) => call("dashboard:attendanceTrend", days),
    incomeVsExpense: (months?: number) => call("dashboard:incomeVsExpense", months),
    classDistribution: () => call("dashboard:classDistribution"),
    feeCollectionStatus: () => call("dashboard:feeCollectionStatus"),
    recentActivity: (limit?: number) => call("dashboard:recentActivity", limit),
  },
  reports: {
    studentList: (params?: any) => call("reports:studentList", params),
    genderDistribution: () => call("reports:genderDistribution"),
    newAdmissions: (params?: any) => call("reports:newAdmissions", params),
    leavingStudents: (params?: any) => call("reports:leavingStudents", params),
    dailyAttendance: (date: string) => call("reports:dailyAttendance", date),
    dailyCollection: (date: string) => call("reports:dailyCollection", date),
    incomeStatement: (params: any) => call("reports:incomeStatement", params),
    gradeDistribution: (examId: number) => call("reports:gradeDistribution", examId),
  },
  search: { global: (q: string) => call("search:global", q) },
  notifications: { list: () => call("notifications:list") },
  audit: { list: (params?: any) => call("audit:list", params) },
  backup: {
    create: () => call("backup:create"),
    history: () => call("backup:history"),
    lastBackup: () => call("backup:lastBackup"),
    integrityCheck: () => call("backup:integrityCheck"),
    restore: () => call("backup:restore"),
  },
  files: {
    pickAndStore: (kind?: "image" | "document") => call("files:pickAndStore", { kind }),
    openExternal: (filePath: string) => call("files:openExternal", filePath),
  },
  appInfo: () => call("app:info"),
  print: {
    exportPdf: (html: string, suggestedName?: string) => call("print:exportPdf", { html, suggestedName }),
    openWindow: (html: string) => call("print:openWindow", { html }),
  },
};
