// CodeCafe Manager - Renderer App
// WARNING: This is a simplified implementation for M2 Phase 3
// TODO: Implement proper XSS protection (e.g., DOMPurify) in production

// View 라우터
const views = {
  dashboard: renderDashboard,
  "new-order": renderNewOrder,
  orders: renderOrders,
  baristas: renderBaristas,
  worktrees: renderWorktrees,
  recipes: renderRecipes,
};

let currentView = "dashboard";

// 네비게이션 설정
document.addEventListener("DOMContentLoaded", () => {
  const navButtons = document.querySelectorAll(".sidebar nav button");
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      navButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentView = btn.dataset.view;
      renderView(currentView);
    });
  });

  // 초기 뷰 렌더링
  renderView(currentView);

  // 이벤트 리스너 등록
  window.codecafe.onBaristaEvent((event) => {
    console.log("Barista Event:", event);
    if (currentView === "baristas" || currentView === "dashboard") {
      renderView(currentView);
    }
  });

  window.codecafe.onOrderEvent((event) => {
    console.log("Order Event:", event);
    if (currentView === "orders" || currentView === "dashboard") {
      renderView(currentView);
    }
  });
});

function renderView(viewName) {
  const content = document.getElementById("content");
  const title = document.getElementById("view-title");

  // 타이틀 업데이트
  const titles = {
    dashboard: "Dashboard",
    "new-order": "New Order",
    orders: "Orders",
    baristas: "Baristas",
    worktrees: "Worktrees",
    recipes: "Recipe Studio",
  };
  title.textContent = titles[viewName] || "CodeCafe";

  // 뷰 렌더링
  if (views[viewName]) {
    views[viewName](content);
  } else {
    content.textContent = "";
    const div = document.createElement("div");
    div.className = "empty-state";
    const p = document.createElement("p");
    p.textContent = `View not found: ${viewName}`;
    div.appendChild(p);
    content.appendChild(div);
  }
}

// Helper: Create element with text content
// Security: Removed innerHTML option to prevent potential XSS
function createEl(tag, options = {}) {
  const el = document.createElement(tag);
  if (options.className) el.className = options.className;
  if (options.text) el.textContent = options.text;
  if (options.style) Object.assign(el.style, options.style);
  if (options.onclick) el.onclick = options.onclick;
  return el;
}

// ============================================
// Dashboard View
// ============================================
async function renderDashboard(container) {
  container.textContent = "";

  const grid = createEl("div", { className: "grid" });

  const baristasCard = createEl("div", { className: "card" });
  baristasCard.id = "dashboard-baristas";
  // Security: Use DOM API instead of innerHTML
  const baristasH3 = createEl("h3", { text: "Baristas" });
  const baristasLoading = createEl("div", { className: "loading", text: "Loading..." });
  baristasCard.appendChild(baristasH3);
  baristasCard.appendChild(baristasLoading);

  const ordersCard = createEl("div", { className: "card" });
  ordersCard.id = "dashboard-orders";
  // Security: Use DOM API instead of innerHTML
  const ordersH3 = createEl("h3", { text: "Recent Orders" });
  const ordersLoading = createEl("div", { className: "loading", text: "Loading..." });
  ordersCard.appendChild(ordersH3);
  ordersCard.appendChild(ordersLoading);

  grid.appendChild(baristasCard);
  grid.appendChild(ordersCard);
  container.appendChild(grid);

  // 바리스타 로드
  const baristas = await window.codecafe.getAllBaristas();
  baristasCard.textContent = "";
  const h3b = createEl("h3", { text: "Baristas" });
  baristasCard.appendChild(h3b);

  if (baristas.length === 0) {
    const empty = createEl("div", { className: "empty-state", text: "No baristas yet" });
    baristasCard.appendChild(empty);
  } else {
    baristas.forEach((b) => {
      const item = createEl("div", { className: `barista-item ${b.status}` });
      const strong = createEl("strong", { text: b.provider });
      item.appendChild(strong);
      item.appendChild(document.createTextNode(` - ${b.status}`));
      baristasCard.appendChild(item);
    });
  }

  // 주문 로드
  const orders = await window.codecafe.getAllOrders();
  ordersCard.textContent = "";
  const h3o = createEl("h3", { text: "Recent Orders" });
  ordersCard.appendChild(h3o);

  const recentOrders = orders.slice(-5).reverse();
  if (recentOrders.length === 0) {
    const empty = createEl("div", { className: "empty-state", text: "No orders yet" });
    ordersCard.appendChild(empty);
  } else {
    recentOrders.forEach((o) => {
      const item = createEl("div", { className: `order-item ${o.status}` });
      const strong = createEl("strong", { text: o.recipeName });
      item.appendChild(strong);
      item.appendChild(document.createTextNode(` - ${o.status}`));
      ordersCard.appendChild(item);
    });
  }
}

