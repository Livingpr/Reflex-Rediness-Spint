const TOKEN_KEY = "reflex_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  signup: (payload) => request("/auth/signup", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  me: () => request("/auth/me"),
  retailers: () => request("/retailers"),
  riders: () => request("/riders"),
  listRequests: () => request("/requests"),
  getRequest: (id) => request(`/requests/${id}`),
  createRequest: (payload) => request("/requests", { method: "POST", body: payload }),
  assignRequest: (id, riderId) => request(`/requests/${id}/assign`, { method: "POST", body: { rider_id: riderId } }),
  advanceRequest: (id, confirmationCode) =>
    request(`/requests/${id}/advance`, { method: "POST", body: confirmationCode ? { confirmation_code: confirmationCode } : {} }),
};
