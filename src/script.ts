interface PokemonEntry {
  pokemon_id: number;
  form: string;
  form_name: string;
  species_name: string;
  icon_url: string;
  latitude: number;
  longitude: number;
  [key: string]: unknown;
}

interface RenderableEntry extends PokemonEntry {
  _id: number;
  distanceKm: number | null;
}

interface PayloadStateEntry {
  id: string;
  value: unknown;
}

interface PayloadInputEntry {
  id: string;
  value: unknown;
}

interface DashPayload {
  state: PayloadStateEntry[];
  inputs: PayloadInputEntry[];
  [key: string]: unknown;
}

interface UserPosition {
  latitude: number;
  longitude: number;
}

const TARGET_URL = '/api/proxy';
const MAX_TILES = 500;

const state = {
  lvLo: 1, lvHi: 35,
  posting: false,
  selectedId: null as number | null,
  copied: false,
  entries: [] as RenderableEntry[],       // last response, each with an added _id and distanceKm
  userPosition: null as UserPosition | null,
  iv100Keys: new Set<string>()  // "pokemon_id:form" keys from the live grouped table's iv100 bucket
};

function iv100Key(entry: PokemonEntry): string {
  return `${entry.pokemon_id}:${entry.form}`;
}

async function loadPayload(): Promise<DashPayload> {
  const res = await fetch('payload.json');
  return res.json();
}

function todayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentPosition(): Promise<UserPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      err => reject(err)
    );
  });
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km: number | null | undefined): string {
  if (km == null) return '—';
  return km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km';
}

function applyPayloadOverrides(payload: DashPayload): DashPayload {
  const area = (document.getElementById('area-selector') as HTMLSelectElement).value;
  const today = todayString();

  for (const entry of payload.state) {
    if (entry.id === 'iv-slider') entry.value = [100, 100];
    if (entry.id === 'level-slider') entry.value = [state.lvLo, state.lvHi];
    if (entry.id === 'historical-date-picker') entry.value = today;
    if (entry.id === 'area-selector') entry.value = area;
  }

  return payload;
}

// same callback, different source/mode: live data grouped by pokemon+form,
// used only to pull the iv100 bucket for highlighting
function buildLiveGroupedPayload(payload: DashPayload): DashPayload {
  const grouped: DashPayload = JSON.parse(JSON.stringify(payload));

  for (const input of grouped.inputs) {
    if (input.id === 'combined-source-store') input.value = 'live';
  }
  for (const entry of grouped.state) {
    if (entry.id === 'mode-selector') entry.value = 'grouped';
  }

  return grouped;
}

// ---- range sliders (IV / Level) ----

function setupRangePair(
  minId: string, maxId: string, labelId: string, fillId: string,
  stateLoKey: 'lvLo', stateHiKey: 'lvHi', min: number, max: number, suffix: string
): void {
  const minInput = document.getElementById(minId) as HTMLInputElement;
  const maxInput = document.getElementById(maxId) as HTMLInputElement;
  const label = document.getElementById(labelId) as HTMLElement;
  const fill = document.getElementById(fillId) as HTMLElement;

  function update(): void {
    let lo = Number(minInput.value);
    let hi = Number(maxInput.value);
    if (lo > hi) {
      [minInput.value, maxInput.value] = [maxInput.value, minInput.value];
      lo = Number(minInput.value);
      hi = Number(maxInput.value);
    }
    state[stateLoKey] = lo;
    state[stateHiKey] = hi;

    label.textContent = `${lo} – ${hi}${suffix}`;
    const span = max - min;
    const fillLeft = ((lo - min) / span) * 100;
    const fillRight = 100 - ((hi - min) / span) * 100;
    fill.style.left = fillLeft + '%';
    fill.style.right = fillRight + '%';
  }

  minInput.addEventListener('input', update);
  maxInput.addEventListener('input', update);
  update();
}

setupRangePair('level-min', 'level-max', 'level-range-label', 'level-range-fill', 'lvLo', 'lvHi', 1, 35, '');

// ---- selection ----

function selectEntry(id: number): void {
  state.selectedId = id;
  state.copied = false;
  render();
}

function clearSelection(): void {
  state.selectedId = null;
  render();
}

document.getElementById('detail-close-btn')!.addEventListener('click', clearSelection);

document.getElementById('copy-coords-btn')!.addEventListener('click', () => {
  const entry = state.entries.find(e => e._id === state.selectedId);
  if (!entry) return;
  const coords = `${entry.latitude.toFixed(6)},${entry.longitude.toFixed(6)}`;
  navigator.clipboard.writeText(coords).then(() => {
    state.copied = true;
    render();
  });
});

// ---- map ----

