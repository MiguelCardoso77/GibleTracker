const TARGET_URL = '/api/proxy';
const MAX_TILES = 500;

const state = {
  lvLo: 1, lvHi: 35,
  posting: false,
  selectedId: null,
  copied: false,
  entries: [],       // last response, each with an added _id and distanceKm
  userPosition: null,
  iv100Keys: new Set()  // "pokemon_id:form" keys from the live grouped table's iv100 bucket
};

function iv100Key(entry) {
  return `${entry.pokemon_id}:${entry.form}`;
}

async function loadPayload() {
  const res = await fetch('payload.json');
  return res.json();
}

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentPosition() {
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

function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km) {
  if (km == null) return '—';
  return km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km';
}

function applyPayloadOverrides(payload) {
  const area = document.getElementById('area-selector').value;
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
function buildLiveGroupedPayload(payload) {
  const grouped = JSON.parse(JSON.stringify(payload));

  for (const input of grouped.inputs) {
    if (input.id === 'combined-source-store') input.value = 'live';
  }
  for (const entry of grouped.state) {
    if (entry.id === 'mode-selector') entry.value = 'grouped';
  }

  return grouped;
}

// ---- range sliders (IV / Level) ----

function setupRangePair(minId, maxId, labelId, fillId, stateLoKey, stateHiKey, min, max, suffix) {
  const minInput = document.getElementById(minId);
  const maxInput = document.getElementById(maxId);
  const label = document.getElementById(labelId);
  const fill = document.getElementById(fillId);

  function update() {
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

function selectEntry(id) {
  state.selectedId = id;
  state.copied = false;
  render();
}

function clearSelection() {
  state.selectedId = null;
  render();
}

document.getElementById('detail-close-btn').addEventListener('click', clearSelection);

document.getElementById('copy-coords-btn').addEventListener('click', () => {
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
let userMarker = null;
let mapNeedsFit = false;

window.addEventListener('resize', () => map.invalidateSize());
map.on('zoomend', () => renderMap(visibleEntries()));

// sprite size shrinks as you zoom out, grows as you zoom in
function spriteSizeForZoom(zoom) {
  const size = 14 * Math.pow(1.28, zoom - 13);
  return Math.round(Math.max(8, Math.min(28, size)));
}

function renderMap(entries) {
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
    const points = entries.map(e => [e.latitude, e.longitude]);
    if (state.userPosition) points.push([state.userPosition.latitude, state.userPosition.longitude]);
    map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 16 });
    mapNeedsFit = false;
  }
}

// ---- rendering ----

function visibleEntries() {
  const sorted = [...state.entries];
  sorted.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return sorted;
}

function render() {
  const entries = visibleEntries();

  // map
  document.getElementById('map-empty-overlay').hidden = state.entries.length > 0;
  renderMap(entries);

  // results header
  const shownCount = Math.min(entries.length, MAX_TILES);
  document.getElementById('results-count-label').textContent =
    entries.length > MAX_TILES
      ? `${state.entries.length} Pokémon (showing ${shownCount})`
      : `${state.entries.length} Pokémon`;

  // results grid (capped to MAX_TILES so huge responses don't freeze the page)
  const grid = document.getElementById('results-grid');
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
  const detailPanel = document.getElementById('detail-panel');
  const selected = state.entries.find(e => e._id === state.selectedId);
  detailPanel.hidden = !selected;
  if (selected) {
    document.getElementById('detail-sprite').src = selected.icon_url;
    document.getElementById('detail-name').textContent = selected.species_name;
    document.getElementById('detail-form-pill').textContent = selected.form_name;
    document.getElementById('detail-panel').classList.toggle('iv100-match', state.iv100Keys.has(iv100Key(selected)));
    document.getElementById('detail-meta-line').textContent =
      `#${String(selected.pokemon_id).padStart(3, '0')} · ${fmtDist(selected.distanceKm)} away`;
    document.getElementById('detail-coords-value').textContent =
      `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`;
    document.getElementById('copy-coords-btn').textContent = state.copied ? 'copied ✓' : 'copy coordinates';
  }
}

// ---- send POST ----

const sendBtn = document.getElementById('send-btn');

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

    let entries = [];
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
