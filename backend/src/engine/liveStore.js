let liveStore = {
  orders: [],
  payments: [],
  refunds: [],
  ledger: [],
  events: [],
  incidents: [],
};

function getLiveStore() {
  return liveStore;
}

function resetLiveStore() {
  liveStore = {
    orders: [],
    payments: [],
    refunds: [],
    ledger: [],
    events: [],
    incidents: [],
  };
  return liveStore;
}

function addLiveOrder(order) {
  liveStore.orders.unshift(order);
}

function addLivePayment(payment) {
  liveStore.payments.unshift(payment);
}

function addLiveRefund(refund) {
  liveStore.refunds.unshift(refund);
}

function addLiveEvent(event) {
  liveStore.events.unshift({
    id: `EVT-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...event,
  });
}

function addLiveIncident(incident) {
  liveStore.incidents.unshift(incident);
}

module.exports = {
  getLiveStore,
  resetLiveStore,
  addLiveOrder,
  addLivePayment,
  addLiveRefund,
  addLiveEvent,
  addLiveIncident,
};
