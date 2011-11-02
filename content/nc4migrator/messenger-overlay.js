var Nc4Migrator = (function () {
  var exports = {};

  const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

  const { MigrationManager } = Cu.import('resource://nc4migrator-modules/MigrationManager.js', {});
  const { Util } = Cu.import('resource://nc4migrator-modules/Util.js', {});
  const { Services } = Cu.import('resource://nc4migrator-modules/Services.js', {});

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

  exports.beginMigration = function () {
    return MigrationManager.beginMigration();
  };

  exports.deleteAllAccounts = function () {
    var accountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService()
          .QueryInterface(Ci.nsIMsgAccountManager);

    while (accountManager.accounts.Count() > 0) {
      let account = accountManager.accounts.QueryElementAt(0, Ci.nsISupports);
      accountManager.removeAccount(account);
    }
  };

  exports.getConcreteAccounts = function() {
    // http://mxr.mozilla.org/comm-central/source/mailnews/base/public/nsIMsgIncomingServer.idl#105
    const concreteAccountTypes = {
      "pop3": true,
      "imap": true,
      "nntp": true
    };

    let concreteAccounts = Util.toArray(
      Services.accountManager.accounts, Ci.nsIMsgAccount
    ).filter(
      function (account) account.incomingServer
        && concreteAccountTypes.hasOwnProperty(account.incomingServer.type)
    );
    return concreteAccounts;
  };

  window.addEventListener("DOMContentLoaded", function onLoad() {
    window.removeEventListener("DOMContentLoaded", onLoad, false);

    document.getElementById("nc4migrator-migration-wizard")
      .setAttribute("label", Messages.getLocalized("menu", ""));

    if (window.AutoConfigWizard) {
      let originalAutoConfigWizard = window.AutoConfigWizard;
      window.AutoConfigWizard = function(okCallback) {
        exports.beginMigration().error(function (x) {
          Util.log(x);
        }).next(function() {
          if (exports.getConcreteAccounts().length) {
            okCallback();
          } else if (Prefs.get("extensions.nc4migrator.fallbackToDefaultStartup", true)) {
            originalAutoConfigWizard(okCallback);
          }
        });
      };
      return;
    }

    if (!MigrationManager.mainWindowOpened) {
      MigrationManager.mainWindowOpened = true;
      if (!exports.getConcreteAccounts().length) {
        exports.beginMigration().error(function (x) {
          Util.log(x);
        });
      }
    }
  }, false);

  return exports;
})();
