#!/usr/bin/env node
/**
 * Generates _locales messages.json files for Simulador Mobile.
 * Run: node tools/gen_locales.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '_locales');

/** @type {Record<string, Record<string, string>>} */
const L = {
  en: {},
  pt_BR: {},
  es: {},
  fr: {},
  de: {}
};

function add(key, values) {
  for (const loc of Object.keys(L)) {
    if (!values[loc]) throw new Error(`Missing ${loc} for ${key}`);
    L[loc][key] = values[loc];
  }
}

add('extName', {
  en: 'Mobile Simulator: Phone, Tablet, Laptop & Smart TV',
  pt_BR: 'Simulador Mobile: Celular, Tablet e Smart TV',
  es: 'Simulador Móvil: Teléfono, Tablet, Portátil y Smart TV',
  fr: 'Simulateur Mobile : Téléphone, Tablette, PC et Smart TV',
  de: 'Mobile Simulator: Handy, Tablet, Laptop & Smart TV'
});
add('extShortName', {
  en: 'Simulator',
  pt_BR: 'Simulador',
  es: 'Simulador',
  fr: 'Simulateur',
  de: 'Simulator'
});
add('extDescription', {
  en: 'Real responsive testing: phone, tablet, laptop & TV mockups with realistic frames, touch, virtual keyboard, UA & FPS.',
  pt_BR: 'Teste responsivo real: mockup de celular, tablet, notebook e TV com moldura, toque, teclado virtual, UA e FPS.',
  es: 'Prueba responsive real: mockups de teléfono, tablet, portátil y TV con marco, toque, teclado virtual, UA y FPS.',
  fr: 'Test responsive réel : mockups téléphone, tablette, PC et TV avec cadre, tactile, clavier virtuel, UA et FPS.',
  de: 'Echtes Responsive-Testing: Handy-, Tablet-, Laptop- und TV-Mockups mit Rahmen, Touch, Tastatur, UA und FPS.'
});
add('actionTitle', {
  en: 'Mobile Simulator — open device panel',
  pt_BR: 'Simulador Mobile — abrir painel de dispositivos',
  es: 'Simulador Móvil — abrir panel de dispositivos',
  fr: 'Simulateur Mobile — ouvrir le panneau des appareils',
  de: 'Mobile Simulator — Gerätepanel öffnen'
});
add('cmdReopenLast', {
  en: 'Reopen the last device and URL in preview',
  pt_BR: 'Reabrir o último dispositivo e URL na prévia',
  es: 'Reabrir el último dispositivo y URL en la vista previa',
  fr: 'Rouvrir le dernier appareil et l’URL dans l’aperçu',
  de: 'Letztes Gerät und URL in der Vorschau erneut öffnen'
});

