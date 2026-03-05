class App {
    constructor() {
        this.user = null;
        this.currentPage = 'dashboard';
        this.documents = { sent: [], received: [] };
        this.init();
    }

    async init() {
        if (api.token) {
            try {
                const data = await api.getMe();
                this.user = data.user;
                this.showApp();
            } catch (e) {
                this.showAuth();
            }
        } else {
            this.showAuth();
        }
    }

    // ===== Toast Notifications =====
    toast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { success: '✓', error: '✗', info: 'ℹ' };
        toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
    }

    // ===== Auth =====
    showAuth() {
        this.user = null;
        document.getElementById('authSection').classList.remove('hidden');
        document.getElementById('appSection').classList.add('hidden');
        this.showLogin();
    }

    showLogin() {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
    }

    showRegister() {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
    }

    async handleLogin(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Signing in...';
        try {
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            const data = await api.login(username, password);
            this.user = data.user;
            this.toast('Welcome back, ' + this.user.fullName + '!', 'success');
            this.showApp();
        } catch (err) {
            this.toast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '🔓 Sign In';
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Creating account...';
        try {
            const userData = {
                username: document.getElementById('regUsername').value,
                email: document.getElementById('regEmail').value,
                password: document.getElementById('regPassword').value,
                fullName: document.getElementById('regFullName').value,
                role: document.getElementById('regRole').value,
            };
            const data = await api.register(userData);
            this.user = data.user;
            this.toast('Account created! RSA keys generated.', 'success');
            this.showApp();
        } catch (err) {
            this.toast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '🔐 Create Secure Account';
        }
    }

    async handleLogout() {
        await api.logout();
        this.toast('Logged out securely', 'info');
        this.showAuth();
    }

    // ===== App Layout =====
    showApp() {
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('appSection').classList.remove('hidden');
        this.renderSidebar();
        this.navigate('dashboard');
    }

    renderSidebar() {
        const initials = this.user.fullName ? this.user.fullName.split(' ').map(n => n[0]).join('').toUpperCase() : '?';
        const isAdmin = this.user.role === 'admin';

        document.getElementById('sidebar').innerHTML = `
      <div class="sidebar-header">
        <div class="logo">
          <div class="logo-icon">🔐</div>
          <div>
            <div class="logo-text">SecureDoc</div>
            <div class="logo-sub">Document Exchange</div>
          </div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title">Main</div>
          <div class="nav-item ${this.currentPage === 'dashboard' ? 'active' : ''}" onclick="app.navigate('dashboard')">
            <span class="nav-icon">📊</span> Dashboard
          </div>
          <div class="nav-item ${this.currentPage === 'upload' ? 'active' : ''}" onclick="app.navigate('upload')">
            <span class="nav-icon">📤</span> Upload Document
          </div>
          <div class="nav-item ${this.currentPage === 'documents' ? 'active' : ''}" onclick="app.navigate('documents')">
            <span class="nav-icon">📁</span> My Documents
          </div>
        </div>
        ${isAdmin ? `
        <div class="nav-section">
          <div class="nav-section-title">Administration</div>
          <div class="nav-item ${this.currentPage === 'users' ? 'active' : ''}" onclick="app.navigate('users')">
            <span class="nav-icon">👥</span> User Management
          </div>
          <div class="nav-item ${this.currentPage === 'certificates' ? 'active' : ''}" onclick="app.navigate('certificates')">
            <span class="nav-icon">📜</span> Certificates
          </div>
          <div class="nav-item ${this.currentPage === 'audit' ? 'active' : ''}" onclick="app.navigate('audit')">
            <span class="nav-icon">📋</span> Audit Logs
          </div>
        </div>` : ''}
      </nav>
      <div class="sidebar-footer">
        <div class="user-info" onclick="app.handleLogout()">
          <div class="user-avatar">${initials}</div>
          <div class="user-details">
            <div class="user-name">${this.user.fullName || this.user.username}</div>
            <div class="user-role">${this.user.role}</div>
          </div>
          <span style="color: var(--text-muted);">⏻</span>
        </div>
      </div>
    `;
    }

    navigate(page) {
        this.currentPage = page;
        this.renderSidebar();
        const content = document.getElementById('mainContent');
        switch (page) {
            case 'dashboard': this.renderDashboard(content); break;
            case 'upload': this.renderUpload(content); break;
            case 'documents': this.renderDocuments(content); break;
            case 'users': this.renderUsers(content); break;
            case 'certificates': this.renderCertificates(content); break;
            case 'audit': this.renderAuditLogs(content); break;
        }
    }

    // ===== Dashboard =====
    async renderDashboard(el) {
        el.innerHTML = `
      <div class="page-header">
        <h2>📊 Dashboard</h2>
        <p>Welcome back, ${this.user.fullName || this.user.username}. Here's your security overview.</p>
      </div>
      <div id="dashboardStats" class="stats-grid">
        <div class="stat-card"><div class="stat-value"><span class="spinner"></span></div><div class="stat-label">Loading...</div></div>
      </div>
      <div class="grid-2" id="dashboardContent"></div>
    `;

        try {
            const docs = await api.getDocuments();
            this.documents = docs;
            const sent = docs.sent.length;
            const received = docs.received.length;
            const pending = docs.received.filter(d => d.status === 'pending').length;

            let statsHtml = `
        <div class="stat-card">
          <div class="stat-icon purple">📤</div>
          <div class="stat-value">${sent}</div>
          <div class="stat-label">Documents Sent</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">📥</div>
          <div class="stat-value">${received}</div>
          <div class="stat-label">Documents Received</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">⏳</div>
          <div class="stat-value">${pending}</div>
          <div class="stat-label">Pending Download</div>
        </div>
      `;

            if (this.user.role === 'admin') {
                try {
                    const { stats } = await api.getStats();
                    statsHtml += `
            <div class="stat-card">
              <div class="stat-icon blue">👥</div>
              <div class="stat-value">${stats.totalUsers}</div>
              <div class="stat-label">Total Users</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon red">📜</div>
              <div class="stat-value">${stats.totalCerts}</div>
              <div class="stat-label">Certificates Issued</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon orange">🔍</div>
              <div class="stat-value">${stats.recentLogs}</div>
              <div class="stat-label">Actions (24h)</div>
            </div>
          `;
                } catch (e) { }
            }

            document.getElementById('dashboardStats').innerHTML = statsHtml;

            // Recent documents
            const recentReceived = docs.received.slice(0, 5);
            const recentSent = docs.sent.slice(0, 5);

            document.getElementById('dashboardContent').innerHTML = `
        <div class="card">
          <div class="card-header"><h3>📥 Recent Received</h3></div>
          ${recentReceived.length ? recentReceived.map(d => `
            <div class="doc-item" style="cursor:pointer" onclick="app.navigate('documents')">
              <div class="doc-icon">📄</div>
              <div class="doc-details">
                <div class="doc-name">${this.escapeHtml(d.original_name)}</div>
                <div class="doc-meta">
                  <span>From: ${this.escapeHtml(d.sender_full_name || d.sender_name)}</span>
                  <span>${this.formatSize(d.file_size)}</span>
                </div>
              </div>
              <span class="badge badge-${d.status}">${d.status}</span>
            </div>
          `).join('') : '<div class="empty-state"><div class="empty-icon">📭</div><p>No documents received yet</p></div>'}
        </div>
        <div class="card">
          <div class="card-header"><h3>📤 Recent Sent</h3></div>
          ${recentSent.length ? recentSent.map(d => `
            <div class="doc-item" style="cursor:pointer" onclick="app.navigate('documents')">
              <div class="doc-icon">📄</div>
              <div class="doc-details">
                <div class="doc-name">${this.escapeHtml(d.original_name)}</div>
                <div class="doc-meta">
                  <span>To: ${this.escapeHtml(d.recipient_full_name || d.recipient_name)}</span>
                  <span>${this.formatSize(d.file_size)}</span>
                </div>
              </div>
              <span class="badge badge-${d.status}">${d.status}</span>
            </div>
          `).join('') : '<div class="empty-state"><div class="empty-icon">📭</div><p>No documents sent yet</p></div>'}
        </div>
      `;
        } catch (err) {
            this.toast(err.message, 'error');
        }
    }

    // ===== Upload =====
    async renderUpload(el) {
        el.innerHTML = `
      <div class="page-header">
        <h2>📤 Upload Document</h2>
        <p>Securely encrypt and send a document to a recipient.</p>
      </div>
      <div class="card">
        <div class="card-header"><h3>🔐 Secure Upload</h3></div>
        <div class="crypto-flow" id="cryptoFlow">
          <div class="crypto-step" id="step-select"><div class="step-icon">📄</div><div class="step-label">Select File</div></div>
          <div class="crypto-arrow">→</div>
          <div class="crypto-step" id="step-aes"><div class="step-icon">🔑</div><div class="step-label">AES-256</div></div>
          <div class="crypto-arrow">→</div>
          <div class="crypto-step" id="step-rsa"><div class="step-icon">🔒</div><div class="step-label">RSA-2048</div></div>
          <div class="crypto-arrow">→</div>
          <div class="crypto-step" id="step-hash"><div class="step-icon">#️⃣</div><div class="step-label">SHA-256</div></div>
          <div class="crypto-arrow">→</div>
          <div class="crypto-step" id="step-sign"><div class="step-icon">✍️</div><div class="step-label">Sign</div></div>
          <div class="crypto-arrow">→</div>
          <div class="crypto-step" id="step-store"><div class="step-icon">💾</div><div class="step-label">Store</div></div>
        </div>
        <form id="uploadForm" onsubmit="app.handleUpload(event)">
          <div class="upload-zone" id="uploadZone" onclick="document.getElementById('fileInput').click()">
            <input type="file" id="fileInput" style="display:none" onchange="app.handleFileSelect(this)">
            <div class="upload-icon">📁</div>
            <h4>Drop file here or click to browse</h4>
            <p>Maximum file size: 50MB</p>
            <div class="file-info hidden" id="fileInfo"></div>
          </div>
          <div class="grid-2 mt-3">
            <div class="form-group">
              <label>Recipient</label>
              <select class="form-control" id="recipientSelect" required>
                <option value="">Loading users...</option>
              </select>
            </div>
            <div class="form-group">
              <label>Your Password (to sign)</label>
              <input type="password" class="form-control" id="uploadPassword" placeholder="Enter your password" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-block mt-2" id="uploadBtn">
            🔐 Encrypt & Upload
          </button>
        </form>
      </div>
    `;

        // Setup drag and drop
        const zone = document.getElementById('uploadZone');
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                document.getElementById('fileInput').files = e.dataTransfer.files;
                this.handleFileSelect(document.getElementById('fileInput'));
            }
        });

        // Load recipients
        try {
            const { users } = await api.getUsers();
            const select = document.getElementById('recipientSelect');
            select.innerHTML = '<option value="">Select recipient...</option>' +
                users.map(u => `<option value="${u.id}">${this.escapeHtml(u.full_name)} (${u.role})</option>`).join('');
        } catch (err) {
            this.toast('Failed to load users', 'error');
        }
    }

    handleFileSelect(input) {
        const file = input.files[0];
        if (file) {
            const info = document.getElementById('fileInfo');
            info.classList.remove('hidden');
            info.textContent = `📎 ${file.name} (${this.formatSize(file.size)})`;
            document.getElementById('step-select').classList.add('done');
        }
    }

    async handleUpload(e) {
        e.preventDefault();
        const fileInput = document.getElementById('fileInput');
        const recipientId = document.getElementById('recipientSelect').value;
        const password = document.getElementById('uploadPassword').value;
        const btn = document.getElementById('uploadBtn');

        if (!fileInput.files[0]) { this.toast('Select a file first', 'error'); return; }
        if (!recipientId) { this.toast('Select a recipient', 'error'); return; }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Encrypting & uploading...';

        // Animate crypto steps
        const steps = ['step-aes', 'step-rsa', 'step-hash', 'step-sign', 'step-store'];
        let i = 0;
        const interval = setInterval(() => {
            if (i < steps.length) {
                document.getElementById(steps[i]).classList.add('active');
                if (i > 0) {
                    document.getElementById(steps[i - 1]).classList.remove('active');
                    document.getElementById(steps[i - 1]).classList.add('done');
                }
                i++;
            }
        }, 600);

        try {
            const result = await api.uploadDocument(fileInput.files[0], recipientId, password);
            clearInterval(interval);
            steps.forEach(s => {
                document.getElementById(s).classList.remove('active');
                document.getElementById(s).classList.add('done');
            });
            this.toast('Document encrypted and uploaded securely!', 'success');
            setTimeout(() => this.navigate('documents'), 1500);
        } catch (err) {
            clearInterval(interval);
            this.toast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '🔐 Encrypt & Upload';
        }
    }

    // ===== Documents =====
    async renderDocuments(el) {
        el.innerHTML = `
      <div class="page-header">
        <h2>📁 My Documents</h2>
        <p>View and manage your encrypted documents.</p>
      </div>
      <div class="tabs">
        <button class="tab active" onclick="app.switchDocTab('received', this)">📥 Received</button>
        <button class="tab" onclick="app.switchDocTab('sent', this)">📤 Sent</button>
      </div>
      <div id="docList"><div class="flex-center mt-3"><span class="spinner"></span></div></div>
    `;

        try {
            const docs = await api.getDocuments();
            this.documents = docs;
            this.renderDocList('received');
        } catch (err) {
            this.toast(err.message, 'error');
        }
    }

    switchDocTab(tab, btnEl) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        btnEl.classList.add('active');
        this.renderDocList(tab);
    }

    renderDocList(type) {
        const docs = this.documents[type] || [];
        const el = document.getElementById('docList');

        if (!docs.length) {
            el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><h4>No documents ${type}</h4><p>Documents will appear here when ${type === 'received' ? 'someone sends you a file' : 'you upload a file'}.</p></div>`;
            return;
        }

        el.innerHTML = docs.map(d => {
            const otherName = type === 'received'
                ? (d.sender_full_name || d.sender_name)
                : (d.recipient_full_name || d.recipient_name);
            const label = type === 'received' ? 'From' : 'To';

            return `
        <div class="doc-item">
          <div class="doc-icon">📄</div>
          <div class="doc-details">
            <div class="doc-name">${this.escapeHtml(d.original_name)}</div>
            <div class="doc-meta">
              <span>${label}: ${this.escapeHtml(otherName)}</span>
              <span>${this.formatSize(d.file_size)}</span>
              <span>${this.formatDate(d.created_at)}</span>
            </div>
          </div>
          <span class="badge badge-${d.status}">${d.status}</span>
          <div class="doc-actions">
            ${type === 'received' ? `<button class="btn btn-primary btn-sm" onclick="app.showDownloadModal('${d.id}', '${this.escapeHtml(d.original_name)}')">📥 Download</button>` : ''}
            <button class="btn btn-secondary btn-sm" onclick="app.verifyDoc('${d.id}')">🔍 Verify</button>
          </div>
        </div>
      `;
        }).join('');
    }

    // ===== Download Modal =====
    showDownloadModal(docId, docName) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'activeModal';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>📥 Decrypt & Download</h3>
          <button class="modal-close" onclick="document.getElementById('activeModal').remove()">✕</button>
        </div>
        <p style="color: var(--text-secondary); margin-bottom: 20px;">Enter your password to decrypt your private key and download <strong>${docName}</strong>.</p>
        <div class="crypto-flow" style="padding: 12px;">
          <div class="crypto-step"><div class="step-icon">🔑</div><div class="step-label">RSA Decrypt Key</div></div>
          <div class="crypto-arrow">→</div>
          <div class="crypto-step"><div class="step-icon">🔓</div><div class="step-label">AES Decrypt</div></div>
          <div class="crypto-arrow">→</div>
          <div class="crypto-step"><div class="step-icon">✅</div><div class="step-label">Verify Sig</div></div>
        </div>
        <form onsubmit="app.handleDownload(event, '${docId}')">
          <div class="form-group">
            <label>Your Password</label>
            <input type="password" class="form-control" id="downloadPassword" placeholder="Enter your password" required autofocus>
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="downloadBtn">🔓 Decrypt & Download</button>
        </form>
        <div id="downloadResult"></div>
      </div>
    `;
        document.body.appendChild(overlay);
    }

    async handleDownload(e, docId) {
        e.preventDefault();
        const password = document.getElementById('downloadPassword').value;
        const btn = document.getElementById('downloadBtn');
        const resultEl = document.getElementById('downloadResult');

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Decrypting...';

        try {
            const { document: doc } = await api.downloadDocument(docId, password);

            // Show verification results
            resultEl.innerHTML = `
        <div class="verify-result ${doc.integrityValid && doc.signatureValid ? 'success' : 'failure'}">
          <div class="verify-item">
            <span class="${doc.integrityValid ? 'check' : 'cross'}">${doc.integrityValid ? '✓' : '✗'}</span>
            <span>File Integrity (SHA-256): ${doc.integrityValid ? 'VALID' : 'TAMPERED'}</span>
          </div>
          <div class="verify-item">
            <span class="${doc.signatureValid ? 'check' : 'cross'}">${doc.signatureValid ? '✓' : '✗'}</span>
            <span>Digital Signature (RSA): ${doc.signatureValid ? 'VALID' : 'INVALID'}</span>
          </div>
        </div>
      `;

            // Trigger download
            const binaryData = atob(doc.data);
            const bytes = new Uint8Array(binaryData.length);
            for (let i = 0; i < binaryData.length; i++) bytes[i] = binaryData.charCodeAt(i);
            const blob = new Blob([bytes], { type: doc.mimeType || 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.originalName;
            a.click();
            URL.revokeObjectURL(url);

            this.toast('Document decrypted and downloaded!', 'success');
            this.navigate('documents');
        } catch (err) {
            resultEl.innerHTML = `<div class="verify-result failure"><div class="verify-item"><span class="cross">✗</span><span>${err.message}</span></div></div>`;
            this.toast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '🔓 Decrypt & Download';
        }
    }

    // ===== Verify Document =====
    async verifyDoc(docId) {
        try {
            const { verification } = await api.verifyDocument(docId);
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.id = 'activeModal';
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
            overlay.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h3>🔍 Verification Report</h3>
            <button class="modal-close" onclick="document.getElementById('activeModal').remove()">✕</button>
          </div>
          <div class="verify-result ${verification.signatureValid && verification.certificateValid ? 'success' : 'failure'}">
            <div class="verify-item">
              <span class="${verification.signatureValid ? 'check' : 'cross'}">${verification.signatureValid ? '✓' : '✗'}</span>
              <span>Digital Signature: ${verification.signatureValid ? 'VALID' : 'INVALID'}</span>
            </div>
            <div class="verify-item">
              <span class="${verification.certificateValid ? 'check' : 'cross'}">${verification.certificateValid ? '✓' : '✗'}</span>
              <span>Sender Certificate: ${verification.certificateValid ? 'VALID' : verification.certificateReason}</span>
            </div>
            <div class="verify-item">
              <span class="${verification.fileExists ? 'check' : 'cross'}">${verification.fileExists ? '✓' : '✗'}</span>
              <span>Encrypted File: ${verification.fileExists ? 'EXISTS' : 'MISSING'}</span>
            </div>
          </div>
          <div class="mt-2" style="font-size: 13px; color: var(--text-secondary);">
            <p><strong>Document:</strong> ${this.escapeHtml(verification.originalName)}</p>
            <p><strong>Sender:</strong> ${this.escapeHtml(verification.senderName)} (${this.escapeHtml(verification.senderUsername)})</p>
            <p><strong>Hash (SHA-256):</strong> <code style="font-size: 11px; word-break: break-all;">${verification.fileHash}</code></p>
            <p><strong>Uploaded:</strong> ${this.formatDate(verification.uploadedAt)}</p>
          </div>
        </div>
      `;
            document.body.appendChild(overlay);
        } catch (err) {
            this.toast(err.message, 'error');
        }
    }

    // ===== Admin: Users =====
    async renderUsers(el) {
        if (this.user.role !== 'admin') { this.navigate('dashboard'); return; }
        el.innerHTML = `
      <div class="page-header"><h2>👥 User Management</h2><p>Manage users and their roles.</p></div>
      <div class="card"><div id="usersTable"><div class="flex-center mt-3"><span class="spinner"></span></div></div></div>
    `;
        try {
            const { users } = await api.getAdminUsers();
            document.getElementById('usersTable').innerHTML = `
        <div class="table-container">
          <table>
            <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td><strong>${this.escapeHtml(u.full_name)}</strong><br><span style="color:var(--text-muted);font-size:12px">@${this.escapeHtml(u.username)}</span></td>
                  <td>${this.escapeHtml(u.email)}</td>
                  <td><span class="badge badge-${u.role}">${u.role}</span></td>
                  <td><span class="badge ${u.is_active ? 'badge-active' : 'badge-revoked'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>${this.formatDate(u.created_at)}</td>
                  <td>
                    <select class="form-control" style="width:auto;display:inline-block;padding:6px 10px;font-size:12px" onchange="app.changeRole('${u.id}',this.value)" ${u.id === this.user.id ? 'disabled' : ''}>
                      <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                      <option value="lawyer" ${u.role === 'lawyer' ? 'selected' : ''}>Lawyer</option>
                      <option value="client" ${u.role === 'client' ? 'selected' : ''}>Client</option>
                    </select>
                    ${u.id !== this.user.id ? `<button class="btn btn-danger btn-sm" style="margin-left:8px" onclick="app.deactivateUser('${u.id}')">Deactivate</button>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
        } catch (err) { this.toast(err.message, 'error'); }
    }

    async changeRole(userId, role) {
        try {
            await api.updateUserRole(userId, role);
            this.toast('Role updated', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
    }

    async deactivateUser(userId) {
        if (!confirm('Deactivate this user?')) return;
        try {
            await api.deactivateUser(userId);
            this.toast('User deactivated', 'success');
            this.navigate('users');
        } catch (err) { this.toast(err.message, 'error'); }
    }

    // ===== Admin: Certificates =====
    async renderCertificates(el) {
        if (this.user.role !== 'admin') { this.navigate('dashboard'); return; }
        el.innerHTML = `
      <div class="page-header"><h2>📜 Certificate Management</h2><p>Manage PKI certificates and revocations.</p></div>
      <div class="card"><div id="certsTable"><div class="flex-center mt-3"><span class="spinner"></span></div></div></div>
    `;
        try {
            const { certificates } = await api.getCertificates();
            document.getElementById('certsTable').innerHTML = `
        <div class="table-container">
          <table>
            <thead><tr><th>User</th><th>Serial Number</th><th>Subject</th><th>Issued</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${certificates.map(c => `
                <tr>
                  <td><strong>${this.escapeHtml(c.full_name)}</strong><br><span style="color:var(--text-muted);font-size:12px">@${this.escapeHtml(c.username)}</span></td>
                  <td><code style="font-size:11px">${c.serial_number.substring(0, 12)}...</code></td>
                  <td style="font-size:12px">${this.escapeHtml(c.subject)}</td>
                  <td>${this.formatDate(c.issued_at)}</td>
                  <td>${this.formatDate(c.expires_at)}</td>
                  <td><span class="badge ${c.revoked ? 'badge-revoked' : 'badge-valid'}">${c.revoked ? 'Revoked' : 'Valid'}</span></td>
                  <td>${!c.revoked ? `<button class="btn btn-danger btn-sm" onclick="app.showRevokeModal('${c.serial_number}')">Revoke</button>` : `<span style="font-size:12px;color:var(--text-muted)">${this.escapeHtml(c.revoked_reason || '')}</span>`}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
        } catch (err) { this.toast(err.message, 'error'); }
    }

    showRevokeModal(serialNumber) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'activeModal';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>⚠️ Revoke Certificate</h3>
          <button class="modal-close" onclick="document.getElementById('activeModal').remove()">✕</button>
        </div>
        <p style="color: var(--text-secondary); margin-bottom: 20px;">This action cannot be undone. The user will need a new certificate issued.</p>
        <form onsubmit="app.handleRevoke(event, '${serialNumber}')">
          <div class="form-group">
            <label>Reason for Revocation</label>
            <input type="text" class="form-control" id="revokeReason" placeholder="e.g., Key compromise, User left firm" required>
          </div>
          <button type="submit" class="btn btn-danger btn-block">Revoke Certificate</button>
        </form>
      </div>
    `;
        document.body.appendChild(overlay);
    }

    async handleRevoke(e, serialNumber) {
        e.preventDefault();
        const reason = document.getElementById('revokeReason').value;
        try {
            await api.revokeCertificate(serialNumber, reason);
            document.getElementById('activeModal').remove();
            this.toast('Certificate revoked', 'success');
            this.navigate('certificates');
        } catch (err) { this.toast(err.message, 'error'); }
    }

    // ===== Admin: Audit Logs =====
    async renderAuditLogs(el) {
        if (this.user.role !== 'admin') { this.navigate('dashboard'); return; }
        el.innerHTML = `
      <div class="page-header"><h2>📋 Audit Logs</h2><p>Track all security-relevant actions in the system.</p></div>
      <div class="card">
        <div class="card-header">
          <h3>Security Event Log</h3>
          <select class="form-control" style="width:auto;padding:8px 12px;font-size:13px" onchange="app.filterAuditLogs(this.value)">
            <option value="">All Actions</option>
            <option value="USER_REGISTERED">Registration</option>
            <option value="USER_LOGIN">Login</option>
            <option value="USER_LOGOUT">Logout</option>
            <option value="DOCUMENT_UPLOADED">Upload</option>
            <option value="DOCUMENT_DOWNLOADED">Download</option>
            <option value="DOCUMENT_VERIFIED">Verify</option>
            <option value="CERTIFICATE_REVOKED">Cert Revoked</option>
            <option value="USER_ROLE_UPDATED">Role Updated</option>
          </select>
        </div>
        <div id="auditTable"><div class="flex-center mt-3"><span class="spinner"></span></div></div>
      </div>
    `;
        this.loadAuditLogs();
    }

    async filterAuditLogs(action) {
        this.loadAuditLogs(action ? { action } : {});
    }

    async loadAuditLogs(filters = {}) {
        try {
            const { logs } = await api.getAuditLogs(filters);
            document.getElementById('auditTable').innerHTML = `
        <div class="table-container">
          <table>
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>Details</th><th>IP</th></tr></thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td style="font-size:12px;white-space:nowrap">${this.formatDate(l.created_at)}</td>
                  <td>${this.escapeHtml(l.full_name || l.username || 'System')}</td>
                  <td><span class="badge badge-${this.getActionBadge(l.action)}">${l.action}</span></td>
                  <td style="font-size:12px">${l.target_type || ''} ${l.target_id ? l.target_id.substring(0, 8) + '...' : ''}</td>
                  <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis">${this.escapeHtml(l.details || '')}</td>
                  <td style="font-size:12px">${l.ip_address || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
        } catch (err) { this.toast(err.message, 'error'); }
    }

    getActionBadge(action) {
        const map = {
            USER_REGISTERED: 'active', USER_LOGIN: 'valid', USER_LOGOUT: 'pending',
            DOCUMENT_UPLOADED: 'lawyer', DOCUMENT_DOWNLOADED: 'downloaded', DOCUMENT_VERIFIED: 'verified',
            CERTIFICATE_REVOKED: 'revoked', USER_ROLE_UPDATED: 'admin', USER_DEACTIVATED: 'revoked',
        };
        return map[action] || 'pending';
    }

    // ===== Helpers =====
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    formatSize(bytes) {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + sizes[i];
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) +
            ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
}

// Initialize app
let app;
document.addEventListener('DOMContentLoaded', () => { app = new App(); });
