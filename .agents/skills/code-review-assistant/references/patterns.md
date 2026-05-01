---
name: patterns
description: Common code patterns for EPUB Studio
license: MIT
---

# Common Code Patterns

## TypeScript Conventions

### Zod Schemas

```typescript
import { z } from 'zod';

export const BookSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500),
  author: z.string().max(200),
  created_at: z.string().datetime(),
});
```

### Zustand Stores

```typescript
import { create } from 'zustand';

interface BookState {
  books: Book[];
  currentBook: Book | null;
  setCurrentBook: (book: Book) => void;
}

export const useBookStore = create<BookState>((set) => ({
  books: [],
  currentBook: null,
  setCurrentBook: (book) => set({ currentBook: book }),
}));
```

## EPUB Patterns

### Content Extraction

```typescript
async function extractContent(epub: EPUB): Promise<Section[]> {
  const book = await ePub.load(epub.locations);
  const spine = book.spine;
  
  return spine.items.map((item: SpineItem) => ({
    id: item.idref,
    content: item.href,
  }));
}
```

### Annotation Locators

```typescript
interface AnnotationLocator {
  cfi: string;
  type: 'chapter' | 'paragraph' | 'sentence';
  offset?: number;
}

function createLocator(cfi: string, type: LocatorType): AnnotationLocator {
  return { cfi, type };
}
```

## Cloudflare Worker Patterns

### R2 Signed URLs

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async function getSignedUrl(bookId: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: EPUB_BUCKET,
    Key: `${bookId}/epub`,
  });
  
  return getSignedUrl(client, command, { expiresIn: 3600 });
}
```

### Turso Queries

```typescript
import { createClient } from '@libsql/client';

const client = createClient({ url: LIBSQL_URL, authToken: TURSO_TOKEN });

async function getBook(bookId: string) {
  return client.execute('SELECT * FROM books WHERE id = ?', [bookId]);
}
```

## Error Handling

### Service Layer

```typescript
class BookService {
  async getBook(id: string): Promise<Result<Book, Error>> {
    try {
      const book = await this.db.getBook(id);
      return { ok: true, value: book };
    } catch (e) {
      return { ok: false, error: e as Error };
    }
  }
}
```

## Validation at Boundaries

### API Request Validation

```typescript
import { z } from 'zod';

const CreateBookSchema = z.object({
  title: z.string().min(1).max(500),
  author: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const result = CreateBookSchema.safeParse(body);
  
  if (!result.success) {
    return Response.json({ errors: result.error }, { status: 400 });
  }
  
  // Process valid request
}
```
