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

  function _fetchFromGas(action, params) {
    var url = gasUrl + '?page=' + encodeURIComponent(action) + '&fmt=html';
    if (params) {
      for (var k in params) {
        if (params.hasOwnProperty(k))
          url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]));
      }
    }
    return new Promise(function(resolve, reject) {
      var iframe = document.createElement('iframe');
      iframe.style.cssText = 'display:none;width:0;height:0;border:0;';
      iframe.src = url;
      var timedOut = false;
      var timeout = setTimeout(function() {
        timedOut = true;
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        reject('timeout');
      }, 20000);

      function handler(e) {
        if (timedOut) return;
        if (!e.data || typeof e.data !== 'object') return;
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        resolve(e.data);
      }
      window.addEventListener('message', handler);
      document.body.appendChild(iframe);
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
      return _fetchFromGas('json_config').then(function (data) {
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
    fetchFromGas: function (action, params) { return _fetchFromGas(action, params); },
    postViaForm: function (url, data, callback) { _postViaForm(url, data, callback); },

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

    requireAuth: function () {
      var sel = this.getSelection();
      var session = this.getSession();
      if (!sel && !session) {
        var redirect = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace('login.html?redirect=' + redirect);
        return false;
      }
      if (session && !this.isLoggedIn()) {
        this.clearSession();
        var redirect2 = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace('login.html?redirect=' + redirect2);
        return false;
      }
      return true;
    },

    logout: function () {
      this.clearConfirmation();
      this.clearSession();
      window.location.replace('login.html');
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
      if (info) html += ' ' + info.rede + ' \u203A ' + info.loja;
      if (session) html += ' \ud83d\udc64 ' + session.email;
      html += ' <span class="gs-badge-switch" style="font-size:10px;opacity:0.7;">\ud83d\udd04</span>';
      html += ' <span class="gs-badge-close" style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:50%;width:20px;height:20px;font-size:12px;cursor:pointer;line-height:1;text-align:center;display:inline-block;">\u2715</span>';
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

      var overlay = document.createElement('div');
      overlay.id = 'gs-modal-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.7);backdrop-filter:blur(6px);z-index:99999;display:flex;align-items:center;justify-content:center;';
      var box = document.createElement('div');
      box.style.cssText = 'background:white;border-radius:20px;padding:28px 24px;width:90%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.3);';
      box.innerHTML =
        '<h2 style="font-size:18px;font-weight:800;color:#1e1b4b;margin:0 0 4px;text-align:center;">Trocar Loja</h2>' +
        '<p style="text-align:center;color:#64748b;font-size:14px;margin:0 0 16px;">' + info.rede + '</p>' +
        '<div style="margin-bottom:18px;"><label style="display:block;font-size:13px;font-weight:700;color:#475569;margin-bottom:4px;">Loja</label>' +
        '<select id="gs-troca-loja" style="width:100%;padding:12px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:15px;background:white;">' + opts + '</select></div>' +
        '<button id="gs-troca-confirm" style="width:100%;padding:14px;background:linear-gradient(135deg,#1e1b4b,#4f46e5);color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;">Trocar</button>';
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      document.getElementById('gs-troca-confirm').addEventListener('click', function () {
        var loja = document.getElementById('gs-troca-loja').value;
        if (!loja || loja === info.loja) { overlay.remove(); return; }
        self.updateSessionLoja(loja);
        self.setConfirmedToday();
        overlay.remove();
      });
    }
  };
})();
