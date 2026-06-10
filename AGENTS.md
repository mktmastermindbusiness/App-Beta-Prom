# scanner-documento.html — Session Summary

## Goal
Criar e iterar página scanner-documento.html para digitalizar documentos (Nota de Falta/Devolução) com câmera via `getUserMedia`, ajuste manual de cantos, correção de perspectiva, filtros e PDF via WhatsApp

## Constraints & Preferences
- Solução 100% gratuita e permanente (Scanbot Web SDK e Google Cloud Document AI são pagos — inviáveis)
- Câmera via `getUserMedia` (resolução máxima, sem page reload do iOS) baseada em `camera.html` que já funciona
- OpenCV.js mantido para correção de perspectiva + filtros CLAHE, mas **detecção automática removida** (era frágil)
- Fallback sem OpenCV: filtros via Canvas puro (grayscale/threshold/contraste), correção de perspectiva desabilitada com aviso
- Interface mobile-first com alças de canto grandes (20px raio, 40px alvo)
- Cantos sempre visíveis imediatamente ao carregar foto (sem tentar detectar bordas automaticamente)
- PDF gerado no cliente com metadados (rede, loja, promotor, data, tipo) + imagem
- Navegador com `navigator.share` para WhatsApp nativo, fallback para download

## Progress
### Done
- Criado `scanner-documento.html` com dropdowns Rede/Loja/Tipo, câmera, detecção OpenCV.js, filtros, ajuste de cantos, PDF e WhatsApp
- Substituído OCR (Tesseract.js) por único botão "Compartilhar PDF"
- Adicionado enquadramento automático + correção de perspectiva + CLAHE via OpenCV.js, depois ajuste manual de cantos
- Substituído OpenCV.js por Dynamsoft (trial) e depois revertido para OpenCV.js gratuito após constatar Scanbot pago
- Corrigido page reload no iOS: unificado input file com toggle `capture`
- Corrigido cantos fora da área: corner-cv posicionado via `getBoundingClientRect()` do canvas de resultado
- Adicionados 3 filtros: Colorido, Realçado (CLAHE), Documento (CLAHE + adaptiveThreshold)
- Registrado scanner em `notifications.js` como habilitado
- Adicionado link Scanner nos menus de todas as 7 páginas
- **Removida detecção automática de bordas** (`detectarDocumento()` — Canny + findContours), substituída por cantos manuais imediatos
- Substituído botão "Ajustar Cantos" (toggle) por **"Corrigir"** (ação única: perspectiva + filtro)
- Aumentado alças de canto: raio 12px→20px, alvo de toque 24px→40px
- Adicionado **fallback Canvas puro** para filtros quando OpenCV não disponível
- Adicionado **sistema de toast** para feedback (sucesso/erro)
- Adicionado **overlay de câmera `getUserMedia`** (fullscreen, `<video>` ao vivo, shutter, zoom 1920x1080) baseado em `camera.html` — resolve page reload do iOS
- Alterado `object-fit` do vídeo para `cover` (tela cheia sem barras pretas)
- Adicionada variável `originalRawData` preservada no carregamento da imagem
- Filtro **"Colorido" agora restaura o original** (não passa mais por grayscale do OpenCV)
- Adicionado **5% de padding** na correção de perspectiva para não cortar bordas do documento
- Adicionado **botão "Original"** que restaura a foto original, reseta filtro e cantos
- **PDF profissional com jsPDF direto**: substituído html2pdf.js (que dependia de html2canvas) por jsPDF puro — imagem + metadados com coordenadas exatas, logo, header, divider, tabela de metadados, imagem centralizada, footer
- **Banner de boas-vindas do promotor**: exibe "Bem-vindo, [Nome]!" ao selecionar Rede+Loja (igual `camera.html`)
- **Qualidade máxima da imagem**: constraints de câmera alterados para `{ ideal: 3840, ideal: 2160 }`, `toDataURL('image/jpeg', 1.0)` e `toBlob('image/jpeg', 1.0)`
- **Aumentar stage** de `max-width: 600px` para `960px`
- **Interface de busca multifontes**: `busca.html` agora tem 5 abas (Lojas, Expedido, LOG CXS, Saldo, Balanço) com filtros e exibição dedicados
- **Novas funções backend em `Code.gs`**: `buscarExpedidoAvancado()`, `buscarLogCxsAvancado()`, `buscarSaldoLojas()`, `buscarBalancoAvancado()`, `gerarPDFBuscaGenerico()`
- **`obterConfiguracoes()`** agora retorna `ABAS_ESPECIAIS` com existência das abas na planilha

