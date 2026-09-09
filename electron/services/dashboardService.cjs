"use strict";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function getKpis(db) {
  const totalStudents = db.prepare("SELECT COUNT(*) c FROM students").get().c;
  const activeStudents = db.prepare("SELECT COUNT(*) c FROM students WHERE status = 'active'").get().c;
  const teachers = db.prepare("SELECT COUNT(*) c FROM teachers WHERE employment_status = 'active'").get().c;
  const staff = db.prepare("SELECT COUNT(*) c FROM staff WHERE employment_status = 'active'").get().c;

  const t = today();
  const todaysAttendanceRow = db
    .prepare(`SELECT COUNT(*) present, (SELECT COUNT(*) FROM attendance WHERE date = ?) total FROM attendance WHERE date = ? AND status IN ('present','late')`)
    .get(t, t);
  const todaysAttendancePct = todaysAttendanceRow.total ? Math.round((todaysAttendanceRow.present / todaysAttendanceRow.total) * 100) : null;

  const todaysCollection = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM fee_payments WHERE paid_date = ? AND voided = 0").get(t).v;
  const outstandingFees = db.prepare("SELECT COALESCE(SUM(balance),0) v FROM fee_invoices WHERE status != 'void'").get().v;

  const ms = monthStart();
  const monthlyRevenue = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM fee_payments WHERE paid_date >= ? AND voided = 0").get(ms).v;
  const monthlyExpenses = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE expense_date >= ?").get(ms).v;

  return {
    totalStudents, activeStudents, teachers, staff,
    todaysAttendancePct, todaysCollection, outstandingFees,
    monthlyRevenue, monthlyExpenses, netBalance: Math.round((monthlyRevenue - monthlyExpenses) * 100) / 100,
  };
}

function enrollmentTrend(db, months = 6) {
  return db
    .prepare(
      `SELECT strftime('%Y-%m', admission_date) AS month, COUNT(*) AS count
       FROM students
       WHERE admission_date >= date('now', ?)
       GROUP BY month ORDER BY month`
    )
    .all(`-${months} months`);
}

function collectionTrend(db, months = 6) {
  return db
    .prepare(
      `SELECT strftime('%Y-%m', paid_date) AS month, COALESCE(SUM(amount),0) AS total
       FROM fee_payments WHERE voided = 0 AND paid_date >= date('now', ?)
       GROUP BY month ORDER BY month`
    )
    .all(`-${months} months`);
}

function attendanceTrend(db, days = 14) {
  return db
    .prepare(
      `SELECT date,
              SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) AS present,
              COUNT(*) AS total
       FROM attendance WHERE date >= date('now', ?)
       GROUP BY date ORDER BY date`
    )
    .all(`-${days} days`)
    .map((r) => ({ date: r.date, percentage: r.total ? Math.round((r.present / r.total) * 100) : 0 }));
}

function incomeVsExpense(db, months = 6) {
  const income = collectionTrend(db, months);
  const expenses = db
    .prepare(
      `SELECT strftime('%Y-%m', expense_date) AS month, COALESCE(SUM(amount),0) AS total
       FROM expenses WHERE expense_date >= date('now', ?) GROUP BY month ORDER BY month`
    )
    .all(`-${months} months`);
  const months_ = Array.from(new Set([...income.map((i) => i.month), ...expenses.map((e) => e.month)])).sort();
  return months_.map((m) => ({
    month: m,
    income: income.find((i) => i.month === m)?.total || 0,
    expense: expenses.find((e) => e.month === m)?.total || 0,
  }));
}

function classDistribution(db) {
  return db
    .prepare(
      `SELECT c.name AS class_name, COUNT(s.id) AS count
       FROM classes c LEFT JOIN students s ON s.class_id = c.id AND s.status = 'active'
       GROUP BY c.id ORDER BY c.sort_order`
    )
    .all();
}

function feeCollectionStatus(db) {
  const rows = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid,
         SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) AS partial,
         SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) AS unpaid
       FROM fee_invoices WHERE status != 'void'`
    )
    .get();
  return [
    { name: "Paid", value: rows.paid || 0 },
    { name: "Partial", value: rows.partial || 0 },
    { name: "Unpaid", value: rows.unpaid || 0 },
  ];
}

function recentActivity(db, limit = 12) {
  return db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?").all(limit);
}

module.exports = { getKpis, enrollmentTrend, collectionTrend, attendanceTrend, incomeVsExpense, classDistribution, feeCollectionStatus, recentActivity };
