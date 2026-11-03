/* Sequential document numbers from BUSINESS_RULES.md section 1; issued numbers are never reused. */
window.GT.numbering = (function () {
  function sequence(type) {
    var row = window.GT.store.where('document_sequences', { document_type: type })[0];
    if (!row) throw new Error('Unknown document sequence: ' + type);
    return row;
  }

  function formatted(row) {
    return String(row.next_number).padStart(Number(row.padding) || 0, '0');
  }

  function peek(type) {
    return formatted(sequence(type));
  }

  function next(type) {
    var row = sequence(type);
    var number = formatted(row);
    window.GT.store.update('document_sequences', row.id, { next_number: Number(row.next_number) + 1 });
    return number;
  }

  return { peek: peek, next: next };
}());
