/* Reusable, configuration-driven document line editor; business rules stay in modules. */
window.GT = window.GT || {};
window.GT.lineEditor = (function () {
  var sequence = 0;

  function escapeHtml(value) { return window.GT.components.escapeHtml(value); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function optionLabel(option) { return option.label === undefined ? option.value : option.label; }

  function create(config) {
    sequence += 1;
    var id = config.id || 'lineEditor' + sequence;
    var root = null;
    var rows = clone(config.rows && config.rows.length ? config.rows : [{}]);

    function columns() { return config.columns || []; }
    function editableColumns() { return columns().filter(function (column) { return ['computed', 'readonly'].indexOf(column.type) === -1; }); }
    function optionsFor(column, row) { return typeof column.options === 'function' ? column.options(row) : (column.options || []); }

    function displayValue(column, row) {
      var value = row[column.key];
      if (column.compute) value = column.compute(row, rows);
      if (column.format) return column.format(value, row);
      if (column.type === 'money' && value !== '' && value !== null && value !== undefined) return Number(value || 0).toLocaleString('en-US');
      return value === null || value === undefined ? '' : value;
    }

    function inputMarkup(column, row, rowIndex) {
      var value = displayValue(column, row);
      var name = id + '-' + rowIndex + '-' + column.key;
      var common = ' data-line-field="' + escapeHtml(column.key) + '" data-row-index="' + rowIndex + '" aria-label="' + escapeHtml(column.label) + '"';
      if (column.type === 'computed' || column.type === 'readonly') return '<span class="line-readonly" data-line-value="' + escapeHtml(column.key) + '">' + escapeHtml(value || '—') + '</span>';
      if (column.type === 'select') {
        var selectOptions = optionsFor(column, row).map(function (option) { return '<option value="' + escapeHtml(option.value) + '"' + (String(option.value) === String(value) ? ' selected' : '') + '>' + escapeHtml(optionLabel(option)) + '</option>'; }).join('');
        return '<select class="form-select form-select-sm" name="' + escapeHtml(name) + '"' + common + '><option value="">' + escapeHtml(column.placeholder || 'Select') + '</option>' + selectOptions + '</select><span class="line-cell-error" data-line-error></span>';
      }
      if (column.type === 'search-select') {
        var listId = name + '-options';
        var matching = optionsFor(column, row).find(function (option) { return String(option.value) === String(value); });
        var shown = matching ? optionLabel(matching) : value;
        var dataOptions = optionsFor(column, row).map(function (option) { return '<option value="' + escapeHtml(optionLabel(option)) + '"></option>'; }).join('');
        return '<input class="form-control form-control-sm" type="search" list="' + escapeHtml(listId) + '" value="' + escapeHtml(shown) + '" name="' + escapeHtml(name) + '" autocomplete="off"' + common + '><datalist id="' + escapeHtml(listId) + '">' + dataOptions + '</datalist><span class="line-cell-error" data-line-error></span>';
      }
      var type = column.type === 'number' ? 'number' : 'text';
      var inputMode = column.type === 'money' ? ' inputmode="numeric"' : '';
      var step = column.type === 'number' ? ' step="' + escapeHtml(column.step || 'any') + '"' : '';
      return '<input class="form-control form-control-sm' + (column.type === 'money' ? ' money-input' : '') + '" type="' + type + '" value="' + escapeHtml(value) + '" name="' + escapeHtml(name) + '"' + common + inputMode + step + (column.placeholder ? ' placeholder="' + escapeHtml(column.placeholder) + '"' : '') + '><span class="line-cell-error" data-line-error></span>';
    }

    function rowMarkup(row, rowIndex) {
      var cells = columns().map(function (column) {
        return '<td data-label="' + escapeHtml(column.label) + '">' + inputMarkup(column, row, rowIndex) + '</td>';
      }).join('');
      return '<tr data-line-row="' + rowIndex + '">' + cells + (config.fixedRows ? '' : '<td class="line-remove-cell" data-label="Remove"><button class="btn btn-outline-danger line-remove" type="button" data-remove-line aria-label="Remove line ' + (rowIndex + 1) + '"><i data-lucide="trash-2" aria-hidden="true"></i><span>Remove</span></button></td>') + '</tr>';
    }

    function footerMarkup() {
      if (!config.footer) return '';
      var content = typeof config.footer === 'function' ? config.footer(clone(rows)) : config.footer;
      return '<div class="line-editor-footer" data-line-footer>' + String(content || '') + '</div>';
    }

    function markup() {
      var headings = columns().map(function (column) { return '<th scope="col">' + escapeHtml(column.label) + '</th>'; }).join('');
      return '<section class="line-editor" id="' + escapeHtml(id) + '"><div class="line-editor-scroll"><table><thead><tr>' + headings + (config.fixedRows ? '' : '<th scope="col"><span class="visually-hidden">Remove</span></th>') + '</tr></thead><tbody>' + rows.map(rowMarkup).join('') + '</tbody></table></div>' + footerMarkup() + (config.fixedRows ? '' : '<button class="btn btn-outline-primary line-add" type="button" data-add-line><i data-lucide="plus" aria-hidden="true"></i> ' + escapeHtml(config.addLabel || 'Add row') + '</button>') + '</section>';
    }

    function resolveValue(column, input, row) {
      if (column.type === 'search-select') {
        var option = optionsFor(column, row).find(function (item) { return String(optionLabel(item)).toLowerCase() === input.value.trim().toLowerCase(); });
        return option ? option.value : input.value.trim();
      }
      if (column.type === 'number') return input.value === '' ? null : Number(input.value);
      if (column.type === 'money') return input.value === '' ? null : window.GT.format.parseMoney(input.value);
      return input.value;
    }

    function syncInput(input) {
      var rowIndex = Number(input.dataset.rowIndex);
      var column = columns().find(function (item) { return item.key === input.dataset.lineField; });
      if (!column || !rows[rowIndex]) return;
      rows[rowIndex][column.key] = resolveValue(column, input, rows[rowIndex]);
      updateComputed(rowIndex);
      updateFooter();
      validateCell(input, column, rowIndex);
      if (config.onChange) config.onChange(clone(rows), { rowIndex: rowIndex, key: column.key });
    }

    function updateComputed(rowIndex) {
      var rowElement = root.querySelector('[data-line-row="' + rowIndex + '"]');
      if (!rowElement) return;
      columns().forEach(function (column) {
        if (!column.compute) return;
        rows[rowIndex][column.key] = column.compute(rows[rowIndex], rows);
        var target = rowElement.querySelector('[data-line-value="' + CSS.escape(column.key) + '"]');
        if (target) target.textContent = displayValue(column, rows[rowIndex]) || '—';
      });
    }

    function updateFooter() {
      var footer = root.querySelector('[data-line-footer]');
      if (footer && config.footer) footer.innerHTML = String(config.footer(clone(rows)) || '');
    }

    function validateCell(input, column, rowIndex) {
      var error = column.validate ? column.validate(rows[rowIndex][column.key], clone(rows[rowIndex]), clone(rows), rowIndex) : '';
      var message = typeof error === 'string' ? error : '';
      input.toggleAttribute('aria-invalid', Boolean(message));
      var output = input.parentElement.querySelector('[data-line-error]');
      if (output) output.textContent = message;
      return message;
    }

    function validate() {
      var errors = [];
      root.querySelectorAll('[data-line-field]').forEach(function (input) {
        var column = columns().find(function (item) { return item.key === input.dataset.lineField; });
        var message = validateCell(input, column, Number(input.dataset.rowIndex));
        if (message) errors.push({ row: Number(input.dataset.rowIndex), key: column.key, message: message });
      });
      return errors;
    }

    function addRow(focusFirst) {
      rows.push(clone(config.newRow || {}));
      render();
      if (focusFirst !== false) {
        var added = root.querySelector('[data-line-row="' + (rows.length - 1) + '"] [data-line-field]');
        if (added) added.focus();
      }
      if (config.onChange) config.onChange(clone(rows), { added: true, rowIndex: rows.length - 1 });
    }

    function removeRow(index) {
      if (rows.length === 1) rows = [clone(config.newRow || {})];
      else rows.splice(index, 1);
      render();
      if (config.onChange) config.onChange(clone(rows), { removed: true, rowIndex: index });
    }

    function bind() {
      root.addEventListener('input', function (event) { if (event.target.matches('[data-line-field]')) syncInput(event.target); });
      root.addEventListener('change', function (event) { if (event.target.matches('[data-line-field]')) syncInput(event.target); });
      root.addEventListener('blur', function (event) {
        if (!event.target.matches('.money-input') || !event.target.value.trim()) return;
        event.target.value = window.GT.format.parseMoney(event.target.value).toLocaleString('en-US');
      }, true);
      root.addEventListener('click', function (event) {
        if (event.target.closest('[data-add-line]')) { addRow(); return; }
        var remove = event.target.closest('[data-remove-line]');
        if (remove) removeRow(Number(remove.closest('[data-line-row]').dataset.lineRow));
      });
      root.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' || !event.target.matches('[data-line-field]')) return;
        var rowIndex = Number(event.target.dataset.rowIndex);
        var last = editableColumns()[editableColumns().length - 1];
        if (!config.fixedRows && rowIndex === rows.length - 1 && last && event.target.dataset.lineField === last.key) {
          event.preventDefault();
          syncInput(event.target);
          addRow();
        }
      });
    }

    function render() {
      if (!root) return;
      root.innerHTML = markup();
      window.GT.components.refreshIcons();
    }

    function mount(target) {
      root = typeof target === 'string' ? document.querySelector(target) : target;
      if (!root) throw new Error('Line editor mount point was not found.');
      bind();
      render();
      return api;
    }

    function getRows() {
      return clone(rows.map(function (row) {
        var result = Object.assign({}, row);
        columns().forEach(function (column) { if (column.compute) result[column.key] = column.compute(row, rows); });
        return result;
      }));
    }

    function setRows(nextRows) { rows = clone(nextRows && nextRows.length ? nextRows : [{}]); render(); return api; }

    var api = { mount: mount, getRows: getRows, setRows: setRows, validate: validate, addRow: addRow };
    return api;
  }

  return { create: create };
}());
