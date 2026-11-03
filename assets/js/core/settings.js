/* Live business identity hydrated from business_settings; authentication copy remains centralized here. */
window.GT.settings = (function () {
  var api = {};
  function reload() {
    var values = {};
    window.GT.store.all('business_settings').forEach(function (row) { values[row.key] = row.value; });
    function value(key, fallback) { return values[key] === undefined ? fallback : values[key]; }
    api.businessName = value('name', 'Genuine Textiles'); api.tradingName = value('trading_name', api.businessName); api.wordmark = String(api.businessName).toUpperCase();
    api.tagline = value('tagline', 'Your Quality Uniforms Factory'); api.sloganLine = value('slogan_line', 'Cut | Design | Sew | Knit');
    api.address = value('address', ''); api.poBox = value('po_box', ''); api.phones = value('phones', []);
    api.generalEmail = value('general_email', (value('emails', [])[0] || '')); api.sendingEmail = value('sending_email', api.generalEmail); api.contacts = [api.generalEmail].filter(Boolean); api.website = value('website', '');
    api.tin = value('tin', 'ENTER TIN'); api.vatRate = value('vat_rate', 18); api.logoSmall = value('logo_small', 'assets/images/logo.png'); api.logoLarge = value('logo_large', 'assets/images/logo-large.png'); api.logoAlt = 'Genuine Textiles logo';
    api.bank = { name: value('bank_name', ''), accountName: value('bank_account_name', ''), accountNumber: value('bank_account_number', '') };
    api.authorisedSignatory = value('authorised_signatory', 'Kibira'); api.quotationValidityDays = value('quotation_validity_days', 14); api.quotationTerms = value('quotation_terms', '');
    api.cashInvoiceTerms = value('cash_invoice_terms', 'All accounts are due on demand'); api.creditInvoiceTerms = value('credit_invoice_terms', 'Payment due within 30 days'); api.defaultCreditDays = value('default_credit_days', 30);
    api.currency = 'UGX'; api.financialYearStart = 'July';
    api.auth = {
      craftLine: api.sloganLine, heroTitle: 'Keep every uniform order moving.', benefits: ['Follow orders from request to delivery.', 'Prepare invoices and receipts with confidence.', 'Know your fabric and material stock.', 'See customer balances and overdue debts.'], uniformTypes: 'Made for school, corporate, industrial, hospitality and medical uniforms.',
      loginHeading: 'Welcome back', loginIntro: 'Sign in to continue to your workshop workspace.', emailLabel: 'Email address', passwordLabel: 'Password', invalidCredentials: 'Email or password is incorrect.', showPassword: 'Show password', hidePassword: 'Hide password', loginButton: 'Log in', forgotPassword: 'Forgot password?', demoHeading: 'Demo access (prototype only)', demoDescription: 'Choose a seeded user to explore their permitted screens.', resetHeading: 'Reset your password', resetIntro: 'Enter your username or email and the Owner or General Manager will be notified.', resetIdentifierLabel: 'Username or email', resetIdentifierPlaceholder: 'Enter your username or email', resetRequired: 'Enter your username or email.', resetButton: 'Send reset request', resetConfirmation: 'If this account exists, a reset request has been recorded.', returnToLogin: 'Back to login'
    };
    return api;
  }
  api.reload = reload;
  return reload();
}());

/* Every page uses the stored small logo as its favicon. */
(function addFavicon() { var favicon = document.querySelector('link[rel="icon"]') || document.createElement('link'); favicon.rel = 'icon'; favicon.type = 'image/png'; favicon.href = window.GT.settings.logoSmall; if (!favicon.parentNode) document.head.appendChild(favicon); }());
