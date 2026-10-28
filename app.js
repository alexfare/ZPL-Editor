const presets = {
  text: { type: 'text', name: 'Text', content: 'New text', x: 42, y: 42, w: 180, h: 30, fontSize: 18, weight: 700 },
  barcode: { type: 'barcode', name: 'Barcode', content: '1Z999AA10123456784', x: 55, y: 390, w: 250, h: 72, fontSize: 9, weight: 400 },
  qr: { type: 'qr', name: 'QR code', content: 'https://labelary.com', x: 250, y: 250, w: 70, h: 70, fontSize: 9, weight: 400 },
  box: { type: 'box', name: 'Shape', content: '', x: 28, y: 230, w: 304, h: 1, fontSize: 9, weight: 400 }
};

let elements = [
  { ...presets.text, id: 1, name: 'Ship to', content: 'SHIP TO', x: 30, y: 28, w: 140, h: 24, fontSize: 11 },
  { ...presets.text, id: 2, name: 'Recipient', content: 'ALEX MORGAN', x: 30, y: 55, w: 210, h: 28, fontSize: 22 },
  { ...presets.text, id: 3, name: 'Address', content: '1840 W FULTON STREET\nCHICAGO, IL 60612', x: 30, y: 89, w: 220, h: 53, fontSize: 14, weight: 400 },
  { ...presets.qr, id: 4, x: 255, y: 35, w: 74, h: 74 },
  { ...presets.box, id: 5, x: 28, y: 155, w: 304, h: 1 },
  { ...presets.text, id: 6, name: 'Service', content: 'USPS PRIORITY MAIL', x: 30, y: 174, w: 280, h: 30, fontSize: 20 },
  { ...presets.text, id: 7, name: 'Route', content: 'CHI 606', x: 30, y: 212, w: 150, h: 52, fontSize: 38 },
  { ...presets.text, id: 8, name: 'Tracking label', content: 'USPS TRACKING #', x: 30, y: 344, w: 180, h: 20, fontSize: 10 },
  { ...presets.barcode, id: 9, x: 40, y: 375, w: 280, h: 88 }
];

let selectedId = 2;
let zoom = .76;
let dragState = null;

const $ = (id) => document.getElementById(id);
const canvas = $('labelCanvas');
const mini = $('miniLabel');

function selected() { return elements.find((item) => item.id === selectedId); }

function renderElement(item, miniature = false) {
  const node = document.createElement('div');
  node.className = `canvas-element ${item.type}${item.id === selectedId && !miniature ? ' selected' : ''}${item.border ? ' has-border' : ''}`;
  node.dataset.id = item.id;
  const ratio = miniature ? .25 : 1;
  Object.assign(node.style, {
    left: `${item.x * ratio}px`, top: `${item.y * ratio}px`, width: `${item.w * ratio}px`, height: `${item.h * ratio}px`,
    fontSize: `${item.fontSize * ratio}px`, fontWeight: item.weight, borderWidth: miniature ? '.5px' : ''
  });
  if (item.type !== 'qr' && item.type !== 'box') node.textContent = item.content;
  if (!miniature) {
    node.addEventListener('pointerdown', startDrag);
    node.addEventListener('click', (event) => { event.stopPropagation(); selectElement(item.id); });
  }
  return node;
}

function render() {
  canvas.replaceChildren(...elements.map((item) => renderElement(item)));
  mini.replaceChildren(...elements.map((item) => renderElement(item, true)));
  $('layers').replaceChildren(...elements.slice().reverse().map((item) => {
    const button = document.createElement('button');
    button.className = `layer${item.id === selectedId ? ' active' : ''}`;
    button.innerHTML = `${item.type === 'text' ? 'T' : item.type === 'barcode' ? '▥' : item.type === 'qr' ? '▦' : '□'} ${item.name}<span>⌁</span>`;
    button.onclick = () => selectElement(item.id);
    return button;
  }));
  syncProperties();
  syncCode();
}

function selectElement(id) { selectedId = id; render(); }

