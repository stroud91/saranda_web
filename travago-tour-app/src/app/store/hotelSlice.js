// src/store/hotelSlice.js

// -------------------------
// Action Types
// -------------------------
const GET_HOTELS_REQUEST = 'hotels/GET_HOTELS_REQUEST';
const GET_HOTELS_SUCCESS = 'hotels/GET_HOTELS_SUCCESS';
const GET_HOTELS_FAILURE = 'hotels/GET_HOTELS_FAILURE';

const GET_HOTEL_REQUEST = 'hotels/GET_HOTEL_REQUEST';
const GET_HOTEL_SUCCESS = 'hotels/GET_HOTEL_SUCCESS';
const GET_HOTEL_FAILURE = 'hotels/GET_HOTEL_FAILURE';

const CREATE_HOTEL_REQUEST = 'hotels/CREATE_HOTEL_REQUEST';
const CREATE_HOTEL_SUCCESS = 'hotels/CREATE_HOTEL_SUCCESS';
const CREATE_HOTEL_FAILURE = 'hotels/CREATE_HOTEL_FAILURE';

const UPDATE_HOTEL_REQUEST = 'hotels/UPDATE_HOTEL_REQUEST';
const UPDATE_HOTEL_SUCCESS = 'hotels/UPDATE_HOTEL_SUCCESS';
const UPDATE_HOTEL_FAILURE = 'hotels/UPDATE_HOTEL_FAILURE';

const DELETE_HOTEL_REQUEST = 'hotels/DELETE_HOTEL_REQUEST';
const DELETE_HOTEL_SUCCESS = 'hotels/DELETE_HOTEL_SUCCESS';
const DELETE_HOTEL_FAILURE = 'hotels/DELETE_HOTEL_FAILURE';

// -------------------------
// Initial State
// -------------------------
const initialState = {
  hotels: [],
  selectedHotel: null,
  loading: false,
  error: null,
};

// -------------------------
// Reducer
// -------------------------
export default function hotelReducer(state = initialState, action) {
  switch (action.type) {
    // Fetch all hotels
    case GET_HOTELS_REQUEST:
      return { ...state, loading: true, error: null };
    case GET_HOTELS_SUCCESS:
      return { ...state, loading: false, hotels: action.payload };
    case GET_HOTELS_FAILURE:
      return { ...state, loading: false, error: action.payload };

    // Fetch a single hotel
    case GET_HOTEL_REQUEST:
      return { ...state, loading: true, error: null };
    case GET_HOTEL_SUCCESS:
      return { ...state, loading: false, selectedHotel: action.payload };
    case GET_HOTEL_FAILURE:
      return { ...state, loading: false, error: action.payload };

    // Create a new hotel
    case CREATE_HOTEL_REQUEST:
      return { ...state, loading: true, error: null };
    case CREATE_HOTEL_SUCCESS:
      return { ...state, loading: false, hotels: [...state.hotels, action.payload] };
    case CREATE_HOTEL_FAILURE:
      return { ...state, loading: false, error: action.payload };

    // Update an existing hotel
    case UPDATE_HOTEL_REQUEST:
      return { ...state, loading: true, error: null };
    case UPDATE_HOTEL_SUCCESS: {
      const updatedHotel = action.payload;
      const updatedHotels = state.hotels.map(hotel =>
        hotel.id === updatedHotel.id ? updatedHotel : hotel
      );
      return { ...state, loading: false, hotels: updatedHotels };
    }
    case UPDATE_HOTEL_FAILURE:
      return { ...state, loading: false, error: action.payload };

    // Delete a hotel
    case DELETE_HOTEL_REQUEST:
      return { ...state, loading: true, error: null };
    case DELETE_HOTEL_SUCCESS: {
      const deletedId = action.payload;
      const filteredHotels = state.hotels.filter(hotel => hotel.id !== deletedId);
      return { ...state, loading: false, hotels: filteredHotels };
    }
    case DELETE_HOTEL_FAILURE:
      return { ...state, loading: false, error: action.payload };

    default:
      return state;
  }
}

// -------------------------
// Thunk Action Creators
// -------------------------

/**
 * Fetch all hotels.
 */
export const fetchHotels = () => async (dispatch) => {
  dispatch({ type: GET_HOTELS_REQUEST });
  try {
    const response = await fetch('/api/hotels');
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch hotels');
    }
    const data = await response.json();
    dispatch({ type: GET_HOTELS_SUCCESS, payload: data });
  } catch (error) {
    dispatch({ type: GET_HOTELS_FAILURE, payload: error.message });
  }
};

/**
 * Fetch a single hotel by ID.
 * @param {number} hotelId
 */
export const fetchHotelById = (hotelId) => async (dispatch) => {
  dispatch({ type: GET_HOTEL_REQUEST });
  try {
    const response = await fetch(`/api/hotels/${hotelId}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch hotel');
    }
    const data = await response.json();
    dispatch({ type: GET_HOTEL_SUCCESS, payload: data });
  } catch (error) {
    dispatch({ type: GET_HOTEL_FAILURE, payload: error.message });
  }
};

/**
 * Create a new hotel.
 * @param {Object} hotelData
 */
export const createHotel = (hotelData) => async (dispatch) => {
  dispatch({ type: CREATE_HOTEL_REQUEST });
  try {
    const response = await fetch('/api/hotels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hotelData),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create hotel');
    }
    const data = await response.json();
    dispatch({ type: CREATE_HOTEL_SUCCESS, payload: data });
  } catch (error) {
    dispatch({ type: CREATE_HOTEL_FAILURE, payload: error.message });
  }
};

/**
 * Update an existing hotel.
 * @param {number} hotelId
 * @param {Object} updates
 */
export const updateHotel = (hotelId, updates) => async (dispatch) => {
  dispatch({ type: UPDATE_HOTEL_REQUEST });
  try {
    const response = await fetch(`/api/hotels/${hotelId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update hotel');
    }
    const data = await response.json();
    dispatch({ type: UPDATE_HOTEL_SUCCESS, payload: data });
  } catch (error) {
    dispatch({ type: UPDATE_HOTEL_FAILURE, payload: error.message });
  }
};

/**
 * Delete a hotel by ID.
 * @param {number} hotelId
 */
export const deleteHotel = (hotelId) => async (dispatch) => {
  dispatch({ type: DELETE_HOTEL_REQUEST });
  try {
    const response = await fetch(`/api/hotels/${hotelId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete hotel');
    }
    dispatch({ type: DELETE_HOTEL_SUCCESS, payload: hotelId });
  } catch (error) {
    dispatch({ type: DELETE_HOTEL_FAILURE, payload: error.message });
  }
};
