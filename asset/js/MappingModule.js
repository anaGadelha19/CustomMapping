const CustomMappingModule = {
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
    const svg = CustomMappingModule.getPinSvg(color);
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
              icon: CustomMappingModule.createPinIcon(markerColor),
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

                  CustomMappingModule.renderSidebarContent(
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

            CustomMappingModule.addFeature(
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
      CustomMappingModule.loadFeaturesAsync(
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
    pinContainer.html(CustomMappingModule.getPinSvg(markerColor));

    // Title
    const titleElement = $content
      .find("h2, h3, .resource-title, .sidebar-title, .group-type a, .group-type")
      .first();
    
    let titleHtml = titleElement.html();
    
    if (!titleHtml || !titleHtml.trim()) {
      const linkTitle = $content.find("a").first().text();
      if (linkTitle && linkTitle.trim()) {
        titleHtml = $("<div>").text(linkTitle).html();
      }
    }

    if (!titleHtml || !titleHtml.trim()) {
      console.warn(
        "No title element found in server response",
        String(content).slice(0, 240),
      );
      titleHtml = "Untitled";
    }
    sidebar.find(".sidebar-title").html(titleHtml);

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
CustomMappingModule.originalRenderSidebarContent = CustomMappingModule.renderSidebarContent;
CustomMappingModule.renderSidebarContent = function (sidebarElement, content, markerColor) {
  // Call the original function
  CustomMappingModule.originalRenderSidebarContent(sidebarElement, content, markerColor);
  // Then initialize the toggle - use longer timeout to ensure DOM is fully updated
  window.setTimeout(() => {
    CustomMappingModule.initializeDescriptionToggle("#mapping-view-sidebar");
  }, 150);
};
  
  if (typeof window !== "undefined") {
    window.CustomMappingModule = CustomMappingModule;
  }
