---
name: test-patterns
description: Common test patterns for EPUB Studio
license: MIT
---

# Common Test Patterns

## Unit Test Patterns

### describe/it structure
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ModuleName', () => {
  let module: ModuleName;
  
  beforeEach(() => {
    module = new ModuleName();
  });
  
  describe('methodName', () => {
    it('should do something', () => {
      const result = module.methodName(input);
      expect(result).toBe(expected);
    });
    
    it('should throw on invalid input', () => {
      expect(() => module.methodName(invalid)).toThrow();
    });
  });
});
```

### Mocking
```typescript
// Module mock
vi.mock('../services/bookService', () => ({
  BookService: vi.fn().mockImplementation(() => ({
    getBook: vi.fn().mockResolvedValue({ id: '1' }),
  })),
}));

// Spy
const saveSpy = vi.spyOn(storage, 'save');

// Mock return value
mockApi.get('/books').mockResolvedValue({ data: [] });
```

### Async Tests
```typescript
it('should create book', async () => {
  const book = await service.createBook({ title: 'Test' });
  expect(book.id).toBeDefined();
});

it('should handle error', async () => {
  await expect(service.getBook('invalid')).rejects.toThrow('Not found');
});
```

## Integration Test Patterns

### Database Setup
```typescript
import { beforeAll, afterAll } from 'vitest';

describe('Database', () => {
  let db: TestDatabase;
  
  beforeAll(async () => {
    db = await setupTestDatabase();
    await db.migrate();
  });
  
  afterAll(async () => {
    await db.cleanup();
  });
  
  it('should insert and retrieve', async () => {
    const id = await db.insert('books', testBook);
    const book = await db.query('SELECT * FROM books WHERE id = ?', [id]);
    expect(book.title).toBe(testBook.title);
  });
});
```

### API Testing
```typescript
import request from 'supertest';

describe('API', () => {
  it('GET /books returns list', async () => {
    const res = await request(app).get('/books');
    expect(res.status).toBe(200);
    expect(res.body.books).toBeInstanceOf(Array);
  });
});
```

## Test Data Builders

### Book Builder
```typescript
class BookBuilder {
  private book = {
    title: 'Test Book',
    author: 'Test Author',
    created_at: new Date().toISOString(),
  };
  
  withTitle(title: string) {
    this.book.title = title;
    return this;
  }
  
  withAuthor(author: string) {
    this.book.author = author;
    return this;
  }
  
  build() {
    return { ...this.book };
  }
}

// Usage
const book = new BookBuilder()
  .withTitle('My EPUB')
  .withAuthor('John Doe')
  .build();
```

### Grant Builder
```typescript
class GrantBuilder {
  private grant = {
    user_id: 'user-1',
    book_id: 'book-1',
    permission: 'read' as const,
    created_at: new Date().toISOString(),
  };
  
  withUser(userId: string) {
    this.grant.user_id = userId;
    return this;
  }
  
  withPermission(permission: 'read' | 'write' | 'admin') {
    this.grant.permission = permission;
    return this;
  }
  
  build() {
    return { ...this.grant };
  }
}
```

## Coverage Patterns

### Ignoring Non-Critical Code
```typescript
/* istanbul ignore next */
if (process.env.NODE_ENV === 'test') {
  // test only code
}

/* istanbul ignore if */
if (unreachable) {
  // handle unreachable
}
```

### Coverage Configuration
```typescript
// vitest.config.ts
export default defineConfig({
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
    exclude: [
      '**/*.d.ts',
      '**/*.config.*',
      '**/tests/**',
    ],
  },
});
```
