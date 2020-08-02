/* eslint global-require: off, no-console: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build-main`, this file is compiled to
 * `./app/main.prod.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import elog, { LevelOption } from 'electron-log';
import MenuBuilder from './menu';
import { loadGlobalConfig } from './services/config';

export default class AppUpdater {
  constructor() {
    autoUpdater.logger = elog.scope('autoUpdater');
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

  return Promise.all(
    extensions.map(name => installer.default(installer[name], forceDownload))
  ).catch(console.log);
};

const isLevelOption = (option: string | boolean): option is LevelOption => {
  if (typeof option === 'string') {
    return ['silly', 'verbose', 'debug', 'info', 'warn', 'error'].includes(
      option
    );
  }
  return option === false;
};

const createWindow = async () => {
  elog.transports.console.level =
    process.env.NODE_ENV === 'development' ? 'info' : 'warn';
  elog.transports.file.level =
    process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true'
      ? 'debug'
      : 'info';
  if (elog.transports.ipc) {
    elog.transports.ipc.level = false;
  }
  if (elog.transports.remote) {
    elog.transports.remote.level = false;
  }
  try {
    const config = await loadGlobalConfig();
    if (isLevelOption(config.content.log.console)) {
      elog.transports.console.level = config.content.log.console;
    }
    if (isLevelOption(config.content.log.file)) {
      elog.transports.file.level = config.content.log.file;
    }
    if (isLevelOption(config.content.log.ipc) && elog.transports.ipc) {
      elog.transports.ipc.level = config.content.log.ipc;
    }
    if (isLevelOption(config.content.log.remote) && elog.transports.remote) {
      elog.transports.remote.level = config.content.log.remote;
    }
  } catch (ignore) {
    // ignore
  }

  console.log(`Logging to console at level: ${elog.transports.console.level}`);
  console.log(
    `Logging to ${elog.transports.file.getFile().path} at level: ${
      elog.transports.file.level
    }`
  );

  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    webPreferences:
      process.env.NODE_ENV === 'development' || process.env.E2E_BUILD === 'true'
        ? {
            nodeIntegration: true
          }
        : {
            preload: path.join(__dirname, 'dist/renderer.prod.js')
          }
  });

  mainWindow.loadURL(`file://${__dirname}/app.html`);

  // @TODO: Use 'ready-to-show' event
  //        https://github.com/electron/electron/blob/master/docs/api/browser-window.md#using-ready-to-show-event
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('ready', createWindow);

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow();
});
