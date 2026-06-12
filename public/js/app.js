const appState = {
  sources: [],
  apiSettings: [],
  results: [],
  selectedSourceId: null,
  builderSourceId: null,
  radiusKm: 10,
  mapMode: null,
  map: null,
  baseLayer: null,
  marker: null,
  radiusCircle: null,
  bandOverlayLayers: new Map(),
  activeBandIds: new Set(),
  mapFormulaName: "",
  overlayOpacity: 0.72,
  overlayIntensity: 1,
  realScene: null,
  realSceneError: "",
  realBandValues: new Map(),
  pin: null
};

const dom = {};
const MAP_WIDTH_STORAGE_KEY = "remoteSensingBandExplorer.mapPaneWidth";
const MAP_TOOLS_MIN_WIDTH = 220;
const SUMMARY_RAIL_WIDTH_STORAGE_KEY = "remoteSensingBandExplorer.summaryRailWidth";
const SUMMARY_RAIL_MIN_WIDTH = 220;
const SUMMARY_RAIL_MAX_WIDTH = 560;
const SELECTED_SOURCE_OPEN_STORAGE_KEY = "remoteSensingBandExplorer.selectedSourceOpen";
const BAND_OVERLAY_COLORS = ["#e63946", "#0077b6", "#f59f00", "#7b2cbf", "#2f9e44", "#d6336c", "#0ca678", "#495057"];
const BAND_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PLANETARY_STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
const PLANETARY_DATA_URL = "https://planetarycomputer.microsoft.com/api/data/v1";
const MAX_REAL_SCENE_CLOUD_COVER_PERCENT = 30;
const REAL_SOURCE_CONFIG = {
  "sentinel-2-msi": {
    collection: "sentinel-2-l2a",
    assetForBand: {
      B1: "B01",
      B2: "B02",
      B3: "B03",
      B4: "B04",
      B5: "B05",
      B6: "B06",
      B7: "B07",
      B8: "B08",
      B8A: "B8A",
      B9: "B09",
      B10: null,
      B11: "B11",
      B12: "B12"
    },
    defaultRescale: "0,6000",
    colormap: "viridis"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  bindDom();
  bindEvents();
  setDefaultDates();
  loadCatalog();
});

function bindDom() {
  dom.tabButtons = Array.from(document.querySelectorAll(".tab-button"));
  dom.tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
  dom.searchForm = document.getElementById("searchForm");
  dom.startDate = document.getElementById("startDate");
  dom.endDate = document.getElementById("endDate");
  dom.studyArea = document.getElementById("studyArea");
  dom.radiusKm = document.getElementById("radiusKm");
  dom.searchState = document.getElementById("searchState");
  dom.validationMessage = document.getElementById("validationMessage");
  dom.sourceResults = document.getElementById("sourceResults");
  dom.resultCount = document.getElementById("resultCount");
  dom.detailsPanel = document.getElementById("detailsPanel");
  dom.builderSource = document.getElementById("builderSource");
  dom.formulaType = document.getElementById("formulaType");
  dom.formulaName = document.getElementById("formulaName");
  dom.formulaExpression = document.getElementById("formulaExpression");
  dom.formulaBands = document.getElementById("formulaBands");
  dom.apiSettings = document.getElementById("apiSettings");
  dom.dashboard = document.querySelector(".dashboard");
  dom.summaryRail = document.querySelector(".summary-rail");
  dom.summaryRailResizeHandle = document.getElementById("summaryRailResizeHandle");
  dom.metricSources = document.getElementById("metricSources");
  dom.metricSelected = document.getElementById("metricSelected");
  dom.metricBands = document.getElementById("metricBands");
  dom.metricRadius = document.getElementById("metricRadius");
  dom.pinStatus = document.getElementById("pinStatus");
  dom.pinReadout = document.getElementById("pinReadout");
  dom.mapRadiusReadout = document.getElementById("mapRadiusReadout");
  dom.mapLayout = document.getElementById("mapLayout");
  dom.mapResizeHandle = document.getElementById("mapResizeHandle");
  dom.mapWidthSlider = document.getElementById("mapWidthSlider");
  dom.baseLayerToggle = document.getElementById("baseLayerToggle");
  dom.loadRealSceneButton = document.getElementById("loadRealSceneButton");
  dom.realSceneStatus = document.getElementById("realSceneStatus");
  dom.realDataNotice = document.getElementById("realDataNotice");
  dom.mapFormulaType = document.getElementById("mapFormulaType");
  dom.mapFormulaName = document.getElementById("mapFormulaName");
  dom.mapFormulaExpression = document.getElementById("mapFormulaExpression");
  dom.mapFormulaBands = document.getElementById("mapFormulaBands");
  dom.overlayOpacitySlider = document.getElementById("overlayOpacitySlider");
  dom.overlayOpacityValue = document.getElementById("overlayOpacityValue");
  dom.overlayIntensitySlider = document.getElementById("overlayIntensitySlider");
  dom.overlayIntensityValue = document.getElementById("overlayIntensityValue");
  dom.bandLayerSourceName = document.getElementById("bandLayerSourceName");
  dom.bandLayerCount = document.getElementById("bandLayerCount");
  dom.selectedSourceToggle = document.getElementById("selectedSourceToggle");
  dom.selectedSourceContent = document.getElementById("selectedSourceContent");
  dom.bandLayerList = document.getElementById("bandLayerList");
  dom.bandValueList = document.getElementById("bandValueList");
}

function bindEvents() {
  dom.tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  dom.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runSourceSearch();
  });

  dom.radiusKm.addEventListener("input", () => {
    const nextRadius = Number(dom.radiusKm.value) || 10;
    appState.radiusKm = Math.max(1, nextRadius);
    updateMetrics();
    updateRadiusCircle();
  });

  dom.builderSource.addEventListener("change", () => {
    appState.builderSourceId = dom.builderSource.value;
    renderFormulaOptions();
  });

  dom.formulaType.addEventListener("change", renderFormulaPreview);
  dom.baseLayerToggle?.addEventListener("change", updateBaseLayerVisibility);
  dom.loadRealSceneButton?.addEventListener("click", loadRealScene);
  dom.mapFormulaType?.addEventListener("change", () => {
    appState.mapFormulaName = dom.mapFormulaType.value;
    applyMapFormulaSelection();
    renderBandLayerControls();
  });
  dom.overlayOpacitySlider?.addEventListener("input", () => {
    appState.overlayOpacity = clamp(Number(dom.overlayOpacitySlider.value) / 100, 0.1, 1);
    updateOverlaySliderReadouts();
    updateBandOverlays();
  });
  dom.overlayIntensitySlider?.addEventListener("input", () => {
    appState.overlayIntensity = clamp(Number(dom.overlayIntensitySlider.value) / 100, 0.5, 1.8);
    updateOverlaySliderReadouts();
    updateBandOverlays();
  });
  window.addEventListener("resize", () => {
    if (dom.dashboard && isSummaryRailResizable()) {
      setSummaryRailWidth(getCurrentSummaryRailWidth(), false);
    }
    if (appState.map) {
      appState.map.invalidateSize();
    }
    updateFallbackPin();
  });
  initSelectedSourceToggle();
  initSummaryRailResizer();
  initMapResizer();
}

