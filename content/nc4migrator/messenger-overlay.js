var Nc4Migrator = (function () {
  var exports = {};

  const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

  const { MigrationManager } = Cu.import('resource://nc4migrator-modules/MigrationManager.js', {});
  const { Util } = Cu.import('resource://nc4migrator-modules/Util.js', {});
  const { Services } = Cu.import('resource://nc4migrator-modules/Services.js', {});

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

  window.addEventListener("load", function onLoad() {
    window.removeEventListener("load", onLoad, false);

    if (!MigrationManager.mainWindowOpened) {
      MigrationManager.mainWindowOpened = true;

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

      if (!concreteAccounts.length) {
        exports.beginMigration().error(function (x) {
          Util.log(x);
        });
      }
    }
  }, false);

  return exports;
})();
