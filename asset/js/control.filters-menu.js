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
        button.innerHTML = '<svg viewBox="0 0 24 24" style="width: 18px; height: 18px;" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 11.1707L6 4C6 3.44771 5.55228 3 5 3C4.44771 3 4 3.44771 4 4L4 11.1707C2.83481 11.5825 2 12.6938 2 14C2 15.3062 2.83481 16.4175 4 16.8293L4 20C4 20.5523 4.44772 21 5 21C5.55228 21 6 20.5523 6 20L6 16.8293C7.16519 16.4175 8 15.3062 8 14C8 12.6938 7.16519 11.5825 6 11.1707ZM5 13C4.44772 13 4 13.4477 4 14C4 14.5523 4.44772 15 5 15C5.55228 15 6 14.5523 6 14C6 13.4477 5.55228 13 5 13Z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M19 21C18.4477 21 18 20.5523 18 20L18 18C18 17.9435 18.0047 17.8881 18.0137 17.8341C16.8414 17.4262 16 16.3113 16 15C16 13.6887 16.8414 12.5738 18.0137 12.1659C18.0047 12.1119 18 12.0565 18 12L18 4C18 3.44771 18.4477 3 19 3C19.5523 3 20 3.44771 20 4L20 12C20 12.0565 19.9953 12.1119 19.9863 12.1659C21.1586 12.5738 22 13.6887 22 15C22 16.3113 21.1586 17.4262 19.9863 17.8341C19.9953 17.8881 20 17.9435 20 18V20C20 20.5523 19.5523 21 19 21ZM18 15C18 14.4477 18.4477 14 19 14C19.5523 14 20 14.4477 20 15C20 15.5523 19.5523 16 19 16C18.4477 16 18 15.5523 18 15Z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M9 9C9 7.69378 9.83481 6.58254 11 6.17071V4C11 3.44772 11.4477 3 12 3C12.5523 3 13 3.44772 13 4V6.17071C14.1652 6.58254 15 7.69378 15 9C15 10.3113 14.1586 11.4262 12.9863 11.8341C12.9953 11.8881 13 11.9435 13 12L13 20C13 20.5523 12.5523 21 12 21C11.4477 21 11 20.5523 11 20L11 12C11 11.9435 11.0047 11.8881 11.0137 11.8341C9.84135 11.4262 9 10.3113 9 9ZM11 9C11 8.44772 11.4477 8 12 8C12.5523 8 13 8.44772 13 9C13 9.55229 12.5523 10 12 10C11.4477 10 11 9.55229 11 9Z"/></svg>';
        button.href = '#';
        button.title = 'Toggle filters menu';
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
