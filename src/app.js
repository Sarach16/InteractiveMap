import './styles.css';
// Import Cesium directly - vite-plugin-cesium will handle it
import * as Cesium from 'cesium';
import Papa from 'papaparse';

// Extract needed components from Cesium
const {
  Viewer,
  Ion,
  IonImageryProvider,
  Cartesian3,
  Math: CesiumMath,
  HeadingPitchRange,
  createGooglePhotorealistic3DTileset,
  ShadowMode,
  Color,
  Terrain,
  createOsmBuildingsAsync,
  GeoJsonDataSource,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  PolygonGraphics,
  ColorMaterialProperty
} = Cesium;

// !!Remove before Deployment Set the Cesium Ion access token
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ACCESS_TOKEN;
console.log("Cesium is working!");

// Grossmont College center
const CAMPUS_CENTER = {
  longitude: -117.00622799937369,
  latitude: 32.813321272923574,
  altitude: 500
};

// Get loading overlay element
const loadingOverlay = document.getElementById('loadingOverlay');

// Initialize the Cesium viewer
try {
  console.log("Initializing terrain...");
  // Try different approaches to get the terrain provider working
  let terrainProvider;
  try {
    console.log("Attempting to create terrain with WorldTerrain.fromUrl");
    terrainProvider = Cesium.createWorldTerrain();
    console.log("Terrain created with createWorldTerrain");
  } catch (terrainError) {
    console.error("First terrain approach failed:", terrainError);
    try {
      console.log("Attempting to create terrain with Cesium World Terrain asset ID");
      terrainProvider = new Cesium.CesiumTerrainProvider({
        url: Cesium.IonResource.fromAssetId(1)
      });
      console.log("Terrain created with CesiumTerrainProvider");
    } catch (terrainError2) {
      console.error("Second terrain approach failed:", terrainError2);
      // Fall back to EllipsoidTerrainProvider
      console.log("Falling back to EllipsoidTerrainProvider");
      terrainProvider = new Cesium.EllipsoidTerrainProvider();
    }
  }
  
  const viewer = new Viewer('cesiumContainer', {
    imageryProvider: new IonImageryProvider({ assetId: 2 }),
    terrainProvider: terrainProvider,
    baseLayerPicker: false,
    geocoder: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    homeButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    vrButton: false,
    selectionIndicator: false,
    infoBox: true,
    shadows: false,
    terrainShadows: ShadowMode.DISABLED,
    requestRenderMode: true, // Only render when needed
    maximumRenderTimeChange: 1000, // Limit render time
    targetFrameRate: 30 // Target 30 FPS
  });
  
  // Make viewer globally available for other functions
  window.viewer = viewer;
  
  console.log("Viewer initialized");

  // Disable shadow effects for all primitives in the scene
  viewer.scene.globe.shadows = ShadowMode.DISABLED;
  viewer.scene.shadowMap.enabled = false;

  // Disable default click behavior for 3D Tiles
  viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
  viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
} catch (error) {
  console.error("Error initializing viewer:", error);
  showErrorMessage(`Error initializing map: ${error.message}`);
  throw error;
}

// Function to hide loading overlay
function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

// Function to display error messages to users
function showErrorMessage(message) {
  if (loadingOverlay) {
    const h1Element = loadingOverlay.querySelector('h1');
    if (h1Element) {
      h1Element.textContent = 'Error Loading Map';
    }
    
    const progressElement = document.getElementById('loadingProgress');
    if (progressElement && progressElement.parentNode) {
      // Replace progress bar with error message
      const errorDiv = document.createElement('div');
      errorDiv.style.color = 'red';
      errorDiv.style.margin = '20px';
      errorDiv.style.maxWidth = '600px';
      errorDiv.style.textAlign = 'center';
      errorDiv.innerHTML = `<p>${message}</p><p>Try refreshing the page. If the problem persists, please contact support.</p>`;
      
      progressElement.parentNode.replaceChild(errorDiv, progressElement);
    }
  }
}

// Convert CSV data to GeoJSON
function csvToGeoJson(csvData) {
  const geojsonData = {
    type: 'FeatureCollection',
    features: []
  };
  
  csvData.forEach(building => {
    if (building.Latitude && building.Longitude) {
      const lat = parseFloat(building.Latitude);
      const lon = parseFloat(building.Longitude);
      
      geojsonData.features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lon, lat]
        },
        properties: {
          id: building['Building Number'] || '',
          name: building.Name || '',
          description: building.Description || '',
          buildingNumber: building['Building Number'] || '',
          // Add more properties if needed
        }
      });
    }
  });
  
  return geojsonData;
}

