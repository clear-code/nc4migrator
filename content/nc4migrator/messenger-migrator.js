/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Alec Flett <alecf@netscape.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var EXPORTED_SYMBOLS = ["MessengerMigrator"];

const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

const { Util } = Cu.import("chrome://nc4migrator/content/util.js", {});
const { Preferences } = Cu.import("chrome://nc4migrator/content/Preferences.js", {});
const { Services } = Cu.import("chrome://nc4migrator/content/Services.js", {});
const { StringBundle } = Cu.import("chrome://nc4migrator/content/StringBundle.js", {});

const Prefs = new Preferences("");

function MessengerMigrator(prefObject, options) {
  options = options || {};
  // prefObject, profile
  this.setupN4Pref(prefObject);
  this.profile = options.profile || null;
  this.imapServersFilter = options.imapServersFilter || null;
}

MessengerMigrator.prototype = {
  "PREF_4X_MAIL_IDENTITY_USEREMAIL": "mail.identity.useremail",
  "PREF_4X_MAIL_IDENTITY_USERNAME": "mail.identity.username",
  "PREF_4X_MAIL_IDENTITY_REPLY_TO": "mail.identity.reply_to",
  "PREF_4X_MAIL_IDENTITY_ORGANIZATION": "mail.identity.organization",
  "PREF_4X_MAIL_SIGNATURE_FILE": "mail.signature_file",
  "PREF_4X_MAIL_SIGNATURE_DATE": "mail.signature_date",
  "PREF_4X_MAIL_COMPOSE_HTML": "mail.html_compose",
  "PREF_4X_MAIL_POP_NAME": "mail.pop_name",
  "PREF_4X_MAIL_REMEMBER_PASSWORD": "mail.remember_password",
  "PREF_4X_MAIL_POP_PASSWORD": "mail.pop_password",
  "PREF_4X_NETWORK_HOSTS_POP_SERVER": "network.hosts.pop_server",
  "PREF_4X_MAIL_CHECK_NEW_MAIL": "mail.check_new_mail",
  "PREF_4X_MAIL_POP3_GETS_NEW_MAIL": "mail.pop3_gets_new_mail",
  "PREF_4X_MAIL_CHECK_TIME": "mail.check_time",
  "PREF_4X_MAIL_LEAVE_ON_SERVER": "mail.leave_on_server",
  "PREF_4X_MAIL_DELETE_MAIL_LEFT_ON_SERVER": "mail.delete_mail_left_on_server",
  "PREF_4X_NETWORK_HOSTS_SMTP_SERVER": "network.hosts.smtp_server",
  "PREF_4X_MAIL_SMTP_NAME": "mail.smtp_name",
  "PREF_4X_MAIL_SMTP_SSL": "mail.smtp.ssl",
  "PREF_4X_MAIL_SERVER_TYPE": "mail.server_type",
  "PREF_4X_NETWORK_HOSTS_IMAP_SERVER": "network.hosts.imap_servers",
  "PREF_4X_MAIL_USE_IMAP_SENTMAIL": "mail.use_imap_sentmail",
  "PREF_4X_NEWS_USE_IMAP_SENTMAIL": "news.use_imap_sentmail",
  "PREF_4X_MAIL_IMAP_SENTMAIL_PATH": "mail.imap_sentmail_path",
  "PREF_4X_NEWS_IMAP_SENTMAIL_PATH": "news.imap_sentmail_path",
  "PREF_4X_MAIL_DEFAULT_CC": "mail.default_cc",
  "PREF_4X_NEWS_DEFAULT_CC": "news.default_cc",
  "PREF_4X_MAIL_DEFAULT_FCC": "mail.default_fcc",
  "PREF_4X_NEWS_DEFAULT_FCC": "news.default_fcc",
  "PREF_4X_MAIL_USE_DEFAULT_CC": "mail.use_default_cc",
  "PREF_4X_NEWS_USE_DEFAULT_CC": "news.use_default_cc",
  "PREF_4X_MAIL_DEFAULT_DRAFTS": "mail.default_drafts",
  "PREF_4X_MAIL_DEFAULT_TEMPLATES": "mail.default_templates",
  "PREF_4X_MAIL_CC_SELF": "mail.cc_self",
  "PREF_4X_NEWS_CC_SELF": "news.cc_self",
  "PREF_4X_MAIL_USE_FCC": "mail.use_fcc",
  "PREF_4X_NEWS_USE_FCC": "news.use_fcc",
  "PREF_4X_NEWS_MAX_ARTICLES": "news.max_articles",
  "PREF_4X_NEWS_NOTIFY_ON": "news.notify.on",
  "PREF_4X_NEWS_MARK_OLD_READ": "news.mark_old_read",
  "PREF_4X_MAIL_ATTACH_VCARD": "mail.attach_vcard",
  "PREF_4X_MAIL_IDENTITY_VCARD_ROOT": "mail.identity.vcard",

  "PREF_4X_AUTOCOMPLETE_ON_LOCAL_AB": "ldap_2.autoComplete.useAddressBooks",
  "PREF_MOZILLA_AUTOCOMPLETE_ON_LOCAL_AB": "mail.enable_autocomplete",

  "DEFAULT_FCC_FOLDER_PREF_NAME": "mail.identity.default.fcc_folder",
  "DEFAULT_DRAFT_FOLDER_PREF_NAME ": "mail.identity.default.draft_folder",
  "DEFAULT_STATIONERY_FOLDER_PREF_NAME": "mail.identity.default.stationery_folder",

  "DEFAULT_PAB_FILENAME_PREF_NAME": "ldap_2.servers.pab.filename",

  "NS_APP_MAIL_50_DIR": "MailD",
  "NS_APP_IMAP_MAIL_50_DIR": "IMapMD",
  "NS_APP_NEWS_50_DIR": "NewsD",

  "DEFAULT_4X_DRAFTS_FOLDER_NAME": "Drafts",
  "DEFAULT_4X_SENT_FOLDER_NAME": "Sent",
  "DEFAULT_4X_TEMPLATES_FOLDER_NAME": "Templates",
  "UNSENT_MESSAGES_FOLDER_NAME": "Unsent%20Messages",

  // // Reset 'm_oldMailType' in case the prefs file has changed. This is possible in quick launch
  // // mode where the profile to be migrated is IMAP type but the current working profile is POP.
  // nsresult rv = m_prefs->GetIntPref(PREF_4X_MAIL_SERVER_TYPE, &m_oldMailType);
  // if (NS_FAILED(rv))
  m_oldMailType: null,

  m_alreadySetNntpDefaultLocalPath: false,
  m_alreadySetImapDefaultLocalPath: false,

  // TODO: check definition
  HAVE_MOVEMAIL: false,
  MOZ_LDAP_XPCOM: true,

  "POP_4X_MAIL_TYPE": 0,
  "IMAP_4X_MAIL_TYPE": 1,
  "MOVEMAIL_4X_MAIL_TYPE": 2,

  PREF_MAIL_DIRECTORY: "mail.directory",
  PREF_NEWS_DIRECTORY: "news.directory",
    PREF_PREMIGRATION_MAIL_DIRECTORY: "premigration.mail.directory",
  PREF_PREMIGRATION_NEWS_DIRECTORY: "premigration.news.directory",
  PREF_IMAP_DIRECTORY: "mail.imap.root_dir",
  PREF_MAIL_DEFAULT_SENDLATER_URI: "mail.default_sendlater_uri",
  LOCAL_MAIL_FAKE_USER_NAME: "nobody",

  setupN4Pref: function (prefObject) {
    this.prefObject = prefObject;
  },

  hasN4Pref: function (prefName) {
    return this.prefObject.hasOwnProperty(prefName);
  },

  // Converters
  CONVERTER_FILE: function (path) {
    try {
      return Util.openFile(path);
    } catch (x) {
      return null;
    }
  },

  getN4Pref: function (prefName, defaultValue, converter) {
    var value;
    if (this.hasN4Pref(prefName))
      value = this.prefObject[prefName];
    else if (1 in arguments)
      value = defaultValue;
    else
      value = null;

    return value && (typeof converter === "function")
      ? converter(value) : value;
  },

  setN4Pref: function (prefName, value) {
    this.prefsObject[prefName] = value;
  },

  migratePref: function (prefName, object, propName, converter) {
    if (!this.hasN4Pref(prefName))
      return;

    try {
      var prefValue = this.getN4Pref(prefName, null, converter);
      Util.log("Set [%s] (%s) to %s %s",
               prefValue,
               prefName,
               Object.prototype.toString.call(object),
               propName);
      object[propName] = prefValue;
    } catch (x) {
      Util.log(x);
    }
  },

  // Entry Point
  upgradePrefs: function () {
    // Reset some control vars, necessary in turbo mode.
    this.resetState();

    Util.log("oldMailType :: " + this.m_oldMailType);

    // because mail.server_type defaults to 0 (pop) it will look the user
    // has something to migrate, even with an empty prefs.js file
    // ProceedWithMigration will check if there is something to migrate
    // if not, NS_FAILED(rv) will be true, and we'll return.
    // this plays nicely with msgMail3PaneWindow.js, which will launch the
    // Account Wizard if UpgradePrefs() fails.
    try {
      this.proceedWithMigration();
    } catch (x) {
      throw new Error("Nothing to migrate: " + x);
    }

    var identity = Services.accountManager.createIdentity();
    this.migrateIdentity(identity); // TODO: implement (partially implemented)

    var smtpServer = Services.smtpService.createSmtpServer();
    this.migrateSmtpServer(smtpServer);

    // set the newly created smtp server as the default
    // ignore the error code....continue even if this call fails...
    try {
      Services.smtpService.defaultServer = smtpServer;
    } catch (x) {
      Util.log("Failed to set " + smtpServer + " as default");
    }

    if (this.m_oldMailType === this.POP_4X_MAIL_TYPE) {
      Util.log("OOPS!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      throw new Error("Death to Pop!!!!");

      // in 4.x, you could only have one pop account
      this.migratePopAccount(identity); // TODO: implement

      // everyone gets a local mail account in 5.0
      this.createLocalMailAccount(true); // TODO: implement
    } else if (this.m_oldMailType === this.IMAP_4X_MAIL_TYPE) {
      this.migrateImapAccounts(identity); // TODO: implement (partially implemented)

      // if they had IMAP in 4.x, they also had "Local Mail"
      // we'll migrate that to "Local Folders"
      try {
        this.migrateLocalMailAccount(); // TODO: implement
      } catch (x) {
        Util.log("Failed to migrate local mail account " + x + "  " + x.stack);
      }
    } else if (this.HAVE_MOVEMAIL &&
               (this.m_oldMailType === this.MOVEMAIL_4X_MAIL_TYPE)) {
      Util.log("OOPS!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      throw new Error("WTF movemail is!!!!");
      // if 4.x, you could only have one movemail account
      this.migrateMovemailAccount(identity); // TODO: implement

      // everyone gets a local mail account in 5.0
      this.createLocalMailAccount(true); // TODO: implement
    } else {
      return new Error("NS_ERROR_UNEXPECTED: unexpected!");
    }

    // news account is low priority
    // TODO: implement
    // this.migrateNewsAccounts(identity);

    // if (this.MOZ_LDAP_XPCOM) {
    // this will upgrade the ldap prefs
    // Memo: explicitly
    //   var ldapPrefsService = Cc["@mozilla.org/ldapprefs-service;1"].getService();
    // }

    // this.migrateAddressBookPrefs();
    // this.migrateAddressBooks();

    // we're done migrating, let's save the prefs
    // Pref.savePrefFile(null);

    // remove the temporary identity we used for migration purposes
    identity.clearAllValues();
    // Services.accountManager.removeIdentity(identity);
  },

  resetState: function () {
    this.m_alreadySetNntpDefaultLocalPath = false;
    this.m_alreadySetImapDefaultLocalPath = false;

    // Reset 'm_oldMailType' in case the prefs file has changed. This is possible in quick launch
    // mode where the profile to be migrated is IMAP type but the current working profile is POP.
    this.m_oldMailType = this.getN4Pref(this.PREF_4X_MAIL_SERVER_TYPE, -1);
  },

  setUsernameIfNecessary: function () {
    if (this.getN4Pref(this.PREF_4X_MAIL_IDENTITY_USERNAME))
      return;

    var fullnameFromSystem = Services.userInfo.getFullName();
    if (!fullnameFromSystem)
      return;

    this.setN4Pref(this.PREF_4X_MAIL_IDENTITY_USERNAME, fullnameFromSystem);
  },

  migrateIdentity: function (identity) {
    this.setUsernameIfNecessary();

    this.migratePref(this.PREF_4X_MAIL_IDENTITY_USEREMAIL, identity, "email");
    this.migratePref(this.PREF_4X_MAIL_IDENTITY_USERNAME, identity, "fullName");
    this.migratePref(this.PREF_4X_MAIL_IDENTITY_REPLY_TO, identity, "replyTo");
    this.migratePref(this.PREF_4X_MAIL_IDENTITY_ORGANIZATION, identity, "organization");
    this.migratePref(this.PREF_4X_MAIL_COMPOSE_HTML, identity, "composeHtml");
    this.migratePref(this.PREF_4X_MAIL_SIGNATURE_FILE, identity, "signature", this.CONVERTER_FILE);
    this.migratePref(this.PREF_4X_MAIL_SIGNATURE_FILE, identity, "attachSignature", this.CONVERTER_FILE);
    this.migratePref(this.PREF_4X_MAIL_SIGNATURE_DATE, identity, "signatureDate");

    // Note: https://redmine.clear-code.com/issues/868
    //       No need to migrate Vcard
    // this.migratePref(this.PREF_4X_MAIL_ATTACH_VCARD, identity, "attachVCard");
    // identity.escapedVCardStr = this.escapedVCardStrFrom4XPref(this.PREF_4X_MAIL_IDENTITY_VCARD_ROOT);
  },

  migrateSmtpServer: function (server) {
    this.migratePref(this.PREF_4X_NETWORK_HOSTS_SMTP_SERVER, server, "hostname");
    this.migratePref(this.PREF_4X_MAIL_SMTP_NAME, server, "username");
    this.migratePref(this.PREF_4X_MAIL_SMTP_SSL, server, "trySSL");
  },

  migratePopAccount: function (server) {
    throw new Error("Implement this!");
  },

  migrateImapAccounts: function (identity) {
    let servers = this.getN4Pref(this.PREF_4X_NETWORK_HOSTS_IMAP_SERVER, "").split(",");

    if (typeof this.imapServersFilter === "function")
      servers = this.imapServersFilter(servers);

    Util.log("defaultImapServers => %s", servers);
    servers.forEach(function (server, idx) {
      let isDefaultAccount = idx === 0;
      this.migrateImapAccount(identity, server, isDefaultAccount);
    }, this);
  },

  migrateImapAccount: function (identity, hostAndPort, isDefaultAccount) {
    // get the old username
    var imapUsernamePref = "mail.imap.server." + hostAndPort + ".userName";
    var username = this.getN4Pref(imapUsernamePref, "");

    var imapIsSecurePref = "mail.imap.server." + hostAndPort + ".isSecure";
    var isSecure = this.getN4Pref(imapIsSecurePref, false);

    // get the old host (and possibly port)
    var [host, port] = hostAndPort.split(":");
    if (port)
      port = parseInt(port, 10); // TODO: handle exception
    else
      port = Services.imapProtocolInfo.getDefaultServerPort(isSecure);

    //
    // create the server
    //
    try {
      // createIncomingServer may fail is there is already a account with username and host
      var server = Services.accountManager.createIncomingServer(username, host, "imap");
    } catch (x) {
      return;
    }
    server.port = port;
    server.isSecure = isSecure;

    // Generate unique pretty name for the account. It is important that this function
    // is called here after all port settings are taken care of.
    // Port values, if not default, will be used as a part of pretty name.
    var prettyName = IncomingServerTools.generatePrettyNameForMigration(server);
    if (prettyName)
      server.prettyName = prettyName;

    // now upgrade all the prefs
    this.migrateOldImapPrefs(server, hostAndPort);

    // if they used -installer, this pref will point to where their files got copied
    // if the "mail.imap.root_dir" pref is set, use that.
    var imapMailDir = this.CONVERTER_FILE(Prefs.get(this.PREF_IMAP_DIRECTORY, null));

    if (!imapMailDir) {
      // we want <profile>/ImapMail
      imapMailDir = Util.getSpecialDirectory(this.NS_APP_IMAP_MAIL_50_DIR);
    }

    if (!imapMailDir.exists()) {
      imapMailDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
    }

    Util.log("OK, imapMailDir is :: " + imapMailDir.path);

    // we only need to do this once
    if (!this.m_alreadySetImapDefaultLocalPath) {
      // set the default local path for "imap"
      server.setDefaultLocalPath(imapMailDir);
      this.m_alreadySetImapDefaultLocalPath = true;
    }

    // we want .../ImapMail/<hostname>, not .../ImapMail
    imapMailDir.append(host);

    // set the local path for this "imap" server
    server.localPath = imapMailDir;

    if (!imapMailDir.exists()) {
      Util.log("imapMailDir (%s) doesn't exist", imapMailDir.path);
      imapMailDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
    }

    // create the identity
    var copiedIdentity = Services.accountManager.createIdentity(identity);

    // Create an account when valid server and identity values are established.
    // This will keep the status of accounts sane by avoiding the addition of incomplete accounts.
    var account = Services.accountManager.createAccount();

    // hook the server to the account
    // before setting the copies and folder prefs
    // (see bug #31904)
    // but after we set the server's local path
    // (see bug #66018)
    // XXX: どうも 以下の 2 ステートメントは copiedIdentity.copy(identity); の前にやる必要があるらしい
    account.incomingServer = server;
    account.addIdentity(copiedIdentity);

    // make this new identity a copy of the identity
    // that we created out of the 4.x prefs
    copiedIdentity.copy(identity);

    this.setMailCopiesAndFolders(copiedIdentity, username, host);

    if (isDefaultAccount)
      Services.accountManager.defaultAccount = account;

    // Set check for new mail option for default account to TRUE
    server.loginAtStartUp = true;
  },

  get mLocalFoldersName() StringBundle.messenger.GetStringFromName("localFolders"),
  mLocalFoldersHostname: "Local Folders",

  get n4ProfileDirectory() {
    if (!this.profile)
      return null;
    Util.log("Profile Path :: " + this.profile.path);
    return Util.openFile(this.profile.path);
  },

  N4_DEFAULT_MAIL_DIRECTORY_NAME: "Mail",
  get n4MailDirectory() {
    var oldMailDirPath = this.getN4Pref(this.PREF_MAIL_DIRECTORY, null);
    if (oldMailDirPath)
      return oldMailDirPath;

    var profileDirectory = this.n4ProfileDirectory;
    Util.log("profile Directory => " + profileDirectory);
    if (profileDirectory) {
      profileDirectory.append(this.N4_DEFAULT_MAIL_DIRECTORY_NAME);
      Util.log("Mail Directory => " + profileDirectory.path);
      return profileDirectory;
    }

    return null;
  },

  getLocalFolderServer: function () {
    if (Services.accountManager.localFoldersServer)
      return Services.accountManager.localFoldersServer;

    var localFoldersServer = Services.accountManager.createIncomingServer(
      this.LOCAL_MAIL_FAKE_USER_NAME,
      this.mLocalFoldersHostname,
      "none"
    );

    var mailDir = Util.getSpecialDirectory(this.NS_APP_MAIL_50_DIR);
    if (!mailDir.exists())
      mailDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0775); // Mail

    mailDir.append(this.mLocalFoldersHostname);        // Mail/Local Folders
    if (!mailDir.exists())
      mailDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0775);

    // set localpath
    localFoldersServer.localPath = mailDir;
    // set the default local path for "none"
    localFoldersServer.setDefaultLocalPath(mailDir); // XXX: needed?

    // we don't want "nobody at Local Folders" to show up in the
    // folder pane, so we set the pretty name to "Local Folders"
    localFoldersServer.prettyName = this.mLocalFoldersName;

    // pass the "Local Folders" server so the send later uri pref
    // will be "mailbox://nobody@Local Folders/Unsent Messages"
    // this.setSendLaterUriPref(localFoldersServer); // TODO: implement

    // Create an account when valid server values are established.
    // This will keep the status of accounts sane by avoiding the addition of incomplete accounts.
    var localFolderAccount = Services.accountManager.createAccount();

    // notice, no identity for local mail
    // hook the server to the account
    // after we set the server's local path
    // (see bug #66018)
    localFolderAccount.incomingServer = localFoldersServer;

    // remember this as the local folders server
    Services.accountManager.localFoldersServer = localFoldersServer;

    return localFoldersServer;
  },

  migrateLocalMailAccount: function () {
    // create the server
    // "none" is the type we use for migrating 4.x "Local Mail"
    var localFoldersServer = this.getLocalFolderServer();

    // now upgrade all the prefs
    // some of this ought to be moved out into the NONE implementation
    localFoldersServer.QueryInterface(Ci.nsINoIncomingServer);

    // if the "mail.directory" pref is set, use that.
    // if they used -installer, this pref will point to where their files got copied

    var oldMailDir = this.n4MailDirectory;

    var mailDir = localFoldersServer.localPath;

    Util.log("Now, migrate %s => %s",
             oldMailDir && oldMailDir.path, mailDir && mailDir.path);

    if (oldMailDir) {
      // now copy mails in old local folders
      mailDir.launch();
      // we need to set this to <profile>/Mail/Local Folders, because that's where
      // the 4.x "Local Mail" (when using imap) got copied.
      // it would be great to use the server key, but we don't know it
      // when we are copying of the mail.
      let name = Services.accountManager.defaultAccount.incomingServer.username;
      let localFolderFile = mailDir.clone();
      localFolderFile.append(name);
      if (!localFolderFile.exists())
        localFolderFile.create(0, 0644);
      LocalFolderMigrator.migrateTo(oldMailDir, mailDir, name + ".sbd");
    }

    // TODO: Implement this!
    // localFoldersServer.CopyDefaultMessages("Templates", mailDir);

    return ;
  },

  setSendLaterUriPref: function (server) {
    Util.log("TODO: Implement this");
  },

  migrateOldImapPrefs: function (server, hostAndPort) {
    var imapServer = server.QueryInterface(Ci.nsIImapIncomingServer);

    // upgrade the msg incoming server prefs
    // don't migrate the remember password pref.  see bug #42216
    //MIGRATE_BOOL_PREF("mail.imap.server.%s.remember_password",hostAndPort,server,SetRememberPassword)
    // server.rememberPassword = false;
    server.password = null;

    // "mail.imap.new_mail_get_headers" was a global pref across all imap servers in 4.x
    // in 5.0, it's per server
    this.migratePref("mail.imap.new_mail_get_headers",server,"downloadOnBiff");
    // upgrade the imap incoming server specific prefs
    this.migratePref("mail.imap.server."+hostAndPort+".check_new_mail",server,"doBiff");
    this.migratePref("mail.imap.server."+hostAndPort+".check_time",server,"biffMinutes");
    this.migratePref("mail.imap.server."+hostAndPort+".admin_url",imapServer,"adminUrl");
    this.migratePref("mail.imap.server."+hostAndPort+".server_sub_directory",imapServer,"serverDirectory");
    this.migratePref("mail.imap.server."+hostAndPort+".capability",imapServer,"capabilityPref");
    this.migratePref("mail.imap.server."+hostAndPort+".cleanup_inbox_on_exit",imapServer,"cleanupInboxOnExit");
    this.migratePref("mail.imap.server."+hostAndPort+".delete_model",imapServer,"deleteModel");
    this.migratePref("mail.imap.server."+hostAndPort+".dual_use_folders",imapServer,"dualUseFolders");
    this.migratePref("mail.imap.server."+hostAndPort+".empty_trash_on_exit",server,"emptyTrashOnExit");
    this.migratePref("mail.imap.server."+hostAndPort+".empty_trash_threshhold",imapServer,"emptyTrashThreshhold");
    this.migratePref("mail.imap.server."+hostAndPort+".namespace.other_users",imapServer,"otherUsersNamespace");
    this.migratePref("mail.imap.server."+hostAndPort+".namespace.personal",imapServer,"personalNamespace");
    this.migratePref("mail.imap.server."+hostAndPort+".namespace.public",imapServer,"publicNamespace");
    this.migratePref("mail.imap.server."+hostAndPort+".offline_download",imapServer,"offlineDownload");
    this.migratePref("mail.imap.server."+hostAndPort+".override_namespaces",imapServer,"overrideNamespaces");
    this.migratePref("mail.imap.server."+hostAndPort+".using_subscription",imapServer,"usingSubscription");
  },

  setMailCopiesAndFolders: function (identity, username, host) {
    return;                     // TODO: No need for this migration?

    // TODO: implement this
    this.migratePref(this.PREF_4X_MAIL_CC_SELF,identity,"bccSelf");
    this.migratePref(this.PREF_4X_MAIL_USE_DEFAULT_CC,identity,"bccOthers");
    this.migratePref(this.PREF_4X_MAIL_DEFAULT_CC,identity,"bccList");
    this.migratePref(this.PREF_4X_MAIL_USE_FCC,identity,"doFcc");
    this.migratePref(this.PREF_4X_MAIL_DEFAULT_DRAFTS,identity,"draftFolder");
    this.migratePref(this.PREF_4X_MAIL_DEFAULT_TEMPLATES,identity,"stationeryFolder");

    var imapUsedURIForSentIn4X = Prefs.get(this.PREF_4X_MAIL_USE_IMAP_SENTMAIL, false);

    if (!imapUsedURIForSentIn4X) {
      this.migratePref(this.PREF_4X_MAIL_DEFAULT_FCC,identity,"fccFolder");
    } else {
      this.migratePref(this.PREF_4X_MAIL_IMAP_SENTMAIL_PATH,identity,"fccFolder");
    }

    // CONVERT_4X_URI(identity, PR_FALSE /* for news */, username, hostname, DEFAULT_4X_SENT_FOLDER_NAME,GetFccFolder,SetFccFolder,DEFAULT_FCC_FOLDER_PREF_NAME)
    // CONVERT_4X_URI(identity, PR_FALSE /* for news */, username, hostname, DEFAULT_4X_TEMPLATES_FOLDER_NAME,GetStationeryFolder,SetStationeryFolder,DEFAULT_STATIONERY_FOLDER_PREF_NAME)
    // CONVERT_4X_URI(identity, PR_FALSE /* for news */, username, hostname, DEFAULT_4X_DRAFTS_FOLDER_NAME,GetDraftFolder,SetDraftFolder,DEFAULT_DRAFT_FOLDER_PREF_NAME)
  },

  // Migrate する必要のあるものが存在するかをチェック。存在しなければ
  // 例外。
  proceedWithMigration: function () {
    if ((this.m_oldMailType == this.POP_4X_MAIL_TYPE)
      || (this.HAVE_MOVEMAIL && (this.m_oldMailType == this.MOVEMAIL_4X_MAIL_TYPE))) {
      // if they were using pop or movemail, "mail.pop_name" must have been set
      // otherwise, they don't really have anything to migrate
      if (!this.getN4Pref(this.PREF_4X_MAIL_POP_NAME, false))
        throw new Error("NS_ERROR_FAILURE");
    } else if (this.m_oldMailType == this.IMAP_4X_MAIL_TYPE) {
      // if they were using imap, "network.hosts.imap_servers" must have been set
      // otherwise, they don't really have anything to migrate
      if (!this.getN4Pref(this.PREF_4X_NETWORK_HOSTS_IMAP_SERVER, false))
        throw new Error("PREF_4X_NETWORK_HOSTS_IMAP_SERVER");
    } else {
      throw new Error("NS_ERROR_UNEXPECTED");
    }
  }
};

