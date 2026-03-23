const STORE_KEY = 'shopsmart-ai-store';

const defaultState = {
  account: null,
  session: { loggedIn: false },
  customers: [],
  bills: [],
  activities: []
};

let state = loadState();

const authView = document.getElementById('authView');
const appView = document.getElementById('appView');
const toast = document.getElementById('toast');
const modal = document.getElementById('confirmModal');

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const customerForm = document.getElementById('customerForm');
const billForm = document.getElementById('billForm');
const paymentForm = document.getElementById('paymentForm');

const totalOutstanding = document.getElementById('totalOutstanding');
const totalCollected = document.getElementById('totalCollected');
const customerCount = document.getElementById('customerCount');
const billCount = document.getElementById('billCount');
const noteCount = document.getElementById('noteCount');
const activityList = document.getElementById('activityList');
const customerList = document.getElementById('customerList');
const billList = document.getElementById('billList');
const entryList = document.getElementById('entryList');
const filteredTotal = document.getElementById('filteredTotal');
const welcomeText = document.getElementById('welcomeText');
const accountSummary = document.getElementById('accountSummary');
const billCustomerSelect = document.getElementById('billCustomerSelect');
const paymentBillSelect = document.getElementById('paymentBillSelect');
const todayDate = document.getElementById('todayDate');
const entryDate = document.getElementById('entryDate');

init();

function init() {
  bindEvents();
  seedDateFields();
  render();
}

function bindEvents() {
  document.querySelectorAll('[data-auth-tab]').forEach((button) => {
    button.addEventListener('click', () => switchAuthTab(button.dataset.authTab));
  });

  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.addEventListener('click', () => switchPage(button.dataset.page));
  });

  loginForm.addEventListener('submit', handleLogin);
  signupForm.addEventListener('submit', handleSignup);
  customerForm.addEventListener('submit', handleCustomerCreate);
  billForm.addEventListener('submit', handleBillCreate);
  paymentForm.addEventListener('submit', handlePaymentUpdate);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('settingsLogoutBtn').addEventListener('click', logout);
  document.getElementById('deleteAccountBtn').addEventListener('click', () => modal.classList.remove('hidden'));
  document.getElementById('cancelDeleteBtn').addEventListener('click', () => modal.classList.add('hidden'));
  document.getElementById('confirmDeleteBtn').addEventListener('click', deleteAccount);
  entryDate.addEventListener('change', renderEntries);
}

function seedDateFields() {
  const today = new Date().toISOString().slice(0, 10);
  billForm.elements.date.value = today;
  entryDate.value = today;
  todayDate.textContent = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : structuredClone(defaultState);
  } catch (error) {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function switchAuthTab(tab) {
  document.querySelectorAll('[data-auth-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.authTab === tab);
  });
  loginForm.classList.toggle('active', tab === 'login');
  signupForm.classList.toggle('active', tab === 'signup');
}

function switchPage(pageId) {
  document.querySelectorAll('.page').forEach((page) => {
    page.classList.toggle('active', page.id === pageId);
  });
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.page === pageId);
  });
}

function handleSignup(event) {
  event.preventDefault();
  const form = new FormData(signupForm);

  state.account = {
    ownerName: form.get('ownerName').trim(),
    shopName: form.get('shopName').trim(),
    phone: form.get('phone').trim(),
    email: form.get('email').trim(),
    password: form.get('password')
  };
  state.session.loggedIn = true;
  pushActivity('Account created', `${state.account.shopName} is ready to operate.`);
  saveState();
  signupForm.reset();
  seedDateFields();
  showToast('Account created successfully');
  render();
}

function handleLogin(event) {
  event.preventDefault();
  if (!state.account) {
    showToast('Create an account first');
    switchAuthTab('signup');
    return;
  }

  const form = new FormData(loginForm);
  const identifier = form.get('identifier').trim();
  const password = form.get('password');
  const matchesIdentifier = identifier === state.account.phone || identifier.toLowerCase() === state.account.email.toLowerCase();

  if (!matchesIdentifier || password !== state.account.password) {
    showToast('Incorrect login details');
    return;
  }

  state.session.loggedIn = true;
  pushActivity('Login successful', 'Owner signed back into the app.');
  saveState();
  loginForm.reset();
  showToast('Logged in');
  render();
}

function logout() {
  state.session.loggedIn = false;
  saveState();
  showToast('Logged out safely');
  render();
}

function deleteAccount() {
  localStorage.removeItem(STORE_KEY);
  state = structuredClone(defaultState);
  modal.classList.add('hidden');
  switchAuthTab('signup');
  showToast('Account deleted from this device');
  render();
}

