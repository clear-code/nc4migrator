const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');

const ObserverService = Cc['@mozilla.org/observer-service;1']
        .getService(Ci.nsIObserverService);

if (XPCOMUtils.generateNSGetFactory)
  var STARTUP_TOPIC = 'profile-after-change'; // for gecko 2.0
else
  var STARTUP_TOPIC = 'app-startup';

const kCID  = Components.ID('{1db5ecc0-8615-11dd-ad8b-0800200c9a66}');
const kID   = '@clear-code.com/nc4migrator/startup;1';
const kNAME = 'Netscape Communicator 4 Migration Startup Service';

let Util, MessengerMigrator, Services, MigrationManager;

function StartupService() {
}

StartupService.prototype = {
  observe: function (aSubject, aTopic, aData) {
    switch (aTopic)
    {
    case 'app-startup':
      this.listening = true;
      ObserverService.addObserver(this, 'profile-after-change', false);
      break;
    case 'profile-after-change':
      if (this.listening) {
        ObserverService.removeObserver(this, 'profile-after-change');
        this.listening = false;
      }

      ({ Util }) = Cu.import('resource://nc4migrator-modules/Util.js', {});
      ({ MessengerMigrator }) = Cu.import('resource://nc4migrator-modules/MessengerMigrator.js', {});
      ({ Services }) = Cu.import('resource://nc4migrator-modules/Services.js', {});
      ({ MigrationManager }) = Cu.import('resource://nc4migrator-modules/MigrationManager.js', {});

      // this.enterMigrationProcess();
    }
  },

  enterMigrationProcess: function () {
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

    if (concreteAccounts.length === 0)
      MigrationManager.beginMigration();
  },

  classID           : kCID,
  contractID        : kID,
  classDescription  : kNAME,
  QueryInterface    : XPCOMUtils.generateQI([Ci.nsIObserver]),
  _xpcom_categories : [
    { category : STARTUP_TOPIC, service : true }
  ]
};

if (XPCOMUtils.generateNSGetFactory)
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([StartupService]);
else
  var NSGetModule = XPCOMUtils.generateNSGetModule([StartupService]);
