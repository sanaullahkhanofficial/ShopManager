"use strict";

/**
 * Every notification here is computed live from real data — never a
 * hard-coded placeholder. Each item includes enough context to navigate to
 * the relevant screen from the renderer.
 */
function getNotifications(db) {
  const items = [];
  const today = new Date().toISOString().slice(0, 10);

  const overdue = db
    .prepare("SELECT COUNT(*) c, COALESCE(SUM(balance),0) v FROM fee_invoices WHERE status != 'void' AND status != 'paid' AND due_date < ?")
    .get(today);
  if (overdue.c > 0) {
    items.push({
      type: "fee_overdue", severity: "high",
      message: `${overdue.c} fee voucher(s) overdue, totaling ${overdue.v}.`,
      link: "/fees/outstanding",
    });
  }

  const lowAttendance = db
    .prepare(
      `SELECT s.id, s.first_name, s.last_name,
              SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) * 1.0 / COUNT(a.id) AS pct
       FROM students s JOIN attendance a ON a.student_id = s.id
       WHERE a.date >= date('now','-30 days') AND s.status='active'
       GROUP BY s.id HAVING COUNT(a.id) >= 5 AND pct < 0.75`
    )
    .all();
  if (lowAttendance.length > 0) {
    items.push({
      type: "low_attendance", severity: "medium",
      message: `${lowAttendance.length} student(s) have attendance below 75% in the last 30 days.`,
      link: "/reports/attendance",
    });
  }

  const upcomingExams = db
    .prepare("SELECT COUNT(*) c FROM exams WHERE start_date BETWEEN ? AND date(?, '+7 days') AND status != 'completed'")
    .get(today, today);
  if (upcomingExams.c > 0) {
    items.push({ type: "upcoming_exam", severity: "low", message: `${upcomingExams.c} exam(s) scheduled in the next 7 days.`, link: "/exams" });
  }

  const pendingMarks = db
    .prepare(
      `SELECT COUNT(*) c FROM exam_subjects es JOIN exams e ON e.id = es.exam_id
       WHERE e.status IN ('ongoing','completed') AND NOT EXISTS (SELECT 1 FROM marks m WHERE m.exam_subject_id = es.id)`
    )
    .get();
  if (pendingMarks.c > 0) {
    items.push({ type: "pending_marks", severity: "medium", message: `${pendingMarks.c} exam subject(s) have no marks entered yet.`, link: "/exams" });
  }

  const pendingAdmissions = db.prepare("SELECT COUNT(*) c FROM admissions WHERE stage IN ('application','review')").get();
  if (pendingAdmissions.c > 0) {
    items.push({ type: "pending_admission", severity: "low", message: `${pendingAdmissions.c} admission application(s) awaiting review.`, link: "/admissions" });
  }

  const lastBackup = db.prepare("SELECT created_at FROM backups ORDER BY id DESC LIMIT 1").get();
  if (!lastBackup || new Date(lastBackup.created_at) < new Date(Date.now() - 7 * 24 * 3600 * 1000)) {
    items.push({ type: "backup_due", severity: "medium", message: "No backup has been taken in the last 7 days.", link: "/admin/backup" });
  }

  return items;
}

module.exports = { getNotifications };
