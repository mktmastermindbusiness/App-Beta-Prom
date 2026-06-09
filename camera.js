const PHOTO_TYPES = {
    "Bancadas": "Bancadas",
    "Ponto Extra": "Ponto Extra",
    "Caixas Secas": "Caixas Secas",
    "Qualidade de Produto": "Qualidade de Produto",
    "Ação de Degustação": "Ação de Degustação",
    "Avarias": "Avarias",
};

const selectTipoFoto = document.getElementById('select-tipo-foto');
const welcomeBanner = document.getElementById('welcome-message');
const welcomeText = document.getElementById('welcome-text');

let currentStream = null;
let usingFrontCamera = false;
let photos = [];
let hasCameraPermission = false;

const localStorageKey = 'qdelicia_last_selection_v3';
const PHOTOS_STORAGE_KEY = 'qdelicia_camera_photos_v1';

function savePhotosToStorage() {
    try {
        localStorage.setItem(PHOTOS_STORAGE_KEY, JSON.stringify(photos));
    } catch (e) {
        console.error("Erro ao salvar fotos no storage:", e);
    }
}

function loadPhotosFromStorage() {
    try {
        const saved = localStorage.getItem(PHOTOS_STORAGE_KEY);
        if (saved) {
            photos = JSON.parse(saved);
        }
    } catch (e) {
        console.error("Erro ao carregar fotos do storage:", e);
    }
}

let currentZoom = 1;
let maxZoom = 1;
let deviceOrientation = 0;
let manualRotation = 0;
const MAX_PHOTOS = 5;

const logoImage = new Image();
logoImage.src = './images/logo-qdelicia.png';
logoImage.onerror = () => console.error("Erro ao carregar a imagem da logomarca.");

function getCurrentRede() {
    var sel = GlobalState.getSelection();
    return sel ? sel.rede : '';
}

function getCurrentLoja() {
    var sel = GlobalState.getSelection();
    return sel ? sel.loja : '';
}

function getCurrentPromotor() {
    var sel = GlobalState.getSelection();
    return sel ? sel.promotor : '';
}

function getPromotorFullName(promotorNome) {
    if (window.APP_CONFIG && window.APP_CONFIG.users) {
        for (const key in window.APP_CONFIG.users) {
            if (window.APP_CONFIG.users[key].fullName === promotorNome || key === promotorNome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) {
                return window.APP_CONFIG.users[key].fullName;
            }
        }
    }
    return promotorNome;
}

function showWelcomeMessage(promotorNome) {
    const fullName = getPromotorFullName(promotorNome);
    welcomeText.textContent = `Bem-vindo, ${fullName}!`;
    welcomeBanner.style.display = 'flex';
}

function hideWelcomeMessage() {
    welcomeBanner.style.display = 'none';
}

function saveSelection() {
    checkCameraAccess();
}

function populateTipoFoto() {
    selectTipoFoto.innerHTML = '<option value="" disabled selected>Selecione o Tipo</option>';
    Object.keys(PHOTO_TYPES).forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = PHOTO_TYPES[value];
        selectTipoFoto.appendChild(option);
    });
}

function initPage() {
    var sel = GlobalState.getSelection();
    if (sel && sel.rede && sel.loja) {
        if (sel.promotor) showWelcomeMessage(sel.promotor);
    }
    populateTipoFoto();
    checkCameraAccess();
    updateActionHighlight();
}

function checkCameraAccess() {
    const isReady = selectTipoFoto.value && getCurrentRede() && getCurrentLoja();
    const openCameraBtn = document.getElementById('open-camera-btn');
    if (isReady) {
        openCameraBtn.disabled = false;
        openCameraBtn.innerHTML = '<i class="fas fa-camera"></i> Abrir Câmera';
    } else {
        openCameraBtn.disabled = true;
        openCameraBtn.innerHTML = '<i class="fas fa-lock"></i> Selecione o Tipo de Foto';
    }
}

