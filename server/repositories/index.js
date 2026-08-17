/**
 * Repository barrel export.
 * All business logic imports from here — never from db.js directly.
 * Swap JSON backend for PostgreSQL by changing implementations here.
 */

export * as productRepo from './productRepository.js';
export * as offerRepo from './offerRepository.js';
export * as supplierRepo from './supplierRepository.js';
export * as priceObservationRepo from './priceObservationRepository.js';
export * as procurementDecisionRepo from './procurementDecisionRepository.js';
