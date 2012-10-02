/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = ["MigrationManager"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const Nsreg = Cu.import("resource://nc4migrator-modules/nsreg.js", {});

const { Util } = Cu.import('resource://nc4migrator-modules/Util.js', {});
const { MessengerMigrator } = Cu.import('resource://nc4migrator-modules/MessengerMigrator.js', {});
const { StringBundle } = Cu.import('resource://nc4migrator-modules/StringBundle.js', {});
const { Preferences } = Cu.import("resource://nc4migrator-modules/Preferences.js", {});
const Prefs = new Preferences("");
const Messages = {
  _messages : new Preferences("extensions.nc4migrator.wizard."),
  getLocalized: function (key, defaultValue) {
    if (this._messages.has(key + ".override"))
      key += ".override";
    return this._messages.getLocalized(key, defaultValue);
  }
};

function NcProfile(name, profileDirectory) {
  this.name = name;
  this.profileDirectory = profileDirectory;
  this.prefsObject = this.getPrefsObject();
}

NcProfile.prototype = {
  get mailAddress() {
    return !this.prefsObject ? null :
           this.prefsObject["mail.identity.useremail"] || null;
  },

  get migrated() {
    return this.getMigrator().alreadyMigrated;
  },

  getMigrator: function () {
    var imapServersFilter = null;
    if (Prefs.get("extensions.nc4migrator.limitImapServersToMigrate")) {
      imapServersFilter = function (servers) {
        var imapServersToMigrate = (
          Prefs.get("extensions.nc4migrator.imapServersToMigrate") || ""
        ).split(",");
        return servers.filter(function (server) imapServersToMigrate.indexOf(server) >= 0);
      };
    }

    return new MessengerMigrator(this.prefsObject, {
      profileDirectory: this.profileDirectory,
      imapServersFilter: imapServersFilter
    });
  },

  getPrefsObject: function () {
    var prefsFile = Util.getFile(this.profileDirectory);
    prefsFile.append('prefs.js');

    if (!prefsFile.exists())
      return null;

    var prefsObject = {};

    var setPref = function(aKey, aValue) {
      if (typeof aValue == 'number' && isNaN(aValue)) return;
      prefsObject[aKey] = aValue;
    };

    var sandbox = {
      user_pref : setPref,
      pref : setPref,
      defaultPref : setPref,
      lockPref : setPref,
      get PrefConfig() {
        return this;
      },
      get SecurityConfig() {
        return this;
      },
      config : function() {}
    };

    var contents = Util.readFile(prefsFile, { charset: 'Shift_JIS' });
    Util.evalInContext(contents, sandbox);

    return prefsObject;
  }
};

var MigrationManager = {
  get profiles() Nsreg.getProfiles(), // { path, name }
  get username() Util.getEnv("username", Util.getEnv("USER")),

  get ncProfiles() {
    var that = this;
    var profiles = Nsreg.getProfiles();
    return profiles.map(function (profile) {
      try {
        return new NcProfile(profile.name, Util.getFile(profile.path));
      } catch (x) {
        Util.log("ncProfiles: " + x);
        return null;
      }
    }).filter(function (ncProfile) ncProfile);
  },

  beginMigration: function () {
    let that = this;

    let targetDirectory = Util.getSpecialDirectory("ProfD");
    return Util.getDiskQuota(targetDirectory).next(function (diskSpaceInByte) {
      var requiredDiskSpace = Number(Prefs.get("extensions.nc4migrator.requiredDiskSpace", 10 * 1024 * 1024 * 1024));
      if (requiredDiskSpace && diskSpaceInByte < requiredDiskSpace) {
        Util.alert(
          Messages.getLocalized("availSpaceCheck.title", ""),
          Messages.getLocalized("availSpaceCheck.message_before", "") +
            Util.formatBytes(requiredDiskSpace).join(" ") +
            Messages.getLocalized("availSpaceCheck.message_after", "")
        );
      } else {
        that.beginWizard();
      }
    });
  },

  beginWizard: function (migrated) {
    let closeFeature = Prefs.get("extensions.nc4migrator.cancellable", false) ? "" : ",close=no" ;
    Util.openDialog(
      Util.getMainWindow(),
      "chrome://nc4migrator/content/migration-wizard.xul",
      "nc4migrator:migrationWizard",
      "chrome,titlebar,dialog,modal,resizable,centerscreen" + closeFeature,
      [migrated]
    );
  },

  getMigratorForNcProfile: function (ncProfile) {
    if (!(ncProfile instanceof NcProfile) ||
        !ncProfile.prefsObject)
      throw new Error("Invalid profile given. Cannot proceed migration.");

    return ncProfile.getMigrator();
  },

  migratePrefsFrom: function (ncProfile) {
    let migrator = this.getMigratorForNcProfile(ncProfile);
    migrator.upgradePrefs();
  },

  verityAccounts: function () {
    var accountUtils = {};
    Util.loadSubScriptInEnvironment(
      'chrome://messenger/content/accountUtils.js',
      accountUtils
    );
    accountUtils.verifyAccounts();
  }
};