function handleCustomerCreate(event) {
  event.preventDefault();
  const form = new FormData(customerForm);
  const customer = {
    id: crypto.randomUUID(),
    name: form.get('name').trim(),
    phone: form.get('phone').trim(),
    address: form.get('address').trim(),
    notes: form.get('notes').trim(),
    createdAt: new Date().toISOString()
  };

  state.customers.unshift(customer);
  pushActivity('Customer added', `${customer.name} added to ledger.`);
  saveState();
  customerForm.reset();
  render();
  showToast('Customer saved');
}

function handleBillCreate(event) {
  event.preventDefault();
  if (!state.customers.length) {
    showToast('Add a customer before creating bills');
    switchPage('customersPage');
    return;
  }

  const form = new FormData(billForm);
  const amount = Number(form.get('amount'));
  const bill = {
    id: crypto.randomUUID(),
    customerId: form.get('customerId'),
    date: form.get('date'),
    amount,
    paid: 0,
    notes: form.get('notes').trim(),
    createdAt: new Date().toISOString()
  };

  state.bills.unshift(bill);
  const customer = getCustomerById(bill.customerId);
  pushActivity('Pending bill added', `${customer?.name || 'Customer'} billed for ${formatCurrency(amount)}.`);
  saveState();
  billForm.reset();
  seedDateFields();
  render();
  showToast('Bill added');
}

function handlePaymentUpdate(event) {
  event.preventDefault();
  const form = new FormData(paymentForm);
  const billId = form.get('billId');
  const payment = Number(form.get('payment'));
  const bill = state.bills.find((item) => item.id === billId);

  if (!bill) {
    showToast('Please choose a valid bill');
    return;
  }

  const remaining = bill.amount - bill.paid;
  if (payment <= 0 || payment > remaining) {
    showToast(`Enter payment up to ${formatCurrency(remaining)}`);
    return;
  }

  bill.paid += payment;
  const customer = getCustomerById(bill.customerId);
  pushActivity('Payment updated', `${customer?.name || 'Customer'} paid ${formatCurrency(payment)}.`);
  saveState();
  paymentForm.reset();
  render();
  showToast('Payment recorded');
}

function render() {
  const isLoggedIn = Boolean(state.account && state.session.loggedIn);
  authView.classList.toggle('active', !isLoggedIn);
  appView.classList.toggle('active', isLoggedIn);

  if (!isLoggedIn) {
    return;
  }

  welcomeText.textContent = `${state.account.shopName}`;
  renderMetrics();
  renderCustomers();
  renderBillSelects();
  renderBills();
  renderEntries();
  renderActivities();
  renderAccount();
}

function renderMetrics() {
  const totalPending = state.bills.reduce((sum, bill) => sum + (bill.amount - bill.paid), 0);
  const collected = state.bills.reduce((sum, bill) => sum + bill.paid, 0);
  const notes = state.customers.filter((customer) => customer.notes).length + state.bills.filter((bill) => bill.notes).length;

  totalOutstanding.textContent = formatCurrency(totalPending);
  totalCollected.textContent = formatCurrency(collected);
  customerCount.textContent = state.customers.length;
  billCount.textContent = state.bills.filter((bill) => bill.amount - bill.paid > 0).length;
  noteCount.textContent = notes;
}

function renderActivities() {
  if (!state.activities.length) {
    activityList.className = 'stack-list empty-state';
    activityList.textContent = 'Start by adding a customer and the first pending bill.';
    return;
  }

  activityList.className = 'stack-list';
  activityList.innerHTML = state.activities
    .slice(0, 6)
    .map((activity) => `
      <div class="stack-item">
        <div class="stack-item-header">
          <h4>${activity.title}</h4>
          <span class="stack-item-meta">${formatDateTime(activity.time)}</span>
        </div>
        <p>${activity.description}</p>
      </div>
    `)
    .join('');
}

