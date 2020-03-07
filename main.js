//应用依赖
const {app, BrowserWindow} = require('electron');
const path = require('path');


//申明全局变量
let mainWindow;
//申明创建窗口的方法
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 668,
        minHeight:668,
        minWidth:1200,
        webPreferences: {
            // preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true
        }
    });
    //mainWindow.webContents.openDevTools();
    mainWindow.loadFile('project/rendering/clientUI/index/index.html');
    mainWindow.on('closed', function () {
        console.log("关闭窗口事件");
        mainWindow = null
    })
}

app.commandLine.appendSwitch("--disable-http-cache");
app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
});
app.on('activate', function () {
    console.log("在macOS上，当单击dock图标并且没有其他窗口打开时，");
    if (mainWindow === null) {
        createWindow()
    } else {

    }
});

const ipc = require('electron').ipcMain;
//接收
ipc.on('openDevTools',function() {
    mainWindow.webContents.openDevTools();
});

ipc.on('window-max', function() {
    if (mainWindow.isMaximized()) {
        mainWindow.restore();
    } else {
        mainWindow.maximize();
    }
});

