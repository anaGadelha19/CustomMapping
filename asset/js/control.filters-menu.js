// Control that displays a menu with toggles for different filters
L.Control.FiltersMenu = L.Control.extend({
    options: {
        position: 'topleft',
    },

    initialize: function (options) {
        L.setOptions(this, options);
        this._menuOpen = false;
        this._timelineToggleState = null;
    },

    onAdd: function (map) {
        this._map = map;

        var container = L.DomUtil.create('div', 'mapping-control-filters-menu leaflet-bar');
        this._container = container;

        // Main button
        var button = L.DomUtil.create('a', 'mapping-control-filters-menu-button', container);
        button.innerHTML = '<svg viewBox="0 0 24 24" height="18" width="18" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M4 7H20" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M7 12L17 12" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M11 17H13" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>' ;       button.href = '#';
        button.title = 'Filters menu';
        button.style.fontSize = '18px';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';

        // Menu popup
        var menu = L.DomUtil.create('div', 'mapping-filters-menu-popup', container);
        menu.style.display = 'none';
        this._menu = menu;

        // Add event handlers to prevent clicks on the menu from propagating to the map
        L.DomEvent.on(menu, 'mousedown', L.DomEvent.stopPropagation)
            .on(menu, 'click', L.DomEvent.stopPropagation)
            .on(menu, 'dblclick', L.DomEvent.stopPropagation)
            .on(menu, 'wheel', L.DomEvent.stopPropagation);

        // Menu title
        var menuTitle = L.DomUtil.create('div', 'mapping-filters-menu-title', menu);
        menuTitle.innerHTML = 'Filters';

        // Prevent map interactions when clicking the menu title
        L.DomEvent.on(menuTitle, 'mousedown', L.DomEvent.stopPropagation)
            .on(menuTitle, 'click', L.DomEvent.stopPropagation);

        // Menu items container
        var itemsContainer = L.DomUtil.create('div', 'mapping-filters-menu-items', menu);

        // Prevent map interactions when clicking in the items container
        L.DomEvent.on(itemsContainer, 'mousedown', L.DomEvent.stopPropagation)
            .on(itemsContainer, 'click', L.DomEvent.stopPropagation);

        // 1. Types Filter
        var typesItem = this._createFilterItem(
            itemsContainer,
            'Types Filter',
            'typesFilter',
            map
        );

        // 2. Timeline Filter
        var timelineItem = this._createFilterItem(
            itemsContainer,
            'Timeline',
            'timeline',
            map
        );
        this._timelineToggleState = timelineItem;
        // Disable timeline toggle by default (will be enabled if timeline data exists)
        this.disableTimelineToggle();

        // 3. Clusters Filter
        var clustersItem = this._createFilterItem(
            itemsContainer,
            'Clusters',
            'clusters',
            map
        );

        // Button click handler
        L.DomEvent
            .on(button, 'mousedown', L.DomEvent.stopPropagation)
            .on(button, 'dblclick', L.DomEvent.stopPropagation)
            .on(button, 'click', L.DomEvent.stopPropagation)
            .on(button, 'click', L.DomEvent.preventDefault)
            .on(button, 'click', this._toggleMenu, this);

        // Close menu when clicking outside
        L.DomEvent.on(document, 'click', this._handleDocumentClick, this);

        // Store references for later access
        map._filtersMenuControl = this;
        map._typesFilterToggle = typesItem.toggle;
        map._timelineFilterToggle = timelineItem.toggle;
        map._clustersFilterToggle = clustersItem.toggle;

        return container;
    },

    _createFilterItem: function (container, label, filterId, map) {
        var itemDiv = L.DomUtil.create('div', 'mapping-filters-menu-item', container);

        // Prevent map interactions when clicking anywhere in the item
        L.DomEvent.on(itemDiv, 'mousedown', L.DomEvent.stopPropagation)
            .on(itemDiv, 'click', L.DomEvent.stopPropagation)
            .on(itemDiv, 'dblclick', L.DomEvent.stopPropagation);

        var labelSpan = L.DomUtil.create('span', 'mapping-filters-menu-label', itemDiv);
        labelSpan.innerHTML = label;

        // Create toggle button
        var toggleButton = L.DomUtil.create('div', 'mapping-filters-menu-toggle mapping-filters-menu-toggle-active', itemDiv);
        toggleButton.id = 'mapping-filter-' + filterId;
        toggleButton.style.cursor = 'pointer';

        var toggleState = {
            enabled: true,
            toggle: toggleButton,
            filterId: filterId,
            isDisabled: false
        };

        L.DomEvent.on(toggleButton, 'mousedown', L.DomEvent.stopPropagation)
            .on(toggleButton, 'click', L.DomEvent.stopPropagation)
            .on(toggleButton, 'click', (e) => {
                // Prevent toggling if disabled
                if (toggleState.isDisabled) {
                    return;
                }
                
                toggleState.enabled = !toggleState.enabled;
                
                if (toggleState.enabled) {
                    L.DomUtil.addClass(toggleButton, 'mapping-filters-menu-toggle-active');
                } else {
                    L.DomUtil.removeClass(toggleButton, 'mapping-filters-menu-toggle-active');
                }
                
                this._handleFilterChange(filterId, toggleState.enabled, map);
            });

        return toggleState;
    },

    _handleFilterChange: function (filterId, isEnabled, map) {
        if (filterId === 'typesFilter') {
            // Toggle legend/types filter visibility
            var legendContainer = $('.mapping-map-legend');
            if (isEnabled) {
                legendContainer.removeClass('filters-hidden');
            } else {
                legendContainer.addClass('filters-hidden');
            }
        } else if (filterId === 'timeline') {
            // Toggle timeline visibility
            var timelineContainer = $('.timeline-date-slider-container');
            if (isEnabled) {
                timelineContainer.removeClass('hidden');
            } else {
                timelineContainer.addClass('hidden');
            }
        } else if (filterId === 'clusters') {
            // Toggle clustering
            map.clusteringEnabled = isEnabled;

            if (map.clusteringEnabled) {
                if (map._mappingAllLayers) {
                    map._mappingAllLayers.forEach((layer) => {
                        if (map.hasLayer(layer)) {
                            map.removeLayer(layer);
                        }
                    });
                }
                if (map._mappingFeaturesPoint && !map.hasLayer(map._mappingFeaturesPoint)) {
                    map.addLayer(map._mappingFeaturesPoint);
                }
                if (map._mappingFeaturesPoly && !map.hasLayer(map._mappingFeaturesPoly)) {
                    map.addLayer(map._mappingFeaturesPoly);
                }
            } else {
                if (map._mappingFeaturesPoint) {
                    map.removeLayer(map._mappingFeaturesPoint);
                }
                if (map._mappingFeaturesPoly) {
                    map.removeLayer(map._mappingFeaturesPoly);
                }

                if (!map._layerVisibilityMap) {
                    map._layerVisibilityMap = new Map();
                }
                map._layerVisibilityMap.clear();

                if (map._mappingFeaturesPoint) {
                    map._mappingFeaturesPoint.eachLayer((layer) => {
                        map._layerVisibilityMap.set(layer, true);
                    });
                }
                if (map._mappingFeaturesPoly) {
                    map._mappingFeaturesPoly.eachLayer((layer) => {
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
            }
        }
    },

    disableTimelineToggle: function () {
        if (this._timelineToggleState && this._timelineToggleState.toggle) {
            const toggle = this._timelineToggleState.toggle;
            L.DomUtil.addClass(toggle, 'mapping-filters-menu-toggle-disabled');
            toggle.style.cursor = 'not-allowed';
            this._timelineToggleState.isDisabled = true;
        }
    },

    enableTimelineToggle: function () {
        if (this._timelineToggleState && this._timelineToggleState.toggle) {
            const toggle = this._timelineToggleState.toggle;
            L.DomUtil.removeClass(toggle, 'mapping-filters-menu-toggle-disabled');
            toggle.style.cursor = 'pointer';
            this._timelineToggleState.isDisabled = false;
        }
    },

    _toggleMenu: function (e) {
        this._menuOpen = !this._menuOpen;

        if (this._menuOpen) {
            this._menu.style.display = 'block';
        } else {
            this._menu.style.display = 'none';
        }
    },

    _handleDocumentClick: function (e) {
        // Close menu if clicking outside the control
        if (!this._container.contains(e.target) && this._menuOpen) {
            this._menuOpen = false;
            this._menu.style.display = 'none';
        }
    },

    onRemove: function (map) {
        L.DomEvent.off(document, 'click', this._handleDocumentClick, this);
    }
});

L.control.filtersMenu = function (options) {
    return new L.Control.FiltersMenu(options);
};
