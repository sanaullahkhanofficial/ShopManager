"use strict";

const { makeWrap } = require("./wrap.cjs");
const feeService = require("../services/feeService.cjs");
const scholarshipService = require("../services/scholarshipService.cjs");
const invoiceService = require("../services/invoiceService.cjs");
const paymentService = require("../services/paymentService.cjs");
const ledgerService = require("../services/ledgerService.cjs");
const expenseService = require("../services/expenseService.cjs");
const payrollService = require("../services/payrollService.cjs");

function register(ipcMain, ctx) {
  const wrap = makeWrap(ctx);

  // ---- Fee categories / structures ----
  ipcMain.handle("fees:listCategories", wrap("fees.view", (db) => feeService.listCategories(db)));
  ipcMain.handle("fees:createCategory", wrap("fees.manage", (db, session, payload) => feeService.createCategory(db, session, payload)));
  ipcMain.handle("fees:listStructures", wrap("fees.view", (db, _s, params) => feeService.listStructures(db, params)));
  ipcMain.handle("fees:saveStructure", wrap("fees.manage", (db, session, payload) => feeService.saveStructure(db, session, payload)));
  ipcMain.handle("fees:deleteStructure", wrap("fees.manage", (db, session, id) => feeService.deleteStructure(db, session, id)));

  // ---- Scholarships ----
  ipcMain.handle("scholarships:listForStudent", wrap("fees.view", (db, _s, studentId) => scholarshipService.listForStudent(db, studentId)));
  ipcMain.handle("scholarships:listAll", wrap("scholarships.manage", (db) => scholarshipService.listAll(db)));
  ipcMain.handle("scholarships:create", wrap("scholarships.manage", (db, session, payload) => scholarshipService.create(db, session, payload)));
  ipcMain.handle("scholarships:setStatus", wrap("scholarships.manage", (db, session, id, status) => scholarshipService.setStatus(db, session, id, status)));

  // ---- Invoices / vouchers ----
  ipcMain.handle("invoices:listForStudent", wrap("fees.view", (db, _s, studentId) => invoiceService.listForStudent(db, studentId)));
  ipcMain.handle("invoices:getById", wrap("fees.view", (db, _s, id) => invoiceService.getById(db, id)));
  ipcMain.handle("invoices:generate", wrap("fees.manage", (db, session, payload) => invoiceService.generateForStudent(db, session, payload)));
  ipcMain.handle("invoices:bulkGenerate", wrap("fees.manage", (db, session, payload) => invoiceService.bulkGenerate(db, session, payload)));
  ipcMain.handle("invoices:outstanding", wrap("fees.view", (db, _s, params) => invoiceService.outstanding(db, params)));
  ipcMain.handle("invoices:void", wrap("fees.manage", (db, session, id, reason) => invoiceService.voidInvoice(db, session, id, reason)));

  // ---- Payments / receipts ----
  ipcMain.handle("payments:search", wrap("fees.collect", (db, _s, q) => paymentService.searchForCollection(db, q)));
  ipcMain.handle("payments:collect", wrap("fees.collect", (db, session, payload) => paymentService.collect(db, session, payload)));
  ipcMain.handle("payments:getReceipt", wrap("fees.view", (db, _s, paymentId) => paymentService.getReceipt(db, paymentId)));
  ipcMain.handle("payments:listByStudent", wrap("fees.view", (db, _s, studentId) => paymentService.listByStudent(db, studentId)));
  ipcMain.handle("payments:report", wrap("fees.view", (db, _s, params) => paymentService.reportCollections(db, params)));

  // ---- Ledger ----
  ipcMain.handle("ledger:getStudent", wrap("fees.view", (db, _s, studentId) => ledgerService.getStudentLedger(db, studentId)));
  ipcMain.handle("ledger:setOpeningBalance", wrap("fees.manage", (db, session, payload) => ledgerService.setOpeningBalance(db, session, payload)));

  // ---- Expenses ----
  ipcMain.handle("expenses:listCategories", wrap("expenses.manage", (db) => expenseService.listCategories(db)));
  ipcMain.handle("expenses:createCategory", wrap("expenses.manage", (db, session, name) => expenseService.createCategory(db, session, name)));
  ipcMain.handle("expenses:list", wrap("expenses.manage", (db, _s, params) => expenseService.list(db, params)));
  ipcMain.handle("expenses:create", wrap("expenses.manage", (db, session, payload) => expenseService.create(db, session, payload)));
  ipcMain.handle("expenses:delete", wrap("expenses.manage", (db, session, id) => expenseService.remove(db, session, id)));

  // ---- Payroll ----
  ipcMain.handle("payroll:getMonthRoster", wrap("payroll.view", (db, _s, month) => payrollService.getMonthRoster(db, month)));
  ipcMain.handle("payroll:saveEntry", wrap("payroll.manage", (db, session, payload) => payrollService.saveEntry(db, session, payload)));
  ipcMain.handle("payroll:markPaid", wrap("payroll.manage", (db, session, runId, paidDate) => payrollService.markPaid(db, session, runId, paidDate)));
  ipcMain.handle("payroll:getSlip", wrap("payroll.view", (db, _s, runId) => payrollService.getSlip(db, runId)));
  ipcMain.handle("payroll:history", wrap("payroll.view", (db, _s, params) => payrollService.history(db, params)));
}

module.exports = { register };