async function loadCatalog() {
  try {
    const response = await fetch("data/sources.json");
    if (!response.ok) {
      throw new Error(`Catalog request failed: ${response.status}`);
    }
    const catalog = await response.json();
    appState.sources = catalog.sources || [];
    appState.apiSettings = catalog.apiSettings || [];
    renderBuilderSourceOptions();
    renderApiSettings();
    renderBandLayerControls();
    updateMetrics();
  } catch (error) {
    dom.validationMessage.textContent = "Could not load data/sources.json. Run the app from a local web server.";
    dom.sourceResults.className = "source-grid empty-state";
    dom.sourceResults.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

function setDefaultDates() {
  const today = new Date();
  const prior = new Date(today);
  prior.setDate(prior.getDate() - 30);
  dom.startDate.value = toInputDate(prior);
  dom.endDate.value = toInputDate(today);
}

function runSourceSearch() {
  const start = parseInputDate(dom.startDate.value);
  const end = parseInputDate(dom.endDate.value);
  dom.validationMessage.textContent = "";

  if (!start || !end) {
    dom.validationMessage.textContent = "Start Date and End Date are required.";
    setSearchState("Ready", "neutral");
    return;
  }

  if (end < start) {
    dom.validationMessage.textContent = "End Date cannot be earlier than Start Date.";
    setSearchState("Check dates", "risk");
    return;
  }

  appState.radiusKm = Math.max(1, Number(dom.radiusKm.value) || 10);
  setSearchState("Loading", "good");
  dom.sourceResults.className = "source-grid empty-state";
  dom.sourceResults.innerHTML = "<p>Searching local catalog...</p>";

  window.setTimeout(() => {
    appState.results = appState.sources
      .filter((source) => isAvailableForRange(source, start, end))
      .map((source) => withComputedStatus(source, start, end));

    if (appState.selectedSourceId && !appState.results.some((source) => source.id === appState.selectedSourceId)) {
      appState.selectedSourceId = null;
      appState.activeBandIds.clear();
    }

    setSearchState("Complete", "recommended");
    renderSourceResults();
    renderDetails();
    renderBuilderSourceOptions();
    renderBandLayerControls();
    updateMetrics();
  }, 350);
}

function renderSourceResults() {
  dom.resultCount.textContent = `${appState.results.length} found`;
  if (!appState.results.length) {
    dom.sourceResults.className = "source-grid empty-state";
    dom.sourceResults.innerHTML = "<p>No free sources match that date range in the local catalog.</p>";
    return;
  }

  dom.sourceResults.className = "source-grid";
  dom.sourceResults.innerHTML = appState.results.map(renderSourceCard).join("");
  dom.sourceResults.querySelectorAll("[data-select-source]").forEach((button) => {
    button.addEventListener("click", () => {
      selectSource(button.dataset.selectSource);
      renderDetails();
      renderBuilderSourceOptions();
      renderBandLayerControls();
      updateBandOverlays();
      updateMetrics();
      switchTab("details");
    });
  });
}

function selectSource(sourceId) {
  const sourceChanged = appState.selectedSourceId !== sourceId;
  appState.selectedSourceId = sourceId;

  if (sourceChanged) {
    const source = getSelectedSource();
    appState.realScene = null;
    appState.realSceneError = "";
    appState.realBandValues.clear();
    appState.mapFormulaName = "";
    setDefaultActiveBands(source);
    renderRealSceneStatus();
  }
}

function setDefaultActiveBands(source) {
  appState.activeBandIds.clear();

  if (!source) {
    return;
  }

  source.bands.slice(0, Math.min(4, source.bands.length)).forEach((band) => {
    appState.activeBandIds.add(band.id);
  });
}

function renderSourceCard(source) {
  const bands = source.bands.slice(0, 8).map((band) => `${band.id} ${band.name}`);
  const extraBandCount = Math.max(0, source.bands.length - bands.length);
  const selected = source.id === appState.selectedSourceId ? "Selected" : "Select Source";
  const cloudText = source.cloudIssue ? "Yes" : "No";

  return `
    <article class="source-card">
      <div class="source-card-header">
        <div>
          <h3>${escapeHtml(source.name)}</h3>
          <p>${escapeHtml(source.provider)}</p>
        </div>
        <span class="status-pill ${escapeHtml(source.statusTone)}">${escapeHtml(source.statusBadge)}</span>
      </div>
      <div class="meta-grid">
        ${metaItem("Sensor", source.sensor)}
        ${metaItem("Data type", source.dataType)}
        ${metaItem("Spatial", source.spatialResolution)}
        ${metaItem("Temporal", source.temporalResolution)}
        ${metaItem("Date range", source.availabilityLabel)}
        ${metaItem("Cloud issue", cloudText)}
        ${metaItem("Free access", source.freeAccess ? "Yes" : "No")}
        ${metaItem("Access", source.accessMethod)}
      </div>
      <div>
        <p class="eyebrow">Available Bands</p>
        <div class="chip-list">
          ${bands.map((band) => `<span class="chip">${escapeHtml(band)}</span>`).join("")}
          ${extraBandCount ? `<span class="chip">+${extraBandCount} more</span>` : ""}
        </div>
      </div>
      <div>
        <p class="eyebrow">Recommended Use Cases</p>
        <p>${escapeHtml(source.recommendedUseCases.join(", "))}</p>
      </div>
      <button class="secondary-button" type="button" data-select-source="${escapeHtml(source.id)}">${selected}</button>
    </article>
  `;
}

function renderDetails() {
  const source = getSelectedSource();
  if (!source) {
    dom.detailsPanel.innerHTML = `
      <section class="panel detail-main">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Tab 2</p>
            <h2>Source Details</h2>
          </div>
          <span class="status-pill neutral">No source selected</span>
        </div>
        <p class="empty-copy">Select a source from the search results to preview details.</p>
      </section>
    `;
    return;
  }

  const notice = source.notes
    ? `<div class="notice">${escapeHtml(source.notes)}</div>`
    : "";

  dom.detailsPanel.innerHTML = `
    <section class="panel detail-main">
      <div class="panel-heading">
        <div class="detail-title">
          <p class="eyebrow">Tab 2</p>
          <h2>${escapeHtml(source.name)}</h2>
        </div>
        <span class="status-pill ${escapeHtml(source.statusTone)}">${escapeHtml(source.statusBadge)}</span>
      </div>
      <div class="detail-top">
        <div>
          ${notice}
          <div class="meta-grid">
            ${metaItem("Provider", source.provider)}
            ${metaItem("Sensor", source.sensor)}
            ${metaItem("Data type", source.dataType)}
            ${metaItem("Spatial resolution", source.spatialResolution)}
            ${metaItem("Temporal resolution", source.temporalResolution)}
            ${metaItem("Date availability", source.availabilityLabel)}
            ${metaItem("Cloud issue", source.cloudIssue ? "Yes" : "No")}
            ${metaItem("API / access method", source.accessMethod)}
          </div>
        </div>
        <div>
          <p class="eyebrow">Suggested Indices</p>
          <div class="chip-list">${source.suggestedIndices.map((index) => `<span class="chip">${escapeHtml(index)}</span>`).join("")}</div>
          <p class="eyebrow" style="margin-top:16px">Use Cases</p>
          <div class="chip-list">${source.recommendedUseCases.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("")}</div>
        </div>
      </div>
      <div>
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Bands</p>
            <h2>Available Bands</h2>
          </div>
          <span class="count-chip">${source.bands.length} bands</span>
        </div>
        <div class="detail-band-grid">
          ${source.bands.map(renderBandCard).join("")}
        </div>
      </div>
    </section>
  `;

}

function renderBandCard(band) {
  return `
    <article class="band-card">
      <strong>${escapeHtml(band.id)} ${escapeHtml(band.name)}</strong>
      <span>${escapeHtml(band.wavelength)} | ${escapeHtml(band.resolution)}</span>
      <span>${escapeHtml(band.usage)}</span>
    </article>
  `;
}

function renderBuilderSourceOptions() {
  const sourceList = appState.results.length ? appState.results : appState.sources;
  const options = sourceList
    .map((source) => `<option value="${escapeHtml(source.id)}">${escapeHtml(source.name)}</option>`)
    .join("");
  dom.builderSource.innerHTML = options;

  const availableIds = new Set(sourceList.map((source) => source.id));
  if (appState.selectedSourceId && availableIds.has(appState.selectedSourceId)) {
    appState.builderSourceId = appState.selectedSourceId;
  } else if (!appState.builderSourceId || !availableIds.has(appState.builderSourceId)) {
    appState.builderSourceId = sourceList[0]?.id || null;
  }

  if (appState.builderSourceId) {
    dom.builderSource.value = appState.builderSourceId;
  }

  renderFormulaOptions();
}

function renderFormulaOptions() {
  const source = getBuilderSource();
  const formulas = getFormulasForSource(source);

  if (!source) {
    dom.formulaType.innerHTML = "";
    dom.formulaName.textContent = "No source selected";
    dom.formulaExpression.textContent = "Select a source";
    dom.formulaBands.innerHTML = "";
    return;
  }

  if (!formulas.length) {
    dom.formulaType.innerHTML = `<option value="">No optical formula available</option>`;
    dom.formulaName.textContent = source.name;
    dom.formulaExpression.textContent = source.dataType === "SAR"
      ? "SAR uses radar polarizations such as VV and VH, not optical spectral band formulas."
      : "No starter formula is listed for this source in the local catalog.";
    dom.formulaBands.innerHTML = source.bands.map((band) => `<span class="chip">${escapeHtml(band.id)} ${escapeHtml(band.name)}</span>`).join("");
    return;
  }

  dom.formulaType.innerHTML = formulas
    .map((formula) => `<option value="${escapeHtml(formula.name)}">${escapeHtml(formula.name)}</option>`)
    .join("");
  renderFormulaPreview();
}

function renderFormulaPreview() {
  const source = getBuilderSource();
  const formulas = getFormulasForSource(source);
  const formula = formulas.find((item) => item.name === dom.formulaType.value) || formulas[0];

  if (!formula) {
    return;
  }

  dom.formulaName.textContent = formula.purpose ? `${formula.name} - ${formula.purpose}` : formula.name;
  dom.formulaExpression.textContent = formula.expression;
  dom.formulaBands.innerHTML = renderFormulaDetailChips(formula, "chip");
}

function renderFormulaDetailChips(formula, chipClass) {
  const bandChips = (formula.requiredBands || [])
    .map((band) => `<span class="${chipClass}">${escapeHtml(band)}</span>`);
  const contextChips = [];
  if (formula.threshold) {
    contextChips.push(`<span class="${chipClass} formula-warning-chip">Threshold: ${escapeHtml(formula.threshold)}</span>`);
  }
  if (formula.limitations) {
    contextChips.push(`<span class="${chipClass} formula-warning-chip">Limit: ${escapeHtml(formula.limitations)}</span>`);
  }
  return [...bandChips, ...contextChips].join("");
}

function getFormulasForSource(source) {
  if (!source) {
    return [];
  }

  const formulasByName = new Map();
  (source.formulas || []).forEach((formula) => {
    formulasByName.set(formula.name, formula);
  });
  getCommonFormulasForSource(source).forEach((formula) => {
    formulasByName.set(formula.name, formula);
  });
  return Array.from(formulasByName.values());
}

function getCommonFormulasForSource(source) {
  const findRole = createBandRoleResolver(source);
  const formulas = [];

  const addFormula = (name, purpose, expression, roles) => {
    const bands = roles.map((role) => findRole(role));
    if (bands.every(Boolean)) {
      formulas.push({
        name,
        purpose,
        expression,
        requiredBands: bands.map((band) => `${band.id} ${band.name}`)
      });
    }
  };

  addFormula("True Color", "Natural color composite", "Red, Green, Blue", ["red", "green", "blue"]);
  addFormula("False Color Vegetation", "Vegetation contrast", "NIR, Red, Green", ["nir", "red", "green"]);
  addFormula("NDVI", "Vegetation greenness", "(NIR - Red) / (NIR + Red)", ["nir", "red"]);
  addFormula("NDWI", "Open water contrast", "(Green - NIR) / (Green + NIR)", ["green", "nir"]);
  addFormula("NDMI", "Vegetation moisture", "(NIR - SWIR1) / (NIR + SWIR1)", ["nir", "swir1"]);
  addFormula("NBR", "Burn severity", "(NIR - SWIR2) / (NIR + SWIR2)", ["nir", "swir2"]);
  addFormula("NDSI", "Snow and ice", "(Green - SWIR1) / (Green + SWIR1)", ["green", "swir1"]);
  addFormula("SAVI", "Sparse vegetation", "1.5 * (NIR - Red) / (NIR + Red + 0.5)", ["nir", "red"]);
  addFormula("EVI", "High biomass vegetation", "2.5 * (NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1)", ["nir", "red", "blue"]);
  addFormula("NDRE", "Chlorophyll and red-edge stress", "(NIR - Red Edge) / (NIR + Red Edge)", ["nir", "redEdge"]);
  addFormula("BSI", "Bare soil contrast", "((SWIR1 + Red) - (NIR + Blue)) / ((SWIR1 + Red) + (NIR + Blue))", ["swir1", "red", "nir", "blue"]);
  addFormula("SWIR False Color", "Moisture and burn contrast", "SWIR1, NIR, Red", ["swir1", "nir", "red"]);
  addFormula("VV/VH Ratio", "Radar backscatter ratio", "VV / VH", ["vv", "vh"]);

  return formulas;
}

function createBandRoleResolver(source) {
  const bands = source?.bands || [];
  const byId = (id) => bands.find((band) => normalizeBandText(band.id) === normalizeBandText(id));
  const byName = (...patterns) => bands.find((band) => {
    const name = normalizeBandText(band.name);
    return patterns.every((pattern) => name.includes(normalizeBandText(pattern)));
  });

  return (role) => {
    switch (role) {
      case "blue":
        return byName("blue") || byId("B2") || byId("B3");
      case "green":
        return byName("green") || byId("B3") || byId("B4");
      case "red":
        return bands.find((band) => {
          const name = normalizeBandText(band.name);
          return name.includes("red") && !name.includes("edge");
        }) || byId("B4") || byId("B1");
      case "redEdge":
        return byName("red edge 1") || byName("red edge") || byId("B5");
      case "nir":
        return bands.find((band) => {
          const name = normalizeBandText(band.name);
          return name === "nir" || (name.includes("nir") && !name.includes("narrow"));
        }) || byId("NIR") || byId("B8") || byId("B5") || byId("B2");
      case "swir1":
        return byName("swir 1") || byName("swir1") || byId("SWIR1") || byId("B11") || byId("B6");
      case "swir2":
        return byName("swir 2") || byName("swir2") || byId("SWIR2") || byId("B12") || byId("B7");
      case "vv":
        return byId("VV") || byName("vv");
      case "vh":
        return byId("VH") || byName("vh");
      default:
        return null;
    }
  };
}

function normalizeBandText(value) {
  return String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

function renderMapFormulaControls() {
  if (!dom.mapFormulaType || !dom.mapFormulaName || !dom.mapFormulaExpression || !dom.mapFormulaBands) {
    return;
  }

  const source = getSelectedSource();
  const formulas = getFormulasForSource(source);
  const formulaNames = new Set(formulas.map((formula) => formula.name));

  if (!source || !formulas.length) {
    appState.mapFormulaName = "";
    dom.mapFormulaType.innerHTML = `<option value="">Manual Band layers</option>`;
    dom.mapFormulaType.disabled = !source;
    dom.mapFormulaName.textContent = source ? source.name : "No source selected";
    dom.mapFormulaExpression.textContent = source ? "Manual Band selection" : "Select a source";
    dom.mapFormulaBands.innerHTML = "";
    updateOverlaySliderReadouts();
    return;
  }

  if (appState.mapFormulaName && !formulaNames.has(appState.mapFormulaName)) {
    appState.mapFormulaName = "";
  }

  dom.mapFormulaType.disabled = false;
  dom.mapFormulaType.innerHTML = [
    `<option value="">Manual Band layers</option>`,
    ...formulas.map((formula) => `<option value="${escapeHtml(formula.name)}">${escapeHtml(formula.name)}</option>`)
  ].join("");
  dom.mapFormulaType.value = appState.mapFormulaName;

  const formula = getSelectedMapFormula(source);
  if (!formula) {
    dom.mapFormulaName.textContent = "Manual Band layers";
    dom.mapFormulaExpression.textContent = "Use selected Bands";
    dom.mapFormulaBands.innerHTML = selectedActiveBands(source)
      .map(({ band }) => `<span class="formula-band-chip">${escapeHtml(band.id)} ${escapeHtml(band.name)}</span>`)
      .join("");
    updateOverlaySliderReadouts();
    return;
  }

  dom.mapFormulaName.textContent = formula.purpose ? `${formula.name} - ${formula.purpose}` : formula.name;
  dom.mapFormulaExpression.textContent = formula.expression;
  dom.mapFormulaBands.innerHTML = renderFormulaDetailChips(formula, "formula-band-chip");
  updateOverlaySliderReadouts();
}

function getSelectedMapFormula(source = getSelectedSource()) {
  if (!source || !appState.mapFormulaName) {
    return null;
  }
  return getFormulasForSource(source).find((formula) => formula.name === appState.mapFormulaName) || null;
}

function applyMapFormulaSelection() {
  const source = getSelectedSource();
  const formula = getSelectedMapFormula(source);
  if (!source || !formula) {
    return;
  }

  const bandIds = formulaBandIds(source, formula);
  if (!bandIds.length) {
    return;
  }

  appState.activeBandIds.clear();
  bandIds.forEach((bandId) => appState.activeBandIds.add(bandId));
  updateBandOverlays();
}

function formulaBandIds(source, formula) {
  return (formula?.requiredBands || [])
    .map((requiredBand) => findBandForFormulaRequirement(source, requiredBand))
    .filter(Boolean)
    .map((band) => band.id);
}

function findBandForFormulaRequirement(source, requiredBand) {
  const bands = source?.bands || [];
  const required = String(requiredBand || "");
  const firstToken = required.split(/\s+/)[0];
  const normalizedRequired = normalizeBandText(required);
  const normalizedToken = normalizeBandText(firstToken);

  return bands.find((band) => normalizeBandText(band.id) === normalizedToken)
    || bands.find((band) => normalizedRequired.includes(normalizeBandText(band.id)))
    || bands.find((band) => normalizedRequired.includes(normalizeBandText(band.name)));
}

function updateOverlaySliderReadouts() {
  if (dom.overlayOpacitySlider) {
    const opacityPercent = Math.round(appState.overlayOpacity * 100);
    dom.overlayOpacitySlider.value = String(opacityPercent);
    if (dom.overlayOpacityValue) {
      dom.overlayOpacityValue.textContent = `${opacityPercent}%`;
    }
  }

  if (dom.overlayIntensitySlider) {
    const intensityPercent = Math.round(appState.overlayIntensity * 100);
    dom.overlayIntensitySlider.value = String(intensityPercent);
    if (dom.overlayIntensityValue) {
      dom.overlayIntensityValue.textContent = `${intensityPercent}%`;
    }
  }
}

function renderApiSettings() {
  dom.apiSettings.innerHTML = appState.apiSettings.map((setting) => `
    <article class="settings-card">
      <strong>${escapeHtml(setting.name)}</strong>
      <span>${escapeHtml(setting.status)}</span>
      <span>${escapeHtml(setting.description)}</span>
    </article>
  `).join("");
}

function renderBandLayerControls() {
  const source = getSelectedSource();

  if (!dom.bandLayerList || !dom.bandLayerSourceName || !dom.bandLayerCount) {
    return;
  }

  if (!source) {
    dom.bandLayerSourceName.textContent = "No source selected";
    dom.bandLayerCount.textContent = "0 Bands";
    dom.bandLayerList.innerHTML = '<p class="empty-copy">Select a source first, then turn Bands on or off here.</p>';
    renderMapFormulaControls();
    renderRealSceneStatus();
    renderBandValues();
    updateBandOverlays();
    return;
  }

  if (!appState.activeBandIds.size) {
    setDefaultActiveBands(source);
  }

  dom.bandLayerSourceName.textContent = source.name;
  dom.bandLayerCount.textContent = `${source.bands.length} Bands`;
  renderMapFormulaControls();
  renderRealSceneStatus();
  dom.bandLayerList.innerHTML = source.bands.map((band, index) => {
    const color = bandOverlayColor(index);
    const label = BAND_LABELS[index] || String(index + 1);
    const checked = appState.activeBandIds.has(band.id) ? "checked" : "";
    const realAsset = realAssetForBand(source.id, band.id);
    const supportText = appState.realScene && realAsset
      ? "real tile + point read"
      : realAsset
        ? "real data available after Load real scene"
        : "metadata only";
    return `
      <label class="band-layer-item">
        <input type="checkbox" data-band-id="${escapeHtml(band.id)}" ${checked}>
        <span class="band-letter" style="--band-color:${escapeHtml(color)}">${escapeHtml(label)}</span>
        <span class="band-swatch" style="background:${escapeHtml(color)}"></span>
        <span class="band-layer-text">
          <strong>${escapeHtml(band.id)} ${escapeHtml(band.name)}</strong>
          <small>${escapeHtml(band.resolution)} | ${escapeHtml(supportText)}</small>
        </span>
      </label>
    `;
  }).join("");

  dom.bandLayerList.querySelectorAll("[data-band-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      appState.mapFormulaName = "";
      if (checkbox.checked) {
        appState.activeBandIds.add(checkbox.dataset.bandId);
      } else {
        appState.activeBandIds.delete(checkbox.dataset.bandId);
      }
      renderMapFormulaControls();
      updateBandOverlays();
    });
  });

  renderBandValues();
  updateBandOverlays();
}

