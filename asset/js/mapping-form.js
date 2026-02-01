$(document).ready(function () {
  // Step 0
  /**
   * Add a feature to the map.
   *
   * @param feature
   * @param featureId
   * @param featureLabel
   * @param featureDescription
   * @param featureMarkerColor
   * @param featureMediaId
   */
  const addFeature = function (
    feature,
    featureId,
    featureLabel,
    featureDescription,
    featureMarkerColor,
    featureMediaId,
  ) {
    const markerColor = featureMarkerColor || "blue";

    feature.on("click", function (e) {
      // Get sidebar element
      const sidebar = $("#mapping-feature-editor");

      // Attach the feature data to the sidebar for use
      sidebar.data("feature", feature);
      sidebar.data("selectedMediaId", featureMediaId);
      // sidebar.data('featureMarkerColor', featureMarkerColor);

      // Populate sidebar inputs with current feature data
      sidebar.find(".mapping-feature-label").val(featureLabel);
      sidebar.find(".mapping-feature-description").val(featureDescription);
      sidebar.find(".color-swatch").removeClass("selected");

      if (featureMarkerColor) {
        sidebar
          .find(`.color-swatch[data-color="${markerColor}"]`)
          .addClass("selected");
      }

      if (featureMediaId) {
        const mediaThumbnail = $("<img>", {
          src: $(
            `.mapping-feature-image-select[value="${featureMediaId}"]`,
          ).data("mediaThumbnailUrl"),
        });
        sidebar.find(".mapping-feature-popup-image").html(mediaThumbnail);
      }

      // Open the sidebar
      Omeka.openSidebar(sidebar);
    });

    // Wrap marker coordinates that are outside their valid ranges into their
    // valid geographical equivalents. Note that this only applies to markers
    // because other features may extend through the antimeridian.
    if (feature._latlng) {
      feature.setLatLng(feature.getLatLng().wrap());
    }
    // Add the feature layer before adding feature inputs so Leaflet sets an ID.
    drawnFeatures.addLayer(feature);
    const featureGeoJson = feature.toGeoJSON();
    const featureNamePrefix = getFeatureNamePrefix(feature);

    feature._mappingNamePrefix = featureNamePrefix;
    feature.markerColor = markerColor;

    // Step: 1

    // Add the corresponding feature inputs to the form.
    if (featureId) {
      mappingForm.append(
        $("<input>", {
          type: "hidden",
          name: featureNamePrefix + "[o:id]",
          value: featureId,
        }),
      );
    }
    mappingForm.append(
      $("<input>", {
        type: "hidden",
        name: featureNamePrefix + "[o:media][o:id]",
        value: featureMediaId,
      }),
    );
    mappingForm.append(
      $("<input>", {
        type: "hidden",
        name: featureNamePrefix + "[o:label]",
        value: featureLabel,
      }),
    );
    mappingForm.append(
      $("<input>", {
        type: "hidden",
        name: featureNamePrefix + "[o:description]",
        value: featureDescription,
      }),
    );

    mappingForm.append(
      $("<input>", {
        type: "hidden",
        name: featureNamePrefix + "[o:marker_color]",
        value: markerColor,
      }),
    );

    mappingForm.append(
      $("<input>", {
        type: "hidden",
        name: featureNamePrefix + "[o-module-mapping:geography-type]",
        value: featureGeoJson.geometry.type,
      }),
    );
    mappingForm.append(
      $("<input>", {
        type: "hidden",
        name: featureNamePrefix + "[o-module-mapping:geography-coordinates]",
        value: JSON.stringify(featureGeoJson.geometry.coordinates),
      }),
    );
  };

  /**
   * Edit a feature.
   *
   * @param feature
   */
  const editFeature = function (feature) {
    const featureGeoJson = feature.toGeoJSON();
    const featureNamePrefix = getFeatureNamePrefix(feature);
    // Edit the corresponding feature inputs
    $(
      `input[name="${featureNamePrefix}[o-module-mapping:geography-type]"]`,
    ).val(featureGeoJson.geometry.type);
    $(
      `input[name="${featureNamePrefix}[o-module-mapping:geography-coordinates]"]`,
    ).val(JSON.stringify(featureGeoJson.geometry.coordinates));
  };

  /**
   * Delete a feature.
   *
   * @param feature
   */
  const deleteFeature = function (feature) {
    // Remove the corresponding feature inputs from the form.
    $(`input[name^="${getFeatureNamePrefix(feature)}"]`).remove();
  };

  /**
   * Set the map view.
   */
  const setView = function () {
    if (mapMoved) {
      return; // The user moved the map. Do not set the view.
    }
    if (defaultBounds) {
      map.fitBounds(defaultBounds);
    } else {
      const bounds = drawnFeatures.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds);
      } else {
        map.setView([20, 0], 2);
      }
    }
  };

  const getFeatureNamePrefix = function (feature) {
    return `o-module-mapping:feature[${drawnFeatures.getLayerId(feature)}]`;
  };

  // Get map data.
  const mappingMap = $("#mapping-map");
  const mappingForm = $("#mapping-form");
  const mappingData = mappingMap.data("mapping");
  const featuresData = mappingMap.data("features");

  // Initialize the map and set default view.
  const map = L.map("mapping-map", {
    fullscreenControl: true,
    worldCopyJump: true,
  });
  let mapMoved = false;
  let defaultBounds = null;
  if (mappingData && mappingData["o-module-mapping:bounds"] !== null) {
    const bounds = mappingData["o-module-mapping:bounds"].split(",");
    const southWest = [bounds[1], bounds[0]];
    const northEast = [bounds[3], bounds[2]];
    defaultBounds = [southWest, northEast];
  }

  // Add layers and controls to the map.
  const baseMaps = {
    Streets: L.tileLayer.provider("OpenStreetMap.Mapnik"),
    Grayscale: L.tileLayer.provider("CartoDB.Positron"),
    Satellite: L.tileLayer.provider("Esri.WorldImagery"),
    Terrain: L.tileLayer.provider("Esri.WorldShadedRelief"),
  };
  const baseMapsControl = L.control.layers(baseMaps);
  const geoSearchControl = new window.GeoSearch.GeoSearchControl({
    provider: new window.GeoSearch.OpenStreetMapProvider(),
    showMarker: false,
    retainZoomLevel: false,
  });
  const drawnFeatures = new L.FeatureGroup();
  const drawControl = new L.Control.Draw({
    draw: {
      polyline: true,
      polygon: true,
      // Rectangle is compatible because it is treated as a polygon.
      rectangle: true,
      // Circles are incompatible because they require a separate radius.
      // Ideally we would draw circles as polygons, but there is no function
      // to do this. Note that GeoJSON does not support circles.
      circle: false,
      circlemarker: false,
    },
    edit: {
      featureGroup: drawnFeatures,
    },
  });
  // Customize strings.
  // @see https://github.com/Leaflet/Leaflet.draw?tab=readme-ov-file#customizing-language-and-text-in-leafletdraw
  L.drawLocal.edit.toolbar.buttons = {
    edit: "Edit feature",
    editDisabled: "No features to edit",
    remove: "Delete feature",
    removeDisabled: "No features to delete",
  };
  map.addLayer(baseMaps["Streets"]);
  map.addLayer(drawnFeatures);
  map.addControl(baseMapsControl);
  map.addControl(drawControl);
  map.addControl(geoSearchControl);
  map.addControl(
    new L.Control.DefaultView(
      // Set default view callback
      function (e) {
        defaultBounds = map.getBounds();
        $(
          'input[name="o-module-mapping:mapping[o-module-mapping:bounds]"]',
        ).val(defaultBounds.toBBoxString());
      },
      // Go to default view callback
      function (e) {
        map.invalidateSize();
        map.fitBounds(defaultBounds);
      },
      // clear default view callback
      function (e) {
        defaultBounds = null;
        $(
          'input[name="o-module-mapping:mapping[o-module-mapping:bounds]"]',
        ).val("");
        map.setView([20, 0], 2);
      },
      { noInitialDefaultView: !defaultBounds },
    ),
  );

  function createPinIcon(color) {
    const svg = `
   <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="${color}"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M12 1.1a6.847 6.847 0 0 0-6.9 6.932c0 3.882 3.789 9.01 6.9 14.968 3.111-5.957 6.9-11.086 6.9-14.968A6.847 6.847 0 0 0 12 1.1zm0 9.9a3 3 0 1 1 3-3 3 3 0 0 1-3 3z"></path><path fill="none" d="M0 0h24v24H0z"></path></g></svg> `;

    return L.icon({
      iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      iconSize: [42, 70],
      iconAnchor: [12, 60],
    });
  }

  // Step 3
  // Add saved features to the map.
  $.each(featuresData, function (index, data) {
    const featureMediaId = data["o:media"] ? data["o:media"]["o:id"] : null;
    const geoJson = {
      type: data["o-module-mapping:geography-type"],
      coordinates: data["o-module-mapping:geography-coordinates"],
    };

    const markerColor =
      data["o:marker_color"] !== undefined ? data["o:marker_color"] : "blue";

    console.log("FEATURE DATA", data);
    console.log("DESCRIPTION", data["o:description"]);
    console.log("COLOR", data["o:marker_color"]);

    const feature = L.geoJSON(geoJson, {
      pointToLayer: function (feature, latlng) {
        return L.marker(latlng, {
          icon: createPinIcon(markerColor),
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
        addFeature(
          layer,
          data["o:id"],
          data["o:label"],
          data["o:description"],
          markerColor,
          featureMediaId,
        );
      },
    });
  });

  // Set saved mapping data to the map (default view).
  if (mappingData) {
    $('input[name="o-module-mapping:mapping[o:id]"]').val(mappingData["o:id"]);
    $('input[name="o-module-mapping:mapping[o-module-mapping:bounds]"]').val(
      mappingData["o-module-mapping:bounds"],
    );
  }

  // Set the initial view.
  setView();

  // Handle map moved.
  map.on("movestart", function (e) {
    mapMoved = true;
  });

  // Handle adding new features.
  map.on("draw:created", function (e) {
    if (["marker", "polyline", "polygon", "rectangle"].includes(e.layerType)) {
      addFeature(e.layer);
    }
  });

  // Handle editing existing features (saved and unsaved).
  map.on("draw:edited", function (e) {
    e.layers.eachLayer(function (layer) {
      editFeature(layer);
    });
  });

  // Handle deleting existing (saved and unsaved) features.
  map.on("draw:deleted", function (e) {
    e.layers.eachLayer(function (layer) {
      deleteFeature(layer);
    });
  });

  // Handle adding a geocoded marker.
  map.on("geosearch/showlocation", function (e) {
    addFeature(
      new L.Marker([e.location.y, e.location.x]),
      null,
      e.location.label,
    );
  });

  // Switching sections changes map dimensions, so make the necessary adjustments.
  $("#mapping-section").on("o:section-opened", function (e) {
    $("#content").one("transitionend", function (e) {
      map.invalidateSize();
      setView();
    });
  });

  // Helper function to update feature marker color
  function updateFeatureStyle(feature, color) {
    feature.markerColor = color;
     // Case 1: Marker 
    if (feature instanceof L.Marker && feature.setIcon) {
        feature.setIcon(createPinIcon(color));
        return;
    }

    // Case 2: Polygnos
    if (feature.setStyle) {
        feature.setStyle({
            color: color,
            fillColor: color
        });
    }
  }

  // -------------------- Step: 2 --------------------
  // Handle title input
  $("#mapping-section").on(
    "keyup",
    "#mapping-feature-editor .mapping-feature-label",
    function (e) {
      const sidebar = $("#mapping-feature-editor");
      const feature = sidebar.data("feature");
      if (!feature) return;

      const featureNamePrefix = getFeatureNamePrefix(feature);
      const labelValue = $(this).val();

      // Update the hidden input
      $(`input[name="${featureNamePrefix}[o:label]"]`).val(labelValue);
    },
  );

  // Handle description text area
  $("#mapping-section").on(
    "keyup",
    "#mapping-feature-editor .mapping-feature-description",
    function (e) {
      const sidebar = $("#mapping-feature-editor");
      const feature = sidebar.data("feature");
      if (!feature) return;

      const featureNamePrefix = getFeatureNamePrefix(feature);
      const descriptionValue = $(this).val();

      // Update the hidden input
      $(`input[name="${featureNamePrefix}[o:description]"]`).val(
        descriptionValue,
      );
    },
  );

  // Selecting a marker color
  $("#mapping-feature-editor").on("click", ".color-swatch", function () {
    const sidebar = $("#mapping-feature-editor");
    const feature = sidebar.data("feature");
    if (!feature) return;

    const color = $(this).data("color");
    const featureNamePrefix = feature._mappingNamePrefix;

    $(".color-swatch").removeClass("selected");
    $(this).addClass("selected");

    $(`input[name="${featureNamePrefix}[o:marker_color]"]`).val(color);

    updateFeatureStyle(feature, color);
  });

  // Open native color picker
  $("#mapping-feature-editor").on("click", "#add-custom-color", function () {
    $("#custom-color-input").click();
  });

  // When user picks a color
  $("#mapping-feature-editor").on("change", "#custom-color-input", function () {
    const color = $(this).val();
    const sidebar = $("#mapping-feature-editor");
    const feature = sidebar.data("feature");
    if (!feature) return;

    // For duplicates
    if ($(`.color-swatch[data-color="${color}"]`).length) {
      $(`.color-swatch[data-color="${color}"]`).click();
      return;
    }

    // Create new swatch
    const swatch = $("<button>", {
      type: "button",
      class: "color-swatch selected",
      "data-color": color,
      css: {
        backgroundColor: color,
      },
    });

    // Unselect others, add & select new one
    $(".color-swatch").removeClass("selected");
    $("#mapping-feature-editor .color-swatches").append(swatch);

    const featureNamePrefix = feature._mappingNamePrefix;
    $(`input[name="${featureNamePrefix}[o:marker_color]"]`).val(color);
    updateFeatureStyle(feature, color);
  });

  // Handle select popup image button.
  $("#mapping-section").on(
    "click",
    ".mapping-feature-popup-image-select",
    function (e) {
      e.preventDefault();
      Omeka.openSidebar($("#mapping-feature-image-selector"));
    },
  );

  $("#mapping-section").on(
    "change",
    "input.mapping-feature-image-select",
    function (e) {
      const sidebar = $("#mapping-feature-editor");
      const feature = sidebar.data("feature");
      if (!feature) return;

      const featureNamePrefix = getFeatureNamePrefix(feature);
      const mediaId = $(this).val();

      // Update hidden input
      $(`input[name="${featureNamePrefix}[o:media][o:id]"]`).val(mediaId);

      // Update sidebar thumbnail if needed
      const mediaThumbnailUrl = $(this).data("mediaThumbnailUrl");
      if (mediaThumbnailUrl) {
        const thumbnail = $("<img>", { src: mediaThumbnailUrl });
        sidebar.find(".mapping-feature-popup-image").html(thumbnail);
      } else {
        sidebar.find(".mapping-feature-popup-image").html("");
      }

      sidebar.data("selectedMediaId", mediaId);
    },
  );
});
