var EXPORTED_SYMBOLS = ["Win32"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

const ctypes = Cu.import("ctypes", {});
const lib    = ctypes.open("user32", ctypes.SEARCH);

var Win32 = {
  // http://msdn.microsoft.com/ja-jp/library/cc429308.aspx
  _GetDiskFreeSpaceEx: lib.declare(
    "GetDiskFreeSpaceEx",
    ctypes.winapi_abi,          // abi
    ctypes.int32_t,             // return value type (BOOL)
    ctypes.jschar.ptr,          // arg0 type (LPCTSTR)
    ctypes.int32_t
  ),

  GetDiskFreeSpaceEx: function (drive) {
    let freeBytesAvailable     = new ctypes.uint32_t(0);
    let totalNumberOfBytes     = new ctypes.uint32_t(0);
    let totalNumberOfFreeBytes = new ctypes.uint32_t(0);

    this._GetDiskFreeSpaceEx(
      drive,
      freeBytesAvailable.address(),
      totalNumberOfBytes.address(),
      totalNumberOfFreeBytes.address()
    );

    return {
      freeBytesAvailable:
    };
  }
};