// ============================================
// New Order View
// ============================================
async function renderNewOrder(container) {
  const providers = await window.codecafe.getAvailableProviders();

  container.textContent = "";

  const card = createEl("div", { className: "card" });
  card.style.maxWidth = "600px";

  const h3 = createEl("h3", { text: "Create New Order" });
  card.appendChild(h3);

  const form = document.createElement("form");
  form.id = "new-order-form";

  // Provider 선택
  const providerGroup = createEl("div");
  providerGroup.style.marginBottom = "15px";
  const providerLabel = createEl("label", { text: "Provider" });
  providerLabel.style.display = "block";
  providerLabel.style.marginBottom = "5px";
  providerLabel.style.color = "#8b7355";
  const providerSelect = document.createElement("select");
  providerSelect.name = "provider";
  providerSelect.style.cssText = "width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #333; color: #e0e0e0; border-radius: 4px;";
  providers.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.name;
    providerSelect.appendChild(option);
  });
  providerGroup.appendChild(providerLabel);
  providerGroup.appendChild(providerSelect);

  // Recipe Name
  const recipeGroup = createEl("div");
  recipeGroup.style.marginBottom = "15px";
  const recipeLabel = createEl("label", { text: "Recipe Name" });
  recipeLabel.style.display = "block";
  recipeLabel.style.marginBottom = "5px";
  recipeLabel.style.color = "#8b7355";
  const recipeInput = document.createElement("input");
  recipeInput.type = "text";
  recipeInput.name = "recipeName";
  recipeInput.placeholder = "e.g., pm-agent";
  recipeInput.required = true;
  recipeInput.style.cssText = "width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #333; color: #e0e0e0; border-radius: 4px;";
  recipeGroup.appendChild(recipeLabel);
  recipeGroup.appendChild(recipeInput);

  // Counter
  const counterGroup = createEl("div");
  counterGroup.style.marginBottom = "15px";
  const counterLabel = createEl("label", { text: "Counter (Working Directory)" });
  counterLabel.style.display = "block";
  counterLabel.style.marginBottom = "5px";
  counterLabel.style.color = "#8b7355";
  const counterInput = document.createElement("input");
  counterInput.type = "text";
  counterInput.name = "counter";
  counterInput.value = ".";
  counterInput.required = true;
  counterInput.style.cssText = "width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #333; color: #e0e0e0; border-radius: 4px;";
  counterGroup.appendChild(counterLabel);
  counterGroup.appendChild(counterInput);

  // Variables
  const varsGroup = createEl("div");
  varsGroup.style.marginBottom = "15px";
  const varsLabel = createEl("label", { text: "Variables (JSON)" });
  varsLabel.style.display = "block";
  varsLabel.style.marginBottom = "5px";
  varsLabel.style.color = "#8b7355";
  const varsTextarea = document.createElement("textarea");
  varsTextarea.name = "vars";
  varsTextarea.placeholder = '{"key": "value"}';
  varsTextarea.rows = 4;
  varsTextarea.style.cssText = "width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #333; color: #e0e0e0; border-radius: 4px; font-family: monospace;";
  varsGroup.appendChild(varsLabel);
  varsGroup.appendChild(varsTextarea);

  // Submit button
  const submitBtn = createEl("button", { text: "Create Order" });
  submitBtn.type = "submit";
  submitBtn.className = "btn";

  form.appendChild(providerGroup);
  form.appendChild(recipeGroup);
  form.appendChild(counterGroup);
  form.appendChild(varsGroup);
  form.appendChild(submitBtn);

  card.appendChild(form);
  container.appendChild(card);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const provider = formData.get("provider");
    const recipeName = formData.get("recipeName");
    const counter = formData.get("counter");
    const varsText = formData.get("vars");

    let vars = {};
    if (varsText) {
      try {
        vars = JSON.parse(varsText);
      } catch (err) {
        alert("Invalid JSON in variables field");
        return;
      }
    }

    try {
      const order = await window.codecafe.createOrder({
        recipeId: recipeName,
        recipeName,
        counter,
        provider,
        vars,
      });
      alert(`Order created: ${order.id}`);
      renderView("orders");
    } catch (err) {
      alert(`Failed to create order: ${err.message}`);
    }
  });
}

