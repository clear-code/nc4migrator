/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = ["getDiskSpace"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

Components.utils.import("resource://gre/modules/ctypes.jsm");

// http://msdn.microsoft.com/en-us/library/aa383751%28v=vs.85%29.aspx
const BOOL            = ctypes.int;
const WCHAR           = new ctypes.ArrayType(ctypes.jschar);
const LPCWSTR         = WCHAR.ptr;
const LPCTSTR         = LPCWSTR;
// http://msdn.microsoft.com/en-us/library/aa383742%28v=vs.85%29.aspx
const ULONGLONG       = ctypes.uint64_t;
const ULARGE_INTEGER  = ULONGLONG;
const PULARGE_INTEGER = ULARGE_INTEGER.ptr;

function getDiskSpace(aDirectory) {
  const kernel32 = ctypes.open("kernel32.dll");

  // http://msdn.microsoft.com/ja-jp/library/cc429308.aspx
  const GetDiskFreeSpaceEx = kernel32.declare(
          "GetDiskFreeSpaceExW",
          ctypes.winapi_abi,
          BOOL,
          ctypes.voidptr_t, // LPCTSTR // directory name
          PULARGE_INTEGER,  // available free bytes
          PULARGE_INTEGER,  // total bytes
          PULARGE_INTEGER   // total free bytes
        );

  var directory = new WCHAR(aDirectory.path.split(""));
  var availFree = new ULARGE_INTEGER(0);
  var total     = new ULARGE_INTEGER(0);
  var totalFree = new ULARGE_INTEGER(0);

  var result = GetDiskFreeSpaceEx(directory.address(), availFree.address(), total.address(), totalFree.address());
  if (!result)
    return -1;

  var returnValue = availFree.value;

  kernel32.close();

  return returnValue;
}

