import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Thunk to fetch the current account details; pass the Clerk token
export const getAccount = createAsyncThunk(
  'account/getAccount',
  async (token, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/account/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        return rejectWithValue(data.error || 'Failed to fetch account');
      }
      const data = await response.json();
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Thunk to update the account details; pass an object with { token, updates }
export const updateAccount = createAsyncThunk(
  'account/updateAccount',
  async ({ token, updates }, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/account/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const data = await response.json();
        return rejectWithValue(data.error || 'Failed to update account');
      }
      const data = await response.json();
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const accountSlice = createSlice({
  name: 'account',
  initialState: { account: null, loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getAccount.pending, (state) => {
         state.loading = true;
         state.error = null;
      })
      .addCase(getAccount.fulfilled, (state, action) => {
         state.loading = false;
         state.account = action.payload;
      })
      .addCase(getAccount.rejected, (state, action) => {
         state.loading = false;
         state.error = action.payload;
      })
      .addCase(updateAccount.pending, (state) => {
         state.loading = true;
         state.error = null;
      })
      .addCase(updateAccount.fulfilled, (state, action) => {
         state.loading = false;
         state.account = action.payload;
      })
      .addCase(updateAccount.rejected, (state, action) => {
         state.loading = false;
         state.error = action.payload;
      });
  },
});

export default accountSlice.reducer;