$(document).ready(function () {
  let mappingSidebarOpen = false;
  let lastClickedLayer = null;
  let allLoadedFeatures = []; // Store all features with their dates for timeline

  const mappingMap = $("#mapping-map");

  const mappingData = mappingMap.data("mapping");

  if (!mappingMap.length) {
    console.error("No #mapping-map element found!");
    return;
  }

  // Check if the map is already initialized
  let map, features, featuresPoint, featuresPoly, baseMaps;

  if (mappingMap[0].mapping_map) {
    // Map was already initialized by mapping-block.js
    map = mappingMap[0].mapping_map;
    features = map._mappingFeatures;
    featuresPoint = map._mappingFeaturesPoint;
    featuresPoly = map._mappingFeaturesPoly;
    baseMaps = map._mappingBaseMaps || {};
  } else {
    // Initialize new map
    [map, features, featuresPoint, featuresPoly, baseMaps] =
      MappingModule.initializeMap(
        mappingMap[0],
        {},
        {
          disableClustering: mappingMap.data("disable-clustering"),
          basemapProvider: mappingMap.data("basemap-provider"),
        },
      );
  }

  MappingModule.bindLegendFilters(
    map,
    mappingMap[0],
    featuresPoint,
    featuresPoly,
  );

  // Move timeline into map container immediately
  const timelineContainer = $(".timeline-date-slider-container");
  if (timelineContainer.length) {
    timelineContainer.appendTo(map.getContainer());
    timelineContainer.hide(); // Hide by default until we know if there are features with dates

    // Stop map interaction when interacting with timeline
    timelineContainer.on("mousedown touchstart", function (e) {
      L.DomEvent.stopPropagation(e);
    });

    // Stop propagation on slider inputs specifically
    timelineContainer
      .find(".timeline-slider-input")
      .on("mousedown touchstart mouseup touchend", function (e) {
        L.DomEvent.stopPropagation(e);
      });
  }

  // Filter Toggle Control
  const FilterToggleControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd: function (map) {
      const container = L.DomUtil.create(
        "div",
        "mapping-filter-toggle-control leaflet-bar",
      );
      const link = L.DomUtil.create(
        "a",
        "mapping-filter-toggle-link",
        container,
      );

      link.innerHTML =
        '<svg viewBox="0 0 24 24" style="width: 18px; height: 18px;" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 11.1707L6 4C6 3.44771 5.55228 3 5 3C4.44771 3 4 3.44771 4 4L4 11.1707C2.83481 11.5825 2 12.6938 2 14C2 15.3062 2.83481 16.4175 4 16.8293L4 20C4 20.5523 4.44772 21 5 21C5.55228 21 6 20.5523 6 20L6 16.8293C7.16519 16.4175 8 15.3062 8 14C8 12.6938 7.16519 11.5825 6 11.1707ZM5 13C4.44772 13 4 13.4477 4 14C4 14.5523 4.44772 15 5 15C5.55228 15 6 14.5523 6 14C6 13.4477 5.55228 13 5 13Z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M19 21C18.4477 21 18 20.5523 18 20L18 18C18 17.9435 18.0047 17.8881 18.0137 17.8341C16.8414 17.4262 16 16.3113 16 15C16 13.6887 16.8414 12.5738 18.0137 12.1659C18.0047 12.1119 18 12.0565 18 12L18 4C18 3.44771 18.4477 3 19 3C19.5523 3 20 3.44771 20 4L20 12C20 12.0565 19.9953 12.1119 19.9863 12.1659C21.1586 12.5738 22 13.6887 22 15C22 16.3113 21.1586 17.4262 19.9863 17.8341C19.9953 17.8881 20 17.9435 20 18V20C20 20.5523 19.5523 21 19 21ZM18 15C18 14.4477 18.4477 14 19 14C19.5523 14 20 14.4477 20 15C20 15.5523 19.5523 16 19 16C18.4477 16 18 15.5523 18 15Z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M9 9C9 7.69378 9.83481 6.58254 11 6.17071V4C11 3.44772 11.4477 3 12 3C12.5523 3 13 3.44772 13 4V6.17071C14.1652 6.58254 15 7.69378 15 9C15 10.3113 14.1586 11.4262 12.9863 11.8341C12.9953 11.8881 13 11.9435 13 12L13 20C13 20.5523 12.5523 21 12 21C11.4477 21 11 20.5523 11 20L11 12C11 11.9435 11.0047 11.8881 11.0137 11.8341C9.84135 11.4262 9 10.3113 9 9ZM11 9C11 8.44772 11.4477 8 12 8C12.5523 8 13 8.44772 13 9C13 9.55229 12.5523 10 12 10C11.4477 10 11 9.55229 11 9Z"/></svg>';
      link.href = "#";
      link.title = "Toggle marker type filter";
      link.style.display = "flex";
      link.style.alignItems = "center";
      link.style.justifyContent = "center";
      link.href = "#";
      link.title = "Toggle marker type filter";
      link.style.fontSize = "16px";

      let filterVisible = true;
      const legendContainer = $(".mapping-map-legend");

      L.DomEvent.on(link, "mousedown", L.DomEvent.stopPropagation)
        .on(link, "dblclick", L.DomEvent.stopPropagation)
        .on(link, "click", L.DomEvent.stopPropagation)
        .on(link, "click", L.DomEvent.preventDefault)
        .on(link, "click", function () {
          filterVisible = !filterVisible;

          if (filterVisible) {
            legendContainer.removeClass("filters-hidden");
            link.style.opacity = "1";
          } else {
            legendContainer.addClass("filters-hidden");
            link.style.opacity = "0.4";
          }
        });

      return container;
    },
  });

  map.addControl(new FilterToggleControl());

  // Timeline Toggle Control
  let timelineToggleControlElement = null;
  const TimelineToggleControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd: function (map) {
      const container = L.DomUtil.create(
        "div",
        "mapping-timeline-toggle-control leaflet-bar",
      );
      timelineToggleControlElement = container; // Store reference to the control
      container.style.display = "none"; // Hide by default until we know if there are features with dates
      const link = L.DomUtil.create(
        "a",
        "mapping-timeline-toggle-link",
        container,
      );

      link.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g id="Calendar / Calendar_Days"> <path id="Vector" d="M8 4H7.2002C6.08009 4 5.51962 4 5.0918 4.21799C4.71547 4.40973 4.40973 4.71547 4.21799 5.0918C4 5.51962 4 6.08009 4 7.2002V8M8 4H16M8 4V2M16 4H16.8002C17.9203 4 18.4796 4 18.9074 4.21799C19.2837 4.40973 19.5905 4.71547 19.7822 5.0918C20 5.5192 20 6.07899 20 7.19691V8M16 4V2M4 8V16.8002C4 17.9203 4 18.4801 4.21799 18.9079C4.40973 19.2842 4.71547 19.5905 5.0918 19.7822C5.5192 20 6.07899 20 7.19691 20H16.8031C17.921 20 18.48 20 18.9074 19.7822C19.2837 19.5905 19.5905 19.2842 19.7822 18.9079C20 18.4805 20 17.9215 20 16.8036V8M4 8H20M16 16H16.002L16.002 16.002L16 16.002V16ZM12 16H12.002L12.002 16.002L12 16.002V16ZM8 16H8.002L8.00195 16.002L8 16.002V16ZM16.002 12V12.002L16 12.002V12H16.002ZM12 12H12.002L12.002 12.002L12 12.002V12ZM8 12H8.002L8.00195 12.002L8 12.002V12Z" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g> </g></svg>';
      link.href = "#";
      link.title = "Toggle timeline";
      link.style.display = "flex";
      link.style.alignItems = "center";
      link.style.justifyContent = "center";
      link.style.fontSize = "16px";

      let timelineVisible = true;
      const timelineContainer = $(".timeline-date-slider-container");

      L.DomEvent.on(link, "mousedown", L.DomEvent.stopPropagation)
        .on(link, "dblclick", L.DomEvent.stopPropagation)
        .on(link, "click", L.DomEvent.stopPropagation)
        .on(link, "click", L.DomEvent.preventDefault)
        .on(link, "click", function () {
          timelineVisible = !timelineVisible;

          if (timelineVisible) {
            timelineContainer.removeClass("hidden");
            link.style.opacity = "1";
          } else {
            timelineContainer.addClass("hidden");
            link.style.opacity = "0.4";
          }
        });

      return container;
    },
  });

  map.addControl(new TimelineToggleControl());

  // Clustering Toggle Control
  map.clusteringEnabled = true;
  map._layerVisibilityMap = new Map(); // Track which layers should be visible

  const ClusteringToggleControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd: function (map) {
      const container = L.DomUtil.create(
        "div",
        "mapping-clustering-toggle-control leaflet-bar",
      );
      const link = L.DomUtil.create(
        "a",
        "mapping-clustering-toggle-link",
        container,
      );

      link.innerHTML =
        '<svg viewBox="0 0 24 24" style="width: 18px; height: 18px;" xmlns="http://www.w3.org/2000/svg" fill="none"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 16.016c1.245.529 2 1.223 2 1.984 0 1.657-3.582 3-8 3s-8-1.343-8-3c0-.76.755-1.456 2-1.984"></path><path stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8.444C17 11.537 12 17 12 17s-5-5.463-5-8.556C7 5.352 9.239 3 12 3s5 2.352 5 5.444z"></path><circle cx="12" cy="8" r="1" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></circle></g></svg>';
      link.href = "#";
      link.title = "Toggle clustering";
      link.style.display = "flex";
      link.style.alignItems = "center";
      link.style.justifyContent = "center";
      link.style.fontSize = "16px";

      L.DomEvent.on(link, "mousedown", L.DomEvent.stopPropagation)
        .on(link, "dblclick", L.DomEvent.stopPropagation)
        .on(link, "click", L.DomEvent.stopPropagation)
        .on(link, "click", L.DomEvent.preventDefault)
        .on(link, "click", function () {
          map.clusteringEnabled = !map.clusteringEnabled;

          if (map.clusteringEnabled) {
            // Re-enable clustering: show cluster groups
            // Remove all direct layers from map
            if (map._mappingAllLayers) {
              map._mappingAllLayers.forEach((layer) => {
                if (map.hasLayer(layer)) {
                  map.removeLayer(layer);
                }
              });
            }
            // Show cluster groups
            if (!map.hasLayer(featuresPoint)) {
              map.addLayer(featuresPoint);
            }
            if (!map.hasLayer(featuresPoly)) {
              map.addLayer(featuresPoly);
            }
            link.style.opacity = "1";
          } else {
            // Disable clustering: hide cluster groups, show individual layers
            map.removeLayer(featuresPoint);
            map.removeLayer(featuresPoly);

            // Track current visibility state from cluster groups
            map._layerVisibilityMap.clear();
            if (featuresPoint) {
              featuresPoint.eachLayer((layer) => {
                map._layerVisibilityMap.set(layer, true);
              });
            }
            if (featuresPoly) {
              featuresPoly.eachLayer((layer) => {
                map._layerVisibilityMap.set(layer, true);
              });
            }

            // Add individual layers to map
            if (map._mappingAllLayers) {
              map._mappingAllLayers.forEach((layer) => {
                if (!map.hasLayer(layer)) {
                  map.addLayer(layer);
                }
              });
            }

            link.style.opacity = "0.4";
          }
        });

      return container;
    },
  });

  map.addControl(new ClusteringToggleControl());

  // Sync cluster group changes to map when clustering is disabled
  const syncLayerVisibility = function () {
    if (!map.clusteringEnabled && map._mappingAllLayers) {
      map._mappingAllLayers.forEach((layer) => {
        const inPoint = featuresPoint && featuresPoint.hasLayer(layer);
        const inPoly = featuresPoly && featuresPoly.hasLayer(layer);
        const inClusterGroup = inPoint || inPoly;
        const onMap = map.hasLayer(layer);

        // Sync: if in cluster group but not on map, add it; if not in cluster group but on map, remove it
        if (inClusterGroup && !onMap) {
          map.addLayer(layer);
        } else if (!inClusterGroup && onMap) {
          map.removeLayer(layer);
        }
      });
    }
  };

  // Monitor cluster groups for changes when clustering is disabled
  if (featuresPoint) {
    featuresPoint.on("layeradd layerremove", syncLayerVisibility);
  }
  if (featuresPoly) {
    featuresPoly.on("layeradd layerremove", syncLayerVisibility);
  }

  let defaultBounds = null;
  if (mappingData && mappingData["o-module-mapping:bounds"] !== null) {
    const bounds = mappingData["o-module-mapping:bounds"].split(",");
    const southWest = [bounds[1], bounds[0]];
    const northEast = [bounds[3], bounds[2]];
    defaultBounds = [southWest, northEast];
  }

  const setView = function () {
    if (defaultBounds) {
      map.fitBounds(defaultBounds);
    } else {
      const bounds = features.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  };

  const onFeaturesLoad = function () {
    if (!map.mapping_map_interaction) {
      // Call setView only when there was no map interaction. This prevents the
      // map view from changing after a change has already been done.
      setView();
    }
  };

  /**
   * Initialize the timeline date slider
   */
  const initializeTimelineSlider = function () {
    if (window.timelineInitialized) {
      console.log("Timeline already initialized");
      return;
    }

    // First check if TimelineDateSlider is available
    if (typeof TimelineDateSlider === "undefined") {
      console.warn("TimelineDateSlider not yet available, will retry...");
      return;
    }

    // Collect all features with their dates from the map layers
    allLoadedFeatures = [];

    if (map._mappingAllLayers) {
      map._mappingAllLayers.forEach((layer) => {
        const dates = layer._mappingDates || [];

        allLoadedFeatures.push({
          featureId: layer._mappingFeatureId,
          resourceId: layer._mappingResourceId,
          dates: dates,
          layer: layer,
          featureGroup: layer._mappingFeatureGroup,
          typeId: layer._mappingTypeId,
        });
      });
    } else {
      console.log("No _mappingAllLayers found on map");
      return;
    }

    // Only initialize timeline if there are features with dates
    const featuresWithDates = allLoadedFeatures.filter(
      (f) => f.dates && f.dates.length > 0,
    );
    console.log("Features with dates:", featuresWithDates.length);

    // Count unique dates across all features
    const uniqueDates = new Set();
    featuresWithDates.forEach((f) => {
      f.dates.forEach((date) => {
        uniqueDates.add(date);
      });
    });
    const uniqueDateCount = uniqueDates.size;
    console.log("Unique dates:", uniqueDateCount);

    if (featuresWithDates.length > 0 && uniqueDateCount > 1) {
      const timelineData = allLoadedFeatures.map((f) => [
        f.featureId,
        f.resourceId,
        null, // geography (not needed for filtering)
        null, // markerColor (not needed for filtering)
        f.typeId,
        f.dates, // dates at index 5 (same as API response)
      ]);

      TimelineDateSlider.init({
        features: timelineData,
        containerSelector: ".timeline-date-slider-container",
        onDateRangeChange: handleDateRangeChange,
      });

      window.timelineInitialized = true;
      // Show timeline elements
      timelineContainer.show();
      if (timelineToggleControlElement) {
        timelineToggleControlElement.style.display = "";
      }
    } else {
      console.log("Not enough unique dates for timeline (need at least 2)");
      // Hide the timeline container and toggle button if there are not enough unique dates
      timelineContainer.hide();
      if (timelineToggleControlElement) {
        timelineToggleControlElement.style.display = "none";
      }
    }
  };

  /**
   * Handle date range changes from the timeline slider
   */
  const handleDateRangeChange = function (result) {
    const minDate = result.minDate;
    const maxDate = result.maxDate;
    const minDateMS = minDate.getTime();
    const maxDateMS = maxDate.getTime();

    // Show/hide layers based on date range
    if (map._mappingAllLayers) {
      map._mappingAllLayers.forEach((layer) => {
        const dates = layer._mappingDates || [];

        // Determine if layer should be visible
        let shouldShow = true;

        if (dates.length > 0) {
          // Check if any date falls within the range
          shouldShow = dates.some((dateStr) => {
            const date = TimelineDateSlider.parseDate(dateStr);
            if (!date) return false;

            const dateMS = date.getTime();
            return dateMS >= minDateMS && dateMS <= maxDateMS;
          });
        }

        // Handle both clustered and non-clustered modes
        if (map.clusteringEnabled) {
          // Check both point and polygon cluster groups and remove/add accordingly
          if (shouldShow) {
            // Add layer back if not present
            if (featuresPoint && !featuresPoint.hasLayer(layer)) {
              featuresPoint.addLayer(layer);
            }
            if (featuresPoly && !featuresPoly.hasLayer(layer)) {
              featuresPoly.addLayer(layer);
            }
            layer.setOpacity(1);
          } else {
            // Remove layer from cluster groups
            if (featuresPoint && featuresPoint.hasLayer(layer)) {
              featuresPoint.removeLayer(layer);
            }
            if (featuresPoly && featuresPoly.hasLayer(layer)) {
              featuresPoly.removeLayer(layer);
            }
            layer.setOpacity(0);
            // Close any open popups
            if (layer.closePopup) {
              layer.closePopup();
            }
          }
        } else {
          // Non-clustered mode: manage direct map visibility
          if (shouldShow) {
            if (!map.hasLayer(layer)) {
              map.addLayer(layer);
            }
            layer.setOpacity(1);
          } else {
            if (map.hasLayer(layer)) {
              map.removeLayer(layer);
            }
            layer.setOpacity(0);
            // Close any open popups
            if (layer.closePopup) {
              layer.closePopup();
            }
          }
        }
      });
    }
  };

  // Only load features if the map was just initialized (not reused from mapping-block.js)
  if (!mappingMap[0].mapping_map) {
    MappingModule.loadFeaturesAsync(
      map,
      featuresPoint,
      featuresPoly,
      mappingMap.data("featuresUrl"),
      mappingMap.data("featurePopupContentUrl"),
      JSON.stringify(mappingMap.data("itemsQuery")),
      JSON.stringify(mappingMap.data("featuresQuery")),
      onFeaturesLoad,
    );
  } else {
    // Map was already initialized, just set the view and initialize timeline
    console.log(
      "Map already initialized with features, skipping feature loading",
    );
    onFeaturesLoad();
  }

  // Fallback: Try to initialize timeline after a delay to ensure features and TimelineDateSlider are loaded
  let attemptCount = 0;
  const timelineInitTimer = setInterval(function () {
    attemptCount++;

    const hasLayers = map._mappingAllLayers && map._mappingAllLayers.length > 0;
    const hasSlider = typeof TimelineDateSlider !== "undefined";
    const notInitialized = !window.timelineInitialized;

    if (attemptCount === 1 || attemptCount % 5 === 0) {
      console.log("Timeline check (attempt " + attemptCount + "):", {
        TimelineDateSliderAvailable: hasSlider,
        MapLayersCount: hasLayers ? map._mappingAllLayers.length : 0,
        TimelineNotInitialized: notInitialized,
      });
    }

    if (notInitialized && hasLayers && hasSlider) {
      console.log("✓ All conditions met! Initializing timeline...");
      clearInterval(timelineInitTimer);
      initializeTimelineSlider();
    }

    if (attemptCount >= 20) {
      // Stop trying after 20 seconds
      clearInterval(timelineInitTimer);
      console.log(
        "Timeline initialization stopped after " + attemptCount + " attempts",
      );
      console.log("Final state:", {
        TimelineDateSliderAvailable: hasSlider,
        MapLayersCount: hasLayers ? map._mappingAllLayers.length : 0,
        TimelineInitialized: window.timelineInitialized,
      });
    }
  }, 1000);

  // Switching sections changes map dimensions, so make the necessary adjustments.
  $("#mapping-section").one("o:section-opened", function (e) {
    map.invalidateSize();
    setView();
  });

  $("#mapping-view-sidebar .sidebar-close").on("click", function (e) {
    e.preventDefault();

    if (window.mappingIsAdmin) {
      Omeka.closeSidebar($("#mapping-view-sidebar")); // Admin
    } else {
      $("#mapping-view-sidebar").hide(); // Site
    }
  });

  map.on("click", function () {
    if (window.mappingIsAdmin) {
      Omeka.closeSidebar($("#mapping-view-sidebar"));
    } else {
      $("#mapping-view-sidebar").hide();
    }
  });

  // Handle fullscreen mode - ensure legend stays visible and positioned correctly
  map.on("enterFullscreen", function () {
    const sidebar = $("#mapping-view-sidebar");
    const mapContainer = map.getContainer();

    // Move sidebar into fullscreen container for better visibility
    if (sidebar.length) {
      sidebar.appendTo(mapContainer);
    }

    // Add fullscreen class to body for additional styling
    $("body").addClass("mapping-fullscreen-active");
  });

  map.on("exitFullscreen", function () {
    const sidebar = $("#mapping-view-sidebar");
    const mapSection = $("#mapping-section");
    const mapContainer = $(".mapping-map-container");

    // Move sidebar back to its original position
    if (sidebar.length && mapSection.length) {
      sidebar.appendTo(mapSection);
    }

    // Move legend back to map container to ensure it stays inside
    const legend = $(".mapping-map-legend");
    const controls = $(".mapping-map-controls");
    if (legend.length && legend.parent()[0] !== controls[0]) {
      legend.appendTo(controls);
    }

    // Remove fullscreen class from body
    $("body").removeClass("mapping-fullscreen-active");
  });
});

function openFeatureSidebar(feature) {
  const sidebar = document.getElementById("mapping-view-sidebar");
  if (!sidebar) return;

  // Marker color
  sidebar.style.setProperty(
    "--marker-color",
    feature["o-module-mapping:marker_color"] || "#3b82f6",
  );

  // Title
  sidebar.querySelector(".sidebar-title").textContent =
    feature["o:title"] || "";

  // Description
  sidebar.querySelector(".sidebar-description").innerHTML =
    feature["o:description"] || "";

  // Media
  const mediaContainer = sidebar.querySelector(".sidebar-media");
  mediaContainer.innerHTML = "";

  if (feature.media_url) {
    const img = document.createElement("img");
    img.src = feature.media_url;
    img.alt = feature["o:title"] || "";
    mediaContainer.appendChild(img);
  }

  $("#mapping-view-sidebar").show();
}
