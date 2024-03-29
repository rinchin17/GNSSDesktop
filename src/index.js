const { app, BrowserWindow, ipcMain, Menu, dialog, Notification, globalShortcut } = require('electron');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
var md5 = require('md5');
var wifi = require('node-wifi');
// static declarations
var connType = 0;
let mainWindow;
let childWindow;
let mapWindow;
let downloadWindow;
let deviceSetupWindow;
var hotSpotIP = "192.168.4.1";
var IPAddress = hotSpotIP;
var ch = 0;
var rtkType = 0, net_conn = 0;
var read_ssid, read_password, ssid_net;
var nmea = "";
var logMode = false;
var logs = [];
var filename = null;
var GPS = require('gps');
var gps = new GPS;
var coordinates;

gps.on('data', data => {
	coordinates = gps.state;
	if (logMode) {
		logs.push(coordinates);
	}
	coordinates.nmea = nmea;
	if (mapWindow != null) {
		// console.log(coordinates);
		mapWindow.webContents.send('live:feed', coordinates);
	}
	mainWindow.webContents.send('parse:nmea', coordinates);
	//console.log(data, gps.state);
});
// load wifi
ipcMain.on('load:wifi', (event) => {
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
			for (var i = 0; i < networks.length; i++) {
				available_wifi.push(networks[i].ssid);
			}
			mainWindow.webContents.send('load:wifi', available_wifi);
		}
	});

	// All functions also return promise if there is no callback given
	wifi
		.scan()
		.then(networks => {
			// networks
		})
		.catch(error => {
			console.log("Oops! " + error);
		});
});
// Disconnect Wi-Fi connections
ipcMain.on('disconnect', (event) => {
	wifi.init({
		iface: null // network interface, choose a random wifi interface if set to null
	});
	disconnect();
});
function showNotification(title, body) {
	const notification = {
		title: title,
		body: body
	}
	new Notification(notification).show()
}
function sendNmea(data) {
	try {
		gps.update(data);
	} catch (e) { }
}
// uart
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
let port;
// load devices
ipcMain.on('load:device', (event) => {
	let available_ports = [];
	SerialPort.list().then(ports => {
		ports.forEach(function (port) {
			if (port.pnpId.substr(0, 3) === 'USB') {
				available_ports.push(port.path);
				console.log(port.pnpId.substr(0, 3));
			}
		});
		console.log(available_ports);
		mainWindow.webContents.send('load:device', available_ports);
	});
});
// connecting to network via WiFi
function connectWifi(net_ssid, password) {
	wifi.init({
		iface: null // network interface, choose a random wifi interface if set to null
	});

	disconnect();
	
	wifi.connect({ ssid: net_ssid, password: password }, error => {
		if (error) {
			console.log("Could not connect to " + net_ssid + " " + error);
			showNotification("Could not connect to " + net_ssid, error);

			mainWindow.webContents.send('status:wifi', false);
		}
		else {
			connType = 1;
			// if Wi-Fi is hotspot of EZRTK, update IP
			if(net_ssid.startsWith("EZRTK")){
				IPAddress = "192.168.4.1";
			}
			mainWindow.webContents.send('status:wifi', true);
			mainWindow.webContents.send('status:serial', false);
			console.log('Connected to: ' + net_ssid + ' Conntype = ' + connType);
			showNotification('Connected to: ', net_ssid);
			
			var timer = setInterval(function () {
				console.log("conn type inside interval = "+connType);
				if (connType != 1) {
					console.log("CONN_TYPE!=1 = "+connType);
					clearInterval(timer);
					
				}
				else {
					axios.get(`http://${IPAddress}/livedata`)
						.then(response => {
							var c = response.data.toString().split("\r\n");
							for (var x of c) {
								nmea = x;
								sendNmea(x);
							}
							console.log('Response from EZRTK' + response.data);
						})
						.catch(error => {
							// showNotification('Response from EZRTK', 'Some error occured!!!');
							console.log(error);
						});
				}
			}, 2000);
		}
	});
}
function disconnect() {
	if (connType == 1) {
		wifi.disconnect(error => {
			if (error) {
				console.log(error);
			} else {
				connType = 0;
				console.log('Disconnected Wi-Fi. Conntype = ' + connType);
				showNotification('Disconnected', 'Wifi connection closed');
			}
		});
	}
	if (connType == 2) {
		port.close(error => {
			if(error) console.log(error);
			port = null;
			connType = 0;
			console.log('Disconnected Serial. Conntype = ' + connType);
			showNotification('Disconnected', 'Serial connection closed ');
		});
	}
	else{
		console.log('None: ConnType is ' + connType);
	}
	console.log(connType);
}
// opening the UART channel
function loadUart(comp, baudRate) {
	disconnect();
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
		showNotification('Port opened with Baud Rate = ' + baudRate);
		console.log('Port opened with Baud Rate = ' + baudRate);
		mainWindow.webContents.send('status:serial', true);
		mainWindow.webContents.send('status:wifi', false);
		console.log(connType);
	});

	let parser = port.pipe(new Readline({ delimiter: '\r\n' }));

	parser.on('data', async data => {

		if (ch == 1) {
			IPAddress = data;
			showNotification('IP = ' + IPAddress);
			console.log("IP Address = " + IPAddress);
			ch = 0;
			connectWifi(read_ssid, read_password);
		}
		if (data == 'IP Address: ') {
			ch = 1;
		}
		try {
			nmea = data;
			await sendNmea(data);
		}
		catch (err) {
			console.log(err);
		}

		// $EZ_RTK|SET-WIFI|Rinchin|airbud17
		// $EZ_RTK|SET-WIFI|$EZ_RTK|1234567890

	});
}
// uart
if (require('electron-squirrel-startup')) {
	app.quit();
}
const createWindow = () => {
	mainWindow = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false
		},
		title: 'EZRTK',
		width: 1200,
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
function openFile() {
	dialog.showOpenDialog(mapWindow, {
		properties: ['openFile'],
		filters: [{ extensions: ['json'] }]
	}).then(result => {
		try {
			const file = result.filePaths[0];
			console.log(file);
			var fileContent = fs.readFileSync(file).toString();
			fileContent = JSON.parse(fileContent);
			mapWindow.webContents.send('read:file', fileContent);
		} catch(e) {
			const messageBoxOptions = {
				type: "error",
				title: `Cannot open file`,
				message: `File ${file} may have been altered from source. Please re-download file.`
			};
			dialog.showMessageBox(messageBoxOptions);
		}
	}).catch(err => {
		const messageBoxOptions = {
			type: "error",
			title: `File open failed`,
			message: `File ${file} may have been altered from source or contains some incorrect data. Try again by restarting the app. If the problem remains, redownload the file`
		};
		dialog.showMessageBox(messageBoxOptions);
	});
}
if (!String.prototype.startsWith) {
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

	input.on('data', function (data) {
		remaining += data;
		var index = remaining.indexOf('\n');
		while (index > -1) {
			var line = remaining.substring(0, index);
			remaining = remaining.substring(index + 1);
			if (line.startsWith("$GPRMC")) {
				parse(line);
			}
			index = remaining.indexOf('\n');
		}
	});

	input.on('end', function () {
		if (remaining.length > 0 && remaining.startsWith("$GPRMC")) {
			parse(remaining);
		}
	});
}
//device setup window
ipcMain.on('device:setup', (event) => {
	deviceSetupWindow = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false
		},
		title: 'Device Setup',
		width: 600,
		height: 500,
		parent: mainWindow,
		modal: true
	});

	deviceSetupWindow.menuBarVisible = false;
	deviceSetupWindow.loadFile(path.join(__dirname, `templates/device_setup.html`));
});
//download window
ipcMain.on('open:download', (event) => {
	downloadWindow = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false
		},
		title: 'Download Data',
		width: 800,
		height: 580,
		parent: mainWindow,
		modal: true
	});

	downloadWindow.menuBarVisible = false;
	downloadWindow.loadFile(path.join(__dirname, `templates/data_download.html`));

});
//settings window
ipcMain.on('open:settings', (event) => {
	file = 'settings.html';
	title = 'Settings';

	newWindow(title, file, 650, 800, false);
});
// dev tools window
ipcMain.on('open:devtools', (event) => {
	file = 'devtools.html';
	title = 'Dev Tools';

	newWindow(title, file, 600, 270, false);
});
//file browse call
ipcMain.on('show:browse', (event) => {
	openFile();
});
//map window
ipcMain.on('open:map', (event) => {
	mapWindow = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false
		},
		title: 'Map Tracker',
		width: 800,
		height: 600,
		parent: mainWindow,
		modal: true,
	});
	//mapWindow.maximize();
	mapWindow.menuBarVisible = false;
	mapWindow.loadFile(path.join(__dirname, `templates/map_tracker.html`));
	mapWindow.on('closed', _ => {
		mapWindow = null;
	});
});
//file browse window
ipcMain.on('browse:logs', (event) => {
	dialog.showOpenDialog({
		properties: ['openFile', 'multiSelections']
	}, (files, err) => {
		if (files) console.log(files);
		else console.log(err);
	});
});
//live feed log
ipcMain.on('feed:log', (event, log) => {
	if (log) {
		var dt = Date().split(" ");
		console.log(dt);
		var dt1 = dt[4].split(":");
		console.log(dt1);
		filename = `EZRTK_${dt[2]}_${dt[1]}_${dt[3]}_${dt1[0]}${dt1[1]}${dt1[2]}.json`.toString();
		//filename = 'hello.json';
		//filename = `EZ_RTK_${dt[2]}_${dt[1]}_${dt[3]}_${dt[4]}.json`.toString();
		// fs.writeFile(filename, "...", function (err) {
		// 	if (err) throw err;
		// 	console.log('Saved!');
		// });
		fs.open(filename, 'w', function (err, file) {
			if (err) {
				const messageBoxOptions = {
					type: "error",
					title: "Unable to log",
					message: "Could not generate log file"
				};
				dialog.showMessageBox(messageBoxOptions);
				logMode = false;
				mainWindow.webContents.send('uart:status', false);
				throw err;
			};
			logMode = true;
			showNotification('Logging started', "");
			console.log('Saved!');
		});
	} else {
		logMode = false;
		let text = '[';
		for(l of logs) {
			text = text + `{"Time":"${l.time}","RtkStatus":"${l.fix}","Latitude":"${l.lat}","Longitude":"${l.lon}","Altitude":"${l.alt}" },`.toString();
		}
		//console.log(text);
		text = text.substring(0, text.length - 1);
		text = text + ']';
		fs.writeFile(filename, text, function (err) {
			if (err) throw err;
			showNotification('Data Logged', `Logs saved in file ${filename}`);
			filename = null;
			logMode = false;
			text = null;
			console.log('Saved!');
		});
	}
});
// sending the state of App, either Hotspot mode or Wi-FI mode
ipcMain.on('read:rtkType', (event, rtk) => {
	deviceSetupWindow.webContents.send('read:rtkType', rtkType);
	rtkType = rtk;
	// setting the state of App
	if (rtkType == 0) {
		IPAddress = hotSpotIP;
	}
});

