/* Registory parser for Netscape Communicator 4.5 and later
   see also:
     * http://surf.ap.seikei.ac.jp/~nakano/diary/?200109c&to=200109276#200109276
     * http://mxr.mozilla.org/seamonkey/source/modules/libreg/src/reg.h
     * http://mxr.mozilla.org/seamonkey/source/modules/libreg/src/reg.c
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
		let file = DirectoryService.get('WinD', Components.interfaces.nsIFile);
		file.append('nsreg.dat');
		if (file.exists()) {
log('nsreg.dat exists');
			let bytes = readBinaryFrom(file);
			return getProfilesFromBinary(bytes);
		}
	}
	catch(e) {
log(e);
	}
log('no profile is found');
	return [];
}

function getProfilesFromBinary(aBytes) 
{
log('getProfilesFromBinary');
	var root = getRootDescription(aBytes);
	var users = root.getNamedChild('Users').children;
	var profiles = users.map(function(aUserNode) {
			return {
				name : aUserNode.name,
				path : aUserNode.nodeValue.stringValue
			};
		});
	profiles.sort(function(aA, aB) {
		return aA.name > aB.name;
	});
log(profiles.length+' profiles found from the registory');
	return profiles;
}

function getRootDescription(aBytes)
{
	const ROOT_LOCATION        = 0xC;
	const ROOT_LOCATION_LENGTH = 4;
	var root = aBytes.slice(ROOT_LOCATION, ROOT_LOCATION + ROOT_LOCATION_LENGTH - 1);
	return new Description(aBytes, bytesToNumber(root));
}

function Description(aBytes, aOffset)
{
	this.allBytes = aBytes;
	this.bytes = aBytes.slice(aOffset, aOffset + this.DESCRIPTION_SIZE);

	this.location = bytesToNumber(this.bytes.slice(0, 3));
	if (this.location != aOffset)
		throw new Error('invalid description at '+aOffset);

	this.type = bytesToNumber(this.bytes.slice(10, 11));

	this._left   = bytesToNumber(this.bytes.slice(12, 15));
	this._down   = bytesToNumber(this.bytes.slice(16, 19));
	this._parent = bytesToNumber(this.bytes.slice(28, 31));

	var nameOffset = bytesToNumber(this.bytes.slice(4, 7));
	var nameLength = bytesToNumber(this.bytes.slice(8, 9));
	this.name = bytesToString(this.allBytes.slice(nameOffset, nameOffset + nameLength));

	this._valueOffset = bytesToNumber(this.bytes.slice(20, 23));
	this._valueLength = bytesToNumber(this.bytes.slice(24, 27));
}
Description.prototype = {
	DESCRIPTION_SIZE : 32,
	TYPE_DELETED     : 0x80,

	get next()
	{
		if (this._left && !this._leftDescription)
			this._leftDescription = new Description(this.allBytes, this._left);
		return this._leftDescription && !this._leftDescription.deleted ? this._leftDescription : null ;
	},
	get firstChild()
	{
		if (this._down && !this._firstChildDescription)
			this._firstChildDescription = new Description(this.allBytes, this._down);
		return this._firstChildDescription && !this._firstChildDescription.deleted ? this._firstChildDescription : null ;
	},
	get parent()
	{
		if (this._parent && !this._parentDescription)
			this._parentDescription = new Description(this.allBytes, this._parent);
		return this._parentDescription && !this._parentDescription.deleted ? this._parentDescription : null ;
	},
	get children()
	{
		if (!this._children) {
			let child = this.firstChild;
			this._children = [];
			let found = [];
			while (child)
			{
				if (!child.deleted && found.indexOf(child.location) < 0) {
					this._children.push(child);
					found.push(child.location);
				}
				child = child.next;
			}
		}
		return this._children;
	},
	get value()
	{
		return this.nodeValue || this.stringValue;
	},
	get stringValue()
	{
		if (typeof this._stringValue == 'undefined')
			this._stringValue = bytesToString(this.allBytes.slice(this._valueOffset, this._valueOffset + this._valueLength));
		return this._stringValue;
	},
	get nodeValue()
	{
		if (typeof this._nodeValue == 'undefined') {
			try {
				this._nodeValue = new Description(this.allBytes, this._valueOffset);
			}
			catch(e) {
				this._nodeValue = null;
			}
		}
		return this._nodeValue;
	},
	getNamedChildren : function(aName)
	{
		return this.children.filter(function(aChild) {
				return aChild.name == aName;
			});
	},
	getNamedChild : function(aName)
	{
		var found = null;
		this.children.some(function(aChild) {
			if (aChild.name == aName)
				found = aChild;
			return found;
		}, this);
		return found;
	},
	get deleted()
	{
		return this.type & this.TYPE_DELETED;
	}
};


const OCTET_SIZE = 8;

function bytesToNumber(aBytes)
{
	var converted = 0;
	aBytes.forEach(function(aValue, aIndex) {
		converted += (aValue << (aIndex * OCTET_SIZE));
	});
	return converted;
}

function bytesToString(aBytes)
{
	var converted = '';
	aBytes.some(function(aValue, aIndex) {
		if (!aValue)
			return true;
		converted += String.fromCharCode(aValue);
		return false;
	});
	return UTF8toUCS2(converted);
}

function UTF8toUCS2(aUTF8Octets)
{
	return decodeURIComponent(escape(aUTF8Octets));
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
	var bytes = binaryStream.readByteArray(fileStream.available());
	binaryStream.close();
	fileStream.close();
log('data size: '+bytes.length+' bytes');
	return bytes;
}
