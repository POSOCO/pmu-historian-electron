var app = require('app');  // Module to control application life.
var BrowserWindow = require('browser-window');  // Module to create native browser window.
var Menu = require('menu');
var Tray = require('tray');

//var http = require("http");
var https = require("https");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform != 'darwin') {
        app.quit();
    }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function () {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        'web-preferences': {
            'web-security': false
        },
        frame: true,
        width: 1920,
        height: 1080,
        resizable: true,
        icon: __dirname + '/favicon.ico'
    });
    mainWindow.setMenuBarVisibility(true);

    // and load the index.html of the app.
    mainWindow.loadURL('file://' + __dirname + '/index.html');

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });

    mainWindow.on('minimize', function (event) {
        event.preventDefault();
        mainWindow.hide();
    });

    mainWindow.on('close', function (event) {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
            appIcon.displayBalloon({icon:"./favicon.ico", title: "Awesome Title", content: "Awesome Content"});
            setTimeout(function () {
                appIcon.emit("balloon-closed");
            }, 500);
        }
        return false;
    });

    var contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show App', click: function () {
            mainWindow.show();
        }
        },
        {
            label: 'Quit', click: function () {
            app.isQuiting = true;
            app.quit();
        }
        }
    ]);

    var appIcon = null;
    appIcon = new Tray('./favicon.ico');

    appIcon.setToolTip('PMU Historian App');
    appIcon.setContextMenu(contextMenu);

    appIcon.on("double-click", function(){
        mainWindow.show();
    });
});

// API variables
var host_ = "172.16.183.131";
var path_ = "/eterra-ws/HistoricalDataProvider";
var port_ = 24721;
var username_ = "perf1";
var password_ = "p@ssword";

// Soap Request function
function doSoapRequest(bodyString, onResult) {
    var options = {
        host: host_,
        port: port_,
        path: path_,
        method: 'POST',
        headers: {
            'Content-Type': "application/soap+xml; charset=\"utf-8\"",
            'Authorization': "Basic " + new Buffer(username_ + ":" + password_, "utf8").toString("base64")
        }
    };
    var req = https.request(options, function (res) {
        var output = '';
        console.log(options.host + ':' + res.statusCode);
        res.setEncoding('utf8');

        res.on('data', function (chunk) {
            output += chunk;
        });

        res.on('end', function () {
            onResult(res.statusCode, output);
        });
    });

    req.on('error', function (err) {
        onResult("error", err.message);
        console.log('problem with request: ' + err.message);
    });

    // write data to request body
    req.write(bodyString);

    req.end();
}

function discoverServer() {
    var soapMessage =
        '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:dat="http://www.eterra.com/public/services/data/dataTypes">\
       <soap:Header/>\
       <soap:Body>\
          <dat:DiscoverServerRequest>?</dat:DiscoverServerRequest>\
       </soap:Body>\
    </soap:Envelope>';
    doSoapRequest(soapMessage, function (statusCode, output) {
        var str = statusCode + "---" + output
        console.log(str);
        if (mainWindow != null) {
            mainWindow.webContents.send('console-data', {message: str});
        }
    });
}

function getData() {
    var soapMessage =
        '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:dat="http://www.eterra.com/public/services/data/dataTypes">\
     <soap:Header/>\
     <soap:Body>\
        <dat:DataRequest>\
           <measurementIDList>\
              <!--Zero or more repetitions:-->\
              <measurementId>525</measurementId>\
            </measurementIDList>\
           <timeRange>\
              <startTime>2017-02-02T01:00:05.000+05:30</startTime>\
              <endTime>2017-02-02T01:00:07.000+05:30</endTime>\
           </timeRange>\
           <!--Optional:-->\
           <sampleRate>25</sampleRate>\
           <!--Optional:-->\
            < /dat:DataRequest>\
            < /soap:Body>\
           < /soap:Envelope>';
    doSoapRequest(soapMessage, function (statusCode, output) {
        var str = statusCode + "---" + output;
        console.log(str);
        if (mainWindow != null) {
            mainWindow.webContents.send('console-data', {message: str});
        }
    });
}

//ipc stuff
var ipc = require("electron").ipcMain;

ipc.on('discover-server', function (event, args) {
    discoverServer();
});

ipc.on('get-data', function (event, args) {
    getData();
});