### In Progress
- Feriados cadastrados não aparecem na tabela do Gestor nem no Colaborador após reimplantação
- Colaborador exibe "Erro ao carregar: resposta vazia do servidor" ao selecionar rede+loja
- Schema `alcance` aplicado em todos os 3 arquivos — precisa reimplantar e recadastrar feriados

### Blocked
- (none)

## Key Decisions
- `getUserMedia` preferido ao `<input capture>` após constatar que o input causa page reload no iOS — `camera.html` prova que funciona
- OpenCV.js mantido, mas **detecção automática removida** por ser frágil (Canny + findContours falha com iluminação, fundo, tipo de documento)
- Cantos manuais são a interação primária — aparecem imediatamente ao carregar a foto, posição inicial 12% de margem
- "Corrigir" aplica perspectiva + filtro em um clique; "Ajustar" reexibe cantos; "Original" restaura foto original
- Scanbot Web SDK e Google Cloud Document AI ambos rejeitados por serem pagos
- html2pdf.js substituído por jsPDF puro — mais leve, mais controle visual, sem dependência de html2canvas

## Next Steps
- Testar em dispositivo real: captura → ajuste cantos → corrigir → PDF → WhatsApp
- Verificar se `navigator.share` com `.pdf` funciona no iOS/Android (fallback para download)

## Critical Context
- `scanner-documento.html` carrega OpenCV.js assíncrono do CDN (`https://docs.opencv.org/4.9.0/opencv.js`) — se não carregar, usa fallback Canvas puro
- Corner overlay (`corner-cv`) é posicionado dinamicamente sobre `resC.getBoundingClientRect()` — essencial para coordenadas corretas
- Escala nos cantos: `sx = rawImageWidth / corC.width`, `sy = rawImageHeight / corC.height`
- `originalRawData` é clonado no `onload` da imagem para permitir restaurar o original
- Pdf gerado com jsPDF puro (`jspdf.umd.min.js` CDN) — sem servidor, sem html2canvas
- Compartilhamento via `navigator.share` com fallback para download

## Bug Fixes — Promotores (24/05/2026)
### Problema
Envio de promotores retornava "✅ Sucesso!" mas dados não chegavam na planilha de inventários.

### Causa Raiz (C1)
`processar()` em `Inventários/Code.gs:453-549` usava `.forEach()` com `return;` silencioso — quando a aba do estado ou `DADOS_BRUTOS` não existia, ou a linha alvo não era encontrada, o `return` apenas passava para a próxima iteração sem escrever nada. A função incondicionalmente retornava `"Sucesso"` ao final.

### Causa Raiz (C2)
`String === String` sem `.trim()` causava falha de matching se o payload tivesse espaços extras comparado à planilha.

### Correções Aplicadas
- `processar()`: adicionado contador `abasEscritas` + array `erros[]`. Só retorna `"Sucesso"` se ao menos 1 aba foi escrita. Se 0 abas, lança `Error` com detalhes.
- `processar()`: `String(row[X]).trim()` em todas as comparações (estado, rede, loja, nome, tipo)
- `processar()`: `"dd/mm/yyyy"` → `"dd/MM/yyyy"` (maiúsculo MM = meses)
- `processar()`: logs adicionados para colunas não encontradas, abas não encontradas, linhas escritas
- `_atualizarSaldoLojasAposBalanco`: log de erro inclui loja/rede
- `verificarPreenchimentoDiario`, `carregarDadosPreenchidos`: catch logs incluem contexto
- `gravarAcompanhamentosOtimizado`: log quando aba encontrada por `includes()` parcial

