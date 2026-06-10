(function () {
    'use strict';

    var API_KEY_STORAGE = 'qd_bananeiro_api_key';
    var API_URL = 'https://api.groq.com/openai/v1/chat/completions';
    var MODEL = 'llama-3.1-8b-instant';
    var DEFAULT_KEY = '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';

    var state = {
        isMuted: false,
        messages: [],
        isListening: false,
        isOpen: false,
        recognition: null,
        synth: window.speechSynthesis,
        utterance: null
    };

    var els = {};

    var SYSTEM_PROMPT = [
        'Você é o Bananeiro, um assistente virtual especialista em hortifrutigranjeiros.',
        'Você trabalha apoiando promotores de venda de hortifrúti em supermercados.',
        'Responda SEMPRE em português brasileiro, de forma clara, prática e amigável.',
        'Use linguagem simples e direta, como um colega de trabalho experiente.',
        'Suas respostas devem ser curtas e objetivas, no máximo 3 parágrafos.',
        '',
        'VOCÊ PODE AJUDAR COM:',
        '- Seleção e escolha de frutas, verduras e legumes (como identificar os melhores)',
        '- Armazenamento e conservação (geladeira, temperatura, umidade)',
        '- Exposição em gôndola e organização de seção de hortifrúti',
        '- Receitas simples e sugestões de uso culinário',
        '- Identificação de qualidade, maturação e possíveis defeitos',
        '- Manuseio pós-colheita e transporte',
        '- Sazonalidade e disponibilidade de cada produto',
        '- Dicas para reduzir perdas e desperdício',
        '- Organização de estoque e rodízio de produtos (PEPS)',
        '- Acondicionamento em casa e no supermercado',
        '',
        'Se alguém perguntar algo fora do tema hortifrúti, gentilmente diga que',
        'seu foco é ajudar com frutas, verduras e legumes, e redirecione para o assunto.'
    ].join('\n');

    var STYLES = [
        '#bananeiro-bubble {',
        '  position: fixed; bottom: 80px; right: 16px; z-index: 9999;',
        '  width: 56px; height: 56px; border-radius: 50%;',
        '  background: #2e7d32; color: #fff; border: none;',
        '  box-shadow: 0 4px 16px rgba(46,125,50,0.4);',
        '  cursor: pointer; font-size: 24px; display: flex;',
        '  align-items: center; justify-content: center;',
        '  transition: transform 0.2s, box-shadow 0.2s;',
        '  -webkit-tap-highlight-color: transparent;',
        '}',
        '#bananeiro-bubble:hover { transform: scale(1.1); }',
        '#bananeiro-bubble:active { transform: scale(0.95); }',
        '@keyframes bananeiro-pulse {',
        '  0% { box-shadow: 0 4px 16px rgba(46,125,50,0.4); }',
        '  50% { box-shadow: 0 4px 24px rgba(46,125,50,0.7); }',
        '  100% { box-shadow: 0 4px 16px rgba(46,125,50,0.4); }',
        '}',
        '#bananeiro-bubble { animation: bananeiro-pulse 2s infinite; }',
        '#bananeiro-overlay {',
        '  position: fixed; inset: 0; z-index: 10000;',
        '  background: rgba(0,0,0,0.5);',
        '  display: none; align-items: center; justify-content: center;',
        '  animation: bananeiro-fadeIn 0.2s ease;',
        '}',
        '#bananeiro-overlay.open { display: flex; }',
        '@keyframes bananeiro-fadeIn {',
        '  from { opacity: 0; } to { opacity: 1; }',
        '}',
        '@keyframes bananeiro-slideUp {',
        '  from { transform: translateY(30px); opacity: 0; }',
        '  to { transform: translateY(0); opacity: 1; }',
        '}',
        '#bananeiro-modal {',
        '  background: #fff; border-radius: 16px;',
        '  width: 100%; height: 100%; max-height: 100vh;',
        '  display: flex; flex-direction: column;',
        '  animation: bananeiro-slideUp 0.25s ease;',
        '  overflow: hidden; position: relative;',
        '}',
        '@media (min-width: 600px) {',
        '  #bananeiro-modal {',
        '    width: 440px; height: 600px; max-height: 85vh;',
        '    border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);',
        '  }',
        '  #bananeiro-overlay { padding: 20px; }',
        '}',
        '#bananeiro-header {',
        '  background: #2e7d32; color: #fff; padding: 14px 16px;',
        '  display: flex; align-items: center; gap: 10px; flex-shrink: 0;',
        '}',
        '#bananeiro-header h2 {',
        '  margin: 0; font-size: 18px; font-weight: 600; flex: 1;',
        '  font-family: "Inter",sans-serif;',
        '}',
        '#bananeiro-header button {',
        '  background: none; border: none; color: #fff;',
        '  cursor: pointer; font-size: 20px; padding: 4px 8px;',
        '  border-radius: 8px; transition: background 0.2s;',
        '  line-height: 1;',
        '}',
        '#bananeiro-header button:hover { background: rgba(255,255,255,0.15); }',
        '#bananeiro-chat {',
        '  flex: 1; overflow-y: auto; padding: 16px;',
        '  display: flex; flex-direction: column; gap: 10px;',
        '  background: #f5f7fa;',
        '}',
        '#bananeiro-chat .msg {',
        '  max-width: 85%; padding: 10px 14px; border-radius: 14px;',
        '  font-size: 14px; line-height: 1.5; word-wrap: break-word;',
        '  font-family: "Inter",sans-serif;',
        '  animation: bananeiro-fadeIn 0.25s ease;',
        '}',
        '#bananeiro-chat .msg.user {',
        '  align-self: flex-end; background: #2e7d32; color: #fff;',
        '  border-bottom-right-radius: 4px;',
        '}',
        '#bananeiro-chat .msg.assistant {',
        '  align-self: flex-start; background: #fff; color: #1a1a2e;',
        '  border-bottom-left-radius: 4px;',
        '  box-shadow: 0 1px 4px rgba(0,0,0,0.06);',
        '}',
        '#bananeiro-chat .msg.system {',
        '  align-self: center; background: #e8f5e9; color: #2e7d32;',
        '  font-size: 13px; text-align: center; max-width: 90%;',
        '}',
        '#bananeiro-chat .typing {',
        '  align-self: flex-start; background: #e0e0e0; color: #666;',
        '  padding: 10px 18px; border-radius: 14px; font-size: 14px;',
        '  border-bottom-left-radius: 4px;',
        '}',
        '#bananeiro-chat .typing::after {',
        '  content: "..."; animation: bananeiro-dots 1.2s steps(4) infinite;',
        '}',
        '@keyframes bananeiro-dots {',
        '  0% { content: "."; } 33% { content: ".."; } 66% { content: "..."; }',
        '}',
        '#bananeiro-footer {',
        '  display: flex; align-items: center; gap: 8px;',
        '  padding: 10px 12px; border-top: 1px solid #e8e8e8;',
        '  background: #fff; flex-shrink: 0;',
        '}',
        '#bananeiro-footer input {',
        '  flex: 1; border: 1px solid #ddd; border-radius: 24px;',
        '  padding: 10px 16px; font-size: 14px; outline: none;',
        '  font-family: "Inter",sans-serif;',
        '  transition: border-color 0.2s;',
        '}',
        '#bananeiro-footer input:focus { border-color: #2e7d32; }',
        '#bananeiro-footer button {',
        '  width: 40px; height: 40px; border-radius: 50%; border: none;',
        '  cursor: pointer; font-size: 18px; display: flex;',
        '  align-items: center; justify-content: center; flex-shrink: 0;',
        '  transition: background 0.2s, transform 0.15s;',
        '  -webkit-tap-highlight-color: transparent;',
        '}',
        '#bananeiro-footer button:active { transform: scale(0.9); }',
        '#bananeiro-mic-btn { background: #e8f5e9; color: #2e7d32; }',
        '#bananeiro-mic-btn:hover { background: #c8e6c9; }',
        '#bananeiro-mic-btn.listening {',
        '  background: #ef5350; color: #fff;',
        '  animation: bananeiro-micPulse 1s infinite;',
        '}',
        '@keyframes bananeiro-micPulse {',
        '  0%,100% { box-shadow: 0 0 0 0 rgba(239,83,80,0.4); }',
        '  50% { box-shadow: 0 0 0 8px rgba(239,83,80,0); }',
        '}',
        '#bananeiro-send-btn { background: #2e7d32; color: #fff; }',
        '#bananeiro-send-btn:hover { background: #1b5e20; }',
        '#bananeiro-send-btn:disabled { background: #ccc; cursor: not-allowed; }',
        '#bananeiro-config {',
        '  display: flex; flex-direction: column; align-items: center;',
        '  justify-content: center; padding: 32px 24px; flex: 1;',
        '  text-align: center; gap: 16px; background: #f5f7fa;',
        '}',
        '#bananeiro-config h3 {',
        '  margin: 0; font-size: 20px; color: #1a1a2e;',
        '  font-family: "Inter",sans-serif;',
        '}',
        '#bananeiro-config p {',
        '  color: #666; font-size: 14px; margin: 0; max-width: 320px;',
        '  font-family: "Inter",sans-serif;',
        '}',
        '#bananeiro-config input {',
        '  width: 100%; max-width: 360px; padding: 12px 16px;',
        '  border: 2px solid #ddd; border-radius: 12px;',
        '  font-size: 14px; text-align: center; outline: none;',
        '  font-family: monospace; transition: border-color 0.2s;',
        '}',
        '#bananeiro-config input:focus { border-color: #2e7d32; }',
        '#bananeiro-config .save-btn {',
        '  background: #2e7d32; color: #fff; border: none;',
        '  padding: 12px 32px; border-radius: 24px; font-size: 15px;',
        '  font-weight: 600; cursor: pointer;',
        '  font-family: "Inter",sans-serif;',
        '  transition: background 0.2s;',
        '}',
        '#bananeiro-config .save-btn:hover { background: #1b5e20; }',
        '#bananeiro-config .error { color: #ef5350; font-size: 13px; }',
        '#bananeiro-error-bar {',
        '  background: #ffebee; color: #c62828; padding: 10px 16px;',
        '  font-size: 13px; display: none; flex-shrink: 0;',
        '  font-family: "Inter",sans-serif;',
        '}',
        '@media (max-width: 599px) {',
        '  #bananeiro-overlay { align-items: flex-end; }',
        '  #bananeiro-modal {',
        '    border-radius: 20px 20px 0 0; max-height: 92vh;',
        '    animation: bananeiro-slideUp 0.3s ease;',
        '  }',
        '}'
    ].join('\n');

    function injectStyles() {
        var style = document.createElement('style');
        style.textContent = STYLES;
        document.head.appendChild(style);
    }

    function createElements() {
        els.bubble = document.createElement('button');
        els.bubble.id = 'bananeiro-bubble';
        els.bubble.setAttribute('aria-label', 'Abrir Bananeiro');
        els.bubble.textContent = '\uD83C\uDF4C';
        document.body.appendChild(els.bubble);

        els.overlay = document.createElement('div');
        els.overlay.id = 'bananeiro-overlay';

        els.modal = document.createElement('div');
        els.modal.id = 'bananeiro-modal';

        els.header = document.createElement('div');
        els.header.id = 'bananeiro-header';
        els.header.innerHTML =
            '<span>\uD83C\uDF4C</span><h2>Bananeiro</h2>' +
            '<button id="bananeiro-mute-btn" title="Alternar voz">\uD83D\uDD0A</button>' +
            '<button id="bananeiro-close-btn" title="Fechar">\u2716</button>';
        els.modal.appendChild(els.header);

        els.chat = document.createElement('div');
        els.chat.id = 'bananeiro-chat';
        els.modal.appendChild(els.chat);

        els.errorBar = document.createElement('div');
        els.errorBar.id = 'bananeiro-error-bar';
        els.modal.appendChild(els.errorBar);

        els.footer = document.createElement('div');
        els.footer.id = 'bananeiro-footer';
        els.footer.innerHTML =
            '<input id="bananeiro-input" type="text" placeholder="Digite sua d\u00FAvida..." autocomplete="off">' +
            '<button id="bananeiro-mic-btn" title="Falar">\uD83C\uDF99\uFE0F</button>' +
            '<button id="bananeiro-send-btn" title="Enviar">\u27A4</button>';
        els.modal.appendChild(els.footer);

        els.config = document.createElement('div');
        els.config.id = 'bananeiro-config';
        els.config.style.display = 'none';
        els.config.innerHTML =
            '<h3>\uD83C\uDF4C Bananeiro</h3>' +
            '<p>Bem-vindo! Para come\u00E7ar, insira sua chave da API Groq.</p>' +
            '<input id="bananeiro-api-input" type="password" placeholder="gsk_...">' +
            '<button class="save-btn" id="bananeiro-save-key">Salvar e come\u00E7ar</button>' +
            '<p class="error" id="bananeiro-api-error"></p>';
        els.modal.appendChild(els.config);

        els.overlay.appendChild(els.modal);
        document.body.appendChild(els.overlay);

        els.bubbleRef = document.getElementById('bananeiro-bubble');
        els.overlayRef = document.getElementById('bananeiro-overlay');
        els.input = document.getElementById('bananeiro-input');
        els.sendBtn = document.getElementById('bananeiro-send-btn');
        els.micBtn = document.getElementById('bananeiro-mic-btn');
        els.closeBtn = document.getElementById('bananeiro-close-btn');
        els.muteBtn = document.getElementById('bananeiro-mute-btn');
        els.apiInput = document.getElementById('bananeiro-api-input');
        els.saveKeyBtn = document.getElementById('bananeiro-save-key');
        els.apiError = document.getElementById('bananeiro-api-error');
    }

    function hasApiKey() {
        return !!localStorage.getItem(API_KEY_STORAGE);
    }

    function getApiKey() {
        var key = localStorage.getItem(API_KEY_STORAGE);
        return key || DEFAULT_KEY;
    }

    function setApiKey(key) {
        localStorage.setItem(API_KEY_STORAGE, key);
    }

    function showConfig() {
        els.chat.style.display = 'none';
        els.footer.style.display = 'none';
        els.errorBar.style.display = 'none';
        els.config.style.display = 'flex';
        els.apiInput.value = '';
        els.apiError.textContent = '';
        els.apiInput.focus();
    }

    function showChat() {
        els.config.style.display = 'none';
        els.chat.style.display = 'flex';
        els.footer.style.display = 'flex';
        els.errorBar.style.display = 'none';
    }

    function addMessage(role, content) {
        state.messages.push({ role: role, content: content });
        var div = document.createElement('div');
        div.className = 'msg ' + role;
        div.textContent = content;
        els.chat.appendChild(div);
        els.chat.scrollTop = els.chat.scrollHeight;
    }

    function addTyping() {
        var div = document.createElement('div');
        div.className = 'typing';
        div.id = 'bananeiro-typing';
        div.textContent = 'Bananeiro est\u00E1 pensando';
        els.chat.appendChild(div);
        els.chat.scrollTop = els.chat.scrollHeight;
    }

    function removeTyping() {
        var el = document.getElementById('bananeiro-typing');
        if (el) el.remove();
    }

    function showError(msg) {
        els.errorBar.textContent = msg;
        els.errorBar.style.display = 'block';
        setTimeout(function () {
            els.errorBar.style.display = 'none';
        }, 5000);
    }

    function stopSpeaking() {
        if (state.synth && state.synth.speaking) {
            state.synth.cancel();
        }
    }

    function speak(text) {
        if (state.isMuted) return;
        stopSpeaking();
        if (!state.synth) return;
        var clean = text.replace(/\*[^*]*\*/g, '').replace(/https?:\/\/\S+/g, '');
        if (clean.length < 5) return;
        var u = new SpeechSynthesisUtterance(clean);
        u.lang = 'pt-BR';
        u.rate = 1.0;
        u.pitch = 1.0;
        state.utterance = u;
        state.synth.speak(u);
    }

    function sendMessage(text) {
        if (!text || !text.trim()) return;
        var msg = text.trim();
        els.input.value = '';
        els.sendBtn.disabled = true;

        addMessage('user', msg);
        addTyping();

        var apiKey = getApiKey();
        if (!apiKey) {
            removeTyping();
            showError('Configure a chave da API Groq primeiro.');
            showConfig();
            return;
        }

        var body = {
            model: MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: msg }
            ],
            temperature: 0.7,
            max_tokens: 1024
        };

        fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })
        .then(function (r) {
            if (!r.ok) {
                return r.json().then(function (d) {
                    throw new Error(d.error && d.error.message ? d.error.message : 'Erro HTTP ' + r.status);
                });
            }
            return r.json();
        })
        .then(function (data) {
            removeTyping();
            var reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            if (!reply) {
                reply = 'Desculpe, n\u00E3o consegui gerar uma resposta. Tente novamente.';
            }
            addMessage('assistant', reply);
            speak(reply);
            els.sendBtn.disabled = false;
        })
        .catch(function (err) {
            removeTyping();
            var errMsg = err.message || 'Erro ao conectar com a API. Verifique sua chave.';
            showError(errMsg);
            addMessage('system', '\u26A0\uFE0F ' + errMsg);
            els.sendBtn.disabled = false;
        });
    }

    function startListening() {
        var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showError('Reconhecimento de voz n\u00E3o suportado neste navegador.');
            return;
        }

        if (state.isListening) {
            state.recognition.stop();
            return;
        }

        var rec = new SpeechRecognition();
        rec.lang = 'pt-BR';
        rec.continuous = false;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        rec.onresult = function (e) {
            var transcript = '';
            for (var i = e.resultIndex; i < e.results.length; i++) {
                transcript += e.results[i][0].transcript;
            }
            els.input.value = transcript;
        };

        rec.onend = function () {
            state.isListening = false;
            els.micBtn.classList.remove('listening');
            els.micBtn.textContent = '\uD83C\uDF99\uFE0F';
            var val = els.input.value.trim();
            if (val) {
                sendMessage(val);
            }
        };

        rec.onerror = function (e) {
            state.isListening = false;
            els.micBtn.classList.remove('listening');
            els.micBtn.textContent = '\uD83C\uDF99\uFE0F';
            if (e.error !== 'no-speech' && e.error !== 'aborted') {
                showError('Erro no microfone: ' + e.error);
            }
        };

        state.recognition = rec;
        state.isListening = true;
        els.micBtn.classList.add('listening');
        els.micBtn.textContent = '\uD83D\uDD34';
        els.input.value = '';
        rec.start();
    }

    function openModal() {
        state.isOpen = true;
        els.overlay.classList.add('open');
        document.body.style.overflow = 'hidden';

        if (!hasApiKey()) {
            showConfig();
            els.apiInput.value = DEFAULT_KEY;
        } else {
            showChat();
            if (state.messages.length === 0) {
                addMessage('system', '\uD83C\uDF4C Ol\u00E1! Sou o Bananeiro, especialista em hortifr\u00FAti. Pergunte o que precisar!');
            }
            els.input.focus();
        }
    }

    function closeModal() {
        state.isOpen = false;
        els.overlay.classList.remove('open');
        document.body.style.overflow = '';

        if (state.isListening && state.recognition) {
            state.recognition.stop();
        }
        stopSpeaking();
        state.messages = [];
        els.chat.innerHTML = '';
    }

    function attachEvents() {
        els.bubble.addEventListener('click', openModal);

        els.closeBtn.addEventListener('click', closeModal);

        els.overlay.addEventListener('click', function (e) {
            if (e.target === els.overlay) closeModal();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && state.isOpen) closeModal();
        });

        els.sendBtn.addEventListener('click', function () {
            sendMessage(els.input.value);
        });

        els.input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage(els.input.value);
            }
        });

        els.micBtn.addEventListener('click', startListening);

        els.muteBtn.addEventListener('click', function () {
            state.isMuted = !state.isMuted;
            els.muteBtn.textContent = state.isMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
            if (state.isMuted) stopSpeaking();
        });

        els.saveKeyBtn.addEventListener('click', function () {
            var key = els.apiInput.value.trim();
            if (!key) {
                els.apiError.textContent = 'Insira a chave da API.';
                return;
            }
            if (!key.startsWith('gsk_')) {
                els.apiError.textContent = 'Chave inv\u00E1lida. Deve come\u00E7ar com gsk_';
                return;
            }
            els.apiError.textContent = '';
            setApiKey(key);
            state.messages = [];
            els.chat.innerHTML = '';
            showChat();
            addMessage('system', '\uD83C\uDF4C Ol\u00E1! Sou o Bananeiro, especialista em hortifr\u00FAti. Pergunte o que precisar!');
            els.input.focus();
        });

        els.apiInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') els.saveKeyBtn.click();
        });
    }

    function init() {
        if (!localStorage.getItem(API_KEY_STORAGE)) {
            setApiKey(DEFAULT_KEY);
        }
        injectStyles();
        createElements();
        attachEvents();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
