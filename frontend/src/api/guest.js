import axios from "axios";

// Always same-origin: nginx proxies /api and /uploads to the backend on
// whatever origin the page was loaded from, so there is nothing to configure.
export const API_BASE = "";

const client = axios.create({
  baseURL: undefined,
});

client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("qf_admin_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadSession = Boolean(sessionStorage.getItem("qf_admin_token"));
      sessionStorage.removeItem("qf_admin_token");
      sessionStorage.removeItem("qf_current_user");
      sessionStorage.removeItem("qf_perf_session_id");
      if (hadSession) {
        window.dispatchEvent(new Event("qf:auth-changed"));
      }
    }

    return Promise.reject(error);
  }
);

export default client;

export const getMyTodos = (targetDate, userId) =>
  client.get("/api/tasks/my-todos", {
    params: {
      ...(targetDate ? { target_date: targetDate } : {}),
      ...(userId ? { user_id: userId } : {}),
    },
  });

/* =====================================================
   Authentication
===================================================== */

export const login = (identifier, password) =>
  client.post("/api/auth/login", {
    username: identifier,
    email: identifier,
    password,
  });

export const requestPasswordReset = (email) =>
  client.post("/api/auth/forgot-password", { email });

export const resetPasswordWithToken = (token, new_password) =>
  client.post("/api/auth/reset-password", { token, new_password });

export const logout = () => client.post("/api/auth/logout");

export const getMe = () => client.get("/api/auth/me");

export const changeOwnPassword = (
  current_password,
  new_password
) =>
  client.post("/api/auth/change-password", {
    current_password,
    new_password,
  });

export const updateOwnProfile = (payload) =>
  client.patch("/api/auth/profile", payload);

export const uploadOwnProfileImage = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return client.post("/api/auth/profile-image", formData);
};

/* =====================================================
   User Management
===================================================== */

export const listUsers = () => client.get("/api/users");

export const createUser = (payload) =>
  client.post("/api/users", payload);

export const updateUser = (id, payload) =>
  client.patch(`/api/users/${id}`, payload);

export const deleteUser = (id) =>
  client.delete(`/api/users/${id}`);

export const resetUserPassword = (id, new_password) =>
  client.post(`/api/users/${id}/reset-password`, {
    new_password,
  });

export const listUserPermissions = (id) =>
  client.get(`/api/users/${id}/permissions`);

export const replaceUserPermissions = (
  id,
  permissions
) =>
  client.put(`/api/users/${id}/permissions`, permissions);

/* =====================================================
   Projects
===================================================== */

export const listProjects = () =>
  client.get("/api/projects");

export const createProject = (name) =>
  client.post("/api/projects", {
    name,
  });

export const getProject = (id) =>
  client.get(`/api/projects/${id}`);

export const renameProject = (id, name) =>
  client.patch(`/api/projects/${id}/rename`, {
    name,
  });

export const updateEvent = (id, payload) =>
  client.patch(`/api/projects/${id}/event`, payload);

export const togglePublish = (id) =>
  client.patch(`/api/projects/${id}/publish`);

export const deleteProject = (id) =>
  client.delete(`/api/projects/${id}`);

