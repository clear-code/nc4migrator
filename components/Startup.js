const ObserverService = Components
  .classes['@mozilla.org/observer-service;1']
  .getService(Components.interfaces.nsIObserverService);

const Pref = Components
  .classes['@mozilla.org/preferences;1']
  .getService(Components.interfaces.nsIPrefBranch)
  .QueryInterface(Components.interfaces.nsIPrefBranch2);

function log(aMessage)
{
  ObserverService.notifyObservers(null, 'log', '[nc4migrator] '+aMessage);
}

function StartupService() {
}
StartupService.prototype = {
  kCID  : Components.ID('{1db5ecc0-8615-11dd-ad8b-0800200c9a66}'),
  kID   : '@clear-code.com/nc4migrator/startup;1',
  kNAME : 'Netscape Communicator 4 Migration Startup Service',

  observe : function(aSubject, aTopic, aData)
  {
    switch (aTopic)
    {
    case 'app-startup':
      ObserverService.addObserver(this, 'profile-after-change', false);
      return;

    case 'profile-after-change':
      ObserverService.removeObserver(this, 'profile-after-change');
      this.checkAutoMigration();
      return;
    }
  },

  checkAutoMigration : function()
  {
    log('checkAutoMigration');
    if (this.getPref('mailnews.quotingPrefs.version')) {
      log('migration is already done');
      return;
    }
    this.migrateProfile();
  },

  migrateProfile : function()
  {
    log('start migration');
    var profiles = this.nsreg.getProfiles();
    if (!profiles.length) {
      log('no profile alert');
      this.alert(
        this.getString('profilesNotFound_title'),
        this.getString('profilesNotFound_text')
      );
      return;
    }

    var username = Components
      .classes['@mozilla.org/process/environment;1']
      .getService(Components.interfaces.nsIEnvironment)
      .get('username');
    log('username is '+username);

    var ignoreCase = this.getPref('extensions.nc4migrator.profileDetection.ignoreCase');
    if (ignoreCase) username = username.toLowerCase();

    var ignoreChars = this.getPref('extensions.nc4migrator.profileDetection.ignoreChars');
    ignoreChars = ignoreChars ? new RegExp('['+ignoreChars.replace(/([\[\]\^\-])/g, '\\$1')+']+', 'g') : null ;
    if (ignoreChars) username = username.replace(ignoreChars, '');
    log('conditions: ignoreCase='+ignoreCase+', ignoreChars="'+ignoreChars+'"');

    var profile;
    profiles.some(function(aProfile) {
      var name = aProfile.name;
      if (ignoreCase) name = name.toLowerCase();
      if (ignoreChars) name = name.replace(ignoreChars, '');
      log('compare: '+name+'('+aProfile.name+') vs '+username);
      if (name != username) {
        return false;
      }
      profile = aProfile;
      log('auto detection: '+profile.name+' / '+profile.path);
      return true;
    }, this);

    if (!profile) {
      log('auto detection failed');
      profile = this.selectProfile(profiles);
      if (profile) log('manual detection: '+profile.name+' / '+profile.path);
    }

    if (!profile) {
      log('no profile found');
      return;
    }

    var pref = this.getFileFromPath(profile.path);
    pref.append('prefs.js');
    log('prefs.js: '+pref.path);
    if (!pref.exists()) {
      log('prefs.js doesn\'t exist');
      this.alert(
        this.getString('prefsMigrationFailed_title'),
        this.getString('prefsMigrationFailed_text')
      );
      return;
    }
    this.migratePrefsFrom(pref, profile);

    this.migrateAddressBooks(profile);

    this.onFinish();
  },
  wantsRestart : false,

  get nsreg()
  {
    if (!this._nsreg) {
      this._nsreg = {};
      this.loadSubScriptInEnvironment('chrome://nc4migrator/content/nsreg.js', this._nsreg);
    }
    return this._nsreg;
  },
  _nsreg : null,

  selectProfile : function(aProfiles)
  {
    log('selectProfile');
    var selectedProfile = { value : 0 };
    if (!this.PromptService.select(
      null,
      this.getString('selectProfile_title'),
      this.getString('selectProfile_text'),
      aProfiles.length,
      aProfiles.map(function(aProfile) { return aProfile.name; }),
      selectedProfile
    )) {
      log('no profile is selected');
      return null;
    }

    log('selected profile is '+selectedProfile.value);
    if (selectedProfile.value in aProfiles) {
      log(selectedProfile.value+' exists in the list');
      return aProfiles[selectedProfile.value];
    }

    log('invalid profile is selected');
    return null;
  },

  migratePrefsFrom : function(aFile, aProfile)
  {
    log('migratePrefsFrom');
    var self = this;
    var setPref = function(aKey, aValue) {
      if (typeof aValue == 'number' && isNaN(aValue)) return;
      self.setPref(aKey, aValue);
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
    log('sandbox setup complete');

    var autoConfig = this.netscape4;
    log('autoConfig='+autoConfig);
    if (autoConfig && autoConfig.exists()) {
      autoConfig = autoConfig.parent;
      autoConfig.append('netscape.cfg');
      log('autoConfig: '+autoConfig.path);
      if (autoConfig.exists()) {
        log('autoConfig exists');
        var encoded = this.readFrom(autoConfig, 'raw');
        var decoded = encoded
          .split('')
          .map(function(aChar) {
            return String.fromCharCode(
              aChar.charCodeAt(0) - 7
            );
          })
          .join('');
        log('loaded autoConfig:\n---------------------\n'+decoded+'\n---------------------');
        eval(decoded, sandbox);
      }
    }

    var contents = this.readFrom(aFile, 'Shift_JIS');
    log('loaded prefs:\n---------------------\n'+contents+'\n---------------------');
    eval(contents, sandbox);

    var mailDir = this.getPref('mail.directory');
    log('mailDir='+mailDir);
    if (mailDir) {
      log('clear preference');
      this.clearPref('mail.directory');
    }
    else {
      mailDir = this.getFileFromPath(aProfile.path);
      mailDir.append('Mail');
      mailDir = mailDir.exists() ? mailDir.path : '' ;
      log('autodetect: mailDir='+mailDir);
    }

    log('ready to verify accounts');
    this.loadSubScriptInEnvironment('chrome://messenger/content/accountUtils.js', (function() { return this; })());
    verifyAccounts();
    log('verification complete');

    this.upgradeSpecialFolders();

    var prefix = 'extensions.nc4migrator.override.';
    Pref.getChildList(prefix, {}).forEach(function(aPref) {
      var key = aPref.replace(prefix, '');
      var value = this.getPref(aPref);
      var shouldClear = (value == '[[CLEAR]]');
      log('override: '+aPref+' = '+value);
      if (key.indexOf('*') > -1) {
        log('wildcard');
        var regexp = new RegExp('^'+key.replace(/\./g, '\\.').replace(/\*/g, '.+')+'$', '');
        Pref.getChildList(key.split('*')[0], {}).forEach(function(aPref) {
          if (!regexp.test(aPref)) return;
          if (shouldClear) {
            log('clear '+aPref);
            this.clearPref(aPref);
          }
          else {
            log('override '+aPref+' by '+value);
            this.setPref(aPref, value);
          }
        }, this);
      }
      else {
        if (shouldClear) {
          log('clear '+key);
          this.clearPref(key);
        }
        else {
          log('override '+key+' by '+value);
          this.setPref(key, value);
        }
      }
    }, this);
    log('override:complete');

    if (mailDir) {
      log('mailDir resetting');
      if (this.getPref('extensions.nc4migrator.shareOldMailbox')) {
        log('mailDir is set to be shared!');
        var localFolderServer = this.getPref('mail.accountmanager.localfoldersserver');
        log('local folder server is '+localFolderServer);
        this.clearPref('mail.server.'+localFolderServer+'.directory-rel');
        this.setPref('mail.server.'+localFolderServer+'.directory', mailDir);
        this.wantsRestart = true; // 再起動後でないとフォルダの変更が反映されない
      }
      else {
        log('mailDir should be migrated!');
        var bag = Components
          .classes['@mozilla.org/hash-property-bag;1']
          .createInstance(Components.interfaces.nsIWritablePropertyBag);
        bag.setProperty('mailDir', mailDir);
        var WindowWatcher = Components
          .classes['@mozilla.org/embedcomp/window-watcher;1']
          .getService(Components.interfaces.nsIWindowWatcher);
        log('start migration');
        WindowWatcher.openWindow(
          null,
          'chrome://nc4migrator/content/migration.xul',
          'nc4migrator:mailmigration',
          'chrome,dialog,modal,dependent',
          bag
        );
      }
    }
  },

  upgradeSpecialFolders : function()
  {
    this.upgradeSpecialFolder(
      'mail.default_drafts',
      'mail.identity.*.draft_folder',
      'mail.identity.*.drafts_folder_picker_mode',
      'Drafts'
    );
    this.upgradeSpecialFolder(
      'mail.default_templates',
      'mail.identity.*.stationery_folder',
      'mail.identity.*.tmpl_folder_picker_mode',
      'Templates'
    );
    this.upgradeSpecialFolder(
      'mail.imap_sentmail_path',
      'mail.identity.*.fcc_folder',
      'mail.identity.*.fcc_folder_picker_mode',
      'Sent'
    );
  },
  upgradeSpecialFolder : function(aOriginal, aTarget, aPicker, aFolder)
  {
    var orig = this.getPref(aOriginal);
    if (orig.toLowerCase().indexOf('imap:') != 0) {
      return;
    }

    orig = orig.replace(/^[^:]+:\/\//, '');
    if (orig.toLowerCase().indexOf('local%20folder') == 0) {
      return;
    }

    if (!/^[^\/@]+@[^\/]+/.test(orig)) {
      orig = '*@'+orig;
    }

    var picker = '1';
    if (!/^[^\/]+\/[^\/]+/.test(orig)) {
      orig += '/' + aFolder;
      picker = '0';
    }

    orig = 'imap://'+orig;

    this.getPref('mail.accountmanager.accounts')
      .split(/[,\s]+/).forEach(function(aAccount) {
        var identities = this.getPref('mail.account.'+aAccount+'.identities');
        if (!identities) return;
        var server = this.getPref('mail.account.'+aAccount+'.server');
        var username = this.getPref('mail.server.'+server+'.userName');
        var folder = orig.replace(/\*+/, username);
        identities.split(/[,\s]+/).forEach(function(aId) {
          this.setPref(aTarget.replace(/\*+/, aId), folder);
          this.setPref(aPicker.replace(/\*+/, aId), picker);
        }, this);
      }, this);
  },

  migrateAddressBooks : function(aProfile)
  {
    log('migrateAddressBooks');
    var netscape = this.netscape;
    if (!netscape || !this.isNsutilsInstalled)
      return;

    this.execAndWait(
      netscape,
      '-nosplash',
      '-CreateProfile',
      'migration'
    );
    this.execAndWait(
      netscape,
      '-nosplash',
      '-chrome',
      'chrome://nsutils/content/disableturbo.xul',
      '-P',
      'migration'
    );
    this.execAndWait(
      netscape,
      '-nosplash',
      '-chrome',
      'chrome://nsutils/content/abconverter.xul?user='+encodeURIComponent(aProfile.name),
      '-P',
      'migration'
    );
    log('address books are converted');

    var profileDir = this.getFileFromPath(aProfile.path);
    var files = profileDir.directoryEntries;
    var file;
    var abPattern = /^(.+)\.ldif$/i;
    var ignoreFiles = [
      'netcenter',
      'verisign'
    ];
    var targets = [];
    while (files.hasMoreElements())
    {
      file = files.getNext().QueryInterface(Components.interfaces.nsILocalFile);
      if (
        file.isDirectory() ||
          !abPattern.test(file.leafName) ||
          ignoreFiles.indexOf(RegExp.$1) > -1
      )
        continue;
      log(file.path+' should be imported');
      targets.push(file);
    }
    if (!targets.length) return;

    var importAsHomeAddress = this.getPref('extensions.nc4migrator.addressbook.importAsHomeAddress');

    log('start to import');
    var addressBook = Components
      .classes['@mozilla.org/addressbook;1']
      .createInstance(Components.interfaces.nsIAddressBook);
    targets.forEach(function(aFile) {
      var fileSpec = Components
        .classes['@mozilla.org/filespec;1']
        .createInstance(Components.interfaces.nsIFileSpec);
      fileSpec.nativePath = aFile.path;
      addressBook.migrate4xAb(fileSpec, false, importAsHomeAddress);
    });
    dump('import complete');
  },

  onFinish : function()
  {
    log('onFinish');
    if (this.wantsRestart)
      this.restartApplication();
  },

  restartApplication : function()
  {
    log('restartApplication');
    this.restarting = true;
    const startup = Components
      .classes['@mozilla.org/toolkit/app-startup;1']
      .getService(Components.interfaces.nsIAppStartup);
    startup.quit(startup.eRestart | startup.eAttemptQuit);
  },
  restarting : false,

  get netscape()
  {
    if (this._netscape) return this._netscape;
    try {
      var nsKey = Components
        .classes['@mozilla.org/windows-registry-key;1']
        .createInstance(Components.interfaces.nsIWindowsRegKey);
      nsKey.open(
        nsKey.ROOT_KEY_LOCAL_MACHINE,
        'SOFTWARE\\Netscape\\Netscape',
        nsKey.ACCESS_READ
      );
      var version = nsKey.readStringValue('CurrentVersion');
      var curVerKey = nsKey.openChild(version+'\\Main', nsKey.ACCESS_READ);
      var path = curVerKey.readStringValue('PathToExe');
      curVerKey.close();
      nsKey.close();

      this._netscape = this.getFileFromPath(path);
      log('this.netscape = '+this._netscape.path);
    }
    catch(e) {
      log(e);
      //   this.alert('error', e);
    }
    return this._netscape;
  },
  _netscape : null,
  get netscape4()
  {
    if (this._netscape4) return this._netscape4;
    try {
      var nsKey = Components
        .classes['@mozilla.org/windows-registry-key;1']
        .createInstance(Components.interfaces.nsIWindowsRegKey);
      nsKey.open(
        nsKey.ROOT_KEY_LOCAL_MACHINE,
        'SOFTWARE\\Netscape\\Netscape Navigator',
        nsKey.ACCESS_READ
      );
      var version = nsKey.readStringValue('CurrentVersion');
      var curVerKey = nsKey.openChild(version+'\\Main', nsKey.ACCESS_READ);
      var path = curVerKey.readStringValue('Install Directory');
      curVerKey.close();
      nsKey.close();

      this._netscape4 = this.getFileFromPath(path);
      this._netscape4.append('Program');
      this._netscape4.append('netscape.exe');
      log('this.netscape4 = '+this._netscape4.path);
    }
    catch(e) {
      log(e);
      //   this.alert('error', e);
    }
    return this._netscape4;
  },
  _netscape4 : null,


  get isNsutilsInstalled()
  {
    if (this._isNsutilsInstalled === null) {
      var nsutils = this.netscape;
      if (nsutils) {
        nsutils = nsutils.parent;
        nsutils.append('chrome');
        nsutils.append('nsutils.jar');
        this._isNsutilsInstalled = nsutils.exists();
      }
      else {
        this._isNsutilsInstalled = false;
      }
      log('isNsutilsInstalled='+this._isNsutilsInstalled);
    }
    return this._isNsutilsInstalled;
  },
  _isNsutilsInstalled : null,

  // file I/O

  loadSubScriptInEnvironment : function(aURI, aEnvironment)
  {
    log('load script from '+aURI+' to '+aEnvironment);
    this.JSSubScriptLoader.loadSubScript(aURI, aEnvironment);
  },

  get JSSubScriptLoader()
  {
    if (!this._JSSubScriptLoader) {
      this._JSSubScriptLoader = Components
        .classes['@mozilla.org/moz/jssubscript-loader;1']
        .getService(Components.interfaces.mozIJSSubScriptLoader);
    }
    return this._JSSubScriptLoader;
  },
  _JSSubScriptLoader : null,

  readFrom : function(aFile, aEncoding)
  {
    log('read from '+aFile.path+' as '+aEncoding);
    var fileContents;
    var stream = Components
      .classes['@mozilla.org/network/file-input-stream;1']
      .createInstance(Components.interfaces.nsIFileInputStream);
    try {
      stream.init(aFile, 1, 0, false); // open as "read only"
      if (aEncoding == 'raw') {
        var scriptableStream = Components
          .classes['@mozilla.org/scriptableinputstream;1']
          .createInstance(Components.interfaces.nsIScriptableInputStream);
        scriptableStream.init(stream);
        var fileSize = scriptableStream.available();
        fileContents = scriptableStream.read(fileSize);
        scriptableStream.close();
      }
      else {
        var converterStream = Components
          .classes['@mozilla.org/intl/converter-input-stream;1']
          .createInstance(Components.interfaces.nsIConverterInputStream);
        converterStream.init(stream, aEncoding || 'UTF-8', stream.available(),
                             converterStream.DEFAULT_REPLACEMENT_CHARACTER);
        var out = {};
        converterStream.readString(stream.available(), out);
        fileContents = out.value;
        converterStream.close();
      }
      stream.close();
    }
    catch(e) {
      dump(e+'\n');
      return null;
    }
    return fileContents;
  },

  getFileFromPath : function(aPath)
  {
    try {
      var file = Components.classes['@mozilla.org/file/local;1']
        .createInstance(Components.interfaces.nsILocalFile);
      file.initWithPath(aPath);
      return file;
    }
    catch(e) {
    }
    return null;
  },

  execAndWait : function()
  {
    log('execAndWait');
    var args = Array.slice(arguments);
    log('command: '+args.join(' '));
    var exe = args.shift();

    if (typeof exe == 'string') exe = this.getFileFromPath(exe);
    if (!exe || !exe.exists()) return;

    var process = Components
      .classes['@mozilla.org/process/util;1']
      .createInstance(Components.interfaces.nsIProcess);
    process.init(exe);
    process.run(true, args, args.length, {});
  },

  // preferences

  Pref : Pref,

  getPref : function(aKey, aType)
  {
    try {
      switch (
        String(aType || '').toLowerCase() ||
          this.Pref.getPrefType(aKey)
      )
      {
      case this.Pref.PREF_STRING:
      case 'string':
        return decodeURIComponent(escape(this.Pref.getCharPref(aKey)));
      case this.Pref.PREF_INT:
      case 'number':
        return this.Pref.getIntPref(aKey);
      case 'localizedstring':
        return this.Pref.getComplexValue(aKey, Components.interfaces.nsIPrefLocalizedString).data;
      case 'file':
        return this.Pref.getComplexValue(aKey, Components.interfaces.nsILocalFile);
      default:
        return this.Pref.getBoolPref(aKey);
      }
    }
    catch(e) {
    }
    return null;
  },

  setPref : function(aKey, aValue, aType)
  {
    var type;
    try {
      type = typeof aValue;
    }
    catch(e) {
      type = null;
    }

    try {
      switch (aType || type)
      {
      case 'string':
        this.Pref.setCharPref(aKey, unescape(encodeURIComponent(aValue)));
        break;
      case 'number':
        this.Pref.setIntPref(aKey, parseInt(aValue));
        break;
      default:
        this.Pref.setBoolPref(aKey, aValue);
        break;
      }
    }
    catch(e) {
      dump('Fail to set pref.\n'+aKey+'/'+aValue+'\n'+e+'\n');
    }
    return aValue;
  },

  clearPref : function(aKey)
  {
    try {
      this.Pref.clearUserPref(aKey);
    }
    catch(e) {
    }
  },

  // prompt

  get PromptService()
  {
    return  Components
      .classes['@mozilla.org/embedcomp/prompt-service;1']
      .getService(Components.interfaces.nsIPromptService);
  },

  alert : function(aTitle, aText)
  {
    this.PromptService.alert(null, aTitle, aText);
  },

  confirm : function(aTitle, aText)
  {
    return this.PromptService.confirm(null, aTitle, aText);
  },

  // string bundle

  _bundle : Components
    .classes['@mozilla.org/intl/stringbundle;1']
    .getService(Components.interfaces.nsIStringBundleService)
    .createBundle('chrome://nc4migrator/locale/nc4migrator.properties'),

  getString : function(aKey)
  {
    try {
      return this._bundle.GetStringFromName(aKey);
    }
    catch(e) {
    }
    return '';
  },

  getFormattedString : function(aKey, aValues)
  {
    try {
      return this._bundle.formatStringFromName(aKey, aValues, aValues.length);
    }
    catch(e) {
    }
    return '';
  },

  // debug

  Console : Components.classes['@mozilla.org/consoleservice;1']
    .getService(Components.interfaces.nsIConsoleService),

  log : function() // debug use
  {
    this.Console.logStringMessage(Array.slice(arguments).join('\n'));
  },

  QueryInterface : function(aIID)
  {
    if (!aIID.equals(Components.interfaces.nsIObserver) &&
        !aIID.equals(Components.interfaces.nsISupports)) {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    return this;
  }

};

var gModule = {
  registerSelf : function(aCompMgr, aFileSpec, aLocation, aType)
  {
    aCompMgr = aCompMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    var catMgr = Components.classes['@mozilla.org/categorymanager;1']
      .getService(Components.interfaces.nsICategoryManager);
    for (var key in this._objects) {
      var obj = this._objects[key];
      aCompMgr.registerFactoryLocation(obj.CID, obj.className, obj.contractID, aFileSpec, aLocation, aType);
      if (obj.category)
        catMgr.addCategoryEntry(obj.category, obj.entry || obj.className, obj.contractID, true, true);
    }
  },

  getClassObject : function(aCompMgr, aCID, aIID)
  {
    if (!aIID.equals(Components.interfaces.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

    for (var key in this._objects) {
      if (aCID.equals(this._objects[key].CID))
        return this._objects[key].factory;
    }

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  _objects : {
    StartupService : {
      CID        : StartupService.prototype.kCID,
      contractID : StartupService.prototype.kID,
      className  : StartupService.prototype.kNAME,
      factory    : {
        createInstance : function (aOuter, aIID)
        {
          if (aOuter != null)
            throw Components.results.NS_ERROR_NO_AGGREGATION;
          return (new StartupService()).QueryInterface(aIID);
        }
      },
      category   : 'app-startup'
    }
  },

  canUnload : function(aCompMgr)
  {
    return true;
  }
};

function NSGetModule(aCompMgr, aFileSpec) {
  return gModule;
}