function renderRealSceneStatus() {
  const source = getSelectedSource();
  const config = source ? REAL_SOURCE_CONFIG[source.id] : null;

  if (!dom.loadRealSceneButton || !dom.realSceneStatus || !dom.realDataNotice) {
    return;
  }

  dom.loadRealSceneButton.disabled = !config;
  dom.loadRealSceneButton.textContent = config ? "Load real scene" : "Real scene not available for this source";

  if (!source) {
    dom.realDataNotice.textContent = "Select a source first. Real Band loading is currently available for Sentinel-2 MSI.";
    dom.realDataNotice.className = "mock-data-notice";
    setRealSceneStatus("No source selected.", "alert");
    return;
  }

  if (!config) {
    dom.realDataNotice.textContent = `${source.name} is showing catalog metadata only. Real tile support is currently wired for Sentinel-2 MSI.`;
    dom.realDataNotice.className = "mock-data-notice";
    setRealSceneStatus("No real scene endpoint configured for this source yet.", "alert");
    return;
  }

  if (!appState.realScene) {
    dom.realDataNotice.textContent = `Mock preview only until you load a real Sentinel-2 scene with cloud cover < ${MAX_REAL_SCENE_CLOUD_COVER_PERCENT}%.`;
    dom.realDataNotice.className = "mock-data-notice";
    setRealSceneStatus(appState.realSceneError || "No real scene loaded.", appState.realSceneError ? "error" : "neutral");
    return;
  }

  const cloud = appState.realScene.cloudCover == null ? "cloud n/a" : `cloud ${Number(appState.realScene.cloudCover).toFixed(1)}%`;
  dom.realDataNotice.textContent = "Real Sentinel-2 Band tiles are active. Values are read from the public Planetary Computer Data API.";
  dom.realDataNotice.className = "mock-data-notice real-data-active";
  setRealSceneStatus(`${appState.realScene.itemId} | ${formatDateTime(appState.realScene.datetime)} | ${cloud} (required < ${MAX_REAL_SCENE_CLOUD_COVER_PERCENT}%)`, "success");
}

