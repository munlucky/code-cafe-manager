// CodeCafe Manager UI
const views = {
  dashboard: renderDashboard,
  'new-order': renderNewOrder,
  orders: renderOrders,
  baristas: renderBaristas,
};

let currentView = 'dashboard';

document.querySelectorAll('[data-view]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const view = e.target.dataset.view;
    switchView(view);
  });
});

function switchView(view) {
  currentView = view;
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  const title = view.charAt(0).toUpperCase() + view.slice(1).replace('-', ' ');
  document.getElementById('view-title').textContent = title;
  views[view]();
}

async function renderDashboard() {
  const baristas = await window.codecafe.getAllBaristas();
  const orders = await window.codecafe.getAllOrders();
  const content = document.getElementById('content');
  content.innerHTML = '';

  const idleCount = baristas.filter((b) => b.status === 'IDLE').length;
  const runningCount = baristas.filter((b) => b.status === 'RUNNING').length;
  const pendingOrders = orders.filter((o) => o.status === 'PENDING').length;
  const runningOrders = orders.filter((o) => o.status === 'RUNNING').length;
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED').length;
  const failedOrders = orders.filter((o) => o.status === 'FAILED').length;

  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.innerHTML = `
    <div class="card">
      <h3>Baristas</h3>
      <div style="font-size: 32px; font-weight: bold; color: #8b7355;">${baristas.length}</div>
      <div style="margin-top: 10px; color: #999;">
        <div>Idle: ${idleCount} | Running: ${runningCount}</div>
      </div>
    </div>
    <div class="card">
      <h3>Orders</h3>
      <div style="font-size: 32px; font-weight: bold; color: #8b7355;">${orders.length}</div>
      <div style="margin-top: 10px; color: #999;">
        <div>Pending: ${pendingOrders} | Running: ${runningOrders}</div>
        <div>Completed: ${completedOrders} | Failed: ${failedOrders}</div>
      </div>
    </div>
  `;
  content.appendChild(grid);

  const recentCard = document.createElement('div');
  recentCard.className = 'card';
  recentCard.innerHTML = '<h3>Recent Orders</h3>';
  if (orders.length === 0) {
    recentCard.innerHTML += '<div class="empty-state">No orders yet</div>';
  } else {
    orders.slice(-5).reverse().forEach((order) => {
      const orderDiv = document.createElement('div');
      orderDiv.className = 'order-item ' + order.status.toLowerCase();
      orderDiv.innerHTML = `
        <div style="font-weight: 600;">${order.recipeName}</div>
        <div style="font-size: 12px; color: #999; margin-top: 4px;">${order.id} - ${order.status}</div>
      `;
      recentCard.appendChild(orderDiv);
    });
  }
  content.appendChild(recentCard);
}

async function renderNewOrder() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card" style="max-width: 600px;">
      <h3>Create New Order</h3>
      <form id="new-order-form" style="margin-top: 20px;">
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px;">Recipe</label>
          <input type="text" id="recipe-name" value="house-blend-pm-agent" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; color: #e0e0e0;" />
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px;">Counter (Project Path)</label>
          <input type="text" id="counter" value="." style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; color: #e0e0e0;" />
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px;">Provider</label>
          <select id="provider" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; color: #e0e0e0;">
            <option value="claude-code">claude-code</option>
            <option value="codex">codex</option>
          </select>
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 5px;">Issue / Task</label>
          <textarea id="issue" rows="4" placeholder="Describe your task..." style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; color: #e0e0e0;"></textarea>
        </div>
        <button type="submit" class="btn">Create Order</button>
      </form>
    </div>
  `;

  document.getElementById('new-order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const recipeName = document.getElementById('recipe-name').value;
    const counter = document.getElementById('counter').value;
    const provider = document.getElementById('provider').value;
    const issue = document.getElementById('issue').value;

    try {
      await window.codecafe.createOrder({
        recipeId: recipeName,
        recipeName: recipeName,
        counter: counter,
        provider: provider,
        vars: { issue: issue },
      });
      alert('Order created successfully!');
      switchView('orders');
    } catch (error) {
      alert('Failed to create order: ' + error.message);
    }
  });
}

async function renderOrders() {
  const orders = await window.codecafe.getAllOrders();
  const content = document.getElementById('content');
  content.innerHTML = '<div class="card"><h3>All Orders</h3></div>';
  const card = content.querySelector('.card');

  if (orders.length === 0) {
    card.innerHTML += '<div class="empty-state">No orders yet. Create one from New Order.</div>';
  } else {
    orders.reverse().forEach((order) => {
      const orderDiv = document.createElement('div');
      orderDiv.className = 'order-item ' + order.status.toLowerCase();
      orderDiv.style.cursor = 'pointer';
      orderDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600;">${order.recipeName}</div>
            <div style="font-size: 12px; color: #999; margin-top: 4px;">${order.id}</div>
          </div>
          <span class="status-badge">${order.status}</span>
        </div>
      `;
      orderDiv.addEventListener('click', () => viewOrderDetail(order.id));
      card.appendChild(orderDiv);
    });
  }
}

