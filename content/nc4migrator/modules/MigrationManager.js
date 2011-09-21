var EXPORTED_SYMBOLS = ["MigrationManager"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const Nsreg = Cu.import("chrome://nc4migrator/content/modules/nsreg.js", {});

const { Util } = Cu.import('chrome://nc4migrator/content/modules/Util.js', {});
const { MessengerMigrator } = Cu.import('chrome://nc4migrator/content/modules/MessengerMigrator.js', {});
const { Preferences } = Cu.import("chrome://nc4migrator/content/modules/Preferences.js", {});
const Prefs = new Preferences("");

function NcProfile(name, profileDirectory) {
  this.name = name;
  this.profileDirectory = profileDirectory;
  this.prefsObject = this.getPrefsObject();
}

NcProfile.prototype = {
  get mailAddress() {
    return this.prefsObject["mail.identity.useremail"] || null;
  },

  isImported: function () {
    return false;
  },

  getMailFolderQuota: function () {
    return 1024;
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

  // this preference value limits target imap servers which will be migrated
  get defaultImapServers() (Prefs.get('extensions.nc4migrator.defaultImapServers') || "").split(","),

  beginMigration: function () {
    this.beginWizard();
  },

  beginWizard: function () {
    window.openDialog(
      "chrome://nc4migrator/content/migration-wizard.xul",
      "nc4migrator:migrationWizard",
      "chrome=yes,titlebar=yes,dialog=yes,modal=yes,resizable=yes"
    );
  },

  migratePrefsFrom: function (ncProfile) {
    if (!(ncProfile instanceof NcProfile) ||
        !ncProfile.prefsObject)
      throw new Error("Invalid profile given. Cannot proceed migration.");

    let defaultImapServers = this.defaultImapServers;

    var migrator = new MessengerMigrator(ncProfile.prefsObject, {
      profile: NcProfile.profile,
      imapServersFilter: function (servers) {
        return servers.filter(function (server) defaultImapServers.indexOf(server) >= 0);
      }
    });

    migrator.upgradePrefs();

    var accountUtils = {};
    Util.loadSubScriptInEnvironment('chrome://messenger/content/accountUtils.js', accountUtils);
    accountUtils.verifyAccounts();
  }
};