// Create custom HTML for the info box
function buildCustomDescription(properties) {
  return `
    <div style="font-family: Arial, sans-serif; padding: 10px; max-width: 300px;">
      <h2 style="color: #00685e; margin-top: 0;">Building ${properties.buildingNumber}</h2>
      <h3>${properties.name}</h3>
      <p>${properties.description}</p>
      <hr>
      <button onclick="window.open('https://www.grossmont.edu/campus-map/building-${properties.buildingNumber}.php', '_blank')" 
              style="background-color: #003366; color: white; padding: 5px 10px; border: none; 
                     border-radius: 3px; cursor: pointer; margin-top: 10px;">
        More Information
      </button>
    </div>
  `;
}

// Add custom building data
async function addBuildingData() {
  try {
    console.log('Starting to load building data');
    // Check if we have cached data in localStorage
    const cachedData = localStorage.getItem('buildingData');
    let parsedData;
    
    if (cachedData) {
      console.log('Using cached building data');
      parsedData = JSON.parse(cachedData);
    } else {
      console.log('Fetching CSV data from:', './data/mapData.csv');
      // Fetch and parse CSV data
      const response = await fetch('./data/mapData.csv');
      
      console.log('Fetch response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const csvText = await response.text();
      console.log('CSV loaded successfully, length:', csvText.length);
      
      if (!csvText || csvText.trim().length === 0) {
        throw new Error('CSV file is empty');
      }
      
      parsedData = Papa.parse(csvText, { header: true }).data;
      console.log('Parsed CSV data:', parsedData.length, 'rows');
      
      if (!parsedData || parsedData.length === 0) {
        throw new Error('No data parsed from CSV');
      }
      
      // Cache the parsed data for future use
      localStorage.setItem('buildingData', JSON.stringify(parsedData));
    }
    
    // Convert to GeoJSON
    const geojsonData = csvToGeoJson(parsedData);
    console.log('Converted to GeoJSON, features:', geojsonData.features.length);
    
    // Create data source with chunking for large datasets
    const buildingSource = await GeoJsonDataSource.load(geojsonData, {
      maxPoints: 100, // Process in chunks of 100 points
      stroke: Color.HOTPINK,
      fill: Color.PINK.withAlpha(0.5),
      strokeWidth: 3,
      markerSymbol: '?'
    });
    
    console.log('GeoJSON data source created');
    
    // Customize entities
    buildingSource.entities.values.forEach(entity => {
      const properties = entity.properties;
      const buildingId = properties.buildingNumber?.getValue() || '';
      
      // Set description
      entity.description = buildCustomDescription(properties);
      
      // Add a label with building number
      entity.label = {
        text: buildingId,
        font: '14pt sans-serif',
        style: 0,
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        verticalOrigin: 0,
        pixelOffset: new Cartesian3(0, -30),
        heightReference: 1,
        showBackground: true,
        backgroundColor: Color.fromCssColorString('#00685e').withAlpha(0.7),
        backgroundPadding: new Cartesian3(7, 5),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      };
    });
    
    // Add to viewer
    viewer.dataSources.add(buildingSource);
    
    // Optional: Set up a click handler for identifying OSM buildings
    setupClickHandlerForOsmBuildings();
    
    return buildingSource;
  } catch (error) {
    console.error('Error loading building data:', error);
    showErrorMessage(`Error loading building data: ${error.message}`);
    return null;
  }
}

// Setup click handler to identify OSM buildings
function setupClickHandlerForOsmBuildings() {
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  
  handler.setInputAction(function(click) {
    const pickedFeature = viewer.scene.pick(click.position);
    
    if (pickedFeature && pickedFeature.id) {
      // Only handle our custom entities
      if (pickedFeature.id.properties && pickedFeature.id.properties.buildingNumber) {
        viewer.selectedEntity = pickedFeature.id;
      } else {
        // Clear selection for non-custom entities
        viewer.selectedEntity = undefined;
      }
      return;
    }
    
    // Clear selection for any other clicks
    viewer.selectedEntity = undefined;
    
    // For OSM buildings or other primitive features
    if (pickedFeature && pickedFeature.primitive) {
      // Just log the click for debugging purposes
      console.log('Picked OSM building (no info displayed)');
    }
  }, ScreenSpaceEventType.LEFT_CLICK);
}

// Function to return to the initial view
function returnToInitialView() {
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(
      CAMPUS_CENTER.longitude,
      CAMPUS_CENTER.latitude,
      500
    ),
    orientation: {
      heading: CesiumMath.toRadians(0),
      pitch: CesiumMath.toRadians(-45),
      roll: 0.0
    },
    duration: 2
  });
}

