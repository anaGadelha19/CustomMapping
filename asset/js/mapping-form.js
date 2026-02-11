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
   * @param featureTypeId
   * @param featureMediaId
   */
  const addFeature = function (
    feature,
    featureId,
    featureLabel,
    featureDescription,
    featureMarkerColor,
    featureTypeId,
    featureMediaId,
    featurePropertyIds,
  ) {
    const typeColor = featureTypeId ? getTypeColorById(featureTypeId) : null;
    const markerColor = typeColor || featureMarkerColor || "#3498db";

    feature.on("click", function (e) {
      // Get sidebar element
      const sidebar = $("#mapping-feature-editor");

      // Attach the feature data to the sidebar for use
      sidebar.data("feature", feature);
      sidebar.data("selectedMediaId", featureMediaId);
      sidebar.data("propertyIds", feature.propertyIds || []);
      // sidebar.data('featureMarkerColor', featureMarkerColor);

      // Populate sidebar inputs with current feature data
      sidebar.find(".mapping-feature-label").val(featureLabel);
      sidebar.find(".mapping-feature-type").val(featureTypeId || "");
      sidebar.find(".mapping-feature-description").val(featureDescription);
      sidebar.find(".color-swatch").removeClass("selected");

      if (markerColor) {
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

      setColorPickerLocked(!!featureTypeId);
      renderItemFieldsForFeature(sidebar, feature);

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
    feature.featureTypeId = featureTypeId || null;
    feature.propertyIds = normalizePropertyIds(featurePropertyIds);

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
        name: featureNamePrefix + "[o:feature_type][o:id]",
        value: featureTypeId || "",
      }),
    );

    mappingForm.append(
      $("<input>", {
        type: "hidden",
        name: featureNamePrefix + "[o-module-mapping:property_ids]",
        value: JSON.stringify(feature.propertyIds),
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

  // Auxiliar Functions
  const getFeatureNamePrefix = function (feature) {
    return `o-module-mapping:feature[${drawnFeatures.getLayerId(feature)}]`;
  };

  const getTypeColorById = function (typeId) {
    if (!typeId) {
      return null;
    }
    const option = $(
      `#mapping-feature-editor .mapping-feature-type option[value="${typeId}"]`,
    );
    return option.length ? option.data("color") : null;
  };
  // Lock color picker when type is selected
  const setColorPickerLocked = function (isLocked) {
    const colorPicker = $(
      "#mapping-feature-editor .mapping-feature-color-picker",
    );
    colorPicker.toggleClass("is-locked", isLocked);
    colorPicker
      .find(".color-swatch, #add-custom-color, #custom-color-input")
      .prop("disabled", isLocked);
  };
  // Checks if color picker is locked
  const isColorPickerLocked = function () {
    return $("#mapping-feature-editor .mapping-feature-color-picker").hasClass(
      "is-locked",
    );
  };
// Type management functions
  const getTypeAddUrl = function () {
    return $("#mapping-feature-editor").data("typeAddUrl");
  };

  const getTypeDeleteUrl = function () {
    return $("#mapping-feature-editor").data("typeDeleteUrl");
  };

  const getTypeUpdateUrl = function () {
    return $("#mapping-feature-editor").data("typeUpdateUrl");
  };

  // 
  const itemFieldsContainer = $(
    "#mapping-feature-editor .mapping-feature-item-fields",
  );
  const rawItemFields = itemFieldsContainer.length
    ? itemFieldsContainer.data("itemFields")
    : [];
  const itemFields = Array.isArray(rawItemFields) ? rawItemFields : [];
  const itemFieldsById = {};
  itemFields.forEach((field) => {
    itemFieldsById[String(field.id)] = field;
  });

  const normalizePropertyIds = function (value) {
    if (Array.isArray(value)) {
      return value.map((id) => String(id));
    }
    if (typeof value === "string" && value.trim() !== "") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map((id) => String(id));
        }
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const renderItemFieldsList = function (sidebar, propertyIds) {
    const list = sidebar.find(".mapping-feature-item-fields-list");
    list.empty();
    const ids = Array.isArray(propertyIds) ? propertyIds : [];
    if (!ids.length) {
      list.append(
        $("<div>", {
          class: "mapping-feature-item-fields-empty",
          text: "No fields added.",
        }),
      );
      return;
    }
    ids.forEach((id) => {
      const field = itemFieldsById[String(id)];
      if (!field) {
        return;
      }
      const values = Array.isArray(field.values) ? field.values.join("; ") : "";
      const row = $("<div>", {
        class: "mapping-feature-item-field",
        "data-field-id": id,
      });
      row.append(
        $("<div>", {
          class: "mapping-feature-item-field-label",
          text: `${field.label}:`,
        }),
      );
      row.append(
        $("<div>", {
          class: "mapping-feature-item-field-values",
          text: values,
        }),
      );
      row.append(
        $("<button>", {
          type: "button",
          class: "mapping-feature-item-field-remove o-icon-close",
          "aria-label": "Remove field",
        }).append($("<span>", { class: "screen-reader-text", text: "Remove" })),
      );
      list.append(row);
    });
  };

  const buildItemFieldsSelect = function (sidebar, propertyIds) {
    const select = sidebar.find(".mapping-feature-item-fields-select");
    select.find("option:not(:first)").remove();
    const selectedSet = new Set(
      (Array.isArray(propertyIds) ? propertyIds : []).map((id) => String(id)),
    );
    itemFields.forEach((field) => {
      if (selectedSet.has(String(field.id))) {
        return;
      }
      select.append($("<option>", { value: field.id, text: field.label }));
    });
    const hasOptions = select.find("option").length > 1;
    select.prop("disabled", !hasOptions);
  };

  const updateFeaturePropertyIds = function (feature, propertyIds) {
    const ids = Array.isArray(propertyIds) ? propertyIds : [];
    feature.propertyIds = ids;
    const featureNamePrefix = getFeatureNamePrefix(feature);
    $(`input[name="${featureNamePrefix}[o-module-mapping:property_ids]"]`).val(
      JSON.stringify(ids),
    );
  };

  const renderItemFieldsForFeature = function (sidebar, feature) {
    const ids = normalizePropertyIds(feature.propertyIds);
    renderItemFieldsList(sidebar, ids);
    buildItemFieldsSelect(sidebar, ids);
  };

  const typeManager = $("#mapping-type-manager");
  const typeList = typeManager.find(".mapping-type-list");

  const openTypeManager = function () {
    typeManager.addClass("is-open").attr("aria-hidden", "false");
    typeManager.find(".mapping-type-add-form").prop("hidden", true);
  };

  const closeTypeManager = function () {
    typeManager.removeClass("is-open").attr("aria-hidden", "true");
    const panel = $("#mapping-type-manager .mapping-type-edit-panel");
    panel.removeClass("is-open");
    panel.data("typeId", null);
    panel.find(".mapping-type-edit-current").text("Select a type to edit.");
    panel.find(".mapping-type-edit-save").prop("disabled", true);
    typeManager.find(".mapping-type-add-form").prop("hidden", true);
  };

  const addTypeOption = function (type) {
    const option = $("<option>", {
      value: type.id,
      text: type.label,
      "data-color": type.color,
    });
    $("#mapping-feature-editor .mapping-feature-type").append(option);
  };

  const addTypeListItem = function (type) {
    const item = $("<div>", {
      class: "mapping-type-item",
      role: "listitem",
      "data-type-id": type.id,
      "data-color": type.color,
    });
    const color = $("<span>", {
      class: "mapping-type-color",
      css: { backgroundColor: type.color },
    });
    const label = $("<span>", {
      class: "mapping-type-label-text",
      text: type.label,
    });
    const edit = $("<button>", {
      type: "button",
      class: "mapping-type-edit o-icon-edit",
      "data-type-id": type.id,
    }).append(
      $("<span>", {
        class: "screen-reader-text",
        text: "Edit",
      }),
    );
    const del = $("<button>", {
      type: "button",
      class: "mapping-type-delete o-icon-delete",
      "data-type-id": type.id,
    }).append(
      $("<span>", {
        class: "screen-reader-text",
        text: "Delete",
      }),
    );

    item.append(color, label, edit, del);
    typeList.append(item);
  };

  const showToast = function (message) {
    let toast = $(".mapping-toast");
    if (!toast.length) {
      toast = $("<div>", { class: "mapping-toast" }).appendTo("body");
    }
    toast.text(message).addClass("is-visible");
    clearTimeout(toast.data("timeout"));
    const timeout = setTimeout(() => {
      toast.removeClass("is-visible");
    }, 3000);
    toast.data("timeout", timeout);
  };

  const isDuplicateTypeColor = function (color, excludeTypeId = null) {
    if (!color) return false;
    const target = String(color).toLowerCase();
    let duplicate = false;
    typeList.find(".mapping-type-item").each(function () {
      const item = $(this);
      const itemId = String(item.data("typeId"));
      if (excludeTypeId && String(excludeTypeId) === itemId) {
        return;
      }
      const existing = String(item.data("color") || "").toLowerCase();
      if (existing && existing === target) {
        duplicate = true;
      }
    });
    return duplicate;
  };

  const setTypeColorSelection = function (container, color) {
    container.find(".mapping-type-color-swatch").removeClass("selected");
    container
      .find(`.mapping-type-color-swatch[data-color="${color}"]`)
      .addClass("selected");
    container.find(".mapping-type-color-input").val(color);
  };

  const setTypeEditColorSelection = function (container, color) {
    container.find(".mapping-type-edit-color-swatch").removeClass("selected");
    container
      .find(`.mapping-type-edit-color-swatch[data-color="${color}"]`)
      .addClass("selected");
    container.find(".mapping-type-edit-color-input").val(color);
  };

  const ensureTypeSwatch = function (picker, color, swatchClass) {
    if (picker.find(`[data-color="${color}"]`).length) {
      return;
    }
    const swatch = $("<button>", {
      type: "button",
      class: swatchClass,
      "data-color": color,
      css: { backgroundColor: color },
    });
    const addBtn = picker.find(
      ".mapping-type-add-custom-color, .mapping-type-edit-add-custom-color",
    );
    if (addBtn.length) {
      addBtn.first().before(swatch);
    } else {
      picker.append(swatch);
    }
  };

  setTypeColorSelection(typeManager, "#3498db");
  setTypeEditColorSelection(typeManager, "#3498db");

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

  L.Draw.Marker.prototype.options.icon = createPinIcon("#3498db");
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
    const featureTypeId = data["o:feature_type"]
      ? data["o:feature_type"]["o:id"]
      : null;
    const geoJson = {
      type: data["o-module-mapping:geography-type"],
      coordinates: data["o-module-mapping:geography-coordinates"],
    };

    const typeColor = featureTypeId ? getTypeColorById(featureTypeId) : null;
    const markerColor =
      typeColor ||
      (data["o:marker_color"] !== undefined
        ? data["o:marker_color"]
        : "#3498db");

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
          featureTypeId,
          featureMediaId,
          data["o-module-mapping:property_ids"],
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
      if (e.layerType === "marker" && e.layer && e.layer.setIcon) {
        e.layer.setIcon(createPinIcon("#3498db"));
      }
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
      new L.Marker([e.location.y, e.location.x], {
        icon: createPinIcon("#3498db"),
      }),
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
        fillColor: color,
      });
    }
  }

  // --------------------- Title ---------------------
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

  // --------------------- Description ---------------------
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

  // --------------------- Fields ---------------------
  // Add selected item field
  $("#mapping-feature-editor").on(
    "click",
    ".mapping-feature-item-fields-add",
    function () {
      const sidebar = $("#mapping-feature-editor");
      const feature = sidebar.data("feature");
      if (!feature) return;

      const container = $(this).closest(".mapping-feature-item-fields");
      const select = container.find(".mapping-feature-item-fields-select");
      const selectedId = select.val();
      if (!selectedId) return;

      const ids = normalizePropertyIds(feature.propertyIds);
      if (!ids.includes(String(selectedId))) {
        ids.push(String(selectedId));
        updateFeaturePropertyIds(feature, ids);
      }
      renderItemFieldsList(sidebar, ids);
      buildItemFieldsSelect(sidebar, ids);
      select.val("");
    },
  );

  // Remove item field
  $("#mapping-feature-editor").on(
    "click",
    ".mapping-feature-item-field-remove",
    function () {
      const sidebar = $("#mapping-feature-editor");
      const feature = sidebar.data("feature");
      if (!feature) return;

      const fieldId = $(this)
        .closest(".mapping-feature-item-field")
        .data("fieldId");
      const ids = normalizePropertyIds(feature.propertyIds).filter(
        (id) => String(id) !== String(fieldId),
      );
      updateFeaturePropertyIds(feature, ids);
      renderItemFieldsList(sidebar, ids);
      buildItemFieldsSelect(sidebar, ids);
    },
  );

  // --------------------- Marker Color Selection ---------------------
  // Selecting a marker color
  $("#mapping-feature-editor").on("click", ".color-swatch", function () {
    const sidebar = $("#mapping-feature-editor");
    const feature = sidebar.data("feature");
    if (!feature) return;
    if (isColorPickerLocked()) return;

    const color = $(this).data("color");
    const featureNamePrefix = feature._mappingNamePrefix;

    $(".color-swatch").removeClass("selected");
    $(this).addClass("selected");

    $(`input[name="${featureNamePrefix}[o:marker_color]"]`).val(color);

    updateFeatureStyle(feature, color);
  });

  // Open native color picker
  $("#mapping-feature-editor").on("click", "#add-custom-color", function () {
    if (isColorPickerLocked()) return;
    $("#custom-color-input").click();
  });

  // When user picks a color
  $("#mapping-feature-editor").on("change", "#custom-color-input", function () {
    const color = $(this).val();
    const sidebar = $("#mapping-feature-editor");
    const feature = sidebar.data("feature");
    if (!feature) return;
    if (isColorPickerLocked()) return;

    // For duplicates
    if ($(`.color-swatch[data-color="${color}"]`).length) {
      $(`.color-swatch[data-color="${color}"]`).click();
      return;
    }

    // Custom new swatch
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

  // --------------------- Types ---------------------
  // Selecting a type locks color picker and applies type color
  $("#mapping-feature-editor").on(
    "change",
    ".mapping-feature-type",
    function () {
      const sidebar = $("#mapping-feature-editor");
      const feature = sidebar.data("feature");
      if (!feature) return;

      const featureNamePrefix = feature._mappingNamePrefix;
      const typeId = $(this).val();

      $(`input[name="${featureNamePrefix}[o:feature_type][o:id]"]`).val(typeId);
      feature.featureTypeId = typeId || null;

      if (typeId) {
        const typeColor =
          getTypeColorById(typeId) || feature.markerColor || "#3498db";
        setColorPickerLocked(true);
        $(".color-swatch").removeClass("selected");
        sidebar
          .find(`.color-swatch[data-color="${typeColor}"]`)
          .addClass("selected");
        $(`input[name="${featureNamePrefix}[o:marker_color]"]`).val(typeColor);
        updateFeatureStyle(feature, typeColor);
      } else {
        setColorPickerLocked(false);
      }
    },
  );

  // Open/close type modal
  $("#mapping-feature-editor").on(
    "click",
    ".mapping-type-manager-button",
    function () {
      openTypeManager();
    },
  );

  $("#mapping-type-manager").on(
    "click",
    ".mapping-type-manager-close, .mapping-type-modal-overlay",
    function () {
      closeTypeManager();
    },
  );

  // Toggle add new type section
  $("#mapping-type-manager").on(
    "click",
    ".mapping-type-add-toggle-button",
    function () {
      const wrapper = $("#mapping-type-manager");
      const form = wrapper.find(".mapping-type-add-form");
      const isHidden = form.prop("hidden");
      form.prop("hidden", !isHidden);
    },
  );

  // Select type color swatch
  $("#mapping-type-manager").on(
    "click",
    ".mapping-type-color-swatch",
    function () {
      const wrapper = $("#mapping-type-manager");
      const color = $(this).data("color");
      setTypeColorSelection(wrapper, color);
    },
  );

  // Add custom color for new type
  $("#mapping-type-manager").on(
    "click",
    ".mapping-type-add-custom-color",
    function () {
      $("#mapping-type-manager .mapping-type-custom-color-input").click();
    },
  );

  $("#mapping-type-manager").on(
    "change",
    ".mapping-type-custom-color-input",
    function () {
      const wrapper = $("#mapping-type-manager");
      const color = $(this).val();
      const picker = wrapper.find(".mapping-type-color-picker");
      ensureTypeSwatch(picker, color, "mapping-type-color-swatch");
      setTypeColorSelection(wrapper, color);
    },
  );

  // Add new type in modal
  $("#mapping-type-manager").on(
    "click",
    ".mapping-type-add-button",
    function () {
      const addUrl = getTypeAddUrl();
      if (!addUrl) {
        alert("Type add URL is missing.");
        return;
      }

      const wrapper = $("#mapping-type-manager");
      const label = wrapper.find(".mapping-type-label").val().trim();
      const color = wrapper.find(".mapping-type-color-input").val();

      if (!label) {
        alert("Please enter a type label.");
        return;
      }

      const formData = new FormData();
      formData.append("label", label);
      formData.append("color", color);

      fetch(addUrl, {
        method: "POST",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json",
        },
        body: formData,
        credentials: "same-origin",
      })
        .then((response) => response.json())
        .then((data) => {
          if (!data || !data.id) {
            throw new Error("Invalid response");
          }
          addTypeOption(data);
          addTypeListItem(data);
          $("#mapping-feature-editor .mapping-feature-type")
            .val(data.id)
            .trigger("change");
          wrapper.find(".mapping-type-label").val("");
          setTypeColorSelection(wrapper, "#3498db");
        })
        .catch(() => {
          alert("Could not add type. Repeated colors are not allowed.");
        });
    },
  );

  // Start editing type color
  $("#mapping-type-manager").on("click", ".mapping-type-edit", function () {
    const typeId = $(this).data("typeId");
    if (!typeId) return;

    const item = typeList.find(`.mapping-type-item[data-type-id="${typeId}"]`);
    const label = item.find(".mapping-type-label-text").text();
    const color =
      item.data("color") ||
      item.find(".mapping-type-color").css("background-color");

    const panel = $("#mapping-type-manager .mapping-type-edit-panel");
    panel.data("typeId", typeId);
    panel.addClass("is-open");
    panel.find(".mapping-type-edit-current").text(label);
    panel.find(".mapping-type-edit-save").prop("disabled", false);

    const picker = panel.find(".mapping-type-edit-color-picker");
    if (color && color.startsWith("rgb")) {
      // Convert rgb to hex
      const rgb = color.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const hex =
          "#" +
          rgb
            .slice(0, 3)
            .map((x) => Number(x).toString(16).padStart(2, "0"))
            .join("");
        ensureTypeSwatch(picker, hex, "mapping-type-edit-color-swatch");
        setTypeEditColorSelection(panel, hex);
        return;
      }
    }

    if (color) {
      ensureTypeSwatch(picker, color, "mapping-type-edit-color-swatch");
      setTypeEditColorSelection(panel, color);
    }
  });

  // Select edit color swatch
  $("#mapping-type-manager").on(
    "click",
    ".mapping-type-edit-color-swatch",
    function () {
      const panel = $("#mapping-type-manager .mapping-type-edit-panel");
      const color = $(this).data("color");
      setTypeEditColorSelection(panel, color);
    },
  );

  // Add custom color for edit
  $("#mapping-type-manager").on(
    "click",
    ".mapping-type-edit-add-custom-color",
    function () {
      $("#mapping-type-manager .mapping-type-edit-custom-color-input").click();
    },
  );

  $("#mapping-type-manager").on(
    "change",
    ".mapping-type-edit-custom-color-input",
    function () {
      const panel = $("#mapping-type-manager .mapping-type-edit-panel");
      const color = $(this).val();
      const picker = panel.find(".mapping-type-edit-color-picker");
      ensureTypeSwatch(picker, color, "mapping-type-edit-color-swatch");
      setTypeEditColorSelection(panel, color);
    },
  );

  // Save edited type color
  $("#mapping-type-manager").on(
    "click",
    ".mapping-type-edit-save",
    function () {
      const updateUrl = getTypeUpdateUrl();
      if (!updateUrl) {
        alert("Type update URL is missing.");
        return;
      }

      const panel = $("#mapping-type-manager .mapping-type-edit-panel");
      const typeId = panel.data("typeId");
      const color = panel.find(".mapping-type-edit-color-input").val();
      if (!typeId || !color) return;

      const formData = new FormData();
      formData.append("id", typeId);
      formData.append("color", color);

      fetch(updateUrl, {
        method: "POST",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json",
        },
        body: formData,
        credentials: "same-origin",
      })
        .then((response) => response.json())
        .then((data) => {
          if (!data || !data.success) {
            throw new Error("Invalid response");
          }

          const item = typeList.find(
            `.mapping-type-item[data-type-id="${typeId}"]`,
          );
          item.data("color", color);
          item.find(".mapping-type-color").css("background-color", color);

          const select = $("#mapping-feature-editor .mapping-feature-type");
          select.find(`option[value="${typeId}"]`).data("color", color);

          const sidebar = $("#mapping-feature-editor");
          const feature = sidebar.data("feature");
          if (
            feature &&
            feature.featureTypeId &&
            String(feature.featureTypeId) === String(typeId)
          ) {
            const featureNamePrefix = feature._mappingNamePrefix;
            setColorPickerLocked(true);
            sidebar.find(".color-swatch").removeClass("selected");
            if (!sidebar.find(`.color-swatch[data-color="${color}"]`).length) {
              const newSwatch = $("<button>", {
                type: "button",
                class: "color-swatch",
                "data-color": color,
                css: { backgroundColor: color },
              });
              sidebar.find(".color-swatches").append(newSwatch);
            }
            sidebar
              .find(`.color-swatch[data-color="${color}"]`)
              .addClass("selected");
            $(`input[name="${featureNamePrefix}[o:marker_color]"]`).val(color);
            updateFeatureStyle(feature, color);
          }

          // Close the type edit panel after saving a new color
          const panel = $("#mapping-type-manager .mapping-type-edit-panel");
          panel.removeClass("is-open");
          panel.data("typeId", null);
          panel
            .find(".mapping-type-edit-current")
            .text("Select a type to edit.");
          panel.find(".mapping-type-edit-save").prop("disabled", true);
        })
        .catch(() => {
          alert(
            "Could not update type color. Repeated colors are not allowed.",
          );
        });
    },
  );

  // Delete existing type
  $("#mapping-type-manager").on("click", ".mapping-type-delete", function () {
    const deleteUrl = getTypeDeleteUrl();
    if (!deleteUrl) {
      alert("Type delete URL is missing.");
      return;
    }

    const typeId = $(this).data("typeId");
    if (!typeId) return;

    if (!confirm("Delete this type?")) {
      return;
    }

    const formData = new FormData();
    formData.append("id", typeId);

    fetch(deleteUrl, {
      method: "POST",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
      body: formData,
      credentials: "same-origin",
    })
      .then((response) => response.json())
      .then((data) => {
        if (!data || !data.success) {
          throw new Error("Invalid response");
        }

        typeList.find(`.mapping-type-item[data-type-id="${typeId}"]`).remove();
        const select = $("#mapping-feature-editor .mapping-feature-type");
        select.find(`option[value="${typeId}"]`).remove();

        if (select.val() === String(typeId)) {
          select.val("").trigger("change");
        }
      })
      .catch(() => {
        alert("Could not delete type.");
      });
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

  // Handle fullscreen mode - ensure sidebar and legend are visible
  map.on('enterFullscreen', function() {
    const mapContainer = map.getContainer();
    const sidebar = $('#mapping-feature-editor');
    const legend = $('.mapping-map-legend');
    
    // Move elements into fullscreen container
    if (sidebar.length) {
      sidebar.appendTo(mapContainer);
    }
    if (legend.length) {
      legend.appendTo(mapContainer);
    }
    
    // Add fullscreen class to body for additional styling
    $('body').addClass('mapping-fullscreen-active');
  });

  map.on('exitFullscreen', function() {
    const sidebar = $('#mapping-feature-editor');
    const legend = $('.mapping-map-legend');
    const mapSection = $('#mapping-section');
    const mapContainer = $('.mapping-map-container');
    
    // Move elements back to their original positions
    if (sidebar.length && mapSection.length) {
      sidebar.appendTo(mapSection);
    }
    if (legend.length && mapContainer.length) {
      legend.appendTo(mapContainer);
    }
    
    // Remove fullscreen class from body
    $('body').removeClass('mapping-fullscreen-active');
  });
});
