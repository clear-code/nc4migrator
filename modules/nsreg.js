/* Netscape Communicator 4.xのプロファイルを列挙する 
   see also: http://surf.ap.seikei.ac.jp/~nakano/diary/?200109c&to=200109276#200109276

   structure:
     0<name:max 512bytes><description:32bytes>0ProfileLocation0<path>

     description: (http://mxr.mozilla.org/seamonkey/source/modules/libreg/src/reg.h#128)
       0-3  : location
       4-7  : name
       8-9  : name length
       10-11: *type*
       12-15: left
       16-19: down
       20-23: value
       24-27: value length
       28-31: parent

     types: (http://mxr.mozilla.org/seamonkey/source/modules/libreg/src/reg.h#68)
       valid  : 0x0001
       deleted: 0x0080
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
	const TYPE_OFFSET          = 10;
	const TYPE_SIZE            = 12;
	const TYPE_DELETED         = 0x80;

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

		let description = aByteArray.slice(index - DESCRIPTION_SIZE, index);
		from = current;

		let nodeType = description.slice(TYPE_OFFSET, TYPE_SIZE);
		nodeType = nodeType[0] + (nodeType[1] << 8);
		if (nodeType & TYPE_DELETED)
			continue;

		profiles.push({ name : name, path : path });
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
