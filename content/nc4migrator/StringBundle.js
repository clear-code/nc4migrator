var EXPORTED_SYMBOLS = ["StringBundle"];

const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;
const { XPCOMUtils } = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});
const { Services } = Cu.import("chrome://nc4migrator/content/Services.js", {});

var StringBundle = {};

function defineLazyStringBundle(target, name, path) {
  target.__defineGetter__(name, function () {
    var privateName = "_" + name;
    if (!target[privateName])
      target[privateName] = Services.sBundleService.createBundle(path);
    return target[privateName];
  });
}

defineLazyStringBundle(StringBundle, "imapMsgs", "chrome://messenger/locale/imapMsgs.properties");
defineLazyStringBundle(StringBundle, "messenger", "chrome://messenger/locale/messenger.properties");
