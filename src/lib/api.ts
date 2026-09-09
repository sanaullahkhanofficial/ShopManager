// Thin typed wrapper around the transport that reaches electron/ipc/*.cjs.
// Every handler there returns { success, data } or { success: false, error }.
// This wrapper unwraps that so callers can use plain async/await and
// try/catch with a user-friendly Error message — regardless of whether the
// app is running inside Electron (contextBridge IPC) or as a plain web app
// served by server.cjs (fetch over HTTP). The same channel names and the
// same `electron/services/*.cjs` business logic run in both cases.

declare global {
  interface Window {
    api?: {
      invoke: (channel: string, ...args: any[]) => Promise<{ success: boolean; data?: any; error?: string; code?: string }>;
    };
  }
}

/** True when running inside the Electron desktop shell (preload bridge present). */
export const isElectron = typeof window !== "undefined" && !!window.api;

async function invoke(channel: string, ...args: any[]): Promise<{ success: boolean; data?: any; error?: string }> {
  if (isElectron) return window.api!.invoke(channel, ...args);
  const res = await fetch("/api/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ channel, args }),
  });
  if (!res.ok && res.status !== 200) {
    // Network/server-level failure (not a business-logic error) — surface plainly.
    let msg = `Request failed (${res.status})`;
    try { const body = await res.json(); if (body?.error) msg = body.error; } catch { /* ignore */ }
    return { success: false, error: msg };
  }
  return res.json();
}

export async function call<T = any>(channel: string, ...args: any[]): Promise<T> {
  const result = await invoke(channel, ...args);
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
    // Desktop: main process writes the file wherever the user picks via a
    // native dialog. Web: the server streams the database file and the
    // browser downloads it — same underlying backupService, same audit trail.
    create: async () => {
      if (isElectron) return call("backup:create");
      const res = await fetch("/api/backup/export", { credentials: "include" });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || "Backup failed."); }
      const blob = await res.blob();
      const filename = res.headers.get("X-Backup-Filename") || `edumanage-backup-${new Date().toISOString().slice(0, 10)}.db`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      return { canceled: false, backup: { path: filename, sizeBytes: blob.size } };
    },
    history: () => call("backup:history"),
    lastBackup: () => call("backup:lastBackup"),
    integrityCheck: () => call("backup:integrityCheck"),
    // Desktop: pick a file via native dialog, then relaunch. Web: pick a file
    // via a hidden <input type=file>, upload it, and the server swaps the
    // database in place — the caller should reload the page afterward so a
    // fresh session/state is fetched (any restored users invalidate the
    // current login, same as the desktop restart).
    restore: async () => {
      if (isElectron) return call("backup:restore");
      const file = await pickLocalFile(".db");
      if (!file) return { canceled: true };
      const form = new FormData();
      form.append("backup", file);
      const res = await fetch("/api/backup/import", { method: "POST", credentials: "include", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success !== true) throw new Error(body.error || "Restore failed.");
      return { canceled: false, restarting: true };
    },
  },
  files: {
    pickAndStore: (kind?: "image" | "document") => {
      if (isElectron) return call("files:pickAndStore", { kind });
      throw new Error("File uploads from this screen are only available in the EduManage desktop app.");
    },
    openExternal: (filePath: string) => {
      if (isElectron) return call("files:openExternal", filePath);
      throw new Error("Opening local files is only available in the EduManage desktop app.");
    },
  },
  appInfo: () => call("app:info"),
  print: {
    // Desktop: Electron renders the HTML off-screen and writes a real PDF
    // file via printToPDF(). Web: open the document in a new tab and invoke
    // the browser's own print dialog, where "Save as PDF" produces the same
    // result using the browser's native PDF renderer — still a real,
    // user-driven PDF/print, not a screenshot.
    exportPdf: async (html: string, suggestedName?: string) => {
      if (isElectron) return call("print:exportPdf", { html, suggestedName });
      webPrintWindow(html);
      return { canceled: false, path: suggestedName };
    },
    openWindow: async (html: string) => {
      if (isElectron) return call("print:openWindow", { html });
      webPrintWindow(html);
      return { success: true };
    },
  },
};

/** Opens `html` in a new browser tab/window and triggers the print dialog once it has laid out. */
function webPrintWindow(html: string) {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) throw new Error("Please allow pop-ups for this site to print or export documents.");
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => setTimeout(() => win.print(), 200);
}

/** Prompts the user to pick a local file via a throwaway <input type=file>. Resolves to null if canceled. */
function pickLocalFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] || null);
    input.oncancel = () => resolve(null);
    // Some browsers never fire change/cancel if the picker is dismissed via Escape;
    // resolving on window focus-return after a delay would be unreliable, so we
    // accept that a canceled picker simply leaves the caller awaiting until the
    // user tries again — acceptable for this occasional admin action.
    input.click();
  });
}