// Function to update loading message and progress
function updateLoadingMessage(message, progress) {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    const h1Element = loadingOverlay.querySelector('h1');
    if (h1Element) {
      h1Element.textContent = message;
    }
    
    // Update progress bar if provided
    if (progress !== undefined) {
      const progressBar = document.getElementById('loadingBar');
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }
    }
  }
}

// Set up location tracking
function setupLocationTracking() {
  const locationButton = document.getElementById('location-btn');
  let watchId = null;
  let locationEntity = null;

  function updateLocation(position) {
    const { latitude, longitude } = position.coords;
    
    // Remove existing location entity if it exists
    if (locationEntity) {
      viewer.entities.remove(locationEntity);
    }

    // Create new location entity
    locationEntity = viewer.entities.add({
      position: Cartesian3.fromDegrees(longitude, latitude),
      point: {
        pixelSize: 20,
        color: Color.fromCssColorString('#4CAF50'),
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        heightReference: 1
      },
      ellipse: {
        semiMinorAxis: 15,
        semiMajorAxis: 15,
        material: new ColorMaterialProperty(Color.fromCssColorString('#4CAF50').withAlpha(0.3)),
        heightReference: 1
      },
      label: {
        text: 'You are here',
        font: '16px sans-serif',
        style: 0,
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        verticalOrigin: 1,
        pixelOffset: new Cartesian3(0, -30),
        heightReference: 1,
        showBackground: true,
        backgroundColor: Color.fromCssColorString('#4CAF50').withAlpha(0.7),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });

    // Fly to location
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(longitude, latitude, 200),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-45),
        roll: 0.0
      },
      duration: 1
    });
  }

  function handleError(error) {
    console.error('Error getting location:', error);
    alert('Unable to get your location. Please check your location permissions.');
    locationButton.classList.remove('active');
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  if (locationButton) {
    locationButton.addEventListener('click', () => {
      if (!watchId) {
        // Start tracking
        if (navigator.geolocation) {
          locationButton.classList.add('active');
          // Get initial position
          navigator.geolocation.getCurrentPosition(updateLocation, handleError);
          // Start watching position
          watchId = navigator.geolocation.watchPosition(updateLocation, handleError);
        } else {
          alert('Geolocation is not supported by your browser');
        }
      } else {
        // Stop tracking
        locationButton.classList.remove('active');
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        if (locationEntity) {
          viewer.entities.remove(locationEntity);
          locationEntity = null;
        }
      }
    });
  }
}

// Convert parking lot CSV data to GeoJSON
function parkingLotCsvToGeoJson(csvData) {
  const geojsonData = {
    type: 'FeatureCollection',
    features: []
  };
  
  csvData.forEach(lot => {
    if (lot.Coordinates) {
      // Get the center coordinate for the label
      const coordinates = lot.Coordinates.split(';').map(coord => {
        const [lat, lon] = coord.split(',').map(Number);
        return [lat, lon];
      });
      
      // Calculate center point for the label
      const centerLat = coordinates.reduce((sum, coord) => sum + coord[0], 0) / coordinates.length;
      const centerLon = coordinates.reduce((sum, coord) => sum + coord[1], 0) / coordinates.length;
      
      geojsonData.features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [centerLon, centerLat]
        },
        properties: {
          id: lot['Lot Number'] || '',
          name: lot.Name || '',
          type: lot.Type || ''
        }
      });
    }
  });
  
  return geojsonData;
}

// Add parking lot data
async function addParkingLotData() {
  try {
    console.log('Starting to load parking lot data');
    
    // Fetch and parse CSV data
    const response = await fetch('./data/parkingLots.csv');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const csvText = await response.text();
    const parsedData = Papa.parse(csvText, { header: true }).data;
    
    // Convert to GeoJSON
    const geojsonData = parkingLotCsvToGeoJson(parsedData);
    
    // Create data source
    const parkingSource = await GeoJsonDataSource.load(geojsonData);
    
    // Customize entities
    parkingSource.entities.values.forEach(entity => {
      // Set up the label
      entity.label = {
        text: 'Lot' + entity.properties.id.getValue(), // 'P' prefix for Parking
        font: '24px sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scale: 1.0
      };
      
      // Remove any other entity visualization
      entity.point = undefined;
      entity.billboard = undefined;
    });
    
    // Add to viewer
    viewer.dataSources.add(parkingSource);
    
    return parkingSource;
  } catch (error) {
    console.error('Error loading parking lot data:', error);
    return null;
  }
}

