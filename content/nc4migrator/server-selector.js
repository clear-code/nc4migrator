var EXPORTED_SYMBOLS = ["ServerSelector"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

Cu.import("chrome://nc4migrator/content/util.js");

function ServerSelector(file, environments) {
  this.loadServers(file);
  this.initEnvironments(environments);
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

  get accounts() {
    let accountList = [];
    let accounts = this.accountManager.accounts;
    for (let i = 0; i < accounts.Count(); i++)
      accountList.push(accounts.QueryElementAt(i, Ci.nsIMsgAccount));
    return accountList;
  },

  get targetIncomingServer() {
    return this.targetAccount.incomingServer;
  },

  get targetSmtpServer() {
    // TODO: Is this OK?
    return this.targetAccount.identities.ElementAt(0);
  },

  loadServers: function (file) {
    var database = Util.readJSON(file);
    this.incomingServers = database.incomingServers;
    this.smtpServers = database.smtpServers;
  },

  initEnvironments: function (environments) {
    this.environments = environments;
  },

  applySettings: function () {
    let incomingServerSettings = this.getAppropriateIncomingServerSettings();
    this.applyIncomingServerSettings({
      hostname: incomingServerSettings.hostname
    }, this.targetIncomingServer);

    let smtpServerSettings = this.getAppropriateStmpServerSettings();
    this.applySmtpServerSettings({
      hostname: smtpServerSettings.hostname,
      description: smtpServerSettings.description
    }, this.targetSmtpServer);
  },

  getAppropriateIncomingServerSettings: function () {
    let appropriateIncomingServerName = this.environments["incomingServerName"];
    for (let i = 0, len = this.incomingServers.length; i < len; ++i) {
      let server = this.incomingServers[i];
      if (server.name === appropriateIncomingServerName)
        return server;
    }
    return null;
  },

  getAppropriateSmtpServerSettings: function () {
    let appropriateSmtpServerName = this.environments["smtpServerName"];
    for (let i = 0, len = this.smtpServers.length; i < len; ++i) {
      let smtpServer = this.smtpServers[i];
      if (smtpServer.name === appropriateSmtpServerName)
        return smtpServer;
    }
    return null;
  },

  applyIncomingServerSettings: function (settings, incomingServer /* nsIMsgIncomingServer */) {
    for (let [name, value] in Iterator(settings))
      incomingServer[name] = value;
  },

  applySmtpServerSettings: function (settings, smtpServer /* nsISmtpServer */) {
    for (let [name, value] in Iterator(settings))
      smtpServer[name] = value;
  }
};
