(function () {
  'use strict';

  var listenersAdded = false;

  function getSelection() {
    if (window.GlobalState) return window.GlobalState.getRedeLojaPromotor();
    try { return JSON.parse(localStorage.getItem('qd_global_selection')); } catch (e) { return null; }
  }

  function paramsStr(sel) {
    if (!sel) return '';
    return '?rede=' + encodeURIComponent(sel.rede) + '&loja=' + encodeURIComponent(sel.loja);
  }

  window.IframeComm = {
    reloadWithSelection: function (iframeEl) {
      var sel = getSelection();
      if (!sel || !iframeEl) return;
      var base = iframeEl.src.split('?')[0];
      iframeEl.src = base + paramsStr(sel);
    },

    reloadAllWithSelection: function (containerSelector) {
      var container = document.querySelector(containerSelector || 'body');
      if (!container) return;
      var sel = getSelection();
      if (!sel) return;
      container.querySelectorAll('iframe').forEach(function (iframe) {
        var base = iframe.src.split('?')[0];
        iframe.src = base + paramsStr(sel);
      });
    },

    sendToIframe: function (iframeEl) {
      var sel = getSelection();
      if (!sel || !iframeEl || !iframeEl.contentWindow) return;
      try {
        iframeEl.contentWindow.postMessage({ type: 'selection', rede: sel.rede, loja: sel.loja }, '*');
      } catch (e) { }
    },

    sendToAllIframes: function () {
      var sel = getSelection();
      if (!sel) return;
      document.querySelectorAll('iframe').forEach(function (iframe) {
        try {
          if (iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'selection', rede: sel.rede, loja: sel.loja }, '*');
        } catch (e) { }
      });
    },

    setupAutoSend: function (containerSelector) {
      var self = this;
      if (window.GlobalState) {
        window.GlobalState.onChange(function () {
          self.reloadAllWithSelection(containerSelector);
        });
      }
      if (!listenersAdded) {
        document.addEventListener('DOMContentLoaded', function () {
          document.querySelectorAll('iframe').forEach(function (iframe) {
            iframe.addEventListener('load', function () {
              self.sendToIframe(iframe);
            });
          });
        });
        listenersAdded = true;
      }
    }
  };
})();
