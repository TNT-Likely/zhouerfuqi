import { Platform } from 'react-native';
import { notifyKitGateway } from './notifyKit';
import type { AlarmGateway } from './types';

// [M2] iOS 将在此装配 AlarmKit 实现(<26 走通知降级);接口不变
export const gateway: AlarmGateway =
  Platform.OS === 'android' ? notifyKitGateway : notifyKitGateway;