## Relevant Files
- `C:\Users\Inha Gomes\Desktop\QD\AppQD-maink\scanner-documento.html`: Página completa do scanner – câmera getUserMedia, ajuste manual de cantos, OpenCV.js, filtros, PDF e WhatsApp
- `C:\Users\Inha Gomes\Desktop\QD\AppQD-maink\notifications.js`: Configuração de páginas – scanner registrado como habilitado
- `C:\Users\Inha Gomes\Desktop\QD\AppQD-maink\camera.html`: Referência para overlay de câmera fullscreen (getUserMedia + shutter)
- `C:\Users\Inha Gomes\Desktop\QD\AppQD-maink\camera.js`: Lógica de câmera (getUserMedia, captura, welcome banner) — usada como base
- `C:\Users\Inha Gomes\Desktop\QD\AppQD-maink\style.css`: Estilos compartilhados – não alterado
- `Inventários/Code.gs`: Backend com correções críticas no `processar()`

---

# Feriados Trabalhados — Session Summary (05/06/2026)

## Goal
Aplicativo completo para colaboradores escolherem/se recusarem a trabalhar em feriados, com gestão de municípios, vínculos promotor-município, cadastro de feriados (Nação/Estado/Município) via coluna única "Alcance", aprovações e relatórios PDF.

## Mudanças nesta sessão (05/06/2026 - parte 2)
### Schema alcance aplicado em todos os arquivos
- **`Feriados-Gestor.html:salvarFeriado()`**: Monta `alcance` a partir de esfera+estado+município (ex: `*`, `SP`, `Campinas/SP`)
- **`Feriados-Gestor.html:renderizarTabelaFeriados()`**: Coluna "Alcance" (🌍 Nação / 🗺️ UF / 🏙️ Cidade/UF) no lugar de "Esfera" + "Estado/Município"
- **`Feriados-Gestor.html:editarFeriado()`**: Parseia `alcance` de volta para esfera/estado/município no formulário
- **`Feriados-Colaborador.html`**: Badges e filtros usam `f.alcance` em vez de `f.esfera`/`f.estado`/`f.municipio`
- **`Code.gs`**: Já retornava/salvava `alcance` corretamente — nenhuma alteração necessária

## Próximos passos
1. **Reimplantar** o projeto Apps Script com todas as alterações
2. **Rodar `inicializarPlanilha()`** uma vez no editor para recriar aba FERIADOS com header `[ID, Alcance, Nome, Data, Recorrente, Descricao, Trabalhavel]`
3. **Cadastrar feriados novamente** — schema mudou de 9 colunas para 7, dados antigos não são compatíveis
4. **Testar fluxo completo**: Gestor cadastra feriado → Colaborador vê nas seções mensais → decide Sim/Não → Gestor aprova

## Key Decisions
- `fmtData()` como função global (não dentro de `obterFeriados()`) para garantir hoisting no V8
- `data` convertido para string na leitura (`fmtData(row[3])`) para eliminar Date na serialização
- Alcance unificado: `*`=Nação, `UF`=Estado, `Cidade/UF`=Município
- Salvamento em lote no DnD: pendências acumuladas em `pendingVinculos[]`, botão "Salvar Vínculos" único
- "Recusou" como status separado de "Recusado" (colaborador recusa vs gestor recusa)
- Feriado não trabalhavel usa 🔒 + opacidade reduzida — não some, só informa

## Relevant Files
- `Feriados/Code.gs`: Backend — CRUD feriados, municípios, vínculos, solicitações, recusa, relatórios
- `Feriados/Feriados-Gestor.html`: Gestor — 5 abas (Esferas, Feriados com checkbox trabalhavel + coluna Alcance, Promotores DnD em lote, Aprovações com badge Recusou, Relatórios)
- `Feriados/Feriados-Colaborador.html`: Colaborador — seções mensais, badge via alcance, modal 2 etapas, feriado bloqueado
- `feriados.html`: Container com iframe e toggle Colaborador/Gestor
- `notifications.js`: Registro da página
