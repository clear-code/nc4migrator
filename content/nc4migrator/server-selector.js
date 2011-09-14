var EXPORTED_SYMBOLS = ["ServerSelector"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

Cu.import("chrome://nc4migrator/content/modules/Util.js");

function ServerSelector(incomingServerSettings,
                        smtpServerSettings) {
  this.incomingServerSettings = incomingServerSettings;
  this.smtpServerSettings = smtpServerSettings;
}

ServerSelector.prototype = {
  incomingServers: null,
  smtpServers: null,

  get accountManager() {
    if (!this._accountManager) {
      this._accountManager = Cc["@mozilla.org/messenger/account-manager;1"]
        .getService(Ci.nsIMsgAccountManager);
    }
    return this._accountManager;
  },

  get smtpService() {
    if (!this._smtpService) {
      this._smtpService = Cc["@mozilla.org/messengercompose/smtp;1"]
        .getService(Ci.nsISmtpService);
    }
    return this._smtpService;
  },

  get accounts() {
    let accountList = [];
    let accounts = this.accountManager.accounts;
    for (let i = 0; i < accounts.Count(); i++)
      accountList.push(accounts.QueryElementAt(i, Ci.nsIMsgAccount));
    return accountList;
  },

  get targetAccount() {
    return this.accounts[this.accounts.length - 1];
  },

  get targetIncomingServer() {
    return this.targetAccount.incomingServer;
  },

  get targetSmtpServer() {
    let targetIdentity = this.targetAccount.defaultIdentity;

    if (targetIdentity) {
      let out = {};
      this.smtpService.GetSmtpServerByIdentity(targetIdentity, out);
      return out.value;
    } else {
      return null;
    }
  },

  loadServers: function (serverDatabase) {
    this.incomingServers = serverDatabase.incomingServers;
    this.smtpServers = serverDatabase.smtpServers;
  },

  applySettings: function () {
    if (this.targetIncomingServer)
      this.applyIncomingServerSettings(this.incomingServerSettings, this.targetIncomingServer);

    if (this.targetSmtpServer)
      this.applySmtpServerSettings(this.smtpServerSettings, this.targetSmtpServer);
  },

  applyIncomingServerSettings: function (settings, incomingServer /* nsIMsgIncomingServer */) {
    Util.log("============================================================");
    Util.log("applyIncomingServerSettings");
    for (let [name, value] in Iterator(settings)) {
      Util.log(name + ": " + incomingServer[name] + " => " + value);
      try {
        incomingServer[name] = value;
      } catch (x) {
        Util.log(x);
      }
    }
  },

  applySmtpServerSettings: function (settings, smtpServer /* nsISmtpServer */) {
    Util.log("============================================================");
    Util.log("applySmtpServerSettings");
    for (let [name, value] in Iterator(settings)) {
      Util.log(name + ": " + smtpServer[name] + " => " + value);
      try {
        smtpServer[name] = value;
      } catch (x) {
        Util.log(x);
      }
    }
  }
};