// Initialize application
async function initialize() {
  try {
    console.log('Starting initialization');
    // Log Cesium version and token status
    console.log('Cesium token set:', !!Ion.defaultAccessToken);
    
    // Update loading message
    updateLoadingMessage("Loading basic map...", 10);
    
    // Set initial view first so user sees something quickly
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        CAMPUS_CENTER.longitude,
        CAMPUS_CENTER.latitude,
        500
      ),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-45),
        roll: 0.0
      },
      duration: 0
    });
    
    updateLoadingMessage("Loading 3D buildings...", 30);
    
    try {
      // Load photorealistic tileset with error handling
      try {
        // Load photorealistic tileset with lower initial detail
        const photorealisticTileset = await Cesium.createGooglePhotorealistic3DTileset({
          maximumScreenSpaceError: 16 // Start with lower detail
        });
        
        viewer.scene.primitives.add(photorealisticTileset);
        photorealisticTileset.shadows = ShadowMode.DISABLED;
        console.log('Photorealistic tileset loaded');
      } catch (tilesetError) {
        console.error('Error loading photorealistic tileset:', tilesetError);
        // Continue even if tileset fails to load
      }
      
      updateLoadingMessage("Loading Grossmont College Map...", 50);
      
      try {
        // Load OSM buildings with lower initial detail
        const osmBuildingsTileset = await Cesium.createOsmBuildingsAsync({
          maximumScreenSpaceError: 16 // Start with lower detail
        });
        
        viewer.scene.primitives.add(osmBuildingsTileset);
        osmBuildingsTileset.shadows = ShadowMode.DISABLED;
        
        // Make OSM buildings non-selectable and modify style
        osmBuildingsTileset.style = new Cesium.Cesium3DTileStyle({
          color: 'color("white", 0.7)',
          show: true
        });
        
        // Disable feature selection for OSM buildings
        osmBuildingsTileset.showOutline = false;
        osmBuildingsTileset.showBoundingVolume = false;
        osmBuildingsTileset.showContentBoundingVolume = false;
        osmBuildingsTileset.showRenderingStatistics = false;
        osmBuildingsTileset.debugShowRenderingStatistics = false;
        osmBuildingsTileset.debugShowBoundingVolume = false;
        osmBuildingsTileset.debugShowContentBoundingVolume = false;
        osmBuildingsTileset.debugShowRenderingTiles = false;
        osmBuildingsTileset.debugShowGeometryBoundingVolume = false;
        
        console.log("OSM Buildings tileset loaded successfully");
      } catch (osmError) {
        console.error('Error loading OSM buildings:', osmError);
        // Continue even if OSM buildings fail to load
      }
    } catch (error) {
      console.error('Error loading 3D buildings:', error);
      // Continue with the rest of the initialization
    }
    
    // Gradually increase detail level
    setTimeout(() => {
      try {
        const photorealisticTileset = viewer.scene.primitives.get(0);
        const osmBuildingsTileset = viewer.scene.primitives.get(1);
        
        if (photorealisticTileset) {
          photorealisticTileset.maximumScreenSpaceError = 8;
        }
        
        if (osmBuildingsTileset) {
          osmBuildingsTileset.maximumScreenSpaceError = 8;
        }
        
        console.log("Detail level increased to medium");
      } catch (error) {
        console.error("Error updating detail level:", error);
      }
    }, 2000);
    
    // Add building data
    updateLoadingMessage("Loading building information...", 70);
    await addBuildingData();
    
    updateLoadingMessage("Loading parking lots...", 80);
    await addParkingLotData();
    
    updateLoadingMessage("Setting up controls...", 90);
    
    // Set up home button functionality
    setupHomeButton();
    
    // Add search functionality
    setupBuildingSearch();

    // Add location tracking
    setupLocationTracking();
    
    // Final detail level increase
    setTimeout(() => {
      try {
        const photorealisticTileset = viewer.scene.primitives.get(0);
        const osmBuildingsTileset = viewer.scene.primitives.get(1);
        
        if (photorealisticTileset) {
          photorealisticTileset.maximumScreenSpaceError = 4;
        }
        
        if (osmBuildingsTileset) {
          osmBuildingsTileset.maximumScreenSpaceError = 4;
        }
        
        console.log("Detail level increased to high");
      } catch (error) {
        console.error("Error updating final detail level:", error);
      }
    }, 4000);
    
    updateLoadingMessage("Ready!", 100);
    
    // Hide loading overlay when everything is ready
    setTimeout(hideLoading, 500);
    
    // Limit camera movement
    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableTranslate = true;
    viewer.scene.screenSpaceCameraController.enableZoom = true;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 80;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 2000;

  } catch (error) {
    console.error("Initialization error:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    showErrorMessage(`Initialization error: ${error.message}`);
    // Force hide loading overlay after timeout
    setTimeout(hideLoading, 5000);
  }
}

