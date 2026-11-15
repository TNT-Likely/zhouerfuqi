import { AppRegistry } from 'react-native';
import { registerResyncHeadless } from './src/headless';

// Headless 任务注册必须在 bundle 顶层(系统拉起时是全新 JS 运行时)
registerResyncHeadless();

import 'expo-router/entry';
