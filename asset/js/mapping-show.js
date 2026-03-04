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

  // Move sidebar to body level for proper z-index stacking with fixed position
  const sidebar = $("#mapping-view-sidebar");
  if (sidebar.length) {
    sidebar.appendTo("body");
    
    // Position sidebar below the user-bar
    const userBar = $("#user-bar");
    if (userBar.length) {
      const updateSidebarPosition = function() {
        const userBarBottom = userBar.offset().top + userBar.outerHeight();
        const scrollTop = $(window).scrollTop();
        
        if (scrollTop >= userBarBottom) {
          // User-bar is scrolled out of view, expand sidebar to full height
          sidebar.css("top", "0");
          sidebar.css("height", "100vh");
        } else {
          // User-bar is visible, position sidebar below it
          const userBarHeight = userBar.outerHeight() || 0;
          sidebar.css("top", userBarHeight + "px");
          sidebar.css("height", "calc(100vh - " + userBarHeight + "px)");
        }
      };
      
      // Initial positioning
      updateSidebarPosition();
      
      // Update on scroll
      $(window).on("scroll", updateSidebarPosition);
    }
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

  // Add controls to map
  MappingModule.addFilterToggleControl(map);
  
  let timelineToggleControlElement = MappingModule.addTimelineToggleControl(map);

  // Clustering Toggle Control
  map.clusteringEnabled = true;
  map._layerVisibilityMap = new Map(); // Track which layers should be visible

  MappingModule.addClusteringToggleControl(map, featuresPoint, featuresPoly);

  // Add the filters menu control
  if (typeof L.Control.FiltersMenu !== 'undefined') {
    map.addControl(new L.Control.FiltersMenu());
  } else {
    console.error('L.Control.FiltersMenu is not available');
  }

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
      // Enable timeline toggle in filters menu
      if (map._filtersMenuControl) {
        map._filtersMenuControl.enableTimelineToggle();
      }
    } else {
      console.log("Not enough unique dates for timeline (need at least 2)");
      // Hide the timeline container and toggle button if there are not enough unique dates
      timelineContainer.hide();
      if (timelineToggleControlElement) {
        timelineToggleControlElement.style.display = "none";
      }
      // Disable timeline toggle in filters menu
      if (map._filtersMenuControl) {
        map._filtersMenuControl.disableTimelineToggle();
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
      $("#mapping-view-sidebar").removeClass("active"); // Site
    }
  });

  // Close sidebar when clicking on the map
  map.on("click", function () {
    if (window.mappingIsAdmin) {
      Omeka.closeSidebar($("#mapping-view-sidebar"));
    } else {
      $("#mapping-view-sidebar").removeClass("active");
    }
  });

  // Close sidebar when clicking outside of it (on the page)
  $(document).on("click", function (e) {
    const sidebar = $("#mapping-view-sidebar");
    if (window.mappingIsAdmin) {
      // Admin mode: let Omeka handle sidebar state
      return;
    }
    // Client mode: close if clicking outside sidebar
    if (sidebar.hasClass("active") && !sidebar.is(e.target) && sidebar.has(e.target).length === 0) {
      sidebar.removeClass("active");
    }
  });

  // Handle fullscreen mode - ensure legend stays visible and positioned correctly
  map.on("enterFullscreen", function () {
    const mapContainer = map.getContainer();
    const sidebar = $("#mapping-view-sidebar");

    // Move sidebar into fullscreen container
    if (sidebar.length) {
      sidebar.appendTo(mapContainer);
      // Force sidebar to be visible in fullscreen
      sidebar.css("position", "fixed");
      sidebar.css("top", "0");
      sidebar.css("right", "0");
      sidebar.css("height", "100vh");
      sidebar.css("width", "30%");
    }

    // Add fullscreen class to body for additional styling
    $("body").addClass("mapping-fullscreen-active");
  });

  map.on("exitFullscreen", function () {
    const legend = $(".mapping-map-legend");
    const controls = $(".mapping-map-controls");
    const sidebar = $("#mapping-view-sidebar");
    const mapContainer = $(".mapping-map-container");

    if (legend.length && legend.parent()[0] !== controls[0]) {
      legend.appendTo(controls);
    }

    // Move sidebar back to map container and clear inline styles
    if (sidebar.length && mapContainer.length) {
      sidebar.appendTo(mapContainer);
      sidebar.css("position", "");
      sidebar.css("top", "");
      sidebar.css("right", "");
      sidebar.css("height", "");
      sidebar.css("width", "");
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
    feature["o:label"] || "";

  // Description
  sidebar.querySelector(".sidebar-description").innerHTML =
    feature["o:description"] || "";

  // Media
  const mediaContainer = sidebar.querySelector(".sidebar-media");
  mediaContainer.innerHTML = "";

  if (feature.media_url) {
    const img = document.createElement("img");
    img.src = feature.media_url;
    img.alt = feature["o:label"] || "";
    mediaContainer.appendChild(img);
  }

  // Initialize description toggle using shared function from MappingModule
  // Use setTimeout to ensure DOM is fully updated before initializing toggle
  window.setTimeout(() => {
    MappingModule.initializeDescriptionToggle("#mapping-view-sidebar");
  }, 150);

  $("#mapping-view-sidebar").addClass("active");
}
