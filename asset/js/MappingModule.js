const MappingModule = {
  /**
   *
   * @param {DOM object} mapDiv The map div DOM object
   * @param {object} mapOptions Leaflet map options
   * @param {object} options Options for initializing the map
   *      - disableClustering: (bool) Disable feature clustering?
   *      - basemapProvider: (string) The default basemap provider
   *      - excludeLayersControl: (bool) Exclude the layers control?
   *      - excludeFitBoundsControl: (bool) Exclude the fit bounds control?
   * @returns array
   */
  initializeMap: function (mapDiv, mapOptions, options) {
    mapOptions.fullscreenControl = true;
    mapOptions.worldCopyJump = true;

    // Initialize the map and features.
    const map = new L.map(mapDiv, mapOptions);
    const features = L.featureGroup();
    const featuresPoint = options.disableClustering
      ? L.featureGroup()
      : L.markerClusterGroup({
          polygonOptions: {
            color: "green",
          },
        });
    const featuresPoly = L.deflate({
      // Enable clustering of poly features
      markerLayer: featuresPoint,
      // Must set to false or small poly features will not be inflated at high zoom.
      greedyCollapse: false,
    });

    // Set base maps and grouped overlays.
    const urlParams = new URLSearchParams(window.location.search);
    let defaultProvider;
    try {
      defaultProvider = L.tileLayer.provider(
        urlParams.get("mapping_basemap_provider"),
      );
    } catch (error) {
      try {
        defaultProvider = L.tileLayer.provider(options.basemapProvider);
      } catch (error) {
        defaultProvider = L.tileLayer.provider("OpenStreetMap.Mapnik");
      }
    }
    const baseMaps = {
      Default: defaultProvider,
      Streets: L.tileLayer.provider("OpenStreetMap.Mapnik"),
      Grayscale: L.tileLayer.provider("CartoDB.Positron"),
      Satellite: L.tileLayer.provider("Esri.WorldImagery"),
      Terrain: L.tileLayer.provider("Esri.WorldShadedRelief"),
    };

    // Add features and controls to the map.
    features.addLayer(featuresPoint).addLayer(featuresPoly);
    map.addLayer(defaultProvider).addLayer(features);
    if (!options.excludeLayersControl) {
      map.addControl(new L.Control.Layers(baseMaps));
    }
    if (!options.excludeFitBoundsControl) {
      map.addControl(new L.Control.FitBounds(features));
    }

    // Set the initial view to the geographical center of world.
    map.setView([20, 0], 2);

    // Store feature groups on the map for later retrieval
    map._mappingFeatures = features;
    map._mappingFeaturesPoint = featuresPoint;
    map._mappingFeaturesPoly = featuresPoly;
    map._mappingBaseMaps = baseMaps;

    return [map, features, featuresPoint, featuresPoly, baseMaps];
  },

  createPinIcon: function (color) {
    const svg = MappingModule.getPinSvg(color);
    return L.icon({
      iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      iconSize: [42, 70],
      iconAnchor: [12, 60],
    });
  },

  getPinSvg: function (color) {
    return `
      <svg viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          fill="${color}"
          width="24"
          height="24"
          aria-hidden="true">
        <path d="M12 1.1a6.847 6.847 0 0 0-6.9 6.932c0 3.882 3.789 9.01 6.9 14.968 3.111-5.957 6.9-11.086 6.9-14.968A6.847 6.847 0 0 0 12 1.1zm0 9.9a3 3 0 1 1 3-3 3 3 0 0 1-3 3z"/>
      </svg>`;
  },

  /**
   * Load features into a map asynchronously.
   *
   * @param {L.map}    map                       The Leaflet map object
   * @param {L.layer}  featuresPoint             The Leaflet layer object containing point features
   * @param {L.layer}  featuresPoly              The Leaflet layer object containing polygon features
   * @param {string}   getFeaturesUrl            The "get features" endpoint URL
   * @param {string}   getFeaturePopupContentUrl The "get feature popup content" endpoint URL
   * @param {object}   itemsQuery                The items query
   * @param {object}   featuresQuery             The features query
   * @param {callback} onFeaturesLoadSetView     An optional function called to set view after features are loaded
   * @param {object}   featuresByResource        An optional object
   * @param {int}      featuresPage              The
   */
  loadFeaturesAsync: function (
    map,
    featuresPoint,
    featuresPoly,
    getFeaturesUrl,
    getFeaturePopupContentUrl,
    itemsQuery,
    featuresQuery,
    onFeaturesLoad = () => null,
    featuresByResource = {},
    featuresPage = 1,
  ) {
    // Observe a map interaction (done programmatically or by the user).
    if ("undefined" === typeof map.mapping_map_interaction) {
      map.mapping_map_interaction = false;
      map.on("zoomend moveend", function (e) {
        map.mapping_map_interaction = true;
      });
    }
    const getFeaturesQuery = {
      features_page: featuresPage,
      items_query: itemsQuery,
      features_query: featuresQuery,
    };
    // Get features from the server, one page at a time.
    $.get(getFeaturesUrl, getFeaturesQuery).done(function (featuresData) {
      if (!featuresData.length) {
        // This page returned no features. Stop recursion.
        onFeaturesLoad();
        return;
      }
      //
      // Iterate the features.
      featuresData.forEach((featureData) => {
        const featureId = featureData[0];
        const resourceId = featureData[1];
        const featureGeography = featureData[2];
        const markerColor = featureData[3] || "#3498db";
        const featureTypeId = featureData[4] ? String(featureData[4]) : null;
        const itemDates = featureData[5] || [];
        

        L.geoJSON(featureGeography, {
          pointToLayer: function (feature, latlng) {
            return L.marker(latlng, {
              icon: MappingModule.createPinIcon(markerColor),
            });
          },

          style: function (feature) {
            return {
              color: markerColor,
              fillColor: markerColor,
              weight: 2,
              fillOpacity: 0.4,
            };
          },
          onEachFeature: function (feature, layer) {
            // Add dates to the feature properties for timeline filtering
            if (!feature.properties) {
              feature.properties = {};
            }
            feature.properties.dates = itemDates;
            
            // Store dates directly on the layer as well
            layer._mappingDates = itemDates;
            
            layer.on("click", function (e) {
              e.originalEvent.stopPropagation(); // prevent map click

        
              if (!getFeaturePopupContentUrl) {
                return;
              }

              $.get(
                getFeaturePopupContentUrl,
                { feature_id: featureId },
                function (content) {
                  const sidebar = $("#mapping-view-sidebar");

                  MappingModule.renderSidebarContent(
                    sidebar,
                    content,
                    markerColor,
                  );
                  if (window.mappingIsAdmin) {
                    // Admin Side
                    Omeka.openSidebar(sidebar);
                  } else {
                    // Client Side
                    sidebar.addClass("active");
                  }
                },
              ).fail(function(xhr, status, error) {
                console.error('Failed to load feature content:', error, xhr);
              });
            });

            MappingModule.addFeature(
              map,
              featuresPoint,
              featuresPoly,
              layer,
              feature.type,
            );

            layer._mappingTypeId = featureTypeId;
            layer._mappingFeatureId = featureId;
            layer._mappingResourceId = resourceId;
            layer._mappingFeatureGroup =
              "Point" === feature.type ? featuresPoint : featuresPoly;
            if (!map._mappingAllLayers) {
              map._mappingAllLayers = [];
            }
            map._mappingAllLayers.push(layer);

            if (!(resourceId in featuresByResource)) {
              featuresByResource[resourceId] = L.featureGroup();
            }
            featuresByResource[resourceId].addLayer(layer);
          },
        });
      });
      // Load more features recursively.
      MappingModule.loadFeaturesAsync(
        map,
        featuresPoint,
        featuresPoly,
        getFeaturesUrl,
        getFeaturePopupContentUrl,
        itemsQuery,
        featuresQuery,
        onFeaturesLoad,
        featuresByResource,
        ++featuresPage,
      );
    });
  },

  renderSidebarContent: function (sidebar, content, markerColor) {
    const $content = $("<div>").html(content);

    const pinContainer = sidebar.find(".sidebar-pin");
    pinContainer.html(MappingModule.getPinSvg(markerColor));

    // Title
    const titleElement = $content.find("h2, h3, .resource-title").first();
    
    let titleText = titleElement.text();
    
    if (!titleText.trim()) {
      console.warn("No title element found in server response");
    }
    sidebar.find(".sidebar-title").text(titleText);

    // Creator and Date (side by side)
    const creatorDateDiv = $content.find(".sidebar-creator-date").first();
    const creatorDateContainer = sidebar.find(".sidebar-creator-date");
    creatorDateContainer.empty();
    if (creatorDateDiv.length) {
      creatorDateContainer.append(creatorDateDiv.clone());
    }

    // Description
    const description = $content.find("p.sidebar-description").html() || "";
    sidebar.find(".sidebar-description").html(description);

    // Description toggle button
    const toggleButton = $content.find(".sidebar-description-toggle").first();
    const toggleButtonContainer = sidebar.find(".sidebar-description-toggle");
    if (toggleButton.length && toggleButtonContainer.length) {
      toggleButtonContainer.replaceWith(toggleButton.clone());
    }

    // Item fields
    const itemFieldsContainer = sidebar.find(".sidebar-item-fields");
    itemFieldsContainer.empty();
    const itemFields = $content.find("dl.mapping-feature-item-values").first();
    if (itemFields.length) {
      itemFieldsContainer.append(itemFields.clone());
    }

    // Media
    const mediaContainer = sidebar.find(".sidebar-media");
    mediaContainer.empty();

    const img = $content.find("img").first();
    if (img.length) {
      mediaContainer.append(img.clone());
    }
  },

  /**
   * Add a feature layer to its respective layer.
   *
   * @param {L.map} map
   * @param {L.layer} featuresPoint
   * @param {L.layer} featuresPoly
   * @param {L.layer} layer
   * @param {string} type
   */
  addFeature: function (map, featuresPoint, featuresPoly, layer, type) {
    switch (type) {
      case "Point":
        featuresPoint.addLayer(layer);
        return featuresPoint;
      case "LineString":
      case "Polygon":
      case "MultiPolygon":
        layer.on("popupopen", function () {
          layer.setStyle({ color: "#9fc6fc" });
          map.fitBounds(layer.getBounds());
        });
        layer.on("popupclose", function () {
          layer.setStyle({ color: "#3388ff" });
        });
        featuresPoly.addLayer(layer);
        return featuresPoly;
    }
  },

  bindLegendFilters: function (map, mapDiv, featuresPoint, featuresPoly) {
    const container = $(mapDiv).closest(".mapping-map-container");
    const toggles = container.find(".mapping-legend-toggle");
    const individualToggles = container.find(".mapping-legend-toggle");
    const allToggle = container.find(".mapping-legend-all-toggle");
    
    if (!toggles.length) {
      return;
    }

    let filtersEnabled = true;
    const legend = container.find(".mapping-map-legend");

    const ensureAllVisible = function () {
      if (!map._mappingAllLayers) {
        return;
      }
      map._mappingAllLayers.forEach((layer) => {
        const group =
          layer._mappingFeatureGroup ||
          (layer instanceof L.Marker ? featuresPoint : featuresPoly);
        if (group && !group.hasLayer(layer)) {
          group.addLayer(layer);
        }
      });
    };

    const updateAllCheckboxState = function () {
      if (allToggle.length === 0) {
        return;
      }
      
      // Count checked individual toggles (excluding the "All" checkbox)
      const typeToggles = container.find(".mapping-legend-toggle").not(allToggle);
      const totalCount = typeToggles.length;
      const checkedCount = typeToggles.filter(":checked").length;
      
      const checkbox = allToggle[0];
      if (checkedCount === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
      } else if (checkedCount === totalCount) {
        checkbox.checked = true;
        checkbox.indeterminate = false;
      } else {
        checkbox.checked = false;
        checkbox.indeterminate = true;
      }
    };

    const applyFilters = function () {
      if (!filtersEnabled) {
        ensureAllVisible();
        return;
      }
      const typeToggles = container.find(".mapping-legend-toggle").not(allToggle);
      const checked = new Set(
        typeToggles
          .filter(":checked")
          .map(function () {
            return String($(this).data("typeId"));
          })
          .get(),
      );

      if (!map._mappingAllLayers) {
        return;
      }

      map._mappingAllLayers.forEach((layer) => {
        const typeId = layer._mappingTypeId;
        if (!typeId) {
          // No type: always show.
          if (layer._mappingFeatureGroup && !layer._mappingFeatureGroup.hasLayer(layer)) {
            layer._mappingFeatureGroup.addLayer(layer);
          }
          return;
        }

        const shouldShow = checked.has(String(typeId));
        const group = layer._mappingFeatureGroup || (layer instanceof L.Marker ? featuresPoint : featuresPoly);
        if (shouldShow) {
          if (!group.hasLayer(layer)) {
            group.addLayer(layer);
          }
        } else {
          if (group.hasLayer(layer)) {
            group.removeLayer(layer);
          }
        }
      });
    };

    const updateLegendState = function () {
      if (filtersEnabled) {
        legend.removeClass("filters-hidden");
      } else {
        legend.addClass("filters-hidden");
      }
    };

    // Handle "All" checkbox toggle
    if (allToggle.length) {
      allToggle.on("change", function () {
        const typeToggles = container.find(".mapping-legend-toggle").not(allToggle);
        typeToggles.prop("checked", this.checked);
        applyFilters();
        updateAllCheckboxState();
      });
    }

    // Handle individual toggle changes
    const typeToggles = container.find(".mapping-legend-toggle").not(allToggle);
    typeToggles.on("change", function () {
      applyFilters();
      updateAllCheckboxState();
    });

    updateLegendState();
    updateAllCheckboxState();
    applyFilters();
  },

  /**
   * Add filter toggle control to map
   */
  addFilterToggleControl: function (map) {
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
  },

  /**
   * Add timeline toggle control to map
   */
  addTimelineToggleControl: function (map) {
    let timelineToggleControlElement = null;
    const TimelineToggleControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd: function (map) {
        const container = L.DomUtil.create(
          "div",
          "mapping-timeline-toggle-control leaflet-bar",
        );
        timelineToggleControlElement = container;
        container.style.display = "none";
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
    return timelineToggleControlElement;
  },

  /**
   * Add clustering toggle control to map
   */
  addClusteringToggleControl: function (map, featuresPoint, featuresPoly) {
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
              if (map._mappingAllLayers) {
                map._mappingAllLayers.forEach((layer) => {
                  if (map.hasLayer(layer)) {
                    map.removeLayer(layer);
                  }
                });
              }
              if (!map.hasLayer(featuresPoint)) {
                map.addLayer(featuresPoint);
              }
              if (!map.hasLayer(featuresPoly)) {
                map.addLayer(featuresPoly);
              }
              link.style.opacity = "1";
            } else {
              map.removeLayer(featuresPoint);
              map.removeLayer(featuresPoly);

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
  },

  /**
   * Initialize description truncation and toggle functionality
   * Automatically truncates descriptions longer than ~2 paragraphs and shows a toggle button
   * @param {string} sidebarSelector - The jQuery selector for the sidebar (defaults to #mapping-view-sidebar)
   */
  initializeDescriptionToggle: function (sidebarSelector) {
    const selector = sidebarSelector || "#mapping-view-sidebar";
    const description = $(selector + " .sidebar-description");
    const toggleBtn = $(selector + " .sidebar-description-toggle");

    if (!description.length || !toggleBtn.length) {
      return;
    }

    // Check if description content exceeds ~2 paragraphs (4.8rem)
    const checkTruncation = function () {
      // Get the natural height of the description
      description.removeClass("truncated expanded");
      
      // Force reflow to get accurate height measurements
      const element = description[0];
      // Trigger reflow by accessing offsetHeight
      const _ = element.offsetHeight;
      
      const scrollHeight = element.scrollHeight;
      const maxHeight = 10 * 16; // 4.8rem in pixels

      if (scrollHeight > maxHeight) {
        // Description is too long, add truncated class
        description.addClass("truncated needs-toggle");
        toggleBtn.show();
      } else {
        // Description fits, hide button
        description.removeClass("truncated needs-toggle");
        toggleBtn.hide();
      }
    };

    // Initialize on load with staggered delays to ensure DOM is fully rendered
    setTimeout(checkTruncation, 0);
    setTimeout(checkTruncation, 100);

    // Handle toggle button click
    toggleBtn.off("click").on("click", function (e) {
      e.preventDefault();

      if (description.hasClass("expanded")) {
        // Collapse
        description.removeClass("expanded");
        toggleBtn.find(".toggle-text").text("See more");
      } else {
        // Expand
        description.addClass("expanded");
        toggleBtn.find(".toggle-text").text("See less");
      }
    });

    // Re-check on window resize - debounced
    let resizeTimeout;
    $(window).off("resize.descriptionToggle").on("resize.descriptionToggle", function () {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(checkTruncation, 100);
    });
  },
};

/**
 * Global hook to initialize description toggle whenever sidebar content is rendered
 * This ensures the "see more" button shows up in all views (browse, show, blocks)
 */
MappingModule.originalRenderSidebarContent = MappingModule.renderSidebarContent;
MappingModule.renderSidebarContent = function (sidebarElement, content, markerColor) {
  // Call the original function
  MappingModule.originalRenderSidebarContent(sidebarElement, content, markerColor);
  // Then initialize the toggle - use longer timeout to ensure DOM is fully updated
  window.setTimeout(() => {
    MappingModule.initializeDescriptionToggle("#mapping-view-sidebar");
  }, 150);
};
