/* Netscape Communicator 4.xのプロファイルを列挙する 
   see also: http://surf.ap.seikei.ac.jp/~nakano/diary/?200109c&to=200109276#200109276

   structure:
     0<name><32bytes>0ProfileLocation0<path>
   (32 = DESC_SIZE, defined on
    http://mxr.mozilla.org/mozilla1.8/source/modules/libreg/src/reg.h)
*/

var EXPORTED_SYMBOLS = ["getProfiles"];

function log(aMessage)
{
	Components 
		.classes['@mozilla.org/observer-service;1']
		.getService(Components.interfaces.nsIObserverService)
		.notifyObservers(null, 'log', '[nsreg] '+aMessage);
}

function getProfiles() 
{
log('getProfiles');
	try {
		const DirectoryService = Components
				.classes['@mozilla.org/file/directory_service;1']
				.getService(Components.interfaces.nsIProperties);
		var file = DirectoryService.get('WinD', Components.interfaces.nsIFile);
		file.append('nsreg.dat');
		if (file.exists()) {
log('nsreg.dat exists');
			var array = readBinaryFrom(file);
			return getProfilesFromBinary(array);
		}
	}
	catch(e) {
log(e);
	}
log('no profile is found');
	return [];
}

function getProfilesFromBinary(aByteArray) 
{
log('getProfilesFromBinary');
	var string = '';
	var octet;
	for (var i in aByteArray)
	{
		octet = aByteArray[i];
		string += (
				octet == 0 ? '\n' :
				octet < 0x20 ? '\t' :
				String.fromCharCode(octet)
			);
	}

	const PROFILE_LOCATION_KEY = 'ProfileLocation';
	const DESCRIPTION_SIZE     = 32;
	const PADDING_SIZE         = 1;

	var profileService = Components
			.classes['@mozilla.org/comm4xProfile;1']
			.createInstance(Components.interfaces.nsIComm4xProfile);
	var availableProfiles = profileService.getProfileList({});

	var profiles = [];
	var from = 0;
	var index;
	while ((index = string.indexOf('\n'+PROFILE_LOCATION_KEY+'\n', from)) > -1)
	{
		if (index < DESCRIPTION_SIZE+PADDING_SIZE+1) {
			from = index+PADDING_SIZE+PROFILE_LOCATION_KEY.length+PADDING_SIZE;
			continue;
		}
		var current = index+PADDING_SIZE+PROFILE_LOCATION_KEY.length+PADDING_SIZE;
		var endPoint = string.indexOf('\n', current);
		if (endPoint < 0) {
			break;
		}
		var path = string.substring(current, endPoint);
		if (!path) {
			from = endPoint+1;
			continue;
		}
		var part = string.substring(0, index-DESCRIPTION_SIZE);
		var name = part.substring(part.lastIndexOf('\n')+1);
		if (!name) {
			from = endPoint+1;
			continue;
		}
		for (var i in availableProfiles) // exclude removed profiles
		{
			if (availableProfiles[i] == name) {
				profiles.push({ name : name, path : path });
				break;
			}
		}
		string = string.substring(string.indexOf('\n', current));
		from = 0;
	}
log(profiles.length+' profiles found from the registory');
	return profiles;
}

function readBinaryFrom(aFile) 
{
log('readBinaryFrom');
	var fileStream = Components
			.classes['@mozilla.org/network/file-input-stream;1']
			.createInstance(Components.interfaces.nsIFileInputStream);
	fileStream.init(aFile, 1, 0, false);
	var binaryStream = Components
			.classes['@mozilla.org/binaryinputstream;1']
			.createInstance(Components.interfaces.nsIBinaryInputStream);
	binaryStream.setInputStream(fileStream);
	var array = binaryStream.readByteArray(fileStream.available());
	binaryStream.close();
	fileStream.close();
log('data size: '+array.length+' bytes');
	return array;
}
