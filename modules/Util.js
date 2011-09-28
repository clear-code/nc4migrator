var EXPORTED_SYMBOLS = ["Util"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

const { Browser } = Cu.import('resource://nc4migrator-modules/Browser.js', {});
const { Deferred } = Cu.import('resource://nc4migrator-modules/jsdeferred.js', {});

const Application = Cc['@mozilla.org/steel/application;1']
  .getService(Ci.steelIApplication);

var Util = {
  DEBUG: false,

  getEnv: function (aName, aDefault) {
    var env = Cc['@mozilla.org/process/environment;1']
      .getService(Ci.nsIEnvironment);

    return env.exists(aName) ?
      env.get(aName) : (1 in arguments ? arguments[1] : null);
  },

  or: function (aValue, aDefault) {
    return typeof aValue === "undefined" ? aDefault : aValue;
  },

  openFile: function (aPath) {
    let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
    file.initWithPath(aPath);

    return file;
  },

  getFile: function (aTarget) {
    let file;
    if (aTarget instanceof Ci.nsIFile) {
      file = aTarget.clone();
    } else {
      file = Util.openFile(aTarget);
    }

    return file;
  },

  readFile: function (aTarget, aOptions) {
    aOptions = aOptions || {};

    let file = Util.getFile(aTarget);
    if (!file.exists())
      throw new Error(file.path + " not found");

    let fileStream = Cc["@mozilla.org/network/file-input-stream;1"]
      .createInstance(Ci.nsIFileInputStream);
    fileStream.init(file,
                    Util.or(aOptions.ioFlags, 1),
                    Util.or(aOptions.permission, 0),
                    Util.or(aOptions.behaviorFlags, false));

    let converter = aOptions.converter;
    if (!converter) {
      converter = Cc["@mozilla.org/intl/converter-input-stream;1"]
        .createInstance(Ci.nsIConverterInputStream);

      converter.init(fileStream,
                     Util.or(aOptions.charset, 'UTF-8'),
                     fileStream.available(),
                     converter.DEFAULT_REPLACEMENT_CHARACTER);
    }

    let out = {};
    converter.readString(fileStream.available(), out);
    fileStream.close();

    return out.value;
  },

  writeFile: function (aTarget, aData, aOptions) {
    aOptions = aOptions || {};

    let file = Util.getFile(aTarget);
    if (file.exists() && !Util.or(aOptions.overwrite, true))
      throw new Error(file.path + " already exists");

    let fileStream = Cc["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Ci.nsIFileOutputStream);
    fileStream.init(file,
                    Util.or(aOptions.ioFlags, 0x02 | 0x08 | 0x20),
                    Util.or(aOptions.permission, 0644),
                    Util.or(aOptions.behaviorFlags, false));

    let wrote = fileStream.write(aData, aData.length);
    if (wrote != aData.length)
      throw new Error("Failed to write data to " + file.path);

    fileStream.close();

    return wrote;
  },

  readJSON: function (aTarget) {
    return JSON.stringify(Util.readFile(aTarget));
  },

  writeJSON: function (aTarget, aObject) {
    return Util.writeFile(aTarget, JSON.stringify(aObject));
  },

  getSpecialDirectory: function (aProp) {
    var dirService = Cc['@mozilla.org/file/directory_service;1']
      .getService(Ci.nsIProperties);

    return dirService.get(aProp, Ci.nsILocalFile);
  },

  copyDirectoryAs: function (source, dest) {
    let sourceDir = this.getFile(source);
    let destDir = this.getFile(dest);

    if (destDir.exists())
      destDir.remove(true);
    sourceDir.copyTo(destDir.parent, destDir.leafName);
  },

  getRootDrives: function () {
    const FileProtocolHandler = Cc["@mozilla.org/network/protocol;1?name=file"]
      .getService(Ci.nsIFileProtocolHandler);
    const RDF = Cc["@mozilla.org/rdf/rdf-services;1"].getService(Ci.nsIRDFService);
    const NC_ROOT = "NC:FilesRoot",
    NC_CHILD = "http://home.netscape.com/NC-rdf#child";

    var rdfFiles = RDF.GetDataSource("rdf:files");
    var enumerator = rdfFiles.GetTargets(NC_ROOT, NC_CHILD, true); // nsISimpleEnumerator
    var drives = [];
    while (enumerator.hasMoreElements()){
      var resource = enumerator.getNext().QueryInterface(Ci.nsIRDFResource);
      var file = FileProtocolHandler.getFileFromURLSpec(resource.Value);
      drives.push(file);
    }

    return drives;
  },

  readDirectory: function (directory) {
    directory = Util.getFile(directory);

    if (directory.isDirectory()) {
      let entries = directory.directoryEntries;
      let array = [];
      while (entries.hasMoreElements())
        array.push(entries.getNext().QueryInterface(Ci.nsIFile));
      return array;
    }

    return null;
  },

  traverseDirectory: function (directory, visitor) {
    try {
      visitor(directory);
    } catch (x) {
      Util.log("traverseDirectory: " + x);
    }

    if (directory.isDirectory()) {
      let entries = directory.directoryEntries;
      while (entries.hasMoreElements()) {
        let nextDir = entries.getNext().QueryInterface(Ci.nsIFile);
        Util.traverseDirectory(nextDir, visitor);
      }
    }
  },

  deferredTraverseDirectory: function (directory, visitor, timeout) {
    if (!directory)
      return Deferred.next(function() {
               return true;
             });

    return Deferred.next(function() {
             var result;
             try {
               result = visitor(directory);
             } catch (x) {
               Util.log("deferredTraverseDirectory: " + x);
             }

             if (result === false)
               return false;

             try{
               if (!directory.isDirectory())
                 return result;

               var deferreds = [];
               var entries = directory.directoryEntries;
             } catch (x) {
               Util.log("deferredTraverseDirectory: " + x);
               return result;
             }

             while (entries.hasMoreElements()) {
               let nextDir = entries.getNext().QueryInterface(Ci.nsIFile);
               deferreds.push(Util.deferredTraverseDirectory(nextDir, visitor));
             }
             if (!deferreds.length)
               return result;

             var deferred = new Deferred();
             var timer;
             var traversing = Deferred.parallel(deferreds)
                                .next(function(results) {
                                  if (timer) timer.cancel();
                                  results.length = deferreds.length;
                                  deferred.call(Array.every(results, function(result) result ));
                                });
             if (timeout) {
               timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
               timer.initWithCallback(function() {
                 if (traversing) traversing.cancel();
                 deferred.call(false);
               }, timeout, timer.TYPE_ONE_SHOT);
             }
             return deferred;
           });
  },

  // getQuota: function () {
  // },

  // Get file for file-1, file-2, file-3, ...
  // Currently, for directory only (do not consider suffixes)
  getIdenticalFileFor: function (originalFile) {
    var parent       = originalFile.parent;
    var file         = originalFile;
    var originalName = originalFile.leafName;

    var i = 0;
    while (file.exists()) {
      file = parent.clone();
      file.append(originalName + "-" + (++i));
    }

    return file;
  },

  format: function (formatString) {
    formatString = "" + formatString;

    var values = Array.slice(arguments, 1);

    return formatString.replace(/%s/g, function () {
      return Util.or(values.shift(), "");
    });
  },

  formatBytes: function (bytes, base) {
    base = base || 1024;

    var notations = ["", "K", "M", "G", "T", "P", "E", "Z", "Y"];
    var number = bytes;

    while (number >= base && notations.length > 1) {
      number /= base;
      notations.shift();
    }

    return (notations[0] ? number.toFixed(1) : number) + " " + notations[0] + "B";
  },

  log: function () {
    if (this.DEBUG)
      Application.console.log(Util.format.apply(Util, arguments));
  },

  _loader: null,
  loadSubScriptInEnvironment: function (path, context) {
    if (!this._loader)
      this._loader = Cc["@mozilla.org/moz/jssubscript-loader;1"]
      .getService(Ci.mozIJSSubScriptLoader);
    this._loader.loadSubScript("resource://nc4migrator-modules/eval.js", context);
    return context;
  },

  evalInContext: function (aCode, aContext) {
    const EVAL_ERROR  = "__nc4_eval_error";
    const EVAL_RESULT = "__nc4_eval_result";
    const EVAL_STRING = "__nc4_eval_string";

    try {
      if (!aContext)
        aContext = this.userContext;

      aContext[EVAL_ERROR]  = null;
      aContext[EVAL_STRING] = aCode;
      aContext[EVAL_RESULT] = null;

      Cc["@mozilla.org/moz/jssubscript-loader;1"]
        .getService(Ci.mozIJSSubScriptLoader)
        .loadSubScript("resource://nc4migrator-modules/eval.js", aContext);

      if (aContext[EVAL_ERROR])
        throw aContext[EVAL_ERROR];

      return aContext[EVAL_RESULT];
    } finally {
      delete aContext[EVAL_ERROR];
      delete aContext[EVAL_RESULT];
      delete aContext[EVAL_STRING];
    }
  },

  LOGGER_INDENTATION: 2,
  LOGGER_INDENT_CHAR: " ",
  logger: function (indent) {
    var self = {
      indent: indent || 0,
      next: function (f, self) {
        f.call(self, Util.logger(indent + Util.LOGGER_INDENTATION));
      },
      log: function (msg) {
        var indentedMsg = msg.split("\n").map(
          function (l)
          (new Array(self.indent)).join(Util.LOGGER_INDENT_CHAR)
        );
        Util.log(indentedMsg);
      }
    };

    return self;
  },

  generateUUID: function () {
    return Cc["@mozilla.org/uuid-generator;1"]
      .getService(Ci.nsIUUIDGenerator)
      .generateUUID();
  },

  openFileFromURL: function (urlSpec) {
    let ios = Cc['@mozilla.org/network/io-service;1']
          .getService(Ci.nsIIOService);
    var fileHandler = ios.getProtocolHandler('file')
          .QueryInterface(Ci.nsIFileProtocolHandler);
    return fileHandler.getFileFromURLSpec(urlSpec);
  },

  chromeToURLSpec: function (aUrl) {
    if (!aUrl || !(/^chrome:/.test(aUrl)))
      return null;

    let ios = Cc['@mozilla.org/network/io-service;1']
          .getService(Ci["nsIIOService"]);
    let uri = ios.newURI(aUrl, "UTF-8", null);
    let cr = Cc['@mozilla.org/chrome/chrome-registry;1']
          .getService(Ci.nsIChromeRegistry);
    let urlSpec = cr.convertChromeURL(uri).spec;

    return urlSpec;
  },

  launchProcess: function (exe, args) {
    let process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
    let exe = Util.getFile(exe);
    process.init(exe);
    process.run(false, args, args.length);
    return process;
  },

  commands: {
    diskfree: "chrome://nc4migrator/content/bin/diskfree.bat"
  },

  get diskFreeCommand() {
    return Util.openFileFromURL(
      Util.chromeToURLSpec(Util.commands.diskfree)
    );
  },

  getDiskQuota: function (targetDirectory) {
    targetDirectory = Util.getFile(targetDirectory);

    try {
      const { getDiskSpace } = Cu.import('resource://nc4migrator-modules/diskspace.win32.js', {});
      let tryCount = 0;
      return Deferred.next(function tryGetDiskSpace() {
        let size = getDiskSpace(targetDirectory);
        tryCount++;
        return size < 0 && tryCount < 10 ? Deferred.next(tryGetDiskSpace) : size ;
      });
    } catch ([]) {}

    return this.getDiskQuotaLegacy(targetDirectory);
  },

  // legacy version for Gecko 1.9.2 or olders
  getDiskQuotaLegacy: function (targetDirectory) {
    let deferred = new Deferred();
    let tmpFile = Util.getSpecialDirectory("TmpD");
    tmpFile.append(Util.generateUUID());

    let args = [targetDirectory.path, tmpFile.path];
    let process = Util.launchProcess(Util.diskFreeCommand, args);

    let timer = Browser.setInterval(function () {
      if (!tmpFile.exists())
        return;
      Browser.clearInterval(timer);
      let resultString = Util.readFile(tmpFile, {
        charset: "shift_jis"
      });
      tmpFile.remove(true);
      // next
      let [, quotaString] = resultString.match(/:[ \t]*([0-9]+)/);
      deferred.call(Number(quotaString));
    }, 100);

    return deferred;
  },

  restartApplication: function () {
    const nsIAppStartup = Ci.nsIAppStartup;

    let os         = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    let cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(Ci.nsISupportsPRBool);

    os.notifyObservers(cancelQuit, "quit-application-requested", null);
    if (cancelQuit.data)
      return;

    os.notifyObservers(null, "quit-application-granted", null);
    let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
    let windows = wm.getEnumerator(null);

    while (windows.hasMoreElements()) {
      let win = windows.getNext();
      if (("tryToClose" in win) && !win.tryToClose())
        return;
    }

    Cc["@mozilla.org/toolkit/app-startup;1"].getService(nsIAppStartup)
      .quit(nsIAppStartup.eRestart | nsIAppStartup.eAttemptQuit);
  },

  getMainWindow: function () {
    return Cc["@mozilla.org/appshell/window-mediator;1"]
      .getService(Ci.nsIWindowMediator)
      .getMostRecentWindow("mail:3pane");
  },

  // ============================================================
  // DOM
  // ============================================================

  alert: function (aTitle, aMessage, aWindow) {
    let prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
          .getService(Ci.nsIPromptService);
    prompts.alert(aWindow, aTitle, aMessage);
  },

  alert2: function () {
    let message = Util.format.apply(Util, arguments);
    Util.alert("Alert", message);
  },

  getElementCreator: function (doc) {
    return function elementCreator(name, attrs, children) {
      let elem = doc.createElement(name);

      if (attrs)
        for (let [k, v] in Iterator(attrs))
          elem.setAttribute(k, v);

      if (children)
        for (let [, v] in Iterator(children))
          elem.appendChild(v);

      return elem;
    };
  },

  http: {
    params:
    function params(prm) {
      let pt = typeof prm;

      if (prm && pt === "object")
        prm = [k + "=" + v for ([k, v] in Iterator(prm))].join("&");
      else if (pt !== "string")
        prm = "";

      return prm;
    },

    request:
    function request(method, url, callback, params, opts) {
      opts = opts || {};

      let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
      req.QueryInterface(Ci.nsIXMLHttpRequest);

      const async = (typeof callback === "function");

      if (async)
        req.onreadystatechange = function () { if (req.readyState === 4) callback(req); };

      req.open(method, url, async, opts.username, opts.password);

      if (opts.raw)
        req.overrideMimeType('text/plain; charset=x-user-defined');

      for (let [name, value] in Iterator(opts.header || {}))
        req.setRequestHeader(name, value);

      req.send(params || null);

      return async ? void 0 : req;
    },

    get:
    function get(url, callback, params, opts) {
      params = this.params(params);
      if (params)
        url += "?" + params;

      return this.request("GET", url, callback, null, opts);
    },

    post:
    function post(url, callback, params, opts) {
      params = this.params(params);

      opts = opts || {};
      opts.header = opts.header || {};
      opts.header["Content-type"] = "application/x-www-form-urlencoded";
      opts.header["Content-length"] = params.length;
      opts.header["Connection"] = "close";

      return this.request("POST", url, callback, params, opts);
    }
  }
};