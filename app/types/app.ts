export interface MenuItem {
  name: string;
  icon: string;
  path: string;
  params?: object;
  pathWithParams: string;
  id: string;
}
export interface MenuCategory {
  name: string;
  items: Array<MenuItem>;
  id: string;
}

export enum NotificationType {
  SUCCESS = 'success',
  INFO = 'info',
  WARN = 'warning',
  ERROR = 'error'
}
export interface Notification {
  type: NotificationType;
  message: string;
  timestamp: number;
  id: string;
  seen: boolean;
}
