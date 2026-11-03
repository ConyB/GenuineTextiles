/* Shared login and reset-page copy so authentication wording has one settings source. */
window.GT = window.GT || {};
window.GT.authPage = (function () {
  function setText(id, value) { var element = document.getElementById(id); if (element) element.textContent = value; }
  function renderBrand() {
    var settings = GT.settings;
    var auth = settings.auth;
    var panel = document.getElementById('authBrandPanel');
    if (!panel) return;
    panel.innerHTML = '<div class="auth-brand-content"><div class="auth-logo-wrap"><img class="auth-logo" id="authLogo" src="' + settings.logoLarge + '" alt="' + settings.logoAlt + '"><div class="auth-logo-fallback" id="authLogoFallback" aria-label="' + settings.businessName + '"><span>GT</span></div><div><div class="auth-brand-name">' + settings.wordmark + '</div><div class="auth-brand-tagline">' + settings.tagline + '</div></div></div><p class="auth-craft-line">' + auth.craftLine + '</p><h2 class="auth-hero-title">' + auth.heroTitle + '</h2><ul class="auth-benefit-list">' + auth.benefits.map(function (item) { return '<li>' + item + '</li>'; }).join('') + '</ul><p class="auth-uniform-types">' + auth.uniformTypes + '</p></div>';
    document.getElementById('authLogo').addEventListener('error', function () { this.style.display = 'none'; document.getElementById('authLogoFallback').style.display = 'flex'; });
  }
  function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }
  function setupPasswordToggle() { var input = document.getElementById('password'); var button = document.getElementById('passwordToggle'); if (!input || !button) return; button.addEventListener('click', function () { var hidden = input.type === 'password'; input.type = hidden ? 'text' : 'password'; button.setAttribute('aria-label', hidden ? GT.settings.auth.hidePassword : GT.settings.auth.showPassword); button.innerHTML = '<i data-lucide="' + (hidden ? 'eye-off' : 'eye') + '"></i><span class="visually-hidden">' + button.getAttribute('aria-label') + '</span>'; refreshIcons(); }); }
  function fillLoginCopy() { var auth = GT.settings.auth; document.title = auth.loginHeading + ' | ' + GT.settings.businessName; setText('loginHeading', auth.loginHeading); setText('loginIntro', auth.loginIntro); setText('emailLabel', auth.emailLabel); setText('passwordLabel', auth.passwordLabel); setText('loginError', auth.invalidCredentials); setText('loginButton', auth.loginButton); setText('forgotPasswordLink', auth.forgotPassword); setText('demoHeading', auth.demoHeading); setText('demoDescription', auth.demoDescription); var toggle = document.getElementById('passwordToggle'); if (toggle) toggle.setAttribute('aria-label', auth.showPassword); }
  function fillResetCopy() {
    var auth = GT.settings.auth;
    document.title = auth.resetHeading + ' | ' + GT.settings.businessName;
    setText('resetHeading', auth.resetHeading);
    setText('resetIntro', auth.resetIntro);
    setText('resetIdentifierLabel', auth.resetIdentifierLabel);
    document.getElementById('resetIdentifier').placeholder = auth.resetIdentifierPlaceholder;
    setText('resetError', auth.resetRequired);
    setText('resetButton', auth.resetButton);
    setText('resetMessage', auth.resetConfirmation);
    setText('returnToLogin', auth.returnToLogin);
  }
  return { renderBrand: renderBrand, setupPasswordToggle: setupPasswordToggle, fillLoginCopy: fillLoginCopy, fillResetCopy: fillResetCopy, refreshIcons: refreshIcons };
}());
