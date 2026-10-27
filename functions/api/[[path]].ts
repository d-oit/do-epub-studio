// Wrangler runs from the repository root for both Pages Git builds and the
// Lighthouse preview deploy. Keep that root's Functions directory discoverable.
export { onRequest } from '../../apps/web/functions/api/[[path]]';