// sending the state of Network RTK
ipcMain.on('read:net_conn', (event, net) => {
	if(IPAddress==hotSpotIP){
		// ssid_net = 'None';
		net_conn = 0;	
	}
	else{
		// ssid_net = net[1];
	}
	deviceSetupWindow.webContents.send('read:net_conn', net_conn);
});

// changing IP Address from DevTools
ipcMain.on('read:IPDevTools', (event, ip) => {
	// if (rtkType != 0) {
		IPAddress = ip;
	// }
});
// reading the last connected Wi-Fi credentials
ipcMain.on('read:credentials', (event, credentials) => {
	read_ssid = credentials.ssid_field;
	read_password = credentials.password_field;
	
	try{
		if(credentials.ip!=null){
			IPAddress = credentials.ip;
			connectWifi(read_ssid, read_password);
			net_conn = 1;
			showNotification("ip!=null","");
		}
	}
	catch(e){
		console.log(e);
	}
});
// sending Server's IP to downloadWindow
ipcMain.on('read:IPDownloadWin', (event) => {
	downloadWindow.webContents.send('read:IPDownloadWin', IPAddress);
});

// sending Server's IP to networkRTKWindow
ipcMain.on('read:IPNetworkWin', (event) => {
	deviceSetupWindow.webContents.send('read:IPNetworkWin', IPAddress);
});

