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
                    sidebar.show();
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
    sidebar
      .find(".sidebar-title")
      .text($content.find("h2, h3, .resource-title").first().text());
    // Description
    const description = $content.find("p.sidebar-description").html() || "";
    sidebar.find(".sidebar-description").html(description);

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

    const applyFilters = function () {
      if (!filtersEnabled) {
        ensureAllVisible();
        return;
      }
      const checked = new Set(
        toggles
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

    const FilterControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd: function () {
        const container = L.DomUtil.create(
          "div",
          "leaflet-bar mapping-legend-filter-control",
        );
        const button = L.DomUtil.create(
          "a",
          "mapping-legend-filter-button",
          container,
        );
        button.href = "#";
        button.title = "Toggle type filter";
        button.setAttribute("aria-label", "Toggle type filter");
        button.innerHTML =
          "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M3 5h18l-7 8v5l-4 2v-7L3 5z\"></path></svg>";

        L.DomEvent.on(button, "click", function (e) {
          L.DomEvent.preventDefault(e);
          filtersEnabled = !filtersEnabled;
          button.classList.toggle("is-disabled", !filtersEnabled);
          button.setAttribute(
            "aria-pressed",
            filtersEnabled ? "true" : "false",
          );
          updateLegendState();
          applyFilters();
        });

        return container;
      },
    });

    map.addControl(new FilterControl());

    toggles.on("change", applyFilters);
    updateLegendState();
    applyFilters();
  },
};
