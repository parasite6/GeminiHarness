const { app, BrowserWindow } = require('electron');
const path = require('path');
const { buildTitleBarInsetCss } = require('../src/main/titlebar-inset');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    backgroundColor: '#131314',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#131314',
      symbolColor: '#e3e3e3',
      height: 36,
    },
    webPreferences: { sandbox: true, contextIsolation: true },
  });

  const fixture = path.join(__dirname, '../test/fixtures/titlebar-modal-repro.html');
  await win.loadFile(fixture);
  const css = buildTitleBarInsetCss({
    overlayHeight: 36,
    zoomFactor: 1,
    color: '#131314',
  });
  await win.webContents.insertCSS(css);

  // Replace fixture handlers with CDK's real scroll-position algorithm
  // (ViewportRuler: top = -documentElement.getBoundingClientRect().top).
  await win.webContents.executeJavaScript(`(() => {
    function openModal() {
      document.body.classList.add('open');
      const html = document.documentElement;
      const rect = html.getBoundingClientRect();
      const top = -rect.top || window.scrollY || 0;
      const left = -rect.left || window.scrollX || 0;
      html.style.left = -left + 'px';
      html.style.top = -top + 'px';
      html.classList.add('cdk-global-scrollblock');
    }
    function closeModal() {
      document.body.classList.remove('open');
      const html = document.documentElement;
      html.classList.remove('cdk-global-scrollblock');
      html.style.left = '';
      html.style.top = '';
    }
    document.getElementById('open').onclick = openModal;
    document.getElementById('close').onclick = closeModal;
    document.getElementById('close2').onclick = closeModal;
  })()`);

  async function measure(label) {
    return win.webContents.executeJavaScript(`(() => {
      const html = document.documentElement;
      const body = document.body;
      const header = document.querySelector('.header');
      const hs = getComputedStyle(html);
      const bs = getComputedStyle(body);
      const hr = header.getBoundingClientRect();
      return {
        label: ${JSON.stringify(label)},
        htmlPosition: hs.position,
        htmlTransform: hs.transform,
        htmlTopInline: html.style.top,
        htmlRectTop: html.getBoundingClientRect().top,
        bodyTransform: bs.transform,
        headerTop: hr.top,
        scrollY: window.scrollY,
      };
    })()`);
  }

  const baseline = await measure('baseline');
  await win.webContents.executeJavaScript(
    'document.getElementById("open").click()',
  );
  await new Promise((r) => setTimeout(r, 100));
  const modal = await measure('modal-open');

  const delta = modal.headerTop - baseline.headerTop;
  console.log(JSON.stringify({ baseline, modal, headerDelta: delta }, null, 2));
  if (Math.abs(delta) > 1) {
    console.error('FAIL: modal shifted header by', delta);
    app.exit(2);
    return;
  }
  app.exit(0);
}).catch((err) => {
  console.error(err);
  app.exit(1);
});
