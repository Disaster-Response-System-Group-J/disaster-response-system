// lib/api-client.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
}

// Added 'export' to fix the module error
export async function apiRequest(endpoint: string, options: RequestOptions = {}) {
  const { method = "GET", headers = {}, body } = options;

  const url = `${API_BASE_URL}/api${endpoint}`;

  const requestOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body) {
    requestOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, requestOptions);

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export const authAPI = {
  login: (email: string, passkey: string) =>
    apiRequest("/auth/login", {
      method: "POST",
      body: { email, passkey },
    }),
};

export const dashboardAPI = {
  getOverview: () => apiRequest("/dashboard/overview"),
};

export const activityAPI = {
  getFeed: () => apiRequest("/activity"),
};

export const incidentsAPI = {
  getIncidents: () => apiRequest("/incidents"),
  getIncidentById: (id: string) => apiRequest(`/incidents/${id}`),
  updateIncident: (id: string, data: unknown) =>
    apiRequest(`/incidents/${id}`, {
      method: "PUT",
      body: data,
    }),
};

export const resourcesAPI = {
  getResources: () => apiRequest("/resources"),
  getResourcesByType: (type: string) => apiRequest(`/resources?type=${type}`),
  updateResourceStatus: (id: string, status: string) =>
    apiRequest(`/resources/${id}`, {
      method: "PUT",
      body: { status },
    }),
};

export const analyticsAPI = {
  getSituation: () => apiRequest("/analytics/situation"),
  getIncidentStats: () => apiRequest("/analytics/incident-stats"),
};

export const reliefAPI = {
  getShelterData: () => apiRequest("/relief/shelter"),
  getStockMatrix: () => apiRequest("/relief/shelter"),
};

export const incidentsDetailAPI = {
  getIncidents: () => apiRequest("/incidents"),
};

export const analyticsSituationAPI = {
  getSituation: () => apiRequest("/analytics/situation"),
};

export const resourcesListAPI = {
  getList: () => apiRequest("/resources/list"),
};