function setRealSceneStatus(message, tone = "neutral") {
  if (!dom.realSceneStatus) {
    return;
  }

  dom.realSceneStatus.textContent = message;
  dom.realSceneStatus.className = `real-scene-status${tone === "neutral" ? "" : ` is-${tone}`}`;
}

function updateBaseLayerVisibility() {
  const showBase = dom.baseLayerToggle?.checked ?? true;

  if (appState.mapMode === "leaflet" && appState.map && appState.baseLayer) {
    if (showBase && !appState.map.hasLayer(appState.baseLayer)) {
      appState.baseLayer.addTo(appState.map);
    } else if (!showBase && appState.map.hasLayer(appState.baseLayer)) {
      appState.map.removeLayer(appState.baseLayer);
    }
  }

  const mapElement = document.getElementById("map");
  mapElement?.classList.toggle("no-base", !showBase);
}

function updateBandOverlays() {
  if (appState.mapMode === "leaflet") {
    updateLeafletBandOverlays();
  } else if (appState.mapMode === "fallback") {
    updateFallbackBandOverlays();
  }
  updateRealBandValues();
}

function clearLeafletBandOverlays() {
  if (!appState.map) {
    return;
  }

  appState.bandOverlayLayers.forEach((layer) => {
    if (appState.map.hasLayer(layer)) {
      appState.map.removeLayer(layer);
    }
  });
  appState.bandOverlayLayers.clear();
}

