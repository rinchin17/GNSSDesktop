const { app, BrowserWindow, ipcMain, Menu, dialog, Notification } = require('electron');
const axios = require('axios')
const { request } = require('http');
const path = require('path');
const fs = require('fs'); 
var nmeaGps = fs.createReadStream('output.nmea'); 

function showNotification (title, body) {
  const notification = {
    title: title,
    body: body
  }
  new Notification(notification).show()
}

//uart
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

let port;

ipcMain.on('load:device', (event)=>{
  let available_ports = [];
  SerialPort.list().then(ports => {
    ports.forEach(function(port) {
      if(port.pnpId) {
        available_ports.push(port.path); 
      }
    });
    console.log(available_ports);
    mainWindow.webContents.send('load:device', available_ports);
  });
});



function loadUart(comp) {
    port = "";
    port = new SerialPort(comp, { baudRate: 9600 });
    
    port.on("open", () => {
      showNotification('Port opened', 'blablabla');
      //console.log('serial port open');
    });
    
    const parser = port.pipe(new Readline({ delimiter: '\n' }));

    parser.on('data', data => {
      showNotification('got word from arduino', data);
      //console.log('got word from arduino: ', data);
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
    title: 'RTK GNSS VIEWER',
    width: 800,
    height: 600,
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
  dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{name:'output', extensions: ['nmea','png','gif']}]
  }).then(result => {
      const file = result.filePaths[0];
      const fileContent = fs.readFileSync(file).toString();
      // console.log(fileContent);
      mainWindow.webContents.send('read:file', fileContent);
  }).catch(err => {
      console.log(err)
  });
}


// NMEA parsing section

readTextFile(nmeaGps, parse);

if(!String.prototype.startsWith){
    String.prototype.startsWith = function (str) {
        return !this.indexOf(str);
    }
}

function parse (sentence) {
   
    // console.log(status + " " + lat + "" + latDirection + " " + lng + "" + lngDirection);
    // console.log("http://www.google.com/maps/place/" + lat + ",-" + lng + "/@" + lat + ",-" + lng + ",17z");
    // console.log(nmea_data.longitude);
    
    mainWindow.webContents.on('did-finish-load', function () {
      mainWindow.webContents.send('parse:nmea', sentence);
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


ipcMain.on('device:setup',(event) => {
  file = 'device_setup.html';
  title = 'Device Setup';

  newWindow(title, file, 600, 500, false);
  //loadUart();
  //openFile();
});

ipcMain.on('open:download',(event) => {
  file = 'data_download.html';
  title = 'Download';

  newWindow(title, file, 400, 480, false);
});

ipcMain.on('open:settings',(event) => {
  file = 'settings.html';
  title = 'Settings';

  newWindow(title, file, 600, 350, false);
});


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
  //childWindow.maximize();
  childWindow.menuBarVisible = false;
  childWindow.loadFile(path.join(__dirname, `templates/map_tracker.html`));
});

ipcMain.on('make:command', (event, command) => {
    //send command over UART
    var command = command;
    // Read the port data

  
    port.write(command, (err) => {
      if(!err) {
        console.log('opened')
      }
      if (err) {
        showNotification('Error on write ', 'cannot open port');
        //return console.log('Error on write: ', err.message);
      }
    });
  
  // send command over wifi api
  // axios
  // .post('http://192.168.0.167:3000/command', {
  //   command: command
  // })
  // .then(res => console.log(res))
  // .catch(error => {
  //   console.error(error)
  // })
});

ipcMain.on('connect', (event, comp) => {
  if(!comp) {
    return false;
  } else {
    loadUart(comp);
  }
});