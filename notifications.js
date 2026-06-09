/**
 * MÓDULO DE NOTIFICAÇÕES E TIMERS - Qdelícia Frutas
 * Versão atualizada:
 *  - Estoque Inicial e Estoque Final como dois cards separados
 *  - Aviso Sério exibido como modal bloqueante (requer clique em "Ciente")
 *  - Animações de pulse sem transform: scale() (evita tremido na página)
 */

const NOTIFICATIONS_CONFIG = {

    // === ESTOQUE INICIAL ===
    estoque: {
        enabled: true,
        titulo: "Estoque Inicial",
        schedule: {
            type: 'daily',
            startTime: "06:00",
            endTime: "10:00",
        },
        labels: {
            open: "Envio até às",
            closed: "Próximo envio às",
            next: "Faltam %d dias"
        },
        urgenciaMinutos: 60
    },

    // === ESTOQUE FINAL ===
    estoqueF: {
        enabled: true,
        titulo: "Estoque Final",
        schedule: {
            type: 'daily',
            startTime: "12:30",
            endTime: "14:20",
        },
        labels: {
            open: "Envio até às",
            closed: "Próximo envio às",
            next: "Faltam %d dias"
        },
        urgenciaMinutos: 60
    },

    // === AVISO SÉRIO (MODAL BLOQUEANTE) ===
    // Defina enabled: true para exibir o modal ao abrir a página.
    // O modal exige clique em "Ciente" para prosseguir.
    // É exibido uma vez por sessão (sessionStorage).
    avisoSerio: {
        enabled: false,
        timer: 'off',           // 'on' para mostrar contagem regressiva no modal, 'off' para ocultar
        titulo: "Atenção",
        mensagem: "O Balanço de Caixas foi agendado para o dia 08/06/2026 (segunda-feira). Anote a data para não esquecer.",
        dataAlvo: "2026-06-18T08:00:00",
        labels: {
            next: "Faltam %d dias"
        },
        corFundo: "#c62828",
        corTexto: "#ffffff",
    },

    // === CONFIGURAÇÃO DE PÁGINAS (ON/OFF) ===
    pages: {
        estoque: {
            enabled: true,
            filename: "estoque.html",
            mensagem: "A página de estoque está temporariamente desativada."
        },
        camera: {
            enabled: true,
            filename: "camera.html",
            mensagem: "A funcionalidade de câmera está em manutenção."
        },
        materiais: {
            enabled: true,
            filename: "materiais.html",
            mensagem: "A página de materiais está em manutenção."
        },
        pedido: {
            enabled: true,
            filename: "pedido.html",
            mensagem: "A página de pedidos está temporariamente desativada.",
            features: {
                pdf_share: false
            }
        },
        solicitacoes: {
            enabled: true,
            filename: "solicitacoes.html",
            mensagem: "A página de solicitações está temporariamente desativada."
        },
        feriados: {
            enabled: true,
            filename: "feriados.html",
            mensagem: "A página de feriados está temporariamente desativada."
        }
    }
};

/* ================================================================
   MÓDULO PRINCIPAL (IIFE)
   ================================================================ */
