function log(aMessage)
{
	Components 
		.classes['@mozilla.org/observer-service;1']
		.getService(Components.interfaces.nsIObserverService)
		.notifyObservers(null, 'log', '[migration] '+aMessage);
}
log('migration start');

var mailDir = window.arguments[0]
		.QueryInterface(Components.interfaces.nsIPropertyBag)
		.getProperty('mailDir');
var source = Components
		.classes['@mozilla.org/file/local;1']
		.createInstance(Components.interfaces.nsILocalFile);
source.initWithPath(mailDir);

var gService = Components
		.classes['@mozilla.org/import/import-service;1']
		.getService(Components.interfaces.nsIImportService);
var gModule;
var moduleName = Components 
		.classes['@mozilla.org/intl/stringbundle;1']
		.getService(Components.interfaces.nsIStringBundleService)
		.createBundle('chrome://messenger/locale/comm4xMailImportMsgs.properties')
		.GetStringFromName('2000');
for (var i = 0, maxi = gService.GetModuleCount('mail'); i < maxi; i++)
{
	gModule = gService.GetModule('mail', i);
	if (gModule.name == moduleName)
		break;
}

var shouldGoNext = false;
var timer = null;

var success = Components
		.classes['@mozilla.org/supports-string;1']
		.createInstance(Components.interfaces.nsISupportsString);
var error = Components
		.classes['@mozilla.org/supports-string;1']
		.createInstance(Components.interfaces.nsISupportsString)

function doImport(aImporter, aThirdArg)
{
log('doImport');
	if (aImporter.WantsProgress()) {
log('progressive');
		if (aImporter.BeginImport(success, error, aThirdArg)) {
log('start');
			timer = window.setInterval(checkGoNext, 100, aImporter);
		}
		else {
log('finish');
			shouldGoNext = true;
		}
	}
	else {
log('not progressive');
		aImporter.BeginImport(success, error, aThirdArg);
log('finish');
		shouldGoNext = true;
	}
}

function checkGoNext(aImporter)
{
	if (aImporter.ContinueImport() &&
		aImporter.GetProgress() < 100)
		return;
	shouldGoNext = true;
	window.clearInterval(timer);
}

function importerGenerator()
{
log('importerGenerator');
	var importer = gModule
		.GetImportInterface('mail')
		.QueryInterface(Components.interfaces.nsIImportGeneric);
	shouldGoNext = false;

log('importer:'+importer);
	importer.SetData('mailLocation', source);

	window.setTimeout(doImport, 0, importer);
	while (!shouldGoNext)
	{
		yield;
	}
log('importerGenerator:finish');
}


var imporeter = importerGenerator();

function onImportProgress() 
{
	try {
		imporeter.next();
	}
	catch(e) {
		window.close();
	}
}

window.setInterval(onImportProgress, 100);
