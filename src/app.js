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
  Color
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

// Initialize the Cesium viewer
const viewer = new Viewer('cesiumContainer', {
  imageryProvider: new IonImageryProvider({ assetId: 2 }),
  
  baseLayerPicker: false,
  geocoder: false,
  sceneModePicker: true,
  navigationHelpButton: false,
  shadows: true,
  terrainShadows: ShadowMode.ENABLED
});

// Load Google Photorealistic 3D Tiles
createGooglePhotorealistic3DTileset()
  .then(tileset => {
    viewer.scene.primitives.add(tileset);

    const targetPosition = Cartesian3.fromDegrees(
      CAMPUS_CENTER.longitude,
      CAMPUS_CENTER.latitude,
      CAMPUS_CENTER.altitude
    );

    viewer.camera.lookAt(
      targetPosition,
      new HeadingPitchRange(
        CesiumMath.toRadians(0),
        CesiumMath.toRadians(-30),
        800
      )
    );
  })
  .catch(error => console.error("Failed to load 3D tiles:", error));

// Limit camera movement
viewer.scene.screenSpaceCameraController.enableRotate = true;
viewer.scene.screenSpaceCameraController.enableTranslate = true;
viewer.scene.screenSpaceCameraController.enableZoom = true;
viewer.scene.screenSpaceCameraController.minimumZoomDistance = 80;
viewer.scene.screenSpaceCameraController.maximumZoomDistance = 1000;

// Load the building data from CSV
fetch('/data/mapData.csv')
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.text();
  })
  .then(csvText => {
    console.log('CSV loaded successfully');
    const parsedData = Papa.parse(csvText, { header: true });
    console.log('Parsed CSV data:', parsedData.data.length, 'rows');

    parsedData.data.forEach(building => {
      if (building.Latitude && building.Longitude) {
        const lat = parseFloat(building.Latitude);
        const lon = parseFloat(building.Longitude);
        console.log(`Creating entity for ${building.Name} at lat: ${lat}, lon: ${lon}`);
        
        viewer.entities.add({
          name: building.Name,
          position: Cartesian3.fromDegrees(lon, lat),
          billboard: {
            image: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDQ4IDQ4Ij48Y2lyY2xlIGN4PSIyNCIgY3k9IjI0IiByPSIyNCIgZmlsbD0icmVkIiBmaWxsLW9wYWNpdHk9IjEiLz48L3N2Zz4=',
            verticalOrigin: 0.5,
            horizontalOrigin: 0.5,
            scale: 1.0,
            heightReference: 1
          }
        });
      }
    });
  })
  .catch(error => {
    console.error('Error loading CSV:', error);
    console.error('Make sure the CSV file is in the public/data directory');
  });

// Set initial camera view
viewer.camera.setView({
  destination: Cartesian3.fromDegrees(
    CAMPUS_CENTER.longitude,
    CAMPUS_CENTER.latitude,
    1000
  ),
  orientation: {
    heading: CesiumMath.toRadians(0),
    pitch: CesiumMath.toRadians(-60),
    roll: 0.0
  }
});