add('appTitle', {
  en: 'Mobile Simulator',
  pt_BR: 'Simulador Mobile',
  es: 'Simulador Móvil',
  fr: 'Simulateur Mobile',
  de: 'Mobile Simulator'
});
add('panelSubtitle', {
  en: 'Pick a device to preview the current tab’s site',
  pt_BR: 'Escolha um dispositivo para visualizar o site da aba atual',
  es: 'Elige un dispositivo para ver el sitio de la pestaña actual',
  fr: 'Choisissez un appareil pour prévisualiser le site de l’onglet',
  de: 'Gerät wählen, um die Seite des aktuellen Tabs anzuzeigen'
});
add('searchPlaceholder', {
  en: 'Search device…',
  pt_BR: 'Buscar dispositivo…',
  es: 'Buscar dispositivo…',
  fr: 'Rechercher un appareil…',
  de: 'Gerät suchen…'
});
add('presetsLabel', {
  en: 'Presets',
  pt_BR: 'Presets',
  es: 'Presets',
  fr: 'Presets',
  de: 'Presets'
});
add('recentLabel', {
  en: 'Recent',
  pt_BR: 'Recentes',
  es: 'Recientes',
  fr: 'Récents',
  de: 'Zuletzt'
});
add('favorites', {
  en: 'Favorites',
  pt_BR: 'Favoritos',
  es: 'Favoritos',
  fr: 'Favoris',
  de: 'Favoriten'
});
add('footerPreview', {
  en: 'Preview opens in the current tab, with a realistic frame.',
  pt_BR: 'A prévia abre na própria aba atual, com moldura realista.',
  es: 'La vista previa se abre en la pestaña actual, con marco realista.',
  fr: 'L’aperçu s’ouvre dans l’onglet actuel, avec un cadre réaliste.',
  de: 'Die Vorschau öffnet sich im aktuellen Tab mit realistischem Rahmen.'
});
add('footerCredit', {
  en: 'Built by Lucas Caldeira',
  pt_BR: 'Desenvolvido por Lucas Caldeira',
  es: 'Desarrollado por Lucas Caldeira',
  fr: 'Développé par Lucas Caldeira',
  de: 'Entwickelt von Lucas Caldeira'
});
add('footerShortcut', {
  en: 'Shortcut: Alt+Shift+P reopens the last device',
  pt_BR: 'Atalho: Alt+Shift+P reabre o último',
  es: 'Atajo: Alt+Shift+P reabre el último',
  fr: 'Raccourci : Alt+Shift+P rouvre le dernier',
  de: 'Kürzel: Alt+Shift+P öffnet das letzte Gerät erneut'
});
add('ariaPresets', {
  en: 'Workflow presets',
  pt_BR: 'Presets de workflow',
  es: 'Presets de flujo de trabajo',
  fr: 'Presets de workflow',
  de: 'Workflow-Presets'
});
add('ariaRecent', {
  en: 'Recent history',
  pt_BR: 'Histórico recente',
  es: 'Historial reciente',
  fr: 'Historique récent',
  de: 'Letzte Einträge'
});
add('ariaGroups', {
  en: 'Device categories',
  pt_BR: 'Categorias de dispositivos',
  es: 'Categorías de dispositivos',
  fr: 'Catégories d’appareils',
  de: 'Gerätekategorien'
});
add('presetApplyTitle', {
  en: 'Favorite the set and open the first device',
  pt_BR: 'Favorita o set e abre o primeiro aparelho',
  es: 'Marca el set como favorito y abre el primero',
  fr: 'Ajoute le set aux favoris et ouvre le premier',
  de: 'Set favorisieren und erstes Gerät öffnen'
});
add('urlOfTab', {
  en: 'Tab URL',
  pt_BR: 'URL da aba',
  es: 'URL de la pestaña',
  fr: 'URL de l’onglet',
  de: 'Tab-URL'
});
add('favAdd', {
  en: 'Add to favorites',
  pt_BR: 'Adicionar aos favoritos',
  es: 'Añadir a favoritos',
  fr: 'Ajouter aux favoris',
  de: 'Zu Favoriten hinzufügen'
});
add('favRemove', {
  en: 'Remove from favorites',
  pt_BR: 'Remover dos favoritos',
  es: 'Quitar de favoritos',
  fr: 'Retirer des favoris',
  de: 'Aus Favoriten entfernen'
});
add('physicalRes', {
  en: 'Physical resolution: $1 px',
  pt_BR: 'Resolução física: $1 px',
  es: 'Resolución física: $1 px',
  fr: 'Résolution physique : $1 px',
  de: 'Physische Auflösung: $1 px'
});

add('cat_android', {
  en: 'Android phones',
  pt_BR: 'Telefones Android',
  es: 'Teléfonos Android',
  fr: 'Téléphones Android',
  de: 'Android-Handys'
});
add('cat_apple', {
  en: 'Apple phones',
  pt_BR: 'Telefones Apple',
  es: 'Teléfonos Apple',
  fr: 'Téléphones Apple',
  de: 'Apple-Handys'
});
add('cat_tablets', {
  en: 'Tablets',
  pt_BR: 'Tablets',
  es: 'Tablets',
  fr: 'Tablettes',
  de: 'Tablets'
});
add('cat_notebooks', {
  en: 'Laptops',
  pt_BR: 'Notebooks',
  es: 'Portátiles',
  fr: 'Ordinateurs portables',
  de: 'Laptops'
});
add('cat_tvs', {
  en: 'Smart TVs',
  pt_BR: 'Smart TVs',
  es: 'Smart TVs',
  fr: 'Smart TVs',
  de: 'Smart-TVs'
});

add('preset_qa_ios_name', {
  en: 'iOS QA',
  pt_BR: 'QA iOS',
  es: 'QA iOS',
  fr: 'QA iOS',
  de: 'iOS-QA'
});
add('preset_qa_ios_hint', {
  en: 'New iPhone, SE and iPad',
  pt_BR: 'iPhone novo, SE e iPad',
  es: 'iPhone nuevo, SE e iPad',
  fr: 'Nouvel iPhone, SE et iPad',
  de: 'Neues iPhone, SE und iPad'
});
add('preset_android_mid_name', {
  en: 'Android mid',
  pt_BR: 'Android mid',
  es: 'Android mid',
  fr: 'Android mid',
  de: 'Android Midrange'
});
add('preset_android_mid_hint', {
  en: 'Budget, Pixel and flagship',
  pt_BR: 'Entrada, Pixel e flagship',
  es: 'Gama de entrada, Pixel y flagship',
  fr: 'Entrée de gamme, Pixel et flagship',
  de: 'Einstieg, Pixel und Flagship'
});
add('preset_tv_living_name', {
  en: 'Living room TV',
  pt_BR: 'TV sala',
  es: 'TV salón',
  fr: 'TV salon',
  de: 'Wohnzimmer-TV'
});
add('preset_tv_living_hint', {
  en: 'Full HD and 4K',
  pt_BR: 'Full HD e 4K',
  es: 'Full HD y 4K',
  fr: 'Full HD et 4K',
  de: 'Full HD und 4K'
});