export const uploadEcard = (id, file) => {
  const form = new FormData();

  form.append("file", file);

  return client.post(`/api/projects/${id}/ecard`, form, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const removeEcard = (id) =>
  client.delete(`/api/projects/${id}/ecard`);

/* =====================================================
   Project Form Fields
===================================================== */

export const listFields = (id) =>
  client.get(`/api/projects/${id}/fields`);

export const replaceFields = (id, fields) =>
  client.put(`/api/projects/${id}/fields`, fields);

/* =====================================================
   Registrations
===================================================== */

// export const listRegistrations = (id) =>
//   client.get(`/api/projects/${id}/registrations`);

// পরে (ঠিক) ✅
export const listRegistrations = (projectId) =>
  client.get(`/api/projects/${projectId}/registrations`);


export const deleteRegistration = (id, registrationId) =>
  client.delete(
    `/api/projects/${id}/registrations/${registrationId}`
  );


// clearRegistrationCache is no longer needed — react-query handles caching
export function clearRegistrationCache(_projectId) {
  // no-op, kept for backward compatibility
}

/* =====================================================
   Tasks
===================================================== */

// ── Tasks ──
export const listTasks = (params = {}) => client.get("/api/tasks", { params });
export const getTaskHistory = (id) => client.get(`/api/tasks/${id}/history`);
export const createTask = (payload) => client.post("/api/tasks", payload);
export const createManualLead = (payload) => client.post("/api/tasks/manual-lead", payload);
export const updateTask = (id, payload) => client.patch(`/api/tasks/${id}`, payload);
export const deleteTask = (id) => client.delete(`/api/tasks/${id}`);
export const bulkDeleteTasks = (taskIds) => client.post("/api/tasks/bulk-delete", { task_ids: taskIds });
export const bulkAssignTasks = (taskIdsOrPayload, execId) => {
  const payload = Array.isArray(taskIdsOrPayload)
    ? { task_ids: taskIdsOrPayload, assigned_to: execId }
    : taskIdsOrPayload;
  return client.patch("/api/tasks/bulk-assign", payload);
};
export const getExecutiveWorkload = () => client.get("/api/tasks/executive-workload");

/* =====================================================
   Dashboard
===================================================== */

export const getDashboardOverview = (params = {}) =>
  client.get("/api/dashboard/overview", { params });

/* =====================================================
   Customers
===================================================== */

export const listCustomers = (query = "") =>
  client.get("/api/customers", {
    params: query ? { q: query } : {},
  });

export const getCustomer = (id) =>
  client.get(`/api/customers/${id}`);

export const listCustomerFollowups = (id) =>
  client.get(`/api/customers/${id}/followups`);

export const createCustomerFollowup = (id, payload) =>
  client.post(`/api/customers/${id}/followups`, payload);

export const updateCustomerFollowup = (customerId, followupId, payload) =>
  client.patch(`/api/customers/${customerId}/followups/${followupId}`, payload);

export const createCustomer = (payload) =>
  client.post("/api/customers", payload);

export const updateCustomer = (id, payload) =>
  client.patch(`/api/customers/${id}`, payload);

export const uploadCustomerProfileImage = (id, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return client.post(`/api/customers/${id}/profile-image`, formData);
};

export const deleteCustomer = (id) =>
  client.delete(`/api/customers/${id}`);

export const listCustomerFields = () =>
  client.get("/api/customer-fields");

export const replaceCustomerFields = (fields) =>
  client.put("/api/customer-fields", fields);

/* =====================================================
   Settings
===================================================== */

export const listSettings = () =>
  client.get("/api/settings");

export const replaceSettings = (settings) =>
  client.put("/api/settings", settings);

export const sendTestEmail = (email) =>
  client.post("/api/settings/email/test", { email });

export const getLoginAppearance = () =>
  client.get("/api/public/appearance/login");

export const uploadLoginImage = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return client.post("/api/settings/login-image", formData);
};

export const saveLoginImageUrl = (url) =>
  client.put("/api/settings/login-image-url", { url });

export const saveLoginPanelText = (title, subtitle) =>
  client.put("/api/settings/login-panel-text", { title, subtitle });

/* =====================================================
   Public Registration
===================================================== */

export const getPublicConfig = (projectRef) =>
  client.get(`/api/public/config/${projectRef}`);

export const submitRegistration = (
  projectRef,
  data
) =>
  client.post(
    `/api/public/registrations/${projectRef}`,
    {
      data,
    }
  );

export const getRegistrationEmailStatus = (projectRef, regId) =>
  client.get(`/api/public/registrations/${projectRef}/${regId}/email-status`);

// ── Reports ──
export const getMyReports = () => client.get("/api/reports/mine");
export const createReport = (payload) => client.post("/api/reports", payload);
export const listAllReports = (params = {}) => client.get("/api/reports", { params });
export const submitFeedback = (reportId, feedback) =>
  client.post(`/api/reports/${reportId}/feedback`, { feedback });
export const deleteReport = (reportId) => client.delete(`/api/reports/${reportId}`);
export const getReport = (reportId) => client.get(`/api/reports/${reportId}`);
export const updateReport = (reportId, payload) => client.patch(`/api/reports/${reportId}`, payload);

// ── Notifications ──
export const listNotifications = () => client.get("/api/notifications");
export const getUnreadCount = () => client.get("/api/notifications/unread-count");
export const markNotificationsRead = () => client.post("/api/notifications/mark-read");
export const markNotificationRead = (notificationId) =>
  client.post(`/api/notifications/${notificationId}/read`);

// ── Email Templates ──
export const listEmailTemplates = () => client.get("/api/email-templates");
export const createEmailTemplate = (payload) => client.post("/api/email-templates", payload);
export const updateEmailTemplate = (id, payload) => client.patch(`/api/email-templates/${id}`, payload);
export const deleteEmailTemplate = (id) => client.delete(`/api/email-templates/${id}`);

export const getPaymentByRegistration = (registrationId) =>
  client.get(`/api/payment/by-registration/${registrationId}`);


export const createCallLog = (payload) => client.post("/api/call-logs", payload);
export const getCallConfig = () => client.get("/api/call-logs/config");
export const listCallLogsByTask = (taskId) => client.get(`/api/call-logs/by-task/${taskId}`);

export const listCallLogsByCustomer = (customerId) => client.get(`/api/call-logs/by-customer/${customerId}`);
export const listAllFollowups = (params = {}) => client.get("/api/followups", { params });
export const createCustomerField = (payload) => client.post("/api/customer-fields", payload);

// frontend/src/api/client.js — append
export const startPerfSession = () => client.post("/api/performance/session/start");
export const perfHeartbeat = (sessionId) => client.post(`/api/performance/session/${sessionId}/heartbeat`);
export const endPerfSession = (sessionId) => client.post(`/api/performance/session/${sessionId}/end`);
export const logActivity = (payload) => client.post("/api/performance/activity", payload);
export const createCommunication = (payload) => client.post("/api/performance/communications", payload);
export const listCommunications = (customerId) => client.get("/api/performance/communications", { params: customerId ? { customer_id: customerId } : {} });
export const getPerfSummary = (params) => client.get("/api/performance/summary", { params });
export const getPerfTrend = (params = {}) => client.get("/api/performance/trend", { params });
export const getLeaderboard = (params) =>
  client.get("/api/performance/leaderboard", { params: typeof params === "string" ? { period: params } : params });
export const getStageBreakdown = (params = {}) => client.get("/api/performance/stage-breakdown", { params });
export const getPointRules = () => client.get("/api/performance/point-rules");
export const setPointRules = (rules) => client.put("/api/performance/point-rules", rules);
export const setTarget = (userId, payload) => client.put(`/api/performance/targets/${userId}`, payload);
export const getTargets = (userId) => client.get(`/api/performance/targets/${userId}`);
export const giveFeedback = (userId, feedback) => client.post(`/api/performance/feedback/${userId}`, { feedback });
export const listFeedback = (userId) => client.get(`/api/performance/feedback/${userId}`);
export const getReportPrefill = (reportDate) => client.get("/api/reports/prefill", { params: { report_date: reportDate } });

/* =====================================================
   Feed / Posts
===================================================== */

export const listFeed = (params = {}) => client.get("/api/feed", { params });
export const createPost = (payload) => client.post("/api/feed", payload);
export const updatePost = (postId, payload) => client.patch(`/api/feed/${postId}`, payload);
export const deletePost = (postId) => client.delete(`/api/feed/${postId}`);
export const savePost = (postId) => client.post(`/api/feed/${postId}/save`);
export const hidePost = (postId) => client.post(`/api/feed/${postId}/hide`);
export const reactToPost = (postId, reactionType = "like") =>
  client.post(`/api/feed/${postId}/react`, null, { params: { reaction_type: reactionType } });
export const listPostComments = (postId) => client.get(`/api/feed/${postId}/comments`);
export const addPostComment = (postId, content) =>
  client.post(`/api/feed/${postId}/comments`, { content });
export const votePoll = (optionId) => client.post(`/api/feed/poll-options/${optionId}/vote`);
export const togglePinPost = (postId) => client.patch(`/api/feed/${postId}/pin`);

/* =====================================================
    Feed Ads
===================================================== */

export const listFeedAds = () =>
  client.get("/api/feed/ads").catch((err) => {
    const status = err?.response?.status;
    // Some reverse proxies or hosting configs may respond with 405
    // when the ads endpoint isn't available. Treat 405 as empty
    // result to avoid repeated console errors in the client.
    if (status === 405) {
      return { data: [] };
    }
    // Let other errors (401 etc.) propagate to the global interceptor
    throw err;
  });
export const createFeedAd = (payload) => client.post("/api/feed/ads", payload);
export const updateFeedAd = (adId, payload) => client.patch(`/api/feed/ads/${adId}`, payload);
export const deleteFeedAd = (adId) => client.delete(`/api/feed/ads/${adId}`);