var IncomingServerTools = {
  IMAP_DEFAULT_ACCOUNT_NAME: 5057, // TODO fetch from actual interface

  generatePrettyNameForMigration: function (server) {
    /**
     * Pretty name for migrated account is of format username@hostname:<port>,
     * provided the port is valid and not the default
     */
    var userName = server.username;
    var hostName = server.hostName;

    // Get the default port
    var defaultServerPort = Services.imapProtocolInfo.getDefaultServerPort(false);
    // Get the default secure port
    var defaultSecureServerPort = Services.imapProtocolInfo.getDefaultServerPort(true);

    // Get the current server port
    var serverPort = server.port;

    // Is the server secure ?
    var socketType = socketType;
    var isSecure = socketType === Ci.nsIMsgIncomingServer.useSSL;

    // Is server port a default port ?
    var isItDefaultPort = ((serverPort == defaultServerPort) && !isSecure) ||
      ((serverPort == defaultSecureServerPort) && isSecure);

    // Construct pretty name from username and hostname
    var constructedPrettyName = userName + "@" + hostName;

    // If the port is valid and not default, add port value to the pretty name
    if ((serverPort > 0) && (!isItDefaultPort))
      constructedPrettyName = constructedPrettyName + ":" + serverPort;

    // Format the pretty name
    return this.getFormattedStringFromID(
      constructedPrettyName,
      this.IMAP_DEFAULT_ACCOUNT_NAME // chrome://messenger/locale/imapMsgs.properties
    );
  },

  getFormattedStringFromID: function (constructedPrettyName, id) {
    return StringBundle.imapMsgs.formatStringFromID(id, [constructedPrettyName], 1);
  }
};

