(function () {
    'use strict';

    var ESTRUTURA_KEY = 'qd_app_estrutura';
    var SELECTION_KEY = 'qd_app_selection';
    var GAS_BASE_URL = window.QD_ESTRUTURA_URL || 'https://script.google.com/macros/s/AKfycbxUENjCvm715TESMt3wjyYAIjfhdyUstNF8QpnQmUdCKcfhJbYUFK3pYRmnCyRMuzQL/exec';
    var GAS_JSON_URL = GAS_BASE_URL + '?json=estrutura';

    var structureCache = null;

    function getSelecao() {
        try {
            return JSON.parse(localStorage.getItem(SELECTION_KEY)) || {};
        } catch (e) {
            return {};
        }
    }

    function syncSessionToGAS(rede, loja, promotor) {
        var url = GAS_BASE_URL + '?action=setSession&rede=' + encodeURIComponent(rede) + '&loja=' + encodeURIComponent(loja) + '&promotor=' + encodeURIComponent(promotor || '');
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.send();
    }

    function salvarSelecao(rede, loja, promotor) {
        localStorage.setItem(SELECTION_KEY, JSON.stringify({
            rede: rede,
            loja: loja,
            promotor: promotor || ''
        }));
        syncSessionToGAS(rede, loja, promotor);
    }

    function limparSelecao() {
        localStorage.removeItem(SELECTION_KEY);
        var xhr = new XMLHttpRequest();
        xhr.open('GET', GAS_BASE_URL + '?action=clearSession', true);
        xhr.send();
    }

    function getEstruturaFromCache() {
        if (structureCache) return structureCache;
        try {
            var raw = localStorage.getItem(ESTRUTURA_KEY);
            if (raw) {
                structureCache = JSON.parse(raw);
                return structureCache;
            }
        } catch (e) {}
        return null;
    }

    function setEstruturaCache(data) {
        structureCache = data;
        try {
            localStorage.setItem(ESTRUTURA_KEY, JSON.stringify(data));
        } catch (e) {}
    }

    function flattenRedes(estrutura) {
        var redes = [];
        if (!estrutura) return redes;
        var seen = {};
        for (var est in estrutura) {
            for (var rede in estrutura[est]) {
                if (!seen[rede]) {
                    seen[rede] = true;
                    redes.push(rede);
                }
            }
        }
        return redes.sort();
    }

    function flattenLojas(estrutura, rede) {
        var lojas = [];
        if (!estrutura || !rede) return lojas;
        var seen = {};
        for (var est in estrutura) {
            if (estrutura[est][rede]) {
                for (var prom in estrutura[est][rede]) {
                    estrutura[est][rede][prom].forEach(function (l) {
                        if (!seen[l]) {
                            seen[l] = true;
                            lojas.push(l);
                        }
                    });
                }
            }
        }
        return lojas.sort();
    }

    function findPromotorPorLoja(estrutura, rede, loja) {
        if (!estrutura || !rede || !loja) return null;
        for (var est in estrutura) {
            if (estrutura[est][rede]) {
                for (var prom in estrutura[est][rede]) {
                    if (estrutura[est][rede][prom].indexOf(loja) !== -1) {
                        return prom;
                    }
                }
            }
        }
        return null;
    }

    function carregarRedes(selectEl, estrutura) {
        if (!selectEl) return;
        selectEl.innerHTML = '<option value="" disabled selected>Selecione a Rede</option>';
        var redes = flattenRedes(estrutura);
        redes.forEach(function (r) {
            var opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            selectEl.appendChild(opt);
        });
        selectEl.disabled = redes.length === 0;
    }

    function carregarLojas(rede, selectEl, estrutura) {
        if (!selectEl) return;
        selectEl.innerHTML = '<option value="" disabled selected>Selecione a Loja</option>';
        if (!rede || !estrutura) {
            selectEl.disabled = true;
            return;
        }
        var lojas = flattenLojas(estrutura, rede);
        lojas.forEach(function (l) {
            var opt = document.createElement('option');
            opt.value = l;
            opt.textContent = l;
            selectEl.appendChild(opt);
        });
        selectEl.disabled = lojas.length === 0;
    }

    function travarDropdowns(selectRede, selectLoja) {
        if (selectRede) selectRede.disabled = true;
        if (selectLoja) selectLoja.disabled = true;
    }

    function destravarDropdowns(selectRede, selectLoja) {
        if (selectRede) selectRede.disabled = false;
        if (selectLoja) selectLoja.disabled = false;
    }

    function restaurarSelecao(selectRede, selectLoja, opts) {
        opts = opts || {};
        var estrutura = opts.estrutura || getEstruturaFromCache();
        var selecao = opts.selecao || getSelecao();

        carregarRedes(selectRede, estrutura);

        var ok = false;
        if (selecao.rede && estrutura) {
            selectRede.value = selecao.rede;
            carregarLojas(selecao.rede, selectLoja, estrutura);
            if (selecao.loja) {
                selectLoja.value = selecao.loja;
                ok = true;
            }
        }

        if (ok && opts.lock !== false) {
            travarDropdowns(selectRede, selectLoja);
        }

        if (typeof opts.onReady === 'function') {
            opts.onReady(ok, selecao, estrutura);
        }

        return { ok: ok, selecao: selecao, estrutura: estrutura };
    }

    function fetchEstrutura() {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', GAS_JSON_URL, true);
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 400) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        setEstruturaCache(data);
                        resolve(data);
                    } catch (e) {
                        reject(new Error('Resposta inválida do servidor: ' + e.message));
                    }
                } else {
                    reject(new Error('Erro HTTP ' + xhr.status));
                }
            };
            xhr.onerror = function () {
                reject(new Error('Falha de rede ao buscar estrutura'));
            };
            xhr.send();
        });
    }

    function fetchEstruturaComFallback() {
        return fetchEstrutura().catch(function (err) {
            var cached = getEstruturaFromCache();
            if (cached) return cached;
            throw err;
        });
    }

    function getPromotorFullName(promotorNome) {
        if (window.APP_CONFIG && window.APP_CONFIG.users) {
            for (var key in window.APP_CONFIG.users) {
                if (window.APP_CONFIG.users[key].fullName === promotorNome || key === promotorNome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) {
                    return window.APP_CONFIG.users[key].fullName;
                }
            }
        }
        return promotorNome;
    }

    window.QD = window.QD || {};
    window.QD.getSelecao = getSelecao;
    window.QD.salvarSelecao = salvarSelecao;
    window.QD.limparSelecao = limparSelecao;
    window.QD.getEstruturaFromCache = getEstruturaFromCache;
    window.QD.flattenRedes = flattenRedes;
    window.QD.flattenLojas = flattenLojas;
    window.QD.findPromotorPorLoja = findPromotorPorLoja;
    window.QD.carregarRedes = carregarRedes;
    window.QD.carregarLojas = carregarLojas;
    window.QD.travarDropdowns = travarDropdowns;
    window.QD.destravarDropdowns = destravarDropdowns;
    window.QD.restaurarSelecao = restaurarSelecao;
    window.QD.fetchEstrutura = fetchEstrutura;
    window.QD.fetchEstruturaComFallback = fetchEstruturaComFallback;
    window.QD.getPromotorFullName = getPromotorFullName;

})();