// ============================================
// Orders View
// ============================================
async function renderOrders(container) {
  const orders = await window.codecafe.getAllOrders();

  container.textContent = "";

  if (orders.length === 0) {
    const empty = createEl("div", { className: "empty-state", text: "No orders yet. Create one from New Order tab." });
    container.appendChild(empty);
    return;
  }

  const card = createEl("div", { className: "card" });
  const h3 = createEl("h3", { text: "All Orders" });
  card.appendChild(h3);

  orders.reverse().forEach((o) => {
    const item = createEl("div", { className: `order-item ${o.status}` });
    const flexDiv = createEl("div");
    flexDiv.style.cssText = "display: flex; justify-content: space-between; align-items: center;";

    const infoDiv = createEl("div");
    const strong = createEl("strong", { text: o.recipeName });
    infoDiv.appendChild(strong);
    infoDiv.appendChild(document.createTextNode(` - ${o.status}`));

    const detailDiv = createEl("div");
    detailDiv.style.cssText = "font-size: 12px; color: #999; margin-top: 4px;";
    detailDiv.textContent = `ID: ${o.id} | Provider: ${o.provider || "N/A"}`;
    infoDiv.appendChild(detailDiv);

    const actionsDiv = createEl("div");
    const logBtn = createEl("button", { text: "Log", className: "btn btn-secondary" });
    logBtn.onclick = () => viewOrderLog(o.id);
    actionsDiv.appendChild(logBtn);

    if (o.status === "running") {
      const cancelBtn = createEl("button", { text: "Cancel", className: "btn btn-secondary" });
      cancelBtn.style.marginLeft = "5px";
      cancelBtn.onclick = () => cancelOrder(o.id);
      actionsDiv.appendChild(cancelBtn);
    }

    flexDiv.appendChild(infoDiv);
    flexDiv.appendChild(actionsDiv);
    item.appendChild(flexDiv);
    card.appendChild(item);
  });

  container.appendChild(card);
}

async function viewOrderLog(orderId) {
  const log = await window.codecafe.getOrderLog(orderId);
  alert(`Order Log:\n\n${log || "No logs yet"}`);
}

async function cancelOrder(orderId) {
  if (confirm(`Cancel order ${orderId}?`)) {
    await window.codecafe.cancelOrder(orderId);
    renderView("orders");
  }
}

// ============================================
// Baristas View
// ============================================
async function renderBaristas(container) {
  const baristas = await window.codecafe.getAllBaristas();

  container.textContent = "";

  if (baristas.length === 0) {
    const empty = createEl("div", { className: "empty-state" });
    const p = createEl("p", { text: "No baristas running" });
    const btn = createEl("button", { text: "Create Barista", className: "btn" });
    btn.onclick = createBarista;
    empty.appendChild(p);
    empty.appendChild(btn);
    container.appendChild(empty);
    return;
  }

  const card = createEl("div", { className: "card" });
  const h3 = createEl("h3", { text: "All Baristas" });
  card.appendChild(h3);

  baristas.forEach((b) => {
    const item = createEl("div", { className: `barista-item ${b.status}` });
    const strong = createEl("strong", { text: b.provider });
    item.appendChild(strong);
    item.appendChild(document.createTextNode(` - ${b.status}`));

    const detail = createEl("div");
    detail.style.cssText = "font-size: 12px; color: #999; margin-top: 4px;";
    detail.textContent = `ID: ${b.id}`;
    item.appendChild(detail);
    card.appendChild(item);
  });

  container.appendChild(card);

  const createBtn = createEl("button", { text: "Create Barista", className: "btn" });
  createBtn.style.marginTop = "20px";
  createBtn.onclick = createBarista;
  container.appendChild(createBtn);
}

async function createBarista() {
  const provider = prompt("Enter provider (claude-code or codex):", "claude-code");
  if (provider) {
    await window.codecafe.createBarista(provider);
    renderView("baristas");
  }
}

