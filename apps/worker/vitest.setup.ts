import { vi } from 'vitest';

// No manual mock of 'cloudflare:workers' is needed when using @cloudflare/vitest-pool-workers
// as it provides the real Workers runtime and DurableObject base class.
