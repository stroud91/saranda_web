// src/store/carRentalSlice.js

// -------------------------
// Action Types
// -------------------------
const GET_CAR_RENTALS_REQUEST = 'carRentals/GET_CAR_RENTALS_REQUEST';
const GET_CAR_RENTALS_SUCCESS = 'carRentals/GET_CAR_RENTALS_SUCCESS';
const GET_CAR_RENTALS_FAILURE = 'carRentals/GET_CAR_RENTALS_FAILURE';

const GET_CAR_RENTAL_REQUEST = 'carRentals/GET_CAR_RENTAL_REQUEST';
const GET_CAR_RENTAL_SUCCESS = 'carRentals/GET_CAR_RENTAL_SUCCESS';
const GET_CAR_RENTAL_FAILURE = 'carRentals/GET_CAR_RENTAL_FAILURE';

const CREATE_CAR_RENTAL_REQUEST = 'carRentals/CREATE_CAR_RENTAL_REQUEST';
const CREATE_CAR_RENTAL_SUCCESS = 'carRentals/CREATE_CAR_RENTAL_SUCCESS';
const CREATE_CAR_RENTAL_FAILURE = 'carRentals/CREATE_CAR_RENTAL_FAILURE';

const UPDATE_CAR_RENTAL_REQUEST = 'carRentals/UPDATE_CAR_RENTAL_REQUEST';
const UPDATE_CAR_RENTAL_SUCCESS = 'carRentals/UPDATE_CAR_RENTAL_SUCCESS';
const UPDATE_CAR_RENTAL_FAILURE = 'carRentals/UPDATE_CAR_RENTAL_FAILURE';

const DELETE_CAR_RENTAL_REQUEST = 'carRentals/DELETE_CAR_RENTAL_REQUEST';
const DELETE_CAR_RENTAL_SUCCESS = 'carRentals/DELETE_CAR_RENTAL_SUCCESS';
const DELETE_CAR_RENTAL_FAILURE = 'carRentals/DELETE_CAR_RENTAL_FAILURE';

// -------------------------
// Initial State
// -------------------------
const initialState = {
  carRentals: [],
  selectedCarRental: null,
  loading: false,
  error: null,
};

// -------------------------
// Reducer
// -------------------------
export default function carRentalReducer(state = initialState, action) {
  switch (action.type) {
    // Fetch all car rentals
    case GET_CAR_RENTALS_REQUEST:
      return { ...state, loading: true, error: null };
    case GET_CAR_RENTALS_SUCCESS:
      return { ...state, loading: false, carRentals: action.payload };
    case GET_CAR_RENTALS_FAILURE:
      return { ...state, loading: false, error: action.payload };

    // Fetch single car rental
    case GET_CAR_RENTAL_REQUEST:
      return { ...state, loading: true, error: null };
    case GET_CAR_RENTAL_SUCCESS:
      return { ...state, loading: false, selectedCarRental: action.payload };
    case GET_CAR_RENTAL_FAILURE:
      return { ...state, loading: false, error: action.payload };

    // Create new car rental
    case CREATE_CAR_RENTAL_REQUEST:
      return { ...state, loading: true, error: null };
    case CREATE_CAR_RENTAL_SUCCESS:
      return { ...state, loading: false, carRentals: [...state.carRentals, action.payload] };
    case CREATE_CAR_RENTAL_FAILURE:
      return { ...state, loading: false, error: action.payload };

    // Update existing car rental
    case UPDATE_CAR_RENTAL_REQUEST:
      return { ...state, loading: true, error: null };
    case UPDATE_CAR_RENTAL_SUCCESS: {
      const updatedRental = action.payload;
      const updatedRentals = state.carRentals.map(rental =>
        rental.id === updatedRental.id ? updatedRental : rental
      );
      return { ...state, loading: false, carRentals: updatedRentals };
    }
    case UPDATE_CAR_RENTAL_FAILURE:
      return { ...state, loading: false, error: action.payload };

    // Delete car rental
    case DELETE_CAR_RENTAL_REQUEST:
      return { ...state, loading: true, error: null };
    case DELETE_CAR_RENTAL_SUCCESS: {
      const deletedId = action.payload;
      const filteredRentals = state.carRentals.filter(rental => rental.id !== deletedId);
      return { ...state, loading: false, carRentals: filteredRentals };
    }
    case DELETE_CAR_RENTAL_FAILURE:
      return { ...state, loading: false, error: action.payload };

    default:
      return state;
  }
}

// -------------------------
// Thunk Action Creators
// -------------------------

/**
 * Fetch all car rentals.
 */
export const fetchCarRentals = () => async (dispatch) => {
  dispatch({ type: GET_CAR_RENTALS_REQUEST });
  try {
    const response = await fetch('/api/car_rentals');
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch car rentals');
    }
    const data = await response.json();
    dispatch({ type: GET_CAR_RENTALS_SUCCESS, payload: data });
  } catch (error) {
    dispatch({ type: GET_CAR_RENTALS_FAILURE, payload: error.message });
  }
};

/**
 * Fetch a single car rental by ID.
 * @param {number} rentalId
 */
export const fetchCarRentalById = (rentalId) => async (dispatch) => {
  dispatch({ type: GET_CAR_RENTAL_REQUEST });
  try {
    const response = await fetch(`/api/car_rentals/${rentalId}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch car rental');
    }
    const data = await response.json();
    dispatch({ type: GET_CAR_RENTAL_SUCCESS, payload: data });
  } catch (error) {
    dispatch({ type: GET_CAR_RENTAL_FAILURE, payload: error.message });
  }
};

/**
 * Create a new car rental.
 * @param {Object} rentalData
 */
export const createCarRental = (rentalData) => async (dispatch) => {
  dispatch({ type: CREATE_CAR_RENTAL_REQUEST });
  try {
    const response = await fetch('/api/car_rentals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rentalData),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create car rental');
    }
    const data = await response.json();
    dispatch({ type: CREATE_CAR_RENTAL_SUCCESS, payload: data });
  } catch (error) {
    dispatch({ type: CREATE_CAR_RENTAL_FAILURE, payload: error.message });
  }
};

/**
 * Update an existing car rental.
 * @param {number} rentalId
 * @param {Object} updates
 */
export const updateCarRental = (rentalId, updates) => async (dispatch) => {
  dispatch({ type: UPDATE_CAR_RENTAL_REQUEST });
  try {
    const response = await fetch(`/api/car_rentals/${rentalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update car rental');
    }
    const data = await response.json();
    dispatch({ type: UPDATE_CAR_RENTAL_SUCCESS, payload: data });
  } catch (error) {
    dispatch({ type: UPDATE_CAR_RENTAL_FAILURE, payload: error.message });
  }
};

/**
 * Delete a car rental by ID.
 * @param {number} rentalId
 */
export const deleteCarRental = (rentalId) => async (dispatch) => {
  dispatch({ type: DELETE_CAR_RENTAL_REQUEST });
  try {
    const response = await fetch(`/api/car_rentals/${rentalId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete car rental');
    }
    dispatch({ type: DELETE_CAR_RENTAL_SUCCESS, payload: rentalId });
  } catch (error) {
    dispatch({ type: DELETE_CAR_RENTAL_FAILURE, payload: error.message });
  }
};
