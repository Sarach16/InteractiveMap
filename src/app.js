import './styles.css';
import {
  Viewer,
  Ion,
  IonImageryProvider,
  Cartesian3,
  Math as CesiumMath,
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
} from 'cesium';
import Papa from 'papaparse';

// !!Remove before Deployment Set the Cesium Ion access token
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ACCESS_TOKEN;
console.log("Cesium is working!");
console.log("Access token:", import.meta.env.VITE_CESIUM_ACCESS_TOKEN);

// Grossmont College center
const CAMPUS_CENTER = {
  longitude: -117.00523,
  latitude: 32.81547,
  altitude: 500
};

// Get loading overlay element
const loadingOverlay = document.getElementById('loadingOverlay');

// Initialize the Cesium viewer
const viewer = new Viewer('cesiumContainer', {
  imageryProvider: new IonImageryProvider({ assetId: 2 }),
  terrain: Terrain.fromWorldTerrain(),
  baseLayerPicker: false,
  geocoder: false,
  sceneModePicker: true,
  navigationHelpButton: false,
  shadows: false,                  // Disable shadows globally
  terrainShadows: ShadowMode.DISABLED,  // Disable terrain shadows
  timeline: false,
  animation: false,
  infoBox: true
});

console.log("Viewer initialized");

// Disable shadow effects for all primitives in the scene
viewer.scene.globe.shadows = ShadowMode.DISABLED;
viewer.scene.shadowMap.enabled = false;

// Function to hide loading overlay
function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
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
      <h2 style="color: #003366; margin-top: 0;">Building ${properties.buildingNumber}</h2>
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
    const response = await fetch('/data/mapData.csv');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const csvText = await response.text();
    console.log('CSV loaded successfully');
    
    const parsedData = Papa.parse(csvText, { header: true }).data;
    console.log('Parsed CSV data:', parsedData.length, 'rows');
    
    // Convert to GeoJSON
    const geojsonData = csvToGeoJson(parsedData);
    
    // Create data source
    const buildingSource = await GeoJsonDataSource.load(geojsonData);
    
    // Customize entities
    buildingSource.entities.values.forEach(entity => {
      const properties = entity.properties;
      const buildingId = properties.buildingNumber?.getValue() || '';
      
      // Set description
      entity.description = buildCustomDescription(properties);
      
      // Replace the default point with a better visualized entity
      entity.billboard = {
        image: '/images/building-icon.png',
        verticalOrigin: 0.5,
        horizontalOrigin: 0.5,
        scale: 0.5,
        color: Color.WHITE,  // Use a single color for all buildings
        heightReference: 1,
        shadows: ShadowMode.DISABLED
      };
      
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
        heightReference: 1
      };
    });
    
    // Add to viewer
    viewer.dataSources.add(buildingSource);
    
    // Optional: Set up a click handler for identifying OSM buildings
    setupClickHandlerForOsmBuildings();
    
    return buildingSource;
  } catch (error) {
    console.error('Error loading building data:', error);
    return null;
  }
}

// Setup click handler to identify OSM buildings
function setupClickHandlerForOsmBuildings() {
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  
  handler.setInputAction(function(click) {
    const pickedFeature = viewer.scene.pick(click.position);
    
    if (pickedFeature && pickedFeature.id) {
      // We already handle entities with the standard Cesium handling
      return;
    }
    
    // For OSM buildings or other primitive features
    if (pickedFeature && pickedFeature.primitive) {
      console.log('Picked OSM building:', pickedFeature);
      
      // You can add custom handling for OSM buildings here
      // For example, show a modal with a form to add this building to your database
      
      // Example: Show coordinates of clicked building
      const cartesian = viewer.scene.pickPosition(click.position);
      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);
        
        console.log(`OSM Building at: Lat ${latitude.toFixed(6)}, Lon ${longitude.toFixed(6)}`);
        
        // Optional: Show a custom popup for unlabeled buildings
        showUnlabeledBuildingPopup(cartesian, longitude, latitude);
      }
    }
  }, ScreenSpaceEventType.LEFT_CLICK);
}

