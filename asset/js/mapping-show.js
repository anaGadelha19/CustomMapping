$(document).ready( function() {

console.log('mapping-show.js loaded');
console.log('mappingIsAdmin:', window.mappingIsAdmin);
    
let mappingSidebarOpen = false;
let lastClickedLayer = null;

const mappingMap = $('#mapping-map');
console.log('mappingMap element:', mappingMap.length, mappingMap);

const mappingData = mappingMap.data('mapping');

if (!mappingMap.length) {
    console.error('No #mapping-map element found!');
    return;
}

const [
    map,
    features,
    featuresPoint,
    featuresPoly,
    baseMaps
] = MappingModule.initializeMap(mappingMap[0], {}, {
    disableClustering: mappingMap.data('disable-clustering'),
    basemapProvider: mappingMap.data('basemap-provider')
});

MappingModule.bindLegendFilters(map, mappingMap[0], featuresPoint, featuresPoly);

console.log('Map initialized:', map);

let defaultBounds = null;
if (mappingData && mappingData['o-module-mapping:bounds'] !== null) {
    const bounds = mappingData['o-module-mapping:bounds'].split(',');
    const southWest = [bounds[1], bounds[0]];
    const northEast = [bounds[3], bounds[2]];
    defaultBounds = [southWest, northEast];
}

const setView = function() {
    if (defaultBounds) {
        map.fitBounds(defaultBounds);
    } else {
        const bounds = features.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, {padding: [50, 50]});
        }
    }
};

const onFeaturesLoad = function() {
    if (!map.mapping_map_interaction) {
        // Call setView only when there was no map interaction. This prevents the
        // map view from changing after a change has already been done.
        setView();
    }
};


MappingModule.loadFeaturesAsync(
    map,
    featuresPoint,
    featuresPoly,
    mappingMap.data('featuresUrl'),
    mappingMap.data('featurePopupContentUrl'),
    JSON.stringify(mappingMap.data('itemsQuery')),
    JSON.stringify(mappingMap.data('featuresQuery')),
    onFeaturesLoad
);

console.log('Features URL:', mappingMap.data('featuresUrl'));
console.log('Popup URL:', mappingMap.data('featurePopupContentUrl'));
console.log('Loading features...');

// Switching sections changes map dimensions, so make the necessary adjustments.
$('#mapping-section').one('o:section-opened', function(e) {
    map.invalidateSize();
    setView();
});


$('#mapping-view-sidebar .sidebar-close').on('click', function(e) {
    e.preventDefault();

    if (window.mappingIsAdmin) {
        Omeka.closeSidebar($('#mapping-view-sidebar')); // Admin
    } else {
        $('#mapping-view-sidebar').hide(); // Site
    }
});


map.on('click', function() {
    if (window.mappingIsAdmin) {
        Omeka.closeSidebar($('#mapping-view-sidebar'));
    } else {
        $('#mapping-view-sidebar').hide();
    }
});

});


function openFeatureSidebar(feature) {
  const sidebar = document.getElementById('mapping-view-sidebar');
  if (!sidebar) return;

  // Marker color
  sidebar.style.setProperty(
    '--marker-color',
    feature['o-module-mapping:marker_color'] || '#3b82f6'
  );

  // Title
  sidebar.querySelector('.sidebar-title').textContent =
    feature['o:title'] || '';

  // Description
  sidebar.querySelector('.sidebar-description').innerHTML =
    feature['o:description'] || '';

  // Media
  const mediaContainer = sidebar.querySelector('.sidebar-media');
  mediaContainer.innerHTML = '';

  if (feature.media_url) {
    const img = document.createElement('img');
    img.src = feature.media_url;
    img.alt = feature['o:title'] || '';
    mediaContainer.appendChild(img);
  }

  $('#mapping-view-sidebar').show();
}

