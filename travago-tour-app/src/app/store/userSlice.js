// store/userSlice.js

// --------------------
// Action Types
// --------------------
const USER_LOGIN_REQUEST = 'user/USER_LOGIN_REQUEST';
const USER_LOGIN_SUCCESS = 'user/USER_LOGIN_SUCCESS';
const USER_LOGIN_FAILURE = 'user/USER_LOGIN_FAILURE';

const USER_LOGOUT = 'user/USER_LOGOUT';

// --------------------
// Initial State
// --------------------
const initialState = {
  user: null,
  loading: false,
  error: null,
};

// --------------------
// Reducer
// --------------------
export default function userReducer(state = initialState, action) {
  switch (action.type) {
    case USER_LOGIN_REQUEST:
      return { ...state, loading: true, error: null };
    case USER_LOGIN_SUCCESS:
      return { ...state, loading: false, user: action.payload };
    case USER_LOGIN_FAILURE:
      return { ...state, loading: false, error: action.payload };
    case USER_LOGOUT:
      return { ...state, user: null };
    default:
      return state;
  }
}

// --------------------
// Thunk Action Creators
// --------------------
export const loginUser = (credentials) => async (dispatch) => {
  dispatch({ type: USER_LOGIN_REQUEST });
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.errors || 'Login failed');
    }
    const data = await response.json();
    dispatch({ type: USER_LOGIN_SUCCESS, payload: data });
  } catch (err) {
    dispatch({ type: USER_LOGIN_FAILURE, payload: err.message });
  }
};

export const logoutUser = () => (dispatch) => {
  // Optional: call an API endpoint to log out
  dispatch({ type: USER_LOGOUT });
};