async function viewOrderDetail(orderId) {
  const order = await window.codecafe.getOrder(orderId);
  const log = await window.codecafe.getOrderLog(orderId);
  const content = document.getElementById('content');

  content.innerHTML = `
    <div class="card">
      <h3>Order Detail</h3>
      <div style="margin-top: 20px;">
        <div style="margin-bottom: 10px;"><strong>ID:</strong> ${order.id}</div>
        <div style="margin-bottom: 10px;"><strong>Recipe:</strong> ${order.recipeName}</div>
        <div style="margin-bottom: 10px;"><strong>Status:</strong> <span class="status-badge">${order.status}</span></div>
        <div style="margin-bottom: 10px;"><strong>Counter:</strong> ${order.counter}</div>
        <div style="margin-bottom: 10px;"><strong>Provider:</strong> ${order.provider}</div>
        ${order.baristaId ? '<div style="margin-bottom: 10px;"><strong>Barista:</strong> ' + order.baristaId + '</div>' : ''}
      </div>
      <h3 style="margin-top: 30px;">Logs</h3>
      <pre style="background: #1a1a1a; padding: 15px; border-radius: 4px; overflow-x: auto; max-height: 400px; font-size: 12px;">${log || 'No logs yet'}</pre>
      <div style="margin-top: 20px;">
        <button class="btn btn-secondary" id="back-btn">Back to Orders</button>
        ${(order.status === 'RUNNING' || order.status === 'PENDING') ? '<button class="btn" id="cancel-btn" style="margin-left: 10px;">Cancel Order</button>' : ''}
      </div>
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => switchView('orders'));
  const cancelBtn = document.getElementById('cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to cancel this order?')) {
        try {
          await window.codecafe.cancelOrder(orderId);
          alert('Order cancelled');
          switchView('orders');
        } catch (error) {
          alert('Failed to cancel order: ' + error.message);
        }
      }
    });
  }
}

async function renderBaristas() {
  const baristas = await window.codecafe.getAllBaristas();
  const content = document.getElementById('content');

  content.innerHTML = `
    <div style="margin-bottom: 20px;">
      <button class="btn" id="create-barista-btn">Create Barista</button>
    </div>
    <div class="card">
      <h3>All Baristas</h3>
    </div>
  `;

  const card = content.querySelector('.card');
  if (baristas.length === 0) {
    card.innerHTML += '<div class="empty-state">No baristas yet. Create one to start processing orders.</div>';
  } else {
    baristas.forEach((barista) => {
      const baristaDiv = document.createElement('div');
      baristaDiv.className = 'barista-item ' + barista.status.toLowerCase();
      baristaDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600;">${barista.id}</div>
            <div style="font-size: 12px; color: #999; margin-top: 4px;">Provider: ${barista.provider} | Status: ${barista.status}</div>
            ${barista.currentOrderId ? '<div style="font-size: 11px; color: #666; margin-top: 2px;">Order: ' + barista.currentOrderId + '</div>' : ''}
          </div>
        </div>
      `;
      card.appendChild(baristaDiv);
    });
  }

  document.getElementById('create-barista-btn').addEventListener('click', () => {
    // 기존 모달 제거
    const existingModal = document.getElementById('barista-modal');
    if (existingModal) existingModal.remove();

    // 모달 생성
    const modal = document.createElement('div');
    modal.id = 'barista-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000;';
    modal.innerHTML = `
      <div style="background: #252525; padding: 30px; border-radius: 8px; border: 1px solid #333; width: 400px;">
        <h3 style="margin-bottom: 20px; color: #8b7355;">Create Barista</h3>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; color: #e0e0e0;">Provider</label>
          <select id="provider-select" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; color: #e0e0e0;">
            <option value="claude-code">claude-code</option>
            <option value="codex">codex</option>
          </select>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn" id="modal-create-btn">Create</button>
          <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('modal-cancel-btn').addEventListener('click', () => {
      modal.remove();
    });

    document.getElementById('modal-create-btn').addEventListener('click', async () => {
      const provider = document.getElementById('provider-select').value;
      try {
        await window.codecafe.createBarista(provider);
        modal.remove();
        renderBaristas();
      } catch (error) {
        console.error('Create barista error:', error);
        alert('Failed to create barista: ' + error.message);
      }
    });
  });
}

setInterval(() => {
  if (currentView === 'dashboard') {
    renderDashboard();
  }
}, 5000);

renderDashboard();

window.codecafe.onOrderEvent((event) => {
  console.log('Order event:', event);
  if (currentView === 'dashboard' || currentView === 'orders') {
    views[currentView]();
  }
});

window.codecafe.onBaristaEvent((event) => {
  console.log('Barista event:', event);
  if (currentView === 'dashboard' || currentView === 'baristas') {
    views[currentView]();
  }
});
