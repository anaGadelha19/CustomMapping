$(document).ready(function () {
  const repairDetailedMappingTabLink = function () {
    const section = $("#custom-mapping-section, #mapping-section").first();
    if (!section.length) {
      return;
    }
    const sectionId = section.attr("id") || "custom-mapping-section";
    $(
      '.section-nav a[href="#undefined"], .section-nav a[href="undefined"], .section-nav a[data-target="undefined"]',
    ).each(function () {
      $(this).attr("href", `#${sectionId}`);
      $(this).attr("data-target", sectionId);
      $(this).attr("aria-controls", sectionId);
    });
  };

  repairDetailedMappingTabLink();
  setTimeout(repairDetailedMappingTabLink, 0);
  setTimeout(repairDetailedMappingTabLink, 150);

  $(document).on(
    "click",
    '.section-nav a[href="#undefined"], .section-nav a[href="undefined"], .section-nav a[data-target="undefined"]',
    function (e) {
      const section = $("#custom-mapping-section, #mapping-section").first();
      if (!section.length) {
        return;
      }
      const sectionId = section.attr("id") || "custom-mapping-section";
      $(this).attr("href", `#${sectionId}`);
      $(this).attr("data-target", sectionId);
      $(this).attr("aria-controls", sectionId);
      e.preventDefault();
      window.location.hash = sectionId;
      section.trigger("o:section-opened");
    },
  );

  let allLoadedFeatures = []; // Store all features with their dates for timeline

  const mappingMap = $("#custom-mapping-map").length
    ? $("#custom-mapping-map").first()
    : $("#mapping-map").first();
  const mapSection = $("#custom-mapping-section").length
    ? $("#custom-mapping-section").first()
    : $("#mapping-section").first();
  const ActiveMappingModule = window.CustomMappingModule || window.MappingModule;

  const mappingData = mappingMap.data("mapping");

  if (!mappingMap.length) {
    console.error("No map element found (#custom-mapping-map or #mapping-map)!");
    return;
  }

  if (!ActiveMappingModule) {
    console.error("No mapping module object found (CustomMappingModule/MappingModule)");
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
      ActiveMappingModule.initializeMap(
        mappingMap[0],
        {},
        {
          disableClustering: mappingMap.data("disable-clustering"),
          basemapProvider: mappingMap.data("basemap-provider"),
        },
      );
  }

  ActiveMappingModule.bindLegendFilters(
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

  // Initialize clustering state
  map.clusteringEnabled = true;
  map._layerVisibilityMap = new Map(); // Track which layers should be visible

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
      return;
    }

    // First check if TimelineDateSlider is available
    if (typeof TimelineDateSlider === "undefined") {
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
      return;
    }

    // Only initialize timeline if there are features with dates
    const featuresWithDates = allLoadedFeatures.filter(
      (f) => f.dates && f.dates.length > 0,
    );
    // Count unique dates across all features
    const uniqueDates = new Set();
    featuresWithDates.forEach((f) => {
      f.dates.forEach((date) => {
        uniqueDates.add(date);
      });
    });
    const uniqueDateCount = uniqueDates.size;

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
      // Enable timeline toggle in filters menu
      if (map._filtersMenuControl) {
        map._filtersMenuControl.enableTimelineToggle();
      }
    } else {
      // Hide the timeline container and toggle button if there are not enough unique dates
      timelineContainer.hide();
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
    ActiveMappingModule.loadFeaturesAsync(
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
    onFeaturesLoad();
  }

  // Fallback: Try to initialize timeline after a delay to ensure features and TimelineDateSlider are loaded
  let attemptCount = 0;
  const timelineInitTimer = setInterval(function () {
    attemptCount++;

    const hasLayers = map._mappingAllLayers && map._mappingAllLayers.length > 0;
    const hasSlider = typeof TimelineDateSlider !== "undefined";
    const notInitialized = !window.timelineInitialized;

    if (notInitialized && hasLayers && hasSlider) {
      clearInterval(timelineInitTimer);
      initializeTimelineSlider();
    }

    if (attemptCount >= 20) {
      // Stop trying after 20 seconds
      clearInterval(timelineInitTimer);
    }
  }, 1000);

  // Switching sections changes map dimensions. In mixed-module pages this
  // event may not fire reliably, so include additional redraw fallbacks.
  const refreshMapAfterSectionOpen = function () {
    const mapElement = $("#custom-mapping-map").length
      ? $("#custom-mapping-map").first()
      : $("#mapping-map").first();
    if (mapElement.length) {
      if (!mapElement.height()) {
        mapElement.css("height", "900px");
      }
      if (!mapElement.width()) {
        mapElement.css("width", "100%");
      }
    }
    map.invalidateSize();
    setView();
    setTimeout(function () {
      map.invalidateSize();
      setView();
    }, 60);
    setTimeout(function () {
      map.invalidateSize();
      setView();
    }, 220);
  };

  mapSection.on("o:section-opened", function () {
    refreshMapAfterSectionOpen();
  });

  $(document).on("click", 'a[href="#custom-mapping-section"], a[href="#mapping-section"]', function () {
    setTimeout(refreshMapAfterSectionOpen, 0);
    setTimeout(refreshMapAfterSectionOpen, 80);
    setTimeout(refreshMapAfterSectionOpen, 250);
  });

  let sectionVisibilityChecks = 0;
  const sectionVisibilityTimer = setInterval(function () {
    sectionVisibilityChecks += 1;
    if (mapSection.is(":visible")) {
      refreshMapAfterSectionOpen();
      clearInterval(sectionVisibilityTimer);
      return;
    }
    if (sectionVisibilityChecks >= 30) {
      clearInterval(sectionVisibilityTimer);
    }
  }, 200);

  if (mapSection.is(":visible")) {
    setTimeout(refreshMapAfterSectionOpen, 0);
  }

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
      // Keep sidebar in the fullscreen map stacking context to prevent click-through.
      sidebar.css("position", "absolute");
      sidebar.css("top", "0");
      sidebar.css("right", "0");
      sidebar.css("height", "100vh");
      sidebar.css("width", "30%");
      sidebar.css("z-index", "2147483647");
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
      sidebar.css("z-index", "");
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

  // Initialize description toggle using shared function from CustomMappingModule
  // Use setTimeout to ensure DOM is fully updated before initializing toggle
  window.setTimeout(() => {
    const activeModule = window.CustomMappingModule || window.MappingModule;
    if (activeModule && activeModule.initializeDescriptionToggle) {
      activeModule.initializeDescriptionToggle("#mapping-view-sidebar");
    }
  }, 150);

  $("#mapping-view-sidebar").addClass("active");
}

