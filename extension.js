const Lang = imports.lang;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const ScreenSaver = imports.misc.screenSaver;

/**
 * TODO:
 * * Save/Load to/from a file
 * * Add interface to see pretty graphs over time
 */

function init() {
  return new ActivityRecorder();
}

function ActivityRecorder() {
  this._init();
}

ActivityRecorder.prototype = {
  __proto__: PanelMenu.Button.prototype,

  _init: function() {
    // Setup the menu button
    PanelMenu.Button.prototype._init.call(this, St.Align.START);

    this.button = new St.Bin({
      style_class: 'panel-button',
      reactive: true,
      can_focus: true,
      x_fill: true,
      y_fill: false,
      track_hover: true
    });
    let icon = new St.Icon({
      icon_name: 'system-run',
      icon_type: St.IconType.SYMBOLIC,
      style_class: 'system-status-icon'
    });

    this.button.set_child(icon);
    this.actor.add_actor(this.button);

    // Refresh the menu (with updated times) every time it opens
    this.menu.connect('open-state-changed', Lang.bind(this, this._onMenuOpenStateChanged));

    // Add Listener for screensaver
    this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
    this._screenSaverProxy.connect('ActiveChanged', Lang.bind(this, this._onScreenSaverChanged));

    // Setup state
    this._usage = {};
    this._updateState();
  },

  // Recalculate the menu which shows time for each app
  _refresh: function() {
    this._recordTime();

    let menu = this.menu;
    menu.removeAll();

    let usage = this._usage
    let apps = Object.keys(usage).sort(function(x,y) { return (usage[y] - usage[x]) })

    apps.forEach(function(app) {
      if(usage[app] < 1) return;
      let str = app + ": " + Math.round(usage[app]) + " minutes";
      menu.addMenuItem(new PopupMenu.PopupMenuItem(str));
    });
  },

  // Callback for when app focus changes
  _onFocusChanged: function() {
    this._refresh();
    this._updateState();
  },

  // Callback for when screensaver state changed
  _onScreenSaverChanged: function(object, isActive) {
    if(!isActive) { // Changed from screen saver to awake
      this._swap_time = Date.now();
    }
    else { // Changed from awake to screen saver
      this._recordTime();
    }
  },

  // Callback for when the menu is opened or closed
  _onMenuOpenStateChanged: function(menu, isOpen) {
    if(isOpen) { // Changed from closed to open
      this._refresh();
    }
  },

  // Update the current app and touch the swap time
  _updateState: function() {
    this._curr_app = this._getCurrentAppName();
  },

  // Get the name of the current app or null
  _getCurrentAppName: function() {
    let tracker = Shell.WindowTracker.get_default();
    let focusedApp = tracker.focus_app;
    // Not an application window
    if(!focusedApp) {
      return null;
    }

    return focusedApp.get_name();
  },

  // Update the total time for the current app
  _recordTime: function() {
    let swap_time = this._swap_time;
    this._swap_time = Date.now();

    // No previous app
    if(this._curr_app == null) {
      return;
    }

    let mins = (Date.now() - swap_time) / 1000 / 60;
    this._usage[this._curr_app] = (this._usage[this._curr_app] || 0) + mins;
  },

  enable: function() {
    // Add menu to panel
    Main.panel._rightBox.insert_actor(this.actor, 0);
    Main.panel._menus.addMenu(this.menu);

    // Connect to the tracker
    let tracker = Shell.WindowTracker.get_default();
    tracker.connect("notify::focus-app", Lang.bind(this, this._onFocusChanged));
  },

  disable: function() {
    // Remove menu from panel
    Main.panel._menus.removeMenu(this.menu);
    Main.panel._rightBox.remove_actor(this.actor);

    // Remove tracker
    let tracker = Shell.WindowTracker.get_default();
    tracker.disconnect(this._onFocusChanged);
  }
}