add('obStep', {
  en: 'Step $1 of $2',
  pt_BR: 'Passo $1 de $2',
  es: 'Paso $1 de $2',
  fr: 'Étape $1 sur $2',
  de: 'Schritt $1 von $2'
});
add('obSkip', {
  en: 'Skip',
  pt_BR: 'Pular',
  es: 'Omitir',
  fr: 'Passer',
  de: 'Überspringen'
});
add('obNext', {
  en: 'Next',
  pt_BR: 'Próximo',
  es: 'Siguiente',
  fr: 'Suivant',
  de: 'Weiter'
});
add('obStart', {
  en: 'Get started',
  pt_BR: 'Começar',
  es: 'Empezar',
  fr: 'Commencer',
  de: 'Loslegen'
});
add('ob1Title', {
  en: 'Pick a device',
  pt_BR: 'Escolha um aparelho',
  es: 'Elige un dispositivo',
  fr: 'Choisissez un appareil',
  de: 'Gerät wählen'
});
add('ob1Body', {
  en: 'Tap an iPhone or Pixel below — preview opens in the current tab with a realistic frame and that device’s User-Agent.',
  pt_BR: 'Toque num iPhone ou Pixel abaixo — a prévia abre na aba atual com moldura realista e User-Agent do dispositivo.',
  es: 'Toca un iPhone o Pixel abajo — la vista previa se abre en la pestaña actual con marco realista y el User-Agent del dispositivo.',
  fr: 'Touchez un iPhone ou un Pixel ci-dessous — l’aperçu s’ouvre dans l’onglet avec un cadre réaliste et l’User-Agent de l’appareil.',
  de: 'Tippen Sie unten auf iPhone oder Pixel — die Vorschau öffnet sich im Tab mit realistischem Rahmen und dem User-Agent des Geräts.'
});
add('ob2Title', {
  en: 'Use the site already open',
  pt_BR: 'Use o site que já está aberto',
  es: 'Usa el sitio ya abierto',
  fr: 'Utilisez le site déjà ouvert',
  de: 'Bereits geöffnete Seite nutzen'
});
add('ob2Body', {
  en: 'The current tab URL loads into the mockup automatically. If the tab is chrome:// or empty, we open a demo (Wikipedia).',
  pt_BR: 'A URL da aba atual vai para o mockup automaticamente. Se a aba for chrome:// ou estiver vazia, abrimos um demo (Wikipedia).',
  es: 'La URL de la pestaña actual se carga en el mockup automáticamente. Si es chrome:// o está vacía, abrimos una demo (Wikipedia).',
  fr: 'L’URL de l’onglet se charge automatiquement dans le mockup. Si c’est chrome:// ou vide, nous ouvrons une démo (Wikipedia).',
  de: 'Die URL des aktuellen Tabs wird automatisch geladen. Bei chrome:// oder leerem Tab öffnen wir eine Demo (Wikipedia).'
});
add('ob3Title', {
  en: 'Rotate, capture and measure FPS',
  pt_BR: 'Gire, capture e meça FPS',
  es: 'Gira, captura y mide FPS',
  fr: 'Tournez, capturez et mesurez les FPS',
  de: 'Drehen, erfassen und FPS messen'
});
add('ob3Body', {
  en: 'In the preview bar: rotate, virtual keyboard when focusing a field, Capture PNG and FPS. Alt+Shift+P reopens the last device.',
  pt_BR: 'Na barra da prévia: girar, teclado virtual ao focar um campo, Capturar PNG e FPS. Alt+Shift+P reabre o último aparelho.',
  es: 'En la barra de vista previa: girar, teclado virtual al enfocar un campo, Capturar PNG y FPS. Alt+Shift+P reabre el último dispositivo.',
  fr: 'Dans la barre d’aperçu : rotation, clavier virtuel au focus, Capture PNG et FPS. Alt+Shift+P rouvre le dernier appareil.',
  de: 'In der Vorschauleiste: drehen, virtuelle Tastatur bei Fokus, PNG erfassen und FPS. Alt+Shift+P öffnet das letzte Gerät erneut.'
});

