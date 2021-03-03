const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const { request } = require('http');
const path = require('path');

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
    resizable: false
  });

  // mainWindow.menuBarVisible = false;
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

function newWindow(title, file) {
  childWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    },
    title: title,
    width: 600,
    height: 500,
    parent: mainWindow,
    resizable: false
  });
  childWindow.loadFile(path.join(__dirname, `templates/${file}`));
}


ipcMain.on('device:setup',(event) => {
  file = 'device_setup.html';
  title = 'Device Setup';
  
  newWindow(title, file);
});

