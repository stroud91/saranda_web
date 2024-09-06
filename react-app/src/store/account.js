const SET_ACCOUNT = "account/SET_ACCOUNT";
const UPDATE_ACCOUNT = "account/UPDATE_ACCOUNT";

const setAccount = (account) => ({
  type: SET_ACCOUNT,
  payload: account,
});

const updateAccountAction = (account) => ({
  type: UPDATE_ACCOUNT,
  payload: account,
});

export const fetchAccount = () => async (dispatch) => {
  const response = await fetch("/api/account/me", {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (response.ok) {
    const data = await response.json();
    dispatch(setAccount(data));
  }
};

export const updateAccount = (accountData) => async (dispatch) => {
  const response = await fetch("/api/account/me", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(accountData),
  });

  if (response.ok) {
    const data = await response.json();
    dispatch(updateAccountAction(data));
  }
};


const initialState = { account: null };

export default function accountReducer(state = initialState, action) {
  switch (action.type) {
    case SET_ACCOUNT:
      return { ...state, account: action.payload };
    case UPDATE_ACCOUNT:
      return { ...state, account: action.payload };
    default:
      return state;
  }
}