add('errDevices', {
  en: 'Could not load the device list: $1. Reload the extension at chrome://extensions.',
  pt_BR: 'Não foi possível carregar a lista de dispositivos: $1. Recarregue a extensão em chrome://extensions.',
  es: 'No se pudo cargar la lista de dispositivos: $1. Recarga la extensión en chrome://extensions.',
  fr: 'Impossible de charger la liste des appareils : $1. Rechargez l’extension sur chrome://extensions.',
  de: 'Geräteliste konnte nicht geladen werden: $1. Erweiterung unter chrome://extensions neu laden.'
});
add('errPreset', {
  en: 'Preset failed: $1',
  pt_BR: 'Falha no preset: $1',
  es: 'Error en el preset: $1',
  fr: 'Échec du preset : $1',
  de: 'Preset fehlgeschlagen: $1'
});
add('errPreview', {
  en: 'Failed to open preview: $1',
  pt_BR: 'Falha ao abrir a prévia: $1',
  es: 'Error al abrir la vista previa: $1',
  fr: 'Échec de l’ouverture de l’aperçu : $1',
  de: 'Vorschau konnte nicht geöffnet werden: $1'
});
add('errPreviewReload', {
  en: 'Failed to open preview: $1. Reload the extension at chrome://extensions.',
  pt_BR: 'Falha ao abrir a prévia: $1. Recarregue a extensão em chrome://extensions.',
  es: 'Error al abrir la vista previa: $1. Recarga la extensión en chrome://extensions.',
  fr: 'Échec de l’ouverture de l’aperçu : $1. Rechargez l’extension sur chrome://extensions.',
  de: 'Vorschau fehlgeschlagen: $1. Erweiterung unter chrome://extensions neu laden.'
});
add('errNoResponse', {
  en: 'no response from service worker',
  pt_BR: 'sem resposta do service worker',
  es: 'sin respuesta del service worker',
  fr: 'pas de réponse du service worker',
  de: 'keine Antwort vom Service Worker'
});

