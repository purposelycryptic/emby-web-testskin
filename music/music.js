define(['loading', 'mainTabsManager', 'backdrop', 'connectionManager', 'scroller', 'globalize', 'alphaPicker', 'require', './../components/focushandler', 'emby-itemscontainer', 'emby-tabs', 'emby-button', 'emby-scroller'], function (loading, mainTabsManager, backdrop, connectionManager, scroller, globalize, AlphaPicker, require, focusHandler) {
    'use strict';

    function trySelectValue(instance, alphaPicker, view, value) {

        var card;

        // If it's the symbol just pick the first card
        if (value === '#') {

            card = view.querySelector('.card');

            if (card) {
                instance.scroller.toStart(card, false);
                return;
            }
        }

        card = view.querySelector('.card[data-prefix^=\'' + value + '\']');

        if (card) {
            instance.scroller.toStart(card, false);
            return;
        }

        // go to the previous letter
        var values = alphaPicker.values();
        var index = values.indexOf(value);

        if (index < values.length - 2) {
            trySelectValue(instance, alphaPicker, view, values[index + 1]);
        } else {
            var all = view.querySelectorAll('.card');
            card = all.length ? all[all.length - 1] : null;

            if (card) {
                instance.scroller.toStart(card, false);
            }
        }
    }

    function initAlphaPicker(instance, alphaPickerElement, itemsContainerElement) {

        var alphaPicker = new AlphaPicker({
            element: alphaPickerElement,
            itemsContainer: itemsContainerElement,
            itemClass: 'card'
        });

        alphaPicker.on('alphavaluechanged', function () {
            var value = alphaPicker.value();
            trySelectValue(instance, alphaPicker, itemsContainerElement, value);
        });

        instance.alphaPickers.push(alphaPicker);
    }

    function initAlphaPickers(instance, view) {

        var pickers = view.querySelectorAll('.alphaPicker');
        instance.alphaPickers = [];

        for (var i = 0, length = pickers.length; i < length; i++) {

            var itemsContainer = view.querySelector('.tabContent[data-index="' + pickers[i].getAttribute('data-index') + '"] .itemsContainer');

            initAlphaPicker(instance, pickers[i], itemsContainer);
        }
    }

    function getTabs() {
        return [
            {
                name: globalize.translate('Suggestions')
            },
            {
                name: globalize.translate('Albums')
            },
            {
                name: globalize.translate('Artists')
            },
            {
                name: globalize.translate('AlbumArtists')
            },
            {
                name: globalize.translate('Playlists')
            },
            /*{
                name: globalize.translate('Songs')
            },*/
            {
                name: globalize.translate('Genres')
            }];
    }

    return function (view, params) {

        var self = this;

        var tabControllers = [];
        var currentTabController;

        function getTabController(page, index, callback) {

            var depends = [];

            switch (index) {

                case 0:
                    depends.push('./suggestions');
                    break;
                case 1:
                    depends.push('./albums');
                    break;
                case 2:
                    depends.push('./artists');
                    break;
                case 3:
                    depends.push('./artists');
                    break;
                case 4:
                    depends.push('./playlists');
                    break;
                //case 5:
                //    depends.push('./songs');
                //    break;
                case 5:
                    depends.push('./genres');
                    break;
                default:
                    break;
            }

            require(depends, function (controllerFactory) {

                var controller = tabControllers[index];
                if (!controller) {
                    var tabContent = view.querySelector('.tabContent[data-index=\'' + index + '\']');
                    controller = new controllerFactory(tabContent, params, view);
                    if (index === 2) {
                        controller.mode = 'albumartists';
                    }
                    tabControllers[index] = controller;
                }

                callback(controller);
            });
        }

        self.scroller = view.querySelector('.scrollFrameY');

        var alphaPickerContainers = view.querySelectorAll('.alphaPickerContainer');
        var currentTabIndex = parseInt(params.tab || '0');
        var initialTabIndex = currentTabIndex;
        var isViewRestored;

        function preLoadTab(index) {

            for (var i = 0, length = alphaPickerContainers.length; i < length; i++) {
                if (alphaPickerContainers[i].getAttribute('data-index') === index.toString()) {
                    alphaPickerContainers[i].classList.remove('hide');
                } else {
                    alphaPickerContainers[i].classList.add('hide');
                }
            }

            getTabController(view, index, function (controller) {
                if (controller.onBeforeShow) {

                    var refresh = !controller.refreshed;

                    controller.onBeforeShow({
                        refresh: refresh
                    });

                    controller.refreshed = true;
                }
            });
        }

        function loadTab(index) {

            getTabController(view, index, function (controller) {

                controller.onShow({
                    autoFocus: initialTabIndex != null
                });
                initialTabIndex = null;
                currentTabIndex = index;
                currentTabController = controller;
            });
        }

        initAlphaPickers(this, view);

        function getTabContainers() {
            return view.querySelectorAll('.tabContent');
        }

        function onBeforeTabChange(e) {

            preLoadTab(parseInt(e.detail.selectedTabIndex));
        }

        function onTabChange(e) {
            var newIndex = parseInt(e.detail.selectedTabIndex);
            var previousTabController = tabControllers[newIndex];
            if (previousTabController && previousTabController.onHide) {
                previousTabController.onHide();
            }

            loadTab(newIndex);
        }

        view.addEventListener('viewbeforehide', function (e) {

            if (currentTabController && currentTabController.onHide) {
                currentTabController.onHide();
            }
        });

        view.addEventListener('viewbeforeshow', function (e) {

            isViewRestored = e.detail.isRestored;

            mainTabsManager.setTabs(view, currentTabIndex, getTabs, getTabContainers, onBeforeTabChange, onTabChange);
        });

        view.addEventListener('viewshow', function (e) {

            isViewRestored = e.detail.isRestored;

            Emby.Page.setTitle('');
            backdrop.clear();

            if (!isViewRestored) {
                mainTabsManager.selectedTabIndex(initialTabIndex);
            }
        });

        view.addEventListener('viewdestroy', function (e) {

            tabControllers.forEach(function (t) {
                if (t.destroy) {
                    t.destroy();
                }
            });

            self.scroller = null;

            var alphaPickers = self.alphaPickers || [];
            for (var i = 0, length = alphaPickers.length; i < length; i++) {

                alphaPickers[i].destroy();
            }

            self.alphaPickers = null;
        });
    };

});