var LocalFolderMigrator = {
  // http://mxr.mozilla.org/comm-central/source/mailnews/import/comm4x/src/nsComm4xMail.cpp#70

  shouldIgnoreFile: function (file) {
    var path = file.path.toLowerCase();

    return /\.snm$/.test(path) ||
      /\.toc$/.test(path)      ||
      /\.sbd$/.test(path)      ||
      path === "sort.dat"      ||
      path === "popstate.dat"  ||
      path === "sort.dat"      ||
      path === "mailfilt.log"  ||
      path === "filters.js";
  },

  cleanDirectory: function (directory) {
    for (let [, file] in Iterator(Util.readDirectory())) {
      if (file.isDirectory()) {
        LocalFolderMigrator.cleanDirectory(file);
      } else if (LocalFolderMigrator.shouldIgnoreFile(file)) {
        file.remove();
      }
    }
  },

  migrateTo: function (source, dest, newName) {
    var sourceDir = Util.getFile(source);
    var destDir = Util.getFile(dest);

    var destFile = destDir.clone();
    destFile.append(newName);
    if (destFile.exists()) {
      Util.log("%s exists. Remove it!", destFile.path);
      destFile.remove(true);
    }

    Util.log("sourceDir => " + sourceDir.path);
    Util.log("destDir => " + destDir.path);

    sourceDir.copyTo(destDir, newName);
    this.cleanDirectory(destFile);
  }
};