add('btnRotate', {
  en: 'Rotate (portrait/landscape)',
  pt_BR: 'Girar (retrato/paisagem)',
  es: 'Girar (retrato/paisaje)',
  fr: 'Tourner (portrait/paysage)',
  de: 'Drehen (Hoch-/Querformat)'
});
add('btnFrameless', {
  en: 'Fullscreen: hide the frame and show only the screen at device resolution (keeps aspect ratio)',
  pt_BR: 'Tela cheia: oculta a moldura e exibe só a tela, na resolução do dispositivo (mantém a proporção)',
  es: 'Pantalla completa: oculta el marco y muestra solo la pantalla a la resolución del dispositivo (mantiene la proporción)',
  fr: 'Plein écran : masque le cadre et n’affiche que l’écran à la résolution de l’appareil (conserve le ratio)',
  de: 'Vollbild: Rahmen ausblenden und nur den Bildschirm in Geräteauflösung zeigen (Seitenverhältnis bleibt)'
});
add('btnStretch', {
  en: 'Stretch: fill the window distorting aspect ratio (enables fullscreen)',
  pt_BR: 'Esticar: preenche toda a janela distorcendo a proporção (ativa a tela cheia)',
  es: 'Estirar: llena toda la ventana distorsionando la proporción (activa pantalla completa)',
  fr: 'Étirer : remplit la fenêtre en déformant le ratio (active le plein écran)',
  de: 'Strecken: füllt das Fenster und verzerrt das Seitenverhältnis (aktiviert Vollbild)'
});
add('btnBrowser', {
  en: 'Browser bar: show Chrome/Safari chrome inside the mockup',
  pt_BR: 'Barra do navegador: mostra a interface do Chrome/Safari do celular dentro do mockup',
  es: 'Barra del navegador: muestra la interfaz de Chrome/Safari del móvil dentro del mockup',
  fr: 'Barre du navigateur : affiche l’interface Chrome/Safari dans le mockup',
  de: 'Browserleiste: Chrome/Safari-Oberfläche im Mockup anzeigen'
});
add('btnTouch', {
  en: 'Touch: the site receives touch events instead of mouse; drag scrolls; pointer becomes a finger (phones and tablets only)',
  pt_BR: 'Toque: o site passa a receber eventos de toque em vez de mouse, arrastar rola a página e o ponteiro vira um dedo (só em celular e tablet)',
  es: 'Toque: el sitio recibe eventos táctiles en lugar del ratón; arrastrar desplaza; el puntero se vuelve un dedo (solo móvil y tablet)',
  fr: 'Tactile : le site reçoit des événements tactiles au lieu de la souris ; glisser fait défiler ; le pointeur devient un doigt (téléphone/tablette)',
  de: 'Touch: Die Seite erhält Touch- statt Mausereignisse; Ziehen scrollt; Zeiger wird zum Finger (nur Handy/Tablet)'
});
add('btnBack', { en: 'Back', pt_BR: 'Voltar', es: 'Atrás', fr: 'Retour', de: 'Zurück' });
add('btnReload', { en: 'Reload', pt_BR: 'Recarregar', es: 'Recargar', fr: 'Recharger', de: 'Neu laden' });
add('addressPlaceholder', {
  en: 'Enter a URL and press Enter',
  pt_BR: 'Digite a URL e pressione Enter',
  es: 'Escribe la URL y pulsa Enter',
  fr: 'Saisissez l’URL et appuyez sur Entrée',
  de: 'URL eingeben und Enter drücken'
});
add('addressAria', {
  en: 'Site address (URL)',
  pt_BR: 'Endereço do site (URL)',
  es: 'Dirección del sitio (URL)',
  fr: 'Adresse du site (URL)',
  de: 'Seitenadresse (URL)'
});
add('btnGo', { en: 'Go', pt_BR: 'Ir', es: 'Ir', fr: 'Aller', de: 'Los' });
add('btnGoTitle', {
  en: 'Navigate to URL',
  pt_BR: 'Navegar para a URL',
  es: 'Ir a la URL',
  fr: 'Aller à l’URL',
  de: 'Zur URL navigieren'
});
add('btnZoomOut', { en: 'Zoom out', pt_BR: 'Reduzir zoom', es: 'Alejar', fr: 'Zoom arrière', de: 'Verkleinern' });
add('btnZoomIn', { en: 'Zoom in', pt_BR: 'Aumentar zoom', es: 'Acercar', fr: 'Zoom avant', de: 'Vergrößern' });
add('btnZoomFit', { en: 'Fit to window', pt_BR: 'Ajustar à janela', es: 'Ajustar a la ventana', fr: 'Ajuster à la fenêtre', de: 'An Fenster anpassen' });
add('btnZoomFitLabel', { en: 'Fit', pt_BR: 'Ajustar', es: 'Ajustar', fr: 'Ajuster', de: 'Anpassen' });
add('zoomLabel', { en: 'Current zoom', pt_BR: 'Zoom atual', es: 'Zoom actual', fr: 'Zoom actuel', de: 'Aktueller Zoom' });
add('btnTheme', {
  en: 'Toggle light/dark theme',
  pt_BR: 'Alternar tema claro/escuro',
  es: 'Alternar tema claro/oscuro',
  fr: 'Basculer thème clair/sombre',
  de: 'Hell-/Dunkelmodus umschalten'
});
add('btnFps', {
  en: 'FPS meter: measure frames per second of the embedded site.',
  pt_BR: 'Medidor de FPS: mede os quadros por segundo do site embutido.',
  es: 'Medidor de FPS: mide los fotogramas por segundo del sitio incrustado.',
  fr: 'Compteur FPS : mesure les images/seconde du site embarqué.',
  de: 'FPS-Anzeige: misst die Bilder pro Sekunde der eingebetteten Seite.'
});
add('btnCapture', { en: 'Capture', pt_BR: 'Capturar', es: 'Capturar', fr: 'Capturer', de: 'Erfassen' });
add('btnCaptureTitle', {
  en: 'Capture mockup image',
  pt_BR: 'Capturar imagem do mockup',
  es: 'Capturar imagen del mockup',
  fr: 'Capturer l’image du mockup',
  de: 'Mockup-Bild erfassen'
});
add('btnReport', { en: 'Report', pt_BR: 'Relatório', es: 'Informe', fr: 'Rapport', de: 'Bericht' });
add('btnReportTitle', {
  en: 'Copy report (viewport, UA, FPS) for PR/Jira',
  pt_BR: 'Copiar relatório (viewport, UA, FPS) para colar em PR/Jira',
  es: 'Copiar informe (viewport, UA, FPS) para PR/Jira',
  fr: 'Copier le rapport (viewport, UA, FPS) pour PR/Jira',
  de: 'Bericht kopieren (Viewport, UA, FPS) für PR/Jira'
});
add('btnExit', { en: 'Exit', pt_BR: 'Sair', es: 'Salir', fr: 'Quitter', de: 'Beenden' });
add('btnExitTitle', {
  en: 'Exit preview and return to the normal site',
  pt_BR: 'Sair da prévia e voltar ao site normal',
  es: 'Salir de la vista previa y volver al sitio normal',
  fr: 'Quitter l’aperçu et revenir au site normal',
  de: 'Vorschau beenden und zur normalen Seite zurück'
});
add('deviceSelectAria', {
  en: 'Switch device',
  pt_BR: 'Trocar dispositivo',
  es: 'Cambiar dispositivo',
  fr: 'Changer d’appareil',
  de: 'Gerät wechseln'
});

