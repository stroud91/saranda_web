
// -------------------------
// Action Types
// -------------------------
const GET_TOURS_REQUEST = 'tours/GET_TOURS_REQUEST';
const GET_TOURS_SUCCESS = 'tours/GET_TOURS_SUCCESS';
const GET_TOURS_FAILURE = 'tours/GET_TOURS_FAILURE';

const GET_TOUR_REQUEST = 'tours/GET_TOUR_REQUEST';
const GET_TOUR_SUCCESS = 'tours/GET_TOUR_SUCCESS';
const GET_TOUR_FAILURE = 'tours/GET_TOUR_FAILURE';

const CREATE_TOUR_REQUEST = 'tours/CREATE_TOUR_REQUEST';
const CREATE_TOUR_SUCCESS = 'tours/CREATE_TOUR_SUCCESS';
const CREATE_TOUR_FAILURE = 'tours/CREATE_TOUR_FAILURE';

const UPDATE_TOUR_REQUEST = 'tours/UPDATE_TOUR_REQUEST';
const UPDATE_TOUR_SUCCESS = 'tours/UPDATE_TOUR_SUCCESS';
const UPDATE_TOUR_FAILURE = 'tours/UPDATE_TOUR_FAILURE';

const DELETE_TOUR_REQUEST = 'tours/DELETE_TOUR_REQUEST';
const DELETE_TOUR_SUCCESS = 'tours/DELETE_TOUR_SUCCESS';
const DELETE_TOUR_FAILURE = 'tours/DELETE_TOUR_FAILURE';

// -------------------------
// Initial State
// -------------------------
const initialState = {
  tours: [],
  selectedTour: null,
  loading: false,
  error: null,
};

// -------------------------
// Reducer
// -------------------------
export default function toursReducer(state = initialState, action) {
  switch (action.type) {
    // Fetch multiple tours
    case GET_TOURS_REQUEST:
      return { ...state, loading: true, error: null };
    case GET_TOURS_SUCCESS:
      return { ...state, loading: false, tours: action.payload };
    case GET_TOURS_FAILURE:
      return { ...state, loading: false, error: action.payload };

    // Fetch single tour
    case GET_TOUR_REQUEST:
      return { ...state, loading: true, error: null };
    case GET_TOUR_SUCCESS:
      return { ...state, loading: false, selectedTour: action.payload };
    case GET_TOUR_FAILURE:
      return { ...state, loading: false, error: action.payload };

    // Create new tour
    case CREATE_TOUR_REQUEST:
      return { ...state, loading: true, error: null };
    case CREATE_TOUR_SUCCESS:
      return { ...state, loading: false, tours: [...state.tours, action.payload] };
    case CREATE_TOUR_FAILURE:
      return { ...state, loading: false, error: action.payload };

    // Update existing tour
    case UPDATE_TOUR_REQUEST:
      return { ...state, loading: true, error: null };
    case UPDATE_TOUR_SUCCESS: {
      const updatedTour = action.payload;
      const updatedTours = state.tours.map(tour =>
        tour.id === updatedTour.id ? updatedTour : tour
      );
      return { ...state, loading: false, tours: updatedTours };
    }
    case UPDATE_TOUR_FAILURE:
      return { ...state, loading: false, error: action.payload };

    // Delete tour
    case DELETE_TOUR_REQUEST:
      return { ...state, loading: true, error: null };
    case DELETE_TOUR_SUCCESS: {
      const deletedTourId = action.payload;
      const filteredTours = state.tours.filter(tour => tour.id !== deletedTourId);
      return { ...state, loading: false, tours: filteredTours };
    }
    case DELETE_TOUR_FAILURE:
      return { ...state, loading: false, error: action.payload };

    default:
      return state;
  }
}

// -------------------------
// Thunk Action Creators
// -------------------------

/**
 * Fetch all tours.
 */
export const fetchTours = () => async (dispatch) => {
  dispatch({ type: GET_TOURS_REQUEST });
  try {
    const response = await fetch('/api/tours');
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch tours');
    }
    const data = await response.json();
    dispatch({ type: GET_TOURS_SUCCESS, payload: data });
  } catch (error) {
    dispatch({ type: GET_TOURS_FAILURE, payload: error.message });
  }
};

/**
 * Fetch a single tour by ID.
 * @param {number} tourId
 */
export const fetchTourById = (tourId) => async (dispatch) => {
  dispatch({ type: GET_TOUR_REQUEST });
  try {
    const response = await fetch(`/api/tours/${tourId}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch tour');
    }
    const data = await response.json();
    dispatch({ type: GET_TOUR_SUCCESS, payload: data });
  } catch (error) {
    dispatch({ type: GET_TOUR_FAILURE, payload: error.message });
  }
};

/**
 * Create a new tour.
 * @param {Object} tourData - The tour details.
 */
export const createTour = (tourData) => async (dispatch) => {
  dispatch({ type: CREATE_TOUR_REQUEST });
  try {
    const response = await fetch('/api/tours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tourData),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create tour');
    }
    const data = await response.json();
    dispatch({ type: CREATE_TOUR_SUCCESS, payload: data });
  } catch (error) {
    dispatch({ type: CREATE_TOUR_FAILURE, payload: error.message });
  }
};

/**
 * Update an existing tour.
 * @param {number} tourId
 * @param {Object} updates - The updated tour fields.
 */
export const updateTour = (tourId, updates) => async (dispatch) => {
  dispatch({ type: UPDATE_TOUR_REQUEST });
  try {
    const response = await fetch(`/api/tours/${tourId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update tour');
    }
    const data = await response.json();
    dispatch({ type: UPDATE_TOUR_SUCCESS, payload: data });
  } catch (error) {
    dispatch({ type: UPDATE_TOUR_FAILURE, payload: error.message });
  }
};

/**
 * Delete a tour by ID.
 * @param {number} tourId
 */
export const deleteTour = (tourId) => async (dispatch) => {
  dispatch({ type: DELETE_TOUR_REQUEST });
  try {
    const response = await fetch(`/api/tours/${tourId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete tour');
    }
    dispatch({ type: DELETE_TOUR_SUCCESS, payload: tourId });
  } catch (error) {
    dispatch({ type: DELETE_TOUR_FAILURE, payload: error.message });
  }
};
