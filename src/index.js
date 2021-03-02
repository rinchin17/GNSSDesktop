const { app, BrowserWindow, ipcMain } = require('electron');
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

function createNewWindow(title, file) {
  childWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    },
    title: title,
    width: 400,
    height: 200,
    parent: mainWindow,
    resizable: false
  });
  childWindow.loadFile(path.join(__dirname, `templates/${file}`));
}

ipcMain.on('open:device',(event) => {
  let file;
  let title;
  if (request === 'open:device') {
    file = 'index.html';
    title= 'Device Name';
  }
  createNewWindow(title, file);
});