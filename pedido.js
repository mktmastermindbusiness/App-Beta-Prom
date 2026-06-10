document.addEventListener('DOMContentLoaded', () => {
    const selectRede = document.getElementById('rede');
    const selectLoja = document.getElementById('loja');

    const productGrid = document.getElementById('product-grid');
    const addProductTrigger = document.getElementById('add-product-trigger');
    const shareWhatsappBtn = document.getElementById('share-whatsapp');
    const sharePdfBtn = document.getElementById('share-pdf');

    const pdfFeatureEnabled = NOTIFICATIONS_CONFIG.pages.pedido.features?.pdf_share;
    if (sharePdfBtn) {
        if (!pdfFeatureEnabled) {
            sharePdfBtn.disabled = true;
            sharePdfBtn.style.opacity = '0.5';
            sharePdfBtn.style.cursor = 'not-allowed';
            sharePdfBtn.title = "Funcionalidade em desenvolvimento";
        } else {
            sharePdfBtn.disabled = false;
            sharePdfBtn.style.opacity = '1';
            sharePdfBtn.style.cursor = 'pointer';
        }
    }

    const productModal = document.getElementById('product-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalNameInput = document.getElementById('modal-product-name');
    const modalQtyInput = document.getElementById('modal-product-qty');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const btnModalConfirm = document.getElementById('btn-modal-confirm');

    const welcomeBanner = document.getElementById('welcome-message');
    const welcomeText = document.getElementById('welcome-text');

    let products = [];
    let editingIndex = -1;
    let currentPromotor = null;

    function showWelcomeMessage(promotorNome) {
        var fullName = window.QD.getPromotorFullName(promotorNome);
        welcomeText.textContent = 'Bem-vindo, ' + fullName + '!';
        welcomeBanner.style.display = 'flex';
    }

    function hideWelcomeMessage() {
        welcomeBanner.style.display = 'none';
    }

    var estrutura = window.QD.getEstruturaFromCache();
    var selecao = window.QD.getSelecao();

    if (selecao.rede && estrutura) {
        window.QD.carregarRedes(selectRede, estrutura);
        selectRede.value = selecao.rede;
        window.QD.carregarLojas(selecao.rede, selectLoja, estrutura);
        if (selecao.loja) {
            selectLoja.value = selecao.loja;
            currentPromotor = selecao.promotor || null;
            if (currentPromotor) showWelcomeMessage(currentPromotor);
        }
        window.QD.travarDropdowns(selectRede, selectLoja);
    } else {
        window.QD.carregarRedes(selectRede, estrutura);
    }

    selectRede.addEventListener('change', function() {
        var estrutura = window.QD.getEstruturaFromCache();
        window.QD.carregarLojas(selectRede.value, selectLoja, estrutura);
        hideWelcomeMessage();
        currentPromotor = null;
    });

    selectLoja.addEventListener('change', function() {
        var estrutura = window.QD.getEstruturaFromCache();
        var promotor = window.QD.findPromotorPorLoja(estrutura, selectRede.value, selectLoja.value);
        currentPromotor = promotor;
        if (promotor) {
            showWelcomeMessage(promotor);
        }
    });

    function renderProducts() {
        productGrid.innerHTML = '';
        products.forEach((p, index) => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="card-header">
                    <span class="product-title">${p.name}</span>
                    <div class="product-actions">
                        <button class="btn-icon btn-edit" data-index="${index}"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon btn-delete" data-index="${index}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="card-body">
                    <span class="qty-display">${p.qty}</span>
                    <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">unid/kg</span>
                </div>
            `;
            productGrid.appendChild(card);
        });

        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.onclick = (e) => {
                editingIndex = parseInt(btn.dataset.index);
                const p = products[editingIndex];
                modalTitle.innerText = 'Editar Produto';
                modalNameInput.value = p.name;
                modalQtyInput.value = p.qty;
                productModal.classList.add('active');
            };
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = (e) => {
                if (confirm('Deseja remover este produto?')) {
                    products.splice(parseInt(btn.dataset.index), 1);
                    renderProducts();
                }
            };
        });
    }

    addProductTrigger.onclick = () => {
        editingIndex = -1;
        modalTitle.innerText = 'Adicionar Produto';
        modalNameInput.value = '';
        modalQtyInput.value = '';
        productModal.classList.add('active');
    };

    btnModalCancel.onclick = () => {
        productModal.classList.remove('active');
    };

    btnModalConfirm.onclick = () => {
        const name = modalNameInput.value.trim();
        const qty = modalQtyInput.value;

        if (!name || !qty || qty <= 0) {
            alert('Preencha o nome e a quantidade corretamente.');
            return;
        }

        if (editingIndex > -1) {
            products[editingIndex] = { name, qty };
        } else {
            products.push({ name, qty });
        }

        productModal.classList.remove('active');
        renderProducts();
    };

    function getOrderData() {
        const allProducts = [];

        document.querySelectorAll('.fixed-qty').forEach(input => {
            const qty = input.value;
            if (qty && qty > 0) {
                allProducts.push({
                    name: input.getAttribute('data-name'),
                    qty: qty
                });
            }
        });

        products.forEach(p => allProducts.push(p));

        return {
            rede: selectRede.value,
            promotor: currentPromotor || '',
            loja: selectLoja.value,
            products: allProducts,
            date: new Date().toLocaleDateString('pt-BR')
        };
    }

    shareWhatsappBtn.onclick = () => {
        const data = getOrderData();
        if (!data.loja || data.products.length === 0) {
            alert('Preencha os dados da loja e adicione ao menos um produto.');
            return;
        }

        let msg = `*SUGESTÃO DE PEDIDO - QDELÍCIA FRUTAS*\n`;
        msg += `---------------------------------------\n`;
        msg += `*Data:* ${data.date}\n`;
        msg += `*Loja:* ${data.loja} (${data.rede})\n`;
        msg += `*Promotor:* ${data.promotor}\n`;
        msg += `---------------------------------------\n\n`;

        let tableHeader = `PRODUTO             | QTD      `;
        let divider = `-------------------------------`;

        msg += "```" + tableHeader + "```\n";
        msg += "```" + divider + "```\n";

        data.products.forEach(p => {
            const paddedName = p.name.substring(0, 19).padEnd(19, ' ');
            const paddedQty = p.qty.toString().substring(0, 8).padEnd(8, ' ');
            msg += "```" + `${paddedName} | ${paddedQty}` + "```\n";
        });

        msg += `---------------------------------------`;

        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    };

    sharePdfBtn.onclick = async () => {
        const data = getOrderData();
        if (!data.loja || data.products.length === 0) {
            alert('Preencha os dados da loja e adicione ao menos um produto.');
            return;
        }

        const pdfEl = document.getElementById('pdf-content');
        document.getElementById('pdf-data').innerText = data.date;
        document.getElementById('pdf-rede').innerText = data.rede;
        document.getElementById('pdf-loja').innerText = data.loja;
        document.getElementById('pdf-promotor').innerText = data.promotor;

        const tableBody = document.getElementById('pdf-table-body');
        tableBody.innerHTML = '';
        data.products.forEach(p => {
            tableBody.innerHTML += `<tr><td>${p.name}</td><td>${p.qty}</td></tr>`;
        });

        pdfEl.style.display = 'block';

        const opt = {
            margin: 10,
            filename: `Sugestao_Pedido_${data.loja}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            const pdfBlob = await html2pdf().set(opt).from(pdfEl).output('blob');
            pdfEl.style.display = 'none';

            if (navigator.share) {
                const file = new File([pdfBlob], opt.filename, { type: 'application/pdf' });
                await navigator.share({
                    files: [file],
                    title: 'Sugestão de Pedido',
                    text: `Sugestão de Pedido - ${data.loja}`
                });
            } else {
                html2pdf().set(opt).from(pdfEl).save();
            }
        } catch (err) {
            console.error('Erro ao gerar/compartilhar PDF:', err);
            pdfEl.style.display = 'none';
        }
    };
});
