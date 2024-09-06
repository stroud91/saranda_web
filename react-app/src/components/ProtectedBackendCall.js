import React from 'react';
import { useUser } from '@clerk/clerk-react';

export function ProtectedBackendCall() {
  const { getToken } = useUser();

  async function makeBackendCall() {
    const token = await getToken();

    const response = await fetch('/api/clerk-auth', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });

    const data = await response.json();
    console.log(data);
  }

  return (
    <button onClick={makeBackendCall}>
      Call Backend
    </button>
  );
}