function updateLeafletBandOverlays() {
  clearLeafletBandOverlays();

  const source = getSelectedSource();
  if (!appState.map || !source || !appState.activeBandIds.size) {
    return;
  }

  const center = overlayCenter();
  const activeBands = selectedActiveBands(source);
  activeBands.forEach(({ band, index }, activeIndex) => {
    const color = bandOverlayColor(index);
    const label = BAND_LABELS[index] || String(index + 1);
    const layer = L.layerGroup();
    const realTileUrl = realTileUrlForBand(source.id, band.id);

    if (realTileUrl) {
      L.tileLayer(realTileUrl, {
        opacity: appState.overlayOpacity,
        maxZoom: 24,
        className: "band-raster-image",
        attribution: "Microsoft Planetary Computer"
      })
        .addTo(layer);
    } else {
      const bounds = bandOverlayBounds(center, activeIndex);
      const imageUrl = createBandRasterDataUrl(band, index, label);

      L.imageOverlay(imageUrl, bounds, {
        opacity: clamp(appState.overlayOpacity * 0.82, 0.1, 0.95),
        className: "band-raster-image",
        interactive: true
      })
        .bindTooltip(`${label}: ${band.id} ${band.name}`)
        .addTo(layer);

      L.rectangle(bounds, {
        color,
        fill: false,
        opacity: clamp(appState.overlayOpacity, 0.18, 1),
        weight: 1.5,
        dashArray: "6 5"
      })
        .addTo(layer);
    }

    layer.addTo(appState.map);
    appState.bandOverlayLayers.set(band.id, layer);
  });
}

function updateFallbackBandOverlays() {
  const container = document.getElementById("fallbackBandOverlays");
  const source = getSelectedSource();
  if (!container) {
    return;
  }

  if (!source || !appState.activeBandIds.size) {
    container.innerHTML = "";
    return;
  }

  const activeBands = selectedActiveBands(source);
  const fallbackX = appState.pin?.x ?? 0.5;
  const fallbackY = appState.pin?.y ?? 0.5;
  container.innerHTML = activeBands.map(({ band, index }, activeIndex) => {
    const color = bandOverlayColor(index);
    const offset = overlayOffset(activeIndex);
    const height = Math.max(70, Math.min(280, appState.radiusKm * 7 + activeIndex * 18));
    const width = Math.round(height * 1.45);
    const left = Math.max(10, Math.min(90, fallbackX * 100 + offset.dx / 950));
    const top = Math.max(10, Math.min(90, fallbackY * 100 + offset.dy / 950));
    const label = BAND_LABELS[index] || String(index + 1);
    return `
      <div
        class="fallback-band-overlay"
        style="--band-color:${escapeHtml(color)}; left:${left}%; top:${top}%; width:${width}px; height:${height}px; opacity:${clamp(appState.overlayOpacity, 0.1, 1).toFixed(2)};"
        title="${escapeHtml(label)}: ${escapeHtml(band.id)} ${escapeHtml(band.name)}"
      >
        <span>${escapeHtml(label)}</span>
        <em>PREVIEW</em>
      </div>
    `;
  }).join("");
}

async function loadRealScene() {
  const source = getSelectedSource();
  const config = source ? REAL_SOURCE_CONFIG[source.id] : null;

  if (!source || !config) {
    renderRealSceneStatus();
    return;
  }

  const center = overlayCenter();
  const datetime = `${dom.startDate.value}/${dom.endDate.value}`;

  dom.loadRealSceneButton.disabled = true;
  dom.loadRealSceneButton.textContent = "Loading real scene...";
  appState.realSceneError = "";
  setRealSceneStatus(`Searching public STAC catalog for cloud cover < ${MAX_REAL_SCENE_CLOUD_COVER_PERCENT}%...`, "loading");

  try {
    const response = await fetch(PLANETARY_STAC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collections: [config.collection],
        intersects: {
          type: "Point",
          coordinates: [center.lng, center.lat]
        },
        datetime,
        query: {
          "eo:cloud_cover": {
            lt: MAX_REAL_SCENE_CLOUD_COVER_PERCENT
          }
        },
        sortby: [
          {
            field: "properties.eo:cloud_cover",
            direction: "asc"
          },
          {
            field: "properties.datetime",
            direction: "desc"
          }
        ],
        limit: 20
      })
    });

    if (!response.ok) {
      throw new Error(`STAC search failed (${response.status})`);
    }

    const payload = await response.json();
    const item = selectBestCloudFilteredScene(payload.features || []);
    if (!item) {
      throw new Error(`No Sentinel-2 scene found with cloud cover < ${MAX_REAL_SCENE_CLOUD_COVER_PERCENT}% for this pin/date range. Try a wider date range or another pin.`);
    }

    appState.realScene = {
      sourceId: source.id,
      collection: item.collection || config.collection,
      itemId: item.id,
      datetime: item.properties?.datetime,
      cloudCover: item.properties?.["eo:cloud_cover"],
      bbox: item.bbox
    };
    appState.realSceneError = "";
    appState.realBandValues.clear();
    renderRealSceneStatus();
    renderBandLayerControls();

    if (appState.map && item.bbox) {
      const bounds = [
        [item.bbox[1], item.bbox[0]],
        [item.bbox[3], item.bbox[2]]
      ];
      appState.map.fitBounds(bounds, { padding: [18, 18] });
    }

    updateBandOverlays();
  } catch (error) {
    appState.realScene = null;
    appState.realSceneError = error.message;
    appState.realBandValues.clear();
    dom.realDataNotice.textContent = "Real scene loading failed. The app is still showing mock/catalog preview layers.";
    dom.realDataNotice.className = "mock-data-notice";
    setRealSceneStatus(error.message, "error");
  } finally {
    renderRealSceneStatus();
  }
}