// Set up a search function for buildings
function setupBuildingSearch() {
  const searchInput = document.getElementById('location-search');
  const searchResults = document.getElementById('search-results');
  let currentResults = [];
  let selectedIndex = -1;

  // Fuzzy search function
  function fuzzySearch(text, search) {
    if (!text || !search) return 0;
    const searchLower = search.toLowerCase();
    const textLower = text.toLowerCase();
    
    // Exact match
    if (textLower.includes(searchLower)) return 1;
    
    // Fuzzy match (check if all characters are in order)
    let j = 0;
    for (let i = 0; i < textLower.length && j < searchLower.length; i++) {
      if (textLower[i] === searchLower[j]) j++;
    }
    return j === searchLower.length ? 0.5 : 0;
  }

  function performSearch() {
    const searchText = searchInput.value.toLowerCase();
    if (!searchText) {
      searchResults.style.display = 'none';
      return;
    }

    // Search all entities
    currentResults = [];
    const dataSource = viewer.dataSources.get(0);
    
    if (!dataSource) {
      console.error('No data source found');
      return;
    }

    dataSource.entities.values.forEach(entity => {
      const name = entity.properties.name?.getValue() || '';
      const buildingNumber = entity.properties.buildingNumber?.getValue() || '';
      const description = entity.properties.description?.getValue() || '';
      
      const nameScore = fuzzySearch(name, searchText);
      const numberScore = fuzzySearch(buildingNumber, searchText);
      const descScore = fuzzySearch(description, searchText);
      
      const maxScore = Math.max(nameScore, numberScore, descScore);
      
      if (maxScore > 0) {
        currentResults.push({
          entity,
          score: maxScore,
          name,
          buildingNumber,
          description
        });
      }
    });

    // Sort results by score
    currentResults.sort((a, b) => b.score - a.score);

    // Display results
    if (currentResults.length > 0) {
      searchResults.innerHTML = currentResults
        .map((result, index) => `
          <div class="search-result" data-index="${index}">
            <strong>${result.name} (Building ${result.buildingNumber})</strong>
            <span>${result.description}</span>
          </div>
        `)
        .join('');
      searchResults.style.display = 'block';
      selectedIndex = -1;
    } else {
      searchResults.innerHTML = '<div class="no-results">No buildings found</div>';
      searchResults.style.display = 'block';
    }
  }

  function selectResult(index) {
    if (index < 0 || index >= currentResults.length) return;
    
    const result = currentResults[index];
    selectedIndex = index;

    // Update visual selection
    const results = searchResults.getElementsByClassName('search-result');
    Array.from(results).forEach((el, i) => {
      el.style.backgroundColor = i === index ? '#e3f2fd' : '';
    });

    // Fly to the building
    viewer.flyTo(result.entity, {
      duration: 2,
      offset: new HeadingPitchRange(0, -CesiumMath.toRadians(45), 200)
    });

    // Select the entity to show its info
    viewer.selectedEntity = result.entity;
    
    // Clear the search input and hide the dropdown
    searchInput.value = '';
    searchResults.style.display = 'none';
  }

  // Event Listeners
  if (searchInput && searchResults) {
    // Search on input with debounce
    let debounceTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(performSearch, 300);
    });

    // Enter key support
    searchInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        if (selectedIndex === -1 && currentResults.length > 0) {
          selectResult(0);
        }
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        selectResult(Math.min(selectedIndex + 1, currentResults.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        selectResult(Math.max(selectedIndex - 1, 0));
      } else if (event.key === 'Escape') {
        searchResults.style.display = 'none';
        selectedIndex = -1;
      }
    });

    // Click on search results
    searchResults.addEventListener('click', (event) => {
      const result = event.target.closest('.search-result');
      if (result) {
        const index = parseInt(result.dataset.index);
        selectResult(index);
      }
    });

    // Close search results when clicking outside
    document.addEventListener('click', (event) => {
      if (!searchInput.contains(event.target) && !searchResults.contains(event.target)) {
        searchResults.style.display = 'none';
      }
    });
  } else {
    console.error('Search elements not found:', {
      searchInput: !!searchInput,
      searchResults: !!searchResults
    });
  }
}

// Set up home button functionality
function setupHomeButton() {
  const homeButton = document.getElementById('home-btn');
  if (homeButton) {
    homeButton.addEventListener('click', returnToInitialView);
  }
}

// Initialize the application
initialize();
