import { Dispatch } from './types';

export type Notification = {
  type: 'success' | 'warning' | 'error';
  message: string;
  id: number;
  lifetime: number;
};

export type Action =
  | {
      type: 'NEW_NOTIFICATION';
      payload: Notification;
    }
  | {
      type: 'REMOVE_NOTIFICATION';
      payload: number;
    };

let id = 0;
export const addNotification = (
  type: string,
  message: string,
  lifetime = 3000
) => {
  id += 1;
  return (dispatch: Dispatch) => {
    dispatch({
      type: 'NEW_NOTIFICATION',
      payload: {
        type,
        message,
        lifetime,
        id
      }
    });
    setTimeout(() => {
      dispatch({
        type: 'REMOVE_NOTIFICATION',
        payload: id
      });
    }, lifetime);
  };
};

const reducer = (
  state: Array<Notification> = [],
  action: Action
): Array<Notification> => {
  switch (action.type) {
    case 'NEW_NOTIFICATION':
      return [...state, action.payload];
    case 'REMOVE_NOTIFICATION':
      return state.filter(a => a.id !== action.payload);
    default:
      return state;
  }
};

export default reducer;
