const { app, BrowserWindow, ipcMain, Menu, dialog, Notification } = require('electron');
const axios = require('axios')
const { request} = require('http');
const path = require('path');
const fs = require('fs'); 
var md5 = require('md5');
var wifi = require('node-wifi');

var connType = 0;

//load wifi
ipcMain.on('load:wifi', (event)=>{  
	wifi.init({
		iface: null // network interface, choose a random wifi interface if set to null
	});
  
  
  // Scan networks
	wifi.scan((error, networks) => {
		if (error) {
			console.log(error);
		} 
		else {
			available_wifi = [];
			for(var i = 0; i<networks.length;i++){
				available_wifi.push(networks[i].ssid);
			}
			mainWindow.webContents.send('load:wifi',available_wifi);
		}
	});
  // All functions also return promise if there is no callback given
	wifi
	.scan()
	.then(networks => {
		// networks
	})
	.catch(error => {
		console.log("Oops! "+error);
	});
});

function showNotification (title, body) {
	const notification = {
		title: title,
		body: body
	}
	new Notification(notification).show()
}

function sendNmea(data) {
	mainWindow.webContents.send('parse:nmea', data);
}
//uart
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

let port;

//load devices
ipcMain.on('load:device', (event)=>{
	let available_ports = [];
	SerialPort.list().then(ports => {
	ports.forEach(function(port) {
		if(port.pnpId.substr(0,3) === 'USB') {
			available_ports.push(port.path); 
			console.log(port.pnpId.substr(0,3));
		}
	});
	console.log(available_ports);
	mainWindow.webContents.send('load:device', available_ports);
	});
});

// connecting to network via WiFi
function connectWifi(net_ssid, password) {
	disconnect();
	wifi.connect({ ssid: net_ssid, password: password }, error => {
		if (error) {
			console.log("Could not connect to "+net_ssid+" "+error);
			showNotification("Could not connect to "+net_ssid,error);
			connType = 0;
		}
		else{
			console.log('Connected to: ' + net_ssid);
			showNotification('Connected to: ', net_ssid);
			connType = 1;
		}
		console.log(connType);
	});
}

function disconnect() {
	if (connType == 1){
		wifi.disconnect(error => {
			if (error) {
				console.log(error);
			} else {
				connType = 0;
				console.log('Disconnected');
				showNotification('Disconnected','Wifi connection closed ');
			}
		});
	}
	if (connType == 2){
		port.close(() => {
			connType = 0;
			showNotification('Disconnected','Serial connection closed ')
		});
	}
	console.log(connType);
}

// opening the UART channel
function loadUart(comp, baudRate) {
	disconnect();
	port = "";

	port = new SerialPort(comp, {
		baudRate: parseInt(baudRate),
		dataBits: 8,
		parity: 'none',
		stopBits: 1,
		flowControl: true,
		usePromises: true,
	});
	
	port.on("open", () => {
		connType = 2;
		showNotification('Port opened with Baud Rate = '+baudRate);
		console.log('Port opened with Baud Rate = '+baudRate);
		console.log(connType);
	});
	
	const parser = port.pipe(new Readline({ delimiter: '\r\n' }));

	parser.on('data', async data => {
		await sendNmea(data);
		//parse(data);
		
		//console.log('\nData : ', data);
		
		//var daten = [];
		//daten = data.toString('hex');
		//console.log('\nData no hex : ', daten);
		//setState('Waterkotte.Daten.Rohdaten', daten & 0xFF, true);
		
		//showNotification('Response from ESP-32: ', data);
	});
}

//uart
if (require('electron-squirrel-startup')) {
	app.quit();
}

//static declarations
let mainWindow;
let childWindow;

const createWindow = () => {
	mainWindow = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false
		},
		title: 'EZRTK',
		width: 900,
		height: 700,
		resizable: false,
		//frame: false,
		movable: true,
		transparent: true
	});
	mainWindow.menuBarVisible = false;
	mainWindow.loadFile(path.join(__dirname, 'templates/index.html')); 
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

function newWindow(title, file, width, height, resizable) {
	childWindow = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false
		},
		title: title,
		width: width,
		height: height,
		parent: mainWindow,
		modal: true,
		resizable: resizable
	});
	childWindow.menuBarVisible = false;
	childWindow.loadFile(path.join(__dirname, `templates/${file}`));
}

