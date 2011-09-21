var Nc4Migrator = (function () {
  var exports = {};

  const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

  const { MigrationManager } = Cu.import('chrome://nc4migrator/content/modules/MigrationManager.js', {});

  exports.beginMigration = function () {
    MigrationManager.beginMigration();
  };

  exports.deleteAllAccounts = function () {
    var accountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService()
          .QueryInterface(Ci.nsIMsgAccountManager);

    while (accountManager.accounts.Count() > 0) {
      let account = accountManager.accounts.QueryElementAt(0, Ci.nsISupports);
      accountManager.removeAccount(account);
    }
  };

  return exports;
})();
