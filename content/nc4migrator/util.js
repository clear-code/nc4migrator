var EXPORTED_SYMBOLS = ["Util"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

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
    if (aTarget instanceof Ci.nsIFile)
      file = aTarget;
    else
      file = Util.openFile(aTarget);

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

    converter();
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

  format: function (formatString) {
    var values = Array.slice(arguments, 1);

    return formatString.replace(/%s/g, function () {
      return (values.shift() || "");
    });
  },

  log: function () {
    if (this.DEBUG)
      Application.console.log(Util.format.apply(Util, arguments));
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
        .loadSubScript("chrome://nc4migrator/content/eval.js", aContext);

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
