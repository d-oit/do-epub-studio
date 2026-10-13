import { z } from 'zod';

// Workers and strict browser CSP block Zod v4's generated validators.
z.config({ jitless: true });
