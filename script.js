(function () {
    // =================================================================
    // MÓDULO DE SCRIPTS GERAIS (Envolto em IIFE para isolar variáveis)
    // =================================================================
    // Defina a função logo no topo do arquivo
    window.recarregarPagina = function () {
        console.log("Botão clicado, recarregando..."); // Para você ver no F12 que funcionou

        // Tenta atualizar o iframe primeiro
        const iframe = document.querySelector('iframe');
        if (iframe) {
            const urlBase = iframe.src.split('?')[0];
            iframe.src = urlBase + "?t=" + new Date().getTime();
        }

        // Recarrega a página após 300ms
        setTimeout(() => {
            window.location.reload();
        }, 300);
    };

    // Função de Logout global
    window.logout = function () {
        if (confirm("Deseja realmente sair?")) {
            localStorage.removeItem('qd_user_session');
            window.location.href = 'index.html';
        }
    };

    // ... restante do código (atualizarRelogio, etc)
    // 1. Header Compact on Scroll (2 níveis)
    const header = document.getElementById('cabecalho-principal');
    if (header) {
        let lastScroll = 0;
        window.addEventListener('scroll', () => {
            const currentScroll = window.scrollY;
            
            // Nível 1: compact (36px)
            if (currentScroll > 50) {
                header.classList.add('compact');
            } else {
                header.classList.remove('compact');
                header.classList.remove('compact-max');
            }
            
            // Nível 2: ultra-compact (30px)
            if (currentScroll > 200) {
                header.classList.add('compact-max');
            } else {
                header.classList.remove('compact-max');
            }
            
            lastScroll = currentScroll;
        });
    }

    // 2. Lógica do Botão Voltar ao Topo
    const backToTop = document.querySelector('.back-to-top');

    if (backToTop) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backToTop.classList.add('show');
            } else {
                backToTop.classList.remove('show');
            }
        });

        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

})(); // FIM DA IIFE
