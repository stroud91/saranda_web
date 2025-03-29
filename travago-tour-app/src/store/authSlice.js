import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Thunk to authenticate the user via Clerk
export const authenticate = createAsyncThunk(
  'auth/authenticate',
  async (token, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/auth/authenticate', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        return rejectWithValue(data.error || 'Authentication failed');
      }
      const data = await response.json();
      return data; // Decoded Clerk token info
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: { clerkUser: null, loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(authenticate.pending, (state) => {
         state.loading = true;
         state.error = null;
      })
      .addCase(authenticate.fulfilled, (state, action) => {
         state.loading = false;
         state.clerkUser = action.payload;
      })
      .addCase(authenticate.rejected, (state, action) => {
         state.loading = false;
         state.error = action.payload;
      });
  },
});

export default authSlice.reducer;