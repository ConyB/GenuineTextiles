/* Sales totals follow BUSINESS_RULES.md section 2: discount first, then VAT. */
window.GT.calc = (function () {
  function lineAmount(line) {
    if (line.amount !== undefined && line.amount !== null) return Number(line.amount) || 0;
    return (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
  }

  function calcTotals(lines, discount, vatRate) {
    var subtotal = Math.round((lines || []).reduce(function (sum, line) { return sum + lineAmount(line); }, 0));
    var discountAmount = Math.round(Number(discount) || 0);
    var taxable = Math.max(0, subtotal - discountAmount);
    var vat = Math.round(taxable * (Number(vatRate) || 0) / 100);
    return { subtotal: subtotal, discount: discountAmount, vat: vat, total: taxable + vat };
  }

  return { calcTotals: calcTotals };
}());