function syncProperties() {
  const item = selected();
  $('propertiesForm').style.opacity = item ? 1 : .4;
  if (!item) return;
  $('propertyTitle').textContent = item.name;
  $('contentInput').value = item.content;
  $('contentInput').disabled = item.type === 'box';
  $('typographySection').hidden = !['text'].includes(item.type);
  $('fontSize').value = item.fontSize;
  $('fontWeight').value = item.weight;
  $('posX').value = Math.round(item.x);
  $('posY').value = Math.round(item.y);
  $('sizeW').value = Math.round(item.w);
  $('sizeH').value = Math.round(item.h);
  $('borderToggle').checked = Boolean(item.border);
  $('lockToggle').checked = Boolean(item.locked);
}

function zplFor(item) {
  const x = Math.round(item.x * 2.25), y = Math.round(item.y * 2.25);
  if (item.type === 'text') return `^FO${x},${y}^A0N,${Math.round(item.fontSize * 2.25)},${Math.round(item.fontSize * 1.8)}^FD${item.content.replace(/\n/g, '\\&')}^FS`;
  if (item.type === 'barcode') return `^FO${x},${y}^BCN,${Math.round(item.h * 1.8)},Y,N,N^FD${item.content}^FS`;
  if (item.type === 'qr') return `^FO${x},${y}^BQN,2,5^FDLA,${item.content}^FS`;
  return `^FO${x},${y}^GB${Math.round(item.w * 2.25)},${Math.max(2, Math.round(item.h * 2.25))},2^FS`;
}

function generateZpl() { return `^XA\n^PW812\n^LL1218\n${elements.map(zplFor).join('\n')}\n^XZ`; }
function syncCode() { if (document.activeElement !== $('zplEditor')) $('zplEditor').value = generateZpl(); }

function parseZpl(source) {
  const parsed = [];
  const lines = source.split(/\r?\n/);
  lines.forEach((line) => {
    const origin = line.match(/\^FO(\d+),(\d+)/);
    if (!origin) return;
    const x = Number(origin[1]) / 2.25;
    const y = Number(origin[2]) / 2.25;
    const content = line.match(/\^FD(?:LA,)?(.*?)\^FS/)?.[1]?.replace(/\\&/g, '\n') || '';
    const id = parsed.length + 1;
    const font = line.match(/\^A0N,(\d+),(\d+)/);
    const barcode = line.match(/\^BCN,(\d+)/);
    const box = line.match(/\^GB(\d+),(\d+),(\d+)/);
    if (font) {
      const fontSize = Number(font[1]) / 2.25;
      parsed.push({ ...presets.text, id, name: content.slice(0, 18) || 'Text', content, x, y, w: Math.max(80, content.split('\n').reduce((max, row) => Math.max(max, row.length), 0) * fontSize * .62), h: Math.max(20, content.split('\n').length * fontSize * 1.15), fontSize });
    } else if (barcode) {
      parsed.push({ ...presets.barcode, id, content, x, y, w: 280, h: Number(barcode[1]) / 1.8 });
    } else if (line.includes('^BQN')) {
      parsed.push({ ...presets.qr, id, content, x, y });
    } else if (box) {
      parsed.push({ ...presets.box, id, x, y, w: Number(box[1]) / 2.25, h: Math.max(1, Number(box[2]) / 2.25) });
    }
  });
  return parsed;
}

function updateSelected(field, value) {
  const item = selected();
  if (!item) return;
  item[field] = value;
  render();
}

function startDrag(event) {
  const item = elements.find((entry) => entry.id === Number(event.currentTarget.dataset.id));
  if (!item || item.locked) return;
  selectedId = item.id;
  dragState = { item, startX: event.clientX, startY: event.clientY, x: item.x, y: item.y };
  event.currentTarget.setPointerCapture(event.pointerId);
}

window.addEventListener('pointermove', (event) => {
  if (!dragState) return;
  dragState.item.x = Math.max(0, Math.min(360 - dragState.item.w, dragState.x + (event.clientX - dragState.startX) / zoom));
  dragState.item.y = Math.max(0, Math.min(540 - dragState.item.h, dragState.y + (event.clientY - dragState.startY) / zoom));
  render();
});
window.addEventListener('pointerup', () => { dragState = null; });

