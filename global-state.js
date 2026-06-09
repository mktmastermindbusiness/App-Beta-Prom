(function () {
  'use strict';

  var STORAGE_SELECTION = 'qd_global_selection';
  var STORAGE_SESSION = 'qd_session';
  var STORAGE_CONFIG = 'qd_config_cache';
  var STORAGE_CONFIRMED = 'qd_last_confirmed';
  var SESSION_DURATION = 24 * 60 * 60 * 1000;

  var configCache = null;
  var loaded = false;
  var loadPromise = null;
  var changeCallbacks = [];
  var gasUrl = '';

  function estruturaToRedes(est) {
    var redes = [];
    for (var e in est)
      for (var r in est[e])
        if (redes.indexOf(r) === -1) redes.push(r);
    return redes.sort();
  }

  function lojasDaRede(est, rede) {
    var lojas = [];
    for (var e in est)
      if (est[e][rede])
        for (var p in est[e][rede])
          est[e][rede][p].forEach(function (l) {
            if (lojas.indexOf(l) === -1) lojas.push(l);
          });
    return lojas.sort();
  }

  function hojeStr() {
    return new Date().toISOString().split('T')[0];
  }

  function _jsonp(url) {
    return new Promise(function(resolve, reject) {
      var cb = 'gscb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      window[cb] = function(data) { delete window[cb]; if (s.parentNode) s.parentNode.removeChild(s); resolve(data); };
      var sep = url.indexOf('?') === -1 ? '?' : '&';
      var s = document.createElement('script');
      s.src = url + sep + 'callback=' + cb;
      s.onerror = function() { delete window[cb]; if (s.parentNode) s.parentNode.removeChild(s); reject('JSONP error'); };
      document.head.appendChild(s);
    });
  }

  function _postViaForm(url, data, callback) {
    var iframe = document.getElementById('gs-post-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'gs-post-frame';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    form.target = 'gs-post-frame';
    form.enctype = 'application/x-www-form-urlencoded';
    for (var k in data) {
      if (data.hasOwnProperty(k)) {
        var inp = document.createElement('input');
        inp.type = 'hidden';
        inp.name = k;
        inp.value = typeof data[k] === 'object' ? JSON.stringify(data[k]) : String(data[k]);
        form.appendChild(inp);
      }
    }
    // callback marker to tell GAS this is iframe POST
    var cbInp = document.createElement('input');
    cbInp.type = 'hidden';
    cbInp.name = 'callback';
    cbInp.value = 'iframe';
    form.appendChild(cbInp);
    document.body.appendChild(form);

    function handler(e) {
      if (!e.data || typeof e.data !== 'object') return;
      window.removeEventListener('message', handler);
      callback(e.data);
    }
    window.addEventListener('message', handler);
    form.submit();
    document.body.removeChild(form);
  }

  window.GlobalState = {
    init: function (url) {
      gasUrl = url;
    },
    getGasUrl: function () { return gasUrl; },

    loadConfig: function () {
      if (configCache) return Promise.resolve(configCache);
      if (loadPromise) return loadPromise;
      var cached = localStorage.getItem(STORAGE_CONFIG);
      if (cached) {
        try { configCache = JSON.parse(cached); loaded = true; return Promise.resolve(configCache); } catch (e) { }
      }
      loadPromise = this.refreshConfig().then(function (c) { loadPromise = null; return c; });
      return loadPromise;
    },

    refreshConfig: function () {
      if (!gasUrl) return Promise.reject('GAS URL not set');
      return _jsonp(gasUrl + '?page=json_config').then(function (data) {
        configCache = data;
        loaded = true;
        try { localStorage.setItem(STORAGE_CONFIG, JSON.stringify(data)); } catch (e) { }
        return data;
      }).catch(function (e) {
        console.warn('GlobalState: fetch config failed', e);
        return null;
      });
    },

    getConfig: function () { return configCache; },
    isLoaded: function () { return loaded; },

    getSelection: function () {
      try { return JSON.parse(localStorage.getItem(STORAGE_SELECTION)); } catch (e) { return null; }
    },
    setSelection: function (rede, loja, promotor, estado) {
      var sel = { rede: rede, loja: loja, promotor: promotor, estado: estado, updatedAt: Date.now() };
      try { localStorage.setItem(STORAGE_SELECTION, JSON.stringify(sel)); } catch (e) { }
      changeCallbacks.forEach(function (cb) { cb(sel); });
      this._updateBadge();
    },
    clearSelection: function () {
      try { localStorage.removeItem(STORAGE_SELECTION); } catch (e) { }
      this._updateBadge();
    },

    getSession: function () {
      try { return JSON.parse(localStorage.getItem(STORAGE_SESSION)); } catch (e) { return null; }
    },
    setSession: function (user) {
      user.loggedAt = Date.now();
      try { localStorage.setItem(STORAGE_SESSION, JSON.stringify(user)); } catch (e) { }
      this._updateBadge();
    },
    clearSession: function () {
      try { localStorage.removeItem(STORAGE_SESSION); } catch (e) { }
      this.clearSelection();
      this._removeBadge();
    },

    updateSessionLoja: function (loja) {
      var session = this.getSession();
      if (session) {
        session.lojaAtual = loja;
        this.setSession(session);
      }
      this.setSelection(session ? session.rede : (this.getSelection() || {}).rede, loja, session ? session.promotor : '', session ? session.estado : '');
    },

    isLoggedIn: function () {
      var s = this.getSession();
      if (!s) return false;
      if (Date.now() - s.loggedAt > SESSION_DURATION) { this.clearSession(); return false; }
      return true;
    },

    isLoginMode: function () { return configCache && configCache.LOGIN_ATIVO === true; },

    getRedeLojaPromotor: function () {
      var session = this.getSession();
      if (session && session.rede) return { rede: session.rede, loja: session.lojaAtual || '', promotor: session.promotor, estado: session.estado };
      return this.getSelection();
    },

    needsDailyConfirmation: function () {
      var last = localStorage.getItem(STORAGE_CONFIRMED);
      return last !== hojeStr();
    },

    setConfirmedToday: function () {
      try { localStorage.setItem(STORAGE_CONFIRMED, hojeStr()); } catch (e) { }
    },

    clearConfirmation: function () {
      try { localStorage.removeItem(STORAGE_CONFIRMED); } catch (e) { }
    },

    getUserLojas: function () {
      var info = this.getRedeLojaPromotor();
      if (!info || !configCache || !configCache.ESTRUTURA_ESTADOS) return [];
      var est = configCache.ESTRUTURA_ESTADOS;
      var session = this.getSession();
      if (session && session.lojas && session.lojas.length) {
        return session.lojas.filter(function (l) {
          for (var e in est) if (est[e][info.rede]) for (var p in est[e][info.rede])
            if (est[e][info.rede][p].indexOf(l) !== -1) return true;
          return false;
        });
      }
      return lojasDaRede(est, info.rede);
    },

    onChange: function (cb) { changeCallbacks.push(cb); },

    getLojasForRede: function (rede) {
      if (!configCache || !configCache.ESTRUTURA_ESTADOS) return [];
      return lojasDaRede(configCache.ESTRUTURA_ESTADOS, rede);
    },

    findPromotor: function (rede, loja) {
      if (!configCache) return null;
      var est = configCache.ESTRUTURA_ESTADOS;
      if (!est) return null;
      for (var e in est)
        if (est[e][rede])
          for (var p in est[e][rede])
            if (est[e][rede][p].indexOf(loja) !== -1)
              return { promotor: p, estado: e };
      return null;
    },

    applyToDropdowns: function (redeSelectId, lojaSelectId) {
      var info = this.getRedeLojaPromotor();
      if (!info || !configCache) return;
      var est = configCache.ESTRUTURA_ESTADOS;
      if (!est) return;
      var redeSel = document.getElementById(redeSelectId);
      var lojaSel = document.getElementById(lojaSelectId);
      if (!redeSel) return;

      var redes = estruturaToRedes(est);
      redeSel.innerHTML = '<option value="">Selecione a Rede</option>';
      redes.forEach(function (r) { redeSel.innerHTML += '<option value="' + r.replace(/"/g, '&quot;') + '"' + (r === info.rede ? ' selected' : '') + '>' + r + '</option>'; });
      if (redeSel.onchange) redeSel.onchange();

      if (!lojaSel) return;
      var lojas = lojasDaRede(est, info.rede);
      lojaSel.innerHTML = '<option value="">Selecione a Loja</option>';
      lojas.forEach(function (l) { lojaSel.innerHTML += '<option value="' + l.replace(/"/g, '&quot;') + '"' + (l === info.loja ? ' selected' : '') + '>' + l + '</option>'; });
      if (lojaSel.onchange) lojaSel.onchange();
    },

    promptIfNeeded: function (opts) {
      opts = opts || {};
      var self = this;

      if (!this.needsDailyConfirmation()) {
        if (this.isLoginMode()) {
          if (this.isLoggedIn()) return Promise.resolve();
        } else {
          if (this.getSelection()) return Promise.resolve();
        }
      }

      return this.loadConfig().then(function (cfg) {
        if (!cfg && opts.allowSkip) return;
        if (!cfg) return self._showErrorModal('Não foi possível carregar os dados da planilha. Verifique sua conexão.');
        if (cfg.LOGIN_ATIVO) return self._showLoginModal();
        return self._showEntradaModal();
      });
    },

    logout: function () {
      this.clearConfirmation();
      this.clearSession();
      location.reload();
    },

    showBadge: function (containerId) {
      var container = document.getElementById(containerId);
      if (!container) return;
      this._badgeContainer = container;
      this._updateBadge();
    },

    _badgeContainer: null,
    _badgeEl: null,

    _updateBadge: function () {
      var c = this._badgeContainer;
      if (!c) return;
      var info = this.getRedeLojaPromotor();
      var session = this.getSession();
      if (this._badgeEl) { this._badgeEl.remove(); this._badgeEl = null; }
      if (!info && !session) return;
      var self = this;
      var html = '<span class="gs-badge" style="display:inline-flex;align-items:center;gap:6px;background:#1e1b4b;color:white;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;white-space:nowrap;cursor:pointer;">';
      if (info) html += '🏪 ' + info.rede + ' › ' + info.loja;
      if (session) html += ' 👤 ' + session.email;
      html += ' <span class="gs-badge-switch" style="font-size:10px;opacity:0.7;">🔄</span>';
      html += ' <span class="gs-badge-close" style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:50%;width:20px;height:20px;font-size:12px;cursor:pointer;line-height:1;text-align:center;display:inline-block;">✕</span>';
      html += '</span>';
      var div = document.createElement('div');
      div.innerHTML = html;
      this._badgeEl = div.firstChild;

      this._badgeEl.querySelector('.gs-badge-close').addEventListener('click', function (e) {
        e.stopPropagation();
        self.logout();
      });

      this._badgeEl.querySelector('.gs-badge-switch').addEventListener('click', function (e) {
        e.stopPropagation();
        self._showTrocaLojaModal();
      });

      this._badgeEl.addEventListener('click', function (e) {
        if (e.target.classList.contains('gs-badge-close') || e.target.classList.contains('gs-badge-switch')) return;
        self._showTrocaLojaModal();
      });

      c.appendChild(this._badgeEl);
    },

    _removeBadge: function () {
      if (this._badgeEl) { this._badgeEl.remove(); this._badgeEl = null; }
    },

    _showErrorModal: function (msg) {
      this._createModal('<div style="text-align:center;padding:20px;"><div style="font-size:48px;margin-bottom:12px;">⚠️</div><p style="font-size:16px;color:#dc2626;font-weight:600;">' + msg + '</p><button onclick="GlobalState._closeModal()" class="gs-btn" style="margin-top:16px;padding:10px 28px;background:#1e1b4b;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;">Tentar novamente</button></div>');
    },

    _createModal: function (innerHtml) {
      this._removeModal();
      var overlay = document.createElement('div');
      overlay.id = 'gs-modal-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.7);backdrop-filter:blur(6px);z-index:99999;display:flex;align-items:center;justify-content:center;';
      var box = document.createElement('div');
      box.style.cssText = 'background:white;border-radius:20px;padding:28px 24px;width:90%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto;';
      box.innerHTML = innerHtml;
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    },

    _removeModal: function () {
      var el = document.getElementById('gs-modal-overlay');
      if (el) el.remove();
    },

    _closeModal: function () {
      this._removeModal();
    },

    _showWelcomeToast: function (promotor, rede, loja) {
      this._removeToast();
      var toast = document.createElement('div');
      toast.id = 'gs-welcome-toast';
      toast.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:99999;background:linear-gradient(135deg,#10b981,#059669);color:white;padding:16px 28px;border-radius:16px;font-size:16px;font-weight:700;box-shadow:0 8px 32px rgba(5,150,105,0.4);display:flex;align-items:center;gap:12px;animation:slideDown 0.4s ease;white-space:nowrap;';
      toast.innerHTML = '✅ Bem-vindo, ' + promotor + '! (' + rede + ' › ' + loja + ')';
      document.body.appendChild(toast);
      var self = this;
      setTimeout(function () { self._removeToast(); }, 2500);
    },

    _removeToast: function () {
      var el = document.getElementById('gs-welcome-toast');
      if (el) el.remove();
    },

    _showEntradaModal: function () {
      var est = configCache && configCache.ESTRUTURA_ESTADOS;
      if (!est) return;
      var self = this;
      var redes = estruturaToRedes(est);
      var saved = this.getSelection();
      var redeOpts = '<option value="">Selecione a Rede</option>';
      redes.forEach(function (r) { redeOpts += '<option value="' + r.replace(/"/g, '&quot;') + '"' + (r === (saved && saved.rede) ? ' selected' : '') + '>' + r + '</option>'; });

      this._createModal(
        '<h2 style="font-size:20px;font-weight:800;color:#1e1b4b;margin:0 0 4px;text-align:center;">👋 Bem-vindo!</h2>' +
        '<p style="text-align:center;color:#64748b;font-size:14px;margin:0 0 20px;">Selecione sua Rede e Loja</p>' +
        '<div style="margin-bottom:14px;"><label style="display:block;font-size:13px;font-weight:700;color:#475569;margin-bottom:4px;">Rede</label>' +
        '<select id="gs-rede" style="width:100%;padding:12px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:15px;background:white;">' + redeOpts + '</select></div>' +
        '<div style="margin-bottom:22px;"><label style="display:block;font-size:13px;font-weight:700;color:#475569;margin-bottom:4px;">Loja</label>' +
        '<select id="gs-loja" disabled style="width:100%;padding:12px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:15px;background:white;">' +
        '<option value="">Aguardando rede...</option></select></div>' +
        '<button id="gs-confirm" disabled style="width:100%;padding:14px;background:linear-gradient(135deg,#1e1b4b,#4f46e5);color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;opacity:0.5;">Entrar</button>'
      );

      var redeEl = document.getElementById('gs-rede');
      var lojaEl = document.getElementById('gs-loja');
      var confirmEl = document.getElementById('gs-confirm');

      // Pré-preenche loja se rede já está pré-selecionada
      if (saved && saved.rede) {
        var lojas = lojasDaRede(est, saved.rede);
        lojas.forEach(function (l) {
          lojaEl.innerHTML += '<option value="' + l.replace(/"/g, '&quot;') + '"' + (l === saved.loja ? ' selected' : '') + '>' + l + '</option>';
        });
        lojaEl.disabled = false;
        if (saved.loja) {
          confirmEl.disabled = false;
          confirmEl.style.opacity = '1';
        }
      }

      redeEl.addEventListener('change', function () {
        var rede = redeEl.value;
        lojaEl.innerHTML = '<option value="">Selecione a Loja</option>';
        lojaEl.disabled = !rede;
        confirmEl.disabled = true;
        confirmEl.style.opacity = '0.5';
        if (!rede) return;
        var lojas = lojasDaRede(est, rede);
        lojas.forEach(function (l) { lojaEl.innerHTML += '<option value="' + l.replace(/"/g, '&quot;') + '">' + l + '</option>'; });
      });

      lojaEl.addEventListener('change', function () {
        var ok = redeEl.value && lojaEl.value;
        confirmEl.disabled = !ok;
        confirmEl.style.opacity = ok ? '1' : '0.5';
      });

      confirmEl.addEventListener('click', function () {
        var rede = redeEl.value;
        var loja = lojaEl.value;
        if (!rede || !loja) return;
        var p = self.findPromotor(rede, loja);
        self.setSelection(rede, loja, p ? p.promotor : '', p ? p.estado : '');
        self.setConfirmedToday();
        self._closeModal();
        self._showWelcomeToast(p ? p.promotor : '', rede, loja);
      });
    },

    _showLoginModal: function () {
      var self = this;
      this._createModal(
        '<h2 style="font-size:20px;font-weight:800;color:#1e1b4b;margin:0 0 4px;text-align:center;">🔐 Login</h2>' +
        '<p style="text-align:center;color:#64748b;font-size:14px;margin:0 0 20px;">Informe seu e-mail e senha</p>' +
        '<div style="margin-bottom:12px;"><label style="display:block;font-size:13px;font-weight:700;color:#475569;margin-bottom:4px;">E-mail</label>' +
        '<input type="email" id="gs-email" placeholder="seu@email.com" style="width:100%;padding:12px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:15px;background:white;"></div>' +
        '<div style="margin-bottom:22px;"><label style="display:block;font-size:13px;font-weight:700;color:#475569;margin-bottom:4px;">Senha</label>' +
        '<input type="password" id="gs-senha" placeholder="••••••" style="width:100%;padding:12px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:15px;background:white;"></div>' +
        '<div id="gs-login-error" style="display:none;color:#dc2626;font-size:13px;font-weight:600;text-align:center;margin-bottom:10px;"></div>' +
        '<button id="gs-login-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#1e1b4b,#4f46e5);color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;">Entrar</button>'
      );

      var emailEl = document.getElementById('gs-email');
      var senhaEl = document.getElementById('gs-senha');
      var btnEl = document.getElementById('gs-login-btn');
      var errorEl = document.getElementById('gs-login-error');

      function submitLogin() {
        var email = emailEl.value.trim();
        var senha = senhaEl.value;
        if (!email || !senha) { errorEl.textContent = 'Preencha e-mail e senha.'; errorEl.style.display = 'block'; return; }
        errorEl.style.display = 'none';
        btnEl.disabled = true;
        btnEl.textContent = 'Entrando...';
        var loginTimeout = setTimeout(function() {
          errorEl.textContent = 'Erro ao conectar ao servidor. Tente novamente.';
          errorEl.style.display = 'block';
          btnEl.disabled = false;
          btnEl.textContent = 'Entrar';
        }, 15000);

        _postViaForm(gasUrl, { action: 'validar_login', email: email, senha: senha }, function(data) {
          clearTimeout(loginTimeout);
          btnEl.disabled = false;
          btnEl.textContent = 'Entrar';
          if (data && data.success) {
            self.setSession(data.user);
            self._closeModal();
            self._showLojaStep(data.user);
          } else {
            errorEl.textContent = 'E-mail ou senha inválidos.';
            errorEl.style.display = 'block';
          }
        });
      }

      btnEl.addEventListener('click', submitLogin);
      senhaEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitLogin(); });
    },

    _showLojaStep: function (user) {
      if (!configCache) return;
      var est = configCache.ESTRUTURA_ESTADOS;
      if (!est || !est[user.estado] || !est[user.estado][user.rede]) return;
      var promotorLojas = est[user.estado][user.rede][user.promotor] || [];
      if (!promotorLojas.length) return;

      var lojasPermitidas = user.lojas && user.lojas.length ? user.lojas.filter(function (l) { return promotorLojas.indexOf(l) !== -1; }) : promotorLojas;
      var self = this;

      if (lojasPermitidas.length === 1) {
        user.lojaAtual = lojasPermitidas[0];
        self.setSession(user);
        self.setSelection(user.rede, user.lojaAtual, user.promotor, user.estado);
        self.setConfirmedToday();
        self._showWelcomeToast(user.promotor, user.rede, user.lojaAtual);
        return;
      }

      var opts = '';
      lojasPermitidas.forEach(function (l) { opts += '<option value="' + l.replace(/"/g, '&quot;') + '">' + l + '</option>'; });

      this._createModal(
        '<h2 style="font-size:20px;font-weight:800;color:#1e1b4b;margin:0 0 4px;text-align:center;">🏪 Selecione a Loja</h2>' +
        '<p style="text-align:center;color:#64748b;font-size:14px;margin:0 0 8px;">' + user.promotor + ' — ' + user.rede + '</p>' +
        '<div style="margin-bottom:22px;"><label style="display:block;font-size:13px;font-weight:700;color:#475569;margin-bottom:4px;">Loja</label>' +
        '<select id="gs-loja-step" style="width:100%;padding:12px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:15px;background:white;">' + opts + '</select></div>' +
        '<button id="gs-loja-confirm" style="width:100%;padding:14px;background:linear-gradient(135deg,#1e1b4b,#4f46e5);color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;">Entrar</button>'
      );

      document.getElementById('gs-loja-confirm').addEventListener('click', function () {
        user.lojaAtual = document.getElementById('gs-loja-step').value;
        self.setSession(user);
        self.setSelection(user.rede, user.lojaAtual, user.promotor, user.estado);
        self.setConfirmedToday();
        self._closeModal();
        self._showWelcomeToast(user.promotor, user.rede, user.lojaAtual);
      });
    },

    _showTrocaLojaModal: function () {
      var info = this.getRedeLojaPromotor();
      if (!info || !info.rede) return;
      var est = configCache && configCache.ESTRUTURA_ESTADOS;
      if (!est) return;

      var lojas = this.getUserLojas();
      if (lojas.length < 2) return;

      var self = this;
      var opts = '';
      lojas.forEach(function (l) { opts += '<option value="' + l.replace(/"/g, '&quot;') + '"' + (l === info.loja ? ' selected' : '') + '>' + l + '</option>'; });

      this._createModal(
        '<h2 style="font-size:18px;font-weight:800;color:#1e1b4b;margin:0 0 4px;text-align:center;">🔄 Trocar Loja</h2>' +
        '<p style="text-align:center;color:#64748b;font-size:14px;margin:0 0 16px;">' + info.rede + '</p>' +
        '<div style="margin-bottom:18px;"><label style="display:block;font-size:13px;font-weight:700;color:#475569;margin-bottom:4px;">Loja</label>' +
        '<select id="gs-troca-loja" style="width:100%;padding:12px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:15px;background:white;">' + opts + '</select></div>' +
        '<button id="gs-troca-confirm" style="width:100%;padding:14px;background:linear-gradient(135deg,#1e1b4b,#4f46e5);color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;">Trocar</button>'
      );

      document.getElementById('gs-troca-confirm').addEventListener('click', function () {
        var loja = document.getElementById('gs-troca-loja').value;
        if (!loja || loja === info.loja) { self._closeModal(); return; }
        self.updateSessionLoja(loja);
        self.setConfirmedToday();
        self._closeModal();
        var p = self.getRedeLojaPromotor();
        if (p) self._showWelcomeToast(p.promotor, p.rede, p.loja);
      });
    }
  };
})();
