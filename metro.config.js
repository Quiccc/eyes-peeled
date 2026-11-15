// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const outside = ['yolo', 'server', 'admin'];

// The backend, YOLO service and admin panel live next to the app but aren't part of it. Keep Metro
// from crawling and watching them (yolo/.venv alone holds tens of thousands of PyTorch files).
// Project-relative directory patterns, the same form Expo uses for ios/Pods and android build folders.
const blockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(blockList) ? blockList : blockList ? [blockList] : []),
  new RegExp(`^(?:${outside.join('|')})$`),
  // Absolute paths too, for the resolver.
  ...outside.map((dir) => new RegExp(`^${escape(path.join(__dirname, dir) + path.sep)}`)),
];

module.exports = config;
