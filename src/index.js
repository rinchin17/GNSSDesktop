const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const { request } = require('http');
const path = require('path');
// for loading  File System
const fs = require('fs'); 
// for reading NMEA file
var nmeaGps = fs.createReadStream('output.nmea'); 

if (require('electron-squirrel-startup')) {
  app.quit();
}

//static declarations
let mainWindow;
let childWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    webPreferences: { nodeIntegration: true},
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
      nodeIntegration: true
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
        // console.log(sentence);
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


// ipcMain

ipcMain.on('device:setup',(event) => {
  file = 'device_setup.html';
  title = 'Device Setup';

  newWindow(title, file, 600, 500, false);
  // openFile();
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
      nodeIntegration: true
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