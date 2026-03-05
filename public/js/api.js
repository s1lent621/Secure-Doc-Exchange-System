const API_BASE = '/api';

class ApiService {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    }

    async request(endpoint, options = {}) {
        const headers = { ...(options.headers || {}) };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        // Add replay attack mitigation headers for state-changing requests
        if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method.toUpperCase())) {
            headers['x-timestamp'] = Date.now().toString();
            headers['x-nonce'] = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 10);
        }

        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const res = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
        });

        if (res.status === 401) {
            this.setToken(null);
            window.app?.showAuth();
            throw new Error('Session expired');
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    }

    // Auth
    async register(userData) {
        const data = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
        this.setToken(data.token);
        return data;
    }

    async login(username, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
        this.setToken(data.token);
        return data;
    }

    async getMe() {
        return this.request('/auth/me');
    }

    async logout() {
        try { await this.request('/auth/logout', { method: 'POST' }); } catch (e) { }
        this.setToken(null);
    }

    // Documents
    async uploadDocument(file, recipientId, password) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('recipientId', recipientId);
        formData.append('password', password);
        return this.request('/documents/upload', {
            method: 'POST',
            body: formData,
        });
    }

    async getDocuments() {
        return this.request('/documents');
    }

    async downloadDocument(docId, password) {
        return this.request(`/documents/${docId}/download`, {
            method: 'POST',
            body: JSON.stringify({ password }),
        });
    }

    async verifyDocument(docId) {
        return this.request(`/documents/${docId}/verify`);
    }

    async getUsers() {
        return this.request('/documents/users');
    }

    // Admin
    async getAdminUsers() {
        return this.request('/admin/users');
    }

    async updateUserRole(userId, role) {
        return this.request(`/admin/users/${userId}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role }),
        });
    }

    async deactivateUser(userId) {
        return this.request(`/admin/users/${userId}`, { method: 'DELETE' });
    }

    async getAuditLogs(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        return this.request(`/admin/audit-logs?${params}`);
    }

    async getCertificates() {
        return this.request('/admin/certificates');
    }

    async revokeCertificate(serialNumber, reason) {
        return this.request(`/admin/certificates/${serialNumber}/revoke`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
    }

    async getStats() {
        return this.request('/admin/stats');
    }
}

const api = new ApiService();
