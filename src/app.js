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
    const loadingText = loadingOverlay.querySelector('.loading-text');
    if (loadingText) {
      loadingText.textContent = 'Error Loading Map';
    }
    
    const progressElement = document.getElementById('loadingProgress');
    if (progressElement && progressElement.parentNode) {
      // Replace progress bar with error message
      const errorDiv = document.createElement('div');
      errorDiv.style.color = '#ff6b6b';
      errorDiv.style.margin = '20px';
      errorDiv.style.maxWidth = '600px';
      errorDiv.style.textAlign = 'center';
      errorDiv.style.backgroundColor = 'rgba(255, 107, 107, 0.1)';
      errorDiv.style.padding = '15px';
      errorDiv.style.borderRadius = '8px';
      errorDiv.style.border = '1px solid rgba(255, 107, 107, 0.3)';
      errorDiv.innerHTML = `<p style="margin: 0 0 10px 0; font-weight: bold;">${message}</p><p style="margin: 0; font-size: 14px; opacity: 0.8;">Try refreshing the page. If the problem persists, please contact support.</p>`;
      
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
  
  csvData.forEach((building, index) => {
    try {
      if (building.Latitude && building.Longitude) {
        const lat = parseFloat(building.Latitude);
        const lon = parseFloat(building.Longitude);
        
        // Validate coordinates
        if (isNaN(lat) || isNaN(lon)) {
          console.warn(`Invalid coordinates for building ${building['Building Number'] || index}: lat=${building.Latitude}, lon=${building.Longitude}`);
          return;
        }
        
        // Check if coordinates are within reasonable bounds
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          console.warn(`Coordinates out of bounds for building ${building['Building Number'] || index}: lat=${lat}, lon=${lon}`);
          return;
        }
        
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
      } else {
        console.warn(`Missing coordinates for building ${building['Building Number'] || index}`);
      }
    } catch (error) {
      console.error(`Error processing building ${building['Building Number'] || index}:`, error);
    }
  });
  
  return geojsonData;
}