// for selecting a file to read
function openFile(){
	dialog.showOpenDialog(childWindow, {
		properties: ['openFile'],
		filters: [{extensions: ['json']}]
	}).then(result => {
		const file = result.filePaths[0];
		console.log(file);
		const fileContent = fs.readFileSync(file).toString();
		childWindow.webContents.send('read:file', fileContent);
	}).catch(err => {
		console.log(err)
	});
}

// NMEA parsing section
//readTextFile(nmeaGps, parse);

if(!String.prototype.startsWith){
	String.prototype.startsWith = function (str) {
		return !this.indexOf(str);
	}
}

function parse(sentence) {
	console.log(sentence);
	mainWindow.webContents.on('did-finish-load', function () {
		mainWindow.webContents.send('parse:nmea', "jasdfh");
	});  
}

function readTextFile(input, parse) {
	var remaining = '';

	input.on('data', function(data) {
		remaining += data;
		var index = remaining.indexOf('\n');
		while (index > -1) {
			var line = remaining.substring(0, index);
			remaining = remaining.substring(index + 1);
			if(line.startsWith("$GPRMC")) {
				parse(line);
			}
			index = remaining.indexOf('\n');
		}
	});

	input.on('end', function() {
		if (remaining.length > 0 && remaining.startsWith("$GPRMC")) {
			parse(remaining);
		}
	});
}

//device setup window
ipcMain.on('device:setup',(event) => {
	file = 'device_setup.html';
	title = 'Device Setup';

	newWindow(title, file, 600, 500, false);
});

//download window
ipcMain.on('open:download',(event) => {
	file = 'data_download.html';
	title = 'Download';

	newWindow(title, file, 600, 550, false);
});

//settings window
ipcMain.on('open:settings',(event) => {
	file = 'settings.html';
	title = 'Settings';

	newWindow(title, file, 600, 350, false);
});

//file browse call
ipcMain.on('show:browse', (event) => {
	openFile();
});

//map window
ipcMain.on('open:map',(event) => {  
	childWindow = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false
		},
		title: 'Map Tracker',
		width: 800,
		height:580,
		parent: mainWindow,
		modal: true
	});
	childWindow.maximize();
	childWindow.menuBarVisible = false;
	childWindow.loadFile(path.join(__dirname, `templates/map_tracker.html`));
});

//file browse window
ipcMain.on('browse:logs', (event) => {
	dialog.showOpenDialog({
		properties: ['openFile', 'multiSelections']
	}, (files, err) => {
		if(files) console.log(files);
		else console.log(err);
	});
});

//send command
ipcMain.on('make:command', (event, command) => {
	var command = command;

	if (command.length <= 0) {
		showNotification('Command Error!', "Empty string");
		console.log('empty command');
	}

	command = command + md5(command);
	//send command over UART
	if(connType == 2)
		sendOverUart(command);
	if(connType == 1)
		sendOverWifi(command);
});

// opening serial port with baudRate
ipcMain.on('connect_serial', (event, serial_details) => {
	comp = serial_details[0];
	baudRate = serial_details[1];
	if(!serial_details) {
		return false;
	} else {
		loadUart(comp, baudRate);    
	}
});

// connecting wifi
ipcMain.on('connect_wifi', (event, wifi_details) => {
	var ssid = wifi_details[0];
	var password = wifi_details[1];
	if(!wifi_details) {
		return false;
	} else {
		connectWifi(ssid,password);
	}
});

//disconnect network or serial
ipcMain.on('conn:close', (event) => {
	disconnect();
});

//check uart status to enable or disable live data
ipcMain.on('uart:status', (event) => {
	if (connType != 2) {
		const messageBoxOptions = {
			type: "error",
			title: "Serial Port Closed",
			message: "Please change conenction mode to Serial to view Live Feed"
		};
		dialog.showMessageBox(messageBoxOptions);
		childWindow.webContents.send('uart:status', false);
	} else {
		childWindow.webContents.send('uart:status', true);
	}
});

function sendOverWifi(command) {
	axios.get(`http://192.168.0.196/command/${command}`)
	.then(response => {
		showNotification('Command sent Via Wi-Fi');
		showNotification('Response from EZRTK', response.data);
	})
	.catch(error => {
		showNotification('Response from EZRTK', 'Some error occured!!!');
		console.log(error);
	});
}

function sendOverUart(command) {
	port.write(command, (err) => {
		if(!err) {
			showNotification('Command sent Via UART : ', command);
			console.log('Command sent Via UART: ', command);
		} else {
			showNotification('Error on write ', 'cannot open port');
			console.log('Error on write: ', err.message);
		}
	});
}