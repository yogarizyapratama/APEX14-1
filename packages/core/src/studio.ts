import type { ApexScope } from "./scope.js";
import type { ApexRequestContext } from "@apex14/http";
import { heal } from "./heal.js";
import { workflowRegistry } from "./workflow.js";

function getDb(): any {
  return (globalThis as any).__apex14_db;
}

export interface StudioOptions {
  path?: string;
  title?: string;
}

export function renderStudioHtml(studioPath: string = "/_studio", title: string = "APEX14 Studio"): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card: #111827;
      --border: #1f2937;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --text: #f9fafb;
      --text-muted: #9ca3af;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    #sidebar {
      width: 260px;
      background: var(--card);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
    }
    .brand {
      padding: 20px;
      font-size: 18px;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid var(--border);
    }
    .brand span { color: var(--accent); }
    .nav-links {
      list-style: none;
      padding: 15px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .nav-btn {
      width: 100%;
      text-align: left;
      padding: 10px 14px;
      border-radius: 8px;
      background: transparent;
      color: var(--text-muted);
      border: none;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .nav-btn:hover, .nav-btn.active {
      background: var(--border);
      color: var(--text);
    }
    .nav-btn.active {
      border-left: 3px solid var(--accent);
      color: #fff;
    }
    #content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 24px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    h2 { font-size: 20px; font-weight: 600; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      text-align: left;
    }
    th, td {
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
    }
    th {
      color: var(--text-muted);
      font-weight: 500;
      background: rgba(255,255,255,0.02);
    }
    tr:hover td { background: rgba(255,255,255,0.02); }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-get { background: #064e3b; color: #6ee7b7; }
    .badge-post { background: #1e3a8a; color: #93c5fd; }
    .badge-put { background: #78350f; color: #fde68a; }
    .badge-delete { background: #7f1d1d; color: #fca5a5; }
    .btn-danger {
      background: var(--danger);
      color: white;
      border: none;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
    }
    .btn-action {
      background: var(--accent);
      color: white;
      border: none;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      margin-right: 6px;
    }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
    }
    .stat-val { font-size: 24px; font-weight: 700; margin-top: 8px; color: var(--accent); }
  </style>
</head>
<body>
  <div id="sidebar">
    <div class="brand">⚡ <span>APEX14</span> Studio</div>
    <ul class="nav-links">
      <li><button class="nav-btn active" onclick="switchTab('data')">📁 Data Explorer</button></li>
      <li><button class="nav-btn" onclick="switchTab('routes')">🛣️ Route Registry</button></li>
      <li><button class="nav-btn" onclick="switchTab('tasks')">⚡ Tasks & Queues</button></li>
      <li><button class="nav-btn" onclick="switchTab('workflows')">🔄 Durable Workflows</button></li>
      <li><button class="nav-btn" onclick="switchTab('incidents')">🩺 Incident Replay Lab</button></li>
      <li><button class="nav-btn" onclick="switchTab('system')">📈 System Metrics</button></li>
    </ul>
  </div>

  <div id="content">
    <div class="header">
      <h2 id="view-title">📁 Data Explorer</h2>
      <button class="nav-btn" style="width: auto; background: var(--accent); color: white;" onclick="refreshCurrent()">🔄 Refresh</button>
    </div>

    <div id="view-body">
      <!-- Dynamic View Injected Here -->
    </div>
  </div>

  <script>
    let currentTab = 'data';
    const studioApi = '${studioPath}/api';

    async function switchTab(tab) {
      currentTab = tab;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      event?.target?.classList?.add('active');

      const body = document.getElementById('view-body');
      const title = document.getElementById('view-title');

      if (tab === 'data') {
        title.innerText = '📁 Data Explorer';
        loadDataView();
      } else if (tab === 'routes') {
        title.innerText = '🛣️ Route Registry';
        loadRoutesView();
      } else if (tab === 'tasks') {
        title.innerText = '⚡ Tasks & Queues';
        loadTasksView();
      } else if (tab === 'workflows') {
        title.innerText = '🔄 Durable Workflows';
        loadWorkflowsView();
      } else if (tab === 'incidents') {
        title.innerText = '🩺 Incident Replay Lab';
        loadIncidentsView();
      } else if (tab === 'system') {
        title.innerText = '📈 System Diagnostics';
        loadSystemView();
      }
    }

    function refreshCurrent() {
      switchTab(currentTab);
    }

    async function loadDataView() {
      const body = document.getElementById('view-body');
      body.innerHTML = '<p style="color:var(--text-muted)">Loading tables...</p>';
      try {
        const res = await fetch(studioApi + '/models');
        const tables = await res.json();
        if (!tables.length) {
          body.innerHTML = '<div class="card"><p>No database tables found.</p></div>';
          return;
        }

        let html = '<div class="card" style="margin-bottom:16px"><label style="margin-right:10px">Select Table:</label><select id="tbl-sel" onchange="loadTableRows(this.value)" style="padding:6px 12px;border-radius:6px;background:var(--border);color:var(--text);border:none;">';
        tables.forEach(t => html += '<option value="' + t + '">' + t + '</option>');
        html += '</select></div><div id="table-data" class="card">Loading rows...</div>';
        body.innerHTML = html;
        loadTableRows(tables[0]);
      } catch (err) {
        body.innerHTML = '<div class="card" style="color:var(--danger)">Error: ' + err.message + '</div>';
      }
    }

    async function loadTableRows(tbl) {
      const el = document.getElementById('table-data');
      el.innerHTML = 'Loading ' + tbl + '...';
      try {
        const res = await fetch(studioApi + '/models/' + tbl);
        const rows = await res.json();
        if (!rows.length) {
          el.innerHTML = '<p>Table <strong>' + tbl + '</strong> is empty.</p>';
          return;
        }
        const cols = Object.keys(rows[0]);
        let html = '<table><thead><tr>' + cols.map(c => '<th>' + c + '</th>').join('') + '<th>Actions</th></tr></thead><tbody>';
        rows.forEach(r => {
          html += '<tr>' + cols.map(c => '<td>' + (r[c] !== null ? r[c] : '<em>null</em>') + '</td>').join('');
          html += '<td><button class="btn-danger" onclick="deleteRow(\\'' + tbl + '\\', \\'' + r.id + '\\')">Delete</button></td></tr>';
        });
        html += '</tbody></table>';
        el.innerHTML = html;
      } catch (err) {
        el.innerHTML = 'Error loading rows: ' + err.message;
      }
    }

    async function deleteRow(tbl, id) {
      if (!confirm('Delete record ' + id + '?')) return;
      await fetch(studioApi + '/models/' + tbl + '/' + id, { method: 'DELETE' });
      loadTableRows(tbl);
    }

    async function loadRoutesView() {
      const body = document.getElementById('view-body');
      body.innerHTML = 'Loading routes...';
      const res = await fetch(studioApi + '/routes');
      const routes = await res.json();
      let html = '<div class="card"><table><thead><tr><th>Method</th><th>Path</th><th>Summary</th><th>Guards</th></tr></thead><tbody>';
      routes.forEach(r => {
        const badgeClass = 'badge-' + r.method.toLowerCase();
        html += '<tr><td><span class="badge ' + badgeClass + '">' + r.method + '</span></td><td><strong>' + r.path + '</strong></td><td>' + (r.options?.summary || '-') + '</td><td>' + (r.options?.guard?.join(', ') || 'None') + '</td></tr>';
      });
      html += '</tbody></table></div>';
      body.innerHTML = html;
    }

    async function loadTasksView() {
      const body = document.getElementById('view-body');
      body.innerHTML = 'Loading tasks...';
      const res = await fetch(studioApi + '/tasks');
      const data = await res.json();
      let html = '<div class="grid"><div class="stat-card"><div>Active Queues</div><div class="stat-val">' + data.queues.length + '</div></div><div class="stat-card"><div>Scheduled Cron Jobs</div><div class="stat-val">' + data.schedules.length + '</div></div></div>';
      html += '<div class="card"><h3>Asynchronous Task Queues</h3><table><thead><tr><th>Queue Name</th><th>Status</th></tr></thead><tbody>';
      data.queues.forEach(q => html += '<tr><td><strong>' + q.name + '</strong></td><td><span class="badge" style="background:#064e3b;color:#6ee7b7">Active</span></td></tr>');
      html += '</tbody></table></div>';
      body.innerHTML = html;
    }

    async function loadWorkflowsView() {
      const body = document.getElementById('view-body');
      body.innerHTML = 'Loading workflows...';
      const res = await fetch(studioApi + '/workflows');
      const data = await res.json();
      let html = '<div class="grid"><div class="stat-card"><div>Registered Workflows</div><div class="stat-val">' + data.workflows.length + '</div></div><div class="stat-card"><div>Total Executions</div><div class="stat-val">' + data.totalRuns + '</div></div></div>';
      html += '<div class="card"><h3>Workflow Registry</h3><table><thead><tr><th>Workflow Name</th><th>Total Runs</th><th>Last Status</th></tr></thead><tbody>';
      if (!data.workflows.length) {
        html += '<tr><td colspan="3" style="color:var(--text-muted)">No workflows registered.</td></tr>';
      } else {
        data.workflows.forEach(w => {
          html += '<tr><td><strong>' + w.name + '</strong></td><td>' + w.runs.length + '</td><td><span class="badge" style="background:#1e3a8a;color:#93c5fd">' + (w.runs[0]?.status || 'idle') + '</span></td></tr>';
        });
      }
      html += '</tbody></table></div>';
      body.innerHTML = html;
    }

    async function loadIncidentsView() {
      const body = document.getElementById('view-body');
      body.innerHTML = 'Loading crash incidents...';
      const res = await fetch(studioApi + '/incidents');
      const incidents = await res.json();
      let html = '<div class="card"><h3>Crash & Exception Telemetry</h3>';
      if (!incidents.length) {
        html += '<p style="color:var(--success);margin-top:10px">✔ Zero incidents detected. System is running cleanly!</p></div>';
        body.innerHTML = html;
        return;
      }
      html += '<table><thead><tr><th>Time</th><th>Method</th><th>URL</th><th>Exception</th><th>Replay</th></tr></thead><tbody>';
      incidents.forEach(inc => {
        const replayLabel = inc.replayedAt ? ('Replayed (' + inc.replayStatus + ')') : 'Replay Request';
        html += '<tr><td>' + new Date(inc.timestamp).toLocaleTimeString() + '</td><td><span class="badge badge-delete">' + inc.method + '</span></td><td>' + inc.url + '</td><td><strong>' + inc.error.name + '</strong>: ' + inc.error.message + '</td><td><button class="btn-action" onclick="replayIncident(\\'' + inc.id + '\\')">' + replayLabel + '</button></td></tr>';
      });
      html += '</tbody></table></div>';
      body.innerHTML = html;
    }

    async function replayIncident(id) {
      const btn = event.target;
      btn.innerText = 'Replaying...';
      try {
        const res = await fetch(studioApi + '/incidents/' + id + '/replay', { method: 'POST' });
        const data = await res.json();
        alert('Replay Response Status: ' + data.status + '\\n' + JSON.stringify(data.result, null, 2));
        loadIncidentsView();
      } catch (err) {
        alert('Replay failed: ' + err.message);
      }
    }

    async function loadSystemView() {
      const body = document.getElementById('view-body');
      const res = await fetch(studioApi + '/system');
      const sys = await res.json();
      body.innerHTML = '<div class="grid"><div class="stat-card"><div>Platform / Runtime</div><div class="stat-val" style="font-size:18px">' + sys.runtime + '</div></div><div class="stat-card"><div>Uptime</div><div class="stat-val" style="font-size:18px">' + Math.round(sys.uptime) + 's</div></div><div class="stat-card"><div>Memory Heap</div><div class="stat-val" style="font-size:18px">' + Math.round(sys.memory?.heapUsed / 1024 / 1024) + ' MB</div></div></div>';
    }

    // Initial load
    switchTab('data');
  </script>
</body>
</html>`;
}

export function mountStudio(scope: ApexScope, options: StudioOptions = {}): void {
  const studioPath = options.path || "/_studio";
  const title = options.title || "APEX14 Studio";

  // 1. Studio Dashboard HTML
  scope.route(studioPath, {
    GET: (ctx: ApexRequestContext) => {
      ctx.responseHeaders.set("content-type", "text/html; charset=utf-8");
      return renderStudioHtml(studioPath, title);
    }
  });

  // 2. Studio API: Models List
  scope.route(`${studioPath}/api/models`, {
    GET: async () => {
      const database = getDb();
      return database ? await database.schema.listTables() : [];
    }
  });

  // 3. Studio API: Model Rows
  scope.route(`${studioPath}/api/models/:name`, {
    GET: async ({ params }: ApexRequestContext) => {
      const database = getDb();
      return database ? await database(params.name).limit(50).get() : [];
    }
  });

  // 4. Studio API: Delete Row
  scope.route(`${studioPath}/api/models/:name/:id`, {
    DELETE: async ({ params }: ApexRequestContext) => {
      const database = getDb();
      const res = database ? await database(params.name).deleteById(params.id) : false;
      return { success: res };
    }
  });

  // 5. Studio API: Tasks & Schedules
  scope.route(`${studioPath}/api/tasks`, {
    GET: () => {
      const queues = Array.from(scope.taskQueues.keys()).map((name) => ({ name }));
      return {
        queues,
        schedules: (scope.scheduler as any).jobs || []
      };
    }
  });

  // 6. Studio API: Workflows Registry
  scope.route(`${studioPath}/api/workflows`, {
    GET: () => {
      const list = Array.from(workflowRegistry.values()).map((w) => ({
        name: w.name,
        runs: w.listRuns()
      }));
      const totalRuns = list.reduce((acc, w) => acc + w.runs.length, 0);
      return { workflows: list, totalRuns };
    }
  });

  // 7. Studio API: Incidents Telemetry
  scope.route(`${studioPath}/api/incidents`, {
    GET: () => {
      return heal.listIncidents();
    }
  });

  // 8. Studio API: Incident Replay Action
  scope.route(`${studioPath}/api/incidents/:id/replay`, {
    POST: async ({ params }: ApexRequestContext) => {
      return await heal.replay(params.id, scope);
    }
  });

  // 9. Studio API: Routes Registry
  scope.route(`${studioPath}/api/routes`, {
    GET: () => {
      return scope.routesManifest.map((r) => ({
        path: r.path,
        method: r.method,
        options: {
          summary: r.options?.summary,
          guard: r.options?.guard,
          tags: r.options?.tags
        }
      }));
    }
  });

  // 10. Studio API: System Diagnostics
  scope.route(`${studioPath}/api/system`, {
    GET: () => {
      return {
        runtime: typeof (globalThis as any).Bun !== "undefined" ? "Bun" : `Node.js (${process.version})`,
        uptime: process.uptime(),
        memory: process.memoryUsage ? process.memoryUsage() : null
      };
    }
  });
}
