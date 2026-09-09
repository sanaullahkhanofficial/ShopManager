import { printDocument, escapeHtml } from "./printTemplate";
import { formatCurrency, formatDate } from "./utils";

export function receiptHtml(school: any, payment: any, invoice: any, student: any) {
  const symbol = school?.currency_symbol || "$";
  return printDocument(`Receipt ${payment.receipt_no}`, `
    <div class="doc-header">
      <div><h1>${escapeHtml(school?.name || "School")}</h1><p>${escapeHtml(school?.address || "")}</p><p>${escapeHtml(school?.phone || "")} ${school?.email ? "· " + escapeHtml(school.email) : ""}</p></div>
      <div style="text-align:right"><p><strong>Receipt #</strong> ${payment.receipt_no}</p><p>${formatDate(payment.paid_date, school?.date_format)}</p></div>
    </div>
    <div class="doc-title">Fee Payment Receipt</div>
    <div class="grid-2">
      <div><span>Student</span> ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name || "")}</div>
      <div><span>Admission No</span> ${student.admission_no}</div>
      <div><span>Class</span> ${student.class_name || "—"} ${student.section_name || ""}</div>
      <div><span>Voucher #</span> ${invoice.voucher_no}</div>
    </div>
    <table>
      <thead><tr><th>Description</th><th>Amount</th></tr></thead>
      <tbody><tr><td>Payment for ${escapeHtml(invoice.period_label)}</td><td>${formatCurrency(payment.amount, symbol)}</td></tr></tbody>
    </table>
    <div class="totals">
      <div><span>Amount Paid</span><span>${formatCurrency(payment.amount, symbol)}</span></div>
      <div><span>Payment Method</span><span class="capitalize">${payment.method.replace("_", " ")}</span></div>
      <div class="grand"><span>Remaining Balance</span><span>${formatCurrency(invoice.balance, symbol)}</span></div>
    </div>
    <div class="signature"><div>Received By</div><div>Authorized Signature</div></div>
    <p class="footer-note">${escapeHtml(school?.receipt_footer || "Thank you.")}</p>
  `);
}

export function voucherHtml(school: any, invoice: any, student: any) {
  const symbol = school?.currency_symbol || "$";
  const rows = (invoice.items || []).map((i: any) => `<tr><td>${escapeHtml(i.description)}</td><td>${formatCurrency(i.amount, symbol)}</td></tr>`).join("");
  return printDocument(`Voucher ${invoice.voucher_no}`, `
    <div class="doc-header">
      <div><h1>${escapeHtml(school?.name || "School")}</h1><p>${escapeHtml(school?.address || "")}</p></div>
      <div style="text-align:right"><p><strong>Voucher #</strong> ${invoice.voucher_no}</p><p>Due: ${formatDate(invoice.due_date, school?.date_format)}</p></div>
    </div>
    <div class="doc-title">Fee Voucher — ${escapeHtml(invoice.period_label)}</div>
    <div class="grid-2">
      <div><span>Student</span> ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name || "")}</div>
      <div><span>Admission No</span> ${student.admission_no}</div>
      <div><span>Class</span> ${student.class_name || "—"} ${student.section_name || ""}</div>
      <div><span>Issue Date</span> ${formatDate(invoice.issue_date, school?.date_format)}</div>
    </div>
    <table><thead><tr><th>Fee Item</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals">
      <div><span>Gross Amount</span><span>${formatCurrency(invoice.gross_amount, symbol)}</span></div>
      <div><span>Discount</span><span>-${formatCurrency(invoice.discount_amount, symbol)}</span></div>
      <div><span>Late Fee</span><span>${formatCurrency(invoice.late_fee_amount, symbol)}</span></div>
      <div class="grand"><span>Total Payable</span><span>${formatCurrency(invoice.total_amount, symbol)}</span></div>
      <div><span>Paid</span><span>${formatCurrency(invoice.paid_amount, symbol)}</span></div>
      <div><span>Balance</span><span>${formatCurrency(invoice.balance, symbol)}</span></div>
    </div>
    <p class="footer-note">Please pay by the due date to avoid a late fee. ${escapeHtml(school?.receipt_footer || "")}</p>
  `);
}
