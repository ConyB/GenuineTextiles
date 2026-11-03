/* Shared A4 preview and letterhead helpers from DOCUMENT_TEMPLATES.md. */
window.GT = window.GT || {};
window.GT.print = (function () {
  function escapeHtml(value) { return window.GT.components.escapeHtml(value); }

  function letterhead(overrides) {
    var settings = window.GT.settings;
    var values = Object.assign({
      businessName: settings.businessName, tagline: settings.tagline, address: settings.address,
      poBox: settings.poBox, phones: settings.phones, logo: settings.logoSmall, logoAlt: settings.logoAlt
    }, overrides || {});
    var phones = (values.phones || []).map(function (phone) { return '<span>' + escapeHtml(phone) + '</span>'; }).join('');
    var ids = values.previewIds ? { name:' id="previewBusinessName"', tagline:' id="previewTagline"', address:' id="previewAddress"', poBox:' id="previewPoBox"', phones:' id="previewPhones"' } : { name:'', tagline:'', address:'', poBox:'', phones:'' };
    return '<header class="print-letterhead"><img src="' + escapeHtml(values.logo) + '" alt="' + escapeHtml(values.logoAlt) + '"><div class="print-letterhead-identity"><strong' + ids.name + '>' + escapeHtml(values.businessName) + '</strong><em' + ids.tagline + '>' + escapeHtml(values.tagline) + '</em><span' + ids.address + '>' + escapeHtml(values.address) + '</span><span' + ids.poBox + '>' + escapeHtml(values.poBox) + '</span></div><div class="print-letterhead-phones"' + ids.phones + '>' + phones + '</div></header><div class="print-brand-rule"></div>';
  }

  function signatureBlock(labels) {
    return '<section class="print-signatures">' + (labels || []).map(function (label) {
      return '<div><span class="print-signature-line"></span><strong>' + escapeHtml(label) + '</strong></div>';
    }).join('') + '</section>';
  }

  function watermark(text) { return '<div class="print-watermark" aria-label="' + escapeHtml(text) + '">' + escapeHtml(text) + '</div>'; }

  function closePreview(preview, previousTitle) {
    if (preview) preview.remove();
    document.body.classList.remove('print-preview-open');
    document.title = previousTitle;
  }

  function open(htmlString, title, options) {
    var old = document.querySelector('.print-preview-shell');
    if (old) old.remove();
    var previousTitle = document.title;
    var preview = document.createElement('section');
    preview.className = 'print-preview-shell' + (options && options.orientation === 'landscape' ? ' print-landscape' : '');
    preview.innerHTML = '<div class="print-preview-toolbar"><button class="btn btn-outline-secondary" type="button" data-print-back><i data-lucide="arrow-left" aria-hidden="true"></i> Back</button><strong>' + escapeHtml(title || 'Print preview') + '</strong><button class="btn btn-primary" type="button" data-print-now><i data-lucide="printer" aria-hidden="true"></i> Print</button></div><article class="print-page">' + String(htmlString || '') + '</article>';
    document.body.appendChild(preview);
    document.body.classList.add('print-preview-open');
    document.title = (title || 'Print preview') + ' | ' + window.GT.settings.businessName;
    preview.querySelector('[data-print-back]').addEventListener('click', function () { closePreview(preview, previousTitle); });
    preview.querySelector('[data-print-now]').addEventListener('click', function () { window.print(); });
    window.GT.components.refreshIcons();
    return preview;
  }

  // Unnumbered reports share escaped cells, numeric alignment, repeated headers and an empty state.
  function reportTable(columns, rows) {
    function cell(tag, value, column) {
      return '<' + tag + (column.numeric ? ' class="report-number"' : '') + '>' + escapeHtml(value) + '</' + tag + '>';
    }
    return '<table class="report-print-table"><thead><tr>' + columns.map(function (column) { return cell('th',column.label,column); }).join('') + '</tr></thead><tbody>' +
      (rows.length ? rows.map(function (row) { return '<tr>' + columns.map(function (column,index) { return cell('td',row[index],column); }).join('') + '</tr>'; }).join('') :
        '<tr><td colspan="' + columns.length + '">No records in this selection.</td></tr>') + '</tbody></table>';
  }
  return { letterhead: letterhead, signatureBlock: signatureBlock, watermark: watermark, open: open, reportTable:reportTable };
}());