function selectBestCloudFilteredScene(features) {
  return features
    .filter((feature) => isSceneBelowCloudLimit(feature))
    .sort((a, b) => {
      const cloudDiff = getSceneCloudCover(a) - getSceneCloudCover(b);
      if (cloudDiff !== 0) {
        return cloudDiff;
      }
      return new Date(b.properties?.datetime || 0) - new Date(a.properties?.datetime || 0);
    })[0] || null;
}

function isSceneBelowCloudLimit(feature) {
  const cloudCover = getSceneCloudCover(feature);
  return Number.isFinite(cloudCover) && cloudCover < MAX_REAL_SCENE_CLOUD_COVER_PERCENT;
}

function getSceneCloudCover(feature) {
  return Number(feature?.properties?.["eo:cloud_cover"]);
}

function realTileUrlForBand(sourceId, bandId) {
  if (!appState.realScene || appState.realScene.sourceId !== sourceId) {
    return null;
  }

  const config = REAL_SOURCE_CONFIG[sourceId];
  const asset = realAssetForBand(sourceId, bandId);
  if (!config || !asset) {
    return null;
  }

  const params = new URLSearchParams({
    assets: asset,
    rescale: rescaleForIntensity(config.defaultRescale),
    colormap_name: config.colormap,
    collection: appState.realScene.collection,
    item: appState.realScene.itemId
  });

  return `${PLANETARY_DATA_URL}/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x.png?${params.toString()}`;
}

function rescaleForIntensity(defaultRescale) {
  const [min, max] = String(defaultRescale || "0,6000").split(",").map(Number);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return defaultRescale;
  }

  const adjustedMax = Math.max(min + 1, Math.round(max / appState.overlayIntensity));
  return `${min},${adjustedMax}`;
}

function realPointUrlForBand(sourceId, bandId, pin) {
  if (!appState.realScene || appState.realScene.sourceId !== sourceId || !pin) {
    return null;
  }

  const asset = realAssetForBand(sourceId, bandId);
  if (!asset) {
    return null;
  }

  const params = new URLSearchParams({
    assets: asset,
    collection: appState.realScene.collection,
    item: appState.realScene.itemId
  });

  return `${PLANETARY_DATA_URL}/item/point/${pin.lng},${pin.lat}?${params.toString()}`;
}

function realAssetForBand(sourceId, bandId) {
  const config = REAL_SOURCE_CONFIG[sourceId];
  return config?.assetForBand?.[bandId] || null;
}

async function updateRealBandValues() {
  const source = getSelectedSource();
  if (!source || !appState.realScene || appState.realScene.sourceId !== source.id || !appState.pin) {
    renderBandValues();
    return;
  }

  const activeBands = selectedActiveBands(source).filter(({ band }) => realAssetForBand(source.id, band.id));
  renderBandValues("Reading real Band values...");

  await Promise.all(activeBands.map(async ({ band }) => {
    const url = realPointUrlForBand(source.id, band.id, appState.pin);
    if (!url) {
      return;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      appState.realBandValues.set(band.id, {
        value: payload.values?.[0],
        bandName: payload.band_names?.[0]
      });
    } catch (error) {
      appState.realBandValues.set(band.id, { error: error.message });
    }
  }));

  renderBandValues();
}

function renderBandValues(message = "") {
  if (!dom.bandValueList) {
    return;
  }

  const source = getSelectedSource();
  if (message) {
    dom.bandValueList.innerHTML = `<p class="empty-copy">${escapeHtml(message)}</p>`;
    return;
  }

  if (!source || !appState.realScene) {
    dom.bandValueList.innerHTML = '<p class="empty-copy">Load a real scene and click the map to read Band values.</p>';
    return;
  }

  if (!appState.pin) {
    dom.bandValueList.innerHTML = '<p class="empty-copy">Click the map to set a pin before reading values.</p>';
    return;
  }

  const rows = selectedActiveBands(source)
    .filter(({ band }) => realAssetForBand(source.id, band.id))
    .map(({ band }) => {
      const value = appState.realBandValues.get(band.id);
      const text = value?.error
        ? value.error
        : value
          ? formatNumber(value.value)
          : "pending";
      return `
        <div class="band-value-row">
          <span>${escapeHtml(band.id)}</span>
          <strong>${escapeHtml(text)}</strong>
        </div>
      `;
    });

  dom.bandValueList.innerHTML = rows.length
    ? rows.join("")
    : '<p class="empty-copy">No active real-readable Bands selected.</p>';
}

function selectedActiveBands(source) {
  return source.bands
    .map((band, index) => ({ band, index }))
    .filter(({ band }) => appState.activeBandIds.has(band.id));
}

function overlayCenter() {
  if (appState.pin) {
    return { lat: appState.pin.lat, lng: appState.pin.lng };
  }

  if (appState.map) {
    const center = appState.map.getCenter();
    return { lat: center.lat, lng: center.lng };
  }

  return { lat: 13.7563, lng: 100.5018 };
}

function overlayOffset(index) {
  const offsets = [
    { dx: -1800, dy: 1000 },
    { dx: 1600, dy: -1200 },
    { dx: 1200, dy: 1700 },
    { dx: -1500, dy: -1500 },
    { dx: 0, dy: 0 },
    { dx: 2300, dy: 300 },
    { dx: -2400, dy: -100 },
    { dx: 400, dy: -2300 }
  ];
  return offsets[index % offsets.length];
}

function bandOverlayBounds(center, activeIndex) {
  const offset = overlayOffset(activeIndex);
  const shifted = offsetLatLng(center.lat, center.lng, offset.dx * 0.28, offset.dy * 0.28);
  const halfWidthMeters = Math.max(4500, appState.radiusKm * 1000 * 0.95);
  const halfHeightMeters = Math.max(3200, appState.radiusKm * 1000 * 0.68);
  const southWest = offsetLatLng(shifted.lat, shifted.lng, -halfWidthMeters, -halfHeightMeters);
  const northEast = offsetLatLng(shifted.lat, shifted.lng, halfWidthMeters, halfHeightMeters);
  return [
    [southWest.lat, southWest.lng],
    [northEast.lat, northEast.lng]
  ];
}

function offsetLatLng(lat, lng, dxMeters, dyMeters) {
  const latOffset = dyMeters / 111320;
  const lngOffset = dxMeters / (111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.08));
  return { lat: lat + latOffset, lng: lng + lngOffset };
}