function checkPhotoLimit() {
    const cameraWrapper = document.querySelector('.camera-wrapper');
    const cameraShareBtn = document.getElementById('camera-share-btn');

    if (cameraShareBtn) {
        cameraShareBtn.style.display = photos.length > 0 ? 'flex' : 'none';
        cameraShareBtn.onclick = sharePhotos;
    }

    if (cameraWrapper) {
        if (photos.length >= MAX_PHOTOS) {
            cameraWrapper.classList.add('limit-reached');
        } else {
            cameraWrapper.classList.remove('limit-reached');
        }
    }
}

if (selectTipoFoto) {
    selectTipoFoto.addEventListener('change', () => {
        saveSelection();
        updateActionHighlight();
    });
}

function updateActionHighlight() {
    if (!selectTipoFoto) return;
    if (selectTipoFoto.closest('.input-group')) {
        selectTipoFoto.closest('.input-group').classList.remove('highlight-next-step');
    }
    if (!selectTipoFoto.value) {
        if (selectTipoFoto.closest('.input-group')) {
            selectTipoFoto.closest('.input-group').classList.add('highlight-next-step');
        }
    }
}

const openCameraBtn = document.getElementById('open-camera-btn');
const fullscreenCameraContainer = document.getElementById('fullscreen-camera-container');
const backToGalleryBtn = document.getElementById('back-to-gallery-btn');
const video = document.getElementById('video');
const shutterBtn = document.getElementById('shutter-btn');
const switchBtn = document.getElementById('switch-btn');
const photoList = document.getElementById('photo-list');
const downloadAllBtn = document.getElementById('download-all');
const shareAllBtn = document.getElementById('share-all');
const photoCountElement = document.getElementById('photo-count');
const orientationArrow = document.getElementById('orientation-arrow');
const portraitGuide = document.getElementById('portrait-guide');
const landscapeGuide = document.getElementById('landscape-guide');

async function requestCameraPermission() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    try {
        const constraints = {
            video: {
                facingMode: usingFrontCamera ? "user" : "environment",
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                zoom: { ideal: 1 }
            },
            audio: false
        };

        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = currentStream;
        hasCameraPermission = true;

        const videoTrack = currentStream.getVideoTracks()[0];
        if (videoTrack && videoTrack.getCapabilities) {
            const capabilities = videoTrack.getCapabilities();
            if (capabilities.zoom) {
                maxZoom = capabilities.zoom.max || 4;
                currentZoom = capabilities.zoom.min || 1;
                updateZoomButtons();
            }
        }

        currentZoom = 1;
        applyZoom();
        detectDeviceOrientation();

    } catch (err) {
        console.error("Erro ao acessar câmera:", err);
        hasCameraPermission = false;
        alert("Não foi possível iniciar a câmera. Verifique as permissões de acesso no seu navegador.");
        closeCameraFullscreen();
    }
}

async function openCameraFullscreen() {
    if (openCameraBtn && openCameraBtn.disabled) return;
    if (!fullscreenCameraContainer) return;

    fullscreenCameraContainer.classList.add('active');
    document.body.style.overflow = 'hidden';

    await requestCameraPermission();
    updateRotationButton();
}

function closeCameraFullscreen() {
    if (!fullscreenCameraContainer) return;
    fullscreenCameraContainer.classList.remove('active');
    document.body.style.overflow = '';
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    hasCameraPermission = false;
    checkCameraAccess();
    checkPhotoLimit();
    window.removeEventListener('deviceorientation', handleDeviceOrientation);
}

function updatePhotoCounter() {
    if (photoCountElement) {
        photoCountElement.textContent = photos.length;
    }
}

