$(document).ready(function () {
  console.log("mapping-show.js loaded");
  console.log("mappingIsAdmin:", window.mappingIsAdmin);

  let mappingSidebarOpen = false;
  let lastClickedLayer = null;

  const mappingMap = $("#mapping-map");
  console.log("mappingMap element:", mappingMap.length, mappingMap);

  const mappingData = mappingMap.data("mapping");

  if (!mappingMap.length) {
    console.error("No #mapping-map element found!");
    return;
  }

  // Check if the map is already initialized
  let map, features, featuresPoint, featuresPoly, baseMaps;

  if (mappingMap[0].mapping_map) {
    // Map was already initialized by mapping-block.js
    console.log("Using existing map initialized by mapping-block.js");
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

  console.log("Map initialized:", map);

  // Initialize timeline slider
  let timelineSlider = null;
  let allFeatures = [];
  let timelineVisible = true;

  const initializeTimelineSlider = function () {
    if (typeof TimelineSlider === "undefined") {
      console.warn("TimelineSlider not loaded");
      return;
    }

    timelineSlider = new TimelineSlider(mappingMap[0], {
      onDateChange: function (selectedDate) {
        filterFeaturesByDateRange(selectedDate);
      },
    });
  };

  const filterFeaturesByDateRange = function (selectedDate) {
    // Show all features initially
    featuresPoint.eachLayer(function (layer) {
      layer.setOpacity(1);
    });
    featuresPoly.eachLayer(function (layer) {
      layer.setOpacity(1);
    });

    // Hide features with dates before selected date
    allFeatures.forEach((feature) => {
      if (feature.geoJsonLayer) {
        // Try to get dates from multiple sources
        let featureDates = feature.dates || feature.properties?.dates || [];
        if (!Array.isArray(featureDates)) {
          featureDates = [featureDates];
        }

        if (featureDates.length > 0) {
          let hasValidDate = false;
          featureDates.forEach((dateStr) => {
            const featureDate = window.parseCustomDate(dateStr);
            if (
              featureDate &&
              !isNaN(featureDate.getTime()) &&
              featureDate >= selectedDate
            ) {
              hasValidDate = true;
            }
          });

          if (!hasValidDate) {
            feature.geoJsonLayer.setOpacity(0.2);
          }
        }
      }
    });
  };

  // Only initialize timeline on public side
  if (!window.mappingIsAdmin) {
    initializeTimelineSlider();
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

  // Timeline Toggle Control (only on public side)
  if (!window.mappingIsAdmin) {
    const TimelineToggleControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd: function (map) {
      const container = L.DomUtil.create(
        "div",
        "mapping-timeline-toggle-control leaflet-bar",
      );
      const link = L.DomUtil.create(
        "a",
        "mapping-timeline-toggle-link",
        container,
      );

      link.innerHTML =
        '<svg viewBox="0 0 20 20"  style="width: 18px; height: 18px;" xmlns="http://www.w3.org/2000/svg" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill="#000000" d="M5.67326018,0 C6.0598595,0 6.37326018,0.31324366 6.37326018,0.699649298 L6.373,2.009 L13.89,2.009 L13.8901337,0.708141199 C13.8901337,0.321735562 14.2035343,0.00849190182 14.5901337,0.00849190182 C14.976733,0.00849190182 15.2901337,0.321735562 15.2901337,0.708141199 L15.29,2.009 L18,2.00901806 C19.1045695,2.00901806 20,2.90399995 20,4.00801605 L20,18.001002 C20,19.1050181 19.1045695,20 18,20 L2,20 C0.8954305,20 0,19.1050181 0,18.001002 L0,4.00801605 C0,2.90399995 0.8954305,2.00901806 2,2.00901806 L4.973,2.009 L4.97326018,0.699649298 C4.97326018,0.31324366 5.28666085,0 5.67326018,0 Z M1.4,7.742 L1.4,18.001002 C1.4,18.3322068 1.66862915,18.6007014 2,18.6007014 L18,18.6007014 C18.3313708,18.6007014 18.6,18.3322068 18.6,18.001002 L18.6,7.756 L1.4,7.742 Z M6.66666667,14.6186466 L6.66666667,16.284778 L5,16.284778 L5,14.6186466 L6.66666667,14.6186466 Z M10.8333333,14.6186466 L10.8333333,16.284778 L9.16666667,16.284778 L9.16666667,14.6186466 L10.8333333,14.6186466 Z M15,14.6186466 L15,16.284778 L13.3333333,16.284778 L13.3333333,14.6186466 L15,14.6186466 Z M6.66666667,10.6417617 L6.66666667,12.3078931 L5,12.3078931 L5,10.6417617 L6.66666667,10.6417617 Z M10.8333333,10.6417617 L10.8333333,12.3078931 L9.16666667,12.3078931 L9.16666667,10.6417617 L10.8333333,10.6417617 Z M15,10.6417617 L15,12.3078931 L13.3333333,12.3078931 L13.3333333,10.6417617 L15,10.6417617 Z M4.973,3.408 L2,3.40831666 C1.66862915,3.40831666 1.4,3.67681122 1.4,4.00801605 L1.4,6.343 L18.6,6.357 L18.6,4.00801605 C18.6,3.67681122 18.3313708,3.40831666 18,3.40831666 L15.29,3.408 L15.2901337,4.33697436 C15.2901337,4.72338 14.976733,5.03662366 14.5901337,5.03662366 C14.2035343,5.03662366 13.8901337,4.72338 13.8901337,4.33697436 L13.89,3.408 L6.373,3.408 L6.37326018,4.32848246 C6.37326018,4.7148881 6.0598595,5.02813176 5.67326018,5.02813176 C5.28666085,5.02813176 4.97326018,4.7148881 4.97326018,4.32848246 L4.973,3.408 Z"></path> </g></svg>';
      link.href = "#";
      link.title = "Toggle timeline slider";
      link.style.fontSize = "16px";
      link.style.display = "flex";
      link.style.alignItems = "center";
      link.style.justifyContent = "center";

      L.DomEvent.on(link, "mousedown", L.DomEvent.stopPropagation)
        .on(link, "dblclick", L.DomEvent.stopPropagation)
        .on(link, "click", L.DomEvent.stopPropagation)
        .on(link, "click", L.DomEvent.preventDefault)
        .on(link, "click", function () {
          timelineVisible = !timelineVisible;

          if (timelineVisible) {
            if (timelineSlider) {
              timelineSlider.show();
            }
            link.style.opacity = "1";
          } else {
            if (timelineSlider) {
              timelineSlider.hide();
            }
            link.style.opacity = "0.4";
          }
        });

      return container;
    },
  });

    map.addControl(new TimelineToggleControl());
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
    // Extract all features from the map for the timeline slider
    const extractedFeatures = [];

    featuresPoint.eachLayer(function (layer) {
      if (layer.feature) {
        extractedFeatures.push({
          properties: layer.feature.properties || {},
          dates: layer._mappingDates || [],
          geoJsonLayer: layer,
          geometry: layer.feature.geometry,
        });
      }
    });

    featuresPoly.eachLayer(function (layer) {
      if (layer.feature) {
        extractedFeatures.push({
          properties: layer.feature.properties || {},
          dates: layer._mappingDates || [],
          geoJsonLayer: layer,
          geometry: layer.feature.geometry,
        });
      }
    });

    allFeatures = extractedFeatures;

    console.log("Extracted features for timeline slider:", {
      totalFeatures: allFeatures.length,
      firstFeature: allFeatures[0],
      sampleDates: allFeatures
        .map((f) => f.dates || f.properties.dates)
        .slice(0, 3),
    });

    // Update timeline slider with the features
    if (timelineSlider) {
      timelineSlider.updateFeatures(allFeatures);
    }

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
    mappingMap.data("featuresUrl"),
    mappingMap.data("featurePopupContentUrl"),
    JSON.stringify(mappingMap.data("itemsQuery")),
    JSON.stringify(mappingMap.data("featuresQuery")),
    onFeaturesLoad,
  );

  console.log("Features URL:", mappingMap.data("featuresUrl"));
  console.log("Popup URL:", mappingMap.data("featurePopupContentUrl"));
  console.log("Loading features...");

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

  // Handle fullscreen mode - ensure sidebar and legend are visible
  map.on("enterFullscreen", function () {
    const mapContainer = map.getContainer();
    const sidebar = $("#mapping-view-sidebar");
    const legend = $(".mapping-map-legend");

    // Move elements into fullscreen container
    if (sidebar.length) {
      sidebar.appendTo(mapContainer);
    }
    if (legend.length) {
      legend.appendTo(mapContainer);
    }

    // Add fullscreen class to body for additional styling
    $("body").addClass("mapping-fullscreen-active");
  });

  map.on("exitFullscreen", function () {
    const sidebar = $("#mapping-view-sidebar");
    const legend = $(".mapping-map-legend");
    const mapSection = $("#mapping-section");
    const mapContainer = $(".mapping-map-container");

    // Move elements back to their original positions
    if (sidebar.length && mapSection.length) {
      sidebar.appendTo(mapSection);
    }
    if (legend.length && mapContainer.length) {
      legend.appendTo(mapContainer);
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
