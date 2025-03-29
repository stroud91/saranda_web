import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Thunk to fetch all users; pass the Clerk token as an argument
export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (token, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        return rejectWithValue(data.error || 'Failed to fetch users');
      }
      const data = await response.json();
      return data.users; // Assuming your API returns: { users: [...] }
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const userSlice = createSlice({
  name: 'users',
  initialState: { users: [], loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
         state.loading = true;
         state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
         state.loading = false;
         state.users = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
         state.loading = false;
         state.error = action.payload;
      });
  },
});

export default userSlice.reducer;