//send command
ipcMain.on('make:command', (event, command) => {
	// command = command + md5(command);
	console.log('make got command: ' + command + " conntype: " + connType);
	if (command.length <= 0) {
		showNotification('Command Error!', "Empty string");
		console.log('empty command');
	}

	else {
		//send command over UART
		if (connType == 2)
			sendOverUart(command);

		//send command over Wi-Fi
		else if (connType == 1)
			sendOverWifi(command);
	}
});
// opening serial port with baudRate
ipcMain.on('connect_serial', (event, serial_details) => {
	comp = serial_details[0];
	baudRate = serial_details[1];
	if (!serial_details) {
		return false;
	} else {
		loadUart(comp, baudRate);
	}
});
function NMEAStream() {
	if (connType != 1) {
		clearInterval(timer);
	}
	axios.get(`http://${IPAddress}/livedata`)
		.then(response => {
			// showNotification('Command sent Via Wi-Fi');
			sendNmea(response.data);
			console.log('Response from EZRTK' + response.data);
		})
		.catch(error => {
			// showNotification('Response from EZRTK', 'Some error occured!!!');
			// console.log(error);
		});
}
// connecting wifi
ipcMain.on('connect_wifi', (event, wifi_details) => {
	var ssid = wifi_details[0];
	var password = wifi_details[1];
	if (!wifi_details) {
		return false;
	} else {
		connectWifi(ssid, password);
	}
});
// disconnect network or serial
ipcMain.on('conn:close', (event) => {
	disconnect();
});
const msgMainUart = "Please connect to serial or wifi channel to start logging";
const msgMapUart = "Please connect to serial or wifi channel to view live feed";
// check uart status to enable or disable live data
ipcMain.on('uart:status', (event, win) => {
	if (connType == 0) {
		if(win === 'main')
			msg = msgMainUart;
		else
			msg = msgMapUart;
		const messageBoxOptions = {
			type: "error",
			title: "Device not connected",
			message: msg
		};
		dialog.showMessageBox(messageBoxOptions);
		if (win === 'main')
			mainWindow.webContents.send('uart:status', (event, false));
		if (win === 'map')
			mapWindow.webContents.send('uart:status', false);
	} else {
		if (win === 'main')
			mainWindow.webContents.send('uart:status', true);
		if (win === 'map')
			mapWindow.webContents.send('uart:status', true);
	}
});
function sendOverWifi(command) {
	if (command.substring(0, 8) == 'connect,') {
		var sub_command = command.substring(8, command.length);
		axios.get(`http://${IPAddress}/connect/${sub_command}`)
			.then(response => {
				console.log('Command sent Via Wi-Fi: ' + sub_command);
				
				if(response.data != "Incorrect Wi-FI Credentials. Please Check!"){
					if(response.data != "0.0.0.0"){
						IPAddress = response.data;
						showNotification('Response from EZRTK', "Wi-Fi Setup Complete!"+IPAddress);
					}
					console.log('Response, IP = ' + IPAddress);
					if (response.data) {
						connectWifi(read_ssid, read_password);
						var wifi_to_setting = {read_ssid, read_password};
						deviceSetupWindow.webContents.send('update:network', wifi_to_setting);
						net_conn = 1;
						var timer = setInterval(function () {
							if (connType != 1) {
								clearInterval(timer);
							}
							else {
								axios.get(`http://${IPAddress}/livedata`)
									.then(response => {
										var c = response.data.toString().split("\r\n");
										for (var x of c) {
											nmea = x;
											sendNmea(x);
										}
										console.log('Response from EZRTK' + response.data);
									})
									.catch(error => {
										// showNotification('Response from EZRTK', 'Some error occured!!!');
										// console.log(error);
									});
							}
						}, 2000);
					}
				}
				else{
					showNotification('Response from EZRTK', "Command Failed!\n1. Please check Wi-Fi credentials."+"\n"+"2. Make sure the Wi-Fi network is in range."+"\n"+"Reset your ESP & App, try again.");
				}
					
				
			})
			.catch(error => {
				showNotification('Response from EZRTK', 'Some error occured!!!');
				console.log(error);
			});
	}
	else {
		axios.get(`http://${IPAddress}/command/${command}`)
			.then(response => {
				console.log('Command sent Via Wi-Fi: ' + command);
				console.log('Response from EZRTK: ' + response.data);
			})
			.catch(error => {
				showNotification('Response from EZRTK', 'Some error occured!!!');
				console.log(error);
			});
	}
}
function sendOverUart(command) {
	if (command.substring(0, 8) == 'connect,') {
		command = command.substring(8, command.length);
	}
	port.write(command, (err) => {
		if (!err) {
			showNotification('Command sent Via UART : ', command);
			console.log('Command sent Via UART: ', command);
		} else {
			showNotification('Error on write ', 'cannot open port');
			console.log('Error on write: ', err.message);
		}
	});
}