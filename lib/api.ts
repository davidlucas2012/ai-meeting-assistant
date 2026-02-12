/**
 * API client for communicating with the backend server.
 */

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

if (!BACKEND_URL) {
  console.warn(
    'EXPO_PUBLIC_BACKEND_URL is not set. Backend API calls will fail. ' +
    'Please set EXPO_PUBLIC_BACKEND_URL in your .env file.'
  );
}

/**
 * The backend API base URL.
 */
export { BACKEND_URL };

/**
 * POST JSON data to a backend endpoint.
 *
 * @param path - The API path (e.g., '/process-meeting')
 * @param body - The JSON body to send
 * @returns The parsed JSON response
 * @throws Error if the request fails
 */
export async function postJson<T = any>(path: string, body: any): Promise<T> {
  if (!BACKEND_URL) {
    throw new Error('Backend URL is not configured');
  }

  const url = `${BACKEND_URL}${path}`;

  console.log(`POST ${url}`, body);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`Response from ${url}:`, data);

  return data;
}

/**
 * GET JSON data from a backend endpoint.
 *
 * @param path - The API path (e.g., '/health')
 * @returns The parsed JSON response
 * @throws Error if the request fails
 */
export async function getJson<T = any>(path: string): Promise<T> {
  if (!BACKEND_URL) {
    throw new Error('Backend URL is not configured');
  }

  const url = `${BACKEND_URL}${path}`;

  console.log(`GET ${url}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`Response from ${url}:`, data);

  return data;
}