function createBandRasterDataUrl(band, index, label) {
  const color = bandOverlayColor(index);
  const width = 420;
  const height = 280;
  const cell = 28;
  const rects = [];

  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      const hash = hashText(`${band.id}-${index}-${x}-${y}`);
      const opacity = clamp((0.12 + (hash % 55) / 100) * appState.overlayIntensity, 0.08, 0.9);
      const inset = hash % 3 === 0 ? 1 : 0;
      const fill = hash % 11 === 0 ? "#f8faf9" : color;
      rects.push(
        `<rect x="${x + inset}" y="${y + inset}" width="${cell - inset}" height="${cell - inset}" fill="${fill}" opacity="${opacity.toFixed(2)}"/>`
      );
    }
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="#ffffff" opacity="0.08"/>
      ${rects.join("")}
      <path d="M0 40 H420 M0 96 H420 M0 154 H420 M0 218 H420 M70 0 V280 M154 0 V280 M238 0 V280 M336 0 V280" stroke="#17221f" stroke-opacity="0.12" stroke-width="1"/>
      <rect x="14" y="14" width="118" height="42" rx="6" fill="rgba(255,255,255,0.88)"/>
      <text x="28" y="42" fill="${color}" font-size="26" font-family="Arial, sans-serif" font-weight="800">${escapeSvg(label)} ${escapeSvg(band.id)}</text>
      <rect x="14" y="60" width="178" height="28" rx="6" fill="rgba(255,255,255,0.86)"/>
      <text x="26" y="80" fill="#17221f" fill-opacity="0.78" font-size="15" font-family="Arial, sans-serif" font-weight="800">MOCK PREVIEW</text>
      <text x="16" y="264" fill="#17221f" fill-opacity="0.74" font-size="16" font-family="Arial, sans-serif" font-weight="700">${escapeSvg(band.name)} - not satellite data</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function hashText(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function bandOverlayColor(index) {
  return BAND_OVERLAY_COLORS[index % BAND_OVERLAY_COLORS.length];
}

function initMap() {
  const mapElement = document.getElementById("map");
  if (appState.mapMode || !mapElement) {
    return;
  }

  if (!window.L) {
    initFallbackMap(mapElement);
    return;
  }

  appState.mapMode = "leaflet";
  const defaultCenter = [13.7563, 100.5018];
  appState.map = L.map("map", { zoomControl: true }).setView(defaultCenter, 8);
  appState.baseLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(appState.map);

  appState.map.on("click", (event) => {
    setPin(event.latlng.lat, event.latlng.lng);
  });

  updateBaseLayerVisibility();
  updateBandOverlays();
}

function initSelectedSourceToggle() {
  if (!dom.selectedSourceToggle || !dom.selectedSourceContent) {
    return;
  }

  const savedOpen = window.localStorage.getItem(SELECTED_SOURCE_OPEN_STORAGE_KEY);
  setSelectedSourceExpanded(savedOpen === null ? true : savedOpen === "true", false);

  dom.selectedSourceToggle.addEventListener("click", () => {
    const nextExpanded = dom.selectedSourceToggle.getAttribute("aria-expanded") !== "true";
    setSelectedSourceExpanded(nextExpanded);
  });
}

function setSelectedSourceExpanded(expanded, persist = true) {
  if (!dom.selectedSourceToggle || !dom.selectedSourceContent) {
    return;
  }

  dom.selectedSourceContent.hidden = !expanded;
  dom.selectedSourceToggle.setAttribute("aria-expanded", String(expanded));
  dom.selectedSourceToggle.classList.toggle("is-collapsed", !expanded);

  if (persist) {
    window.localStorage.setItem(SELECTED_SOURCE_OPEN_STORAGE_KEY, String(expanded));
  }

  window.requestAnimationFrame(() => {
    if (appState.map) {
      appState.map.invalidateSize();
    }
    updateFallbackPin();
  });
}

function initSummaryRailResizer() {
  if (!dom.dashboard || !dom.summaryRail || !dom.summaryRailResizeHandle) {
    return;
  }

  dom.summaryRailResizeHandle.addEventListener("pointerdown", (event) => {
    if (!isSummaryRailResizable()) {
      return;
    }

    event.preventDefault();
    dom.summaryRailResizeHandle.setPointerCapture?.(event.pointerId);
    dom.dashboard.classList.add("is-resizing-summary");
    document.body.classList.add("is-summary-resizing");

    const resizeFromPointer = (moveEvent) => {
      setSummaryRailWidthFromClientX(moveEvent.clientX);
    };
    const stopResize = () => {
      dom.dashboard.classList.remove("is-resizing-summary");
      document.body.classList.remove("is-summary-resizing");
      window.removeEventListener("pointermove", resizeFromPointer);
    };

    window.addEventListener("pointermove", resizeFromPointer);
    window.addEventListener("pointerup", stopResize, { once: true });
    window.addEventListener("pointercancel", stopResize, { once: true });
    resizeFromPointer(event);
  });

  dom.summaryRailResizeHandle.addEventListener("keydown", (event) => {
    if (!isSummaryRailResizable()) {
      return;
    }

    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) {
      return;
    }

    event.preventDefault();
    const limits = getSummaryRailWidthLimits();
    const currentWidth = getCurrentSummaryRailWidth();
    if (event.key === "Home") {
      setSummaryRailWidth(limits.min);
    } else if (event.key === "End") {
      setSummaryRailWidth(limits.max);
    } else {
      const direction = event.key === "ArrowRight" ? 1 : -1;
      setSummaryRailWidth(currentWidth + direction * 32);
    }
  });

  applySavedSummaryRailWidth();
}

function applySavedSummaryRailWidth() {
  if (!dom.dashboard || !isSummaryRailResizable()) {
    return;
  }

  const savedWidth = Number(window.localStorage.getItem(SUMMARY_RAIL_WIDTH_STORAGE_KEY));
  if (Number.isFinite(savedWidth) && savedWidth > 0) {
    setSummaryRailWidth(savedWidth, false);
  }
}

function isSummaryRailResizable() {
  return window.matchMedia("(min-width: 1101px)").matches;
}

function getSummaryRailWidthLimits() {
  if (!dom.dashboard) {
    return { min: SUMMARY_RAIL_MIN_WIDTH, max: SUMMARY_RAIL_MAX_WIDTH };
  }

  const dashboardRect = dom.dashboard.getBoundingClientRect();
  const maxFromWorkspace = Math.max(SUMMARY_RAIL_MIN_WIDTH, dashboardRect.width - 620);
  const max = Math.min(SUMMARY_RAIL_MAX_WIDTH, maxFromWorkspace);
  return { min: SUMMARY_RAIL_MIN_WIDTH, max };
}

function getCurrentSummaryRailWidth() {
  return dom.summaryRail?.getBoundingClientRect().width || getSummaryRailWidthLimits().min;
}

function setSummaryRailWidthFromClientX(clientX) {
  const dashboardRect = dom.dashboard.getBoundingClientRect();
  setSummaryRailWidth(clientX - dashboardRect.left);
}

function setSummaryRailWidth(width, persist = true) {
  const limits = getSummaryRailWidthLimits();
  const nextWidth = Math.round(Math.max(limits.min, Math.min(width, limits.max)));
  dom.dashboard.style.setProperty("--summary-rail-width", `${nextWidth}px`);

  if (persist) {
    window.localStorage.setItem(SUMMARY_RAIL_WIDTH_STORAGE_KEY, String(nextWidth));
  }

  window.requestAnimationFrame(() => {
    if (appState.map) {
      appState.map.invalidateSize();
    }
    updateFallbackPin();
  });
}

function initMapResizer() {
  if (!dom.mapLayout || !dom.mapResizeHandle) {
    return;
  }

  dom.mapResizeHandle.addEventListener("pointerdown", (event) => {
    if (!isMapResizable()) {
      return;
    }

    event.preventDefault();
    dom.mapResizeHandle.setPointerCapture?.(event.pointerId);
    dom.mapLayout.classList.add("is-resizing");
    document.body.classList.add("is-map-resizing");

    const resizeFromPointer = (moveEvent) => {
      setMapPaneWidthFromClientX(moveEvent.clientX);
    };
    const stopResize = () => {
      dom.mapLayout.classList.remove("is-resizing");
      document.body.classList.remove("is-map-resizing");
      window.removeEventListener("pointermove", resizeFromPointer);
    };

    window.addEventListener("pointermove", resizeFromPointer);
    window.addEventListener("pointerup", stopResize, { once: true });
    window.addEventListener("pointercancel", stopResize, { once: true });
    resizeFromPointer(event);
  });

  dom.mapResizeHandle.addEventListener("keydown", (event) => {
    if (!isMapResizable()) {
      return;
    }

    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) {
      return;
    }

    event.preventDefault();
    const limits = getMapWidthLimits();
    const currentWidth = getCurrentMapPaneWidth();
    if (event.key === "Home") {
      setMapPaneWidth(limits.min);
    } else if (event.key === "End") {
      setMapPaneWidth(limits.max);
    } else {
      const direction = event.key === "ArrowRight" ? 1 : -1;
      setMapPaneWidth(currentWidth + direction * 40);
    }
  });
}