function capturePhoto() {
    if (photos.length >= MAX_PHOTOS) {
        alert("Limite de 5 fotos atingido! Compartilhe ou exclua alguma para continuar.");
        checkPhotoLimit();
        return;
    }
    if (!selectTipoFoto.value || !getCurrentRede() || !getCurrentLoja()) {
        alert("Por favor, preencha todos os campos antes de tirar a foto.");
        return;
    }

    if (!hasCameraPermission || !video || video.readyState < 2) {
        alert("Câmera não está pronta ou permissão não concedida.");
        return;
    }

    const rede = getCurrentRede();
    const loja = getCurrentLoja();
    const promotor = getCurrentPromotor();
    const tipoFotoText = `Tipo: ${selectTipoFoto.value}`;
    const promotorText = `Promotor: ${promotor}`;
    const redeText = `Rede: ${rede}`;
    const lojaText = `Loja: ${loja}`;
    const dateText = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

    const watermarkLines = [dateText, lojaText, redeText, promotorText, tipoFotoText];

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const videoW = video.videoWidth;
    const videoH = video.videoHeight;

    canvas.width = videoW;
    canvas.height = videoH;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const padding = Math.max(15, Math.floor(canvas.height / 80));
    const textBaseColor = '#FFFFFF';
    const bgColor = 'rgba(99, 102, 241, 0.8)';
    const defaultFontSize = Math.max(20, Math.floor(canvas.height / 40));

    ctx.font = `bold ${defaultFontSize * 0.9}px "Inter", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    let totalHeight = 0;
    let maxWidth = 0;

    watermarkLines.forEach(line => {
        maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
        totalHeight += defaultFontSize * 0.9 + (padding / 2);
    });
    totalHeight -= (padding / 2);

    const boxPadding = padding * 1.5;
    const boxWidth = maxWidth + 2 * boxPadding;
    const boxHeight = totalHeight + 2 * boxPadding;
    const boxX = canvas.width - boxWidth - padding;
    const boxY = canvas.height - boxHeight - padding;
    const borderRadius = 20;

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, borderRadius);
    } else {
        ctx.rect(boxX, boxY, boxWidth, boxHeight);
    }
    ctx.fill();

    ctx.lineWidth = Math.max(5, Math.floor(canvas.height / 200));
    ctx.strokeStyle = '#33cc33';
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, borderRadius);
    } else {
        ctx.rect(boxX, boxY, boxWidth, boxHeight);
    }
    ctx.stroke();

    ctx.fillStyle = textBaseColor;
    const textCenterX = boxX + (boxWidth / 2);
    let lineY = boxY + boxHeight - boxPadding;

    for (let i = 0; i < watermarkLines.length; i++) {
        const line = watermarkLines[i];
        ctx.fillText(line, textCenterX, lineY);
        lineY -= (defaultFontSize * 0.9 + (padding / 2));
    }

    if (logoImage.complete && logoImage.naturalHeight !== 0) {
        const logoHeight = Math.max(50, Math.floor(canvas.height / 10));
        const logoWidth = (logoImage.naturalWidth / logoImage.naturalHeight) * logoHeight;
        ctx.drawImage(logoImage, padding, padding, logoWidth, logoHeight);
    }

    const dataURL = canvas.toDataURL('image/jpeg', 0.9);

    photos.unshift(dataURL);
    savePhotosToStorage();
    updatePhotoCounter();
    checkPhotoLimit();
    updateGalleryView();
}

function removePhoto(index) {
    if (confirm("Tem certeza que deseja remover esta foto?")) {
        photos.splice(index, 1);
        savePhotosToStorage();
        updatePhotoCounter();
        checkPhotoLimit();
        updateGalleryView();
    }
}

function downloadSinglePhoto(index) {
    const photoURL = photos[index];
    if (!photoURL) return;

    const link = document.createElement("a");
    link.href = photoURL;
    const date = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
    link.download = `Qdelicia_Foto_${date}_${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function updateGalleryView() {
    if (!photoList) return;

    photoList.innerHTML = '';

    const isDisabled = photos.length === 0;
    if (downloadAllBtn) downloadAllBtn.disabled = isDisabled;
    if (shareAllBtn) shareAllBtn.disabled = isDisabled;

    if (photos.length === 0) {
        photoList.innerHTML = `
            <div class="photo-item">
                <div class="photo-info">Galeria de fotos Vazia || Tire uma foto para começar!</div>
            </div>
        `;
        return;
    }

    photos.forEach((photoURL, index) => {
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';

        photoItem.innerHTML = `
            <img src="${photoURL}" alt="Foto ${index + 1}">

            <div class="photo-controls">
                <button class="icon-btn download-single-btn" title="Baixar foto" data-index="${index}">
                    <i class="fas fa-download"></i>
                </button>
                <button class="icon-btn remove-single-btn" title="Remover foto" data-index="${index}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>

            <div class="photo-info">Foto ${index + 1} (${selectTipoFoto.value})</div> `;

        photoList.appendChild(photoItem);
    });

    document.querySelectorAll('.remove-single-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const indexToRemove = parseInt(event.currentTarget.dataset.index);
            removePhoto(indexToRemove);
        });
    });

    document.querySelectorAll('.download-single-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const indexToDownload = parseInt(event.currentTarget.dataset.index);
            downloadSinglePhoto(indexToDownload);
        });
    });
}