document.querySelectorAll('.element-card').forEach((button) => {
  button.addEventListener('click', () => addElement(button.dataset.type));
  button.addEventListener('dragstart', (event) => event.dataTransfer.setData('text/label-element', button.dataset.type));
});

function addElement(type, x = 85, y = 250) {
  const id = Math.max(0, ...elements.map((item) => item.id)) + 1;
  elements.push({ ...presets[type], id, x, y });
  selectedId = id;
  render();
}

canvas.addEventListener('dragover', (event) => event.preventDefault());
canvas.addEventListener('drop', (event) => {
  event.preventDefault();
  const type = event.dataTransfer.getData('text/label-element');
  if (!presets[type]) return;
  const rect = canvas.getBoundingClientRect();
  addElement(type, (event.clientX - rect.left) / zoom, (event.clientY - rect.top) / zoom);
});
canvas.addEventListener('click', () => { selectedId = null; render(); });

[['contentInput', 'content', String], ['fontSize', 'fontSize', Number], ['fontWeight', 'weight', Number], ['posX', 'x', Number], ['posY', 'y', Number], ['sizeW', 'w', Number], ['sizeH', 'h', Number]].forEach(([id, field, cast]) => {
  $(id).addEventListener('input', (event) => updateSelected(field, cast(event.target.value)));
});
$('borderToggle').onchange = (event) => updateSelected('border', event.target.checked);
$('lockToggle').onchange = (event) => updateSelected('locked', event.target.checked);
$('deleteButton').onclick = () => { elements = elements.filter((item) => item.id !== selectedId); selectedId = elements[0]?.id; render(); };

document.querySelectorAll('.segmented button').forEach((button) => button.onclick = () => {
  document.querySelectorAll('.segmented button').forEach((item) => item.classList.toggle('active', item === button));
  const isCode = button.dataset.view === 'code';
  $('canvasArea').hidden = isCode;
  $('codeArea').hidden = !isCode;
  if (isCode) syncCode();
});

function setZoom(value) {
  zoom = Math.max(.45, Math.min(1.1, value));
  $('labelWrap').style.transform = `scale(${zoom})`;
  $('zoomLabel').textContent = `${Math.round(zoom * 100)}%`;
}
$('zoomIn').onclick = () => setZoom(zoom + .1);
$('zoomOut').onclick = () => setZoom(zoom - .1);
$('fitButton').onclick = () => setZoom(.76);

$('elementSearch').addEventListener('input', (event) => {
  const query = event.target.value.toLowerCase();
  document.querySelectorAll('.element-card').forEach((card) => card.hidden = !card.textContent.toLowerCase().includes(query));
});

$('copyCode').onclick = async () => {
  await navigator.clipboard.writeText($('zplEditor').value);
  $('copyCode').textContent = 'Copied';
  setTimeout(() => $('copyCode').textContent = 'Copy code', 1200);
};

$('downloadButton').onclick = () => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([generateZpl()], { type: 'text/plain' }));
  link.download = 'shipping-label.zpl';
  link.click();
  URL.revokeObjectURL(link.href);
};
$('printButton').onclick = () => window.print();
$('sizeSelect').onchange = (event) => {
  const sizes = { '4x6': [360, 540], '4x4': [360, 360], '3x2': [360, 240] };
  const [width, height] = sizes[event.target.value];
  canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
  $('labelWrap').style.width = `${width}px`; $('labelWrap').style.height = `${height}px`;
};

$('zplEditor').addEventListener('input', () => {
  const value = $('zplEditor').value.trim();
  const valid = value.startsWith('^XA') && value.endsWith('^XZ');
  $('codeStatus').textContent = valid ? 'Valid ZPL' : 'Check ZPL syntax';
  $('codeStatus').style.color = valid ? '#8fd0a9' : '#f1a58e';
  if (valid) {
    const parsed = parseZpl(value);
    if (parsed.length) {
      elements = parsed;
      selectedId = parsed[0].id;
      render();
    }
  }
});

setZoom(zoom);
render();
