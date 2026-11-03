/* Whole-shilling formatting and wording rules from BUSINESS_RULES.md section 2. */
window.GT.format = (function () {
  var small = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  var groups = ['', 'thousand', 'million', 'billion', 'trillion'];

  function integer(value) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : 0;
  }

  function grouped(value) {
    return Math.abs(integer(value)).toLocaleString('en-US');
  }

  function underThousand(number) {
    var words = [];
    if (number >= 100) {
      words.push(small[Math.floor(number / 100)], 'hundred');
      number %= 100;
    }
    if (number >= 20) {
      words.push(tens[Math.floor(number / 10)]);
      if (number % 10) words.push(small[number % 10]);
    } else if (number > 0) {
      words.push(small[number]);
    }
    return words.join(' ');
  }

  function numberWords(value) {
    var number = Math.abs(integer(value));
    if (number === 0) return 'zero';
    var parts = [];
    var groupIndex = 0;
    while (number > 0) {
      var chunk = number % 1000;
      if (chunk) parts.unshift(underThousand(chunk) + (groups[groupIndex] ? ' ' + groups[groupIndex] : ''));
      number = Math.floor(number / 1000);
      groupIndex += 1;
    }
    return parts.join(' ');
  }

  function amountInWords(value) {
    var amount = integer(value);
    var words = (amount < 0 ? 'minus ' : '') + numberWords(amount) + ' shillings only.';
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  return {
    formatMoney: function (value) { return 'UGX ' + (integer(value) < 0 ? '-' : '') + grouped(value); },
    formatMoneyPrint: function (value) { return (integer(value) < 0 ? '-' : '') + grouped(value) + '/='; },
    parseMoney: function (value) { var cleaned = String(value === null || value === undefined ? '' : value).replace(/[^0-9.-]/g, ''); return integer(cleaned || 0); },
    amountInWords: amountInWords
  };
}());
