/**
 * Arya: Automatic Recorder of Your Activity.
 * Copyright (C) 2012 Jon Crussell
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const Lang = imports.lang;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const ScreenSaver = imports.misc.screenSaver;

const APPMENU_ICON_SIZE = 22;

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

    this._reset();
  },

  _reset: function() {
    // Setup state
    this._usage = {};
    this._updateState();
    this._swap_time = Date.now();
  },

  // Recalculate the menu which shows time for each app
  _refresh: function() {
    this._recordTime();

    let menu = this.menu;
    menu.removeAll();

    let usage = this._usage;
    let ids = Object.keys(usage).sort(function(x,y) { return (usage[y] - usage[x]) });
    let app_system = Shell.AppSystem.get_default();

    let count = 0;
    let total = 0;
    ids.forEach(function(id) {
      if(usage[id] < 1) return;
      let app = app_system.lookup_app(id);
      if(app) {
        let mins = Math.round(usage[id]);
        let icon = app.create_icon_texture(APPMENU_ICON_SIZE);
        let str = makeTimeStrFromMins(mins);
        menu.addMenuItem(new AppUsageMenuItem(icon, app.get_name(), str));
        count += 1; total += mins;
      }
    });

    if(count == 0) {
      menu.addMenuItem(new PopupMenu.PopupMenuItem("Insufficient History... get to work!"));
    }
    else { // Add Total and Reset
      menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      menu.addMenuItem(new TotalUsageMenuItem(makeTimeStrFromMins(total)));

      item = new PopupMenu.PopupMenuItem(_("Clear History"));
      item.connect('activate', Lang.bind(this, this._reset));
      this.menu.addMenuItem(item);
    }
  },

  // Callback for when app focus changes
  _onFocusChanged: function() {
    this._refresh();
    this._updateState();
  },

  // Callback for when screensaver state changed
  _onScreenSaverChanged: function(object, senderName, [isActive]) {
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
    this._curr_app = this._getCurrentAppId();
  },

  // Get the current app or null
  _getCurrentAppId: function() {
    let tracker = Shell.WindowTracker.get_default();
    let focusedApp = tracker.focus_app;
    // Not an application window
    if(!focusedApp) {
      return null;
    }

    return focusedApp.get_id();
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
    Main.panel._rightBox.insert_child_at_index(this.actor, 0);
    Main.panel._menus.addMenu(this.menu);

    // Connect to the tracker
    let tracker = Shell.WindowTracker.get_default();
    this._tracker_id = tracker.connect("notify::focus-app", Lang.bind(this, this._onFocusChanged));

    // Add Listener for screensaver
    this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
    this._screensaver_id = this._screenSaverProxy.connectSignal('ActiveChanged', Lang.bind(this, this._onScreenSaverChanged));
  },

  disable: function() {
    // Remove menu from panel
    Main.panel._menus.removeMenu(this.menu);
    Main.panel._rightBox.remove_actor(this.actor);

    // Remove tracker
    let tracker = Shell.WindowTracker.get_default();
    tracker.disconnect(this._tracker_id);

    this._screenSaverProxy.disconnect(this._screensaver_id);
  }
}

function makeTimeStrFromMins(mins) {
  if(mins > 60) { // Report usage in hours
    return Math.round(mins*100/60)/100 + " hours";
  }
  if(mins == 1) {
    return mins + " minute";
  }
  else {
    return mins + " minutes"
  }
}


/**
 * From: http://blog.fpmurphy.com/2011/05/more-gnome-shell-customization.html
 */
function AppUsageMenuItem() {
  this._init.apply(this, arguments);
}

AppUsageMenuItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function(icon, text1, text2, params) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

    this.label1 = new St.Label({ text: text1 });
    this.label2 = new St.Label({ text: text2 });
    this.icon = icon;

    this.addActor(this.label1);
    this.addActor(this.icon, { align: St.Align.END });
    this.addActor(this.label2, { align: St.Align.END });
  }
};

function TotalUsageMenuItem() {
  this._init.apply(this, arguments);
}

TotalUsageMenuItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function(time, params) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

    this.label1 = new St.Label({ text: "Total" });
    this.label2 = new St.Label({ text: "" });
    this.label3 = new St.Label({ text: time });

    this.addActor(this.label1);
    this.addActor(this.label2, { align: St.Align.END });
    this.addActor(this.label3, { align: St.Align.END });
  }
};
