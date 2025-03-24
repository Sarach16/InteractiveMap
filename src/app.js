// Get the Cesium access token from environment variables
const accessToken = import.meta.env.VITE_CESIUM_ACCESS_TOKEN;
Cesium.Ion.defaultAccessToken = accessToken;


// Initial campus locations (you can expand this later)
const campusLocations = [
    {
        name: "Main Building",
        longitude: -118.1435, // Replace with your actual campus longitude
        latitude: 34.0522,    // Replace with your actual campus latitude
        description: "Central campus building"
    },
    {
        name: "Science Center",
        longitude: -118.1440,
        latitude: 34.0525,
        description: "Science and research building"
    },
    {
        name: "Library",
        longitude: -118.1425,
        latitude: 34.0530,
        description: "Campus library and study center"
    },
    {
        name: "Student Center",
        longitude: -118.1445,
        latitude: 34.0515,
        description: "Student activities and services"
    }
];

// Initialize the Cesium Viewer
const viewer = new Cesium.Viewer('cesiumContainer', {
    imageryProvider: new Cesium.TileMapServiceImageryProvider({
        url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
    }),
    baseLayerPicker: false,
    geocoder: false
});

// Function to add location markers
function addLocationMarkers() {
    campusLocations.forEach(location => {
        viewer.entities.add({
            name: location.name,
            position: Cesium.Cartesian3.fromDegrees(location.longitude, location.latitude),
            point: {
                pixelSize: 10,
                color: Cesium.Color.RED
            },
            label: {
                text: location.name,
                font: '14pt sans-serif',
                pixelOffset: new Cesium.Cartesian2(0, -20),
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE
            },
            description: location.description
        });
    });

    // Fly to the first location to center the map
    if (campusLocations.length > 0) {
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                campusLocations[0].longitude, 
                campusLocations[0].latitude, 
                1000 // altitude in meters
            )
        });
    }
}

// Search functionality
document.getElementById('search-btn').addEventListener('click', () => {
    const searchTerm = document.getElementById('location-search').value.toLowerCase();
    const foundLocation = campusLocations.find(loc => 
        loc.name.toLowerCase().includes(searchTerm)
    );

    if (foundLocation) {
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                foundLocation.longitude, 
                foundLocation.latitude, 
                500 // closer zoom for specific locations
            )
        });
    } else {
        alert('Location not found');
    }
});

// Directions button (placeholder functionality)
document.getElementById('directions-btn').addEventListener('click', () => {
    alert('Directions feature coming soon! This will be implemented in a future version.');
});

// Add markers when the page loads
addLocationMarkers();