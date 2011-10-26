/* Netscape Communicator 4.xのプロファイルを列挙する 
   see also: http://surf.ap.seikei.ac.jp/~nakano/diary/?200109c&to=200109276#200109276

   structure:
     0<name><32bytes>0ProfileLocation0<path>
   (32 = DESC_SIZE, defined on
    http://mxr.mozilla.org/mozilla1.8/source/modules/libreg/src/reg.h)
   if it is a deleted profile, it has "...0Temporary0Deleted0" following the part above.
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
	for (let i in aByteArray)
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

	var profileService, availableProfiles;
	try {
		profileService = Components
			.classes['@mozilla.org/comm4xProfile;1']
			.createInstance(Components.interfaces.nsIComm4xProfile);
		availableProfiles = profileService.getProfileList({});
	}
	catch(e) {
	}

	var profiles = [];
	var from = 0;
	var index;
	while ((index = string.indexOf('\n'+PROFILE_LOCATION_KEY+'\n', from)) > -1)
	{
		if (index < DESCRIPTION_SIZE+PADDING_SIZE+1) {
			from = index+PADDING_SIZE+PROFILE_LOCATION_KEY.length+PADDING_SIZE;
			continue;
		}
		let current = index+PADDING_SIZE+PROFILE_LOCATION_KEY.length+PADDING_SIZE;
		let endPoint = string.indexOf('\n', current);
		if (endPoint < 0) {
			break;
		}

		from = endPoint+1;

		let path = string.substring(current, endPoint);
		if (!path)
			continue;

		let part = string.substring(0, index-DESCRIPTION_SIZE);
		let name = part.substring(part.lastIndexOf('\n')+1);
		if (!name)
			continue;

		string = string.substring(string.indexOf('\n', current));
		from = 0;

		let mayBeDeleted = string.match(/\nDeleted(?:\n|$)/);
		let deleted = false;
		if (mayBeDeleted) {
			let deletedFlagPosition = string.indexOf(mayBeDeleted[0]);
			let nextProfilePosition = string.indexOf('\n'+PROFILE_LOCATION_KEY+'\n');
			if (nextProfilePosition < 0) {
				deleted = deletedFlagPosition > -1;
			}
			else if (deletedFlagPosition > -1) {
				deleted = deletedFlagPosition < nextProfilePosition;
			}
			if (deleted)
				string = string.substring(deleted);
		}

		if (!deleted && availableProfiles) {
			for (let i in availableProfiles) // exclude removed profiles
			{
				if (availableProfiles[i] == name) {
					profiles.push({ name : name, path : path });
					break;
				}
			}
		}

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
