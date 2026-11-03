/* Phase 4 document sequence editor; BUSINESS_RULES.md section 1 forbids number reuse. */
window.GT = window.GT || {};
window.GT.documentNumberingModule = (function () {
  var table = null;
  function canEdit() { return window.GT.permissions.can('settings_numbering', 'E'); }
  function label(type) { return String(type).replace(/_/g, ' ').replace(/\b\w/g, function (letter) { return letter.toUpperCase(); }); }
  function numberValue(value) { var parsed = parseInt(String(value || '').replace(/\D/g, ''), 10); return Number.isFinite(parsed) ? parsed : 0; }
  function relatedRows(type) {
    if (['invoice', 'quotation', 'proforma'].indexOf(type) !== -1) return window.GT.store.where('sales_documents', { type: type });
    var map = { receipt: 'receipts', delivery_note: 'delivery_notes', grn: 'goods_received_notes', material_issue: 'material_issues', order: 'orders' };
    return map[type] ? window.GT.store.all(map[type]) : [];
  }
  function highest(type) { return relatedRows(type).reduce(function (maximum, row) { return Math.max(maximum, numberValue(row.number)); }, 0); }
  function format(number, padding) { return String(Number(number)).padStart(Number(padding) || 0, '0'); }
  function rows() { return window.GT.store.all('document_sequences').map(function (row) { var issued = highest(row.document_type); return Object.assign({}, row, { type_label: label(row.document_type), printed_next: format(row.next_number, row.padding), last_issued: issued ? format(issued, row.padding) : 'None yet' }); }); }
  function showEdit(sequence) {
    window.GT.components.openModal({ title: 'Edit ' + label(sequence.document_type) + ' numbering', content: '<form id="numberingForm" novalidate><label class="form-label" for="sequenceNext">Next number</label><input class="form-control" id="sequenceNext" type="number" min="1" step="1" value="' + sequence.next_number + '"><p class="field-error" id="sequenceNextError"></p><label class="form-label mt-3" for="sequencePadding">Padding</label><input class="form-control" id="sequencePadding" type="number" min="0" step="1" value="' + sequence.padding + '"><p class="field-error" id="sequencePaddingError"></p><p class="number-preview">Printed preview: <strong id="numberPreview"></strong></p><button class="btn btn-primary" type="submit">Review change</button></form>' });
    var form = document.getElementById('numberingForm'); var next = document.getElementById('sequenceNext'); var padding = document.getElementById('sequencePadding');
    function preview() { document.getElementById('numberPreview').textContent = format(next.value || 0, padding.value || 0); } next.addEventListener('input', preview); padding.addEventListener('input', preview); preview();
    form.addEventListener('submit', function (event) {
      event.preventDefault(); var nextNumber = Number(next.value); var newPadding = Number(padding.value); var issued = highest(sequence.document_type); var nextError = ''; var paddingError = '';
      if (!window.GT.validate.positiveInteger(next.value)) nextError = 'Next number must be a positive whole number.'; else if (issued && nextNumber <= issued) nextError = 'Next number must be higher than the last issued number (' + issued + ').';
      if (!/^\d+$/.test(String(padding.value)) || newPadding < 0) paddingError = 'Padding must be zero or a positive whole number.';
      document.getElementById('sequenceNextError').textContent = nextError; document.getElementById('sequencePaddingError').textContent = paddingError; if (nextError || paddingError) return;
      var beforePrinted = format(sequence.next_number, sequence.padding); var afterPrinted = format(nextNumber, newPadding);
      window.GT.components.confirmDialog({ title: 'Confirm numbering change', message: 'Change ' + label(sequence.document_type) + ' from ' + beforePrinted + ' to ' + afterPrinted + '? This affects future printed documents.', confirmText: 'Change numbering' }).then(function (confirmed) {
        if (!confirmed) return; var before = window.GT.store.find('document_sequences', sequence.id); var after = window.GT.store.update('document_sequences', sequence.id, { next_number: nextNumber, padding: newPadding }); window.GT.audit.log('update', 'document_sequences', sequence.id, before, after); window.GT.components.showToast(label(sequence.document_type) + ' numbering was updated.', 'success'); table.refresh();
      });
    });
  }
  function render() {
    table = window.GT.dataTable.create({ id: 'documentNumberingTable', rows: rows, caption: 'Document numbering', searchFields: ['type_label'], searchPlaceholder: 'Search document type', columns: [{ label: 'Document type', field: 'type_label', sortable: true }, { label: 'Next number', field: 'printed_next' }, { label: 'Padding', field: 'padding' }, { label: 'Last issued number', field: 'last_issued' }], actions: [{ label: 'Edit', icon: 'pencil', primary: true, show: canEdit, onClick: showEdit }], emptyState: { message: 'No document sequences are configured.' }, exportName: 'genuine-textiles-document-numbering.csv' });
    return '<section class="document-numbering-page">' + window.GT.components.pageHeader({ title: 'Document Numbering', description: 'Control the next printed number for each document series. Issued numbers are never reused.', breadcrumbs: [{ label: 'Administration' }, { label: 'Document Numbering' }], badge: canEdit() ? '' : window.GT.components.statusBadge('Read only', 'neutral') }) + '<div id="documentNumberingMount"></div></section>';
  }
  function bind() { table.mount('#documentNumberingMount'); }
  var api = { render: render, bind: bind, highest: highest };
  window.GT.router.register('#/admin/numbering', { module: api, view: 'list', title: 'Document Numbering', permission: 'settings_numbering', action: 'V', baseRoute: '#/admin/numbering' });
  return api;
}());
