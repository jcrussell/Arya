const Lang = imports.lang;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

/**
 * TODO:
 * * Save/Load to/from a file
 * * Disable when the screensaver is active
 * * Add interface to see pretty graphs over time
 * * Sort apps based on total time or alphabetically
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

    // Setup state
    this._usage = {};
    this._updateState();
  },

  // Recalculate the menu which shows time for each app
  _refresh: function() {
    this._recordTime();
    this.menu.removeAll();

    for(let app in this._usage) {
      let str = app + ": " + Math.round(this._usage[app], 2) + " minutes";
      this.menu.addMenuItem(new PopupMenu.PopupMenuItem(str));
    }
  },

  // Callback for when app focus changes
  _onFocusChanged: function() {
    this._recordTime();
    this._updateState();
    this._refresh();
  },

  // Update the current app and touch the swap time
  _updateState: function() {
    this._curr_app = this._getCurrentAppName();
    this._swap_time = Date.now();
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
    // No previous app
    if(this._curr_app == null) {
      return;
    }

    let mins = (Date.now() - this._swap_time) / 1000 / 60;
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
