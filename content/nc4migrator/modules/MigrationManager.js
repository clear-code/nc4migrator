var EXPORTED_SYMBOLS = "Migrator";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const { Util } = Cu.import('chrome://nc4migrator/content/modules/Util.js', {});
const { Nsreg } = Cu.import("chrome://nc4migrator/content/modules/nsreg.js", {});
const { MessengerMigrator } = Cu.import('chrome://nc4migrator/content/modules/MessengerMigrator.js', {});
const { Preferences } = Cu.import("chrome://nc4migrator/content/modules/Preferences.js", {});
const Prefs = new Preferences("");

function NcProfile(profileDirectory) {
  this.profileDirectory = profileDirectory;
  this.prefsObject = this.getPrefsObject();
}

NcProfile.prototype = {
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
  get profiles() Nsreg.getProfiles(),
  get username() Util.getEnv("username", Util.getEnv("USER")),

  get ncProfiles() {
    var profiles = Nsreg.getProfiles();
    return profiles.map(function (profile) new NcProfile(profile));
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
  },

  getMailAddressForPrefsObject: function (prefsObject) {
    return prefsObject["mail.identity.useremail"] || null;
  }
};
