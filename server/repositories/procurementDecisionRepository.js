import { run, getStore } from '../db.js';

/**
 * Procurement Decision Repository — immutable sourcing decision snapshots.
 * When a customer order triggers sourcing, saves the exact allocation at that moment.
 */

export async function create(decision) {
  const id = decision.id || `pd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await run(
    `INSERT INTO procurement_decisions (id, order_id, canonical_product_id, requested_quantity, optimization_mode, allocations, total_acquisition_cost, supplier_scores_snapshot, decided_at, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      decision.order_id || null,
      decision.canonical_product_id,
      decision.requested_quantity,
      decision.optimization_mode || 'best_value',
      decision.allocations,
      decision.total_acquisition_cost,
      decision.supplier_scores_snapshot || {},
      decision.decided_at || new Date().toISOString(),
      decision.status || 'draft',
      decision.created_by || 'sys'
    ]
  );
  return { id, ...decision };
}

export async function findByOrder(orderId) {
  const store = getStore();
  return store.procurement_decisions.filter((d) => d.order_id === orderId);
}

export async function findAll() {
  const store = getStore();
  return [...store.procurement_decisions].reverse();
}

export async function findById(id) {
  const store = getStore();
  return store.procurement_decisions.find((d) => d.id === id) || null;
}

export async function updateStatus(id, status) {
  const store = getStore();
  const decision = store.procurement_decisions.find((d) => d.id === id);
  if (!decision) throw new Error(`Decision ${id} not found`);

  const validTransitions = {
    'draft': ['confirmed'],
    'confirmed': ['ordered'],
    'ordered': ['fulfilled'],
    'fulfilled': []
  };

  if (!validTransitions[decision.status]?.includes(status)) {
    throw new Error(`Invalid status transition: ${decision.status} → ${status}`);
  }

  await run(`UPDATE procurement_decisions SET status = ? WHERE id = ?`, [status, id]);
  return { ...decision, status };
}
