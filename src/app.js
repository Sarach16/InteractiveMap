import './styles.css';
import {
  Viewer,
  Ion,
  IonImageryProvider,
  Cartesian3,
  Math as CesiumMath,
  HeadingPitchRange,
  createGooglePhotorealistic3DTileset,
  ShadowMode
} from 'cesium';





// Set the Cesium Ion access token
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