// Function to show a popup for unlabeled buildings
function showUnlabeledBuildingPopup(position, longitude, latitude) {
  // Create a temporary entity to show info about the unlabeled building
  const unlabeledEntity = viewer.entities.add({
    position: position,
    name: 'Unlabeled Building',
    description: `
      <div style="font-family: Arial, sans-serif; padding: 10px;">
        <h2 style="color: #003366;">Unlabeled Building</h2>
        <p>This building doesn't have custom information yet.</p>
        <p>Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}</p>
        <p>You can add this building to your database to customize the information.</p>
      </div>
    `,
    billboard: {
      image: '/images/unlabeled-building-icon.png', // Create this icon
      scale: 0.5,
      shadows: ShadowMode.DISABLED  // Disable shadows for this billboard
    }
  });
  
  // Select this entity to show the infobox
  viewer.selectedEntity = unlabeledEntity;
  
  // Remove after a while to avoid cluttering the map
  setTimeout(() => {
    viewer.entities.remove(unlabeledEntity);
  }, 30000); // Remove after 30 seconds
}

// Initialize application
async function initialize() {
  try {
    // Load tilesets
    const [photorealisticTileset, osmBuildingsTileset] = await Promise.all([
      createGooglePhotorealistic3DTileset(),
      createOsmBuildingsAsync()
    ]);
    
    console.log("Tilesets loaded successfully");
    viewer.scene.primitives.add(photorealisticTileset);
    viewer.scene.primitives.add(osmBuildingsTileset);
    
    // Disable shadows for OSM buildings tileset
    osmBuildingsTileset.shadows = ShadowMode.DISABLED;
    
    // Make OSM buildings selectable and modify style (including shadow properties)
    osmBuildingsTileset.style = new Cesium.Cesium3DTileStyle({
      color: 'color("white", 0.7)',
      show: true
    });
    
    // Disable shadows for photorealistic tileset
    photorealisticTileset.shadows = ShadowMode.DISABLED;
    
    // Add building data
    await addBuildingData();
    
    // Set initial view
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
      duration: 0,
      complete: hideLoading
    });
    
    // Add search functionality
    setupBuildingSearch();
    
  } catch (error) {
    console.error("Initialization error:", error);
    hideLoading();
  }
}

// Set up a search function for buildings
function setupBuildingSearch() {
  const searchInput = document.getElementById('location-search');
  const searchButton = document.getElementById('search-button');
  
  if (searchInput && searchButton) {
    searchButton.addEventListener('click', () => {
      const searchText = searchInput.value.toLowerCase();
      
      if (!searchText) return;
      
      // Search all entities
      let found = false;
      viewer.dataSources.get(0)?.entities.values.forEach(entity => {
        const name = entity.properties.name?.getValue().toLowerCase() || '';
        const buildingNumber = entity.properties.buildingNumber?.getValue().toLowerCase() || '';
        const description = entity.properties.description?.getValue().toLowerCase() || '';
        
        if (name.includes(searchText) || 
            buildingNumber.includes(searchText) || 
            description.includes(searchText)) {
          
          found = true;
          // Fly to the building
          viewer.flyTo(entity, {
            duration: 2,
            offset: new HeadingPitchRange(0, -CesiumMath.toRadians(45), 200)
          });
          
          // Select the entity to show its info
          viewer.selectedEntity = entity;
        }
      });
      
      if (!found) {
        alert('Building not found. Try a different search term.');
      }
    });
    
    // Add enter key support
    searchInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        searchButton.click();
      }
    });
  }
}

// Limit camera movement
viewer.scene.screenSpaceCameraController.enableRotate = true;
viewer.scene.screenSpaceCameraController.enableTranslate = true;
viewer.scene.screenSpaceCameraController.enableZoom = true;
viewer.scene.screenSpaceCameraController.minimumZoomDistance = 80;
viewer.scene.screenSpaceCameraController.maximumZoomDistance = 2000;

// Initialize the application
initialize();
