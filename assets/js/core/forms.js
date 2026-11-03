/* Reusable form sections, fields, validation display and dirty-form tracking. */
window.GT = window.GT || {};
window.GT.forms = (function () {
  var dirtyTrackers = [];

  function escapeHtml(value) {
    var element = document.createElement('div');
    element.textContent = value === null || value === undefined ? '' : String(value);
    return element.innerHTML;
  }

  function inputMarkup(field, value) {
    var id = field.id || field.name;
    var common = ' id="' + escapeHtml(id) + '" name="' + escapeHtml(field.name) + '"' + (field.required ? ' required' : '') + (field.readonly ? ' readonly' : '') + (field.placeholder ? ' placeholder="' + escapeHtml(field.placeholder) + '"' : '') + ' aria-describedby="' + escapeHtml(id) + 'Error"';
    if (field.type === 'textarea') return '<textarea class="form-control" rows="' + (field.rows || 3) + '"' + common + '>' + escapeHtml(value) + '</textarea>';
    if (field.type === 'select') {
      var options = (field.options || []).map(function (option) { return '<option value="' + escapeHtml(option.value) + '"' + (String(option.value) === String(value) ? ' selected' : '') + '>' + escapeHtml(option.label) + '</option>'; }).join('');
      return '<select class="form-select"' + common + '><option value="">' + escapeHtml(field.placeholder || 'Select an option') + '</option>' + options + '</select>';
    }
    if (field.type === 'multiselect') return '<div class="form-check-list" role="group" aria-label="' + escapeHtml(field.label) + '" id="' + escapeHtml(id) + '">' + ((field.options || []).length ? (field.options || []).map(function (option) {
      return '<label class="form-check"><input class="form-check-input" type="checkbox" name="' + escapeHtml(field.name) + '" value="' + escapeHtml(option.value) + '"' + ((value || []).map(String).includes(String(option.value)) ? ' checked' : '') + '><span class="form-check-label">' + escapeHtml(option.label) + '</span></label>';
    }).join('') : '<p class="field-help">No existing records available.</p>') + '</div>';
    if (field.type === 'radio') return '<div class="form-radio-chips" role="radiogroup" aria-label="' + escapeHtml(field.label) + '">' + (field.options || []).map(function (option) { return '<label class="form-radio-chip"><input type="radio" name="' + escapeHtml(field.name) + '" value="' + escapeHtml(option.value) + '"' + (String(option.value) === String(value) ? ' checked' : '') + '><span>' + escapeHtml(option.label) + '</span></label>'; }).join('') + '</div>';
    if (field.type === 'checkbox') return '<label class="form-check"><input class="form-check-input" type="checkbox"' + common + (value ? ' checked' : '') + '><span class="form-check-label">' + escapeHtml(field.checkboxLabel || field.label) + '</span></label>';
    if (field.type === 'money' && value !== '') value = Number(value || 0).toLocaleString('en-US');
    var type = field.type === 'phone' ? 'tel' : (field.type === 'money' ? 'text' : (field.type || 'text'));
    var inputMode = field.type === 'money' ? ' inputmode="numeric"' : '';
    var step = field.type === 'number' ? ' step="' + escapeHtml(field.step || '1') + '"' : '';
    return '<input class="form-control' + (field.type === 'money' ? ' money-input' : '') + '" type="' + type + '" value="' + escapeHtml(value) + '"' + common + inputMode + step + '>';
  }

  function fieldMarkup(field, values) {
    var value = values[field.name];
    if (value === null || value === undefined) value = field.defaultValue === undefined ? '' : field.defaultValue;
    var label = field.type === 'checkbox' ? '' : field.type === 'multiselect' ? '<span class="form-label">' + escapeHtml(field.label) + '</span>' : '<label class="form-label" for="' + escapeHtml(field.id || field.name) + '">' + escapeHtml(field.label) + (field.required ? ' <span aria-hidden="true">*</span>' : '') + '</label>';
    var help = field.help ? '<p class="field-help">' + escapeHtml(field.help) + '</p>' : '';
    return '<div class="form-field ' + (field.fullWidth ? 'form-field-full ' : '') + escapeHtml(field.className || '') + '" data-field-wrap="' + escapeHtml(field.name) + '">' + label + inputMarkup(field, value) + help + '<p class="field-error" id="' + escapeHtml(field.id || field.name) + 'Error"></p></div>';
  }

  function render(options) {
    var values = options.values || {};
    var sections = (options.sections || []).map(function (section) {
      return '<fieldset class="form-section"><legend>' + escapeHtml(section.title) + '</legend>' + (section.description ? '<p class="form-section-description">' + escapeHtml(section.description) + '</p>' : '') + '<div class="form-grid">' + section.fields.map(function (field) { return fieldMarkup(field, values); }).join('') + '</div></fieldset>';
    }).join('');
    return '<form class="gt-form" id="' + escapeHtml(options.id) + '" novalidate><div class="form-error-summary" data-error-summary tabindex="-1" hidden><strong>Please correct the following:</strong><ul></ul></div>' + sections + '<div class="form-actions"><button class="btn btn-primary" type="submit">' + escapeHtml(options.submitLabel || 'Save') + '</button><a class="btn btn-outline-secondary" href="' + escapeHtml(options.cancelRoute || '#/') + '">' + escapeHtml(options.cancelLabel || 'Cancel') + '</a></div></form>';
  }

  function fieldsFromSections(sections) {
    return (sections || []).reduce(function (all, section) { return all.concat(section.fields || []); }, []);
  }

  function read(form, sections) {
    var values = {};
    fieldsFromSections(sections).forEach(function (field) {
      var input = form.elements[field.name];
      if (field.type === 'multiselect') { values[field.name] = Array.from(form.querySelectorAll('[name="' + CSS.escape(field.name) + '"]:checked')).map(function (item) { return Number(item.value); }); return; }
      if (!input) return;
      if (field.type === 'checkbox') values[field.name] = input.checked;
      else if (field.type === 'radio') values[field.name] = input.value;
      else if (field.type === 'money') values[field.name] = window.GT.format.parseMoney(input.value);
      else if (field.type === 'number') values[field.name] = input.value === '' ? null : Number(input.value);
      else if (field.valueType === 'number') values[field.name] = input.value === '' ? null : Number(input.value);
      else values[field.name] = input.value;
    });
    return values;
  }

  function clearErrors(form) {
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (input) { input.removeAttribute('aria-invalid'); });
    form.querySelectorAll('.field-error').forEach(function (message) { message.textContent = ''; });
    var summary = form.querySelector('[data-error-summary]');
    summary.hidden = true;
    summary.querySelector('ul').innerHTML = '';
  }

  function clearFieldError(form, fieldName) {
    var input = form.elements[fieldName];
    if (input && typeof input.removeAttribute === 'function') input.removeAttribute('aria-invalid');
    var message = form.querySelector('#' + CSS.escape(fieldName + 'Error'));
    if (message) message.textContent = '';
    var summary = form.querySelector('[data-error-summary]');
    var link = summary.querySelector('[data-error-field="' + CSS.escape(fieldName) + '"]');
    if (link) link.closest('li').remove();
    if (!summary.querySelector('li')) summary.hidden = true;
  }

  function showErrors(form, errors) {
    clearErrors(form);
    var names = Object.keys(errors || {});
    if (!names.length) return true;
    var summary = form.querySelector('[data-error-summary]');
    summary.querySelector('ul').innerHTML = names.map(function (name) { return '<li><button class="form-error-link" type="button" data-error-field="' + escapeHtml(name) + '">' + escapeHtml(errors[name]) + '</button></li>'; }).join('');
    summary.hidden = false;
    names.forEach(function (name) {
      var input = form.elements[name];
      if (input && typeof input.setAttribute === 'function') input.setAttribute('aria-invalid', 'true');
      var message = form.querySelector('#' + CSS.escape(name + 'Error'));
      if (message) message.textContent = errors[name];
    });
    summary.querySelectorAll('[data-error-field]').forEach(function (button) {
      button.addEventListener('click', function () {
        var input = form.elements[button.dataset.errorField];
        if (input && typeof input.focus === 'function') input.focus();
      });
    });
    summary.focus();
    return false;
  }

  function trackDirty(form) {
    // UI_CHECKLIST.md rule 18: pages with two forms must warn for either unsaved form.
    dirtyTrackers = dirtyTrackers.filter(function (item) { return item.form.isConnected && item.form !== form; });
    var tracker = { form: form, dirty: false };
    dirtyTrackers.push(tracker);
    function markDirty(event) {
      tracker.dirty = true;
      // Clear stale feedback as soon as the user starts correcting that field.
      if (event.target && event.target.name) clearFieldError(form, event.target.name);
    }
    form.addEventListener('input', markDirty);
    form.addEventListener('change', markDirty);
    form.querySelectorAll('.money-input').forEach(function (input) {
      input.addEventListener('blur', function () {
        if (!input.value.trim()) return;
        // Preserve invalid input so the owning form can report it instead of silently rounding it.
        if (!/^-?\d[\d,]*$/.test(input.value.trim())) return;
        input.value = window.GT.format.parseMoney(input.value).toLocaleString('en-US');
      });
    });
    return {
      markSaved: function () { tracker.dirty = false; },
      isDirty: function () { return tracker.dirty && form.isConnected; }
    };
  }

  function hasUnsavedChanges() { return dirtyTrackers.some(function (item) { return item.dirty && item.form.isConnected; }); }

  window.addEventListener('beforeunload', function (event) {
    if (!hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  });

  return {
    field: fieldMarkup,
    render: render,
    read: read,
    showErrors: showErrors,
    clearErrors: clearErrors,
    trackDirty: trackDirty,
    hasUnsavedChanges: hasUnsavedChanges,
    clearDirty: function () { dirtyTrackers = []; }
  };
}());