(function () {

    /* ── Inicialização ──────────────────────────────────────── */
    function inicializarNotificacoes() {
        gerenciarAcessoPaginas();
        gerenciarAvisoSerioModal();
        gerenciarQuadrosOriginais();
        setInterval(atualizarTodosOsTimers, 1000);
        atualizarTodosOsTimers();
    }

    /* ── Controle de acesso por página ──────────────────────── */
    function gerenciarAcessoPaginas() {
        const config = NOTIFICATIONS_CONFIG.pages;
        if (!config) return;

        const pageName = window.location.pathname.split('/').pop().split('?')[0];

        for (const key in config) {
            const pageConfig = config[key];
            if (pageConfig.filename && pageName.toLowerCase() === pageConfig.filename.toLowerCase()) {
                if (!pageConfig.enabled) {
                    alert(pageConfig.mensagem || 'Página indisponível');
                    window.location.href = 'index.html';
                    return;
                }
            }
        }

        document.querySelectorAll('a').forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;
            for (const key in config) {
                const pageConfig = config[key];
                if (href.toLowerCase().includes(pageConfig.filename.toLowerCase()) && !pageConfig.enabled) {
                    link.style.display = 'none';
                }
            }
        });
    }

    /* ── Modal de Aviso Sério ────────────────────────────────── */
    function gerenciarAvisoSerioModal() {
        const config = NOTIFICATIONS_CONFIG.avisoSerio;
        if (!config.enabled) return;

        // Exibir apenas uma vez por sessão
        if (sessionStorage.getItem('qd_avisoSerioVisto')) return;

        const corFundo = config.corFundo || '#c62828';
        const corTexto = config.corTexto || '#ffffff';

        const timerHTML = config.timer === 'on'
            ? `<div class="modal-rotulo" id="modal-rotulo-aviso">---</div>
               <div class="modal-timer" id="modal-timer-aviso">00:00:00:00</div>`
            : '';

        const overlay = document.createElement('div');
        overlay.className = 'aviso-serio-overlay';
        overlay.id = 'aviso-serio-overlay';
        overlay.innerHTML = `
            <div class="aviso-serio-modal" style="background:${corFundo};color:${corTexto};">
                <div class="modal-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="modal-titulo">${config.titulo}</div>
                <div class="modal-mensagem">${config.mensagem}</div>
                ${timerHTML}
                <button class="modal-ciente-btn" id="btn-modal-ciente">
                    <i class="fas fa-check"></i> Ciente
                </button>
            </div>
        `;

        document.body.appendChild(overlay);

        // Bloqueia scroll da página enquanto o modal está aberto
        document.body.style.overflow = 'hidden';

        overlay.querySelector('#btn-modal-ciente').addEventListener('click', fecharAvisoSerioModal);
    }

    function fecharAvisoSerioModal() {
        const overlay = document.getElementById('aviso-serio-overlay');
        if (!overlay) return;
        overlay.classList.add('saindo');
        setTimeout(() => {
            overlay.remove();
            document.body.style.overflow = '';
        }, 260);
        sessionStorage.setItem('qd_avisoSerioVisto', '1');
    }

    // Expõe globalmente caso seja necessário fechar via onclick inline
    window.fecharAvisoSerioModal = fecharAvisoSerioModal;

    /* ── Quadro de avisos (mural) ────────────────────────────── */
    function gerenciarQuadrosOriginais() {
        const header = document.getElementById('cabecalho-principal');
        if (!header) return;

        let board = document.getElementById('status-envio');
        if (!board) {
            board = document.createElement('div');
            board.id = 'status-envio';
            board.className = 'notification-board';

            // Card — Estoque Inicial
            if (NOTIFICATIONS_CONFIG.estoque.enabled) {
                const item = document.createElement('div');
                item.id = 'item-estoque-i';
                item.className = 'notification-item';
                item.innerHTML = `
                    <div class="notification-content">
                        <div class="notification-label">${NOTIFICATIONS_CONFIG.estoque.titulo}</div>
                        <div id="dia-rotulo" class="dia-rotulo">---</div>
                        <div id="timer-label-i" class="timer-label">---</div>
                        <div id="contagem-regressiva" class="timer">00:00:00</div>
                    </div>
                `;
                board.appendChild(item);
            }

            // Card — Estoque Final
            if (NOTIFICATIONS_CONFIG.estoqueF.enabled) {
                const itemF = document.createElement('div');
                itemF.id = 'item-estoque-f';
                itemF.className = 'notification-item';
                itemF.innerHTML = `
                    <div class="notification-content">
                        <div class="notification-label">${NOTIFICATIONS_CONFIG.estoqueF.titulo}</div>
                        <div id="dia-rotulo-f" class="dia-rotulo">---</div>
                        <div id="timer-label-f" class="timer-label">---</div>
                        <div id="contagem-regressiva-f" class="timer">00:00:00</div>
                    </div>
                `;
                board.appendChild(itemF);
            }

            // Insere logo após o header
            header.parentNode.insertBefore(board, header.nextSibling);
        }

        // Visibilidade do board
        const algumAtivo = NOTIFICATIONS_CONFIG.estoque.enabled || NOTIFICATIONS_CONFIG.estoqueF.enabled;
        board.style.display = algumAtivo ? 'flex' : 'none';
    }

    /* ── Atualização dos timers (a cada 1s) ─────────────────── */
    function atualizarTodosOsTimers() {
        if (NOTIFICATIONS_CONFIG.estoque.enabled) {
            atualizarBoard('estoque', 'dia-rotulo', 'contagem-regressiva', 'item-estoque-i', 'timer-label-i');
        }
        if (NOTIFICATIONS_CONFIG.estoqueF.enabled) {
            atualizarBoard('estoqueF', 'dia-rotulo-f', 'contagem-regressiva-f', 'item-estoque-f', 'timer-label-f');
        }
        if (NOTIFICATIONS_CONFIG.avisoSerio.enabled) {
            atualizarTimerAvisoSerioModal();
        }
    }

    function atualizarBoard(configKey, idRotulo, idTimer, idItem, idTimerLabel) {
        const config = NOTIFICATIONS_CONFIG[configKey];
        const elRotulo = document.getElementById(idRotulo);
        const elTimer  = document.getElementById(idTimer);
        const elItem   = document.getElementById(idItem);
        const elLabel  = document.getElementById(idTimerLabel);
        if (!elRotulo || !elTimer) return;

        const info  = calcularProximaMeta(config.schedule);
        const agora = new Date();
        const diferenca = info.meta - agora;

        // Rótulo do dia
        const d_agora = new Date(agora); d_agora.setHours(0, 0, 0, 0);
        const d_meta  = new Date(info.meta); d_meta.setHours(0, 0, 0, 0);
        const diasRestantes = Math.round((d_meta - d_agora) / 86400000);

        if (diasRestantes === 0)      elRotulo.innerText = 'Hoje';
        else if (diasRestantes === 1) elRotulo.innerText = 'Amanhã';
        else                          elRotulo.innerText = config.labels.next.replace('%d', diasRestantes);

        // Label de status (aberto/fechado)
        if (elLabel) {
            elLabel.innerText = info.isOpen
                ? config.labels.open  + ' ' + formatTime(info.meta)
                : config.labels.closed + ' ' + formatTime(info.meta);
        }

        // Urgência — aplica apenas box-shadow, sem transform: scale()
        if (info.isOpen && diferenca > 0) {
            const limiteUrgencia = config.urgenciaMinutos || 30;
            if ((diferenca / 60000) <= limiteUrgencia) {
                elItem && elItem.classList.add('urgente');
            } else {
                elItem && elItem.classList.remove('urgente');
            }
        } else {
            elItem && elItem.classList.remove('urgente');
        }

        // Contagem regressiva
        if (diferenca > 0) {
            const dias    = Math.floor(diferenca / 86400000);
            const horas   = Math.floor((diferenca / 3600000) % 24);
            const minutos = Math.floor((diferenca / 60000) % 60);
            const segundos = Math.floor((diferenca / 1000) % 60);
            elTimer.innerText = (dias > 0 ? dias + 'd ' : '')
                + pad(horas) + ':' + pad(minutos) + ':' + pad(segundos);
        } else {
            elTimer.innerText = '00:00:00';
        }
    }

    /* ── Timer do modal de aviso sério ──────────────────────── */
    function atualizarTimerAvisoSerioModal() {
        const config   = NOTIFICATIONS_CONFIG.avisoSerio;
        const elTimer  = document.getElementById('modal-timer-aviso');
        const elRotulo = document.getElementById('modal-rotulo-aviso');
        if (!elTimer) return;

        const agora = new Date();
        const meta  = new Date(config.dataAlvo);
        const diferenca = meta - agora;

        if (elRotulo) {
            const d_agora = new Date(agora); d_agora.setHours(0, 0, 0, 0);
            const d_meta  = new Date(meta);  d_meta.setHours(0, 0, 0, 0);
            const dias = Math.round((d_meta - d_agora) / 86400000);
            if (dias === 0)      elRotulo.innerText = 'Hoje';
            else if (dias === 1) elRotulo.innerText = 'Amanhã';
            else if (dias > 1)   elRotulo.innerText = config.labels.next.replace('%d', dias);
            else                 elRotulo.innerText = 'Encerrado';
        }

        if (config.timer === 'off') {
            elTimer.style.display = 'none';
        } else {
            elTimer.style.display = 'block';
            if (diferenca <= 0) { elTimer.innerText = '00:00:00:00'; return; }
            const d = Math.floor(diferenca / 86400000);
            const h = Math.floor((diferenca / 3600000) % 24);
            const m = Math.floor((diferenca / 60000) % 60);
            const s = Math.floor((diferenca / 1000) % 60);
            elTimer.innerText = pad(d) + ':' + pad(h) + ':' + pad(m) + ':' + pad(s);
        }
    }

    /* ── Helpers de agenda ──────────────────────────────────── */
    function calcularProximaMeta(sched) {
        const agora = new Date();

        function getProxDataValida(partida) {
            let data = new Date(partida);
            for (let i = 0; i < 365; i++) {
                if (isDiaValido(data, sched)) return data;
                data.setDate(data.getDate() + 1);
            }
            return data;
        }

        const hojeValido = isDiaValido(agora, sched);
        const start = parseTimeToDate(agora, sched.startTime);
        const end   = parseTimeToDate(agora, sched.endTime);

        if (hojeValido && agora < end) {
            return { meta: end, isOpen: agora >= start };
        }

        let amanha = new Date(agora);
        amanha.setDate(amanha.getDate() + 1);
        const proxData = getProxDataValida(amanha);
        return { meta: parseTimeToDate(proxData, sched.endTime), isOpen: false };
    }

    function isDiaValido(data, sched) {
        if (sched.type === 'daily') return true;
        if (sched.type === 'weekly') {
            const dia = data.getDay();
            if (!sched.days.includes(dia)) return false;
            if (sched.weekInterval && sched.referenceDate) {
                const ref = new Date(sched.referenceDate); ref.setHours(0, 0, 0, 0);
                const d   = new Date(data); d.setHours(0, 0, 0, 0);
                return Math.floor((d - ref) / (7 * 86400000)) % sched.weekInterval === 0;
            }
            return true;
        }
        if (sched.type === 'interval') {
            const ref  = new Date(sched.referenceDate); ref.setHours(0, 0, 0, 0);
            const d    = new Date(data); d.setHours(0, 0, 0, 0);
            const diff = Math.round((d - ref) / 86400000);
            return diff >= 0 && diff % sched.interval === 0;
        }
        return false;
    }

    function parseTimeToDate(baseData, timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        const d = new Date(baseData);
        d.setHours(h, m, 0, 0);
        return d;
    }

    function formatTime(date) {
        return pad(date.getHours()) + ':' + pad(date.getMinutes());
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    /* ── Bootstrap ──────────────────────────────────────────── */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarNotificacoes);
    } else {
        inicializarNotificacoes();
    }

})();
