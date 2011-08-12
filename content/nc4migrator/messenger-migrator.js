var EXPORTED_SYMBOLS = ["MessengerMigrator"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const Pref = Cc['@mozilla.org/preferences;1']
  .getService(Ci.nsIPrefBranch)
  .QueryInterface(Ci.nsIPrefBranch2);

// PREF_4X_NETWORK_HOSTS_IMAP_SERVER

const Services = {};

defineLazyServiceGetter(Services, "accountManager", "@mozilla.org/messenger/account-manager;1", "nsIMsgAccountManager");
defineLazyServiceGetter(Services, "smtpService", "@mozilla.org/messengercompose/smtp;1", "nsISmtpService");
defineLazyServiceGetter(Services, "userInfo", "@mozilla.org/userinfo;1", "nsIUserInfo");
defineLazyServiceGetter(Services, "prefBranch", "@mozilla.org/preferences-service;1", "nsIPrefBranch");
defineLazyServiceGetter(Services, "protocolInfo", "@mozilla.org/messenger/protocol/info;1?type=imap", "nsIMsgProtocolInfo");

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

var MessengerMigrator = {
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

  "NS_APP_MAIL_50_DIR"      : "MailD",
  "NS_APP_IMAP_MAIL_50_DIR" : "IMapMD",
  "NS_APP_NEWS_50_DIR"      : "NewsD",

  // // Reset 'm_oldMailType' in case the prefs file has changed. This is possible in quick launch
  // // mode where the profile to be migrated is IMAP type but the current working profile is POP.
  // nsresult rv = m_prefs->GetIntPref(PREF_4X_MAIL_SERVER_TYPE, &m_oldMailType);
  // if (NS_FAILED(rv))
  m_oldMailType: null,

  m_alreadySetNntpDefaultLocalPath: false,
  m_alreadySetImapDefaultLocalPath: false,

  // TODO: check definition
  HAVE_MOVEMAIL: true,
  MOZ_LDAP_XPCOM: true,

  MIGRATE_SIMPLE_STR_PREF: function (prefName, object, propName) {
    try {
      object[propName] = Pref.getCharPref(prefName, null);
    } catch (x) {}
  },

  MIGRATE_SIMPLE_WSTR_PREF: function (prefName, object, propName) {
    try {
      object[propName] = Pref.getComplexValue(prefName);
    } catch (x) {}
  },

  MIGRATE_SIMPLE_INT_PREF: function (prefName, object, propName) {
    try {
      object[propName] = Pref.getIntPref(prefName);
    } catch (x) {}
  },

  MIGRATE_SIMPLE_BOOL_PREF: function (prefName, object, propName) {
    try {
      object[propName] = Pref.getBoolPref(prefName);
    } catch (x) {}
  },

  MIGRATE_SIMPLE_FILE_PREF_TO_FILE_PREF: function (prefName, object, propName) {
    try {
      object[propName] = Pref.getComplexValue(prefName);
    } catch (x) {}
  },

  MIGRATE_SIMPLE_FILE_PREF_TO_BOOL_PREF: function (prefName, object, propName) {
    try {
      object[propName] = !!Pref.getComplexValue(prefName);
    } catch (x) {}
  },

  resetState: function () {
    this.m_alreadySetNntpDefaultLocalPath = false;
    this.m_alreadySetImapDefaultLocalPath = false;

    // Reset 'm_oldMailType' in case the prefs file has changed. This is possible in quick launch
    // mode where the profile to be migrated is IMAP type but the current working profile is POP.
    try {
      this.m_oldMailType = Pref.getIntPref(this.PREF_4X_MAIL_SERVER_TYPE);
    } catch (x) {
      this.m_oldMailType = -1;
    }
  },

  setUsernameIfNecessary: function () {
    try {
      var usernameIn4x = Pref.getCharPref(this.PREF_4X_MAIL_IDENTITY_USERNAME);
      if (usernameIn4x)
        return;
    } catch (x) {}

    try {
      var fullnameFromSystem = Services.userInfo.getFullName();
      if (!fullnameFromSystem)
        return;
    } catch (x) {}

    Pref.setComplexValue(this.PREF_4X_MAIL_IDENTITY_USERNAME, fullnameFromSystem);
  },

  migrateIdentity: function (identity) {
    this.setUsernameIfNecessary();

    this.MIGRATE_SIMPLE_STR_PREF(this.PREF_4X_MAIL_IDENTITY_USEREMAIL, identity, "email");
    this.MIGRATE_SIMPLE_WSTR_PREF(this.PREF_4X_MAIL_IDENTITY_USERNAME, identity, "fullName");
    this.MIGRATE_SIMPLE_STR_PREF(this.PREF_4X_MAIL_IDENTITY_REPLY_TO, identity, "replyTo");
    this.MIGRATE_SIMPLE_WSTR_PREF(this.PREF_4X_MAIL_IDENTITY_ORGANIZATION, identity, "organization");
    this.MIGRATE_SIMPLE_BOOL_PREF(this.PREF_4X_MAIL_COMPOSE_HTML, identity, "composeHtml");
    this.MIGRATE_SIMPLE_FILE_PREF_TO_FILE_PREF(this.PREF_4X_MAIL_SIGNATURE_FILE, identity, "signature");
    this.MIGRATE_SIMPLE_FILE_PREF_TO_BOOL_PREF(this.PREF_4X_MAIL_SIGNATURE_FILE, identity, "attachSignature");
    this.MIGRATE_SIMPLE_INT_PREF(this.PREF_4X_MAIL_SIGNATURE_DATE, identity, "signatureDate");

    this.MIGRATE_SIMPLE_BOOL_PREF(this.PREF_4X_MAIL_ATTACH_VCARD, identity, "attachVCard");

    // identity.escapedVCardStr = this.escapedVCardStrFrom4XPref(this.PREF_4X_MAIL_IDENTITY_VCARD_ROOT);
  },

  migrateSmtpServer: function (server) {
    this.MIGRATE_SIMPLE_STR_PREF(this.PREF_4X_NETWORK_HOSTS_SMTP_SERVER, server, "hostname");
    this.MIGRATE_SIMPLE_STR_PREF(this.PREF_4X_MAIL_SMTP_NAME, server, "username");
    this.MIGRATE_SIMPLE_INT_PREF(this.PREF_4X_MAIL_SMTP_SSL, server, "trySSL");
  },

  migratePopAccount: function (server) {
    throw new Error("Implement this!");
  },

  migrateImapAccounts: function (identity) {
    var isDefaultAccount = true;
    var servers = Services.prefBranch.getCharPref(this.PREF_4X_NETWORK_HOSTS_IMAP_SERVER, "");

    servers.split(",").forEach(function (server) {
      this.migrateImapAccount(identity, server, isDefaultAccount);
      isDefaultAccount = false;
    }, this);
  },

  migrateImapAccount: function (identity, hostAndPort, isDefaultAccount) {
    // get the old username
    var imapUsernamePref = "mail.imap.server." + hostAndPort + ".userName";
    var username = Services.prefBranch.getCharPref(imapUsernamePref);

    var imapIsSecurePref = "mail.imap.server." + hostAndPort + ".isSecure";
    var isSecure = Services.prefBranch.getBoolPref(imapIsSecurePref, false);

    // get the old host (and possibly port)
    var [host, port] = hostAndPort.split(":");
    if (port)
      port = parseInt(port, 10);
    else
      port = Services.protocolInfo.getDefaultServerPort(true);

    //
    // create the server
    //
    var server = Services.accountManager.createIncomingServer(username, host, "imap");
    server.port = port;
    server.isSecure = isSecure;

    // Generate unique pretty name for the account. It is important that this function
    // is called here after all port settings are taken care of.
    // Port values, if not default, will be used as a part of pretty name.
    var prettyName = server.generatePrettyNameForMigration();
    if (prettyName)
      server.prettyName = prettyName;

    // now upgrade all the prefs
    this.migrateOldImapPrefs(server, hostAndPort); // TODO: implement this

    // if they used -installer, this pref will point to where their files got copied
    // if the "mail.imap.root_dir" pref is set, use that.
    var imapMailDir = Services.prefBranch.getComplexValue(this.PREF_IMAP_DIRECTORY);

    // nsFileSpec dir;
    // PRBool dirExists;

    if (!imapMailDir) {
      // we want <profile>/ImapMail
      // , getter_AddRefs(imapMailDir));
      // imapMailDir = NS_GetSpecialDirectory(this.NS_APP_IMAP_MAIL_50_DIR);
    }

    if (!imapMailDir.exists()) {
      // TODO
      // imapMailDir.create();
      // rv = imapMailDir->Create(nsIFile::DIRECTORY_TYPE, 0775);
    }

    // nsCOMPtr<nsIFileSpec> imapMailDirSpec;

    // Convert the nsILocalFile into an nsIFileSpec
    // TODO: convert users os nsIFileSpec to nsILocalFile
    // and avoid this step.
    // rv = NS_NewFileSpecFromIFile(imapMailDir, getter_AddRefs(imapMailDirSpec));
    // if (NS_FAILED(rv)) return rv;

    var imapMailDirSpec = imapMailDir;

    // we only need to do this once
    if (!this.m_alreadySetImapDefaultLocalPath) {
      // set the default local path for "imap"
      server.defaultLocalPath = imapMailDirSpec;
      this.m_alreadySetImapDefaultLocalPath = true;
    }

    // we want .../ImapMail/<hostname>, not .../ImapMail
    imapMailDirSpec.appendRelativeUnixPath(host);

    // set the local path for this "imap" server
    server.localPath = imapMailDirSpec;

    if (!imapMailDirSpec.exists())
      imapMailDirSpec.createDir();

    // create the identity (TODO: )
    var copied_identity = Services.accountManager.createIdentity(identity);

    // Create an account when valid server and identity values are established.
    // This will keep the status of accounts sane by avoiding the addition of incomplete accounts.
    var account = Services.accountManager.createAccount();

    // hook the server to the account
    // before setting the copies and folder prefs
    // (see bug #31904)
    // but after we set the server's local path
    // (see bug #66018)
    account.incomingServer(server);
    account.addIdentity(copied_identity);

    // make this new identity a copy of the identity
    // that we created out of the 4.x prefs
    copied_identity.copy(identity);

    this.setMailCopiesAndFolders(copied_identity, username, host); // TODO: implement this

    if (isDefaultAccount)
      Services.accountManager.defaultAccount = account;

    // Set check for new mail option for default account to TRUE
    server.loginAtStartUp = true;
  },

  upgradePrefs: function () {
    // Reset some control vars, necessary in turbo mode.
    this.resetState();

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
      Services.smtpService.defaultServer(smtpServer);
    } catch (x) {}

    if (this.m_oldMailType === this.POP_4X_MAIL_TYPE) {
      // in 4.x, you could only have one pop account
      this.migratePopAccount(identity); // TODO: implement

      // everyone gets a local mail account in 5.0
      this.createLocalMailAccount(true); // TODO: implement
    } else if (this.m_oldMailType === this.IMAP_4X_MAIL_TYPE) {
      this.migrateImapAccounts(identity); // TODO: implement (partially implemented)

      // if they had IMAP in 4.x, they also had "Local Mail"
      // we'll migrate that to "Local Folders"
      this.migrateLocalMailAccount(); // TODO: implement
    } else if (this.HAVE_MOVEMAIL && (this.m_oldMailType === this.MOVEMAIL_4X_MAIL_TYPE)) {
      // if 4.x, you could only have one movemail account
      this.migrateMovemailAccount(identity); // TODO: implement

      // everyone gets a local mail account in 5.0
      this.createLocalMailAccount(true); // TODO: implement
    } else {
      return new Error("NS_ERROR_UNEXPECTED: unexpected!");
    }

    this.migrateNewsAccounts(identity); // TODO: implement

    if (this.MOZ_LDAP_XPCOM) {
      // this will upgrade the ldap prefs
      // Memo: explicitly
      var ldapPrefsService = Cc["@mozilla.org/ldapprefs-service;1"].getService();
    }

    this.migrateAddressBookPrefs(); // TODO: implement

    this.migrateAddressBooks(); // TODO: implement

    try {
      Pref.clearUserPref(this.PREF_4X_MAIL_POP_PASSWORD);
    } catch (x) {
      // intentionally ignore the exception
    }

    // we're done migrating, let's save the prefs
    Pref.QueryInterface(Ci.nsIPrefService);
    Pref.savePrefFile(null);

    // remove the temporary identity we used for migration purposes
    identity.clearAllValues();
    Services.accountManager.removeIdentity(identity);
  },

  // Migrate する必要のあるものが存在するかをチェック。存在しなければ
  // 例外。
  proceedWithMigration: function () {
    var prefValue = null;

    if ((this.m_oldMailType == this.POP_4X_MAIL_TYPE)
      || (this.HAVE_MOVEMAIL && (this.m_oldMailType == this.MOVEMAIL_4X_MAIL_TYPE))) {
      // if they were using pop or movemail, "mail.pop_name" must have been set
      // otherwise, they don't really have anything to migrate
      try {
        prefValue = Pref.getCharPref(this.PREF_4X_MAIL_POP_NAME);
      } catch (x) {
        prefValue = null;
      } finally {
        if (!prefValue) {
          // throw NS_ERROR_FAILURE
        }
      }
    } else if (this.m_oldMailType == this.IMAP_4X_MAIL_TYPE) {
      // if they were using imap, "network.hosts.imap_servers" must have been set
      // otherwise, they don't really have anything to migrate
      try {
        prefValue = Pref.getCharPref(this.PREF_4X_NETWORK_HOSTS_IMAP_SERVER);
      } catch (x) {
        prefValue = null;
      } finally {
        if (!prefValue) {
          throw new Error("PREF_4X_NETWORK_HOSTS_IMAP_SERVER");
        }
      }
    } else {
      throw new Error("NS_ERROR_UNEXPECTED");
    }
  }
};