function switchCamera() {
    usingFrontCamera = !usingFrontCamera;
    requestCameraPermission();
}

function updateRotationButton() {
    const landscapeText = landscapeGuide ? landscapeGuide.querySelector('.landscape-text') : null;
    const portraitText = portraitGuide ? portraitGuide.querySelector('.portrait-text') : null;

    if (manualRotation === 0) {
        if (orientationArrow) {
            orientationArrow.style.display = 'block';
            orientationArrow.style.transform = 'rotate(-90deg)';
        }
        if (portraitGuide) portraitGuide.style.display = 'block';
        if (landscapeGuide) landscapeGuide.style.display = 'none';
        if (portraitText) {
            portraitText.textContent = '------------ Linha de Referência ------------';
            portraitText.style.transform = 'rotate(0deg)';
        }
    } else {
        if (orientationArrow) {
            orientationArrow.style.display = 'block';
            orientationArrow.style.transform = 'rotate(0deg)';
        }
        if (portraitGuide) portraitGuide.style.display = 'none';
        if (landscapeGuide) landscapeGuide.style.display = 'block';
        if (landscapeText) {
            landscapeText.textContent = '------------ modo paisagem ------------';
            landscapeText.style.transform = 'rotate(0deg)';
        }
    }
}

function applyZoom() {
    if (!currentStream) return;

    const videoTrack = currentStream.getVideoTracks()[0];
    if (videoTrack && videoTrack.getSettings) {
        try {
            videoTrack.applyConstraints({
                advanced: [{ zoom: currentZoom }]
            }).catch(err => console.error('Erro ao aplicar zoom:', err));
        } catch (err) {
            console.error('Zoom não suportado neste dispositivo:', err);
        }
    }
}

function zoomIn() {
    if (currentZoom < maxZoom) {
        currentZoom = Math.min(currentZoom + 0.5, maxZoom);
        applyZoom();
        updateZoomButtons();
    }
}

function zoomOut() {
    if (currentZoom > 1) {
        currentZoom = Math.max(currentZoom - 0.5, 1);
        applyZoom();
        updateZoomButtons();
    }
}

function updateZoomButtons() {
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomLevelDisplay = document.getElementById('zoom-level');

    if (zoomInBtn) {
        zoomInBtn.disabled = currentZoom >= maxZoom;
    }
    if (zoomOutBtn) {
        zoomOutBtn.disabled = currentZoom <= 1;
    }
    if (zoomLevelDisplay) {
        zoomLevelDisplay.textContent = currentZoom.toFixed(1) + 'x';
    }
}

function detectDeviceOrientation() {
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleDeviceOrientation);
    }
}

