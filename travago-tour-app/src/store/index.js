// src/store/index.js
import { createStore, applyMiddleware, compose } from 'redux';
import { combineReducers } from 'redux';
import { thunk } from 'redux-thunk'; // Import thunk as a named export

// Import your feature slices
import userReducer from './userSlice';
import accountReducer from './accountSlice';
import toursReducer from './toursSlice';
import hotelReducer from './hotelSlice';
import carRentalReducer from './carRentalSlice';

// Combine all reducers into a single root reducer
const rootReducer = combineReducers({
  user: userReducer,
  account: accountReducer,
  tours: toursReducer,
  hotels: hotelReducer,
  carRentals: carRentalReducer,
});

// Setup Redux DevTools Extension if available
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

// Create the Redux store with thunk middleware
const store = createStore(rootReducer, composeEnhancers(applyMiddleware(thunk)));

export default store;