function renderCustomers() {
  if (!state.customers.length) {
    customerList.className = 'stack-list empty-state';
    customerList.textContent = 'No customers added yet.';
    return;
  }

  customerList.className = 'stack-list';
  customerList.innerHTML = state.customers
    .map((customer) => {
      const pending = getCustomerPending(customer.id);
      const whatsappMessage = encodeURIComponent(`Hello ${customer.name}, this is a reminder that your pending amount is ${formatCurrency(pending)}. Please update when possible.`);
      return `
        <div class="stack-item">
          <div class="stack-item-header">
            <div>
              <h4>${customer.name}</h4>
              <div class="stack-item-meta">${customer.phone}</div>
            </div>
            <strong>${formatCurrency(pending)}</strong>
          </div>
          <p>${customer.address}</p>
          <p><span class="muted-label">Notes:</span> ${customer.notes || 'No notes added'}</p>
          <div class="stack-item-actions">
            <a class="action-chip" href="tel:${customer.phone}">Call</a>
            <a class="action-chip" href="https://wa.me/91${customer.phone}?text=${whatsappMessage}" target="_blank" rel="noreferrer">WhatsApp</a>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderBillSelects() {
  if (!state.customers.length) {
    billCustomerSelect.innerHTML = '<option value="">Add customer first</option>';
  } else {
    billCustomerSelect.innerHTML = state.customers
      .map((customer) => `<option value="${customer.id}">${customer.name}</option>`)
      .join('');
  }

  const pendingBills = state.bills.filter((bill) => bill.amount - bill.paid > 0);
  if (!pendingBills.length) {
    paymentBillSelect.innerHTML = '<option value="">No pending bill</option>';
    return;
  }

  paymentBillSelect.innerHTML = pendingBills
    .map((bill) => {
      const customer = getCustomerById(bill.customerId);
      return `<option value="${bill.id}">${customer?.name || 'Customer'} • ${formatCurrency(bill.amount - bill.paid)}</option>`;
    })
    .join('');
}

function renderBills() {
  if (!state.bills.length) {
    billList.className = 'stack-list empty-state';
    billList.textContent = 'No bills created yet.';
    return;
  }

  billList.className = 'stack-list';
  billList.innerHTML = state.bills
    .map((bill) => {
      const customer = getCustomerById(bill.customerId);
      const pending = bill.amount - bill.paid;
      const progress = Math.min((bill.paid / bill.amount) * 100, 100);
      return `
        <div class="stack-item">
          <div class="stack-item-header">
            <div>
              <h4>${customer?.name || 'Customer removed'}</h4>
              <div class="stack-item-meta">${formatDate(bill.date)}</div>
            </div>
            <strong>${formatCurrency(pending)}</strong>
          </div>
          <div class="stack-item-row">
            <span>Total ${formatCurrency(bill.amount)}</span>
            <span>Paid ${formatCurrency(bill.paid)}</span>
          </div>
          <div class="progress-bar"><span style="width:${progress}%"></span></div>
          <p><span class="muted-label">Notes:</span> ${bill.notes || 'No notes added'}</p>
        </div>
      `;
    })
    .join('');
}

function renderEntries() {
  const selected = entryDate.value;
  const entries = state.bills.filter((bill) => bill.date === selected);
  const total = entries.reduce((sum, bill) => sum + bill.amount, 0);
  filteredTotal.textContent = formatCurrency(total);

  if (!selected) {
    entryList.className = 'stack-list empty-state';
    entryList.textContent = 'Choose a date to view entries.';
    return;
  }

  if (!entries.length) {
    entryList.className = 'stack-list empty-state';
    entryList.textContent = 'No entries found for this date.';
    return;
  }

  entryList.className = 'stack-list';
  entryList.innerHTML = entries
    .map((bill) => {
      const customer = getCustomerById(bill.customerId);
      return `
        <div class="stack-item">
          <div class="stack-item-header">
            <h4>${customer?.name || 'Customer'}</h4>
            <strong>${formatCurrency(bill.amount)}</strong>
          </div>
          <p>Pending now: ${formatCurrency(bill.amount - bill.paid)}</p>
          <p>${bill.notes || 'No notes for this entry'}</p>
        </div>
      `;
    })
    .join('');
}

function renderAccount() {
  if (!state.account) {
    accountSummary.innerHTML = '<p>No account details available.</p>';
    return;
  }

  accountSummary.innerHTML = `
    <div>
      <span class="stack-item-meta">Owner</span>
      <strong>${state.account.ownerName}</strong>
    </div>
    <div>
      <span class="stack-item-meta">Shop</span>
      <strong>${state.account.shopName}</strong>
    </div>
    <div>
      <span class="stack-item-meta">Contact</span>
      <strong>${state.account.phone}</strong>
      <p>${state.account.email}</p>
    </div>
  `;
}

function getCustomerById(id) {
  return state.customers.find((customer) => customer.id === id);
}

function getCustomerPending(customerId) {
  return state.bills
    .filter((bill) => bill.customerId === customerId)
    .reduce((sum, bill) => sum + (bill.amount - bill.paid), 0);
}

function pushActivity(title, description) {
  state.activities.unshift({
    id: crypto.randomUUID(),
    title,
    description,
    time: new Date().toISOString()
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2200);
}
