$(document).ready(function () {
  const mappingMap = $("#mapping-map");

  // Position sidebar below the user-bar
  const sidebar = $("#mapping-view-sidebar");
  if (sidebar.length) {
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

  const [map, features, featuresPoint, featuresPoly, baseMaps] =
    MappingModule.initializeMap(
      mappingMap[0],
      {},
      {
        disableClustering: mappingMap.data("disable-clustering"),
        basemapProvider: mappingMap.data("basemap-provider"),
      },
    );

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

  let allLoadedFeatures = []; // Store all features with their dates for timeline

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
        let hasDateInRange = false;

        for (let date of dates) {
          const parsedDate = TimelineDateSlider.parseDate(date);
          if (parsedDate) {
            const dateMS = parsedDate.getTime();
            if (dateMS >= minDateMS && dateMS <= maxDateMS) {
              hasDateInRange = true;
              break;
            }
          }
        }

        // Handle both clustered and non-clustered modes
        if (map.clusteringEnabled) {
          // Check both point and polygon cluster groups and remove/add accordingly
          if (hasDateInRange) {
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
            if (layer.closePopup) {
              layer.closePopup();
            }
          }
        } else {
          // Non-clustered mode: manage direct map visibility
          if (hasDateInRange) {
            if (!map.hasLayer(layer)) {
              map.addLayer(layer);
            }
            layer.setOpacity(1);
          } else {
            if (map.hasLayer(layer)) {
              map.removeLayer(layer);
            }
            layer.setOpacity(0);
            if (layer.closePopup) {
              layer.closePopup();
            }
          }
        }
      });
    }
  };

  /**
   * Initialize the timeline date slider
   */
  const initializeTimelineSlider = function () {
    if (window.timelineInitializedBrowse) {
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
        null,
        null,
        f.typeId,
        f.dates,
      ]);

      TimelineDateSlider.init({
        features: timelineData,
        containerSelector: ".timeline-date-slider-container",
        onDateRangeChange: handleDateRangeChange,
      });

      window.timelineInitializedBrowse = true;
      // Show timeline elements
      const timelineContainer = $(".timeline-date-slider-container");
      if (timelineContainer.length) {
        timelineContainer.show();
      }
      if (timelineToggleControlElement) {
        timelineToggleControlElement.style.display = "";
      }
    } else {
      // Hide the timeline container and toggle button if there are not enough unique dates
      const timelineContainer = $(".timeline-date-slider-container");
      if (timelineContainer.length) {
        timelineContainer.hide();
      }
      if (timelineToggleControlElement) {
        timelineToggleControlElement.style.display = "none";
      }
    }
  };

  const onFeaturesLoadWithTimeline = function () {
    initializeTimelineSlider();

    if (!map.mapping_map_interaction) {
      // Call fitBounds only when there was no map interaction. This prevents
      // the map view from changing after a change has already been done.
      map.fitBounds(features.getBounds());
    }
  };

  MappingModule.loadFeaturesAsync(
    map,
    featuresPoint,
    featuresPoly,
    mappingMap.data("featuresUrl"),
    mappingMap.data("featurePopupContentUrl"),
    JSON.stringify(mappingMap.data("itemsQuery")),
    JSON.stringify(mappingMap.data("featuresQuery")),
    onFeaturesLoadWithTimeline,
  );

  // Handle fullscreen mode - ensure legend stays visible and positioned correctly
  map.on("enterFullscreen", function () {
    const mapContainer = map.getContainer();
    const legend = $(".mapping-map-legend");

    // Move legend into fullscreen container for better visibility
    if (legend.length) {
      legend.appendTo(mapContainer);
    }

    // Add fullscreen class to body for additional styling
    $("body").addClass("mapping-fullscreen-active");
  });

  map.on("exitFullscreen", function () {
    const legend = $(".mapping-map-legend");
    const mapContainer = $(".mapping-map-container");
    const mapControls = $(".mapping-map-controls");

    // Move legend back to map controls to ensure it stays in original structure
    if (legend.length && mapControls.length) {
      legend.appendTo(mapControls);
    }

    // Remove fullscreen class from body
    $("body").removeClass("mapping-fullscreen-active");
  });
});
