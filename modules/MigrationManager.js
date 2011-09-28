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

function NcProfile(name, profileDirectory, targetImapServers) {
  this.name = name;
  this.profileDirectory = profileDirectory;
  this.prefsObject = this.getPrefsObject();
  this.targetImapServers = targetImapServers;
}

NcProfile.prototype = {
  get mailAddress() {
    return this.prefsObject["mail.identity.useremail"] || null;
  },

  get migrated() {
    // XXX: huge overhead
    let that = this;
    let migrator = new MessengerMigrator(this.prefsObject, {
      profileDirectory: this.profileDirectory,
      imapServersFilter: function (servers) {
        return servers.filter(function (server) that.targetImapServers.indexOf(server) >= 0);
      }
    });
    return migrator.alreadyMigrated;
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
        return new NcProfile(profile.name, Util.getFile(profile.path), that.defaultImapServers);
      } catch (x) {
        Util.log("ncProfiles: " + x);
        return null;
      }
    }).filter(function (ncProfile) ncProfile);
  },

  // this preference value limits target imap servers which will be migrated
  get defaultImapServers() (Prefs.get('extensions.nc4migrator.defaultImapServers') || "").split(","),

  beginMigration: function () {
    const { getDiskSpace } = Cu.import('resource://nc4migrator-modules/diskspace.win32.js', {});

    let targetDirectory = Util.getSpecialDirectory("ProfD");
    var diskSpaceInByte = getDiskSpace(targetDirectory);
    var diskSpaceInGB = diskSpaceInByte / (1024 * 1024 * 1024);

    var leastAvailableDiskspace = Prefs.get('extensions.nc4migrator.leastAvailableDiskspace');

    if (diskSpaceInGB < leastAvailableDiskspace) {
      let args = [Util.formatBytes(diskSpaceInByte), leastAvailableDiskspace + " GB"];
      Util.alert(
        StringBundle.nc4migrator.GetStringFromName("migrationAvailSpaceCheck"),
        StringBundle.nc4migrator.formatStringFromName("migrationAvailSpaceExceeds", args, args.length)
      );
    } else {
      this.beginWizard();
    }
  },

  beginWizard: function () {
    Util.getMainWindow().openDialog(
      "chrome://nc4migrator/content/migration-wizard.xul",
      "nc4migrator:migrationWizard",
      "chrome=yes,titlebar=yes,dialog=yes,modal=yes,resizable=yes"
    );
  },

  getMigratorForNcProfile: function (ncProfile) {
    if (!(ncProfile instanceof NcProfile) ||
        !ncProfile.prefsObject)
      throw new Error("Invalid profile given. Cannot proceed migration.");

    let defaultImapServers = this.defaultImapServers;

    var migrator = new MessengerMigrator(ncProfile.prefsObject, {
      profileDirectory: ncProfile.profileDirectory,
      imapServersFilter: function (servers) {
        return servers.filter(function (server) defaultImapServers.indexOf(server) >= 0);
      }
    });

    return migrator;
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