function handleDeviceOrientation(event) {
    const alpha = event.alpha;
    const beta = event.beta;
    const gamma = event.gamma;

    if (Math.abs(beta) < 45) {
        deviceOrientation = 0;
    } else if (beta > 45) {
        deviceOrientation = 180;
    } else if (gamma > 45) {
        deviceOrientation = 90;
    } else if (gamma < -45) {
        deviceOrientation = -90;
    }
}

function getPhotoRotation() {
    if (manualRotation === 90) {
        return 90;
    }

    if (screen.orientation) {
        const orientation = screen.orientation.type;
        if (orientation.includes('portrait-primary')) return 0;
        if (orientation.includes('portrait-secondary')) return 180;
        if (orientation.includes('landscape-primary')) return 90;
        if (orientation.includes('landscape-secondary')) return -90;
    }

    return deviceOrientation;
}

if (openCameraBtn) {
    openCameraBtn.addEventListener('click', openCameraFullscreen);
}

if (backToGalleryBtn) {
    backToGalleryBtn.addEventListener('click', closeCameraFullscreen);
}

if (shutterBtn) {
    shutterBtn.addEventListener('click', capturePhoto);
}

if (switchBtn) {
    switchBtn.addEventListener('click', switchCamera);
}

const zoomInBtn = document.getElementById('zoom-in-btn');
if (zoomInBtn) {
    zoomInBtn.addEventListener('click', zoomIn);
}

const zoomOutBtn = document.getElementById('zoom-out-btn');
if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', zoomOut);
}

if (downloadAllBtn) {
    downloadAllBtn.addEventListener("click", () => {
        photos.forEach((img, i) => {
            const link = document.createElement("a");
            link.href = img;
            const date = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
            link.download = `Qdelicia_Foto_${date}_${i + 1}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    });
}

async function sharePhotos() {
    if (!navigator.share) {
        alert("A função de compartilhamento não é suportada por este navegador/dispositivo.");
        return;
    }

    if (photos.length === 0) {
        alert("Nenhuma foto para compartilhar.");
        return;
    }

    const rede = getCurrentRede();
    const loja = getCurrentLoja();
    const promotor = getCurrentPromotor();
    const tipoFotoText = `Tipo: ${selectTipoFoto.value}`;
    const promotorText = `Promotor: ${promotor}`;
    const redeText = `Rede: ${rede}`;
    const lojaText = `Loja: ${loja}`;
    const dateText = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

    const legendaCompartilhada = `*Relatório Fotográfico*\n${tipoFotoText}\n${promotorText}\n${redeText}\n${lojaText}\n${dateText}`;

    try {
        const files = photos.slice(0, MAX_PHOTOS).map((img, i) => {
            const byteString = atob(img.split(",")[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let j = 0; j < byteString.length; j++) {
                ia[j] = byteString.charCodeAt(j);
            }
            return new File([ab], `Qdelicia_Foto_${i + 1}.jpg`, { type: "image/jpeg" });
        });

        await navigator.share({
            files,
            title: "Fotos Qdelícia Frutas",
            text: legendaCompartilhada,
        });

        photos = [];
        localStorage.removeItem(PHOTOS_STORAGE_KEY);
        updateGalleryView();
        updatePhotoCounter();
        checkPhotoLimit();

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error(error);
            alert(`Erro ao compartilhar: ${error.message}`);
        }
    }
}

if (shareAllBtn) {
    shareAllBtn.addEventListener("click", sharePhotos);
}

function handleOrientationChange() {
    if (currentStream && fullscreenCameraContainer && fullscreenCameraContainer.classList.contains('active')) {
        setTimeout(() => {
            requestCameraPermission();
        }, 150);
    }
}

try {
    screen.orientation.addEventListener("change", handleOrientationChange);
} catch (e) {
    window.addEventListener("orientationchange", handleOrientationChange);
}

document.addEventListener('DOMContentLoaded', () => {
    initPage();
    loadPhotosFromStorage();
    updateGalleryView();
    updatePhotoCounter();
    detectDeviceOrientation();
    checkPhotoLimit();
    updateRotationButton();
});
