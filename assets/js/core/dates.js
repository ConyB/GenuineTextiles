/* Date helpers use Africa/Kampala as required by BUSINESS_RULES.md. */
window.GT.dates = (function () {
  var zone = 'Africa/Kampala';

  function dateOnly(value) {
    if (value instanceof Date) return new Date(value.getTime());
    var text = String(value || '');
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
    return new Date(value);
  }

  function isoDate(date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }

  function format(value, uppercase) {
    var output = new Intl.DateTimeFormat('en-GB', { timeZone: zone, day: '2-digit', month: 'short', year: 'numeric' }).format(dateOnly(value)).replace('Sept', 'Sep');
    return uppercase ? output.toUpperCase() : output;
  }

  function formatRange(from, to) {
    if (!from && !to) return 'Any date';
    if (!from) return 'Until ' + format(to, false);
    if (!to) return 'From ' + format(from, false);
    if (from === to) return format(from, false);
    var first = dateOnly(from);
    var last = dateOnly(to);
    var sameYear = first.getUTCFullYear() === last.getUTCFullYear();
    var startOptions = { timeZone: zone, day: 'numeric', month: 'short' };
    if (!sameYear) startOptions.year = 'numeric';
    var start = new Intl.DateTimeFormat('en-GB', startOptions).format(first);
    var end = new Intl.DateTimeFormat('en-GB', { timeZone: zone, day: 'numeric', month: 'short', year: 'numeric' }).format(last);
    return start + ' – ' + end;
  }

  function startOfWeek(value) {
    var date = dateOnly(value);
    // The app week is Monday to Sunday, matching the Phase 6.2 toolbar rule.
    var daysSinceMonday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceMonday);
    return isoDate(date);
  }

  function endOfMonth(value) {
    var date = dateOnly(value);
    return isoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)));
  }

  function presetRange(name, todayValue) {
    var today = todayValue || isoDate(new Date());
    if (name === 'today') return { from: today, to: today };
    if (name === 'this_week') {
      var weekStart = startOfWeek(today);
      return { from: weekStart, to: isoDate(new Date(dateOnly(weekStart).getTime() + (6 * 86400000))) };
    }
    if (name === 'this_month') {
      var current = dateOnly(today);
      return { from: isoDate(new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1, 12))), to: endOfMonth(today) };
    }
    if (name === 'last_30_days') {
      var start = dateOnly(today);
      start.setUTCDate(start.getUTCDate() - 29);
      return { from: isoDate(start), to: today };
    }
    return { from: '', to: '' };
  }

  return {
    // Phase 7 expiry checks use an explicit URL test date without changing stored dates.
    today: function () {
      var override = new URLSearchParams(window.location.search).get('today');
      if (override && /^\d{4}-\d{2}-\d{2}$/.test(override) && !isNaN(dateOnly(override).getTime()) && isoDate(dateOnly(override)) === override) return override;
      return isoDate(new Date());
    },
    formatDate: function (value) { return format(value, false); },
    formatMonth: function (value) { return new Intl.DateTimeFormat('en-GB', { timeZone:zone, month:'long', year:'numeric' }).format(dateOnly(value + '-01')); },
    formatDateTime: function (value) { return new Intl.DateTimeFormat('en-GB', { timeZone:zone, day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(value)); },
    formatRange: formatRange,
    formatDocDate: function (value) { return format(value, true); },
    presetRange: presetRange,
    startOfWeek: startOfWeek,
    endOfMonth: endOfMonth,
    addDays: function (value, days) { var date = dateOnly(value); date.setUTCDate(date.getUTCDate() + Number(days || 0)); return isoDate(date); },
    daysBetween: function (from, to) { return Math.round((dateOnly(to) - dateOnly(from)) / 86400000); }
  };
}());