// ============================================
// Worktrees View (M2)
// ============================================
async function renderWorktrees(container) {
  container.textContent = "";

  const card = createEl("div", { className: "card" });
  card.style.maxWidth = "900px";

  const h3 = createEl("h3", { text: "Git Worktrees" });
  card.appendChild(h3);

  const inputGroup = createEl("div");
  inputGroup.style.marginBottom = "20px";

  const label = createEl("label", { text: "Repository Path" });
  label.style.display = "block";
  label.style.marginBottom = "5px";
  label.style.color = "#8b7355";

  const flexDiv = createEl("div");
  flexDiv.style.cssText = "display: flex; gap: 10px;";

  const input = document.createElement("input");
  input.type = "text";
  input.id = "worktree-repo-path";
  input.value = ".";
  input.style.cssText = "flex: 1; padding: 8px; background: #1a1a1a; border: 1px solid #333; color: #e0e0e0; border-radius: 4px;";

  const loadBtn = createEl("button", { text: "Load", className: "btn" });
  loadBtn.onclick = loadWorktrees;

  flexDiv.appendChild(input);
  flexDiv.appendChild(loadBtn);

  inputGroup.appendChild(label);
  inputGroup.appendChild(flexDiv);
  card.appendChild(inputGroup);

  const listDiv = createEl("div");
  listDiv.id = "worktree-list";
  const empty = createEl("div", { className: "empty-state", text: "Enter repository path and click Load" });
  listDiv.appendChild(empty);

  card.appendChild(listDiv);
  container.appendChild(card);
}