// Create custom HTML for the info box
function buildCustomDescription(properties) {
  const buildingNumber = properties.buildingNumber || '';
  const buildingName = properties.name || '';
  const buildingDescription = properties.description || '';
  
  // Only show name and description if they exist
  const nameSection = buildingName ? `<h3>${buildingName}</h3>` : '';
  const descriptionSection = buildingDescription ? `<p>${buildingDescription}</p>` : '';
  
  return `
    <div style="font-family: Arial, sans-serif; padding: 10px; max-width: 300px;">
      <h2 style="color: #00685e; margin-top: 0;">Building ${buildingNumber}</h2>
      ${nameSection}
      ${descriptionSection}
      <hr>
      <a href="https://www.grossmont.edu/index.php" 
         target="_blank" 
         rel="noopener noreferrer"
         style="display: inline-block; background-color: #003366; color: white; padding: 8px 15px; 
                text-decoration: none; border-radius: 3px; cursor: pointer; margin-top: 10px; font-weight: bold;">
        More Information
      </a>
      <br>
      <small style="color: #666; font-size: 12px; margin-top: 5px; display: block;">
        If buttons don't work, try opening the link in a new window manually
      </small>
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
      const buildingName = properties.name?.getValue() || '';
      const buildingDescription = properties.description?.getValue() || '';
      
      console.log('🏗️ Creating building entity:', buildingId, 'Properties:', Object.keys(properties));
      
      // Determine if this is a minimal building (only has building number and coordinates)
      const isMinimalBuilding = !buildingName && !buildingDescription;
      
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
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        // All buildings show their labels now (minimal buildings will be scaled instead of hidden)
        show: true
      };
      
      // Store whether this is a minimal building for later use
      entity.isMinimalBuilding = isMinimalBuilding;
    });
    
    // Add to viewer
    viewer.dataSources.add(buildingSource);
    
    // Set up camera change handler for LOD
    setupBuildingLOD(buildingSource);
    
    // Optional: Set up a click handler for identifying OSM buildings
    setupClickHandlerForOsmBuildings();
    
    // Set up hover handlers for building labels
    setupBuildingLabelHoverHandlers();
    
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
      console.log('🎯 Click detected on entity with properties:', Object.keys(pickedFeature.id.properties));
      
      // Only handle our custom entities - check for buildingNumber property
      if (pickedFeature.id.properties && 
          pickedFeature.id.properties.buildingNumber) {
        console.log('🏢 Building clicked:', pickedFeature.id.properties.buildingNumber.getValue());
        console.log('📍 Entity properties:', Object.keys(pickedFeature.id.properties));
        console.log('📍 Using custom flyTo approach...');
        
        // Store the entity for later use
        const buildingEntity = pickedFeature.id;
        
        // Fly to the building with custom parameters (identical to search behavior)
        viewer.flyTo(buildingEntity, {
          duration: 2,
          offset: new HeadingPitchRange(0, -CesiumMath.toRadians(65), 400)
        });
        
        // Set selected entity after the flyTo to show info box
        // This should not trigger another zoom since we just flew there
        setTimeout(() => {
          viewer.selectedEntity = buildingEntity;
          console.log('✅ Custom flyTo completed, selectedEntity set');
        }, 50);
        
        console.log('✅ Custom flyTo initiated for building');
        
        // Return early to prevent other handlers from processing this click
        return;
      } else {
        // Clear selection for non-custom entities
        viewer.selectedEntity = undefined;
      }
      return;
    }
    
    // Clear selection for any other clicks
    viewer.selectedEntity = undefined;
    
    // Clear any existing highlight when clicking elsewhere
    clearHighlight();
    clearBuildingLabelHighlight();
    
    // For OSM buildings or other primitive features
    if (pickedFeature && pickedFeature.primitive) {
      // Just log the click for debugging purposes
      console.log('Picked OSM building (no info displayed)');
    }
  }, ScreenSpaceEventType.LEFT_CLICK);
}

// Setup hover handlers for building labels
function setupBuildingLabelHoverHandlers() {
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  
  // Mouse move handler for hover effects
  handler.setInputAction(function(movement) {
    const pickedFeature = viewer.scene.pick(movement.endPosition);
    
    // Clear any existing hover highlight
    clearBuildingLabelHighlight();
    
    if (pickedFeature && pickedFeature.id) {
      // Check if it's a building entity with a label
      if (pickedFeature.id.properties && 
          pickedFeature.id.properties.buildingNumber &&
          pickedFeature.id.label) {
        
        // Highlight the building label on hover
        highlightBuildingLabel(pickedFeature.id);
      }
    }
  }, ScreenSpaceEventType.MOUSE_MOVE);
}

// Setup building level-of-detail (LOD) based on camera height
function setupBuildingLOD(buildingSource) {
  // Debounce function to limit how often we update LOD
  let lodUpdateTimeout;
  
  function updateBuildingLOD() {
    if (!buildingSource || !buildingSource.entities) return;
    
    try {
      const cameraHeight = viewer.camera.positionCartographic.height;
      
      buildingSource.entities.values.forEach(entity => {
        if (entity.isMinimalBuilding && entity.label) {
          // Scale font size based on camera height
          let fontSize = '14pt';
          
          if (cameraHeight > 800) {
            fontSize = '8pt'; // Very small when far away
          } else if (cameraHeight > 500) {
            fontSize = '10pt'; // Small when moderately far
          } else if (cameraHeight > 300) {
            fontSize = '12pt'; // Medium when closer
          } else {
            fontSize = '14pt'; // Full size when close
          }
          
          entity.label.font = fontSize + ' sans-serif';
        }
      });
    } catch (error) {
      console.warn('Error in updateBuildingLOD:', error);
    }
  }
  
  // Update LOD when camera moves
  viewer.camera.changed.addEventListener(() => {
    // Debounce the LOD updates to improve performance
    clearTimeout(lodUpdateTimeout);
    lodUpdateTimeout = setTimeout(updateBuildingLOD, 100);
  });
  
  // Initial LOD update
  updateBuildingLOD();
}

// Function to return to the initial view
function returnToInitialView() {
  // Clear any existing highlight when returning to home view
  clearHighlight();
  clearBuildingLabelHighlight();
  
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
    const loadingText = loadingOverlay.querySelector('.loading-text');
    if (loadingText) {
      loadingText.textContent = message;
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
        color: Color.fromCssColorString('#009688'),
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
      duration: 0
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
          type: lot.Type || '',
          nearbyBuildings: lot.NearbyBuildings || ''
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
      const properties = entity.properties;
      const lotNumber = properties.id.getValue();
      const lotName = properties.name.getValue();
      const lotTypes = properties.type.getValue().split(';');
      
      console.log('🅿️ Creating parking entity:', lotNumber, 'Properties:', Object.keys(properties));
      
      // Create custom description HTML with styled parking types
      const description = `
        <div style="font-family: Arial, sans-serif; padding: 10px; max-width: 300px;">
          <h2 style="color: #00685e; margin-top: 0;">${lotName}</h2>
          <div style="margin: 10px 0;">
            <strong>Available Parking:</strong>
            <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px;">
              ${lotTypes.map(type => `
                <span style="
                  background-color: ${getParkingTypeColor(type)};
                  color: white;
                  padding: 3px 8px;
                  border-radius: 12px;
                  font-size: 12px;
                ">${type}</span>
              `).join('')}
            </div>
          </div>
        </div>
      `;
      
      // Set up the entity
      entity.description = description;
      
      // Add a billboard (icon) for the parking lot
      entity.billboard = {
        image: '/assets/parking-icon.png', // You'll need to add this icon
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        scale: 0.09,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      };
    });
    
    // Add to viewer
    viewer.dataSources.add(parkingSource);
    window.grossmontLayers.parking = parkingSource;
    
    // Initially hide the parking layer
    parkingSource.show = false;
    
    // Set up click handler for parking lots
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(function(click) {
      const pickedFeature = viewer.scene.pick(click.position);
      
      if (pickedFeature && pickedFeature.id) {
        // Check if it's a parking lot entity - must have id property AND type property (unique to parking lots)
        if (pickedFeature.id.properties && 
            pickedFeature.id.properties.id && 
            pickedFeature.id.properties.id.getValue &&
            pickedFeature.id.properties.type) {
          console.log('🅿️ Parking lot clicked:', pickedFeature.id.properties.id.getValue());
          console.log('📍 Parking entity properties:', Object.keys(pickedFeature.id.properties));
          console.log('📍 Setting selectedEntity and calling custom flyTo...');
          
          // Clear any existing highlight
          clearHighlight();
          
          // Fly to the parking lot FIRST
          viewer.flyTo(pickedFeature.id, {
            duration: 1,
            offset: new HeadingPitchRange(0, -CesiumMath.toRadians(45), 200)
          });
          
          // Then set selected entity
          viewer.selectedEntity = pickedFeature.id;
          
          console.log('✅ Custom flyTo called for parking lot');
          
          // Return early to prevent other handlers from processing this click
          return;
        }
      }
    }, ScreenSpaceEventType.LEFT_CLICK);
    
    return parkingSource;
  } catch (error) {
    console.error('Error loading parking lot data:', error);
    return null;
  }
}

// Helper function to get color based on parking type
function getParkingTypeColor(type) {
  switch (type.trim()) {
    case 'Student':
      return '#4CAF50'; // Green
    case 'Staff':
      return '#2196F3'; // Blue
    case 'Disabled':
      return '#FF9800'; // Orange
    case 'Bus Loading':
      return '#9C27B0'; // Purple
    default:
      return '#757575'; // Gray
  }
}

// Global references for toggling layers
window.grossmontLayers = {
  parking: null,
  transportation: null, // Placeholder for future
  services: null // Placeholder for future
};

// Global variable to track highlighted entity
window.highlightedEntity = null;

// Global variable to track hovered building label
window.hoveredBuildingLabel = null;

// Function to highlight an entity with a green color
function highlightEntity(entity) {
  // Clear any existing highlight
  clearHighlight();
  
  if (entity) {
    // Store the original billboard properties
    const originalBillboard = entity.billboard;
    
    // Create a highlighted version with green color
    entity.billboard = {
      image: originalBillboard.image.getValue(),
      verticalOrigin: originalBillboard.verticalOrigin.getValue(),
      scale: originalBillboard.scale.getValue() * 1.5, // Make it larger
      heightReference: originalBillboard.heightReference.getValue(),
      disableDepthTestDistance: originalBillboard.disableDepthTestDistance.getValue(),
      color: new Color(0.0, 0.6, 0.6, 1.0) // Add teal color
    };
    
    // Store the highlighted entity
    window.highlightedEntity = {
      entity: entity,
      originalBillboard: originalBillboard
    };
    
    console.log('✅ Entity highlighted in green');
  }
}

// Function to clear the current highlight
function clearHighlight() {
  if (window.highlightedEntity) {
    const { entity, originalBillboard } = window.highlightedEntity;
    
    // Restore original billboard properties
    entity.billboard = originalBillboard;
    
    window.highlightedEntity = null;
    console.log('✅ Highlight cleared');
  }
}

// Function to highlight building label on hover
function highlightBuildingLabel(entity) {
  if (entity && entity.label) {
    // Store original label properties
    const originalLabel = {
      fillColor: entity.label.fillColor.getValue(),
      backgroundColor: entity.label.backgroundColor.getValue(),
      scale: entity.label.scale ? entity.label.scale.getValue() : 1.0
    };
    
    // Create highlighted label with different color
    entity.label.fillColor = Color.fromCssColorString('#FFD700'); // Gold color
    entity.label.backgroundColor = Color.fromCssColorString('#00685e').withAlpha(0.9); // Darker background
    if (entity.label.scale) {
      entity.label.scale = 1.2; // Slightly larger
    }
    
    // Store the hovered label
    window.hoveredBuildingLabel = {
      entity: entity,
      originalLabel: originalLabel
    };
    
    console.log('✅ Building label highlighted on hover');
  }
}

// Function to clear building label highlight
function clearBuildingLabelHighlight() {
  if (window.hoveredBuildingLabel) {
    const { entity, originalLabel } = window.hoveredBuildingLabel;
    
    // Restore original label properties
    entity.label.fillColor = originalLabel.fillColor;
    entity.label.backgroundColor = originalLabel.backgroundColor;
    if (entity.label.scale) {
      entity.label.scale = originalLabel.scale;
    }
    
    window.hoveredBuildingLabel = null;
    console.log('✅ Building label highlight cleared');
  }
}

// Set up a search function for buildings and services
function setupBuildingSearch() {
  const searchInput = document.getElementById('sidebar-location-search');
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
    
    // Search buildings
    const buildingSource = viewer.dataSources.get(0);
    if (buildingSource) {
      buildingSource.entities.values.forEach(entity => {
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
            description,
            type: 'building'
          });
        }
      });
    }

    // Search student services
    const servicesSource = window.grossmontLayers.services;
    if (servicesSource) {
      servicesSource.entities.values.forEach(entity => {
        const name = entity.properties.name?.getValue() || '';
        const description = entity.properties.description?.getValue() || '';
        const location = entity.properties.location?.getValue() || '';
        
        const nameScore = fuzzySearch(name, searchText);
        const descScore = fuzzySearch(description, searchText);
        const locationScore = fuzzySearch(location, searchText);
        
        const maxScore = Math.max(nameScore, descScore, locationScore);
        
        if (maxScore > 0) {
          currentResults.push({
            entity,
            score: maxScore,
            name,
            description,
            location,
            type: 'service'
          });
        }
      });
    }

    // Sort results by score
    currentResults.sort((a, b) => b.score - a.score);

    // Display results
    if (currentResults.length > 0) {
      searchResults.innerHTML = currentResults
        .map((result, index) => `
          <div class="search-result" data-index="${index}">
            <strong>${result.name}</strong>
            ${result.type === 'building' ? ` (Building ${result.buildingNumber})` : ' (Student Service)'}
            <span>${result.description}</span>
            ${result.type === 'service' && result.location ? `<br><small style="color: #00685e; font-weight: 500;">📍 ${result.location}</small>` : ''}
          </div>
        `)
        .join('');
      searchResults.style.display = 'block';
      selectedIndex = -1;
    } else {
      searchResults.innerHTML = '<div class="no-results">No results found</div>';
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

    // Fly to the location
    viewer.flyTo(result.entity, {
      duration: 2,
      offset: new HeadingPitchRange(0, -CesiumMath.toRadians(65), 400)
    });

    // Select the entity to show its info
    viewer.selectedEntity = result.entity;
    
    // Highlight the selected entity if it's a service
    if (result.type === 'service') {
      highlightEntity(result.entity);
      
      // Automatically show the services layer and check the checkbox
      if (window.grossmontLayers.services) {
        window.grossmontLayers.services.show = true;
      }
      const servicesCheckbox = document.getElementById('services-checkbox');
      if (servicesCheckbox) {
        servicesCheckbox.checked = true;
      }
    } else {
      // Clear any existing highlight for non-service selections
      clearHighlight();
      clearBuildingLabelHighlight();
    }
    
    // Clear the search input and hide the dropdown
    searchInput.value = '';
    searchResults.style.display = 'none';
    
    // Auto-close sidebar on mobile after selection
    const isMobile = window.innerWidth <= 900;
    if (isMobile) {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      const hamburgerBtn = document.getElementById('hamburger-btn');
      
      if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        hamburgerBtn.innerHTML = '<i class="fas fa-bars"></i>';
      }
    }
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

// Set up hamburger menu functionality for mobile
function setupHamburgerMenu() {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (hamburgerBtn && sidebar && overlay) {
    // Toggle sidebar on hamburger click
    hamburgerBtn.addEventListener('click', () => {
      const isOpen = sidebar.classList.contains('open');
      
      if (isOpen) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
    
    // Close sidebar when clicking overlay
    overlay.addEventListener('click', closeSidebar);
    
    // Close sidebar when pressing escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) {
        closeSidebar();
      }
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
      const isClickInsideSidebar = sidebar.contains(e.target);
      const isClickOnHamburger = hamburgerBtn.contains(e.target);
      const isMobile = window.innerWidth <= 900;
      
      if (!isClickInsideSidebar && !isClickOnHamburger && sidebar.classList.contains('open') && isMobile) {
        closeSidebar();
      }
    });
  }
  
  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    hamburgerBtn.innerHTML = '<i class="fas fa-times"></i>'; // Change to X icon
  }
  
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    hamburgerBtn.innerHTML = '<i class="fas fa-bars"></i>'; // Change back to hamburger icon
  }
}

// Add sidebar layer toggling logic
function setupSidebarLayerToggles() {
  const parkingCheckbox = document.getElementById('parking-checkbox');
  const transportationCheckbox = document.getElementById('transportation-checkbox');
  const servicesCheckbox = document.getElementById('services-checkbox');

  // Initially uncheck all checkboxes since layers are hidden by default
  if (parkingCheckbox) {
    parkingCheckbox.checked = false;
    parkingCheckbox.addEventListener('change', () => {
      if (window.grossmontLayers.parking) {
        window.grossmontLayers.parking.show = parkingCheckbox.checked;
      }
    });
  }
  if (transportationCheckbox) {
    transportationCheckbox.checked = false;
    transportationCheckbox.addEventListener('change', () => {
      if (window.grossmontLayers.transportation) {
        window.grossmontLayers.transportation.show = transportationCheckbox.checked;
      }
    });
  }
  if (servicesCheckbox) {
    servicesCheckbox.checked = false;
    servicesCheckbox.addEventListener('change', () => {
      if (window.grossmontLayers.services) {
        window.grossmontLayers.services.show = servicesCheckbox.checked;
      }
    });
  }
}

// Convert bus stop CSV data to GeoJSON
function busStopCsvToGeoJson(csvData) {
  const geojsonData = {
    type: 'FeatureCollection',
    features: []
  };
  
  csvData.forEach(stop => {
    if (stop.latitude && stop.longitude) {
      geojsonData.features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(stop.longitude), parseFloat(stop.latitude)]
        },
        properties: {
          name: stop.stop_name || '',
          busLines: stop.bus_lines || ''
        }
      });
    }
  });
  
  return geojsonData;
}

// Add bus stop data
async function addBusStopData() {
  try {
    console.log('Starting to load bus stop data');
    
    // Fetch and parse CSV data
    const response = await fetch('./data/busStops.csv');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const csvText = await response.text();
    const parsedData = Papa.parse(csvText, { header: true }).data;
    
    // Convert to GeoJSON
    const geojsonData = busStopCsvToGeoJson(parsedData);
    
    // Create data source
    const busStopSource = await GeoJsonDataSource.load(geojsonData);
    
    // Customize entities
    busStopSource.entities.values.forEach(entity => {
      const properties = entity.properties;
      const stopName = properties.name.getValue();
      const busLines = properties.busLines.getValue().split(', ');
      
      // Create custom description HTML
      const description = `
        <div style="font-family: Arial, sans-serif; padding: 10px; max-width: 300px;">
          <h2 style="color: #00685e; margin-top: 0;">${stopName}</h2>
          <div style="margin: 10px 0;">
            <strong>Available Bus Lines:</strong>
            <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 5px;">
              ${busLines.map(line => `
                <span style="
                  background-color: #00685e;
                  color: white;
                  padding: 5px 10px;
                  border-radius: 4px;
                  font-size: 14px;
                ">${line}</span>
              `).join('')}
            </div>
          </div>
        </div>
      `;
      
      // Set up the entity
      entity.description = description;
      
      // Add a billboard (icon) for the bus stop
      entity.billboard = {
        image: '/assets/bus-stop-icon.png',
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        scale: 0.09,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      };
    });
    
    // Add to viewer
    viewer.dataSources.add(busStopSource);
    window.grossmontLayers.transportation = busStopSource;
    
    // Initially hide the transportation layer
    busStopSource.show = false;
    
    // Set up click handler for bus stops
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(function(click) {
      const pickedFeature = viewer.scene.pick(click.position);
      
      if (pickedFeature && pickedFeature.id) {
        // Check if it's a bus stop entity
        if (pickedFeature.id.properties && pickedFeature.id.properties.name) {
          // Clear any existing highlight
          clearHighlight();
          
          viewer.selectedEntity = pickedFeature.id;
          
          // Fly to the bus stop
          viewer.flyTo(pickedFeature.id, {
            duration: 1,
            offset: new HeadingPitchRange(0, -CesiumMath.toRadians(45), 200)
          });
        }
      }
    }, ScreenSpaceEventType.LEFT_CLICK);
    
    return busStopSource;
  } catch (error) {
    console.error('Error loading bus stop data:', error);
    return null;
  }
}

// Convert student services CSV data to GeoJSON
function studentServicesCsvToGeoJson(csvData) {
  const geojsonData = {
    type: 'FeatureCollection',
    features: []
  };
  
  csvData.forEach(service => {
    if (service.Latitude && service.Longitude) {
      geojsonData.features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(service.Longitude), parseFloat(service.Latitude)]
        },
        properties: {
          name: service.Name || '',
          description: service.Description || '',
          location: service.Location || ''
        }
      });
    }
  });
  
  return geojsonData;
}

// Add student services data
async function addStudentServicesData() {
  try {
    console.log('Starting to load student services data');
    
    // Fetch and parse CSV data
    const response = await fetch('./data/Studentservices.csv');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const csvText = await response.text();
    const parsedData = Papa.parse(csvText, { header: true }).data;
    
    // Convert to GeoJSON
    const geojsonData = studentServicesCsvToGeoJson(parsedData);
    
    // Create data source
    const servicesSource = await GeoJsonDataSource.load(geojsonData);
    
    // Customize entities
    servicesSource.entities.values.forEach(entity => {
      const properties = entity.properties;
      const serviceName = properties.name.getValue();
      const serviceDescription = properties.description.getValue();
      const serviceLocation = properties.location.getValue();
      
      // Create custom description HTML
      const description = `
        <div style="font-family: Arial, sans-serif; padding: 10px; max-width: 300px;">
          <h2 style="color: #00685e; margin-top: 0;">${serviceName}</h2>
          <p style="margin: 8px 0;">${serviceDescription}</p>
          ${serviceLocation ? `
            <div style="margin: 10px 0; padding: 8px; background-color: #f5f5f5; border-radius: 4px; border-left: 3px solid #00685e;">
              <strong style="color: #003366; font-size: 15px; font-weight: bold;">📍 Location:</strong><br>
              <span style="font-size: 15px; color: #222; font-weight: bold;">${serviceLocation}</span>
            </div>
          ` : ''}
        </div>
      `;
      
      // Set up the entity
      entity.description = description;
      
      // Add a billboard (icon) for the service
      entity.billboard = {
        image: '/assets/service-icon.png',
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        scale: 0.09,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      };
    });
    
    // Add to viewer
    viewer.dataSources.add(servicesSource);
    window.grossmontLayers.services = servicesSource;
    
    // Initially hide the services layer
    servicesSource.show = false;
    
    // Set up click handler for services
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(function(click) {
      const pickedFeature = viewer.scene.pick(click.position);
      
      if (pickedFeature && pickedFeature.id) {
        // Check if it's a service entity
        if (pickedFeature.id.properties && pickedFeature.id.properties.name) {
          // Clear any existing highlight
          clearHighlight();
          
          // Highlight the clicked service
          highlightEntity(pickedFeature.id);
          
          viewer.selectedEntity = pickedFeature.id;
          
          // Fly to the service
          viewer.flyTo(pickedFeature.id, {
            duration: 1,
            offset: new HeadingPitchRange(0, -CesiumMath.toRadians(45), 200)
          });
        }
      }
    }, ScreenSpaceEventType.LEFT_CLICK);
    
    return servicesSource;
  } catch (error) {
    console.error('Error loading student services data:', error);
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
    
    let photorealisticTileset = null;
    let osmBuildingsTileset = null;
    
    try {
      // Load photorealistic tileset with error handling
      try {
        // Load photorealistic tileset with lower initial detail
        photorealisticTileset = await Cesium.createGooglePhotorealistic3DTileset({
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
        osmBuildingsTileset = await Cesium.createOsmBuildingsAsync({
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
    
    // Function to check if tilesets are loaded at high quality
    function checkTilesetQuality() {
      let photorealisticReady = true;
      let osmReady = true;
      
      if (photorealisticTileset) {
        // Check if photorealistic tileset has reached target detail level
        const currentError = photorealisticTileset.maximumScreenSpaceError;
        photorealisticReady = currentError <= 4; // Target detail level
        console.log('Photorealistic tileset detail level:', currentError, 'Ready:', photorealisticReady);
      }
      
      if (osmBuildingsTileset) {
        // Check if OSM buildings tileset has reached target detail level
        const currentError = osmBuildingsTileset.maximumScreenSpaceError;
        osmReady = currentError <= 4; // Target detail level
        console.log('OSM buildings tileset detail level:', currentError, 'Ready:', osmReady);
      }
      
      return photorealisticReady && osmReady;
    }
    
    // Function to get loading progress based on tileset state
    function getTilesetLoadingProgress() {
      let totalProgress = 0;
      let tilesetCount = 0;
      
      if (photorealisticTileset) {
        tilesetCount++;
        const currentError = photorealisticTileset.maximumScreenSpaceError;
        // Calculate progress: 16 (initial) -> 4 (target) = 12 steps
        // Current progress = (16 - currentError) / 12
        const progress = Math.max(0, Math.min(1, (16 - currentError) / 12));
        totalProgress += progress;
      }
      
      if (osmBuildingsTileset) {
        tilesetCount++;
        const currentError = osmBuildingsTileset.maximumScreenSpaceError;
        const progress = Math.max(0, Math.min(1, (16 - currentError) / 12));
        totalProgress += progress;
      }
      
      return tilesetCount > 0 ? totalProgress / tilesetCount : 0;
    }
    
    // Function to wait for tilesets to load at high quality
    function waitForHighQuality() {
      return new Promise((resolve) => {
        let checkCount = 0;
        const maxChecks = 60; // Maximum 30 seconds (60 * 500ms)
        
        const checkInterval = setInterval(() => {
          checkCount++;
          
          // Update loading progress based on tileset quality
          const progress = getTilesetLoadingProgress();
          const progressPercent = Math.round(98 + (progress * 2)); // 98-100% range
          
          // Create more informative loading message
          let loadingMessage = "Loading high-quality map details...";
          if (progress < 0.3) {
            loadingMessage = "Loading basic map structures...";
          } else if (progress < 0.6) {
            loadingMessage = "Loading detailed buildings...";
          } else if (progress < 0.9) {
            loadingMessage = "Loading fine details...";
          } else {
            loadingMessage = "Finalizing map quality...";
          }
          
          updateLoadingMessage(loadingMessage, progressPercent);
          
          if (checkTilesetQuality()) {
            clearInterval(checkInterval);
            console.log('Tilesets loaded at high quality');
            resolve();
          } else if (checkCount >= maxChecks) {
            clearInterval(checkInterval);
            console.log('Timeout reached, proceeding anyway');
            resolve();
          }
        }, 500);
      });
    }
    
    // Function to check if any tilesets are available
    function hasAnyTilesets() {
      return (photorealisticTileset !== null) || (osmBuildingsTileset !== null);
    }
    
    // Gradually increase detail level
    setTimeout(() => {
      try {
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
    
    updateLoadingMessage("Loading bus stops...", 85);
    await addBusStopData();
    
    updateLoadingMessage("Loading student services...", 90);
    await addStudentServicesData();
    
    updateLoadingMessage("Setting up controls...", 95);
    
    // Set up home button functionality
    setupHomeButton();
    
    // Set up hamburger menu for mobile
    setupHamburgerMenu();
    
    // Add search functionality
    setupBuildingSearch();

    // Add location tracking
    setupLocationTracking();
    
    // Final detail level increase
    setTimeout(() => {
      try {
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
    
    // Check if we have any tilesets to wait for
    if (hasAnyTilesets()) {
      updateLoadingMessage("Waiting for high-quality map to load...", 98);
      
      // Wait for tilesets to load at high quality with timeout
      try {
        await Promise.race([
          waitForHighQuality(),
          new Promise(resolve => setTimeout(resolve, 30000)) // 30 second timeout
        ]);
      } catch (error) {
        console.error('Error waiting for high quality:', error);
        // Continue anyway
      }
    } else {
      updateLoadingMessage("Map loaded successfully...", 98);
      // Small delay to show the message
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    updateLoadingMessage("Ready!", 100);
    
    // Hide loading overlay only after everything is fully loaded
    setTimeout(hideLoading, 1000);
    
    // Safety mechanism: Force hide loading screen after 35 seconds total
    setTimeout(() => {
      if (loadingOverlay && loadingOverlay.style.display !== 'none') {
        console.log('Safety timeout: Forcing loading screen to hide');
        hideLoading();
      }
    }, 35000);
    
    // Limit camera movement
    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableTranslate = true;
    viewer.scene.screenSpaceCameraController.enableZoom = true;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 80;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 2000;

    // Add sidebar layer toggling logic
    setupSidebarLayerToggles();

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

// Call initialize on load
initialize();