const map = L.map('map-canvas', { zoomControl: true, attributionControl: false })
  .setView([41.15, -8.61], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  subdomains: 'abc',
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
let userMarker: L.Marker | null = null;
let mapNeedsFit = false;

window.addEventListener('resize', () => map.invalidateSize());
map.on('zoomend', () => renderMap(visibleEntries()));

// sprite size shrinks as you zoom out, grows as you zoom in
function spriteSizeForZoom(zoom: number): number {
  const size = 14 * Math.pow(1.28, zoom - 13);
  return Math.round(Math.max(8, Math.min(28, size)));
}

function renderMap(entries: RenderableEntry[]): void {
  markersLayer.clearLayers();

  const baseSize = spriteSizeForZoom(map.getZoom());

  for (const entry of entries) {
    const isMatch = state.iv100Keys.has(iv100Key(entry));
    const isSelected = entry._id === state.selectedId;
    const size = isSelected ? Math.round(baseSize * 1.4) : baseSize;

    const icon = L.divIcon({
      className: `gible-sprite-icon${isSelected ? ' selected' : ''}`,
      html: `<img src="${entry.icon_url}" alt="" onerror="this.classList.add('load-failed')">`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });

    const marker = L.marker([entry.latitude, entry.longitude], { icon });

    marker.bindPopup(
      `<b>${entry.species_name}</b> (${entry.form_name})<br>${fmtDist(entry.distanceKm)} away${isMatch ? '<br><b style="color:#e0b84c">Likely 100% IV</b>' : ''}`
    );
    marker.on('click', () => selectEntry(entry._id));
    marker.addTo(markersLayer);
  }

  if (state.userPosition) {
    const icon = L.divIcon({ className: 'gible-user-dot', iconSize: [14, 14] });
    if (!userMarker) {
      userMarker = L.marker([state.userPosition.latitude, state.userPosition.longitude], { icon, zIndexOffset: 1000 }).addTo(map);
    } else {
      userMarker.setLatLng([state.userPosition.latitude, state.userPosition.longitude]);
    }
  }

  if (mapNeedsFit && entries.length > 0) {
    const points: L.LatLngExpression[] = entries.map(e => [e.latitude, e.longitude]);
    if (state.userPosition) points.push([state.userPosition.latitude, state.userPosition.longitude]);
    map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 16 });
    mapNeedsFit = false;
  }
}

// ---- rendering ----

function visibleEntries(): RenderableEntry[] {
  const sorted = [...state.entries];
  sorted.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return sorted;
}

function render(): void {
  const entries = visibleEntries();

  // map
  (document.getElementById('map-empty-overlay') as HTMLElement).hidden = state.entries.length > 0;
  renderMap(entries);

  // results header
  const shownCount = Math.min(entries.length, MAX_TILES);
  document.getElementById('results-count-label')!.textContent =
    entries.length > MAX_TILES
      ? `${state.entries.length} Pokémon (showing ${shownCount})`
      : `${state.entries.length} Pokémon`;

  // results grid (capped to MAX_TILES so huge responses don't freeze the page)
  const grid = document.getElementById('results-grid')!;
  grid.innerHTML = '';
  for (const entry of entries.slice(0, MAX_TILES)) {
    const tile = document.createElement('button');
    tile.className = 'result-tile';
    tile.title = `${entry.species_name} (${entry.form_name}) · #${entry.pokemon_id}`;
    if (entry._id === state.selectedId) tile.classList.add('selected');
    if (state.iv100Keys.has(iv100Key(entry))) tile.classList.add('iv100-match');
    tile.addEventListener('click', () => selectEntry(entry._id));

    const img = document.createElement('img');
    img.src = entry.icon_url;
    img.alt = entry.species_name || '';
    tile.appendChild(img);

    const distBadge = document.createElement('span');
    distBadge.className = 'result-tile-dist mono';
    distBadge.textContent = entry.distanceKm != null ? fmtDist(entry.distanceKm) : '';
    tile.appendChild(distBadge);

    grid.appendChild(tile);
  }

  // detail panel
  const detailPanel = document.getElementById('detail-panel') as HTMLElement;
  const selected = state.entries.find(e => e._id === state.selectedId);
  detailPanel.hidden = !selected;
  if (selected) {
    (document.getElementById('detail-sprite') as HTMLImageElement).src = selected.icon_url;
    document.getElementById('detail-name')!.textContent = selected.species_name;
    document.getElementById('detail-form-pill')!.textContent = selected.form_name;
    document.getElementById('detail-panel')!.classList.toggle('iv100-match', state.iv100Keys.has(iv100Key(selected)));
    document.getElementById('detail-meta-line')!.textContent =
      `#${String(selected.pokemon_id).padStart(3, '0')} · ${fmtDist(selected.distanceKm)} away`;
    document.getElementById('detail-coords-value')!.textContent =
      `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`;
    document.getElementById('copy-coords-btn')!.textContent = state.copied ? 'copied ✓' : 'copy coordinates';
  }
}

// ---- send POST ----

const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;

sendBtn.addEventListener('click', async () => {
  state.posting = true;
  sendBtn.disabled = true;
  sendBtn.textContent = 'Searching…';
  state.selectedId = null;

  try {
    state.userPosition = await getCurrentPosition().catch(() => null);

    const payload = applyPayloadOverrides(await loadPayload());
    const groupedPayload = buildLiveGroupedPayload(payload);

    const [res, groupedRes] = await Promise.all([
      fetch(TARGET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }),
      fetch(TARGET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupedPayload)
      }).catch(() => null)
    ]);

    const text = await res.text();

    let entries: PokemonEntry[] = [];
    try {
      const parsed = JSON.parse(text);
      const rawEntries = parsed?.response?.['heatmap-data-store']?.data;
      if (Array.isArray(rawEntries)) entries = rawEntries;
    } catch (_) {
      // non-JSON response, leave entries empty
    }

    state.iv100Keys = new Set();
    if (groupedRes) {
      try {
        const groupedParsed = JSON.parse(await groupedRes.text());
        const iv100 = groupedParsed?.response?.['raw-data-store']?.data?.iv100;
        if (iv100) state.iv100Keys = new Set(Object.keys(iv100));
      } catch (_) {
        // non-JSON or missing data, leave iv100Keys empty
      }
    }

    state.entries = entries.map((entry, index) => ({
      ...entry,
      _id: index,
      distanceKm: state.userPosition
        ? distanceKm(state.userPosition.latitude, state.userPosition.longitude, entry.latitude, entry.longitude)
        : null
    }));
    mapNeedsFit = true;
  } catch (err) {
    state.entries = [];
    state.iv100Keys = new Set();
  } finally {
    state.posting = false;
    sendBtn.disabled = false;
    sendBtn.textContent = 'Search';
    render();
  }
});

render();