async function loadWorktrees() {
  const repoPath = document.getElementById("worktree-repo-path").value;
  const listContainer = document.getElementById("worktree-list");

  listContainer.textContent = "";
  const loading = createEl("div", { className: "loading", text: "Loading..." });
  listContainer.appendChild(loading);

  const result = await window.codecafe.listWorktrees(repoPath);

  listContainer.textContent = "";

  if (!result.success) {
    const error = createEl("div", { className: "empty-state", text: `Error: ${result.error}` });
    error.style.color = "#f44336";
    listContainer.appendChild(error);
    return;
  }

  const worktrees = result.data;

  if (worktrees.length === 0) {
    const empty = createEl("div", { className: "empty-state", text: "No worktrees found" });
    listContainer.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.style.cssText = "width: 100%; border-collapse: collapse;";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.style.borderBottom = "1px solid #333";

  ["Branch", "Path", "Commit", "Actions"].forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    th.style.cssText = "text-align: left; padding: 10px; color: #8b7355;";
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  worktrees.forEach((wt) => {
    const row = document.createElement("tr");
    row.style.borderBottom = "1px solid #222";

    const branchTd = createEl("td", { text: wt.branch || "N/A" });
    branchTd.style.padding = "10px";

    const pathTd = createEl("td", { text: wt.path });
    pathTd.style.cssText = "padding: 10px; font-size: 12px; color: #999;";

    const commitTd = createEl("td", { text: wt.commit ? wt.commit.substring(0, 7) : "N/A" });
    commitTd.style.cssText = "padding: 10px; font-size: 12px; font-family: monospace;";

    const actionsTd = createEl("td");
    actionsTd.style.padding = "10px";

    const exportBtn = createEl("button", { text: "Export Patch", className: "btn btn-secondary" });
    exportBtn.style.cssText = "font-size: 12px; padding: 5px 10px; margin-right: 5px;";
    exportBtn.onclick = () => exportWorktreePatch(wt.path);

    const openBtn = createEl("button", { text: "Open Folder", className: "btn btn-secondary" });
    openBtn.style.cssText = "font-size: 12px; padding: 5px 10px; margin-right: 5px;";
    openBtn.onclick = () => openWorktreeFolder(wt.path);

    const deleteBtn = createEl("button", { text: "Delete", className: "btn btn-secondary" });
    deleteBtn.style.cssText = "font-size: 12px; padding: 5px 10px; background: #f44336;";
    deleteBtn.onclick = () => removeWorktree(wt.path);

    actionsTd.appendChild(exportBtn);
    actionsTd.appendChild(openBtn);
    actionsTd.appendChild(deleteBtn);

    row.appendChild(branchTd);
    row.appendChild(pathTd);
    row.appendChild(commitTd);
    row.appendChild(actionsTd);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  listContainer.appendChild(table);
}

async function exportWorktreePatch(worktreePath) {
  const baseBranch = prompt("Enter base branch:", "main");
  if (!baseBranch) return;

  const result = await window.codecafe.exportPatch(worktreePath, baseBranch);

  if (result.success) {
    alert(`Patch exported to: ${result.data}`);
  } else {
    alert(`Failed to export patch: ${result.error}`);
  }
}

async function openWorktreeFolder(worktreePath) {
  await window.codecafe.openWorktreeFolder(worktreePath);
}

async function removeWorktree(worktreePath) {
  if (!confirm(`Delete worktree at ${worktreePath}?\n\nThis will fail if there are uncommitted changes.`)) {
    return;
  }

  const result = await window.codecafe.removeWorktree(worktreePath, false);

  if (result.success) {
    alert("Worktree deleted successfully");
    loadWorktrees();
  } else {
    if (confirm(`Failed: ${result.error}\n\nForce delete?`)) {
      const forceResult = await window.codecafe.removeWorktree(worktreePath, true);
      if (forceResult.success) {
        alert("Worktree force deleted");
        loadWorktrees();
      } else {
        alert(`Failed to force delete: ${forceResult.error}`);
      }
    }
  }
}

// ============================================
// Recipe Studio View (M2)
// ============================================
async function renderRecipes(container) {
  container.textContent = "";

  const flexDiv = createEl("div");
  flexDiv.style.cssText = "display: flex; gap: 20px; height: 100%;";

  const listCard = createEl("div", { className: "card" });
  listCard.style.width = "250px";

  const h3List = createEl("h3", { text: "Recipes" });
  listCard.appendChild(h3List);

  const listDiv = createEl("div");
  listDiv.id = "recipe-list";
  const loading = createEl("div", { className: "loading", text: "Loading..." });
  listDiv.appendChild(loading);
  listCard.appendChild(listDiv);

  const newBtn = createEl("button", { text: "New Recipe", className: "btn" });
  newBtn.style.cssText = "margin-top: 15px; width: 100%;";
  newBtn.onclick = createNewRecipe;
  listCard.appendChild(newBtn);

  const editorCard = createEl("div", { className: "card" });
  editorCard.style.flex = "1";

  const editorDiv = createEl("div");
  editorDiv.id = "recipe-editor";
  const emptyEditor = createEl("div", { className: "empty-state", text: "Select a recipe to edit" });
  editorDiv.appendChild(emptyEditor);
  editorCard.appendChild(editorDiv);

  flexDiv.appendChild(listCard);
  flexDiv.appendChild(editorCard);
  container.appendChild(flexDiv);

  loadRecipeList();
}

async function loadRecipeList() {
  const listContainer = document.getElementById("recipe-list");
  const result = await window.codecafe.listRecipes();

  listContainer.textContent = "";

  if (!result.success) {
    const error = createEl("div", { text: `Error: ${result.error}` });
    error.style.color = "#f44336";
    listContainer.appendChild(error);
    return;
  }

  const recipes = result.data;

  if (recipes.length === 0) {
    const empty = createEl("div", { className: "empty-state", text: "No recipes yet" });
    empty.style.fontSize = "12px";
    listContainer.appendChild(empty);
    return;
  }

  recipes.forEach((name) => {
    const item = createEl("div", { text: name });
    item.style.cssText = "padding: 8px; margin-bottom: 5px; background: #1a1a1a; border-radius: 4px; cursor: pointer; font-size: 14px;";
    item.onclick = () => loadRecipe(name);
    listContainer.appendChild(item);
  });
}

let currentRecipe = null;
let currentRecipeName = null;

async function loadRecipe(recipeName) {
  const result = await window.codecafe.getRecipe(recipeName);

  if (!result.success) {
    alert(`Failed to load recipe: ${result.error}`);
    return;
  }

  currentRecipe = result.data;
  currentRecipeName = recipeName;

  renderRecipeEditor();
}

function renderRecipeEditor() {
  const editorContainer = document.getElementById("recipe-editor");
  editorContainer.textContent = "";

  if (!currentRecipe) {
    const empty = createEl("div", { className: "empty-state", text: "Select a recipe to edit" });
    editorContainer.appendChild(empty);
    return;
  }

  const h3 = createEl("h3", { text: currentRecipeName });
  editorContainer.appendChild(h3);

  const btnGroup = createEl("div");
  btnGroup.style.marginBottom = "15px";

  const saveBtn = createEl("button", { text: "Save", className: "btn" });
  saveBtn.onclick = saveCurrentRecipe;

  const validateBtn = createEl("button", { text: "Validate", className: "btn btn-secondary" });
  validateBtn.style.marginLeft = "5px";
  validateBtn.onclick = validateCurrentRecipe;

  const copyBtn = createEl("button", { text: "Copy YAML", className: "btn btn-secondary" });
  copyBtn.style.marginLeft = "5px";
  copyBtn.onclick = copyRecipeYaml;

  btnGroup.appendChild(saveBtn);
  btnGroup.appendChild(validateBtn);
  btnGroup.appendChild(copyBtn);
  editorContainer.appendChild(btnGroup);

  const textareaGroup = createEl("div");
  textareaGroup.style.marginBottom = "15px";

  const label = createEl("label", { text: "Recipe YAML" });
  label.style.cssText = "display: block; margin-bottom: 5px; color: #8b7355;";
  textareaGroup.appendChild(label);

  const yamlContent = stringifyYaml(currentRecipe);
  const textarea = document.createElement("textarea");
  textarea.id = "recipe-yaml-editor";
  textarea.rows = 25;
  textarea.value = yamlContent;
  textarea.style.cssText = "width: 100%; padding: 10px; background: #1a1a1a; border: 1px solid #333; color: #e0e0e0; border-radius: 4px; font-family: monospace; font-size: 13px;";
  textareaGroup.appendChild(textarea);

  editorContainer.appendChild(textareaGroup);

  const validationDiv = createEl("div");
  validationDiv.id = "recipe-validation-result";
  editorContainer.appendChild(validationDiv);
}

async function saveCurrentRecipe() {
  const yamlText = document.getElementById("recipe-yaml-editor").value;

  try {
    const recipeData = parseYaml(yamlText);
    const result = await window.codecafe.saveRecipe(currentRecipeName, recipeData);

    if (result.success) {
      alert("Recipe saved successfully");
    } else {
      alert(`Failed to save recipe: ${result.error}`);
    }
  } catch (err) {
    alert(`Invalid YAML: ${err.message}`);
  }
}

async function validateCurrentRecipe() {
  const yamlText = document.getElementById("recipe-yaml-editor").value;
  const validationContainer = document.getElementById("recipe-validation-result");
  validationContainer.textContent = "";

  try {
    const recipeData = parseYaml(yamlText);
    const result = await window.codecafe.validateRecipe(recipeData);

    if (result.success) {
      const success = createEl("div", { text: "✓ Recipe is valid" });
      success.style.cssText = "padding: 10px; background: #1a4d1a; border: 1px solid #4caf50; border-radius: 4px; color: #4caf50;";
      validationContainer.appendChild(success);
    } else {
      const errorDiv = createEl("div");
      errorDiv.style.cssText = "padding: 10px; background: #4d1a1a; border: 1px solid #f44336; border-radius: 4px; color: #f44336;";

      const title = createEl("div", { text: "Validation Errors:" });
      errorDiv.appendChild(title);

      const errorList = createEl("div");
      errorList.style.marginTop = "10px";
      result.errors.forEach((e) => {
        const errorItem = createEl("div", { text: `• ${e.path.join(".")}: ${e.message}` });
        errorItem.style.marginBottom = "5px";
        errorList.appendChild(errorItem);
      });
      errorDiv.appendChild(errorList);

      validationContainer.appendChild(errorDiv);
    }
  } catch (err) {
    const error = createEl("div", { text: `YAML Parse Error: ${err.message}` });
    error.style.cssText = "padding: 10px; background: #4d1a1a; border: 1px solid #f44336; border-radius: 4px; color: #f44336;";
    validationContainer.appendChild(error);
  }
}

function copyRecipeYaml() {
  const yamlText = document.getElementById("recipe-yaml-editor").value;
  navigator.clipboard.writeText(yamlText);
  alert("YAML copied to clipboard");
}

async function createNewRecipe() {
  const recipeName = prompt("Enter recipe filename (e.g., my-recipe.yaml):");
  if (!recipeName) return;

  if (!recipeName.endsWith(".yaml") && !recipeName.endsWith(".yml")) {
    alert("Recipe filename must end with .yaml or .yml");
    return;
  }

  const template = {
    name: recipeName.replace(/\.(yaml|yml)$/, ""),
    version: "0.1.0",
    defaults: {
      provider: "claude-code",
      workspace: {
        mode: "in-place",
      },
    },
    inputs: {
      counter: ".",
    },
    vars: {},
    steps: [
      {
        id: "step-1",
        type: "ai.interactive",
        prompt: "Your prompt here",
      },
    ],
  };

  currentRecipe = template;
  currentRecipeName = recipeName;
  renderRecipeEditor();
}

// Simple YAML parser/stringifier (fallback)
function parseYaml(text) {
  // For M2, we use JSON format in the editor
  // Main process handles actual YAML parsing with yaml package
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Please use JSON format in the editor. YAML syntax support is limited in renderer.");
  }
}

function stringifyYaml(obj) {
  // Simple JSON stringification for M2
  return JSON.stringify(obj, null, 2);
}