add('reviewBody', {
  en: 'Did the capture help? A Chrome Web Store review boosts discovery for other developers.',
  pt_BR: 'A captura ajudou? Uma avaliação na Chrome Web Store impulsiona a descoberta da extensão.',
  es: '¿Te ayudó la captura? Una reseña en Chrome Web Store impulsa el descubrimiento.',
  fr: 'La capture a-t-elle aidé ? Un avis sur le Chrome Web Store booste la découverte.',
  de: 'Hat die Aufnahme geholfen? Eine Bewertung im Chrome Web Store verbessert die Sichtbarkeit.'
});
add('reviewLater', { en: 'Not now', pt_BR: 'Agora não', es: 'Ahora no', fr: 'Pas maintenant', de: 'Nicht jetzt' });
add('reviewNever', { en: 'Don’t ask again', pt_BR: 'Não perguntar', es: 'No preguntar', fr: 'Ne plus demander', de: 'Nicht mehr fragen' });
add('reviewGo', { en: 'Rate ★★★★★', pt_BR: 'Avaliar ★★★★★', es: 'Valorar ★★★★★', fr: 'Noter ★★★★★', de: 'Bewerten ★★★★★' });

add('toastOpenViaExt', {
  en: 'Open this page from the extension (toolbar icon), not as a local file.',
  pt_BR: 'Abra esta página pela extensão (ícone na barra do Chrome), não como arquivo local.',
  es: 'Abre esta página desde la extensión (icono de la barra), no como archivo local.',
  fr: 'Ouvrez cette page via l’extension (icône de la barre), pas comme fichier local.',
  de: 'Öffnen Sie diese Seite über die Erweiterung (Symbolleiste), nicht als lokale Datei.'
});
add('toastInitError', {
  en: 'Failed to start preview: $1',
  pt_BR: 'Erro ao iniciar a prévia: $1',
  es: 'Error al iniciar la vista previa: $1',
  fr: 'Erreur au démarrage de l’aperçu : $1',
  de: 'Vorschau-Start fehlgeschlagen: $1'
});
add('toastPortrait', { en: 'Portrait', pt_BR: 'Retrato', es: 'Retrato', fr: 'Portrait', de: 'Hochformat' });
add('toastLandscape', { en: 'Landscape', pt_BR: 'Paisagem', es: 'Paisaje', fr: 'Paysage', de: 'Querformat' });
add('toastFramelessOn', {
  en: 'Fullscreen: device screen only',
  pt_BR: 'Tela cheia: só a tela do dispositivo',
  es: 'Pantalla completa: solo la pantalla del dispositivo',
  fr: 'Plein écran : écran de l’appareil uniquement',
  de: 'Vollbild: nur Gerätebildschirm'
});
add('toastFramelessOff', {
  en: 'Device frame visible',
  pt_BR: 'Moldura do dispositivo visível',
  es: 'Marco del dispositivo visible',
  fr: 'Cadre de l’appareil visible',
  de: 'Geräterahmen sichtbar'
});
add('toastStretchOn', {
  en: 'Stretched: fills the window (distorts aspect ratio)',
  pt_BR: 'Esticado: preenche a janela (distorce a proporção)',
  es: 'Estirado: llena la ventana (distorsiona la proporción)',
  fr: 'Étiré : remplit la fenêtre (déforme le ratio)',
  de: 'Gestreckt: füllt das Fenster (verzerrt Seitenverhältnis)'
});
add('toastStretchOff', {
  en: 'Device aspect ratio restored',
  pt_BR: 'Proporção do dispositivo restaurada',
  es: 'Proporción del dispositivo restaurada',
  fr: 'Ratio de l’appareil restauré',
  de: 'Geräte-Seitenverhältnis wiederhergestellt'
});
add('toastBrowserOn', {
  en: 'Browser bar visible',
  pt_BR: 'Barra do navegador visível',
  es: 'Barra del navegador visible',
  fr: 'Barre du navigateur visible',
  de: 'Browserleiste sichtbar'
});
add('toastBrowserOff', {
  en: 'Browser bar hidden',
  pt_BR: 'Barra do navegador oculta',
  es: 'Barra del navegador oculta',
  fr: 'Barre du navigateur masquée',
  de: 'Browserleiste ausgeblendet'
});
add('toastPickDevice', {
  en: 'Pick a device first.',
  pt_BR: 'Escolha um dispositivo primeiro.',
  es: 'Elige un dispositivo primero.',
  fr: 'Choisissez d’abord un appareil.',
  de: 'Bitte zuerst ein Gerät wählen.'
});
add('toastCaptureExtOnly', {
  en: 'Capture is only available from the extension.',
  pt_BR: 'Captura disponível apenas pela extensão.',
  es: 'La captura solo está disponible desde la extensión.',
  fr: 'La capture n’est disponible que via l’extension.',
  de: 'Aufnahme nur über die Erweiterung verfügbar.'
});
add('toastCaptureSaved', {
  en: 'Capture saved ($1×$2 px)',
  pt_BR: 'Captura salva ($1×$2 px)',
  es: 'Captura guardada ($1×$2 px)',
  fr: 'Capture enregistrée ($1×$2 px)',
  de: 'Aufnahme gespeichert ($1×$2 px)'
});
add('toastCaptureError', {
  en: 'Capture error: $1',
  pt_BR: 'Erro na captura: $1',
  es: 'Error de captura: $1',
  fr: 'Erreur de capture : $1',
  de: 'Aufnahmefehler: $1'
});
add('toastUaFail', {
  en: 'Failed to apply User-Agent: $1',
  pt_BR: 'Falha ao aplicar o User-Agent: $1',
  es: 'Error al aplicar el User-Agent: $1',
  fr: 'Échec de l’application de l’User-Agent : $1',
  de: 'User-Agent konnte nicht gesetzt werden: $1'
});
add('toastFpsOn', {
  en: 'FPS meter on',
  pt_BR: 'Medidor de FPS ativado',
  es: 'Medidor de FPS activado',
  fr: 'Compteur FPS activé',
  de: 'FPS-Anzeige aktiv'
});
add('toastFpsOff', {
  en: 'FPS meter off',
  pt_BR: 'Medidor de FPS desativado',
  es: 'Medidor de FPS desactivado',
  fr: 'Compteur FPS désactivé',
  de: 'FPS-Anzeige aus'
});
add('toastFpsExtOnly', {
  en: 'FPS meter is only available from the extension.',
  pt_BR: 'Medidor de FPS disponível apenas pela extensão.',
  es: 'El medidor de FPS solo está disponible desde la extensión.',
  fr: 'Le compteur FPS n’est disponible que via l’extension.',
  de: 'FPS-Anzeige nur über die Erweiterung verfügbar.'
});
add('toastFpsNeedSite', {
  en: 'Load a site before measuring FPS.',
  pt_BR: 'Carregue um site antes de medir o FPS.',
  es: 'Carga un sitio antes de medir el FPS.',
  fr: 'Chargez un site avant de mesurer les FPS.',
  de: 'Laden Sie zuerst eine Seite, bevor Sie FPS messen.'
});
add('toastFpsFail', {
  en: 'Could not measure FPS: $1',
  pt_BR: 'Não foi possível medir o FPS: $1',
  es: 'No se pudo medir el FPS: $1',
  fr: 'Impossible de mesurer les FPS : $1',
  de: 'FPS konnte nicht gemessen werden: $1'
});
add('fpsUnreachable', {
  en: 'site content unreachable (may block iframe; reload and try again)',
  pt_BR: 'conteúdo do site inacessível (pode bloquear iframe; recarregue e tente de novo)',
  es: 'contenido del sitio inaccesible (puede bloquear el iframe; recarga e inténtalo de nuevo)',
  fr: 'contenu du site inaccessible (il peut bloquer l’iframe ; rechargez et réessayez)',
  de: 'Seiteninhalt nicht erreichbar (blockiert evtl. iframes; neu laden und erneut versuchen)'
});
add('fpsReconnectFail', {
  en: 'could not reconnect to the site',
  pt_BR: 'não foi possível reconectar ao site',
  es: 'no se pudo reconectar al sitio',
  fr: 'impossible de se reconnecter au site',
  de: 'Verbindung zur Seite konnte nicht wiederhergestellt werden'
});
add('browserNewTab', {
  en: 'New tab', pt_BR: 'Nova aba', es: 'Nueva pestaña', fr: 'Nouvel onglet', de: 'Neuer Tab'
});
add('kbSpace', {
  en: 'space', pt_BR: 'espaço', es: 'espacio', fr: 'espace', de: 'Leer'
});
add('kbSearch', {
  en: 'search', pt_BR: 'buscar', es: 'buscar', fr: 'rech.', de: 'Suche'
});
add('kbGo', {
  en: 'go', pt_BR: 'ir', es: 'ir', fr: 'aller', de: 'los'
});
add('kbCurrency', {
  en: '$', pt_BR: 'R$', es: '€', fr: '€', de: '€'
});
add('toastFpsUnavailable', {
  en: 'Measurement unavailable for $1. Reload the extension at chrome://extensions.',
  pt_BR: 'Recurso de medição indisponível para $1. Recarregue a extensão em chrome://extensions.',
  es: 'Medición no disponible para $1. Recarga la extensión en chrome://extensions.',
  fr: 'Mesure indisponible pour $1. Rechargez l’extension sur chrome://extensions.',
  de: 'Messung für $1 nicht verfügbar. Erweiterung unter chrome://extensions neu laden.'
});
add('toastReportCopied', {
  en: 'Report copied — paste into PR or Jira',
  pt_BR: 'Relatório copiado — cole no PR ou Jira',
  es: 'Informe copiado — pégalo en el PR o Jira',
  fr: 'Rapport copié — collez-le dans le PR ou Jira',
  de: 'Bericht kopiert — in PR oder Jira einfügen'
});
add('toastReportFail', {
  en: 'Could not copy; check the console for the text',
  pt_BR: 'Não foi possível copiar; selecione o texto no console',
  es: 'No se pudo copiar; mira el texto en la consola',
  fr: 'Impossible de copier ; voir le texte dans la console',
  de: 'Kopieren fehlgeschlagen; Text in der Konsole prüfen'
});
add('toastTouchDesktop', {
  en: 'This device is used with a mouse — touch stays off.',
  pt_BR: 'Este aparelho é usado com mouse — o toque fica desligado.',
  es: 'Este dispositivo se usa con ratón — el toque permanece desactivado.',
  fr: 'Cet appareil s’utilise avec une souris — le tactile reste désactivé.',
  de: 'Dieses Gerät wird mit Maus bedient — Touch bleibt aus.'
});
add('toastTouchOn', {
  en: 'Touch on: drag to scroll, like on a real device.',
  pt_BR: 'Toque ligado: arraste para rolar, como no aparelho de verdade.',
  es: 'Toque activado: arrastra para desplazar, como en un dispositivo real.',
  fr: 'Tactile activé : glissez pour faire défiler, comme sur un vrai appareil.',
  de: 'Touch an: Ziehen zum Scrollen, wie auf einem echten Gerät.'
});
add('toastTouchOff', {
  en: 'Touch off: the site receives mouse events again.',
  pt_BR: 'Toque desligado: o site volta a receber eventos de mouse.',
  es: 'Toque desactivado: el sitio vuelve a recibir eventos de ratón.',
  fr: 'Tactile désactivé : le site reçoit à nouveau les événements souris.',
  de: 'Touch aus: Die Seite erhält wieder Mausereignisse.'
});
add('toastZoomStretch', {
  en: 'Stretched to fill the window',
  pt_BR: 'Esticado para preencher a janela',
  es: 'Estirado para llenar la ventana',
  fr: 'Étiré pour remplir la fenêtre',
  de: 'Gestreckt, um das Fenster zu füllen'
});
add('reportTitle', {
  en: '## Mobile Simulator — report',
  pt_BR: '## Simulador Mobile — relatório',
  es: '## Simulador Móvil — informe',
  fr: '## Simulateur Mobile — rapport',
  de: '## Mobile Simulator — Bericht'
});
add('reportDevice', { en: 'Device', pt_BR: 'Dispositivo', es: 'Dispositivo', fr: 'Appareil', de: 'Gerät' });
add('reportViewport', { en: 'Viewport', pt_BR: 'Viewport', es: 'Viewport', fr: 'Viewport', de: 'Viewport' });
add('reportOrientation', { en: 'Orientation', pt_BR: 'Orientação', es: 'Orientación', fr: 'Orientation', de: 'Ausrichtung' });
add('reportPlatform', { en: 'Platform', pt_BR: 'Plataforma', es: 'Plataforma', fr: 'Plateforme', de: 'Plattform' });
add('reportFpsMissing', {
  en: '(turn on the FPS meter in the toolbar to include)',
  pt_BR: '(ative o medidor FPS na toolbar para incluir)',
  es: '(activa el medidor FPS en la barra para incluirlo)',
  fr: '(activez le compteur FPS dans la barre pour l’inclure)',
  de: '(FPS-Anzeige in der Leiste aktivieren, um einzuschließen)'
});
add('reportGenerated', {
  en: '_Generated by Mobile Simulator $1_',
  pt_BR: '_Gerado pelo Simulador Mobile $1_',
  es: '_Generado por Simulador Móvil $1_',
  fr: '_Généré par Simulateur Mobile $1_',
  de: '_Erstellt mit Mobile Simulator $1_'
});
add('reportPhysical', { en: 'Physical', pt_BR: 'Físico', es: 'Físico', fr: 'Physique', de: 'Physisch' });

for (const loc of Object.keys(L)) {
  const dir = path.join(root, loc);
  fs.mkdirSync(dir, { recursive: true });
  const out = {};
  for (const [k, message] of Object.entries(L[loc])) {
    out[k] = { message };
  }
  fs.writeFileSync(path.join(dir, 'messages.json'), JSON.stringify(out, null, 2) + '\n');
  console.log('wrote', loc, Object.keys(out).length, 'keys');
}
