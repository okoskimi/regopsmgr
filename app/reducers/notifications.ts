import { v4 as uuidv4 } from 'uuid';
import { useSnackbar } from 'notistack';

import { useDispatch } from 'react-redux';
import {
  Dispatch,
  Notification,
  NotificationState,
  NotificationType
} from './types';

export type NotificationAction =
  | {
      type: 'NEW_CLOSED_NOTIFICATION';
      payload: Notification;
    }
  | {
      type: 'NEW_NOTIFICATION';
      payload: Notification;
    }
  | {
      type: 'REMOVE_NOTIFICATION';
      payload: string;
    }
  | {
      type: 'MARK_NOTIFICATION_AS_SEEN';
      payload: string;
    }
  | {
      type: 'MARK_AS_SEEN_ALL_SINCE';
      payload: number;
    };

export const useNotification = () => {
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useDispatch();
  const notify = (variant: NotificationType, message: string) => {
    const timestamp = Date.now();
    const key = uuidv4();
    console.log('Notifying', variant, message);
    enqueueSnackbar(message, {
      variant,
      key,
      autoHideDuration: variant === NotificationType.ERROR ? 5000 : 3000,
      onClose: (_event, reason: string) => {
        console.log('Got onClose for', message, 'with', reason);
        dispatch({
          type: 'NEW_NOTIFICATION',
          payload: {
            type: variant,
            message,
            timestamp,
            id: key,
            seen: false
          }
        });
      }
    });
  };
  return {
    info: (message: string) => {
      notify(NotificationType.INFO, message);
    },
    success: (message: string) => {
      notify(NotificationType.SUCCESS, message);
    },
    warn: (message: string) => {
      notify(NotificationType.WARN, message);
    },
    error: (message: string) => {
      notify(NotificationType.ERROR, message);
    },
    message: (variant: NotificationType, message: string) => {
      notify(variant, message);
    }
  };
};

export type Notifier = ReturnType<typeof useNotification>;

export const addNotification = (type: NotificationType, message: string) => ({
  type: 'NEW_NOTIFICATION',
  payload: {
    type,
    message,
    timestamp: Date.now(),
    id: uuidv4(),
    seen: false
  }
});

export const removeNotification = (id: string) => ({
  type: 'REMOVE_NOTIFICATION',
  payload: id
});

export const markNotificationAsSeen = (id: string) => ({
  type: 'MARK_NOTIFICATION_AS_SEEN',
  payload: id
});

export const markAllAsSeen = (delay = 0) => {
  const action = {
    type: 'MARK_AS_SEEN_ALL_SINCE',
    payload: Date.now()
  };

  if (delay === 0) {
    return action;
  }
  return (dispatch: Dispatch) => {
    setTimeout(() => {
      dispatch(action);
    }, delay);
  };
};

const insertIntoNotifications = (
  newAlert: Notification,
  alertData: Array<Notification>
): Array<Notification> => {
  // Need to check for duplicates since we get duplicate events
  if (alertData.find(alert => alert.id === newAlert.id)) {
    return alertData;
  }
  const i = alertData.findIndex(alert => alert.timestamp < newAlert.timestamp);
  const newData = alertData.slice(0);
  if (i >= 0) {
    newData.splice(i, 0, newAlert);
  } else {
    newData.push(newAlert);
  }
  return newData;
};

const reducer = (
  state: NotificationState = {
    hasUnseenErrors: false,
    data: []
  },
  action: NotificationAction
): NotificationState => {
  let newState = state;
  switch (action.type) {
    case 'NEW_NOTIFICATION':
      newState = {
        ...state,
        data: insertIntoNotifications(action.payload, state.data)
      };
      break;
    case 'REMOVE_NOTIFICATION':
      newState = {
        ...state,
        data: state.data.filter(a => a.id !== action.payload)
      };
      break;
    case 'MARK_AS_SEEN_ALL_SINCE':
      newState = {
        ...state,
        data: state.data.map(n =>
          n.timestamp <= action.payload ? { ...n, seen: true } : n
        )
      };
      break;
    case 'MARK_NOTIFICATION_AS_SEEN':
      newState = {
        ...state,
        data: state.data.map(n =>
          n.id === action.payload ? { ...n, seen: true } : n
        )
      };
      break;
    default:
      return state;
  }
  newState.hasUnseenErrors = !!newState.data.find(
    n => n.type === NotificationType.ERROR && !n.seen
  );
  return newState;
};

export default reducer;