function applySavedMapPaneWidth() {
  if (!dom.mapLayout || !isMapResizable()) {
    return;
  }

  const savedWidth = Number(window.localStorage.getItem(MAP_WIDTH_STORAGE_KEY));
  if (Number.isFinite(savedWidth) && savedWidth > 0) {
    setMapPaneWidth(savedWidth, false);
  }
}

function isMapResizable() {
  return window.matchMedia("(min-width: 721px)").matches;
}

function getMapWidthLimits() {
  if (window.matchMedia("(max-width: 720px)").matches) {
    return { min: 280, max: 1100 };
  }

  const layoutRect = dom.mapLayout.getBoundingClientRect();
  const handleWidth = dom.mapResizeHandle.getBoundingClientRect().width || 14;
  const min = Math.min(520, Math.max(320, layoutRect.width * 0.3));
  const max = Math.max(min, layoutRect.width - handleWidth - MAP_TOOLS_MIN_WIDTH);
  return { min, max };
}

function getCurrentMapPaneWidth() {
  const mapPanel = dom.mapLayout.querySelector(".map-panel");
  return mapPanel?.getBoundingClientRect().width || getMapWidthLimits().min;
}

function setMapPaneWidthFromClientX(clientX) {
  const layoutRect = dom.mapLayout.getBoundingClientRect();
  setMapPaneWidth(clientX - layoutRect.left);
}

function setMapPaneWidth(width, persist = true) {
  const limits = getMapWidthLimits();
  const nextWidth = Math.round(Math.max(limits.min, Math.min(width, limits.max)));
  dom.mapLayout.style.setProperty("--map-pane-width", `${nextWidth}px`);
  updateMapWidthControl(nextWidth, limits);

  if (persist) {
    window.localStorage.setItem(MAP_WIDTH_STORAGE_KEY, String(nextWidth));
  }

  window.requestAnimationFrame(() => {
    if (appState.map) {
      appState.map.invalidateSize();
    }
    updateFallbackPin();
  });
}

function updateMapWidthControl(width = getCurrentMapPaneWidth(), limits = getMapWidthLimits()) {
  if (!dom.mapWidthSlider) {
    return;
  }

  dom.mapWidthSlider.min = String(Math.round(limits.min));
  dom.mapWidthSlider.max = String(Math.round(limits.max));
  dom.mapWidthSlider.value = String(Math.round(Math.max(limits.min, Math.min(width, limits.max))));
}

function initFallbackMap(mapElement) {
  appState.mapMode = "fallback";
  mapElement.classList.add("fallback-map");
  mapElement.innerHTML = `
    <div class="fallback-grid"></div>
    <div id="fallbackBandOverlays" class="fallback-band-overlays"></div>
    <div id="fallbackRadius" class="fallback-radius"></div>
    <div id="fallbackMarker" class="fallback-marker"></div>
    <div class="fallback-label">Local preview map</div>
  `;
  mapElement.addEventListener("click", (event) => {
    const rect = mapElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const lat = 20.8 - y * 14.4;
    const lng = 96.0 + x * 10.5;
    setPin(lat, lng, { x, y });
  });
  updateBaseLayerVisibility();
  updateBandOverlays();
}

function setPin(lat, lng, fallbackPosition = null) {
  appState.pin = { lat, lng, ...fallbackPosition };

  if (appState.mapMode === "fallback") {
    updateFallbackPin();
    updateBandOverlays();
    updatePinReadout();
    return;
  }

  if (appState.marker) {
    appState.marker.setLatLng([lat, lng]);
  } else {
    appState.marker = L.marker([lat, lng]).addTo(appState.map);
  }

  updateRadiusCircle();
  updatePinReadout();
}

function updateRadiusCircle() {
  appState.radiusKm = Math.max(1, Number(dom.radiusKm.value) || appState.radiusKm || 10);
  dom.metricRadius.textContent = `${appState.radiusKm} km`;
  dom.mapRadiusReadout.textContent = `${appState.radiusKm} km`;

  if (appState.mapMode === "fallback") {
    updateFallbackPin();
    updateBandOverlays();
    return;
  }

  if (!appState.map || !appState.pin) {
    return;
  }

  const latLng = [appState.pin.lat, appState.pin.lng];
  const radiusMeters = appState.radiusKm * 1000;

  if (appState.radiusCircle) {
    appState.radiusCircle.setLatLng(latLng);
    appState.radiusCircle.setRadius(radiusMeters);
  } else {
    appState.radiusCircle = L.circle(latLng, {
      radius: radiusMeters,
      color: "#139c6f",
      weight: 2,
      fillColor: "#139c6f",
      fillOpacity: 0.12
    }).addTo(appState.map);
  }
  updateBandOverlays();
}

function updateFallbackPin() {
  if (appState.mapMode !== "fallback" || !appState.pin) {
    return;
  }

  const marker = document.getElementById("fallbackMarker");
  const circle = document.getElementById("fallbackRadius");
  if (!marker || !circle) {
    return;
  }

  const x = appState.pin.x ?? 0.5;
  const y = appState.pin.y ?? 0.5;
  const size = Math.max(34, Math.min(260, appState.radiusKm * 5.5));
  marker.style.left = `${x * 100}%`;
  marker.style.top = `${y * 100}%`;
  circle.style.left = `${x * 100}%`;
  circle.style.top = `${y * 100}%`;
  circle.style.width = `${size}px`;
  circle.style.height = `${size}px`;
}

function updatePinReadout() {
  if (!appState.pin) {
    dom.pinStatus.textContent = "No pin";
    dom.pinReadout.textContent = "None";
    return;
  }

  const label = `${appState.pin.lat.toFixed(5)}, ${appState.pin.lng.toFixed(5)}`;
  dom.pinStatus.textContent = "Pin set";
  dom.pinReadout.textContent = label;
}

function updateMetrics() {
  const selected = getSelectedSource();
  dom.metricSources.textContent = String(appState.results.length || 0);
  dom.metricSelected.textContent = selected ? selected.name : "None";
  dom.metricBands.textContent = selected ? String(selected.bands.length) : "0";
  dom.metricRadius.textContent = `${appState.radiusKm} km`;
  dom.mapRadiusReadout.textContent = `${appState.radiusKm} km`;
}

function switchTab(tabName) {
  dom.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  dom.tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });

  if (tabName === "map") {
    initMap();
    window.setTimeout(() => {
      if (appState.map) {
        appState.map.invalidateSize();
      }
    }, 80);
  }
}

function setSearchState(text, tone) {
  dom.searchState.textContent = text;
  dom.searchState.className = `status-pill ${tone}`;
}

function getSelectedSource() {
  if (!appState.selectedSourceId) {
    return null;
  }
  return appState.sources.find((source) => source.id === appState.selectedSourceId) || null;
}

function getBuilderSource() {
  if (!appState.builderSourceId) {
    return null;
  }
  return appState.sources.find((source) => source.id === appState.builderSourceId) || null;
}

function isAvailableForRange(source, start, end) {
  const sourceStart = parseInputDate(source.availabilityStart);
  const sourceEnd = source.availabilityEnd ? parseInputDate(source.availabilityEnd) : new Date("2999-12-31");
  return sourceStart <= end && sourceEnd >= start && source.freeAccess;
}

function withComputedStatus(source, start, end) {
  const copy = { ...source };
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);

  if (copy.cloudIssue && days <= 7 && copy.statusBadge !== "Limited") {
    copy.statusBadge = "Cloud risk";
    copy.statusTone = "risk";
  }

  return copy;
}

function metaItem(label, value) {
  return `
    <div class="meta-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value || "n/a"))}</strong>
    </div>
  `;
}

function parseInputDate(value) {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value) {
  if (!value) {
    return "date n/a";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "no data";
  }

  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeSvg(value) {
  return escapeHtml(value);
}