var AddressBook = {
  VCBeginPhrase: "begin",
  VCEndProp: "end",

  addProperty: function (currentVCard, currentRoot, mask) {
    // keep in mind as we add properties that we want to filter out any begin and end vcard types....because
    // we add those automatically...

    if (currentVCard && Services.prefBranch) {
      var children = Services.prefBranch.getChildList(currentRoot, {});
      for (var i = 0, len = children.length; i < len; ++i) {
        var child = children[i];

        if (child !== currentRoot)
          continue;

        // first iterate over the child in case the child has children
        currentVCard = AddressBook.addProperty(currentVCard, child, mask);

        // child length should be greater than the mask....
        if (child.length > mask.length + 1) { // + 1 for the '.' in .property
          var value = Services.prefBranch.getCharPref(child);

          if (mask)
            child = child.slice(mask.length + 1);  // eat up the "mail.identity.vcard" part...

          // turn all '.' into ';' which is what vcard format uses
          child = child.replace(/\./g, ';');

          // filter property to make sure it is one we want to add.....
          if ((child.toLowerCase().indexOf(this.VCBeginPhrase) !== 0)
            && (child.toLowerCase().indexOf(this.VCEndProp) !== 0)) {
            if (value) {
              // only add the value is not an empty string...
              if (currentVCard) {
                // PR_smprintf("%s%s:%s%s", tempString, child, value.get(), "\n");
                currentVCard = currentVCard + child + ":" + value + "\n";
              } else {
                currentVCard = child + ":" + value + "\n";
              }
            }
          }
        } else {
          throw new Error("child length should be greater than the mask");
        }
      }
    }

    return currentVCard;
  },

  // TODO: implement this method
  convert4xVcardPrefs: function (prefRoot) {
    var vCardString = this.addProperty("begin:vcard \n", prefRoot, prefRoot);

    var vcard = vCardString + "end:vcard\n";

    //
    // VObject *vObj = parse_MIME(vcard, strlen(vcard));
    // PR_FREEIF(vcard);
    //
    // nsCOMPtr<nsIAbCard> cardFromVCard = do_CreateInstance(NS_ABCARDPROPERTY_CONTRACTID);
    // convertFromVObject(vObj, cardFromVCard);
    //
    // if (vObj)
    //     cleanVObject(vObj);
    //
    // rv = cardFromVCard->ConvertToEscapedVCard(escapedVCardStr);
    // NS_ENSURE_SUCCESS(rv,rv);
    // return rv;
  }
};
