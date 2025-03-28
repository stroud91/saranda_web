// -------------------------
// Action Types
// -------------------------
const GET_ACCOUNT_REQUEST = 'account/GET_ACCOUNT_REQUEST';
const GET_ACCOUNT_SUCCESS = 'account/GET_ACCOUNT_SUCCESS';
const GET_ACCOUNT_FAILURE = 'account/GET_ACCOUNT_FAILURE';

const UPDATE_ACCOUNT_REQUEST = 'account/UPDATE_ACCOUNT_REQUEST';
const UPDATE_ACCOUNT_SUCCESS = 'account/UPDATE_ACCOUNT_SUCCESS';
const UPDATE_ACCOUNT_FAILURE = 'account/UPDATE_ACCOUNT_FAILURE';

// -------------------------
// Initial State
// -------------------------
const initialState = {
  user: null,
  loading: false,
  error: null,
};

// -------------------------
// Reducer
// -------------------------
export default function accountReducer(state = initialState, action) {
  switch (action.type) {
    case GET_ACCOUNT_REQUEST:
    case UPDATE_ACCOUNT_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
    case GET_ACCOUNT_SUCCESS:
    case UPDATE_ACCOUNT_SUCCESS:
      return {
        ...state,
        loading: false,
        user: action.payload,
      };
    case GET_ACCOUNT_FAILURE:
    case UPDATE_ACCOUNT_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload,
      };
    default:
      return state;
  }
}

// -------------------------
// Thunk Action Creators
// -------------------------

/**
 * Fetch the current user's account details.
 */
export const fetchAccount = () => async (dispatch) => {
  dispatch({ type: GET_ACCOUNT_REQUEST });
  try {
    const response = await fetch('/api/account/me');
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch account details');
    }
    const data = await response.json();
    dispatch({ type: GET_ACCOUNT_SUCCESS, payload: data });
  } catch (err) {
    dispatch({ type: GET_ACCOUNT_FAILURE, payload: err.message });
  }
};

/**
 * Update the current user's account details.
 * @param {Object} accountUpdates - An object with the fields to update (e.g., { username, email, bio }).
 */
export const updateAccount = (accountUpdates) => async (dispatch) => {
  dispatch({ type: UPDATE_ACCOUNT_REQUEST });
  try {
    const response = await fetch('/api/account/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountUpdates),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update account');
    }
    const data = await response.json();
    dispatch({ type: UPDATE_ACCOUNT_SUCCESS, payload: data });
  } catch (err) {
    dispatch({ type: UPDATE_ACCOUNT_FAILURE, payload: err.message });
  }
};
